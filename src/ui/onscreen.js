// The on-screen keyboard as a playable input: clicks and computer keys turn into the same
// note-on / note-off stream a Genos sends, delivered on the virtual MIDI port. Capture, tape,
// statistics, the analyser and the harness see a chord played on a keyboard, not a special case,
// which is the whole reason demo mode needs no second code path. No theory here.
//
// Two ways in, because the two devices are not the same:
// - the mouse holds one note at a time, so a click only arms a key and Enter plays the chord.
//   Sounding under the mouse would give the capture's debounce (300 ms) a two-note voicing to
//   report for every click;
// - a computer keyboard does hold several keys, so a letter is a note-on for as long as it is
//   down, like a piano.

/** The letter row as a piano: A S D F G H J K are the white keys, W E T Y U O the black ones. */
export const KEY_ROW = Object.freeze({
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
  KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14,
});

export const OCTAVE_LOW = 36;
export const OCTAVE_HIGH = 84;

/** Which note a computer key plays when the row starts on `octave` (the MIDI number of its C). */
export function noteForKey(code, octave) {
  const step = KEY_ROW[code];
  return step === undefined ? null : octave + step;
}

/**
 * createOnScreen({ send, velocity, holdMs, octave, setTimer, clearTimer, onChange })
 * → { toggle(midi), play(), clear(), release(), keyDown(code), keyUp(code), octaveUp(),
 *     octaveDown(), armed, sounding, octave }
 * `send(data)` delivers one MIDI message on the virtual input. onChange fires whenever what is
 * armed, sounding or the octave changes, so the drawn keyboard can follow.
 */
export function createOnScreen({
  send,
  velocity = 88,
  holdMs = 1300,                 // longer than the capture's debounce: the verdict lands while the chord still sounds
  octave = 60,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
  onChange = () => {},
} = {}) {
  const armed = new Set();
  const down = new Map();        // key code → the note it started, so a moved octave cannot strand it
  let sounding = [];
  let last = [];                 // the chord played last, for Enter with nothing armed
  let timer = null;

  const sorted = set => [...set].sort((a, b) => a - b);
  const noteOn = note => send([0x90, note, velocity]);
  const noteOff = note => send([0x80, note, 0]);

  function changed() {
    onChange({ armed: sorted(armed), sounding: [...sounding], octave });
  }

  /** A click on a drawn key: arms it, or takes it back. */
  function toggle(midi) {
    if (!armed.delete(midi)) armed.add(midi);
    changed();
  }

  /** Plays what is armed as one chord — or, with nothing armed, the chord played last. */
  function play() {
    const notes = armed.size ? sorted(armed) : last;
    if (notes.length === 0) return false;
    release();
    armed.clear();
    sounding = notes;
    last = notes;
    for (const note of notes) noteOn(note);
    timer = setTimer(release, holdMs);
    changed();
    return true;
  }

  /** Lets go of the chord played with Enter. Keys held down by typing stop with their own keyup. */
  function release() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (sounding.length === 0) return;
    for (const note of sounding) noteOff(note);
    sounding = [];
    changed();
  }

  function clear() {
    armed.clear();
    release();
    changed();
  }

  function keyDown(code) {
    const note = noteForKey(code, octave);
    if (note === null || down.has(code)) return false;    // auto-repeat strikes the note once
    down.set(code, note);
    sounding = sorted(new Set([...sounding, note]));
    noteOn(note);
    changed();
    return true;
  }

  function keyUp(code) {
    const note = down.get(code);
    if (note === undefined) return false;
    down.delete(code);
    sounding = sounding.filter(held => held !== note);
    noteOff(note);
    changed();
    return true;
  }

  function shift(by) {
    const next = Math.min(OCTAVE_HIGH, Math.max(OCTAVE_LOW, octave + by));
    if (next === octave) return;
    for (const code of [...down.keys()]) keyUp(code);      // released where they sounded, not where the row moved to
    octave = next;
    changed();
  }

  return {
    toggle,
    play,
    clear,
    release,
    keyDown,
    keyUp,
    octaveUp: () => shift(12),
    octaveDown: () => shift(-12),
    get armed() { return sorted(armed); },
    get sounding() { return [...sounding]; },
    get octave() { return octave; },
  };
}
