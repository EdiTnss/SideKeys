// The session tape: a flight recorder for practice. The app writes on it what came from the
// keyboard (notes and pedals, as received) and what it decided (the mode, the chord on screen,
// the progression and its metronome, and every snapshot with the chord it answered and its
// verdict). The last hour stays in memory; "Save session" writes it out as JSON.
//
// A saved tape replays in Node through the same capture and analyzer, on a virtual clock, and
// the replay reports every snapshot or verdict that is no longer what it was: the harness in
// harness/replay.js and test/replay.test.js. Pure, no DOM. It lives in ui/ because it binds the
// capture (midi/) to the app's own rules (session.js); see docs/spec-capture.md.

import { VoicingCapture } from '../midi/capture.js';
import { parseMidiMessage } from '../midi/input.js';
import { parseChord } from '../theory/chords.js';
import { analyzeVoicing } from '../theory/analyzer.js';
import { midiToName } from '../theory/notes.js';
import { parseGrid } from '../theory/progressions.js';
import { positionAt } from '../theory/timing.js';
import { createSession, snapshotTarget } from './session.js';

export const TAPE_FORMAT = 1;
export const TAPE_WINDOW_MS = 60 * 60 * 1000;
// How late a live debounce timer can run. A note arriving in that window, with no snapshot on
// the tape before it, found the timer still waiting and restarted it. Measured on a session
// recorded through the app on 2026-09-19: 1.6–15.3 ms late. Kept small on purpose: inside the
// window a change to the capture's timing cannot be told from a late timer, so it goes unseen.
export const LATE_MS = 25;
const PEDALS = new Set([64, 66, 67]);             // sustain, soft, sostenuto
const CONTEXT = ['mode', 'progression', 'run', 'recorder', 'chord'];
const round = value => Math.round(value * 100) / 100;

/** Notes on any channel and the three pedals; not active sensing, clock or the other controllers. */
export function keepMidi(data) {
  const status = data[0] & 0xf0;
  return status === 0x80 || status === 0x90 || (status === 0xb0 && PEDALS.has(data[1]));
}

/** The analysis reduced to what a replay compares. Pitch classes, except muddy (MIDI pairs). */
export function verdictOf(analysis) {
  return {
    type: analysis.voicing.type,
    bass: analysis.voicing.bass,
    missing: [...analysis.missing],
    wrong: [...analysis.wrong],
    avoid: [...analysis.avoid],
    muddy: analysis.muddy.map(({ lower, upper }) => [lower, upper]),
    doublings: [...analysis.doublings],
  };
}

/**
 * createTape({ settings, now, windowMs, date }) → { at(performanceMs), event(type, fields), midi(data), toJSON(), size }
 * Times are milliseconds from the tape's start. Events older than the window are dropped in
 * steps; what they had set (mode, chord, progression, metronome, recorder, settings) is kept and
 * written at the front of a saved session, so the replay starts from the right state.
 */
export function createTape({ settings = {}, now = () => globalThis.performance?.now() ?? Date.now(), windowMs = TAPE_WINDOW_MS, date = () => new Date() } = {}) {
  const origin = now();
  let events = [];
  const before = { settings: { ...settings } };

  const at = performanceMs => round(performanceMs - origin);

  function fold(old) {
    const { t, type, ...fields } = old;
    if (type === 'settings') before.settings = { ...before.settings, ...fields };
    else if (type === 'start' || type === 'stop') before.run = old;
    else if (CONTEXT.includes(type)) before[type] = old;
  }

  function event(type, fields = {}) {
    const entry = { t: at(now()), type, ...fields };
    events.push(entry);
    // Trimmed once the oldest event is a minute past the window, not on every event.
    if (events[0].t < entry.t - windowMs - windowMs / 60) {
      const cut = entry.t - windowMs;
      let n = 0;
      while (n < events.length && events[n].t < cut) fold(events[n++]);
      events = events.slice(n);
    }
    return entry;
  }

  function toJSON() {
    const start = events[0]?.t ?? 0;
    const context = CONTEXT.map(key => before[key]).filter(Boolean).map(old => ({ ...old, t: start }));
    return {
      format: TAPE_FORMAT,
      app: 'voicing-lab',
      savedAt: date().toISOString(),
      settings: { ...before.settings },
      events: [...context, ...events.map(entry => ({ ...entry }))],
    };
  }

  return {
    at,
    event,
    midi: data => event('midi', { data: [...data] }),
    toJSON,
    get size() { return events.length; },
  };
}

/**
 * replayTape(session) → { snapshots: [{ status, t, startedAt, notes, then, now }], counts, ok }
 * status: 'same', 'changed' (another chord or verdict), 'missing' (the capture no longer makes
 * it) or 'extra' (a new one). then / now: { target, verdict }, null on the side that has none.
 */
export function replayTape(session, { lateMs = LATE_MS } = {}) {
  const events = [...session.events].sort((a, b) => a.t - b.t);
  const recorded = events.filter(event => event.type === 'snapshot');
  const fires = recorded.map(event => event.t);
  const starts = recorded.map(event => event.startedAt);
  const used = new Set();
  const replayed = [];
  let state = { mode: null, symbol: null, slot: null, session: null, timeSignature: [4, 4], started: false, timed: false, clock: null, recording: false };

  // A virtual clock: the capture's timers run only when the replay moves time on.
  let clock = events[0]?.t ?? 0;
  const timers = new Map();
  let nextId = 0;
  const settings = session.settings ?? {};
  const capture = new VoicingCapture({
    debounceMs: settings.debounceMs ?? 300,
    nextNote: 'nextNote' in settings ? settings.nextNote : 28,
    setTimer: (fn, ms) => { timers.set(++nextId, { at: clock + ms, fn }); return nextId; },
    clearTimer: id => timers.delete(id),
    now: () => clock,
    onVoicing: (notes, { startedAt }) => replayed.push({ t: clock, startedAt, notes, state }),
  });

  // Runs the timers due by `t`. When the tape shows the live timer firing (a snapshot within
  // lateMs of when it was due), it fires there. When it shows none and a note arrives within
  // lateMs, the live timer had not run yet and stays pending, unless a recorded snapshot starts
  // on that very note: then the live timer had run before it, on a single held note, which
  // leaves no snapshot on the tape (a slow roll, 321 ms between the first two notes). Otherwise
  // it fires when due.
  function settle(t, opensSnapshot = false) {
    for (;;) {
      let due = null;
      for (const entry of timers) if (entry[1].at <= t && (!due || entry[1].at < due[1].at)) due = entry;
      if (!due) break;
      const [id, timer] = due;
      const k = fires.findIndex((fire, i) => !used.has(i) && fire >= timer.at - 1 && fire <= Math.min(t, timer.at + lateMs));
      if (k !== -1) {
        used.add(k);
        clock = fires[k];
      } else if (t - timer.at <= lateMs && !opensSnapshot) {
        break;
      } else {
        clock = timer.at;
      }
      timers.delete(id);
      timer.fn();
    }
    clock = t;
  }

  for (const event of events) {
    const noteOn = event.type === 'midi' && parseMidiMessage(event.data).type === 'noteOn';
    settle(event.t, noteOn && starts.some(start => Math.abs(start - event.t) <= 1));
    switch (event.type) {
      case 'midi': {
        if (state.recording) break;                       // live, the melody recorder had these
        const message = parseMidiMessage(event.data);
        if (message.type === 'noteOn') capture.noteOn(message.note, message.velocity);
        else if (message.type === 'noteOff') capture.noteOff(message.note);
        break;
      }
      case 'settings':
        if ('debounceMs' in event) capture.debounceMs = event.debounceMs;
        if ('nextNote' in event) capture.nextNote = event.nextNote;
        break;
      case 'mode':
        state = { ...state, mode: event.mode };
        break;
      case 'chord':                                       // a new chord on screen drops what was pending,
        if (event.cancels !== false) capture.cancel();    // except on the metronome's own slot changes
        state = { ...state, symbol: event.symbol ?? null, slot: event.slot ?? null };
        break;
      case 'progression':
        state = {
          ...state,
          session: event.grid ? createSession(parseGrid(event.grid, { timeSignature: event.timeSignature }), { loop: event.loop }) : null,
          timeSignature: event.timeSignature ?? [4, 4],
        };
        break;
      case 'start':
        state = { ...state, started: true, timed: Boolean(event.timed), clock: event.timed ? { tempo: event.tempo, bar1At: event.bar1At } : null };
        break;
      case 'stop':
        state = { ...state, started: false, timed: false, clock: null };
        break;
      case 'recorder':
        state = { ...state, recording: Boolean(event.on) };
        break;
      default:
    }
  }

  // Recorded and replayed snapshots, paired in time order by their notes and first note.
  const snapshots = [];
  let i = 0;
  let j = 0;
  while (i < recorded.length || j < replayed.length) {
    const then = recorded[i];
    const now = replayed[j];
    if (then && now && sameNotes(then.notes, now.notes) && Math.abs(then.startedAt - now.startedAt) <= 1) {
      snapshots.push(judge(now, then));
      i++;
      j++;
    } else if (then && (!now || then.t <= now.t)) {
      snapshots.push({ status: 'missing', t: then.t, startedAt: then.startedAt, notes: then.notes, then: sideOf(then), now: null });
      i++;
    } else {
      snapshots.push(judge(now, null));
      j++;
    }
  }
  const counts = { same: 0, changed: 0, missing: 0, extra: 0 };
  for (const snapshot of snapshots) counts[snapshot.status]++;
  return { snapshots, counts, ok: counts.changed + counts.missing + counts.extra === 0 };
}

// The replayed snapshot's chord and verdict, now. In a timed progression the recorded position
// wins over the computed one: the page's clock drifts against the metronome's over minutes.
function judge(replayed, then) {
  const { state } = replayed;
  const position = state.timed ? then?.position ?? positionOf(state, replayed.startedAt) : null;
  const target = snapshotTarget({ mode: state.mode, symbol: state.symbol, session: state.session, started: state.started, timed: state.timed, position, current: state.slot ?? 0 });
  const verdict = target ? verdictOf(analyzeVoicing(replayed.notes, parseChord(target.symbol))) : null;
  const now = { target, verdict, ...(position ? { position } : {}) };
  const base = { t: replayed.t, startedAt: replayed.startedAt, notes: replayed.notes, now };
  if (!then) return { status: 'extra', ...base, then: null };
  const before = sideOf(then);
  const same = JSON.stringify(before.target) === JSON.stringify(target) && JSON.stringify(before.verdict) === JSON.stringify(verdict);
  return { status: same ? 'same' : 'changed', ...base, then: before };
}

const sideOf = event => ({ target: event.target ?? null, verdict: event.verdict ?? null });

const positionOf = (state, startedAt) => positionAt((startedAt - state.clock.bar1At) / 1000, {
  tempo: state.clock.tempo, timeSignature: state.timeSignature, startTime: 0, countInBars: 0,
});

const sameNotes = (a, b) => a.length === b.length && a.every((note, k) => note === b[k]);

/** A session as JSON text with one event per line, so a change to a saved session reads as a small diff. */
export function formatSession(session) {
  const { events, ...header } = session;
  const head = Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return `{\n${head.join('\n')}\n  "events": [\n${events.map(event => `    ${JSON.stringify(event)}`).join(',\n')}\n  ]\n}\n`;
}

/** The session with its recorded snapshots replaced by the replay's: accepting a change on purpose. */
export function updateTape(session, result) {
  const others = session.events.filter(event => event.type !== 'snapshot');
  const snapshots = result.snapshots.filter(snapshot => snapshot.now).map(({ t, startedAt, notes, now }) => ({
    t, type: 'snapshot', startedAt, notes, target: now.target, ...(now.position ? { position: now.position } : {}), verdict: now.verdict,
  }));
  return { ...session, events: [...others, ...snapshots].sort((a, b) => a.t - b.t) };
}

/** One line of totals, then a line for every snapshot that is not the same. */
export function formatReport(name, result) {
  const { counts } = result;
  const lines = [`${name}  ${result.snapshots.length} snapshots: ${counts.same} same, ${counts.changed} changed, ${counts.missing} missing, ${counts.extra} extra`];
  for (const snapshot of result.snapshots.filter(s => s.status !== 'same')) {
    const then = snapshot.then ? describe(snapshot.then) : 'no snapshot';
    const now = snapshot.now ? describe(snapshot.now) : 'no snapshot';
    lines.push(`  ${clockOf(snapshot.t)}  [${snapshot.notes.map(note => midiToName(note)).join(' ')}]  then ${then}  now ${now}`);
  }
  return lines.join('\n');
}

function describe({ target, verdict }) {
  if (!target) return 'no chord';
  const where = target.slot === null ? target.symbol : `${target.symbol}, slot ${target.slot + 1}`;
  if (!verdict) return `(${where})`;
  const issues = [
    ...(verdict.missing.length ? [`missing ${verdict.missing.map(pcName).join(' ')}`] : []),
    ...(verdict.wrong.length ? [`wrong ${verdict.wrong.map(pcName).join(' ')}`] : []),
    ...(verdict.avoid.length ? [`avoid ${verdict.avoid.map(pcName).join(' ')}`] : []),
    ...verdict.muddy.map(([lower, upper]) => `muddy ${midiToName(lower)}-${midiToName(upper)}`),
    ...(verdict.doublings.length ? [`doubled ${verdict.doublings.map(pcName).join(' ')}`] : []),
  ];
  return `${verdict.type ?? 'no type'}${verdict.bass ? ` over the ${verdict.bass}` : ''}${issues.length ? `, ${issues.join(', ')}` : ''} (${where})`;
}

const pcName = pc => midiToName(60 + pc).replace(/-?\d+$/, '');

function clockOf(ms) {
  const seconds = ms / 1000;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${(seconds - minutes * 60).toFixed(1).padStart(4, '0')}`;
}
