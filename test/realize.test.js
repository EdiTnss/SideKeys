import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { compareVoicings } from '../src/theory/voiceLeading.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { realize, BASS_REGISTER, BASS_REGISTERS, PART_VELOCITY } from '../src/theory/realize.js';
import { LOW_INTERVAL_LIMITS } from '../src/theory/analyzer.js';

const raw = (name, bar, beat, durationBeats) => ({ midi: nameToMidi(name), bar, beat, durationBeats, velocity: 80 });
const piece = (grid, melody = [], options = {}) => addMelody(createPiece({ key: 'C', grid, ...options }), melody);
const part = (result, name) => result.events.filter(event => event.part === name);
const lhAt = (result, beat) => part(result, 'lh').filter(event => event.beat === beat).map(event => event.midi);

test('ii-V-I: the bass plays each root once, in one octave under the left hand', () => {
  const result = realize(piece('| Dm7 | G7 | Cmaj7 |'));
  assert.deepEqual(BASS_REGISTERS, { low: [28, 39], middle: [33, 44], high: [40, 51] });
  assert.deepEqual(BASS_REGISTER, BASS_REGISTERS.high);                   // E2–D#3: E1 sounded muddy on the Genos
  assert.deepEqual(part(result, 'bass').map(e => [e.beat, e.duration, e.midi]), [[0, 4, 50], [4, 4, 43], [8, 4, 48]]);
  assert.equal(result.totalBeats, 12);
  assert.deepEqual(result.voicings.map(v => [v.bar, v.beat, v.symbol]), [[1, 1, 'Dm7'], [2, 1, 'G7'], [3, 1, 'Cmaj7']]);
  for (const event of part(result, 'lh')) assert.ok(event.midi >= 40, `left hand ${event.midi} under E2`);
});

test('every left-hand voicing is clean for its chord and moves smoothly from the one before', () => {
  const result = realize(piece('| Dm7 | G7 | Cmaj7 | A7alt | Dm7 | G7 | Cmaj7 | % |'));
  let previous = null;
  for (const voicing of result.voicings) {
    assert.ok(voicing.notes, `${voicing.symbol} got a voicing`);
    const analysis = analyzeVoicing(voicing.notes, parseChord(voicing.symbol));
    assert.deepEqual(analysis.messages.filter(m => m.level === 'warning'), [], voicing.symbol);
    assert.equal(analysis.voicing.type, voicing.type);
    if (previous) assert.notEqual(compareVoicings(previous, voicing.notes).rating, 'jumpy', `${voicing.symbol} after ${previous}`);
    previous = voicing.notes;
  }
  const beats = result.voicings.map((v, i) => i * 4);
  for (const [i, voicing] of result.voicings.entries()) assert.deepEqual(lhAt(result, beats[i]), voicing.notes);
});

test('two chords in a bar split it; a slash chord puts its bass note in the bass', () => {
  const split = realize(piece('| Dm7 G7 | Cmaj7 |'));
  assert.deepEqual(part(split, 'bass').map(e => [e.beat, e.duration, e.midi]), [[0, 2, 50], [2, 2, 43], [4, 4, 48]]);
  assert.ok(part(split, 'lh').filter(e => e.beat === 0).every(e => e.duration === 2));
  const slash = realize(piece('| C/E | F |'));
  assert.equal(part(slash, 'bass')[0].midi, 40);                         // E2, not C
  assert.equal(part(slash, 'bass')[1].midi, 41);                         // F2
});

test('the left hand always starts above the bass, never a muddy interval away, in every bass register', () => {
  const tune = piece('| Dm7 | G7 | Cmaj7 | A7alt | Dm7 | Db7 | Cmaj7 | Ebmaj7 |');
  const muddy = (low, high) => LOW_INTERVAL_LIMITS.some(limit => low < limit.below && limit.semitones.includes(high - low));
  for (const [name, bassRegister] of Object.entries(BASS_REGISTERS)) {
    const result = realize(tune, { bassRegister });
    const bass = part(result, 'bass');
    for (const [i, voicing] of result.voicings.entries()) {
      assert.ok(voicing.notes, `${name}: ${voicing.symbol} got a voicing`);
      const [lowest] = voicing.notes;
      assert.ok(lowest > bass[i].midi, `${name}: ${voicing.symbol} left hand ${lowest} over bass ${bass[i].midi}`);
      assert.ok(!muddy(bass[i].midi, lowest), `${name}: ${voicing.symbol} bass ${bass[i].midi} to ${lowest} is muddy`);
    }
  }
});

test('the left hand stays under the melody and avoids its notes when a voicing allows it', () => {
  const low = realize(piece('| Cmaj7 |', [raw('C4', 1, 1, 4)]));
  const [voicing] = low.voicings;
  assert.ok(voicing.notes.every(midi => midi < nameToMidi('C4')), `${voicing.notes} under C4`);
  assert.ok(voicing.notes.every(midi => midi % 12 !== 0), 'no C doubled under the melody C');
  assert.equal(voicing.doublesMelody, false);

  const high = realize(piece('| Cmaj7 |', [raw('D5', 1, 1, 4)]));
  assert.ok(high.voicings[0].notes.every(midi => midi % 12 !== 2), 'no D doubled under the melody D');
  assert.equal(high.voicings[0].doublesMelody, false);
});

test('when every voicing holds the melody note, it is doubled and said so; when none fits, the left hand rests', () => {
  const third = realize(piece('| Cmaj7 |', [raw('E4', 1, 1, 4)]));    // the 3rd is required: every voicing has E
  assert.ok(third.voicings[0].notes, 'a voicing is still chosen');
  assert.equal(third.voicings[0].doublesMelody, true);

  const buried = realize(piece('| Cmaj7 | Dm7 |', [raw('G2', 1, 1, 4)]));   // nothing fits between E2 and F#2
  assert.equal(buried.voicings[0].notes, null);
  assert.match(buried.voicings[0].reason, /melody/);
  assert.deepEqual(lhAt(buried, 0), []);
  assert.equal(part(buried, 'bass').length, 2);                          // the bass and the melody still play
  assert.equal(part(buried, 'melody').length, 1);
  assert.ok(buried.voicings[1].notes, 'the next chord gets its voicing again');
});

test('when one melody note cannot be avoided, the left hand still avoids the others', () => {
  // Over G7 the melody plays F and G. F is the required 7th, so every voicing doubles it; G is not needed.
  // The Dm7 before it matters: the voicing that moves least from there is G2 D3 F3 B3, with a G in it.
  const result = realize(piece('| Dm7 | G7 |', [raw('E4', 1, 1, 4), raw('F4', 2, 1, 2), raw('G4', 2, 3, 2)]));
  const voicing = result.voicings[1];
  assert.ok(voicing.notes.some(midi => midi % 12 === 5), 'F is in every G7 voicing');
  assert.ok(voicing.notes.every(midi => midi % 12 !== 7), `${voicing.notes}: no G under the melody G`);
  assert.equal(voicing.doublesMelody, true);
});

test('the melody plays as recorded, in beats from the first downbeat; events come sorted with a velocity per part', () => {
  const result = realize(piece('| Dm7 | G7 |', [raw('F4', 1, 1, 2), raw('A4', 2, 3, 2)]));
  assert.deepEqual(part(result, 'melody').map(e => [e.beat, e.duration, e.midi]), [[0, 2, 65], [6, 2, 69]]);
  const order = { bass: 0, lh: 1, melody: 2 };
  for (let i = 1; i < result.events.length; i++) {
    const [a, b] = [result.events[i - 1], result.events[i]];
    assert.ok(a.beat < b.beat || (a.beat === b.beat && order[a.part] <= order[b.part]), `event ${i} out of order`);
  }
  for (const event of result.events) assert.equal(event.velocity, PART_VELOCITY[event.part]);
});

test('registers and velocities can be changed; 3/4 counts three beats a bar', () => {
  const result = realize(piece('| Dm7 |'), { bassRegister: BASS_REGISTERS.low, velocity: { bass: 100, lh: 50, melody: 110 } });
  assert.equal(part(result, 'bass')[0].midi, 38);                         // D2
  assert.equal(part(result, 'bass')[0].velocity, 100);
  const waltz = realize(piece('| Fmaj7 | Gm7 C7 C7 |', [], { timeSignature: [3, 4] }));
  assert.equal(waltz.totalBeats, 6);
  assert.deepEqual(part(waltz, 'bass').map(e => [e.beat, e.duration]), [[0, 3], [3, 1], [4, 1], [5, 1]]);
});
