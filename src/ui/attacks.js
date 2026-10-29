// A session tape split into attacks, for the comping report (docs/spec-comping.md). Pure, no DOM.
//
// The capture's 300 ms debounce is made for "play a chord and hold it": two swung eighths at
// 160 bpm are 188 ms apart and would melt into one snapshot. Comping needs every hit, so the
// report groups note-ons of its own and leaves the capture, the harness and the replay alone.
// It lives in ui/ beside the tape because it reads MIDI events; the report itself is in theory/.

import { parseMidiMessage } from '../midi/input.js';
import { positionAt } from '../theory/timing.js';

// A real block chord spreads over 10–40 ms; note-ons this close to the first are one attack.
export const GROUP_MS = 50;

/**
 * Note events → attacks: every key held when a group of note-ons closes. A group with one new
 * note over a held chord is a move (it counts for voice leading, not for rhythm); one note with
 * nothing held is dropped. The pedal adds nothing: the report judges hands, not resonance.
 *
 * @param {{ t: number, on: boolean, note: number }[]} events  in time order, t in milliseconds
 * @param {{ groupMs?: number }} [options]
 * @returns {{ t: number, notes: number[], move: boolean }[]}
 */
export function groupAttacks(events, { groupMs = GROUP_MS } = {}) {
  const held = new Set();
  const attacks = [];
  let group = null;

  // Any event past the window closes the group first, so a staccato chord released before the
  // next note still keeps its notes.
  function close() {
    if (!group) return;
    const notes = [...held].sort((a, b) => a - b);
    if (group.added >= 2 && notes.length >= 2) attacks.push({ t: group.t, notes, move: false });
    else if (group.added === 1 && notes.length >= 2) attacks.push({ t: group.t, notes, move: true });
    group = null;
  }

  for (const event of events) {
    if (group && event.t > group.t + groupMs) close();
    if (event.on) {
      if (!group) group = { t: event.t, added: 0 };
      if (!held.has(event.note)) group.added++;
      held.add(event.note);
    } else {
      held.delete(event.note);
    }
  }
  close();
  return attacks;
}

/**
 * The last timed run on a tape: its form (grid, metre, tempo, swing) and its attacks, each placed
 * in bars and beats by the metronome's clock. Notes the melody recorder took are left out. A run
 * that does not say otherwise swings (Edi, 2026-10-29). Null when the tape has no timed run.
 *
 * @param {{ events: { t: number, type: string, [key: string]: any }[] }} session
 * @param {{ groupMs?: number }} [options]
 * @returns {{ form: { grid: string, timeSignature: number[], tempo: number, swing: boolean },
 *             attacks: { t: number, notes: number[], move: boolean, bar: number, beat: number }[] } | null}
 */
export function attacksFromTape(session, { groupMs = GROUP_MS } = {}) {
  const events = [...session.events].sort((a, b) => a.t - b.t);
  let run = null;
  let progression = null;
  let recording = false;
  for (const [index, event] of events.entries()) {
    if (event.type === 'progression') progression = event.grid ? event : null;
    if (event.type === 'start' && event.timed && progression) run = { start: event, progression, from: index, to: events.length };
    if (event.type === 'stop' && run && run.to === events.length && index > run.from) run.to = index;
  }
  if (!run) return null;

  const notes = [];
  for (const event of events.slice(run.from + 1, run.to)) {
    if (event.type === 'recorder') recording = Boolean(event.on);
    if (event.type !== 'midi' || recording) continue;
    const message = parseMidiMessage(event.data);
    if (message.type === 'noteOn') notes.push({ t: event.t, on: true, note: message.note });
    else if (message.type === 'noteOff') notes.push({ t: event.t, on: false, note: message.note });
  }

  const { tempo, bar1At } = run.start;
  const timeSignature = run.progression.timeSignature ?? [4, 4];
  const attacks = groupAttacks(notes, { groupMs }).map(attack => ({
    ...attack,
    ...positionAt((attack.t - bar1At) / 1000, { tempo, timeSignature, startTime: 0, countInBars: 0 }),
  }));
  return {
    form: { grid: run.progression.grid, timeSignature, tempo, swing: run.start.swing ?? true },
    attacks,
  };
}
