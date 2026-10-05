import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteOnMessages, noteOffMessages, createOutput } from '../src/midi/output.js';

// A stand-in for MIDIAccess with one output port that records what it is sent.
function fakeMidiAccess() {
  const sent = [];
  const port = { id: 'out-1', name: 'Genos', send: bytes => sent.push([...bytes]) };
  return { outputs: new Map([[port.id, port]]), sent };
}

test('note messages carry the channel in the status byte', () => {
  assert.deepEqual(noteOnMessages([60, 64], 1, 90), [[0x90, 60, 90], [0x90, 64, 90]]);
  assert.deepEqual(noteOffMessages([60], 16), [[0x8f, 60, 0]]);
  assert.deepEqual(noteOnMessages([48], 4, 100), [[0x93, 48, 100]]);
});

test('createOutput: selects a port, plays a voicing and releases it after the duration', async () => {
  const midi = fakeMidiAccess();
  const output = createOutput(midi, { channel: 2, setTimer: (fn, ms) => { fn(); return ms; } });
  assert.equal(output.playVoicing([60, 64]), false);            // nothing selected yet
  assert.equal(output.select('out-1').name, 'Genos');
  assert.equal(output.playVoicing([60, 64], { velocity: 80, durationMs: 500 }), true);
  assert.deepEqual(midi.sent, [[0x91, 60, 80], [0x91, 64, 80], [0x81, 60, 0], [0x81, 64, 0]]);
  output.allNotesOff();
  assert.deepEqual(midi.sent.at(-1), [0xb1, 123, 0]);
  assert.equal(output.select('missing'), null);
});

// A port that records what it is sent, with the clock and the wake-up timer in the test's hands.
function timedPort() {
  const sent = [];
  const port = { id: 'out-1', name: 'Genos', send: (bytes, time) => sent.push([[...bytes], time]) };
  let clock = 0;
  let timers = [];
  const output = createOutput({ outputs: new Map([[port.id, port]]) }, {
    now: () => clock,
    setTimer: fn => { timers.push(fn); },
  });
  const tick = ms => {
    clock += ms;
    const due = timers;
    timers = [];
    for (const fn of due) fn();
  };
  return { sent, output, tick };
}

test('createOutput: an arrangement goes over a slice at a time, not all at once', () => {
  const { sent, output, tick } = timedPort();
  assert.equal(output.sendScheduled([{ time: 0, data: [0x90, 60, 90] }]), false);   // no port selected yet
  output.select('out-1');
  assert.equal(output.sendScheduled([
    { time: 0, data: [0x90, 60, 90] }, { time: 500, data: [0x80, 60, 0] },
    { time: 1000, data: [0x90, 62, 90] }, { time: 1500, data: [0x80, 62, 0] },
  ]), true);
  // Only what falls inside the lookahead window. The rest waits here, where silence() can drop it.
  assert.deepEqual(sent, [[[0x90, 60, 90], 0]]);
  tick(500);
  assert.deepEqual(sent.at(-1), [[0x80, 60, 0], 500], 'handed over with its own timestamp, not played by the timer');
  tick(500);
  assert.deepEqual(sent.at(-1), [[0x90, 62, 90], 1000]);
  tick(500);
  assert.deepEqual(sent.at(-1), [[0x80, 62, 0], 1500]);
  assert.equal(sent.length, 4);
});

test('createOutput: Stop ends an arrangement instead of letting the browser finish it', () => {
  // The bug this guards (found on the Genos, 2026-10-05): Chrome has no MIDIOutput.clear(), so
  // everything already handed over is delivered whatever the app does next. Nothing may go over
  // after silence(), and the voices left sounding have to be released by name.
  const { sent, output, tick } = timedPort();
  output.select('out-1');
  output.sendScheduled([
    { time: 0, data: [0x92, 60, 90] },        // channel 3, still sounding when Stop comes
    { time: 2000, data: [0x82, 60, 0] },      // its note-off is still waiting
    { time: 2000, data: [0x90, 64, 90] },
  ]);
  const before = sent.length;
  output.silence([1, 2, 3]);
  const after = sent.slice(before);
  assert.deepEqual(after[0], [[0x82, 60, 0], undefined], 'the voice still sounding is released by name');
  assert.deepEqual(after.slice(1, 4).map(([bytes]) => bytes), [[0xb0, 123, 0], [0xb1, 123, 0], [0xb2, 123, 0]]);
  assert.deepEqual(after.slice(4), [[[0xb0, 123, 0], 150], [[0xb1, 123, 0], 150], [[0xb2, 123, 0], 150]],
    'and again after the lookahead window, for note-ons the browser was already holding');
  const total = sent.length;
  tick(5000);
  assert.equal(sent.length, total, 'nothing else reaches the port after Stop');
});

test('createOutput: a port without clear() is silenced all the same', () => {
  const sent = [];
  const port = { id: 'old', name: 'Old port', send: bytes => sent.push([...bytes]) };
  const output = createOutput({ outputs: new Map([[port.id, port]]) }, { now: () => 0 });
  output.select('old');
  assert.doesNotThrow(() => output.silence([4]));
  assert.deepEqual(sent, [[0xb3, 123, 0], [0xb3, 123, 0]]);
});
