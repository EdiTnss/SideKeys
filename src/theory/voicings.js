// Voicing suggestions: templates realized in a register, checked by the analyzer, ordered by
// voice leading from the previous voicing. Pure, no DOM. Seed for realize.js (Phase 3b).

import { analyzeVoicing } from './analyzer.js';
import { compareVoicings } from './voiceLeading.js';

// E2–A4. The plan said E2–C4, but the standard rootless forms on Cmaj7 sit at E3 G3 B3 D4 and
// B3 D4 E4 G4, and an octave lower they break the low interval limits.
export const DEFAULT_REGISTER = [40, 69];

const TYPE_PRIORITY = ['rootless-A', 'rootless-B', 'drop-2', 'quartal', 'shell'];

/** → [{ notes, type, comparison }], best first. Every candidate is warning-free for the chord. */
export function suggestVoicings(chord, { register = DEFAULT_REGISTER, previous = null } = {}) {
  const shapes = [...rootlessShapes(chord), ...shellShapes(chord), ...dropTwoShapes(chord), ...quartalShapes(chord)];
  const seen = new Set();
  const candidates = [];
  for (const pcs of shapes) {
    for (const notes of placements(pcs, register)) {
      const key = notes.join();
      if (seen.has(key)) continue;
      seen.add(key);
      const analysis = analyzeVoicing(notes, chord);
      if (analysis.messages.some(m => m.level === 'warning')) continue;
      candidates.push({ notes, type: analysis.voicing.type, comparison: previous ? compareVoicings(previous, notes) : null });
    }
  }
  const rank = candidate => {
    const at = TYPE_PRIORITY.indexOf(candidate.type);
    return at === -1 ? TYPE_PRIORITY.length : at;
  };
  // With a previous voicing: keep its texture (same number of notes) first, then move as little
  // as possible; a two-note shell would otherwise always "win" against a four-note voicing.
  const sizeGap = candidate => Math.abs(candidate.notes.length - previous.length);
  candidates.sort((a, b) =>
    (previous ? sizeGap(a) - sizeGap(b) || a.comparison.movement - b.comparison.movement : 0) || rank(a) - rank(b));
  return candidates;
}

// The slots of the rootless forms, resolved for this chord: on a dominant the "5" slot prefers
// the 13 (or b13), and the 9 slot takes whichever of 9, b9, #9 the symbol allows.
function slots(chord) {
  const pcOf = labels => {
    for (const label of labels) {
      const pc = chord.degrees.indexOf(label);
      if (pc !== -1) return pc;
    }
    return null;
  };
  const [third = null, seventh = null] = chord.guideTones;
  const fifth = pcOf(chord.quality === '7' ? ['13', 'b13', '5'] : ['5', 'b5']);
  const ninth = pcOf(['9', 'b9', '#9']);
  return { third, seventh, fifth, ninth };
}

function rootlessShapes(chord) {
  const { third, seventh, fifth, ninth } = slots(chord);
  if ([third, seventh, fifth, ninth].includes(null)) return [];
  return [[third, fifth, seventh, ninth], [seventh, ninth, third, fifth]];
}

function shellShapes(chord) {
  const { third, seventh } = slots(chord);
  if (third === null || seventh === null) return [];
  return [[third, seventh], [seventh, third]];
}

// Drop 2 of the close 1-3-5-7 in every inversion: the second voice from the top goes down an
// octave, so bottom-to-top the order becomes [t2, t0, t1, t3].
function dropTwoShapes(chord) {
  if (chord.chordTones.length < 4) return [];
  const tones = chord.chordTones.slice(0, 4);
  return tones.map((_, i) => {
    const close = [0, 1, 2, 3].map(k => tones[(i + k) % 4]);
    return [close[2], close[0], close[1], close[3]];
  });
}

// Four stacked perfect fourths starting on any chord tone or available tension, kept only when
// every note is a chord tone or an available tension.
function quartalShapes(chord) {
  const allowed = new Set([...chord.chordTones, ...chord.tensions.available]);
  const shapes = [];
  for (const start of allowed) {
    const stack = [0, 5, 10, 15].map(interval => (start + interval) % 12);
    if (stack.every(pc => allowed.has(pc))) shapes.push(stack);
  }
  return shapes;
}

// A shape is a list of pitch classes from the bottom up; each note sits within the octave above
// the previous one. Returns every octave placement that fits the register.
function placements(pcs, [low, high]) {
  const shape = [pcs[0]];
  for (const pc of pcs.slice(1)) {
    let note = shape[shape.length - 1] + 1;
    while (note % 12 !== pc) note += 1;
    shape.push(note);
  }
  const span = shape[shape.length - 1] - shape[0];
  const results = [];
  for (let bottom = low + ((pcs[0] - (low % 12) + 12) % 12); bottom + span <= high; bottom += 12) {
    results.push(shape.map(note => note - shape[0] + bottom));
  }
  return results;
}
