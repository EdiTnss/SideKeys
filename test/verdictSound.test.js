// The sound of a chord played right is made of the chord itself: its root and fifth, an octave or
// so above where the hands play, so it rings with the chord instead of against it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chimeNotes } from '../src/audio/verdict.js';

test('the chime is the root then the fifth above it, from octave 5', () => {
  assert.deepEqual(chimeNotes(0), [72, 79]);    // C5, G5
  assert.deepEqual(chimeNotes(10), [82, 89]);   // Bb5, F6
  assert.deepEqual(chimeNotes(11), [83, 90]);   // B5, F#6
});

test('a pitch class outside 0–11 is folded back in', () => {
  assert.deepEqual(chimeNotes(14), chimeNotes(2));
  assert.deepEqual(chimeNotes(-1), chimeNotes(11));
});
