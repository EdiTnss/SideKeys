// The two languages of the game: English by default, Romanian when the browser asks for it.
// The dictionaries must stay twins — the same keys, and the same {params} in every string — so a
// key added in one language and forgotten in the other fails here, not on someone's screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, DEFAULT_LOCALE, detectLocale, translate, paramsOf, decimal } from '../src/i18n/i18n.js';
import en from '../src/i18n/en.js';
import ro from '../src/i18n/ro.js';

test('the dictionaries have the same keys', () => {
  assert.deepEqual(Object.keys(ro).sort(), Object.keys(en).sort());
});

// A counted string is an object of plural forms ({ one, other } in English, { one, few, other }
// in Romanian); every other string is a plain string.
const formsOf = value => (typeof value === 'string' ? [value] : Object.values(value));

test('every key takes the same {params} in both languages, in every plural form', () => {
  for (const key of Object.keys(en)) {
    const wanted = paramsOf(formsOf(en[key])[0]).sort();
    for (const form of [...formsOf(en[key]), ...formsOf(ro[key])]) {
      assert.deepEqual(paramsOf(form).filter(name => name !== 'count').sort(),
        wanted.filter(name => name !== 'count'), key);
    }
  }
});

test('a counted string is counted in both languages, with the forms each language needs', () => {
  for (const key of Object.keys(en)) {
    assert.equal(typeof ro[key], typeof en[key], key);
    if (typeof en[key] === 'string') continue;
    assert.deepEqual(Object.keys(en[key]).sort(), ['one', 'other'], `en: ${key}`);
    assert.deepEqual(Object.keys(ro[key]).sort(), ['few', 'one', 'other'], `ro: ${key}`);
  }
});

test('no string in either dictionary is empty', () => {
  for (const [name, dictionary] of [['en', en], ['ro', ro]]) {
    for (const [key, value] of Object.entries(dictionary)) {
      for (const text of formsOf(value)) {
        assert.ok(typeof text === 'string' && text.trim() !== '', `${name}: ${key}`);
      }
    }
  }
});

test('translate: a counted string takes the plural form of {count}', () => {
  const dictionaries = {
    en: { days: { one: '{count} day', other: '{count} days' } },
    ro: { days: { one: 'o zi', few: '{count} zile', other: '{count} de zile' } },
  };
  assert.equal(translate('en', 'days', { count: 1 }, dictionaries), '1 day');
  assert.equal(translate('en', 'days', { count: 0 }, dictionaries), '0 days');
  assert.equal(translate('en', 'days', { count: 2 }, dictionaries), '2 days');
  assert.equal(translate('ro', 'days', { count: 1 }, dictionaries), 'o zi');
  assert.equal(translate('ro', 'days', { count: 0 }, dictionaries), '0 zile');
  assert.equal(translate('ro', 'days', { count: 19 }, dictionaries), '19 zile');
  assert.equal(translate('ro', 'days', { count: 20 }, dictionaries), '20 de zile');
  assert.equal(translate('ro', 'days', { count: 101 }, dictionaries), '101 zile');
});

test('translate: a counted string with no count still says something', () => {
  const dictionaries = { en: { days: { one: '{count} day', other: '{count} days' } }, ro: {} };
  assert.equal(translate('en', 'days', {}, dictionaries), '{count} days');
});

test('paramsOf: the names between braces, each once, in order', () => {
  assert.deepEqual(paramsOf('Missing {note} ({degree}), not {note}'), ['note', 'degree']);
  assert.deepEqual(paramsOf('No params here'), []);
});

test('detectLocale: Romanian only when the first language is Romanian', () => {
  assert.equal(detectLocale(['ro-RO', 'en-US']), 'ro');
  assert.equal(detectLocale(['ro']), 'ro');
  assert.equal(detectLocale(['en-US', 'ro-RO']), 'en');
  assert.equal(detectLocale(['de']), 'en');
  assert.equal(detectLocale([]), 'en');
  assert.equal(detectLocale(undefined), 'en');
});

test('detectLocale: a code that only starts with the letters is not Romanian', () => {
  // `rof` (Rombo) and `rom` (Romany) begin with "ro" but are other languages.
  assert.equal(detectLocale(['rof']), 'en');
  assert.equal(detectLocale(['rom']), 'en');
  assert.equal(detectLocale(['RO-ro']), 'ro');
});

test('the locales are English and Romanian, English first', () => {
  assert.deepEqual(LOCALES, ['en', 'ro']);
  assert.equal(DEFAULT_LOCALE, 'en');
});

test('translate: the string for the locale', () => {
  assert.equal(translate('en', 'header.connect'), 'Connect a MIDI keyboard');
  assert.equal(translate('ro', 'header.connect'), 'Conectează o clapă MIDI');
});

test('translate: {params} are filled in, every time they appear', () => {
  const dictionaries = { en: { 'x': 'Missing {note} ({degree}), {note}' }, ro: {} };
  assert.equal(translate('en', 'x', { note: 'E', degree: '3' }, dictionaries), 'Missing E (3), E');
  assert.equal(translate('en', 'x', { note: 0, degree: 3 }, dictionaries), 'Missing 0 (3), 0');
});

test('translate: a missing param stays visible rather than vanishing', () => {
  const dictionaries = { en: { 'x': 'Missing {note}' }, ro: {} };
  assert.equal(translate('en', 'x', {}, dictionaries), 'Missing {note}');
});

test('translate: a key missing in Romanian falls back to English', () => {
  const dictionaries = { en: { 'x': 'Only in English' }, ro: {} };
  assert.equal(translate('ro', 'x', {}, dictionaries), 'Only in English');
});

test('translate: an unknown locale falls back to English', () => {
  assert.equal(translate('fr', 'header.connect'), 'Connect a MIDI keyboard');
});

test('translate: a key missing everywhere shows the key, never an empty string', () => {
  assert.equal(translate('ro', 'no.such.key'), 'no.such.key');
});

test('decimal: a computed number is written the way each language writes it', () => {
  // The written Romanian text already says 1,25; a number computed on the page has to agree.
  assert.equal(decimal('en', 1.25, 2), '1.25');
  assert.equal(decimal('ro', 1.25, 2), '1,25');
  assert.equal(decimal('ro', 0.7512, 2), '0,75');
  assert.equal(decimal('ro', 4, 2), '4,00');
  assert.equal(decimal('ro', 1.5), '1,5');       // no digits asked: as short as the number is
  assert.equal(decimal('en', 1.5), '1.5');
  assert.equal(decimal('ro', 2), '2');
});
