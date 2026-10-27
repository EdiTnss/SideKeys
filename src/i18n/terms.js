// Finding the glossary's terms in a sentence, so the shell can underline them. Pure, no DOM.
//
// A sentence comes back as its pieces, in order — plain text, and text that is a term — and the
// pieces put back together are the sentence exactly. A term is found in any case, only as a whole
// word, and where two could start at the same place the longer wins ("drop 2&4" over "drop 2").

/** A letter or a digit, in any script: what a term must not run into on either side. */
const WORDISH = /[\p{L}\p{N}]/u;

/**
 * @param {string} text
 * @param {Array<{ id: string, match?: string[] }>} terms
 * @returns {Array<{ text: string, term?: string }>}
 */
export function splitTerms(text, terms) {
  // Every way of writing every term, longest first, so the first one that fits is the longest.
  const words = terms
    .flatMap(term => (term.match ?? []).map(word => ({ word: word.toLowerCase(), id: term.id })))
    .sort((a, b) => b.word.length - a.word.length);
  const lower = text.toLowerCase();
  const parts = [];
  let plain = '';
  let at = 0;
  while (at < text.length) {
    const before = text[at - 1];
    const found = before && WORDISH.test(before) ? null : words.find(({ word }) => {
      if (!lower.startsWith(word, at)) return false;
      const after = text[at + word.length];
      return !after || !WORDISH.test(after);
    });
    if (found) {
      if (plain) parts.push({ text: plain });
      plain = '';
      parts.push({ text: text.slice(at, at + found.word.length), term: found.id });
      at += found.word.length;
    } else {
      plain += text[at];
      at += 1;
    }
  }
  if (plain) parts.push({ text: plain });
  return parts;
}
