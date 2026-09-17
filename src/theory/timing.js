// Musical time ↔ clock time. Pure, no DOM, no audio. Used by the metronome (Phase 2),
// the melody recorder (Phase 2) and the arrangement player (Phase 3b).
//
// Positions: bar is 1-based after the count-in (the count-in bars are 0, -1, …), beat is
// 1-based and fractional (2.5 = the "and" of 2). Times are seconds on the AudioContext clock.

const EPSILON = 1e-9;

export function beatDuration(tempo) {
  return 60 / tempo;
}

export function barDuration(tempo, timeSignature) {
  return timeSignature[0] * beatDuration(tempo);
}

/** Clock time → { bar, beat }. `startTime` is when the count-in starts. */
export function positionAt(time, { tempo, timeSignature = [4, 4], startTime = 0, countInBars = 1 }) {
  const beatsPerBar = timeSignature[0];
  const beats = (time - startTime) / beatDuration(tempo);
  // The epsilon only protects the floor at bar boundaries (3.9999999 beats is bar 2, beat 1).
  const barIndex = Math.floor((beats + EPSILON) / beatsPerBar);
  const beat = 1 + (beats - barIndex * beatsPerBar);
  return { bar: barIndex - countInBars + 1, beat: tidy(beat) };
}

/** { bar, beat } → clock time; the inverse of positionAt. */
export function timeOf(bar, beat, { tempo, timeSignature = [4, 4], startTime = 0, countInBars = 1 }) {
  const beatsPerBar = timeSignature[0];
  const beats = (bar - 1 + countInBars) * beatsPerBar + (beat - 1);
  return startTime + beats * beatDuration(tempo);
}

/** Snaps the beat to the nearest 1/division (2 = eighths, 3 = triplets, 4 = sixteenths); rounding past the bar end carries over. */
export function quantizePosition({ bar, beat }, { division = 2, timeSignature = [4, 4] }) {
  const beatsPerBar = timeSignature[0];
  const snapped = Math.round((beat - 1) * division) / division;
  if (snapped >= beatsPerBar - EPSILON) return { bar: bar + 1, beat: 1 };
  return { bar, beat: 1 + snapped };
}

// Rounds away floating-point noise (3.4999999998 → 3.5) without touching real fractions.
function tidy(value) {
  return Math.round(value * 1e9) / 1e9;
}
