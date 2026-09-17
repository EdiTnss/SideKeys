import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { analyzePiece } from '../src/theory/analysis.js';
import { generateCandidates, TECHNIQUES } from '../src/theory/candidates.js';

const raw = (name, bar, beat, durationBeats) => ({ midi: nameToMidi(name), bar, beat, durationBeats, velocity: 80 });
const analyzed = (grid, melody = [], options = {}) => analyzePiece(addMelody(createPiece({ key: 'C', grid, ...options }), melody));
// Labeling tests look at the full list; the 12-per-slot limit has its own test.
const candidates = (grid, melody, options, slotIndex = 0) => generateCandidates(analyzed(grid, melody), { maxPerSlot: 60, ...options }).slots[slotIndex].candidates;
const symbolsOf = candidate => candidate.chords.map(c => c.symbol).join(' ');
const find = (list, technique, symbols) => list.find(c => c.technique === technique && (symbols === undefined || symbolsOf(c) === symbols));

test('the original comes first, ids are unique, at most 12 per slot, chords carry bar and beat', () => {
  const result = generateCandidates(analyzed('| Dm7 | G7 | Cmaj7 |'));
  assert.equal(result.slots.length, 3);
  for (const slot of result.slots) {
    assert.equal(slot.candidates[0].technique, 'original');
    assert.equal(symbolsOf(slot.candidates[0]), slot.original);
    assert.ok(slot.candidates.length <= 12, `${slot.candidates.length} candidates`);
    assert.equal(new Set(slot.candidates.map(c => c.id)).size, slot.candidates.length);
    for (const candidate of slot.candidates) {
      for (const chord of candidate.chords) assert.ok(Number.isInteger(chord.bar) && chord.beat >= 1, JSON.stringify(chord));
    }
  }
  assert.equal(result.slots[1].candidates[0].id, 'b2s1-orig');
  assert.ok(generateCandidates(analyzed('| Dm7 | G7 | Cmaj7 |'), { maxPerSlot: 3 }).slots.every(s => s.candidates.length <= 3));
});

test('tritone substitution: Db7 for G7, unless the melody makes it a wrong note', () => {
  const withD = candidates('| Dm7 | G7 | Cmaj7 |', [raw('D4', 2, 1, 4)], {}, 1);
  const sub = find(withD, 'tritone-sub', 'Db7');
  assert.ok(sub, 'Db7 expected');
  assert.equal(sub.bassStepToNext, 1);
  assert.deepEqual(sub.warnings, []);
  const withC = candidates('| Dm7 | G7 | Cmaj7 |', [raw('C4', 2, 1, 4)], {}, 1);
  assert.equal(find(withC, 'tritone-sub', 'Db7'), undefined);            // C is the major 7th of Db7
  assert.deepEqual(withC[0].warnings.map(w => w.degree), ['11']);         // the original G7 stays, C flagged as avoid
});

test('secondary dominant: D7 before G7; a dominant that does not resolve is not one', () => {
  const list = candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 0);
  assert.ok(find(list, 'secondary-dominant', 'D7'));
  assert.equal(find(list, 'secondary-dominant', 'E7'), undefined);
  const onG7 = candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 1);
  assert.ok(find(onG7, 'quality-change', 'G7alt'));                       // same root, dominant already: a quality change
  assert.equal(find(onG7, 'secondary-dominant', 'G7alt'), undefined);
});

test('related ii: the slot splits in two halves, each checked with its own melody', () => {
  const list = candidates('| Dm7 | G7 | Cmaj7 |', [raw('E4', 2, 1, 2), raw('F4', 2, 3, 2)], {}, 1);
  const ii = find(list, 'related-ii');
  assert.ok(ii, 'related ii expected');
  assert.deepEqual(ii.chords.map(c => [c.symbol, c.bar, c.beat]), [['Dm7', 2, 1], ['G7', 2, 3]]);
  const bb = candidates('| Dm7 | G7 | Cmaj7 |', [raw('Bb4', 2, 1, 2)], {}, 1);
  assert.equal(find(bb, 'related-ii'), undefined);                        // Bb is not in Dm7
  const short = candidates('| Dm7 G7 Cmaj7 A7 | Dm7 |', [], {}, 1);
  assert.equal(find(short, 'related-ii'), undefined);                     // a one-beat slot cannot split
});

test('backdoor: bVII7 only before the tonic', () => {
  assert.ok(find(candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 1), 'backdoor', 'Bb7'));
  assert.equal(find(candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 0), 'backdoor'), undefined);
});

test('passing diminished: between two chords a whole step apart, spelled in the direction of travel', () => {
  const up = candidates('| Cmaj7 | Am7 | Dm7 |', [], {}, 1);
  assert.ok(find(up, 'diminished-passing', 'C#°'));
  const down = candidates('| Dm7 | Am7 | Cmaj7 |', [], {}, 1);
  assert.ok(find(down, 'diminished-passing', 'Db°'));
  assert.equal(find(candidates('| Cmaj7 | Am7 | Em7 |', [], {}, 1), 'diminished-passing'), undefined);
});

test('chromatic approach: a dominant or m7 a half step from the next chord', () => {
  const list = candidates('| Dm7 | Am7 | Em7 |', [], {}, 1);
  assert.ok(find(list, 'chromatic-approach', 'F7'));
  assert.ok(find(list, 'chromatic-approach', 'Fm7'));
  assert.equal(find(candidates('| Dm7 | Am7 | Gmaj7 |', [], {}, 1), 'chromatic-approach', 'F7'), undefined);
  assert.equal(find(candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 1), 'chromatic-approach', 'Db7'), undefined);   // that one is the tritone sub
});

test('modal interchange: iv, bVI, bIII, iiø from the parallel minor; diatonic chords are not borrowed', () => {
  const list = candidates('| Cmaj7 | Fmaj7 | Cmaj7 |', [], {}, 1);
  assert.ok(find(list, 'modal-interchange', 'Fm7'));
  assert.ok(find(list, 'modal-interchange', 'Abmaj7'));
  assert.equal(find(list, 'modal-interchange', 'Dm7'), undefined);
  const everything = candidates('| Cmaj7 | Fmaj7 | Cmaj7 |', [], { intensity: 'heavy', style: 'free', maxPerSlot: 1000 }, 1);
  assert.equal(everything.find(c => symbolsOf(c) === 'Dm7')?.technique, 'other');   // diatonic, no label
});

test('sus color: 7sus4 for a dominant only', () => {
  assert.ok(find(candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 1), 'sus-color', 'G7sus4'));
  const onMaj = candidates('| Dm7 | G7 | Cmaj7 |', [], {}, 2);
  assert.equal(find(onMaj, 'sus-color'), undefined);
  assert.equal(onMaj.find(c => symbolsOf(c) === 'C7sus4')?.technique, 'quality-change');
});

test('Coltrane cycle: two slots of major thirds into the target, or nothing when the melody objects', () => {
  const list = candidates('| Dm7 | G7 | Cmaj7 |', [], { style: 'coltrane' }, 0);
  const cycle = find(list, 'coltrane');
  assert.ok(cycle, 'coltrane expected');
  assert.equal(cycle.spans, 2);
  assert.deepEqual(cycle.chords.map(c => [c.symbol, c.bar, c.beat]), [['Abmaj7', 1, 1], ['B7', 1, 3], ['Emaj7', 2, 1], ['G7', 2, 3]]);
  assert.equal(list[1].technique, 'coltrane');                             // the style puts it first after the original
  const objecting = candidates('| Dm7 | G7 | Cmaj7 |', [raw('F4', 2, 1, 2)], { style: 'coltrane' }, 0);
  assert.equal(find(objecting, 'coltrane'), undefined);                    // F is the b9 of Emaj7
  assert.equal(find(candidates('| Dm7 | G7 |', [], { style: 'coltrane' }, 0), 'coltrane'), undefined);   // no target
});

test('intensity filters, style orders, other only in free/heavy', () => {
  const light = candidates('| Dm7 | G7 | Cmaj7 |', [], { intensity: 'light' }, 1);
  assert.ok(light.every(c => ['original', 'tritone-sub', 'related-ii', 'quality-change'].includes(c.technique)));
  const medium = candidates('| Dm7 | G7 | Cmaj7 |', [], { intensity: 'medium' }, 1);
  assert.ok(medium.every(c => c.technique !== 'other'));
  const heavyFree = candidates('| Dm7 | G7 | Cmaj7 |', [], { intensity: 'heavy', style: 'free', maxPerSlot: 40 }, 1);
  assert.ok(heavyFree.some(c => c.technique === 'other'));
  const heavyTritone = candidates('| Dm7 | G7 | Cmaj7 |', [], { intensity: 'heavy', style: 'tritone', maxPerSlot: 40 }, 1);
  assert.ok(heavyTritone.every(c => c.technique !== 'other'));
  assert.equal(candidates('| Dm7 | G7 | Cmaj7 |', [], { style: 'tritone' }, 1)[1].technique, 'tritone-sub');
  assert.equal(candidates('| Cmaj7 | Fmaj7 | Cmaj7 |', [], { style: 'modal' }, 1)[1].technique, 'modal-interchange');
  assert.ok(TECHNIQUES.includes('coltrane') && TECHNIQUES[0] === 'original');
});
