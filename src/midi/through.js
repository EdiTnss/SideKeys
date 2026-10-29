// A keyboard played through the app's own piano. Pure, no Web MIDI and no Web Audio here.
//
// A MIDI controller has no sound of its own: without this, the notes reach the analyser and
// nobody hears them. A Genos sounds by itself, and through the app as well it would be heard
// twice, a few milliseconds apart. The app cannot ask a keyboard which kind it is, so the player
// says, once per keyboard, and a keyboard nobody has decided about is played through: silence
// reads as broken, a doubled note is heard and switched off in two seconds (Edi, 2026-10-29).

/** @typedef {{ id: string, name: string }} Port */
/** @typedef {{ send: (data: number[]) => void }} Voice */
/** @typedef {Record<string, boolean>} SoundSettings  keyboard name → sound in the app */

/**
 * Whether a keyboard is played through the app. Keyed by name, not id: a browser may hand the
 * same keyboard a new id on another day, and the name is what the player sees in the header.
 * @param {SoundSettings} settings
 * @param {string} name
 * @returns {boolean}
 */
export function soundOn(settings, name) {
  return settings[name] ?? true;
}

/**
 * @param {SoundSettings} settings
 * @param {string} name
 * @param {boolean} on
 * @returns {SoundSettings}
 */
export function setSound(settings, name, on) {
  return { ...settings, [name]: on };
}

/**
 * createThrough({ voice, enabled }) → { noteOn, noteOff, silence }
 * `voice()` is whatever sounds now (the synth, then the piano once it has loaded); a note is let
 * go by the voice that started it. `enabled(port)` is asked at every note-on, so switching the
 * sound changes the next note, and `silence(name)` lets go of what that keyboard still rings.
 *
 * @param {{ voice: () => Voice, enabled: (port: Port) => boolean }} options
 */
export function createThrough({ voice, enabled }) {
  /** `${port name}:${note}` → the voice it sounds on */
  const ringing = new Map();
  const key = (name, note) => `${name}:${note}`;

  return {
    /** @param {number} note @param {number} velocity @param {Port} port */
    noteOn(note, velocity, port) {
      if (!enabled(port)) return;
      const id = key(port.name, note);
      // The same key struck again before its note-off: the old one stops first, as on a piano.
      ringing.get(id)?.send([0x80, note, 0]);
      const sounding = voice();
      ringing.set(id, sounding);
      sounding.send([0x90, note, velocity]);
    },
    /** @param {number} note @param {Port} port */
    noteOff(note, port) {
      const id = key(port.name, note);
      const sounding = ringing.get(id);
      if (!sounding) return;
      ringing.delete(id);
      sounding.send([0x80, note, 0]);
    },
    /** Lets go of every note still ringing from the keyboard called `name`. */
    silence(name) {
      for (const [id, sounding] of [...ringing]) {
        if (!id.startsWith(`${name}:`)) continue;
        ringing.delete(id);
        sounding.send([0x80, Number(id.slice(name.length + 1)), 0]);
      }
    },
  };
}
