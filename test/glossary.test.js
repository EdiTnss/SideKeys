// The glossary (Romanian, approved by Edi on 2026-10-27): every example on it is played to the
// analyzer that grades the player, and every number it quotes is read from the engine, so the
// glossary cannot drift from the verdicts. And the splitter that underlines its terms in the
// game's Romanian text.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { nameToMidi } from '../src/theory/notes.js';
import { analyzeVoicing, inversionOf, LOW_INTERVAL_LIMITS } from '../src/theory/analyzer.js';
import { isRight, movementThreshold, DEFAULT_MOVEMENT } from '../src/theory/stars.js';
import { compareVoicings } from '../src/theory/voiceLeading.js';
import { GLOSSARY, GLOSSARY_GROUPS, glossaryTerm } from '../src/game/glossary.js';
import { describeMessage } from '../src/i18n/messages.js';
import { splitTerms } from '../src/i18n/terms.js';

const midi = names => names.split(' ').map(nameToMidi);
const analyze = ({ symbol, notes }) => analyzeVoicing(midi(notes), parseChord(symbol));
const term = id => GLOSSARY.find(entry => entry.id === id);

test('every term has a name, a group, a short and a long explanation', () => {
  const groups = GLOSSARY_GROUPS.map(group => group.id);
  const ids = new Set();
  for (const entry of GLOSSARY) {
    assert.ok(!ids.has(entry.id), `${entry.id} twice`);
    ids.add(entry.id);
    assert.ok(entry.name && entry.short, entry.id);
    assert.ok(groups.includes(entry.group), `${entry.id}: group ${entry.group}`);
    for (const example of entry.examples ?? []) assert.ok(example.symbol && example.notes && example.caption, entry.id);
  }
  assert.equal(glossaryTerm('drop-2'), term('drop-2'));
  assert.equal(glossaryTerm('nothing'), null);
});

test('every example is the chord it names, with the notes it lists', () => {
  for (const entry of GLOSSARY) {
    for (const example of entry.examples ?? []) {
      assert.ok(isRight(analyze(example)), `${entry.id}: ${example.symbol} = ${example.notes}`);
    }
  }
});

test('every example is the voicing, inversion or verdict its term says it is', () => {
  let checked = 0;
  for (const entry of GLOSSARY) {
    for (const example of entry.examples ?? []) {
      const analysis = analyze(example);
      const where = `${entry.id}: ${example.notes}`;
      if (example.type) assert.equal(analysis.voicing.type, example.type, where);
      if (example.detail) assert.equal(analysis.voicing.detail, example.detail, where);
      if (example.inversion) assert.equal(inversionOf(analysis), example.inversion, where);
      if (example.says) {
        const said = analysis.messages.map(message => describeMessage('ro', message));
        assert.ok(said.includes(example.says), `${where}: ${said.join(' | ')}`);
      }
      if (example.muddy) assert.equal(analysis.muddy.length, example.muddy, where);
      checked += 1;
    }
  }
  assert.ok(checked >= 17, `${checked} examples`);
});

test('the shapes the glossary names are the ones the analyzer gives', () => {
  const types = id => (term(id).examples ?? []).map(example => example.type);
  assert.ok(types('close').includes('close'));
  assert.ok(types('spread').includes('spread'));
  assert.ok(types('shell').includes('shell'));
  assert.deepEqual([...new Set(types('rootless-a'))], ['rootless-A']);
  assert.deepEqual([...new Set(types('rootless-b'))], ['rootless-B']);
  assert.deepEqual(types('drop-2'), ['close', 'drop-2'], 'the close chord, then its drop 2');
  assert.ok(types('drop-3').includes('drop-3'));
  assert.ok(types('drop-2-4').includes('drop-2-4'));
  assert.ok(types('quartal').includes('quartal'));
  assert.deepEqual(term('upper-structure').examples.map(example => example.detail), ['A']);
});

test('avoid note and muddy: the verdicts the glossary quotes are the ones the game gives', () => {
  assert.equal(term('avoid').examples[0].says, 'Avoid note: F (11)');
  assert.equal(term('muddy').examples[0].muddy, 2);
  // "secunde și terțe mici sub C3, și terțe mari sub G2"
  assert.deepEqual(LOW_INTERVAL_LIMITS, [
    { below: nameToMidi('C3'), semitones: [1, 2, 3] },
    { below: nameToMidi('G2'), semitones: [4] },
  ]);
});

test('voice leading: from Dm7 to G7 in the example, one voice moves, C to B', () => {
  const [from, to] = term('voice-leading').examples;
  const { pairs } = compareVoicings(midi(from.notes), midi(to.notes));
  const moved = pairs.filter(pair => pair.semitones !== 0);
  assert.deepEqual(moved.map(pair => [pair.from, pair.to]), [[nameToMidi('C4'), nameToMidi('B3')]]);
});

test('Smooth: the thresholds the glossary quotes are the engine\'s', () => {
  assert.equal(DEFAULT_MOVEMENT, 1.5);
  assert.equal(movementThreshold('ii-V-I'), 1.25);
  const smooth = term('smooth');
  assert.match(smooth.short, /1,5 semitonuri/);
  assert.match(smooth.short, /ii–V–I, cel mult 1,25/);
});

// ---- Underlining the terms in Romanian text ---------------------------------------------------

const TERMS = [
  { id: 'drop-2', match: ['drop 2'] },
  { id: 'drop-2-4', match: ['drop 2&4'] },
  { id: 'voicing', match: ['voicing', 'voicings', 'voicinguri'] },
  { id: 'avoid', match: ['avoid note', 'avoid notes'] },
  { id: 'ii-V-I', match: ['ii–V–I'] },
];

test('splitTerms: plain text and terms, in order, rebuilding the text exactly', () => {
  const text = 'Niciun voicing drop 2 pentru ii–V–I';
  const parts = splitTerms(text, TERMS);
  assert.deepEqual(parts, [
    { text: 'Niciun ' },
    { text: 'voicing', term: 'voicing' },
    { text: ' ' },
    { text: 'drop 2', term: 'drop-2' },
    { text: ' pentru ' },
    { text: 'ii–V–I', term: 'ii-V-I' },
  ]);
  assert.equal(parts.map(part => part.text).join(''), text);
});

test('splitTerms: the longest term wins, any case, and only whole words', () => {
  assert.deepEqual(splitTerms('Drop 2&4', TERMS), [{ text: 'Drop 2&4', term: 'drop-2-4' }]);
  assert.deepEqual(splitTerms('Avoid note: F (11)', TERMS), [{ text: 'Avoid note', term: 'avoid' }, { text: ': F (11)' }]);
  assert.deepEqual(splitTerms('Shell voicings', TERMS), [{ text: 'Shell ' }, { text: 'voicings', term: 'voicing' }]);
  assert.deepEqual(splitTerms('drop 23', TERMS), [{ text: 'drop 23' }], 'not inside a longer word');
  assert.deepEqual(splitTerms('', TERMS), []);
});

test('splitTerms: every match in the glossary finds its own term', () => {
  for (const entry of GLOSSARY) {
    for (const words of entry.match ?? []) {
      const parts = splitTerms(words, GLOSSARY);
      assert.deepEqual(parts, [{ text: words, term: entry.id }], `${entry.id}: ${words}`);
    }
  }
});

test('splitTerms: the game\'s Romanian names and verdicts find their terms', () => {
  const found = text => splitTerms(text, GLOSSARY).filter(part => part.term).map(part => part.term);
  assert.deepEqual(found('Drop 2'), ['drop-2']);
  assert.deepEqual(found('Rootless A, fundamentala în bas'), ['rootless-a']);
  assert.deepEqual(found('Upper structure triad (A)'), ['upper-structure']);
  assert.deepEqual(found('Prea jos: C2–E2 (terță mare)'), ['muddy']);
  assert.deepEqual(found('Avoid note: F (11)'), ['avoid']);
  assert.deepEqual(found('1st inversion'), ['inversion']);
  assert.deepEqual(found('Shell voicings'), ['shell', 'voicing']);
  assert.deepEqual(found('Rootless pe ii–V–I'), ['ii-V-I']);
  assert.deepEqual(found('Lipsește E (3)'), []);
});
