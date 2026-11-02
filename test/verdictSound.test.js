// The sound of a chord played right is made of the chord itself: its root and fifth, an octave or
// so above where the hands play, so it rings with the chord instead of against it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chimeNotes, starNote, bestNotes } from '../src/audio/verdict.js';

test('the chime is the root then the fifth above it, from octave 5', () => {
  assert.deepEqual(chimeNotes(0), [72, 79]);    // C5, G5
  assert.deepEqual(chimeNotes(10), [82, 89]);   // Bb5, F6
  assert.deepEqual(chimeNotes(11), [83, 90]);   // B5, F#6
});

test('a pitch class outside 0–11 is folded back in', () => {
  assert.deepEqual(chimeNotes(14), chimeNotes(2));
  assert.deepEqual(chimeNotes(-1), chimeNotes(11));
});

// The end of a level (review of 2026-10-30, #18, S1 chosen by Edi on 2026-11-02): one knock per
// star, climbing a C major triad from octave 5, then a bell an octave above for a new record.
test('the stars climb C, E, G from octave 5, and a new record rings C6 with its fifth', () => {
  assert.deepEqual([0, 1, 2].map(starNote), [72, 76, 79]);
  assert.deepEqual(bestNotes(), [84, 91]);
});

test('a star past the third keeps the top note rather than going silent', () => {
  assert.equal(starNote(5), 79);
  assert.equal(starNote(-1), 72);
});
