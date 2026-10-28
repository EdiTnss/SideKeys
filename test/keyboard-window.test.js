// Where the two-octave window of the phone keyboard sits. Pure: no DOM, so it runs in Node.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWindow } from '../src/ui/keyboard.js';

test('fitWindow: notes already inside leave the window where it is', () => {
  assert.equal(fitWindow(48, [60, 64, 67]), 48);
  assert.equal(fitWindow(48, []), 48);
  assert.equal(fitWindow(48, [72]), 48, 'the top key, C5, is inside a C3–C5 window');
});

test('fitWindow: a note outside moves the window to the C below the lowest note', () => {
  assert.equal(fitWindow(48, [40, 52, 55]), 36, 'an E2 bass: the window starts on C2');
  assert.equal(fitWindow(48, [74, 77, 81]), 60, 'a voicing above C5: the highest window, C4–C6');
});

test('fitWindow: never past the edges of the full keyboard', () => {
  assert.equal(fitWindow(48, [28]), 36, 'below C2 it stops at C2');
  assert.equal(fitWindow(48, [96]), 60, 'the window ends at C6 at the most');
});
