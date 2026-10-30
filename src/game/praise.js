// The word that comes with a chord played right (Edi, 2026-10-30). Ids, not words: the words are
// `praise.<id>` in both dictionaries (src/i18n/). None of them is a star's name — "Clean" and
// "Smooth" already mean something on this screen.

export const PRAISE = ['nice', 'goodJob', 'neat', 'sweet', 'lovely', 'yes', 'tasty', 'beautiful'];

/**
 * The next word, never the one just said: the same "Nice" twice running reads as a machine.
 *
 * @param {string | null} previous  the id said last, or null
 * @param {() => number} [random]  a number in [0, 1); Math.random unless a test fixes it
 * @returns {string}
 */
export function nextPraise(previous, random = Math.random) {
  const pool = PRAISE.filter(id => id !== previous);
  return pool[Math.floor(random() * pool.length)];
}
