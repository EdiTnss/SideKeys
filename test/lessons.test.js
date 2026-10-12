// The theory pages: one lesson per unit of the path, and no sentence in them the engine disagrees
// with. An example on a page is graded here by the same analyzer that grades the player, and
// every "the game listens for…" claim has the test that would fail if it stopped being true.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { nameToMidi } from '../src/theory/notes.js';
import { analyzeVoicing, inversionOf } from '../src/theory/analyzer.js';
import { isRight, isClean, movementThreshold } from '../src/theory/stars.js';
import { compareVoicings } from '../src/theory/voiceLeading.js';
import { PATH } from '../src/game/path.js';
import { LESSONS, lessonFor, lessonForTexture, exampleNotes } from '../src/game/lessons.js';

const analyze = (symbol, names) => analyzeVoicing(names.split(' ').map(nameToMidi), parseChord(symbol));
const warnings = analysis => analysis.messages.filter(message => message.level === 'warning').map(message => message.text);

// ---- The pages themselves --------------------------------------------------------------------

test('there is one lesson for every unit of the path, in the order of the path', () => {
  assert.deepEqual(LESSONS.map(lesson => lesson.unit), PATH.map(unit => unit.id));
  for (const unit of PATH) {
    const lesson = lessonFor(unit.id);
    assert.equal(lesson.title, unit.name, 'a lesson is called what its unit is called');
    // "Try it" starts the unit, and with every unit open its first level always is.
    assert.equal(lesson.level, unit.levels[0].id);
  }
  assert.equal(lessonFor('no-such-unit'), null);
});

test('every lesson has something to read, something to hear and something the game listens for', () => {
  for (const lesson of LESSONS) {
    assert.ok(lesson.lead.length > 40, `${lesson.unit}: lead`);
    assert.ok(lesson.sections.length >= 2, `${lesson.unit}: sections`);
    for (const section of lesson.sections) {
      assert.ok(section.heading && section.text.length, `${lesson.unit}: an empty section`);
      for (const paragraph of section.text) assert.ok(paragraph.trim().length > 20, `${lesson.unit}: ${section.heading}`);
    }
    assert.ok(lesson.examples.length >= 3, `${lesson.unit}: examples`);
    assert.ok(lesson.listens.length >= 2, `${lesson.unit}: what the game listens for`);
  }
});

test('every example is a voicing the analyzer finds nothing wrong with, of the kind the page says it is', () => {
  for (const lesson of LESSONS) {
    for (const example of [...lesson.examples, ...(lesson.chain ?? [])]) {
      const where = `${lesson.unit}: ${example.symbol} as ${example.notes}`;
      const notes = exampleNotes(example);
      assert.ok(notes.every(midi => midi >= 36 && midi <= 84), `${where} leaves the drawn keyboard (C2–C6)`);
      assert.deepEqual([...notes].sort((a, b) => a - b), notes, `${where} is not written bottom to top`);
      const analysis = analyzeVoicing(notes, parseChord(example.symbol));
      assert.deepEqual(warnings(analysis), [], where);
      assert.ok(isRight(analysis), where);
      assert.equal(analysis.voicing.type, example.type, where);
      if (example.inversion) assert.equal(inversionOf(analysis), example.inversion, where);
      assert.ok(example.caption.length > 8, `${where}: caption`);
    }
  }
});

test('lessonForTexture: the shape a level demands leads to the page that explains it', () => {
  assert.equal(lessonForTexture('shell').unit, 'shell');
  assert.equal(lessonForTexture('rootless-A').unit, 'rootless');
  assert.equal(lessonForTexture(['rootless-A', 'rootless-B']).unit, 'rootless');
  assert.equal(lessonForTexture('drop-2').unit, 'drop-2');
  assert.equal(lessonForTexture('quartal').unit, 'quartal');
  assert.equal(lessonForTexture(null), null);
  assert.equal(lessonForTexture('no-such-shape'), null);
});

// ---- What the pages claim the game listens for ----------------------------------------------

test('triads: all three notes are needed, the third decides which triad, and the spacing does not', () => {
  // A triad is its three notes: none of them is left to someone else.
  assert.ok(!isRight(analyze('C', 'E4')), 'the third alone');
  assert.ok(!isRight(analyze('C', 'C4 E4')), 'no fifth');
  assert.ok(!isRight(analyze('C', 'E4 G4')), 'no root');
  // C with an E flat is not C: the note that makes it major is missing.
  assert.ok(!isRight(analyze('C', 'C4 Eb4 G4')));
  assert.ok(isRight(analyze('Cm', 'C4 Eb4 G4')));
  // Close in one hand or spread over two, it is the same triad.
  assert.ok(isClean(analyze('C', 'C4 E4 G4')));
  assert.ok(isClean(analyze('C', 'C2 G3 E4')));
  // A sus4 has its fourth where the third would be.
  assert.ok(!isRight(analyze('Csus4', 'C4 E4 G4')));
});

test('inversions: only the lowest note is checked against the slash, in any octave', () => {
  assert.ok(isClean(analyze('C/E', 'E4 G4 C5')));
  assert.ok(isClean(analyze('C/E', 'E2 C4 G4')), 'any octave, anything above it');
  const rootPosition = analyze('C/E', 'C4 E4 G4');
  assert.ok(!isRight(rootPosition));
  assert.deepEqual(warnings(rootPosition), ['Bass should be E, not C']);
});

test('sevenths: the third and the seventh are needed; the root and the natural fifth are not', () => {
  assert.ok(isRight(analyze('Cmaj7', 'E4 B4')), 'third and seventh alone');
  assert.ok(!isRight(analyze('Cmaj7', 'C4 E4 G4')), 'no seventh');
  assert.ok(!isRight(analyze('C7', 'C4 G4 Bb4')), 'no third');
  // The half-diminished shares its third and seventh with the minor seventh: the fifth tells them apart.
  assert.ok(!isRight(analyze('Cm7b5', 'C4 Eb4 Bb4')), 'm7b5 needs its flattened fifth');
  assert.ok(isRight(analyze('Cm7', 'C4 Eb4 Bb4')), 'm7 does not need its fifth');
  assert.ok(!isRight(analyze('Cdim7', 'C4 Eb4 A4')), 'dim7 needs its flattened fifth too');
  assert.ok(isRight(analyze('Cm6', 'Eb4 A4')), 'on a m6 the sixth stands where the seventh would');
});

test('shell: root, third and seventh and nothing else — two notes or three', () => {
  assert.equal(analyze('Cmaj7', 'C3 E3 B3').voicing.type, 'shell');
  assert.equal(analyze('Cmaj7', 'C3 B3 E4').voicing.type, 'shell', 'either way up');
  assert.equal(analyze('Cmaj7', 'E3 B3').voicing.type, 'shell', 'without the root');
  assert.notEqual(analyze('Cmaj7', 'C3 E3 G3 B3').voicing.type, 'shell', 'the fifth makes it something else');
  assert.ok(!isRight(analyze('Cmaj7', 'C3 E3 G3 B3'), { texture: 'shell' }));
});

test('rootless: four notes in order from the bottom, and a root underneath does not spoil it', () => {
  assert.equal(analyze('Cmaj7', 'E3 G3 B3 D4').voicing.type, 'rootless-A');
  assert.equal(analyze('Cmaj7', 'B3 D4 E4 G4').voicing.type, 'rootless-B');
  // On a dominant the thirteenth sits where the fifth would.
  assert.equal(analyze('G7', 'B3 E4 F4 A4').voicing.type, 'rootless-A');
  assert.equal(analyze('G7', 'F3 A3 B3 E4').voicing.type, 'rootless-B');
  // The left hand may take the root: it is still form A, and a level that asks for form A takes it.
  const withRoot = analyze('Cmaj7', 'C2 E3 G3 B3 D4');
  assert.equal(withRoot.voicing.type, 'rootless-A');
  assert.ok(isClean(withRoot, { texture: 'rootless-A' }));
  // The same four notes in another order are not a rootless form.
  assert.ok(!isRight(analyze('Cmaj7', 'G3 B3 D4 E4'), { texture: ['rootless-A', 'rootless-B'] }));
});

test('drop 2: lift the lowest note an octave and it is the close chord, that note second from the top', () => {
  assert.equal(analyze('Cmaj7', 'C4 E4 G4 B4').voicing.type, 'close', 'before');
  assert.equal(analyze('Cmaj7', 'G3 C4 E4 B4').voicing.type, 'drop-2', 'after: the G went down an octave');
  // Each inversion of the close chord gives its own.
  assert.equal(analyze('Cmaj7', 'B3 E4 G4 C5').voicing.type, 'drop-2');
  assert.equal(analyze('Cmaj7', 'C4 G4 B4 E5').voicing.type, 'drop-2');
  assert.equal(analyze('Cmaj7', 'E4 B4 C5 G5').voicing.type, 'drop-2');
});

test('quartal: a stack of fourths still has to hold the third and the seventh of the chord', () => {
  assert.equal(analyze('Dm7', 'D3 G3 C4 F4').voicing.type, 'quartal');
  // The "So What" voicing: three fourths and a major third on top.
  const soWhat = analyze('Dm7', 'D3 G3 C4 F4 A4');
  assert.equal(soWhat.voicing.type, 'quartal');
  assert.ok(isClean(soWhat, { texture: 'quartal' }));
  // Fourths that miss the guide tones are fourths, and the wrong answer.
  const empty = analyze('Dm7', 'E3 A3 D4 G4');
  assert.equal(empty.voicing.type, 'quartal');
  assert.ok(!isRight(empty));
  // On a dominant the tritone between seventh and third is the one augmented fourth allowed.
  assert.ok(isClean(analyze('G7', 'F3 B3 E4 A4'), { texture: 'quartal' }));
});

test('ii–V–I: the chain on the page is rootless A, B, A and earns the third star', () => {
  const { chain } = lessonFor('ii-V-I');
  assert.deepEqual(chain.map(step => step.symbol), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(chain.map(step => step.type), ['rootless-A', 'rootless-B', 'rootless-A']);
  const moves = chain.slice(1).map((step, at) => compareVoicings(exampleNotes(chain[at]), exampleNotes(step)).averageMove);
  assert.deepEqual(moves, [0.25, 1.25], 'one voice moves into the V; three move by step into the I');
  const mean = moves.reduce((sum, move) => sum + move, 0) / moves.length;
  assert.equal(mean, 0.75, 'the figure the page quotes');
  assert.ok(mean <= movementThreshold('ii-V-I'));
  assert.equal(movementThreshold('ii-V-I'), 1.25, 'and the threshold it quotes');
});
