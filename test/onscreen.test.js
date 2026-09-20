import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnScreen, noteForKey, KEY_ROW } from '../src/ui/onscreen.js';

const harness = (options = {}) => {
  const sent = [];
  const timers = [];
  const onscreen = createOnScreen({
    send: data => sent.push([...data]),
    setTimer: fn => { timers.push(fn); return timers.length; },
    clearTimer: id => { timers[id - 1] = null; },
    ...options,
  });
  return { onscreen, sent, release: () => timers.filter(Boolean).forEach(fn => fn()) };
};

test('the letter row is a piano starting on the octave on screen', () => {
  assert.equal(noteForKey('KeyA', 60), 60);       // C
  assert.equal(noteForKey('KeyW', 60), 61);       // C#
  assert.equal(noteForKey('KeyS', 60), 62);       // D
  assert.equal(noteForKey('KeyJ', 60), 71);       // B
  assert.equal(noteForKey('KeyK', 60), 72);       // C above
  assert.equal(noteForKey('KeyA', 48), 48);       // an octave down
  assert.equal(noteForKey('Space', 60), null);
  assert.equal(noteForKey('KeyQ', 60), null);
  assert.deepEqual([...new Set(Object.values(KEY_ROW))].sort((a, b) => a - b), Object.values(KEY_ROW).sort((a, b) => a - b), 'no two keys play the same note');
});

test('clicks arm notes and Enter plays them as one chord, held and then released together', () => {
  const { onscreen, sent, release } = harness();
  onscreen.toggle(60);
  onscreen.toggle(64);
  onscreen.toggle(67);
  onscreen.toggle(64);                            // clicked again: disarmed
  assert.deepEqual(onscreen.armed, [60, 67]);
  assert.deepEqual(sent, [], 'arming is silent: nothing reaches the app until the chord is played');

  onscreen.toggle(64);
  assert.equal(onscreen.play(), true);
  assert.deepEqual(sent, [[0x90, 60, 88], [0x90, 64, 88], [0x90, 67, 88]]);
  assert.deepEqual(onscreen.armed, [], 'the chord is played, the keys are now sounding');
  assert.deepEqual(onscreen.sounding, [60, 64, 67]);

  release();
  assert.deepEqual(sent.slice(3), [[0x80, 60, 0], [0x80, 64, 0], [0x80, 67, 0]]);
  assert.deepEqual(onscreen.sounding, []);
});

test('Enter with nothing armed plays the last chord again', () => {
  const { onscreen, sent, release } = harness();
  onscreen.toggle(62);
  onscreen.toggle(65);
  onscreen.play();
  release();
  sent.length = 0;
  assert.equal(onscreen.play(), true);
  assert.deepEqual(sent, [[0x90, 62, 88], [0x90, 65, 88]]);
  assert.equal(harness().onscreen.play(), false, 'with nothing armed and nothing played yet, Enter does nothing');
});

test('a new chord released the one still sounding, so the voicings do not pile up', () => {
  const { onscreen, sent } = harness();
  onscreen.toggle(60);
  onscreen.toggle(64);
  onscreen.play();
  sent.length = 0;
  onscreen.toggle(62);
  onscreen.toggle(65);
  onscreen.play();
  assert.deepEqual(sent, [[0x80, 60, 0], [0x80, 64, 0], [0x90, 62, 88], [0x90, 65, 88]]);
});

test('typing is playing: a letter key is a note-on that lasts as long as the key is down', () => {
  const { onscreen, sent } = harness();
  onscreen.keyDown('KeyA');
  onscreen.keyDown('KeyD');
  onscreen.keyDown('KeyG');
  onscreen.keyDown('KeyA');                       // the key is already down (auto-repeat): once is once
  assert.deepEqual(sent, [[0x90, 60, 88], [0x90, 64, 88], [0x90, 67, 88]]);
  assert.deepEqual(onscreen.sounding, [60, 64, 67]);
  onscreen.keyUp('KeyD');
  assert.deepEqual(sent.at(-1), [0x80, 64, 0]);
  assert.equal(onscreen.keyDown('Space'), false, 'a key that is not a note is left to the app');
});

test('the octave moves the letter row, and the keys still down are released where they sounded', () => {
  const { onscreen, sent } = harness();
  assert.equal(onscreen.octave, 60);
  onscreen.keyDown('KeyA');
  onscreen.octaveDown();
  assert.equal(onscreen.octave, 48);
  assert.deepEqual(sent.at(-1), [0x80, 60, 0], 'the note that was down stops, it does not stay stuck');
  onscreen.keyDown('KeyA');
  assert.deepEqual(sent.at(-1), [0x90, 48, 88]);
  onscreen.octaveUp();
  onscreen.octaveUp();
  assert.equal(onscreen.octave, 72);
});

test('clear takes back what is armed and silences what is sounding', () => {
  const { onscreen, sent } = harness();
  onscreen.toggle(60);
  onscreen.toggle(64);
  onscreen.play();
  onscreen.toggle(70);
  sent.length = 0;
  onscreen.clear();
  assert.deepEqual(onscreen.armed, []);
  assert.deepEqual(onscreen.sounding, []);
  assert.deepEqual(sent, [[0x80, 60, 0], [0x80, 64, 0]]);
});

test('what is played on screen is heard: the same messages go to the app and to the synth', () => {
  const heard = [];
  const { onscreen, sent, release } = harness({ echo: data => heard.push([...data]) });
  onscreen.toggle(60);
  onscreen.toggle(64);
  assert.deepEqual(heard, [], 'arming is silent on both sides');
  onscreen.play();
  onscreen.keyDown('KeyG');
  onscreen.keyUp('KeyG');
  release();
  assert.deepEqual(heard, sent, 'the ear and the analyser get the same chord, note for note');
});
