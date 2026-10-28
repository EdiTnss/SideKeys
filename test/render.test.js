// The pure helpers in ui/render.js: what the drawn keyboard shows beyond the notes that were
// played. No DOM is touched here, so these run in Node like any other module.

import test from 'node:test';
import assert from 'node:assert/strict';
import { missingClasses, noteLabel } from '../src/ui/render.js';
import { parseChord } from '../src/theory/chords.js';

test('missingClasses: a missing note is drawn in the register of the voicing that was played', () => {
  // Dm7b5 played as D F C, with no b5. The Ab belongs inside the voicing, not two octaves below
  // it: a hole is only legible where the chord actually sounded.
  assert.deepEqual(missingClasses({ notes: [62, 65, 72], missing: [8] }), { 68: 'missing' });
});

test('missingClasses: two equally near instances pick the lower one', () => {
  // Middle of the voicing is 66, so C4 (60) and C5 (72) are both six semitones away.
  assert.deepEqual(missingClasses({ notes: [63, 69], missing: [0] }), { 60: 'missing' });
});

test('missingClasses: every missing note gets its own key', () => {
  assert.deepEqual(missingClasses({ notes: [60, 64], missing: [7, 10] }), { 58: 'missing', 67: 'missing' });
});

test('missingClasses: nothing missing, nothing played, or no analysis at all lights no key', () => {
  assert.deepEqual(missingClasses({ notes: [60, 64, 67], missing: [] }), {});
  assert.deepEqual(missingClasses({ notes: [], missing: [7] }), {});
  assert.deepEqual(missingClasses(null), {});
});

test('noteLabel: the bench names notes plainly, and the octave matches the key that was struck', () => {
  // Db7's b7 is Cb on paper; MIDI 59 is the B below middle C, so "Cb3" named a note an octave
  // lower than the one played. The degree in brackets keeps the theory.
  assert.equal(noteLabel({ midi: 59, degree: 'b7' }, parseChord('Db7')), 'B3 (b7)');
  assert.equal(noteLabel({ midi: 64, degree: 'b3' }, parseChord('Dbm7')), 'E4 (b3)');
  assert.equal(noteLabel({ midi: 63, degree: 'b3' }, parseChord('Cm7')), 'Eb4 (b3)');
  assert.equal(noteLabel({ midi: 61 }, parseChord('C7')), 'Db4 (?)');
});
