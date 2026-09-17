import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMidiMessage } from '../src/midi/input.js';

test('parseMidiMessage: note on, note off, running-status note off, other messages', () => {
  assert.deepEqual(parseMidiMessage([0x90, 60, 80]), { type: 'noteOn', channel: 1, note: 60, velocity: 80 });
  assert.deepEqual(parseMidiMessage([0x80, 60, 0]), { type: 'noteOff', channel: 1, note: 60, velocity: 0 });
  assert.deepEqual(parseMidiMessage([0x9f, 60, 0]), { type: 'noteOff', channel: 16, note: 60, velocity: 0 });
  assert.equal(parseMidiMessage([0xb0, 64, 127]).type, 'other');   // sustain pedal
  assert.equal(parseMidiMessage(new Uint8Array([0x93, 48, 1])).channel, 4);
});
