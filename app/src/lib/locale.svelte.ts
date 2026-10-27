// The language the game speaks, as state the screens can read.
//
// The rules live in src/i18n (plain JS, tested in Node): which language a first visit gets, how
// a string is filled in, what a missing key falls back to. This file only holds the choice,
// remembers it, and tells the page what language it is in.

import { LOCALES, detectLocale, translate, type Locale } from '../../../src/i18n/i18n.js';
import {
  describeMessage, describeVoicing, describeInversion, type AnalyzerMessage, type Voicing,
} from '../../../src/i18n/messages.js';
import { storageKey } from '../../../src/storage.js';

export { LOCALES, type Locale };

const KEY = storageKey('locale');

/** The saved choice, if there is one. Storage can throw (a private window, blocked site data). */
function saved(): Locale | null {
  try {
    const value = localStorage.getItem(KEY);
    return (LOCALES as string[]).includes(value ?? '') ? (value as Locale) : null;
  } catch {
    return null;
  }
}

// One object rather than a bare $state, so the module can change it and every reader follows.
const current = $state({ locale: saved() ?? detectLocale(navigator.languages) });
document.documentElement.lang = current.locale;

/** The language in use. */
export function locale(): Locale {
  return current.locale;
}

/** Switches the language and remembers it for the next visit. */
export function setLocale(next: Locale) {
  current.locale = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not remembered, but still switched for this visit.
  }
}

/** The string for `key` in the language in use. Reactive: read it in markup and it follows. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  return translate(current.locale, key, params);
}

/** One of the analyzer's messages, said in the language in use. */
export function sayMessage(message: AnalyzerMessage): string {
  return describeMessage(current.locale, message);
}

/** A voicing's name ("Drop 2", "Rootless A, root in the bass"), or null when it has none. */
export function sayVoicing(voicing: Voicing): string | null {
  return describeVoicing(current.locale, voicing);
}

/** An inversion as `inversionOf` gives it, in the language in use. */
export function sayInversion(inversion: string | null): string | null {
  return describeInversion(current.locale, inversion);
}
