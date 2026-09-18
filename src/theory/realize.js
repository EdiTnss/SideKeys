// A piece (grid + melody) becomes a playable arrangement: three parts as timed note events.
// Pure, no DOM, no MIDI; midi/player.js turns the events into messages for the Genos.
//
// - Bass: the root, or the note after the slash, held for the chord and struck again at every
//   change (Edi's choice). It lives in E1–D#2: one octave, so every note has exactly one place
//   and the bass always sits under the left hand.
// - Left hand: the voicing from voicings.js closest to the one before (same texture first,
//   then the least movement), held for the chord. Its top note stays under the lowest melody
//   note sounding over the chord, and it doubles as few of the melody's pitch classes as a
//   voicing allows (Edi's choice), saying so when it cannot avoid them all. When nothing fits
//   under the melody, the left hand rests on that chord and says why.
// - Melody: as recorded.
//
// Time is in beats from the first downbeat (0-based), so the result does not depend on tempo.

import { parseChord } from './chords.js';
import { suggestVoicings, DEFAULT_REGISTER } from './voicings.js';

export const BASS_REGISTER = [28, 39];
export const PART_VELOCITY = Object.freeze({ bass: 80, lh: 64, melody: 90 });
const PART_ORDER = { bass: 0, lh: 1, melody: 2 };

/**
 * realize(piece, { register, bassRegister, melodyGap, velocity }) → {
 *   events: [{ beat, duration, part: 'bass' | 'lh' | 'melody', midi, velocity }],
 *   voicings: [{ bar, beat, symbol, notes, type, doublesMelody, reason }],
 *   totalBeats }
 * `melodyGap` is how many semitones the left hand's top note keeps under the melody (1 = it
 * never reaches or crosses it).
 */
export function realize(piece, { register = DEFAULT_REGISTER, bassRegister = BASS_REGISTER, melodyGap = 1, velocity = PART_VELOCITY } = {}) {
  const beatsPerBar = piece.timeSignature[0];
  const melody = piece.bars.flatMap((bar, i) => bar.melody.map(note => ({
    midi: note.midi, start: i * beatsPerBar + (note.beat - 1), duration: note.duration,
  })));
  const slots = piece.bars.flatMap((bar, i) => bar.chords.map((chord, j) => {
    const next = bar.chords[j + 1];
    return {
      bar: i + 1,
      beat: chord.beat,
      symbol: chord.symbol,
      start: i * beatsPerBar + (chord.beat - 1),
      end: next ? i * beatsPerBar + (next.beat - 1) : (i + 1) * beatsPerBar,
    };
  }));

  const events = [];
  const voicings = [];
  let previous = null;
  for (const slot of slots) {
    const chord = parseChord(slot.symbol);
    const duration = slot.end - slot.start;
    events.push({ beat: slot.start, duration, part: 'bass', midi: placeBass(chord.bassPc ?? chord.rootPc, bassRegister), velocity: velocity.bass });

    const over = melody.filter(note => note.start < slot.end && note.start + note.duration > slot.start);
    const top = over.length ? Math.min(register[1], Math.min(...over.map(note => note.midi)) - melodyGap) : register[1];
    const options = top >= register[0] ? suggestVoicings(chord, { register: [register[0], top], previous }) : [];
    const { picked, doubled } = leastDoubling(options, new Set(over.map(note => note.midi % 12)));
    const entry = { bar: slot.bar, beat: slot.beat, symbol: slot.symbol };

    if (!picked) {
      voicings.push({ ...entry, notes: null, type: null, doublesMelody: false,
        reason: over.length ? 'no voicing fits under the melody' : 'no voicing fits the register' });
      continue;
    }
    voicings.push({ ...entry, notes: picked.notes, type: picked.type, doublesMelody: doubled > 0, reason: null });
    for (const midi of picked.notes) events.push({ beat: slot.start, duration, part: 'lh', midi, velocity: velocity.lh });
    previous = picked.notes;
  }

  for (const note of melody) {
    events.push({ beat: note.start, duration: note.duration, part: 'melody', midi: note.midi, velocity: velocity.melody });
  }
  events.sort((a, b) => a.beat - b.beat || PART_ORDER[a.part] - PART_ORDER[b.part] || a.midi - b.midi);
  return { events, voicings, totalBeats: piece.bars.length * beatsPerBar };
}

// The voicing that doubles the fewest of the melody's pitch classes; among equals, the first,
// since the options already come in voice-leading order. A required note the melody also
// plays (the 7th of G7 under a melody F) cannot be avoided, but the rest still can.
function leastDoubling(options, melodyPcs) {
  let picked = null;
  let doubled = Infinity;
  for (const option of options) {
    const count = new Set(option.notes.map(midi => midi % 12).filter(pc => melodyPcs.has(pc))).size;
    if (count < doubled) {
      picked = option;
      doubled = count;
      if (doubled === 0) break;
    }
  }
  return { picked, doubled: picked ? doubled : 0 };
}

// The note of this pitch class at or above the bottom of the register. With a one-octave
// register there is exactly one; with a wider one, the lowest.
function placeBass(pc, [low]) {
  return low + ((pc - (low % 12)) + 12) % 12;
}
