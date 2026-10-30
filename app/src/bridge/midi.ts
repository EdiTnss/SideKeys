// The second door into the engine, beside theory.ts: everything that makes notes arrive.
//
// Same rule — imported from ../../../src untouched, one way only. The capture's debounce and
// staccato rules, the virtual ports that put the on-screen keyboard beside a real Genos, and
// the synth shaped as a MIDI output are all written, tested and replayed by the harness. The
// shell adds no second opinion about any of it; it only decides when to call them.

export { connectMidi, parseMidiMessage } from '../../../src/midi/input.js';
export { VoicingCapture } from '../../../src/midi/capture.js';
export { createVirtualMidi, mergeAccess } from '../../../src/midi/virtual.js';
export { createSynth } from '../../../src/audio/synth.js';
export { loadPiano } from '../../../src/audio/piano.js';
export { createVerdictSound } from '../../../src/audio/verdict.js';
export { createOnScreen } from '../../../src/ui/onscreen.js';
export { createThrough, soundOn, setSound } from '../../../src/midi/through.js';
export { storageKey } from '../../../src/storage.js';
