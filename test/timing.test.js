import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatDuration, barDuration, positionAt, timeOf, quantizePosition } from '../src/theory/timing.js';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);

test('durations: a beat at 120 is half a second, a 4/4 bar two seconds', () => {
  close(beatDuration(120), 0.5);
  close(beatDuration(90), 2 / 3);
  close(barDuration(120, [4, 4]), 2);
  close(barDuration(90, [3, 4]), 2);
});

test('positionAt: 4/4 at 120 with a one-bar count-in', () => {
  const opts = { tempo: 120, timeSignature: [4, 4], startTime: 0, countInBars: 1 };
  assert.deepEqual(positionAt(0, opts), { bar: 0, beat: 1 });          // count-in
  assert.deepEqual(positionAt(1.5, opts), { bar: 0, beat: 4 });
  assert.deepEqual(positionAt(2, opts), { bar: 1, beat: 1 });
  assert.deepEqual(positionAt(2.5, opts), { bar: 1, beat: 2 });
  assert.deepEqual(positionAt(3.75, opts), { bar: 1, beat: 4.5 });
  assert.deepEqual(positionAt(4, opts), { bar: 2, beat: 1 });
  assert.deepEqual(positionAt(11.25, opts), { bar: 5, beat: 3.5 });
});

test('positionAt: 3/4 at 90, start offset, two count-in bars, fractional beats', () => {
  const waltz = { tempo: 90, timeSignature: [3, 4], startTime: 10, countInBars: 1 };
  assert.deepEqual(positionAt(10, waltz), { bar: 0, beat: 1 });
  assert.deepEqual(positionAt(12, waltz), { bar: 1, beat: 1 });
  const at13 = positionAt(13, waltz);
  assert.equal(at13.bar, 1);
  close(at13.beat, 2.5);
  assert.deepEqual(positionAt(4, { tempo: 120, timeSignature: [4, 4], startTime: 0, countInBars: 2 }), { bar: 1, beat: 1 });
  assert.deepEqual(positionAt(-1, { tempo: 120, timeSignature: [4, 4], startTime: 0, countInBars: 1 }), { bar: -1, beat: 3 });
});

test('timeOf is the inverse of positionAt', () => {
  const opts = { tempo: 132, timeSignature: [4, 4], startTime: 3.2, countInBars: 1 };
  for (const [bar, beat] of [[1, 1], [1, 2.5], [2, 4], [7, 1.25], [0, 1]]) {
    const time = timeOf(bar, beat, opts);
    const back = positionAt(time, opts);
    assert.equal(back.bar, bar);
    close(back.beat, beat, `bar ${bar} beat ${beat}`);
  }
  close(timeOf(1, 1, { tempo: 120, timeSignature: [4, 4], startTime: 0, countInBars: 1 }), 2);
});

test('quantizePosition snaps to the nearest subdivision and carries into the next bar', () => {
  const eighths = { division: 2, timeSignature: [4, 4] };
  assert.deepEqual(quantizePosition({ bar: 1, beat: 1.3 }, eighths), { bar: 1, beat: 1.5 });
  assert.deepEqual(quantizePosition({ bar: 1, beat: 1.2 }, eighths), { bar: 1, beat: 1 });
  assert.deepEqual(quantizePosition({ bar: 1, beat: 4.7 }, eighths), { bar: 1, beat: 4.5 });
  assert.deepEqual(quantizePosition({ bar: 1, beat: 4.8 }, eighths), { bar: 2, beat: 1 });
  assert.deepEqual(quantizePosition({ bar: 3, beat: 3.9 }, { division: 1, timeSignature: [3, 4] }), { bar: 4, beat: 1 });
  assert.deepEqual(quantizePosition({ bar: 1, beat: 1.7 }, { division: 4, timeSignature: [4, 4] }), { bar: 1, beat: 1.75 });
  const triplet = quantizePosition({ bar: 1, beat: 1.3 }, { division: 3, timeSignature: [4, 4] });
  assert.equal(triplet.bar, 1);
  close(triplet.beat, 1 + 1 / 3);
});
