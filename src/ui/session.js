// One pass (or looped passes) through a progression: slots, where a played chord lands,
// what was played, and the voice-leading score. No DOM.

import { parseChord } from '../theory/chords.js';
import { analyzeVoicing } from '../theory/analyzer.js';
import { compareVoicings, scoreProgression } from '../theory/voiceLeading.js';

const EPSILON = 1e-6;
// In a timed pass, a voicing started from the "and" of the beat before a chord change (an eighth
// note ahead) is an anticipation of the next chord, not a late one of this chord (Edi's rule).
export const ANTICIPATION_BEATS = 0.5;

export function createSession(progression, { loop = true } = {}) {
  const slots = progression.bars.flatMap((bar, i) =>
    bar.chords.map(chord => ({ bar: i + 1, beat: chord.beat, symbol: chord.symbol, chord: parseChord(chord.symbol) })));
  const barCount = progression.bars.length;
  const beatsPerBar = progression.timeSignature?.[0] ?? 4;
  let current = 0;
  let finished = false;
  let results = new Map();     // slot index → latest { notes, analysis }
  let history = [];            // [{ index, notes, analysis, comparison }] in playing order

  /** (bar, beat) → { index, chorus } of the chord active there, or null before bar 1 / after the end. */
  function locate(bar, beat) {
    if (bar < 1) return null;
    if (bar > barCount && !loop) return null;
    const chorus = Math.floor((bar - 1) / barCount) + 1;
    const barInChorus = ((bar - 1) % barCount) + 1;
    let index = -1;
    slots.forEach((slot, i) => {
      if (slot.bar === barInChorus && slot.beat <= beat + EPSILON) index = i;
    });
    return index === -1 ? null : { index, chorus };
  }

  /** Free mode: moves the cursor to the next slot; wraps when looping, otherwise finishes (null). */
  function advance() {
    if (current + 1 < slots.length) {
      current += 1;
      return current;
    }
    if (loop) {
      current = 0;
      return current;
    }
    finished = true;
    return null;
  }

  /** Analyses `notes` against the slot's chord and compares them with the previously played chord. */
  function record(index, notes) {
    const analysis = analyzeVoicing(notes, slots[index].chord);
    const previous = history[history.length - 1] ?? null;
    const comparison = previous ? compareVoicings(previous.notes, notes) : null;
    const entry = { index, notes, analysis, comparison };
    history.push(entry);
    results.set(index, { notes, analysis });
    return entry;
  }

  function summary() {
    const steps = history.slice(1).map((entry, i) => ({
      from: history[i].index,
      to: entry.index,
      comparison: entry.comparison,
      fromType: history[i].analysis.voicing.type,
      toType: entry.analysis.voicing.type,
    }));
    return { steps, score: scoreProgression(steps), played: results.size, total: slots.length };
  }

  function newChorus() {
    results = new Map();
    history = [];
  }

  function reset() {
    newChorus();
    current = 0;
    finished = false;
  }

  return {
    slots,
    barCount,
    beatsPerBar,
    loop,
    locate,
    advance,
    record,
    summary,
    newChorus,
    reset,
    get current() { return current; },
    set current(value) { current = value; },
    get finished() { return finished; },
    get results() { return results; },
    get history() { return history; },
  };
}

/**
 * Which chord a captured voicing answers: in the drill, the chord on screen; in a progression,
 * once the pass has started, the slot where the voicing started on the metronome's grid (timed,
 * the next slot from ANTICIPATION_BEATS before it) or the slot under the cursor (free); nowhere
 * else. → { symbol, slot } or null.
 * The app and the harness's replay (midi/tape.js) share this rule, so they cannot drift apart.
 */
export function snapshotTarget({ mode, symbol = null, session = null, started = false, timed = false, position = null, current = 0 }) {
  if (mode === 'drill') return symbol ? { symbol, slot: null } : null;
  if (mode !== 'progression' || !session || !started) return null;
  const slot = timed ? timedSlot(session, position) : current;
  return slot === null ? null : { symbol: session.slots[slot].symbol, slot };
}

// Where the voicing started, looked at an eighth note later — but only across a bar line. Inside
// the last eighth of a bar, the chord of the next bar is the one answered; anywhere else in the
// bar the voicing answers the chord it falls on, even when a change is half a beat away. Past the
// end of a pass without a loop nothing follows, so the last chord keeps it, and the count-in
// answers nothing: there is no chord before the first one.
// (Edi, 2026-09-19: "from the «and» of 4". The window is half a beat of musical time, so it
// follows the last beat of the bar — the "and" of 3 in 3/4 — and it scales with the tempo. Edi
// turned down two generalisations on 2026-10-11: changes inside the bar, and the count-in.)
function timedSlot(session, { bar, beat }) {
  const here = session.locate(bar, beat);
  if (!here) return null;
  const ahead = beat + ANTICIPATION_BEATS;
  if (ahead < session.beatsPerBar + 1 - EPSILON) return here.index;
  return (session.locate(bar + 1, ahead - session.beatsPerBar) ?? here).index;
}

/**
 * Whether a voicing was judged against a chord the screen had not reached yet: it started inside
 * the anticipation window, so its slot is not the one its position falls in. Derived for the
 * feedback panel rather than recorded on the tape — a new field inside a recorded target would
 * make every saved session report a change on replay, for a label that is pure presentation.
 */
export function isAnticipated(session, position, slot) {
  if (!session || !position || slot === null) return false;
  return (session.locate(position.bar, position.beat)?.index ?? null) !== slot;
}
