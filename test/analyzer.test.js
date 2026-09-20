import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';

// 'C4 E4 G4' → analysis against the parsed chord. MIDI 60 = C4.
const analyze = (symbol, notes, options) =>
  analyzeVoicing(notes.split(' ').map(nameToMidi), parseChord(symbol), options);
const type = (symbol, notes) => analyze(symbol, notes).voicing.type;

test('a missing required note is the main warning', () => {
  const a = analyze('Cmaj7', 'C4 E4 G4');
  assert.deepEqual(a.missing, [11]);                          // B, the 7th
  assert.equal(a.messages[0].level, 'warning');
  assert.equal(a.messages[0].code, 'missing');
  assert.match(a.messages[0].text, /7/);
});

test('a missing root is information, not a warning', () => {
  const a = analyze('Cmaj7', 'E4 G4 B4 D5');
  assert.deepEqual(a.missing, []);
  assert.equal(a.hasRoot, false);
  assert.ok(a.messages.every(m => m.level !== 'warning'));
  assert.ok(a.messages.some(m => m.code === 'rootless'));
});

test('wrong, avoid and caution notes are reported by pitch class', () => {
  assert.deepEqual(analyze('Cmaj7', 'C4 E4 G4 Bb4').wrong, [10]);
  assert.deepEqual(analyze('Cmaj7', 'C4 E4 G4 B4 F5').avoid, [5]);
  assert.deepEqual(analyze('Dm7', 'D3 F3 C4 B4').caution, [11]);   // 13 on a ii chord
  const roles = analyze('G7', 'B3 F4 A4').roles;
  assert.deepEqual(roles.map(r => r.role), ['chordTone', 'chordTone', 'tension']);
  assert.deepEqual(roles.map(r => r.degree), ['3', 'b7', '9']);
});

test('low interval limits compare the lower note of each pair with the threshold', () => {
  assert.deepEqual(analyze('Cmaj7', 'C2 E2').muddy, [{ lower: 36, upper: 40, semitones: 4 }]);
  assert.equal(analyze('Cmaj7', 'E2 G2').muddy.length, 1);      // m3 under C3
  assert.deepEqual(analyze('Cmaj7', 'C3 D3').muddy, []);         // C3 itself is not below C3
  assert.deepEqual(analyze('Cmaj7', 'G2 B2').muddy, []);         // G2 itself is not below G2
  assert.deepEqual(analyze('Cmaj7', 'C2 E2', { limits: [] }).muddy, []);
  const custom = [{ below: 60, semitones: [7] }];
  assert.equal(analyze('Cmaj7', 'C3 G3', { limits: custom }).muddy.length, 1);
  // Spelled from the chord, like every other note in the report.
  const muddy = analyze('F#7', 'F#1 G#1').messages.find(m => m.code === 'muddy');
  assert.match(muddy.text, /F#1–G#1 \(M2\)/);
});

test('doublings: the same pitch class twice, except root or 5 in the bass', () => {
  assert.deepEqual(analyze('Cmaj7', 'C3 E3 G3 C4 E4').doublings, [4]);
  assert.deepEqual(analyze('Cmaj7', 'G2 E3 G3 B3').doublings, []);     // 5 in the bass
  assert.deepEqual(analyze('Cmaj7', 'E3 G3 B3 E4').doublings, [4]);    // 3 in the bass is not exempt
});

test('shell: only the guide tones, with or without the root', () => {
  assert.equal(type('Cmaj7', 'E3 B3'), 'shell');
  assert.equal(type('Cmaj7', 'C3 E3 B3'), 'shell');
  assert.equal(type('G7', 'F3 B3'), 'shell');
  assert.notEqual(type('Cmaj7', 'E3 G3 B3'), 'shell');
});

test('rootless A: 3-5-7-9 from the bottom, altered slots allowed on dominants', () => {
  assert.equal(type('Dm7', 'F3 A3 C4 E4'), 'rootless-A');
  assert.equal(type('G7', 'B3 E4 F4 A4'), 'rootless-A');       // 3-13-7-9
  assert.equal(type('G7alt', 'B3 Eb4 F4 Ab4'), 'rootless-A');  // 3-b13-7-b9
  assert.notEqual(type('Dm7', 'F3 A3 C4 D4'), 'rootless-A');
});

test('rootless B: 7-9-3-5 from the bottom', () => {
  assert.equal(type('Dm7', 'C4 E4 F4 A4'), 'rootless-B');
  assert.equal(type('G7', 'F3 A3 B3 E4'), 'rootless-B');       // 7-9-3-13
  assert.notEqual(type('Dm7', 'C4 D4 F4 A4'), 'rootless-B');
});

test('drop 2, drop 3 and drop 2&4: raising the lowest note(s) gives close position', () => {
  assert.equal(type('Cmaj7', 'G3 C4 E4 B4'), 'drop-2');
  assert.equal(type('Cmaj7', 'E3 C4 G4 B4'), 'drop-3');
  assert.equal(type('Cmaj7', 'C3 G3 E4 B4'), 'drop-2-4');
  assert.equal(type('Cmaj7', 'C4 E4 G4 B4'), 'close');
  assert.equal(type('Cmaj7', 'C3 B3 E4 G4'), 'drop-3');        // drop 3 of the third inversion
});

test('quartal: stacked fourths, one major third tolerated from four notes up', () => {
  assert.equal(type('Dm7', 'D3 G3 C4 F4'), 'quartal');
  assert.equal(type('Dm7', 'D3 G3 C4 F4 A4'), 'quartal');      // "So What"
  assert.notEqual(type('Dm7', 'D3 G3 B3'), 'quartal');          // a G/D triad
  assert.notEqual(type('Dm7', 'D3 F3 A3 C4'), 'quartal');
});

// The third is the So What cap, so it belongs on top; two augmented fourths in a row span an
// octave exactly, which doubles the outer note and is no longer a quartal voicing (Edi, 2026-09-20).
test('quartal: the major third only on top, and at most one augmented fourth', () => {
  assert.equal(type('D7sus4', 'E3 A3 D4 F#4'), 'quartal');      // 5,5,4 — the third caps it
  assert.equal(type('C7#11', 'C3 F#3 B3 E4'), 'quartal');       // 6,5,5 — one augmented fourth
  assert.equal(type('Em7', 'D3 G3 B3 E4'), 'drop-2');           // 5,4,5 — the third in the middle
  assert.equal(type('Am7', 'C3 E3 A3 D4'), 'drop-2');           // 4,5,5 — the third at the bottom
  assert.notEqual(type('C7', 'C3 E3 Bb3 E4'), 'quartal');       // 4,6,6
  assert.notEqual(type('G7', 'F3 B3 F4 B4'), 'quartal');        // 6,6,6 — stacked tritones
  assert.notEqual(type('Dm7', 'D3 G3 B3'), 'quartal');          // 5,4 — still a triad, three notes
});

test('upper structure triad: a foreign triad on top of the 3 and 7 of a dominant', () => {
  const a = analyze('G7', 'B3 F4 A4 C#5 E5');
  assert.equal(a.voicing.type, 'upper-structure');
  assert.equal(a.voicing.detail, 'A');
  assert.equal(analyze('C7', 'E3 Bb3 Db4 F4 Ab4').voicing.detail, 'Db');   // Db major = b9 #11 b13
  assert.notEqual(type('G7', 'B3 F4 G4 B4 D5'), 'upper-structure');       // the triad is G itself
  assert.notEqual(type('Cmaj7', 'E3 B3 D4 F#4 A4'), 'upper-structure');   // not a dominant
});

test('close and spread', () => {
  assert.equal(type('Cmaj7', 'C4 E4 G4 B4'), 'close');
  assert.equal(type('Cmaj7', 'C3 E4 B4 D5'), 'spread');
});

test('a root or 5 in the bass under a recognized voicing is reported separately', () => {
  assert.deepEqual(analyze('Cmaj7', 'C2 E4 G4 B4 D5').voicing, { type: 'rootless-A', bass: 'root', detail: null });
  assert.deepEqual(analyze('G7', 'D2 F3 A3 B3 E4').voicing, { type: 'rootless-B', bass: '5', detail: null });
  assert.deepEqual(analyze('Cmaj7', 'C4 E4 G4 B4').voicing, { type: 'close', bass: null, detail: null });
});

test('messages follow the importance order: required, wrong notes, muddy intervals, type', () => {
  const a = analyze('Cmaj7', 'C2 D2 E4 Bb4');
  assert.deepEqual(a.messages.map(m => m.code), ['missing', 'wrong', 'muddy', 'type']);
  assert.deepEqual(a.messages.map(m => m.level), ['warning', 'warning', 'warning', 'info']);
});
