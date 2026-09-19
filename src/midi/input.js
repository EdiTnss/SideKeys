// Web MIDI wiring: device access, all inputs, all channels. Browser only,
// except parseMidiMessage, which is pure and tested in Node.

/** [status, data1, data2] → { type: 'noteOn' | 'noteOff' | 'other', channel, note, velocity } */
export function parseMidiMessage(data) {
  const [status, data1 = 0, data2 = 0] = data;
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (type === 0x90 && data2 > 0) return { type: 'noteOn', channel, note: data1, velocity: data2 };
  // A note-on with velocity 0 is a note-off (running status, common on keyboards).
  if (type === 0x80 || type === 0x90) return { type: 'noteOff', channel, note: data1, velocity: 0 };
  return { type: 'other', channel, note: null, velocity: null };
}

/**
 * Asks for MIDI access, listens to every input on every channel and keeps listening as
 * devices come and go. Resolves with the MIDIAccess object; rejects with a readable message.
 * `access` replaces the browser's (a virtual one from virtual.js); `onMessage(data, timeStamp)`
 * sees every message before it is parsed, pedals and all.
 */
export async function connectMidi({ onNoteOn, onNoteOff, onMessage: onRaw = () => {}, onDevices = () => {}, access = null }) {
  if (!access && (typeof navigator === 'undefined' || !navigator.requestMIDIAccess)) {
    throw new Error('Web MIDI is not available in this browser. Use Chrome or Edge.');
  }
  const midi = access ?? await navigator.requestMIDIAccess();

  const onMessage = event => {
    onRaw(event.data, event.timeStamp);
    const message = parseMidiMessage(event.data);
    if (message.type === 'noteOn') onNoteOn(message.note, message.velocity);
    else if (message.type === 'noteOff') onNoteOff(message.note);
  };
  const refresh = () => {
    const inputs = [...midi.inputs.values()];
    for (const input of inputs) input.onmidimessage = onMessage;
    onDevices({ inputs: inputs.map(describe), outputs: [...midi.outputs.values()].map(describe) });
  };

  refresh();
  midi.onstatechange = refresh;
  return midi;
}

const describe = port => ({ id: port.id, name: port.name, manufacturer: port.manufacturer, state: port.state });
