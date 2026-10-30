// The verdict's two sounds, and whether the player wants them. On by default; switched off in
// Settings and remembered in this browser. The sounds themselves live in src/audio/verdict.js.

import { createVerdictSound, storageKey } from '../bridge/midi';

const KEY = storageKey('verdictSound');

/** The saved choice. Storage can throw (a private window, blocked site data): then it is on. */
function saved(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

const state = $state({ on: saved() });
const voice = createVerdictSound({ level: () => (state.on ? 1 : 0) });

export const verdictSound = {
  get on() { return state.on; },
  set(on: boolean) {
    state.on = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private window */ }
  },
  /** A chord played right: the chime, on the chord's root. */
  right: (rootPc: number) => voice.right(rootPc),
  /** A chord played wrong: the thud. */
  wrong: () => voice.wrong(),
};
