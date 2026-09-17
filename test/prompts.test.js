import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPiece } from '../src/theory/piece.js';
import { analyzePiece } from '../src/theory/analysis.js';
import { generateCandidates } from '../src/theory/candidates.js';
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
  assert.deepEqual(Object.keys(PROMPTS).sort(), ['execute', 'explain']);
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
