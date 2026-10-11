// The two per-chord predicates behind the stars (docs/spec-game.md). The run-level formula —
// percentages, timed, movement — comes with the levels; these are what one voicing earns.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { isRight, isClean } from '../src/theory/stars.js';

const on = (symbol, notes) => analyzeVoicing(notes, parseChord(symbol));

test('isRight: the chord that was asked for, nothing missing and nothing foreign', () => {
  assert.equal(isRight(on('Dm7', [62, 65, 69, 72])), true);          // D F A C, all of it
  assert.equal(isRight(on('Dm7', [65, 69, 72, 76])), true);          // rootless A: the root is not required
  assert.equal(isRight(on('Dm7b5', [62, 65, 72])), false);           // the b5 is required and absent
  assert.equal(isRight(on('Cmaj7', [60, 64, 67, 71, 73])), false);   // Db belongs to no Cmaj7
});

test('isRight: an avoid note or a muddy register still counts as right', () => {
  // The 11 on a major 7th is an avoid note, but the chord itself is there and nothing is foreign.
  const avoid = on('Cmaj7', [60, 64, 67, 71, 77]);
  assert.equal(avoid.avoid.length > 0, true, 'the analyzer still reports the avoid note');
  assert.equal(isRight(avoid), true);
  assert.equal(isClean(avoid), false, 'but it is not clean');

  // A third low down is muddy; the notes are right all the same.
  const muddy = on('Cmaj7', [36, 40, 55, 59]);
  assert.equal(muddy.muddy.length > 0, true, 'the analyzer still reports the muddy interval');
  assert.equal(isRight(muddy), true);
  assert.equal(isClean(muddy), false);
});

test('isClean: no warning at all, and a doubling is not a warning', () => {
  assert.equal(isClean(on('Dm7', [65, 69, 72, 76])), true);
  // F A C F: the 3rd doubled two octaves apart, with no root in the bass to excuse it. The
  // analyzer files a doubling as info, not as a reproach, so the voicing stays clean.
  const doubled = on('Dm7', [65, 69, 72, 77]);
  assert.equal(doubled.doublings.length > 0, true, 'the analyzer still reports the doubling');
  assert.equal(isClean(doubled), true);
  // And a root doubled under the voicing is not even reported: the analyzer exempts a root or a
  // 5th in the bass, which is what two hands play all day.
  assert.deepEqual(on('Dm7', [50, 62, 65, 69, 72]).doublings, []);
});

test('isClean implies isRight, so a star never skips the one below it', () => {
  for (const [symbol, notes] of [['Dm7', [65, 69, 72, 76]], ['G7alt', [65, 68, 70, 74]], ['Cmaj7', [60, 64, 67, 71]]]) {
    const analysis = on(symbol, notes);
    if (isClean(analysis)) assert.equal(isRight(analysis), true, `${symbol} is clean but not right`);
  }
});
