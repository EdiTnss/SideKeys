import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pitchClass, midiToName, nameToMidi, spellDegree } from '../src/theory/notes.js';

test('pitchClass: C is 0 in every octave, other notes count semitones up from C', () => {
  for (let midi = 0; midi <= 120; midi += 12) {
    assert.equal(pitchClass(midi), 0, `midi ${midi}`);
  }
  assert.equal(pitchClass(61), 1);
  assert.equal(pitchClass(71), 11);
});

test('midiToName: 60 is C4, flats by default, sharps on request', () => {
  assert.equal(midiToName(60), 'C4');
  assert.equal(midiToName(0), 'C-1');
  assert.equal(midiToName(21), 'A0');
  assert.equal(midiToName(108), 'C8');
  assert.equal(midiToName(61), 'Db4');
  assert.equal(midiToName(61, { accidentals: 'sharp' }), 'C#4');
});

test('nameToMidi: round-trips every MIDI note and handles enharmonics across octave boundaries', () => {
  for (let midi = 0; midi <= 127; midi++) {
    assert.equal(nameToMidi(midiToName(midi)), midi);
    assert.equal(nameToMidi(midiToName(midi, { accidentals: 'sharp' })), midi);
  }
  assert.equal(nameToMidi('B#3'), 60);
  assert.equal(nameToMidi('Cb4'), 59);
  assert.equal(nameToMidi('E#4'), 65);
  assert.equal(nameToMidi('Bbb3'), 57);
  for (const bad of ['', 'C', 'H4', '4C', 'C#b4']) {
    assert.throws(() => nameToMidi(bad), Error, `"${bad}" should throw`);
  }
});

test('spellDegree: the letter comes from the degree number, the accidental from the semitones', () => {
  assert.equal(spellDegree('D', 'b9'), 'Eb');
  assert.equal(spellDegree('B', 'b9'), 'C');
  assert.equal(spellDegree('Gb', '3'), 'Bb');
  assert.equal(spellDegree('F#', '7'), 'E#');
  assert.equal(spellDegree('C', 'bb7'), 'Bbb');
  assert.equal(spellDegree('Eb', '#11'), 'A');
});
