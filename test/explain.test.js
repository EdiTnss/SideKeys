import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { nameToMidi } from '../src/theory/notes.js';
import { PROMPTS } from '../src/ai/prompts.js';
import { buildExplainInput, validateSuggestions, explainVoicing } from '../src/ai/explain.js';

const n = (...names) => names.map(nameToMidi);

test('the model receives the chord as degrees with note names, the register and what was played', () => {
  const chord = parseChord('Cmaj7');
  const played = analyzeVoicing(n('E3', 'G3', 'B3', 'D4'), chord);
  const input = buildExplainInput(chord, played);
  assert.equal(input.chord.symbol, 'Cmaj7');
  assert.deepEqual(input.chord.required, ['3', '7']);
  assert.deepEqual(input.chord.chordTones, { 1: 'C', 3: 'E', 5: 'G', 7: 'B' });
  assert.deepEqual(input.chord.tensions, { 9: 'D', '#11': 'F#', 13: 'A' });
  assert.deepEqual(input.chord.avoid, { 11: 'F' });
  assert.deepEqual(input.register, { low: 'E2', high: 'A4', midi: [40, 69] });
  assert.deepEqual(input.played.names, ['E3', 'G3', 'B3', 'D4']);
  assert.equal(input.played.type, 'rootless-A');
  assert.deepEqual(buildExplainInput(parseChord('G7alt'), null).chord.required, ['3', 'b7', 'b13']);
  assert.equal(buildExplainInput(chord, null).played, null);
});

test('a suggestion is accepted only when the analyzer agrees with the promised label (DoD 1)', () => {
  const chord = parseChord('Cmaj7');
  const data = { voicings: [
    { notes: n('E3', 'G3', 'B3', 'D4'), label: 'rootless-A', why: 'A form, 9 on top.' },
    { notes: n('B3', 'D4', 'E4', 'G4'), label: 'drop-2', why: 'mislabeled: this is the B form' },
    { notes: n('E3', 'F3', 'B3', 'D4'), label: 'rootless-A', why: 'has the avoid note' },
    { notes: n('C3', 'E3', 'G3'), label: 'close', why: 'missing the 7th' },
    { notes: n('E1', 'G3', 'B3', 'D4'), label: 'spread', why: 'below the register' },
  ] };
  const { accepted, rejected } = validateSuggestions(data, chord);
  assert.deepEqual(accepted.map(v => v.label), ['rootless-A']);
  assert.equal(accepted[0].analysis.voicing.type, 'rootless-A');
  assert.deepEqual(accepted[0].notes, n('E3', 'G3', 'B3', 'D4'));
  assert.equal(rejected.length, 4);
  assert.match(rejected[0].reason, /drop-2.*rootless-B/);
  assert.match(rejected[1].reason, /avoid/i);
  assert.match(rejected[2].reason, /missing/i);
  assert.match(rejected[3].reason, /register/i);
});

test('what was played is not suggested back, duplicates are dropped, garbage is rejected rather than thrown', () => {
  const chord = parseChord('Cmaj7');
  const played = n('E3', 'G3', 'B3', 'D4');
  const data = { voicings: [
    { notes: played, label: 'rootless-A', why: 'the same voicing' },
    { notes: n('B3', 'D4', 'E4', 'G4'), label: 'rootless-B', why: 'B form' },
    { notes: n('G4', 'B3', 'E4', 'D4'), label: 'rootless-B', why: 'the same B form, unsorted' },
    { notes: 'E3 G3 B3', label: 'shell', why: 'not numbers' },
    { notes: [64], label: 'shell', why: 'one note' },
    { label: 'shell', why: 'no notes at all' },
  ] };
  const { accepted, rejected } = validateSuggestions(data, chord, { played });
  assert.deepEqual(accepted.map(v => v.notes), [n('B3', 'D4', 'E4', 'G4')]);
  assert.match(rejected[0].reason, /played/i);
  assert.match(rejected[1].reason, /duplicate/i);
  assert.equal(rejected.length, 5);
  assert.deepEqual(validateSuggestions(null, chord), { accepted: [], rejected: [] });
  assert.deepEqual(validateSuggestions({ voicings: 'nope' }, chord), { accepted: [], rejected: [] });
});

test('explainVoicing builds the prompt, calls the client with the schema, and validates the answer', async () => {
  const calls = [];
  const client = {
    call: async (action, options) => {
      calls.push({ action, options });
      return {
        data: { voicings: [
          { notes: n('C4', 'E4', 'F4', 'A4'), label: 'rootless-B', why: 'B form: 7-9-3-5, E on top.' },
          { notes: n('F3', 'A3', 'C4', 'E4'), label: 'rootless-A', why: 'what was played' },
        ] },
        model: 'claude-opus-5',
        usage: { input_tokens: 400, output_tokens: 80 },
      };
    },
  };
  const chord = parseChord('Dm7');
  const analysis = analyzeVoicing(n('F3', 'A3', 'C4', 'E4'), chord);
  const result = await explainVoicing(client, chord, analysis);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'explain');
  assert.equal(calls[0].options.system, PROMPTS.explain.system);
  assert.equal(calls[0].options.schema, PROMPTS.explain.schema);
  assert.equal(calls[0].options.effort, 'low');
  const input = JSON.parse(calls[0].options.messages[0].content);
  assert.equal(input.chord.symbol, 'Dm7');
  assert.equal(input.played.type, 'rootless-A');
  assert.deepEqual(result.suggestions.map(v => v.label), ['rootless-B']);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.model, 'claude-opus-5');
  assert.equal(result.promptVersion, PROMPTS.explain.version);
});
