// The two languages of the game: English by default, Romanian when the browser asks for it.
// The dictionaries must stay twins — the same keys, and the same {params} in every string — so a
// key added in one language and forgotten in the other fails here, not on someone's screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, DEFAULT_LOCALE, detectLocale, translate, paramsOf } from '../src/i18n/i18n.js';
import en from '../src/i18n/en.js';
import ro from '../src/i18n/ro.js';

test('the dictionaries have the same keys', () => {
  assert.deepEqual(Object.keys(ro).sort(), Object.keys(en).sort());
});

test('every key takes the same {params} in both languages', () => {
  for (const key of Object.keys(en)) {
    assert.deepEqual(paramsOf(ro[key]), paramsOf(en[key]), key);
  }
});

test('no string in either dictionary is empty', () => {
  for (const [name, dictionary] of [['en', en], ['ro', ro]]) {
    for (const [key, text] of Object.entries(dictionary)) {
      assert.ok(typeof text === 'string' && text.trim() !== '', `${name}: ${key}`);
    }
  }
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
