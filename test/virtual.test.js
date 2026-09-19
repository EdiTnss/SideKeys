import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVirtualMidi } from '../src/midi/virtual.js';
import { connectMidi } from '../src/midi/input.js';
import { createOutput } from '../src/midi/output.js';

test('a virtual MIDI access has the shape of the real one: ports in maps, with ids, names and state', () => {
  const midi = createVirtualMidi({ inputs: ['Keys'], outputs: ['Synth', 'Log'] });
  assert.deepEqual([...midi.access.inputs.values()].map(port => [port.id, port.name, port.type, port.state]), [['virtual-input-1', 'Keys', 'input', 'connected']]);
  assert.deepEqual([...midi.access.outputs.values()].map(port => [port.id, port.name]), [['virtual-output-1', 'Synth'], ['virtual-output-2', 'Log']]);
  assert.equal(midi.access.sysexEnabled, false);
});

test('connectMidi takes the access it is given: devices are listed and messages reach the handlers', async () => {
  let now = 1000;
  const midi = createVirtualMidi({ inputs: ['Keys'], now: () => now });
  const events = [];
  let devices = null;
  const access = await connectMidi({
    access: midi.access,
    onNoteOn: (note, velocity) => events.push(['on', note, velocity]),
    onNoteOff: note => events.push(['off', note]),
    onMessage: (data, timeStamp) => events.push(['raw', [...data], timeStamp]),
    onDevices: listed => { devices = listed; },
  });
  assert.equal(access, midi.access);
  assert.deepEqual(devices.inputs.map(input => input.name), ['Keys']);
  assert.deepEqual(devices.outputs.map(output => output.name), ['Virtual output']);

  midi.send([0x90, 60, 80]);
  now = 1200;
  midi.send([0xb0, 64, 127]);                 // sustain: raw only
  midi.send([0x90, 60, 0], { timeStamp: 1250 });
  assert.deepEqual(events, [
    ['raw', [0x90, 60, 80], 1000], ['on', 60, 80],
    ['raw', [0xb0, 64, 127], 1200],
    ['raw', [0x90, 60, 0], 1250], ['off', 60],
  ]);
});

test('what the app sends to a virtual output is kept, with its time; clear() drops what was still queued', () => {
  let now = 0;
  const midi = createVirtualMidi({ now: () => now });
  const output = createOutput(midi.access, { channel: 2, setTimer: () => {} });
  output.select('virtual-output-1');
  output.playVoicing([60, 64], { velocity: 90 });
  output.sendScheduled([{ time: 500, data: [0x90, 67, 70] }, { time: 900, data: [0x80, 67, 0] }]);
  assert.deepEqual(midi.sent.map(message => [message.data, message.time]), [
    [[0x91, 60, 90], 0], [[0x91, 64, 90], 0], [[0x90, 67, 70], 500], [[0x80, 67, 0], 900],
  ]);
  now = 600;
  output.silence([1, 2]);                     // the note-off at 900 never leaves
  assert.deepEqual(midi.sent.map(message => message.data), [
    [0x91, 60, 90], [0x91, 64, 90], [0x90, 67, 70], [0xb0, 123, 0], [0xb1, 123, 0],
  ]);
  assert.ok(midi.sent.every(message => message.port === 'virtual-output-1'));
  midi.clearSent();
  assert.equal(midi.sent.length, 0);
});

test('without an access and without Web MIDI, connectMidi still says why', async () => {
  await assert.rejects(() => connectMidi({ onNoteOn() {}, onNoteOff() {} }), /Web MIDI is not available/);
});
