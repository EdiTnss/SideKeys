// The MIDI session, wrapped in runes so the screens can read it.
//
// Nothing here reimplements the engine. The on-screen keyboard is a virtual MIDI *input* and the
// browser synth a virtual *output*, sitting beside the real ports rather than replacing them, so
// there is no "demo mode" branch anywhere: a click and a Genos arrive by the same road. What
// this file owns is when those parts are built and what the screens are allowed to see.

import {
  connectMidi, VoicingCapture, createVirtualMidi, mergeAccess, createSynth, createOnScreen,
} from '../bridge/midi';

export type Status = { text: string; level: 'ok' | 'warn' | '' };
export type Instrument = ReturnType<typeof createInstrument>;

type Device = { id: string; name: string };
type OnScreenState = { armed: number[]; sounding: number[]; octave: number };

const IDLE: Status = { text: 'Click the keys to arm them, Enter to play. Or type: A S D F G H J.', level: '' };

export function createInstrument({
  onVoicing,
  onNext = () => {},
  debounceMs = 300,
  nextNote = 28,
}: {
  onVoicing: (notes: number[]) => void;
  onNext?: () => void;
  debounceMs?: number;
  nextNote?: number | null;
}) {
  const synth = createSynth();
  const virtual = createVirtualMidi({ inputs: ['On-screen keyboard'], outputs: [synth, 'Virtual output'] });
  const ports = mergeAccess(virtual.access);

  let held = $state<number[]>([]);
  let armed = $state<number[]>([]);
  let octave = $state(60);
  let hardware = $state<string[]>([]);
  let status = $state<Status>(IDLE);
  // While the letters are a piano they are not shortcuts. With an instrument plugged in they go
  // back to being shortcuts, because nobody types a voicing when a Genos is under their hands.
  let typeToPlay = $state(true);
  let asked = false;

  const onscreen = createOnScreen({
    send: (data: number[]) => virtual.send(data),
    // The drawn keyboard has no strings, so it sounds through the synth directly rather than
    // through whichever output is selected. One call, so ear and analyser never hear two chords.
    echo: (data: number[]) => synth.send(data),
    onChange: (state: OnScreenState) => {
      armed = state.armed;
      octave = state.octave;
    },
  });

  const capture = new VoicingCapture({
    debounceMs,
    nextNote,
    onVoicing: (notes: number[]) => onVoicing(notes),
    onNext,
    onChange: (notes: number[]) => { held = notes; },
  });

  function showDevices({ inputs }: { inputs: Device[] }) {
    hardware = inputs.filter(input => !virtual.access.inputs.has(input.id)).map(input => input.name);
    if (hardware.length) onscreen.releaseKeys();
    typeToPlay = hardware.length === 0;
    status = hardware.length
      ? { text: `MIDI in: ${hardware.join(', ')}`, level: 'ok' }
      : asked
        ? { text: 'No MIDI input found. Check the cable, or play the keys below.', level: 'warn' }
        : IDLE;
  }

  // One listener over the merged access: the virtual ports now, the hardware the moment it is
  // added, with no second code path for either.
  connectMidi({
    access: ports.access,
    onNoteOn: (midi: number, velocity: number) => capture.noteOn(midi, velocity),
    onNoteOff: (midi: number) => capture.noteOff(midi),
    onDevices: showDevices,
  }).catch((error: Error) => {
    status = { text: error.message, level: 'warn' };
  });

  /** Asks the browser for the real instrument and drops it into the same access. */
  async function connect() {
    asked = true;
    try {
      ports.add(await navigator.requestMIDIAccess());
    } catch (error) {
      status = { text: `Web MIDI was refused: ${(error as Error).message}`, level: 'warn' };
    }
  }

  return {
    get held() { return held; },
    get armed() { return armed; },
    get octave() { return octave; },
    get hardware() { return hardware; },
    get status() { return status; },
    get typeToPlay() { return typeToPlay; },
    connect,
    toggle: (midi: number) => onscreen.toggle(midi),
    play: () => onscreen.play(),
    clear: () => onscreen.clear(),
    keyDown: (code: string) => onscreen.keyDown(code) as boolean,
    keyUp: (code: string) => onscreen.keyUp(code),
    octaveUp: () => onscreen.octaveUp(),
    octaveDown: () => onscreen.octaveDown(),
    /** The chord on screen changed, so a snapshot still waiting for the old one is dropped. */
    cancelCapture: () => capture.cancel(),
  };
}
