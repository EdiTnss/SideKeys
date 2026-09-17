import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoicingCapture } from '../src/midi/capture.js';

// A fake clock: timers fire only when the test advances time, so no test waits 300 real ms.
function fakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    setTimer(fn, ms) {
      const id = ++nextId;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
  };
}

function setup(options = {}) {
  const clock = fakeClock();
  const voicings = [];
  const nexts = [];
  const capture = new VoicingCapture({
    debounceMs: 300,
    nextNote: 28,
    onVoicing: notes => voicings.push(notes),
    onNext: () => nexts.push(1),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...options,
  });
  return { clock, capture, voicings, nexts };
}

test('a held chord produces one snapshot after the debounce', () => {
  const { clock, capture, voicings } = setup();
  for (const note of [60, 64, 67, 71]) capture.noteOn(note, 80);
  clock.advance(299);
  assert.deepEqual(voicings, []);
  clock.advance(1);
  assert.deepEqual(voicings, [[60, 64, 67, 71]]);
  clock.advance(5000);
  assert.equal(voicings.length, 1);
});

test('notes arriving staggered within the window give a single snapshot with all of them', () => {
  const { clock, capture, voicings } = setup();
  capture.noteOn(71, 80);
  clock.advance(100);
  capture.noteOn(64, 80);
  clock.advance(100);
  capture.noteOn(60, 80);
  clock.advance(250);
  assert.deepEqual(voicings, []);                 // the last note-on restarted the timer
  clock.advance(50);
  assert.deepEqual(voicings, [[60, 64, 71]]);     // sorted ascending
});

test('a staccato chord released before the window ends is still captured', () => {
  const { clock, capture, voicings } = setup();
  for (const note of [60, 64, 67]) capture.noteOn(note, 80);
  clock.advance(150);
  for (const note of [60, 64, 67]) capture.noteOff(note);
  clock.advance(150);
  assert.deepEqual(voicings, [[60, 64, 67]]);
});

test('a wrong note corrected quickly is not reported', () => {
  const { clock, capture, voicings } = setup();
  for (const note of [60, 64, 68]) capture.noteOn(note, 80);   // G# by mistake
  clock.advance(100);
  capture.noteOff(68);
  clock.advance(20);
  capture.noteOn(67, 80);
  clock.advance(300);
  assert.deepEqual(voicings, [[60, 64, 67]]);
});

test('a note-off does not restart the timer', () => {
  const { clock, capture, voicings } = setup();
  capture.noteOn(60, 80);
  capture.noteOn(64, 80);
  clock.advance(290);
  capture.noteOff(60);
  clock.advance(10);
  assert.equal(voicings.length, 1);               // fired at 300 ms, not at 590 ms
});

test('the next note never enters the set and fires onNext on note-on only', () => {
  const { clock, capture, voicings, nexts } = setup();
  capture.noteOn(28, 80);
  assert.deepEqual(nexts, [1]);
  capture.noteOff(28);
  assert.deepEqual(nexts, [1]);
  capture.noteOn(60, 80);
  capture.noteOn(64, 80);
  capture.noteOn(28, 80);
  clock.advance(300);
  assert.deepEqual(voicings, [[60, 64]]);
  assert.deepEqual(nexts, [1, 1]);
});

test('a single note never produces a snapshot; velocity 0 is a note-off', () => {
  const { clock, capture, voicings } = setup();
  capture.noteOn(60, 80);
  clock.advance(300);
  assert.deepEqual(voicings, []);
  capture.noteOn(60, 0);
  assert.equal(capture.held.has(60), false);
});

test('cancel() drops a pending snapshot, e.g. when the chord changes on "next"', () => {
  const { clock, capture, voicings } = setup();
  capture.noteOn(60, 80);
  capture.noteOn(64, 80);
  capture.cancel();
  clock.advance(300);
  assert.deepEqual(voicings, []);
});

test('each snapshot carries the time of its first note-on, so it can be placed on the grid', () => {
  let time = 100;
  const voicings = [];
  const { clock, capture } = setup({ now: () => time, onVoicing: (notes, info) => voicings.push({ notes, ...info }) });
  capture.noteOn(60, 80);
  time = 150;
  capture.noteOn(64, 80);
  clock.advance(300);
  assert.deepEqual(voicings, [{ notes: [60, 64], startedAt: 100 }]);
  time = 1000;
  capture.noteOn(67, 80);            // a note added to the held chord starts a new snapshot
  clock.advance(300);
  assert.deepEqual(voicings[1], { notes: [60, 64, 67], startedAt: 1000 });
  capture.cancel();
  time = 2000;
  capture.noteOn(71, 80);
  clock.advance(300);
  assert.equal(voicings[2].startedAt, 2000);
});

test('onChange reports the held notes on every change, for the on-screen keyboard', () => {
  const changes = [];
  const { capture } = setup({ onChange: notes => changes.push(notes) });
  capture.noteOn(64, 80);
  capture.noteOn(60, 80);
  capture.noteOff(64);
  assert.deepEqual(changes, [[64], [60, 64], [60]]);
});
