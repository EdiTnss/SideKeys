import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiToFrequency, synthCommand } from '../src/audio/synth.js';

test('equal temperament from A4 = 440', () => {
  assert.equal(midiToFrequency(69), 440);
  assert.equal(midiToFrequency(81), 880);
  assert.equal(midiToFrequency(57), 220);
  assert.ok(Math.abs(midiToFrequency(60) - 261.6256) < 0.001);
});

test('the synth reads the same messages the app sends the Genos', () => {
  assert.deepEqual(synthCommand([0x90, 60, 80]), { kind: 'on', channel: 1, note: 60, velocity: 80 });
  assert.deepEqual(synthCommand([0x92, 36, 100]), { kind: 'on', channel: 3, note: 36, velocity: 100 });
  assert.deepEqual(synthCommand([0x80, 60, 0]), { kind: 'off', channel: 1, note: 60 });
  // A note-on with velocity 0 is a note-off, as on any keyboard.
  assert.deepEqual(synthCommand([0x90, 60, 0]), { kind: 'off', channel: 1, note: 60 });
  assert.deepEqual(synthCommand([0xb1, 123, 0]), { kind: 'allOff', channel: 2 });
  assert.deepEqual(synthCommand([0xb0, 120, 0]), { kind: 'allOff', channel: 1 });
});

test('what the synth has no voice for is ignored, not guessed', () => {
  assert.equal(synthCommand([0xb0, 64, 127]), null);       // sustain pedal
  assert.equal(synthCommand([0xc0, 1]), null);             // program change
  assert.equal(synthCommand([0xe0, 0, 64]), null);         // pitch bend
  assert.equal(synthCommand([0xf8]), null);                // clock
});
