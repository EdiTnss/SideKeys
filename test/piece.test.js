import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPiece, addMelody, structuralMelody, toJSON, fromJSON, savePiece, loadPiece, listPieces, deletePiece } from '../src/theory/piece.js';

const fakeStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
};
const raw = (midi, bar, beat, durationBeats, velocity = 80) => ({ midi, bar, beat, durationBeats, velocity });
const melodyOf = (piece, bar) => piece.bars[bar - 1].melody.map(n => [n.midi, n.beat, n.duration, n.structural]);

test('createPiece: bars from the grid, empty melody, sensible defaults', () => {
  const piece = createPiece({ grid: '| Dm7 G7 | Cmaj7 | % |' });
  assert.equal(piece.title, 'Untitled');
  assert.equal(piece.key, 'C');
  assert.deepEqual(piece.timeSignature, [4, 4]);
  assert.equal(piece.tempo, 120);
  assert.equal(piece.bars.length, 3);
  assert.deepEqual(piece.bars[0].chords, [{ symbol: 'Dm7', beat: 1 }, { symbol: 'G7', beat: 3 }]);
  assert.deepEqual(piece.bars.map(b => b.melody), [[], [], []]);
  assert.deepEqual(piece.raw, []);
  const waltz = createPiece({ title: 'Waltz', key: 'F', timeSignature: [3, 4], tempo: 96, grid: '| Fmaj7 | Gm7 C7 D7 |' });
  assert.equal(waltz.bars[1].chords[2].beat, 3);
});

test('addMelody: notes land on bars, quantized to eighths, strong beats and held notes are structural', () => {
  const piece = addMelody(createPiece({ grid: '| Dm7 G7 | Cmaj7 |' }), [
    raw(65, 1, 1.1, 1.9),        // F4 on beat 1, held two beats
    raw(67, 1, 3.05, 0.95),      // G4 on beat 3
    raw(69, 2, 1, 4),            // A4 whole bar
  ]);
  assert.deepEqual(melodyOf(piece, 1), [[65, 1, 2, true], [67, 3, 1, true]]);
  assert.deepEqual(melodyOf(piece, 2), [[69, 1, 4, true]]);
  assert.equal(piece.raw.length, 3);
  assert.deepEqual(createPiece({ grid: '| C |' }).bars[0].melody, []);           // untouched input
});

test('addMelody: passing notes, held weak-beat notes, and ornaments', () => {
  const piece = addMelody(createPiece({ grid: '| Dm7 | G7 |' }), [
    raw(66, 1, 2.4, 0.4),        // F#4 on the "and" of 2, short → passing
    raw(64, 1, 4, 1),            // E4 on beat 4, held a whole beat → structural
    raw(62, 2, 1.02, 0.05),      // 25 ms at 120 bpm → stays in raw only
    raw(60, 2, 1.4, 0.3),        // 150 ms, shorter than an eighth → in the melody, never structural
    raw(59, 2, 3, 0.5),          // B3 on beat 3, an eighth → structural (strong beat)
  ]);
  assert.deepEqual(melodyOf(piece, 1), [[66, 2.5, 0.5, false], [64, 4, 1, true]]);
  assert.deepEqual(melodyOf(piece, 2), [[60, 1.5, 0.5, false], [59, 3, 0.5, true]]);
  assert.equal(piece.raw.length, 5);
});

test('addMelody: a note ends where the next one starts, count-in notes are ignored, overflow is dropped', () => {
  const piece = addMelody(createPiece({ grid: '| Dm7 | G7 |' }), [
    raw(72, 0, 3, 1),            // count-in
    raw(65, 1, 1, 3),            // held into the next note
    raw(67, 1, 2, 1),
    raw(69, 2, 4.9, 1),          // rounds to bar 3 beat 1: past the end
    raw(71, 3, 1, 1),            // past the end
  ]);
  assert.deepEqual(melodyOf(piece, 1), [[65, 1, 1, true], [67, 2, 1, true]]);
  assert.deepEqual(melodyOf(piece, 2), []);
  assert.equal(piece.raw.length, 5);                     // everything stays in raw
});

test('3/4: only beat 1 is a strong beat; structuralMelody flattens the target notes', () => {
  const piece = addMelody(createPiece({ timeSignature: [3, 4], tempo: 90, grid: '| Fmaj7 | Gm7 |' }), [
    raw(69, 1, 1, 0.5),          // beat 1 → structural
    raw(67, 1, 3, 0.5),          // beat 3 in 3/4, short → passing
    raw(65, 2, 2, 1.5),          // held ≥ 1 beat → structural
  ]);
  assert.deepEqual(structuralMelody(piece), [
    { bar: 1, midi: 69, beat: 1, duration: 0.5 },
    { bar: 2, midi: 65, beat: 2, duration: 1.5 },
  ]);
});

test('JSON round trip; fromJSON rejects broken input', () => {
  const piece = addMelody(createPiece({ title: 'Test', key: 'Bb', grid: '| Cm7 F7 | Bbmaj7 |' }), [raw(70, 1, 1, 2)]);
  const back = fromJSON(toJSON(piece));
  assert.deepEqual(back, piece);
  assert.throws(() => fromJSON('{"bars": "nope"}'), /piece/i);
  assert.throws(() => fromJSON(JSON.stringify({ ...piece, bars: [{ chords: [{ symbol: 'H7', beat: 1 }], melody: [] }] })), /H7/);
});

test('pieces are saved by title in storage and survive a missing or broken store', () => {
  const storage = fakeStorage();
  const piece = createPiece({ title: 'Blues in F', key: 'F', grid: '| F7 | Bb7 |' });
  assert.equal(savePiece(piece, storage), true);
  assert.deepEqual(listPieces(storage), ['Blues in F']);
  assert.deepEqual(loadPiece('Blues in F', storage), piece);
  assert.equal(loadPiece('nope', storage), null);
  savePiece(createPiece({ title: 'Another', grid: '| C |' }), storage);
  assert.deepEqual(listPieces(storage), ['Another', 'Blues in F']);
  assert.equal(deletePiece('Another', storage), true);
  assert.deepEqual(listPieces(storage), ['Blues in F']);
  storage.setItem('voicing-lab.pieces', '{broken');
  assert.deepEqual(listPieces(storage), []);
  assert.equal(savePiece(piece, undefined), false);
  assert.deepEqual(listPieces(undefined), []);
});
