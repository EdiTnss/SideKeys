// What counts as "identified correctly". The gate is the strict one: the same set
// of MIDI notes, octave included. The rest is there to explain a failure.
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { parseChord } from '../src/theory/chords.js';
import { verdictOf } from '../src/ui/tape.js';

export function compareNotes(truth, heard) {
  const truthSet = new Set(truth);
  const heardSet = new Set(heard);
  const missing = truth.filter(n => !heardSet.has(n));
  const extra = heard.filter(n => !truthSet.has(n));
  const hit = truth.filter(n => heardSet.has(n));

  // An extra note a whole number of octaves away from a missing one is the
  // classic transcriber error, and a different problem from hearing a note that
  // was never played at all.
  const octaveErrors = [];
  const stillMissing = [...missing];
  const ghosts = [];
  for (const note of extra) {
    const at = stillMissing.findIndex(m => Math.abs(m - note) % 12 === 0 && m !== note);
    if (at >= 0) {
      octaveErrors.push([stillMissing[at], note]);
      stillMissing.splice(at, 1);
    } else {
      ghosts.push(note);
    }
  }

  return {
    exact: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    octaveErrors,
    ghosts, // heard, never played, not an octave slip
    precision: heard.length ? hit.length / heard.length : 0,
    recall: truth.length ? hit.length / truth.length : 0,
  };
}

// The metric that matters for the product: would the app have said the same
// thing? A missed inner voice can change the verdict; a doubled root may not.
export function compareVerdict(symbol, truth, heard) {
  if (!symbol) return null;
  let chord = null;
  try {
    chord = parseChord(symbol);
  } catch {
    return null;
  }
  if (!chord) return null;
  const before = verdictOf(analyzeVoicing(truth, chord));
  const after = heard.length ? verdictOf(analyzeVoicing(heard, chord)) : null;
  return {
    same: after ? JSON.stringify(before) === JSON.stringify(after) : false,
    truth: before,
    heard: after,
  };
}
