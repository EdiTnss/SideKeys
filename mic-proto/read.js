// Two ways to turn the model's raw output into the thing SideKeys needs: the set
// of MIDI notes sounding in a held chord, octave included.
import { outputToNotesPoly, noteFramesToTime } from '@spotify/basic-pitch';

export const FPS = 86;         // Math.floor(22050 / 256), the model's frame rate
export const MIDI_OFFSET = 21; // frame column 0 is A0

export async function runModel(basicPitch, samples) {
  const frames = [];
  const onsets = [];
  const contours = [];
  await basicPitch.evaluateModel(
    samples,
    (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
    () => {},
  );
  return { frames, onsets, contours };
}

// Reader A -- the sustain reader, written for our case: one chord, held, and we
// want what is sounding, not where notes start. Average each pitch's activation
// over the steady part of the chord and keep what stays above the threshold.
export function sustainSet(frames, { fromSec, toSec, threshold = 0.5 }) {
  const first = Math.max(0, Math.round(fromSec * FPS));
  const last = Math.min(frames.length, Math.round(toSec * FPS));
  if (last <= first) return { notes: [], scores: new Map() };
  const sums = new Array(88).fill(0);
  for (let i = first; i < last; i++) {
    const row = frames[i];
    for (let p = 0; p < 88; p++) sums[p] += row[p];
  }
  const scores = new Map();
  const notes = [];
  for (let p = 0; p < 88; p++) {
    const mean = sums[p] / (last - first);
    scores.set(p + MIDI_OFFSET, mean);
    if (mean >= threshold) notes.push(p + MIDI_OFFSET);
  }
  return { notes, scores };
}

// Reader B -- the library's own note tracker, then keep the notes that are
// sounding in the middle of our window. This is the route Spotify documents.
export function noteEventSet(frames, onsets, {
  fromSec, toSec,
  onsetThresh = 0.5, frameThresh = 0.3, minNoteLen = 5,
  inferOnsets = true, melodiaTrick = true, energyTolerance = 11,
}) {
  const events = noteFramesToTime(
    outputToNotesPoly(frames, onsets, onsetThresh, frameThresh, minNoteLen,
      inferOnsets, null, null, melodiaTrick, energyTolerance),
  );
  const mid = (fromSec + toSec) / 2;
  const notes = events
    .filter(e => e.startTimeSeconds <= mid && e.startTimeSeconds + e.durationSeconds >= mid)
    .map(e => e.pitchMidi);
  return { notes: [...new Set(notes)].sort((a, b) => a - b), events };
}

// Reader C -- the gap reader. Written after looking at the activation profiles:
// the notes that were played take the top ranks and then the list falls off a
// cliff, but the level of the cliff moves from chord to chord (0.47 in one, 0.22
// in another), so no fixed threshold can sit in the right place. This looks for
// the cliff instead of guessing its height.
export function gapSet(frames, {
  fromSec, toSec,
  floor = 0.12,     // below this the model is not claiming anything
  minNotes = 2,     // a voicing, not a single note
  maxNotes = 10,
  minCliff = 1.25,  // if nothing falls off, keep everything above the floor
}) {
  const { scores } = sustainSet(frames, { fromSec, toSec, threshold: 1.1 });
  const ranked = [...scores.entries()]
    .filter(([, score]) => score >= floor)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length <= minNotes) {
    return { notes: ranked.map(([note]) => note).sort((a, b) => a - b), cliff: null };
  }

  let cutAt = ranked.length;
  let biggest = 0;
  const last = Math.min(maxNotes, ranked.length - 1);
  for (let i = minNotes - 1; i < last; i++) {
    const ratio = ranked[i][1] / ranked[i + 1][1];
    if (ratio > biggest) {
      biggest = ratio;
      cutAt = i + 1;
    }
  }
  if (biggest < minCliff) cutAt = ranked.length;
  return {
    notes: ranked.slice(0, cutAt).map(([note]) => note).sort((a, b) => a - b),
    cliff: biggest,
  };
}

// Reader D -- the first cliff rather than the biggest one. The biggest drop is
// often inside the ghost pile below the chord, not at the chord's edge.
export function cliffSet(frames, { fromSec, toSec, floor = 0.12, minNotes = 2, minRatio = 1.35 }) {
  const { scores } = sustainSet(frames, { fromSec, toSec, threshold: 1.1 });
  const ranked = [...scores.entries()]
    .filter(([, score]) => score >= floor)
    .sort((a, b) => b[1] - a[1]);
  let cutAt = ranked.length;
  for (let i = minNotes - 1; i < ranked.length - 1; i++) {
    if (ranked[i][1] / ranked[i + 1][1] >= minRatio) { cutAt = i + 1; break; }
  }
  return { notes: ranked.slice(0, cutAt).map(([note]) => note).sort((a, b) => a - b) };
}

// Not a reader: the ceiling. Given what the model reported, is there ANY
// threshold that returns exactly the notes that were played? If not, no
// threshold-shaped rule can ever read this voicing right, and the gap is in the
// model, not in our rule. This is the number that decides whether tuning is
// worth more work.
export function oracleThreshold(frames, { fromSec, toSec }, truth) {
  const { scores } = sustainSet(frames, { fromSec, toSec, threshold: 1.1 });
  const wanted = [...truth].sort((a, b) => a - b).join(',');
  const levels = [...new Set([...scores.values()])].sort((a, b) => b - a);
  for (const level of levels) {
    const notes = [...scores.entries()]
      .filter(([, score]) => score >= level)
      .map(([note]) => note)
      .sort((a, b) => a - b);
    if (notes.join(',') === wanted) return { possible: true, threshold: level, notes };
  }
  return { possible: false, threshold: null, notes: [] };
}
