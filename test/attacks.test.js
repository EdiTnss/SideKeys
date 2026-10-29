import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { groupAttacks, attacksFromTape, GROUP_MS } from '../src/ui/attacks.js';

const v = names => names.split(' ').map(nameToMidi);
const on = (t, name) => ({ t, on: true, note: nameToMidi(name) });
const off = (t, name) => ({ t, on: false, note: nameToMidi(name) });

test('note-ons within the group window are one attack, with every key held at its end', () => {
  assert.equal(GROUP_MS, 50);
  const attacks = groupAttacks([on(0, 'F3'), on(12, 'A3'), on(30, 'C4'), on(41, 'E4')]);
  assert.deepEqual(attacks, [{ t: 0, notes: v('F3 A3 C4 E4'), move: false }]);
});

test('two hits of the same chord an eighth apart stay two attacks', () => {
  // 160 bpm, swung eighths: the capture's 300 ms would melt these into one snapshot.
  const events = [
    on(0, 'F3'), on(10, 'A3'), on(20, 'C4'), off(150, 'F3'), off(150, 'A3'), off(155, 'C4'),
    on(250, 'F3'), on(258, 'A3'), on(262, 'C4'),
  ];
  const attacks = groupAttacks(events);
  assert.deepEqual(attacks.map(a => [a.t, a.notes]), [[0, v('F3 A3 C4')], [250, v('F3 A3 C4')]]);
});

test('a staccato chord released before the next event keeps its notes', () => {
  const attacks = groupAttacks([on(0, 'E3'), on(5, 'G3'), on(9, 'B3'), off(90, 'E3'), off(92, 'G3'), off(95, 'B3'), on(800, 'D3'), on(805, 'F3')]);
  assert.deepEqual(attacks.map(a => a.notes), [v('E3 G3 B3'), v('D3 F3')]);
});

test('a key grazed and released inside the window does not count', () => {
  const attacks = groupAttacks([on(0, 'F3'), on(4, 'G3'), off(20, 'G3'), on(25, 'A3'), on(30, 'C4')]);
  assert.deepEqual(attacks[0].notes, v('F3 A3 C4'));
});

test('one new note over a held chord is a move; one note alone is dropped', () => {
  const attacks = groupAttacks([
    on(0, 'F3'), on(5, 'B3'), on(9, 'E4'),
    off(400, 'F3'), on(405, 'E3'),            // the 7 of G7 falling to the 3 of Cmaj7
    off(900, 'E3'), off(900, 'B3'), off(900, 'E4'),
    on(1200, 'C2'),                           // a lone note: not a chord
  ]);
  assert.deepEqual(attacks, [
    { t: 0, notes: v('F3 B3 E4'), move: false },
    { t: 405, notes: v('E3 B3 E4'), move: true },
  ]);
});

const tapeOf = events => ({ format: 1, app: 'sidekeys', settings: {}, events });
const midi = (t, status, name) => ({ t, type: 'midi', data: [status, nameToMidi(name), status === 0x90 ? 80 : 0] });

test('attacksFromTape: the last timed run, its grid and clock, and every attack placed in it', () => {
  // 120 bpm: a beat is 500 ms; bar 1 starts at 10 000 ms.
  const tape = tapeOf([
    { t: 0, type: 'progression', grid: '| Dm7 | G7 |', timeSignature: [4, 4], loop: true },
    { t: 100, type: 'start', timed: true, tempo: 90, bar1At: 2000 },
    midi(2000, 0x90, 'C4'), midi(2005, 0x90, 'E4'),
    { t: 3000, type: 'stop' },
    { t: 8000, type: 'start', timed: true, tempo: 120, bar1At: 10000 },
    midi(10000, 0x90, 'F3'), midi(10010, 0x90, 'A3'), midi(10020, 0x90, 'C4'),
    midi(11000, 0x80, 'F3'), midi(11000, 0x80, 'A3'), midi(11000, 0x80, 'C4'),
    midi(11833, 0x90, 'F3'), midi(11840, 0x90, 'B3'),     // the swung "and" of 4
    { t: 12500, type: 'recorder', on: true },
    midi(12600, 0x90, 'G5'), midi(12610, 0x90, 'B5'),     // the melody recorder had these
    { t: 13000, type: 'recorder', on: false },
    { t: 20000, type: 'stop' },
  ]);
  const { form, attacks } = attacksFromTape(tape);
  assert.deepEqual(form, { grid: '| Dm7 | G7 |', timeSignature: [4, 4], tempo: 120, swing: true });
  assert.deepEqual(attacks.map(a => [a.notes, a.bar, Math.round(a.beat * 1000) / 1000, a.move]), [
    [v('F3 A3 C4'), 1, 1, false],
    [v('F3 B3'), 1, 4.666, false],
  ]);
});

test('attacksFromTape: a run that says straight eighths keeps it; a tape with no timed run gives null', () => {
  const straight = tapeOf([
    { t: 0, type: 'progression', grid: '| C7 |', timeSignature: [4, 4] },
    { t: 0, type: 'start', timed: true, tempo: 100, bar1At: 0, swing: false },
  ]);
  assert.equal(attacksFromTape(straight).form.swing, false);
  assert.equal(attacksFromTape(tapeOf([{ t: 0, type: 'start', timed: false }])), null);
});
