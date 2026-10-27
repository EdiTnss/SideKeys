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
 * @typedef {string | { one: string, few?: string, other: string }} Entry
 *   A counted string holds its plural forms: `one` and `other` in English, and `few` too in
 *   Romanian (2–19, and anything ending in 01–19: "2 zile", "20 de zile").
 */

/** The plural form `count` takes in `locale`, from the rules the browser and Node both carry. */
function pluralForm(locale, entry, count) {
  const form = typeof count === 'number' ? new Intl.PluralRules(locale).select(count) : 'other';
  return entry[form] ?? entry.other;
}

/**
 * The string for `key` in `locale`, with every `{param}` filled in. A key Romanian lacks falls
 * back to English; a key nobody has comes back as itself, so a gap shows on screen as a name
 * someone can search for rather than as nothing. A counted string is chosen by `params.count`.
 * @param {string} locale
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @param {Record<string, Record<string, Entry>>} [dictionaries]  for the tests
 * @returns {string}
 */
export function translate(locale, key, params = {}, dictionaries = DICTIONARIES) {
  const own = dictionaries[locale]?.[key];
  const found = own ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
  const text = typeof found === 'string' ? found : pluralForm(own ? locale : DEFAULT_LOCALE, found, params.count);
  // A param that was not passed stays as `{name}`: visible, so the mistake is found.
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}
