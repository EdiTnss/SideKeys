// The word that comes with a chord played right: one from a short list, never the same one twice
// in a row, and named in both languages.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PRAISE, nextPraise } from '../src/game/praise.js';
import en from '../src/i18n/en.js';
import ro from '../src/i18n/ro.js';

test('there are enough words that the same one does not come round too often', () => {
  assert.ok(PRAISE.length >= 6);
  assert.equal(new Set(PRAISE).size, PRAISE.length);
});

test('every word has its key in both languages', () => {
  for (const id of PRAISE) {
    assert.equal(typeof en[`praise.${id}`], 'string', `en: praise.${id}`);
    assert.equal(typeof ro[`praise.${id}`], 'string', `ro: praise.${id}`);
  }
});

test('the first word can be any of them', () => {
  assert.equal(nextPraise(null, () => 0), PRAISE[0]);
  assert.equal(nextPraise(null, () => 0.999), PRAISE.at(-1));
});

test('the word just said is never said again straight away', () => {
  assert.equal(nextPraise(PRAISE[0], () => 0), PRAISE[1]);
  assert.equal(nextPraise(PRAISE.at(-1), () => 0.999), PRAISE.at(-2));
  let previous = null;
  for (let i = 0; i < 500; i++) {
    const word = nextPraise(previous);
    assert.ok(PRAISE.includes(word));
    assert.notEqual(word, previous);
    previous = word;
  }
});

test('a word that is not on the list is no reason to leave one out', () => {
  assert.equal(nextPraise('gone', () => 0), PRAISE[0]);
});
