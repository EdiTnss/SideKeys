import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { createTape, keepMidi, verdictOf, replayTape, updateTape, formatReport, formatSession, TAPE_FORMAT } from '../src/ui/tape.js';

const v = names => names.split(' ').map(nameToMidi);
// A chord landing the way hands do: 10 ms between the notes.
const on = (t, notes) => notes.map((note, i) => ({ t: t + i * 10, type: 'midi', data: [0x90, note, 80] }));
const off = (t, notes) => notes.map(note => ({ t, type: 'midi', data: [0x80, note, 0] }));
const verdict = (notes, symbol) => verdictOf(analyzeVoicing(notes, parseChord(symbol)));
// What the app writes when a snapshot is captured: at the debounce, 300 ms after the last note.
const shot = (notes, startedAt, symbol, { slot = null, lastAt = startedAt + (notes.length - 1) * 10, ...extra } = {}) => ({
  t: lastAt + 300, type: 'snapshot', startedAt, notes, target: symbol ? { symbol, slot } : null, ...extra, verdict: symbol ? verdict(notes, symbol) : null,
});
const session = events => ({ format: TAPE_FORMAT, settings: { debounceMs: 300, nextNote: 28 }, events: events.flat(Infinity).sort((a, b) => a.t - b.t) });

const CMAJ7_A = v('E3 G3 B3 D4');       // rootless A
const DM7_A = v('F3 A3 C4 E4');
const G7_B = v('F3 A3 B3 E4');

test('only notes and the three pedals are kept; active sensing, clock and the other controllers are not', () => {
  assert.ok(keepMidi([0x90, 60, 80]) && keepMidi([0x8f, 60, 0]) && keepMidi([0x93, 60, 0]));
  assert.ok(keepMidi([0xb0, 64, 127]) && keepMidi([0xb2, 66, 0]) && keepMidi([0xb0, 67, 127]));
  assert.ok(!keepMidi([0xb0, 7, 100]) && !keepMidi([0xb0, 1, 3]));           // volume, modulation
  assert.ok(!keepMidi([0xfe]) && !keepMidi([0xf8]) && !keepMidi([0xc0, 5]));  // active sensing, clock, program change
});

test('a tape records MIDI and the app\'s events in milliseconds from its start, and saves as a session', () => {
  let now = 5000;
  const tape = createTape({ settings: { debounceMs: 300, nextNote: 28 }, now: () => now, date: () => new Date('2026-09-20T10:00:00Z') });
  tape.event('mode', { mode: 'drill' });
  now = 5100.123;
  tape.midi(new Uint8Array([0x90, 60, 80]));
  now = 5500;
  tape.event('snapshot', { startedAt: tape.at(5100.123), notes: [60, 64] });
  assert.deepEqual(tape.toJSON(), {
    format: TAPE_FORMAT,
    app: 'voicing-lab',
    savedAt: '2026-09-20T10:00:00.000Z',
    settings: { debounceMs: 300, nextNote: 28 },
    events: [
      { t: 0, type: 'mode', mode: 'drill' },
      { t: 100.12, type: 'midi', data: [0x90, 60, 80] },
      { t: 500, type: 'snapshot', startedAt: 100.12, notes: [60, 64] },
    ],
  });
});

test('the tape keeps the last window only, and what was in force before it stays at the front', () => {
  let now = 0;
  const tape = createTape({ settings: { debounceMs: 300, nextNote: 28 }, now: () => now, windowMs: 1000 });
  tape.event('mode', { mode: 'drill' });
  tape.event('chord', { symbol: 'Cmaj7', slot: null });
  tape.event('settings', { debounceMs: 250, nextNote: 28 });
  now = 10;
  tape.midi([0x90, 60, 80]);
  now = 1500;
  tape.event('chord', { symbol: 'Dm7', slot: null });
  now = 1600;
  tape.midi([0x90, 62, 80]);
  now = 2200;                                              // the chord at 1500 pushed out everything before 500
  tape.midi([0x80, 62, 0]);
  const saved = tape.toJSON();
  assert.deepEqual(saved.settings, { debounceMs: 250, nextNote: 28 });
  assert.deepEqual(saved.events.map(event => [event.t, event.type, event.mode ?? event.symbol ?? event.data?.[1]]), [
    [1500, 'mode', 'drill'],                               // the context, dated at the first event kept
    [1500, 'chord', 'Cmaj7'],
    [1500, 'chord', 'Dm7'],
    [1600, 'midi', 62],
    [2200, 'midi', 62],
  ]);
});

test('a verdict is the analysis reduced to what the replay compares', () => {
  assert.deepEqual(verdict(CMAJ7_A, 'Cmaj7'), { type: 'rootless-A', bass: null, missing: [], wrong: [], avoid: [], muddy: [], doublings: [] });
  const wrong = verdict(v('E3 F3 B3 D4'), 'Cmaj7');
  assert.deepEqual(wrong.avoid, [5]);
  assert.deepEqual(wrong.missing, []);
});

test('replaying a drill session gives back every snapshot and every verdict, "next" and all', () => {
  const recorded = session([
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Cmaj7', slot: null },
    on(1000, CMAJ7_A), shot(CMAJ7_A, 1000, 'Cmaj7'), off(1800, CMAJ7_A),
    on(2000, [nameToMidi('E1')]),                          // the "next" note: never part of a chord
    { t: 2000.5, type: 'chord', symbol: 'Dm7', slot: null },
    on(2500, DM7_A), shot(DM7_A, 2500, 'Dm7'), off(3500, DM7_A),
  ]);
  const result = replayTape(recorded);
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, { same: 2, changed: 0, missing: 0, extra: 0 });
  assert.deepEqual(result.snapshots.map(s => [s.status, s.now.target.symbol, s.now.verdict.type]), [['same', 'Cmaj7', 'rootless-A'], ['same', 'Dm7', 'rootless-A']]);
});

test('a verdict that is not what it was, a snapshot that no longer comes and one that is new are all reported', () => {
  const played = [
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Cmaj7', slot: null },
    on(1000, CMAJ7_A), off(1800, CMAJ7_A),
    on(2000, DM7_A), off(2800, DM7_A),
  ];
  const then = { ...shot(CMAJ7_A, 1000, 'Cmaj7'), verdict: { ...verdict(CMAJ7_A, 'Cmaj7'), type: 'rootless-B' } };  // what an older analyzer said
  const ghost = shot(v('C3 E3 G3'), 1400, 'Cmaj7');                                                                  // never played
  const result = replayTape(session([played, then, ghost]));
  assert.equal(result.ok, false);
  assert.deepEqual(result.counts, { same: 0, changed: 1, missing: 1, extra: 1 });
  assert.deepEqual(result.snapshots.map(s => s.status), ['changed', 'missing', 'extra']);
  const [changed, missing, extra] = result.snapshots;
  assert.equal(changed.then.verdict.type, 'rootless-B');
  assert.equal(changed.now.verdict.type, 'rootless-A');
  assert.deepEqual(missing.notes, v('C3 E3 G3'));
  assert.deepEqual(extra.notes, DM7_A);
  assert.deepEqual(extra.now.target, { symbol: 'Cmaj7', slot: null });              // Dm7 notes played on the Cmaj7 screen

  const report = formatReport('drill.json', result);
  assert.match(report, /drill\.json\s+3 snapshots: 0 same, 1 changed, 1 missing, 1 extra/);
  assert.match(report, /then rootless-B/);
  assert.match(report, /now rootless-A/);

  // Accepting the replay as the new reference makes it pass.
  assert.equal(replayTape(updateTape(session([played, then, ghost]), result)).ok, true);
});

test('as live, a chord change drops the snapshot still waiting, and notes played while recording a melody never reach the capture', () => {
  const result = replayTape(session([
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Cmaj7', slot: null },
    on(1000, CMAJ7_A),
    { t: 1100, type: 'chord', symbol: 'Dm7', slot: null },  // Space pressed 70 ms after the last note
    off(1500, CMAJ7_A),
    { t: 2000, type: 'recorder', on: true },
    on(2100, DM7_A), off(2600, DM7_A),
    { t: 3000, type: 'recorder', on: false },
  ]));
  assert.deepEqual(result.counts, { same: 0, changed: 0, missing: 0, extra: 0 });
  assert.equal(result.ok, true);
});

test('a timed progression: the slot comes from where the voicing started on the metronome\'s grid', () => {
  const progression = [
    { t: 0, type: 'mode', mode: 'progression' },
    { t: 0, type: 'progression', grid: '| Dm7 | G7 | Cmaj7 |', timeSignature: [4, 4], loop: false },
    { t: 0, type: 'chord', symbol: 'Dm7', slot: 0 },
    { t: 500, type: 'start', timed: true, tempo: 120, bar1At: 1000 },   // bar 1 at 1000 ms, a beat every 500 ms
  ];
  const result = replayTape(session([
    progression,
    { t: 3000, type: 'chord', symbol: 'G7', slot: 1 },                    // the screen follows the metronome
    { t: 5000, type: 'chord', symbol: 'Cmaj7', slot: 2 },
    on(1500, DM7_A), shot(DM7_A, 1500, 'Dm7', { slot: 0 }), off(2500, DM7_A),        // bar 1, beat 2
    on(3480, G7_B), shot(G7_B, 3480, 'G7', { slot: 1 }), off(4500, G7_B),            // bar 2, beat 1.96
    on(5000.5, CMAJ7_A), shot(CMAJ7_A, 5000.5, 'Cmaj7', { slot: 2 }), off(6000, CMAJ7_A),
  ]));
  assert.equal(result.ok, true, formatReport('timed', result));
  assert.deepEqual(result.snapshots.map(s => s.now.target), [{ symbol: 'Dm7', slot: 0 }, { symbol: 'G7', slot: 1 }, { symbol: 'Cmaj7', slot: 2 }]);

  // The page's clock drifts against the metronome's by a few ms over minutes, so a recorded
  // position wins over the one computed from bar1At (here 2995 ms computes to bar 1, beat 4.99).
  const drifted = replayTape(session([progression, on(2995, G7_B), shot(G7_B, 2995, 'G7', { slot: 1, position: { bar: 2, beat: 1.01 } }), off(3600, G7_B)]));
  assert.equal(drifted.ok, true, formatReport('drifted', drifted));
  assert.deepEqual(drifted.snapshots[0].now.target, { symbol: 'G7', slot: 1 });
});

test('a free progression: the slot under the cursor, once the pass has started', () => {
  const result = replayTape(session([
    { t: 0, type: 'mode', mode: 'progression' },
    { t: 0, type: 'progression', grid: '| Dm7 | G7 | Cmaj7 |', timeSignature: [4, 4], loop: true },
    { t: 0, type: 'chord', symbol: 'Dm7', slot: 0 },
    on(200, DM7_A), shot(DM7_A, 200, null), off(900, DM7_A),                  // not started: no answer
    { t: 1000, type: 'start', timed: false },
    { t: 1000, type: 'chord', symbol: 'Dm7', slot: 0 },
    on(1200, DM7_A), shot(DM7_A, 1200, 'Dm7', { slot: 0 }), off(1900, DM7_A),
    { t: 2000, type: 'chord', symbol: 'G7', slot: 1 },
    on(2200, G7_B), shot(G7_B, 2200, 'G7', { slot: 1 }), off(2900, G7_B),
    { t: 3000, type: 'stop' },
  ]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshots.map(s => s.now.target?.symbol ?? null), [null, 'Dm7', 'G7']);
});

test('a debounce timer that fired late live is replayed as it happened, not as it should have', () => {
  // The next chord starts 310 ms after the last note: an exact timer fires at 300, a busy page fires later.
  const live = [
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Cmaj7', slot: null },
    on(1000, CMAJ7_A),                                    // last note at 1030, due at 1330
    on(1340, v('C3 A3')),                                 // added while the chord is held
  ];
  const merged = [...CMAJ7_A, ...v('C3 A3')].sort((a, b) => a - b);
  // Late live: the new notes arrived before the timer ran, so everything became one snapshot.
  const late = replayTape(session([live, shot(merged, 1000, 'Cmaj7', { lastAt: 1350 })]));
  assert.equal(late.ok, true, formatReport('late', late));
  // On time live: the recording shows the snapshot at 1332, so the replay fires it there.
  const onTime = replayTape(session([live, { ...shot(CMAJ7_A, 1000, 'Cmaj7'), t: 1332 }, shot(merged, 1340, 'Cmaj7', { lastAt: 1350 })]));
  assert.equal(onTime.ok, true, formatReport('on time', onTime));
  assert.equal(onTime.snapshots[0].t, 1332);
});

test('a saved session is JSON with one event per line, and reads back as it was', () => {
  const saved = session([{ t: 0, type: 'mode', mode: 'drill' }, on(1000, CMAJ7_A), shot(CMAJ7_A, 1000, 'Cmaj7')]);
  const text = formatSession(saved);
  assert.deepEqual(JSON.parse(text), saved);
  assert.equal(text.split('\n').filter(line => line.startsWith('    {')).length, saved.events.length);
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(formatSession({ ...saved, events: [] })).events, []);
});

test('a change to the capture\'s timing beyond a late timer is caught: a rolled chord split by a shorter debounce', () => {
  const rolled = v('D3 A3 C4 F4');
  const played = [
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Dm7', slot: null },
    rolled.map((note, i) => ({ t: 1000 + i * 60, type: 'midi', data: [0x90, note, 80] })),   // 60 ms apart
    off(2000, rolled),
  ];
  const live = session([played, shot(rolled, 1000, 'Dm7', { lastAt: 1180 })]);
  assert.equal(replayTape(live).ok, true);
  const shorter = replayTape({ ...live, settings: { ...live.settings, debounceMs: 30 } });
  assert.equal(shorter.ok, false);
  assert.equal(shorter.counts.missing, 1);
  assert.ok(shorter.counts.extra >= 1);
});

test('a slow roll: the live timer fired on the first note alone (no snapshot), and the snapshot that follows starts on the second', () => {
  // From a real session: Ebm7 rolled with 321, 217 and 214 ms between the notes.
  const [eb, gb, bb, db] = v('Eb3 Gb3 Bb3 Db4');
  const events = [
    { t: 0, type: 'mode', mode: 'drill' },
    { t: 0, type: 'chord', symbol: 'Ebm7', slot: null },
    { t: 1000, type: 'midi', data: [0x90, eb, 39] },        // due at 1300: fired live with one note, so nothing
    { t: 1321, type: 'midi', data: [0x90, gb, 45] },        // 21 ms past due, inside the late window
    { t: 1538, type: 'midi', data: [0x90, bb, 33] },
    { t: 1752, type: 'midi', data: [0x90, db, 43] },
    shot([eb, gb, bb, db], 1321, 'Ebm7', { lastAt: 1752 }), // starts on Gb3: the evidence
  ];
  const result = replayTape(session(events));
  assert.equal(result.ok, true, formatReport('slow roll', result));
  assert.equal(result.snapshots[0].startedAt, 1321);
});
