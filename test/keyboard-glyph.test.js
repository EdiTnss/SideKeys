// The sign drawn on a judged key, so the verdict reads without telling red from green (review
// 2026-10-30, #26). Pure: no DOM, so it runs in Node.

import test from 'node:test';
import assert from 'node:assert/strict';
import { keyGlyph } from '../src/ui/keyboard.js';

test('keyGlyph: a wrong note gets ×, a note to avoid gets !', () => {
  assert.equal(keyGlyph('role-wrong'), '×');
  assert.equal(keyGlyph('role-avoid'), '!');
  assert.equal(keyGlyph('role-wrong strike-a'), '×', 'the strike marker does not hide it');
  assert.equal(keyGlyph('role-avoid caution strike-b'), '!');
});

test('keyGlyph: every other key carries no sign', () => {
  for (const classes of ['role-chordTone', 'role-tension', 'role-altered', 'held', 'armed', 'missing', '', undefined]) {
    assert.equal(keyGlyph(classes), '', String(classes));
  }
});
