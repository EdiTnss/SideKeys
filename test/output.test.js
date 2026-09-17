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
