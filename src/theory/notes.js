// Note names, pitch classes and intervals. Pure functions, no DOM.
// Convention: MIDI 60 = C4 (scientific pitch notation). Genos shows the same note as C3.

// Semitones above the root for every degree label used in chord symbols.
export const DEGREE_SEMITONES = {
  '1': 0, 'b9': 1, '9': 2, '#9': 3, 'b3': 3, '3': 4, '4': 5, '11': 5,
  '#11': 6, 'b5': 6, '5': 7, '#5': 8, 'b13': 8, '6': 9, '13': 9, 'bb7': 9,
  'b7': 10, '7': 11,
};

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// A letter, then up to two sharps or two flats: 'C', 'F#', 'Bbb'.
const NOTE_NAME_RE = /^([A-G])(#{1,2}|b{1,2})?$/;
// The same, followed by an octave number that may be negative: 'Db4', 'C-1'.
const NOTE_WITH_OCTAVE_RE = /^([A-G](?:#{1,2}|b{1,2})?)(-?\d+)$/;
// A degree label: optional accidental, then the degree number: '9', 'b9', '#11', 'bb7'.
const DEGREE_RE = /^(#|b{1,2})?(\d+)$/;

/** Wraps any integer into 0–11 (JS `%` keeps the sign of a negative number). */
function mod12(n) {
  return ((n % 12) + 12) % 12;
}

/** 61 → 1 */
export function pitchClass(midi) {
  return mod12(midi);
}

/** 60 → 4 */
export function octave(midi) {
  return Math.floor(midi / 12) - 1;
}

/** Upward distance between two pitch classes, always 0–11. (7, 0) → 5 */
export function pcInterval(fromPc, toPc) {
  return mod12(toPc - fromPc);
}

/** 'Db' → { letter: 'D', accidental: -1, pc: 1 }. Throws on invalid names. */
export function parseNoteName(name) {
  const match = NOTE_NAME_RE.exec(name);
  if (!match) throw new Error(`Invalid note name "${name}"`);
  const [, letter, accidentals = ''] = match;
  const accidental = accidentals.startsWith('#') ? accidentals.length : -accidentals.length;
  return { letter, accidental, pc: mod12(LETTER_PC[letter] + accidental) };
}

/** 61 → 'Db4'; with { accidentals: 'sharp' } → 'C#4' */
export function midiToName(midi, { accidentals = 'flat' } = {}) {
  const names = accidentals === 'sharp' ? SHARP_NAMES : FLAT_NAMES;
  return names[pitchClass(midi)] + octave(midi);
}

/** 'Db4' → 61, 'B#3' → 60, 'Cb4' → 59. Throws on invalid names. */
export function nameToMidi(name) {
  const match = NOTE_WITH_OCTAVE_RE.exec(name);
  if (!match) throw new Error(`Invalid note name "${name}"`);
  const { letter, accidental } = parseNoteName(match[1]);
  const oct = Number(match[2]);
  // No mod12 here: B#3 must stay in octave 3 (60), Cb4 in octave 4 (59).
  return (oct + 1) * 12 + LETTER_PC[letter] + accidental;
}

/**
 * Spells a degree above a root with the correct letter.
 * The letter comes from the degree number (a 9th above D is some kind of E),
 * the accidental from the semitone distance. ('D', 'b9') → 'Eb', ('C', 'bb7') → 'Bbb'
 */
export function spellDegree(rootName, degree) {
  const semitones = DEGREE_SEMITONES[degree];
  const match = DEGREE_RE.exec(degree);
  if (semitones === undefined || !match) throw new Error(`Unknown degree "${degree}"`);
  const root = parseNoteName(rootName);
  const number = Number(match[2]);

  const letter = LETTERS[(LETTERS.indexOf(root.letter) + number - 1) % 7];
  const targetPc = mod12(root.pc + semitones);
  // Signed distance from the letter's natural pitch to the target, in -6..5.
  const accidental = mod12(targetPc - LETTER_PC[letter] + 6) - 6;

  return letter + (accidental > 0 ? '#'.repeat(accidental) : 'b'.repeat(-accidental));
}
