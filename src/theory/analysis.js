// Harmonic analysis of a piece: key, roman numerals, functions, cadences, target notes.
// Pure, deterministic; the output is what candidates.js and the prompts (Phase 3a) consume.
//
// Roman numerals: the letter distance from the tonic gives the degree, the pitch-class
// distance from the diatonic degree gives the accidental (Db in C is bII, C# is #I). Minor
// keys use the natural minor as reference, except the leading tone, which stays VII (vii°).
// Lowercase for minor-third qualities, ø7 and ° for the two diminished ones, the rest of
// the symbol (7, maj7, 7alt, 6) is kept as a suffix.

import { parseChord, classifyPc } from './chords.js';
import { parseNoteName } from './notes.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const FUNCTION_BY_DEGREE = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];
const BORROWED = new Set(['bII', 'bIII', 'bVI', 'bVII']);
const MINOR_QUALITIES = new Set(['m7', 'm6', 'mMaj7', 'm', 'm7b5', 'dim7']);
const EPSILON = 1e-6;

const isDominant = chord => chord.quality === '7' || chord.quality === '7sus4';

export function analyzePiece(piece, { phraseLength = 4 } = {}) {
  const slots = piece.bars.flatMap((bar, barIndex) =>
    bar.chords.map((chord, slotIndex) => ({
      barIndex, slotIndex, symbol: chord.symbol, beat: chord.beat, chord: parseChord(chord.symbol),
      endBeat: bar.chords[slotIndex + 1]?.beat ?? Infinity,
    })));
  const key = detectKey(piece.key, slots);
  const analyses = slots.map((slot, i) => analyzeSlot(slot, slots[i + 1] ?? null, key, piece.bars[slot.barIndex].melody));

  const bars = piece.bars.map((bar, barIndex) => ({
    ...bar,
    chords: bar.chords.map((chord, slotIndex) => ({
      ...chord,
      analysis: analyses[slots.findIndex(s => s.barIndex === barIndex && s.slotIndex === slotIndex)],
    })),
    melody: bar.melody.map(note => ({ ...note })),
  }));

  const phrases = [];
  for (let start = 1; start <= piece.bars.length; start += phraseLength) {
    phrases.push([start, Math.min(start + phraseLength - 1, piece.bars.length)]);
  }
  return { ...piece, bars, analysis: { key, phrases } };
}

// The declared key, with the mode read from the chords on the tonic; otherwise a guess from
// the last chord (or the first, when the last one is a dominant).
function detectKey(declared, slots) {
  if (declared) {
    const tonicPc = parseNoteName(declared).pc;
    const onTonic = slots.filter(slot => slot.chord.rootPc === tonicPc);
    const minor = onTonic.filter(slot => MINOR_QUALITIES.has(slot.chord.quality)).length * 2 > onTonic.length;
    return { tonic: declared, mode: minor ? 'minor' : 'major', guessed: false };
  }
  const last = slots[slots.length - 1].chord;
  const chord = isDominant(last) ? slots[0].chord : last;
  return { tonic: chord.root, mode: MINOR_QUALITIES.has(chord.quality) ? 'minor' : 'major', guessed: true };
}

function romanBase(rootName, key) {
  const tonic = parseNoteName(key.tonic);
  const root = parseNoteName(rootName);
  const degree = (LETTERS.indexOf(root.letter) - LETTERS.indexOf(tonic.letter) + 7) % 7;
  const scale = key.mode === 'minor' ? MINOR : MAJOR;
  let diff = (root.pc - (tonic.pc + scale[degree]) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  if (key.mode === 'minor' && degree === 6 && diff === 1) diff = 0;      // the leading tone: vii°, not #vii
  const accidental = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return { numeral: accidental + NUMERALS[degree], degree, chromatic: diff !== 0 };
}

function numeralFor(base, chord) {
  return MINOR_QUALITIES.has(chord.quality) ? base.numeral.replace(/[IV]+/, m => m.toLowerCase()) : base.numeral;
}

function suffixFor(symbol, chord) {
  if (chord.quality === 'm7b5') return 'ø7';
  if (chord.quality === 'dim7') return '°';
  const suffix = symbol.slice(chord.root.length);
  return /^m(?!aj)/i.test(suffix) && !/^maj/i.test(suffix) ? suffix.slice(1) : suffix;
}

function analyzeSlot(slot, next, key, barMelody) {
  const { chord, symbol } = slot;
  const tonicPc = parseNoteName(key.tonic).pc;
  const base = romanBase(chord.root, key);
  const isTonic = chord.rootPc === tonicPc;
  const suffix = suffixFor(symbol, chord);
  let roman = numeralFor(base, chord) + suffix;
  let cadence = false;

  if (isDominant(chord) && next && !isTonic) {
    const fifthDown = (chord.rootPc + 5) % 12 === next.chord.rootPc;
    const halfStepDown = (chord.rootPc + 11) % 12 === next.chord.rootPc;
    const backdoor = base.numeral === 'bVII' && next.chord.rootPc === tonicPc;
    cadence = fifthDown || halfStepDown || backdoor;
    if (fifthDown) {
      const target = romanBase(next.chord.root, key);
      if (!target.chromatic && target.degree !== 0) roman = `V${suffix}/${numeralFor(target, next.chord)}`;
    }
  }

  let harmonicFunction;
  if (chord.quality === 'dim7' && base.chromatic) harmonicFunction = 'passing';
  else if (isDominant(chord) && cadence) harmonicFunction = 'D';
  else if (!base.chromatic) harmonicFunction = FUNCTION_BY_DEGREE[base.degree];
  else if (BORROWED.has(base.numeral)) harmonicFunction = 'S';
  else harmonicFunction = '?';

  const inSlot = note => note.beat >= slot.beat - EPSILON && note.beat < slot.endBeat - EPSILON;
  const relationOf = note => {
    const { role } = classifyPc(chord, note.midi % 12);
    if (role === 'chordTone') return 'chordTone';
    if (role === 'tension' || role === 'altered') return 'tension';
    if (role === 'avoid') return 'avoid';
    return 'outside';
  };
  const melody = {
    structural: barMelody.filter(n => n.structural && inSlot(n)).map(n => ({ midi: n.midi, beat: n.beat, duration: n.duration, relation: relationOf(n) })),
    passing: barMelody.filter(n => !n.structural && inSlot(n)).map(n => ({ midi: n.midi, beat: n.beat, duration: n.duration })),
  };

  return { roman, function: harmonicFunction, cadence, guideTones: [...chord.guideTones], melody };
}
