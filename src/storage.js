// Where the app keeps its own things in the browser: settings, saved pieces, statistics.
//
// The app was called Voicing Lab until 2026-09-20, and until 2026-10-05 this file also moved
// anything saved under `voicing-lab.*` across on first use. The move is gone: no browser out there
// holds the old keys. Edi's own Chrome and Edge profiles had none, on any origin, and the old name
// was public on Pages for only a few hours on 2026-09-20 — localStorage is per origin, not per
// path, so a visitor in that window would have carried them, and the journal records that nobody
// had seen the link yet.

export const STORAGE_PREFIX = 'sidekeys';

/** The storage key for `name`. */
export function storageKey(name) {
  return `${STORAGE_PREFIX}.${name}`;
}
