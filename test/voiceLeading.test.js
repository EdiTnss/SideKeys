import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { compareVoicings, scoreProgression } from '../src/theory/voiceLeading.js';

const v = names => names.split(' ').map(nameToMidi);

test('Dm7 → G7 rootless A: one voice moves a half step, three stay', () => {
  const c = compareVoicings(v('F3 A3 C4 E4'), v('F3 A3 B3 E4'));
  assert.equal(c.movement, 1);
  assert.equal(c.commonTones, 3);
  assert.equal(c.rating, 'smooth');
  assert.deepEqual(c.pairs.filter(p => p.semitones !== 0), [{ from: 60, to: 59, semitones: -1 }]);
  assert.deepEqual(c.unmatched, { previous: [], next: [] });
});

test('identical voicings do not move at all', () => {
  const c = compareVoicings(v('C4 E4 G4 B4'), v('B4 G4 E4 C4'));   // order does not matter
  assert.equal(c.movement, 0);
  assert.equal(c.commonTones, 4);
  assert.equal(c.averageMove, 0);
  assert.equal(c.rating, 'smooth');
});

test('an octave jump is jumpy', () => {
  const c = compareVoicings(v('C4 E4 G4'), v('C5 E5 G5'));
  assert.equal(c.movement, 36);
  assert.equal(c.averageMove, 12);
  assert.equal(c.commonTones, 0);
  assert.equal(c.rating, 'jumpy');
});

test('the matching minimizes total movement: sorted order, no voice crossing', () => {
  // Note-order pairing (C4→Eb4, E4→F4) costs 4; a crossed pairing (C4→F4, E4→Eb4) costs 6.
  const c = compareVoicings(v('C4 E4'), v('Eb4 F4'));
  assert.equal(c.movement, 4);
  assert.deepEqual(c.pairs, [{ from: 60, to: 63, semitones: 3 }, { from: 64, to: 65, semitones: 1 }]);
});

test('different sizes: the cheapest subset is matched, the rest is reported', () => {
  // C E G against B D F A: the best three are B, F, A (1 + 1 + 2), leaving D out.
  const c = compareVoicings(v('C4 E4 G4'), v('B3 D4 F4 A4'));
  assert.equal(c.movement, 4);
  assert.equal(c.pairs.length, 3);
  assert.deepEqual(c.unmatched, { previous: [], next: [62] });

  const back = compareVoicings(v('B3 D4 F4 A4'), v('C4 E4 G4'));
  assert.equal(back.movement, 4);
  assert.deepEqual(back.unmatched, { previous: [62], next: [] });

  assert.equal(compareVoicings([], v('C4')).rating, null);
});

test('rating thresholds: smooth up to 1.5 semitones per voice, ok up to 3, jumpy above', () => {
  assert.equal(compareVoicings(v('C4 E4 G4'), v('Db4 F4 A4')).rating, 'smooth');   // 4 / 3
  assert.equal(compareVoicings(v('C4 E4 G4'), v('D4 G4 Bb4')).rating, 'ok');       // 8 / 3
  assert.equal(compareVoicings(v('C4 E4 G4'), v('F4 A4 C5')).rating, 'jumpy');     // 15 / 3
});

test('scoreProgression sums the steps and tolerates a jump between two spread voicings', () => {
  const steps = [
    { comparison: compareVoicings(v('F3 A3 C4 E4'), v('F3 A3 B3 E4')), fromType: 'rootless-A', toType: 'rootless-A' },
    { comparison: compareVoicings(v('F3 A3 B3 E4'), v('E3 G3 B3 D4')), fromType: 'rootless-A', toType: 'rootless-A' },
    { comparison: compareVoicings(v('C3 E4 B4 D5'), v('C4 E5 B5 D6')), fromType: 'spread', toType: 'spread' },
  ];
  const score = scoreProgression(steps);
  assert.equal(score.movement, 1 + 5 + 48);
  assert.equal(score.commonTones, 3 + 1 + 0);
  assert.deepEqual(score.jumpy, []);                 // the register change is deliberate
  assert.equal(score.rating, 'smooth');              // rated on the first two steps only: 6 / 8

  const strict = scoreProgression(steps, { tolerateRegisterShift: false });
  assert.deepEqual(strict.jumpy, [2]);
  assert.equal(strict.rating, 'jumpy');
  assert.equal(scoreProgression([]).rating, null);
});
