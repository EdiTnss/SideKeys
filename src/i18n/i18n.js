// The game's two languages: English by default, Romanian when the browser's first language is.
//
// Plain JS with no DOM, like theory/, so the rules — which language a visitor gets, how a
// string is filled in, what happens when a key is missing — are tested in Node. The shell holds
// the chosen language as state and calls `translate`; it never builds a sentence of its own.
//
// The jazz vocabulary (voicing, shell, drop 2…), note letters, the star names and the share
// text stay in English in both dictionaries: that is a decision about the words, not a gap.

import en from './en.js';
import ro from './ro.js';

/** @typedef {'en' | 'ro'} Locale */

/** @type {Locale[]} */
export const LOCALES = ['en', 'ro'];

/** @type {Locale} */
export const DEFAULT_LOCALE = 'en';

const DICTIONARIES = { en, ro };

/**
 * The language a first visit gets: Romanian when the browser's first language is Romanian,
 * English otherwise. Only the first one counts — someone who lists Romanian second chose
 * English first.
 * @param {readonly string[] | undefined} languages  `navigator.languages`
 * @returns {Locale}
 */
export function detectLocale(languages) {
  const first = String(languages?.[0] ?? '').toLowerCase();
  // `ro` or `ro-…`, not any code that happens to start with the letters (`rof`, `rom`).
  return first === 'ro' || first.startsWith('ro-') ? 'ro' : DEFAULT_LOCALE;
}

/**
 * The names between braces in a string, each once, in the order they first appear.
 * @param {string} text
 * @returns {string[]}
 */
export function paramsOf(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))];
}

/**
 * The string for `key` in `locale`, with every `{param}` filled in. A key Romanian lacks falls
 * back to English; a key nobody has comes back as itself, so a gap shows on screen as a name
 * someone can search for rather than as nothing.
 * @param {string} locale
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @param {Record<string, Record<string, string>>} [dictionaries]  for the tests
 * @returns {string}
 */
export function translate(locale, key, params = {}, dictionaries = DICTIONARIES) {
  const text = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
  // A param that was not passed stays as `{name}`: visible, so the mistake is found.
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}
