import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionAt } from '../src/theory/timing.js';
import { createRecorder } from '../src/midi/recorder.js';

// 120 bpm, 4/4, one count-in bar: bar 1 starts at 2000 ms, a beat is 500 ms.
const clock = { tempo: 120, timeSignature: [4, 4], startTime: 0, countInBars: 1 };
const positionOf = ms => positionAt(ms / 1000, clock);
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('a note is recorded at its position with its length in beats', () => {
  const recorder = createRecorder({ positionOf });
  recorder.start();
  recorder.noteOn(60, 90, 2000);
  recorder.noteOff(60, 2450);
  const [note] = recorder.stop(3000);
  assert.equal(note.midi, 60);
  assert.equal(note.velocity, 90);
  assert.equal(note.bar, 1);
  assert.equal(note.beat, 1);
  assert.ok(close(note.durationBeats, 0.9));
});

test('a note held across a bar line, and a note still held when recording stops', () => {
  const recorder = createRecorder({ positionOf });
  recorder.start();
  recorder.noteOn(64, 80, 3500);          // bar 1, beat 4
  recorder.noteOff(64, 4500);             // bar 2, beat 2
  recorder.noteOn(65, 80, 4500);
  const notes = recorder.stop(5000);      // 65 is cut at the stop
  assert.ok(close(notes[0].durationBeats, 2));
  assert.equal(notes[1].bar, 2);
  assert.equal(notes[1].beat, 2);
  assert.ok(close(notes[1].durationBeats, 1));
  assert.equal(recorder.recording, false);
});

test('events outside a recording are ignored; start() clears; a re-pressed key closes the first note', () => {
  const recorder = createRecorder({ positionOf });
  recorder.noteOn(60, 80, 2000);
  assert.deepEqual(recorder.stop(2500), []);
  recorder.start();
  recorder.noteOn(60, 80, 2000);
  recorder.noteOn(60, 80, 2250);          // same key again before the release
  recorder.noteOff(60, 2500);
  const notes = recorder.stop(3000);
  assert.equal(notes.length, 2);
  assert.ok(close(notes[0].durationBeats, 0.5));
  assert.ok(close(notes[1].durationBeats, 0.5));
  recorder.start();
  assert.equal(recorder.count, 0);
});

test('3/4: bar lengths follow the time signature', () => {
  const waltz = { ...clock, timeSignature: [3, 4] };
  const recorder = createRecorder({ positionOf: ms => positionAt(ms / 1000, waltz), timeSignature: [3, 4] });
  recorder.start();
  recorder.noteOn(67, 80, 2500);          // bar 1, beat 2
  recorder.noteOff(67, 4000);             // bar 2, beat 2 (a 3/4 bar is 1500 ms)
  assert.ok(close(recorder.stop(4000)[0].durationBeats, 3));
});
