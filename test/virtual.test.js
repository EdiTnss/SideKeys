import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVirtualMidi, mergeAccess } from '../src/midi/virtual.js';
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

test('an output can be a ready-made port: the browser synth goes in as itself', () => {
  const sent = [];
  const synth = { id: 'browser-synth', name: 'Browser synth', type: 'output', send: (data, time) => sent.push([[...data], time]) };
  const midi = createVirtualMidi({ inputs: ['On-screen keyboard'], outputs: [synth, 'Log'] });
  assert.deepEqual([...midi.access.outputs.keys()], ['browser-synth', 'virtual-output-2']);
  const output = createOutput(midi.access, { channel: 1, setTimer: () => {} });
  output.select('browser-synth');
  output.playVoicing([60, 64], { velocity: 70 });
  assert.deepEqual(sent.map(([data]) => data), [[0x90, 60, 70], [0x90, 64, 70]]);
  assert.equal(midi.sent.length, 0, 'a port of its own keeps its own messages, not the tape of the virtual ones');
});

test('mergeAccess shows the virtual ports next to the real ones, and hardware that arrives later reaches the app', async () => {
  const virtual = createVirtualMidi({ inputs: ['On-screen keyboard'], outputs: ['Browser synth'] });
  const merged = mergeAccess(virtual.access);
  const seen = [];
  const notes = [];
  await connectMidi({
    access: merged.access,
    onNoteOn: note => notes.push(note),
    onNoteOff: () => {},
    onDevices: devices => seen.push([devices.inputs.map(i => i.name), devices.outputs.map(o => o.name)]),
  });
  assert.deepEqual(seen.at(-1), [['On-screen keyboard'], ['Browser synth']]);

  // The Genos is plugged in and the user allows Web MIDI: one more access, already listening.
  const genos = createVirtualMidi({ inputs: ['Genos'], outputs: ['Genos'], idPrefix: 'genos' });
  merged.add(genos.access);
  assert.deepEqual(seen.at(-1), [['On-screen keyboard', 'Genos'], ['Browser synth', 'Genos']]);
  genos.send([0x90, 55, 90]);
  virtual.send([0x90, 60, 90]);
  assert.deepEqual(notes, [55, 60], 'both keyboards play the same app');

  // A device coming or going still reaches the app through the merged access.
  genos.access.onstatechange({ port: { name: 'Genos' } });
  assert.equal(seen.length, 3);
});
