// Note names, pitch classes and intervals. Pure functions, no DOM.
// Convention: MIDI 60 = C4 (scientific pitch notation). Genos shows the same note as C3.

// Semitones above the root for every degree label used in chord symbols.
export const DEGREE_SEMITONES = {
  '1': 0, 'b9': 1, '9': 2, '#9': 3, 'b3': 3, '3': 4, '4': 5, '11': 5,
  '#11': 6, 'b5': 6, '5': 7, '#5': 8, 'b13': 8, '6': 9, '13': 9, 'bb7': 9,
  'b7': 10, '7': 11,
};

function notImplemented() {
  throw new Error('not implemented');
}

/** 61 → 1 */
export function pitchClass(midi) { notImplemented(); }

/** 60 → 4 */
export function octave(midi) { notImplemented(); }

/** Upward distance between two pitch classes, always 0–11. (7, 0) → 5 */
export function pcInterval(fromPc, toPc) { notImplemented(); }

/** 'Db' → { letter: 'D', accidental: -1, pc: 1 }. Throws on invalid names. */
export function parseNoteName(name) { notImplemented(); }

/** 61 → 'Db4'; with { accidentals: 'sharp' } → 'C#4' */
export function midiToName(midi, { accidentals = 'flat' } = {}) { notImplemented(); }

/** 'Db4' → 61, 'B#3' → 60, 'Cb4' → 59. Throws on invalid names. */
export function nameToMidi(name) { notImplemented(); }

/** Spells a degree above a root with the correct letter. ('D', 'b9') → 'Eb', ('C', 'bb7') → 'Bbb' */
export function spellDegree(rootName, degree) { notImplemented(); }
