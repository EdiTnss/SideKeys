// One pass (or looped passes) through a progression: slots, where a played chord lands,
// what was played, and the voice-leading score. No DOM.

import { parseChord } from '../theory/chords.js';
import { analyzeVoicing } from '../theory/analyzer.js';
import { compareVoicings, scoreProgression } from '../theory/voiceLeading.js';

const EPSILON = 1e-6;

export function createSession(progression, { loop = true } = {}) {
  const slots = progression.bars.flatMap((bar, i) =>
    bar.chords.map(chord => ({ bar: i + 1, beat: chord.beat, symbol: chord.symbol, chord: parseChord(chord.symbol) })));
  const barCount = progression.bars.length;
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
