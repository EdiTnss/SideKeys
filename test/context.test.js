import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockStamp, toContextTime, toPerformanceTime } from '../src/audio/context.js';

const STAMP = { contextTime: 10, performanceTime: 5000 };

test('performance.now() milliseconds and context seconds convert both ways around the same instant', () => {
  assert.equal(toContextTime(5000, STAMP), 10);
  assert.equal(toContextTime(5500, STAMP), 10.5);
  assert.equal(toContextTime(4750, STAMP), 9.75);
  assert.equal(toPerformanceTime(10, STAMP), 5000);
  assert.equal(toPerformanceTime(12.25, STAMP), 7250);
  // Round trip: what the metronome schedules is what the synth hears, to the microsecond.
  assert.ok(Math.abs(toPerformanceTime(toContextTime(8123, STAMP), STAMP) - 8123) < 1e-6);
});

test('the clock stamp comes from the output timestamp, as heard', () => {
  const context = { currentTime: 11, getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 5000 }) };
  assert.deepEqual(clockStamp(context), STAMP);
});

test('a context that has only just started reports zeros; the current time stands in', () => {
  const now = performance.now();
  const zero = { currentTime: 0.3, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) };
  const old = { currentTime: 0.3 };                        // no getOutputTimestamp at all
  for (const context of [zero, old]) {
    const stamp = clockStamp(context);
    assert.equal(stamp.contextTime, 0.3);
    assert.ok(stamp.performanceTime >= now, 'the performance side is read now');
  }
});
