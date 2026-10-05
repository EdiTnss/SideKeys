// A piece (grid + melody) becomes a playable arrangement: three parts as timed note events.
// Pure, no DOM, no MIDI; midi/player.js turns the events into messages for the Genos.
//
// - Bass: the root, or the note after the slash, held for the chord and struck again at every
//   change (Edi's choice). It lives in one octave, so every note has exactly one place: E1–D#2
//   by default, where a double bass sits, with two higher octaves available as settings. (It
//   once sounded muddy on the Genos: the bass voice itself was set an octave down.) The left
//   hand always starts above the bass, never a muddy interval away from it (the analyzer's low
//   interval limits, applied to that pair).
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
import { LOW_INTERVAL_LIMITS } from './analyzer.js';

export const BASS_REGISTERS = Object.freeze({
  low: Object.freeze([28, 39]),        // E1–D#2
  middle: Object.freeze([33, 44]),     // A1–G#2
  high: Object.freeze([40, 51]),       // E2–D#3
});
export const BASS_REGISTER = BASS_REGISTERS.low;

// An arrangement only works when the melody leaves the chord layer somewhere to live. A four-note
// voicing spans about eleven semitones and has to start at C3 or above to stay clear of the bass,
// so the melody has to sing from C4 up. Below that it is lifted by whole octaves for playback —
// never past C6, which would push it out of its own register. Measured on Edi's 16-bar study,
// whose melody sang F3–E4 and dipped to C3: without the lift, 6 of 16 bars had no chord layer at
// all and every voicing that did fit sat under C3.
export const LH_FLOOR = 48;         // C3: four notes under this are mud, however legal the intervals
export const MELODY_FLOOR = 60;     // C4: under this there is no room between the bass and the melody
export const MELODY_CEILING = 84;   // C6: the lift stops rather than push the melody above this
export const PART_VELOCITY = Object.freeze({ bass: 80, lh: 64, melody: 90 });
const PART_ORDER = { bass: 0, lh: 1, melody: 2 };

/**
 * realize(piece, { register, bassRegister, melodyGap, velocity }) → {
 *   events: [{ beat, duration, part: 'bass' | 'lh' | 'melody', midi, velocity }],
 *   voicings: [{ bar, beat, symbol, notes, type, doublesMelody, reason }],
 *   totalBeats, melodyShift }
 * `melodyGap` is how many semitones the left hand's top note keeps under the melody (1 = it
 * never reaches or crosses it). `melodyShift` is how far the melody was lifted to make room for
 * the chord layer, in semitones (0 when it was already high enough, or too wide to lift): the
 * caller is expected to say so, since the arrangement then differs from the recording.
 */
export function realize(piece, { register = DEFAULT_REGISTER, bassRegister = BASS_REGISTER, melodyGap = 1, velocity = PART_VELOCITY } = {}) {
  const beatsPerBar = piece.timeSignature[0];
  const recorded = piece.bars.flatMap((bar, i) => bar.melody.map(note => ({
    midi: note.midi, start: i * beatsPerBar + (note.beat - 1), duration: note.duration,
  })));
  const melodyShift = liftFor(recorded);
  const melody = melodyShift === 0 ? recorded : recorded.map(note => ({ ...note, midi: note.midi + melodyShift }));
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
    const bass = placeBass(chord.bassPc ?? chord.rootPc, bassRegister);
    events.push({ beat: slot.start, duration, part: 'bass', midi: bass, velocity: velocity.bass });

    const over = melody.filter(note => note.start < slot.end && note.start + note.duration > slot.start);
    const top = over.length ? Math.min(register[1], Math.min(...over.map(note => note.midi)) - melodyGap) : register[1];
    const floor = Math.max(register[0], bass + 1);
    const options = top >= floor
      ? pickingOrder(suggestVoicings(chord, { register: [floor, top], previous }).filter(option => !muddyPair(bass, option.notes[0])))
      : [];
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
  return { events, voicings, totalBeats: piece.bars.length * beatsPerBar, melodyShift };
}

// How far the melody has to rise for the chord layer to have a register of its own: whole octaves,
// as few as possible, and none at all when the melody's own top would pass MELODY_CEILING. A piece
// with no melody needs no room made for it.
function liftFor(melody) {
  if (melody.length === 0) return 0;
  const low = Math.min(...melody.map(note => note.midi));
  const high = Math.max(...melody.map(note => note.midi));
  let shift = 0;
  while (low + shift < MELODY_FLOOR && high + shift + 12 <= MELODY_CEILING) shift += 12;
  return shift;
}

// The drill's suggestions keep the texture of the previous voicing first, which in an
// arrangement means one forced shell turns every later chord into a shell too. Here the fuller
// voicing comes first, then the one that moves least, then the drill's own order — but only
// while it stays at LH_FLOOR or above. A window that forces the chord layer lower thins out
// instead of crowding four notes down into the bass: fewest notes first, then the highest bottom.
// (Heard on the Genos: a quartal at Gb2 B2 E3 A3 breaks no low interval limit and is still mud,
// where the shell B2 E3 is what a pianist plays.)
function pickingOrder(options) {
  const deep = option => (option.notes[0] < LH_FLOOR ? 1 : 0);
  const movement = option => option.comparison?.movement ?? 0;
  const fuller = (a, b) => b.notes.length - a.notes.length || movement(a) - movement(b);
  const thinner = (a, b) => a.notes.length - b.notes.length || b.notes[0] - a.notes[0];
  return options
    .map((option, order) => ({ option, order }))
    .sort((a, b) => deep(a.option) - deep(b.option)
      || (deep(a.option) ? thinner(a.option, b.option) : fuller(a.option, b.option))
      || a.order - b.order)
    .map(entry => entry.option);
}

// The voicing that doubles the fewest of the melody's pitch classes; among equals, the first,
// since the options already come fullest first, then in voice-leading order. A required note the melody also
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

// The analyzer's low interval limits, applied to the bass and the left hand's lowest note: the
// same rule that keeps a voicing clear keeps the gap between the hands clear.
function muddyPair(low, high) {
  return LOW_INTERVAL_LIMITS.some(limit => low < limit.below && limit.semitones.includes(high - low));
}

// The note of this pitch class at or above the bottom of the register. With a one-octave
// register there is exactly one; with a wider one, the lowest.
function placeBass(pc, [low]) {
  return low + ((pc - (low % 12)) + 12) % 12;
}
