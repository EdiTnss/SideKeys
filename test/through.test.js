import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrough, soundOn, setSound } from '../src/midi/through.js';

const KEYSTEP = { id: 'in-2', name: 'Arturia KeyStep' };
const GENOS = { id: 'in-3', name: 'Digital Workstation' };

const harness = (settings = {}) => {
  const sent = [];
  const voice = { send: data => sent.push([...data]) };
  const through = createThrough({ voice: () => voice, enabled: port => soundOn(settings, port.name) });
  return { through, sent, voice };
};

test('a keyboard nobody has decided about is played through the app, at the velocity it was struck', () => {
  const { through, sent } = harness();
  through.noteOn(60, 37, KEYSTEP);
  through.noteOff(60, KEYSTEP);
  assert.deepEqual(sent, [[0x90, 60, 37], [0x80, 60, 0]]);
});

test('a keyboard switched off is not played through, and the choice is kept per keyboard', () => {
  const settings = setSound({}, GENOS.name, false);
  assert.equal(soundOn(settings, GENOS.name), false);
  assert.equal(soundOn(settings, KEYSTEP.name), true);
  const { through, sent } = harness(settings);
  through.noteOn(60, 80, GENOS);
  through.noteOff(60, GENOS);
  assert.deepEqual(sent, []);
});

test('a note is let go by the voice that started it, even after the piano took over', () => {
  const sent = [];
  let voice = { send: data => sent.push(['synth', ...data]) };
  const through = createThrough({ voice: () => voice, enabled: () => true });
  through.noteOn(60, 80, KEYSTEP);
  voice = { send: data => sent.push(['piano', ...data]) };
  through.noteOff(60, KEYSTEP);
  assert.deepEqual(sent, [['synth', 0x90, 60, 80], ['synth', 0x80, 60, 0]]);
});

test('switching the sound off lets go of what is still ringing from that keyboard, and nothing else', () => {
  const settings = {};
  const sent = [];
  const voice = { send: data => sent.push([...data]) };
  const through = createThrough({ voice: () => voice, enabled: port => soundOn(settings, port.name) });
  through.noteOn(60, 80, KEYSTEP);
  through.noteOn(64, 80, GENOS);
  sent.length = 0;
  Object.assign(settings, setSound(settings, KEYSTEP.name, false));
  through.silence(KEYSTEP.name);
  assert.deepEqual(sent, [[0x80, 60, 0]]);
  through.noteOff(60, KEYSTEP);
  assert.deepEqual(sent, [[0x80, 60, 0]], 'the key coming up later sends nothing twice');
});

test('setSound returns a new settings object and leaves the old one alone', () => {
  const before = { A: true };
  const after = setSound(before, 'B', false);
  assert.deepEqual(before, { A: true });
  assert.deepEqual(after, { A: true, B: false });
});
