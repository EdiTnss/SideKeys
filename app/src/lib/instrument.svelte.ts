// The MIDI session, wrapped in runes so the screens can read it.
//
// Nothing here reimplements the engine. The on-screen keyboard is a virtual MIDI *input* and the
// browser synth a virtual *output*, sitting beside the real ports rather than replacing them, so
// there is no "demo mode" branch anywhere: a click and a Genos arrive by the same road. What
// this file owns is when those parts are built and what the screens are allowed to see.
//
// There is one instrument for the whole visit, built by the app and handed to whichever screen
// is being played. It used to be built by the game screen, once per level, and so the keyboard
// had to be connected again on every level (Edi, at the Genos, 2026-10-12).

import {
  connectMidi, VoicingCapture, createVirtualMidi, mergeAccess, createSynth, createOnScreen, loadPiano,
} from '../bridge/midi';

/** The status line, as a dictionary key and its params: the screen says it in the player's language. */
export type Status = { key: string; params?: Record<string, string>; level: 'ok' | 'warn' | '' };
export type Instrument = ReturnType<typeof createInstrument>;
/** What a screen wants to be told while it is the one being played to. */
export type Listener = {
  onVoicing: (notes: number[], info: { startedAt: number | null }) => void;
  onNext?: () => void;
};

type Device = { id: string; name: string };
type OnScreenState = { armed: number[]; sounding: number[]; octave: number };

const IDLE: Status = { key: 'status.idle', level: '' };

export function createInstrument({
  debounceMs = 300,
  nextNote = 28,
}: {
  debounceMs?: number;
  nextNote?: number | null;
} = {}) {
  const synth = createSynth();
  const virtual = createVirtualMidi({ inputs: ['On-screen keyboard'], outputs: [synth, 'Virtual output'] });
  const ports = mergeAccess(virtual.access);

  // What the drawn keyboard sounds through. The oscillator synth answers from the first click;
  // if the sample pack is there, the piano takes over as soon as it has decoded. Both are MIDI
  // output ports, so nothing above this line knows which one it is talking to.
  let voice: { send: (data: number[], time?: number) => void } = synth;
  let sound = $state<'synth' | 'piano'>('synth');
  // Three megabytes nobody needs on the first screen: the samples are fetched the first time a
  // screen listens, which is the first time a note could sound. That is also a click after the
  // page opened, so the browser lets the audio start.
  let soundAsked = false;
  function loadSound() {
    if (soundAsked) return;
    soundAsked = true;
    loadPiano().then(piano => {
      if (!piano) return;
      voice = piano;
      sound = 'piano';
    });
  }

  let held = $state<number[]>([]);
  let armed = $state<number[]>([]);
  let octave = $state(60);
  let hardware = $state<string[]>([]);
  let status = $state<Status>(IDLE);
  // While the letters are a piano they are not shortcuts. With an instrument plugged in they go
  // back to being shortcuts, because nobody types a voicing when a Genos is under their hands.
  let typeToPlay = $state(true);
  // Whether the *player* asked for the keyboard. A reconnection the page made by itself is not
  // a question anyone put, so a missing cable is not reported as the answer to one.
  let asked = false;
  let listener: Listener | null = null;

  const onscreen = createOnScreen({
    send: (data: number[]) => virtual.send(data),
    // The drawn keyboard has no strings, so it sounds through the synth directly rather than
    // through whichever output is selected. One call, so ear and analyser never hear two chords.
    echo: (data: number[]) => voice.send(data),
    onChange: (state: OnScreenState) => {
      armed = state.armed;
      octave = state.octave;
    },
  });

  const capture = new VoicingCapture({
    debounceMs,
    nextNote,
    // startedAt rides along because timed play needs where the voicing *began*, not where it
    // was captured: half a beat of debounce is the difference between two chords.
    onVoicing: (notes: number[], info: { startedAt: number | null }) => listener?.onVoicing(notes, info),
    onNext: () => listener?.onNext?.(),
    onChange: (notes: number[]) => { held = notes; },
  });

  function showDevices({ inputs }: { inputs: Device[] }) {
    hardware = inputs.filter(input => !virtual.access.inputs.has(input.id)).map(input => input.name);
    if (hardware.length) onscreen.releaseKeys();
    typeToPlay = hardware.length === 0;
    status = hardware.length
      ? { key: 'status.midiIn', params: { devices: hardware.join(', ') }, level: 'ok' }
      : asked
        ? { key: 'status.noInput', level: 'warn' }
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
    status = { key: 'status.error', params: { message: error.message }, level: 'warn' };
  });

  // The example ringing now, if one is: a second one cuts it off rather than piling on top.
  let auditioning: { timer: ReturnType<typeof setTimeout>; stop: () => void } | null = null;
  function stopAudition() {
    if (!auditioning) return;
    clearTimeout(auditioning.timer);
    auditioning.stop();
    auditioning = null;
  }

  let real: Promise<void> | null = null;
  /** Adds the real ports to the merged access. Once: a second add would list every port twice. */
  function addHardware() {
    if (!real) {
      real = navigator.requestMIDIAccess().then(access => ports.add(access));
      // A refusal is not kept as the answer: the player may allow it the next time they ask.
      real.catch(() => { real = null; });
    }
    return real;
  }

  /** The player asks for the real instrument. The browser shows its prompt the first time. */
  async function connect() {
    asked = true;
    try {
      await addHardware();
      // Granted, with nothing plugged in: the device list did not change, so nothing else would
      // say so, and the button would look as if it had done nothing.
      if (!hardware.length) status = { key: 'status.noInput', level: 'warn' };
    } catch (error) {
      status = { key: 'status.refused', params: { message: (error as Error).message }, level: 'warn' };
    }
  }

  // The browser remembers the answer to its MIDI prompt, per site. When that answer was yes,
  // asking again shows nothing, so the keyboard is simply there on every later visit. When it
  // was never given, nothing is asked here: a prompt on page load would be an answer demanded
  // before anyone has seen the question.
  async function reconnect() {
    try {
      const permission = await navigator.permissions.query({ name: 'midi' as PermissionName });
      if (permission.state === 'granted') await addHardware();
    } catch {
      // No Permissions API, or one that does not know "midi": the button is still there.
    }
  }
  reconnect();

  return {
    get held() { return held; },
    get armed() { return armed; },
    get octave() { return octave; },
    get hardware() { return hardware; },
    get status() { return status; },
    get typeToPlay() { return typeToPlay; },
    get sound() { return sound; },
    connect,
    /**
     * A screen starts receiving voicings; what comes back stops it. Leaving also drops whatever
     * was armed or half captured, so the notes of one level never land in the next.
     */
    listen(next: Listener) {
      listener = next;
      loadSound();
      return () => {
        // A newer screen may already be listening, if it was mounted before this one was torn down.
        if (listener !== next) return;
        listener = null;
        capture.cancel();
        onscreen.clear();
      };
    },
    /**
     * Sounds a voicing that nobody is judging: an example on a theory page. It goes to the
     * page's own voice and never through the capture, so it is heard and not answered.
     */
    audition(notes: number[], ms = 1600) {
      loadSound();
      stopAudition();
      // The voice may change from synth to piano while this rings, and a note has to be let go
      // by the voice that started it.
      const ringing = voice;
      for (const note of notes) ringing.send([0x90, note, 80]);
      const timer = setTimeout(() => {
        for (const note of notes) ringing.send([0x80, note, 0]);
        if (auditioning?.timer === timer) auditioning = null;
      }, ms);
      auditioning = { timer, stop: () => { for (const note of notes) ringing.send([0x80, note, 0]); } };
    },
    /** Lets go of an example that is still ringing, for when its page is left. */
    hush: stopAudition,
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
