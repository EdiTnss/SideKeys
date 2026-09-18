import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangementMessages, DEFAULT_CHANNELS } from '../src/midi/player.js';

const events = [
  { beat: 0, duration: 4, part: 'bass', midi: 38, velocity: 80 },
  { beat: 0, duration: 4, part: 'lh', midi: 53, velocity: 64 },
  { beat: 0, duration: 2, part: 'melody', midi: 65, velocity: 90 },
  { beat: 2, duration: 2, part: 'melody', midi: 65, velocity: 90 },
];
const rows = messages => messages.map(message => [message.time, ...message.data]);

test('events become timed note-on and note-off messages, one channel per part', () => {
  assert.deepEqual(DEFAULT_CHANNELS, { melody: 1, lh: 2, bass: 3 });
  assert.deepEqual(rows(arrangementMessages(events, { tempo: 120, startMs: 1000 })), [
    [1000, 0x92, 38, 80],               // bass on, channel 3
    [1000, 0x91, 53, 64],               // left hand on, channel 2
    [1000, 0x90, 65, 90],               // melody on, channel 1
    [2000, 0x80, 65, 0],                // the repeated F: off first,
    [2000, 0x90, 65, 90],               // then on again, so it is struck twice
    [3000, 0x82, 38, 0],
    [3000, 0x81, 53, 0],
    [3000, 0x80, 65, 0],
  ]);
});

test('parts can be muted, channels moved, and the tempo sets the spacing', () => {
  const noLeftHand = arrangementMessages(events, { tempo: 120, startMs: 0, parts: { bass: true, lh: false, melody: true } });
  assert.ok(noLeftHand.every(message => (message.data[0] & 0x0f) !== 1), 'nothing on the left-hand channel');
  assert.equal(noLeftHand.length, 6);

  const moved = arrangementMessages(events, { tempo: 120, startMs: 0, channels: { melody: 5, lh: 6, bass: 7 } });
  assert.deepEqual(moved.slice(0, 3).map(message => message.data[0]), [0x96, 0x95, 0x94]);

  const slow = arrangementMessages(events, { tempo: 60, startMs: 500 });
  assert.deepEqual(slow.at(-1), { time: 4500, data: [0x80, 65, 0] });    // four beats of a second each
  assert.deepEqual(arrangementMessages([], { tempo: 120, startMs: 0 }), []);
});
