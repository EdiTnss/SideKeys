// Where the app keeps its own things in the browser: settings, saved pieces, statistics.
//
// The app was called Voicing Lab until 2026-09-20, when the name collided with a company selling
// the same thing. The rename is ours, not the user's problem, so anything saved under the old
// prefix moves across the first time its key is asked for. Once no browser out there still holds
// the old keys, LEGACY_PREFIX and the move can go and this file becomes one line.

export const STORAGE_PREFIX = 'sidekeys';
const LEGACY_PREFIX = 'voicing-lab';

/**
 * The storage key for `name`, after moving anything saved under the old app name across. Safe to
 * call on every read and write: it does nothing once the value is where it belongs, and a storage
 * that is missing or refuses (private mode, blocked site data) still gives back a usable key.
 */
export function storageKey(name, storage = globalThis.localStorage) {
  const key = `${STORAGE_PREFIX}.${name}`;
  try {
    if (!storage || storage.getItem(key) !== null) return key;
    const saved = storage.getItem(`${LEGACY_PREFIX}.${name}`);
    if (saved === null) return key;
    storage.setItem(key, saved);
    storage.removeItem(`${LEGACY_PREFIX}.${name}`);
  } catch {
    // Nothing to do: the caller's own try/catch decides what an unusable storage means.
  }
  return key;
}
