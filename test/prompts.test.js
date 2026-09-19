import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPiece } from '../src/theory/piece.js';
import { analyzePiece } from '../src/theory/analysis.js';
import { generateCandidates, TECHNIQUES } from '../src/theory/candidates.js';
import { PROMPTS, PROMPT_VERSIONS, VOICING_TYPES } from '../src/ai/prompts.js';

// Structured outputs accept only a JSON Schema subset: every object needs additionalProperties
// false with all properties required, and array/number/string constraints are not allowed.
function assertStrict(schema, path) {
  for (const key of ['minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern']) {
    assert.equal(key in schema, false, `${path} uses unsupported ${key}`);
  }
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${path} must close the object`);
    assert.deepEqual([...(schema.required ?? [])].sort(), Object.keys(schema.properties).sort(), `${path} must require every property`);
    for (const [name, child] of Object.entries(schema.properties)) assertStrict(child, `${path}.${name}`);
  }
  if (schema.type === 'array') assertStrict(schema.items, `${path}[]`);
}

test('every prompt has an integer version, a system text, a builder and a strict JSON schema', () => {
  assert.deepEqual(Object.keys(PROMPTS).sort(), ['execute', 'explain', 'plan', 'review']);
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    assert.ok(Number.isInteger(prompt.version) && prompt.version >= 1, name);
    assert.equal(PROMPT_VERSIONS[name], prompt.version);
    assert.ok(typeof prompt.system === 'string' && prompt.system.length > 200, `${name} system prompt`);
    assert.equal(typeof prompt.build, 'function');
    assertStrict(prompt.schema, name);
  }
});

test('explain: the label enum is the analyzer voicing types and the input reaches the model as JSON', () => {
  const label = PROMPTS.explain.schema.properties.voicings.items.properties.label;
  assert.deepEqual(label.enum, VOICING_TYPES);
  assert.ok(VOICING_TYPES.includes('rootless-A') && VOICING_TYPES.includes('drop-2') && VOICING_TYPES.includes('spread'));
  const input = { chord: { symbol: 'Cmaj7' }, register: { low: 'E2', high: 'A4', midi: [40, 69] }, played: null };
  const messages = PROMPTS.explain.build(input);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'user');
  assert.deepEqual(JSON.parse(messages[0].content), input);
  assert.match(PROMPTS.explain.system, /60 = C4/);
  assert.match(PROMPTS.explain.system, /exactly two/i);
});

test('execute: one entry per slot with candidate ids, techniques, melody relations, style and density target', () => {
  const piece = analyzePiece(createPiece({ key: 'C', grid: '| Dm7 | G7 | Cmaj7 |' }));
  const candidates = generateCandidates(piece, { style: 'tritone' });
  const messages = PROMPTS.execute.build({ piece, candidates, style: 'tritone', intensity: 'medium' });
  const input = JSON.parse(messages[0].content);
  assert.equal(input.key, 'C major');
  assert.equal(input.style, 'tritone');
  assert.equal(input.intensity, 'medium');
  assert.deepEqual(input.densityTarget, { min: 0.4, max: 0.6 });
  assert.deepEqual(input.phrases, [[1, 3]]);
  assert.equal(input.slots.length, 3);
  const g7 = input.slots[1];
  assert.equal(g7.original, 'G7');
  assert.equal(g7.roman, 'V7');
  assert.equal(g7.function, 'D');
  assert.equal(g7.candidates[0].id, 'b2s1-orig');
  assert.ok(g7.candidates.some(c => c.technique === 'tritone-sub' && c.chords === 'Db7'));
  const entry = PROMPTS.execute.schema.properties.bars.items.properties;
  assert.deepEqual(Object.keys(entry), ['bar', 'slot', 'candidateId', 'why']);
  assert.match(PROMPTS.execute.system, /candidateId/);
});

test('plan: one entry per phrase with the techniques its menu offers; the answer names techniques from the known list', () => {
  const piece = analyzePiece(createPiece({ key: 'C', grid: '| Dm7 | G7 | Cmaj7 | % |' }));
  const candidates = generateCandidates(piece, { style: 'tritone', intensity: 'light' });
  const phrases = [{ bars: [1, 4], techniques: ['tritone-sub', 'related-ii', 'quality-change'] }];
  const input = JSON.parse(PROMPTS.plan.build({ piece, candidates, style: 'tritone', intensity: 'light', phrases })[0].content);
  assert.equal(input.key, 'C major');
  assert.equal(input.style, 'tritone');
  assert.deepEqual(input.densityTarget, { min: 0, max: 0.25 });
  assert.deepEqual(input.phrases[0].bars, [1, 4]);
  assert.deepEqual(input.phrases[0].techniques, phrases[0].techniques);
  assert.deepEqual(input.phrases[0].slots.map(slot => [slot.bar, slot.original, slot.roman]),
    [[1, 'Dm7', 'ii7'], [2, 'G7', 'V7'], [3, 'Cmaj7', 'Imaj7'], [4, 'Cmaj7', 'Imaj7']]);
  assert.equal('candidates' in input.phrases[0].slots[0], false);        // the plan works on the analysis, not the menu

  const entry = PROMPTS.plan.schema.properties.phrases.items.properties;
  assert.deepEqual(Object.keys(entry), ['bars', 'strategy', 'techniques']);
  assert.deepEqual(entry.techniques.items.enum, TECHNIQUES.filter(technique => technique !== 'original'));
});

test('execute: the plan goes in when there is one and stays out when there is none', () => {
  const piece = analyzePiece(createPiece({ key: 'C', grid: '| Dm7 | G7 | Cmaj7 |' }));
  const candidates = generateCandidates(piece, { style: 'tritone' });
  const plan = [{ bars: [1, 3], strategy: 'Tritone on the V.', techniques: ['tritone-sub'] }];
  const withPlan = JSON.parse(PROMPTS.execute.build({ piece, candidates, style: 'tritone', intensity: 'medium', plan })[0].content);
  assert.deepEqual(withPlan.plan, plan);
  const without = JSON.parse(PROMPTS.execute.build({ piece, candidates, style: 'tritone', intensity: 'medium', plan: null })[0].content);
  assert.equal('plan' in without, false);
  assert.match(PROMPTS.execute.system, /plan/i);
});

test('review: the draft with its reasons and scores, the same menu, and an answer of a verdict and changes', () => {
  const piece = analyzePiece(createPiece({ key: 'C', grid: '| Dm7 | G7 | Cmaj7 |' }));
  const candidates = generateCandidates(piece, { style: 'tritone' });
  const db7 = candidates.slots[1].candidates.find(c => c.id === 'b2s1-tritone-sub-Db7');
  const draft = {
    grid: '| Dm7 | Db7 | Cmaj7 |',
    originalGrid: '| Dm7 | G7 | Cmaj7 |',
    slots: [
      { bar: 1, slot: 1, candidate: null, technique: 'original', coveredBy: null, why: '' },
      { bar: 2, slot: 1, candidate: db7, technique: 'tritone-sub', coveredBy: null, why: 'Db7 walks down to C.' },
      { bar: 3, slot: 1, candidate: null, technique: 'original', coveredBy: null, why: '' },
    ],
    scores: { clashes: 0, warnings: 0, bassSmoothness: 0.8333333, density: 1 / 3, densityTarget: { min: 0.4, max: 0.6 }, densityOk: false, maxRun: 1, maxRunOk: true, techniqueMix: 1, techniques: { 'tritone-sub': 1 } },
  };
  const input = JSON.parse(PROMPTS.review.build({ piece, candidates, style: 'tritone', intensity: 'medium', plan: null, draft })[0].content);
  assert.equal(input.originalGrid, '| Dm7 | G7 | Cmaj7 |');
  assert.equal(input.proposedGrid, '| Dm7 | Db7 | Cmaj7 |');
  assert.equal('plan' in input, false);
  assert.deepEqual(input.scores, {
    density: 0.33, densityOk: false, maxRun: 1, maxRunLimit: 4, maxRunOk: true,
    bassSmoothness: 0.83, techniqueMix: 1, techniques: { 'tritone-sub': 1 }, avoidWarnings: 0,
  });
  assert.deepEqual(input.slots[1].chosen, { id: 'b2s1-tritone-sub-Db7', chords: 'Db7', technique: 'tritone-sub', why: 'Db7 walks down to C.' });
  assert.deepEqual(input.slots[0].chosen, { id: 'b1s1-orig', chords: 'Dm7', technique: 'original', why: '' });
  assert.equal(input.slots[1].roman, 'V7');
  assert.deepEqual(input.slots[1].candidates.map(c => c.id), candidates.slots[1].candidates.map(c => c.id));

  const heavy = JSON.parse(PROMPTS.review.build({ piece, candidates, style: 'tritone', intensity: 'heavy', plan: null, draft })[0].content);
  assert.equal(heavy.scores.maxRunLimit, null);                             // no run limit at heavy

  const schema = PROMPTS.review.schema;
  assert.deepEqual(Object.keys(schema.properties), ['verdict', 'changes']);
  assert.deepEqual(Object.keys(schema.properties.changes.items.properties), ['bar', 'slot', 'candidateId', 'why']);
  assert.match(PROMPTS.review.system, /at most 4/i);
  assert.match(PROMPTS.review.system, /-orig/);
});
