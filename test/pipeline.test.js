import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { parseGrid } from '../src/theory/progressions.js';
import { PROMPTS } from '../src/ai/prompts.js';
import { AiError } from '../src/ai/client.js';
import { reharmonize } from '../src/ai/pipeline.js';

const raw = (name, bar, beat, durationBeats) => ({ midi: nameToMidi(name), bar, beat, durationBeats, velocity: 80 });
const piece = (grid, melody = []) => addMelody(createPiece({ key: 'C', grid }), melody);

// A client that answers every call. `execute` runs `choose` on every slot of the prompt input:
// `choose(slot)` returns a candidate, an id, or nothing (which keeps the original); `payload`
// replaces the whole execute answer. `plan` and `review` are an answer, or a function of the
// prompt input that returns one (or throws); by default the plan names every phrase with no
// techniques and the review changes nothing.
const fakeClient = (choose, { payload = null, plan = null, review = null } = {}) => {
  const calls = [];
  const usage = { input_tokens: 10, output_tokens: 20 };
  return {
    calls,
    call: async (action, options) => {
      calls.push({ action, options });
      const input = JSON.parse(options.messages[0].content);
      const answer = (given, fallback) => ({ data: typeof given === 'function' ? given(input) : given ?? fallback(), model: 'fake-model', usage });
      if (action === 'plan') return answer(plan, () => ({ phrases: input.phrases.map(phrase => ({ bars: phrase.bars, strategy: 'Keep it plain.', techniques: [] })) }));
      if (action === 'review') return answer(review, () => ({ verdict: 'Fine as it is.', changes: [] }));
      if (payload) return { data: payload, model: 'fake-model', usage: null };
      const bars = input.slots.map(slot => {
        const picked = choose?.(slot);
        const id = typeof picked === 'string' ? picked : picked?.id ?? slot.candidates[0].id;
        return { bar: slot.bar, slot: slot.slot, candidateId: id, why: id.endsWith('-orig') ? '' : `because of ${id}` };
      });
      return { data: { bars }, model: 'fake-model', usage };
    },
  };
};
const inputOf = (client, action) => JSON.parse(client.calls.find(call => call.action === action).options.messages[0].content);
const byTechnique = technique => slot => slot.candidates.find(c => c.technique === technique);
const symbolsOf = result => result.slots.flatMap(s => s.chords).map(c => c.symbol);

test('execute alone (Phase 3a): one call, and the answer comes back as chords, scores and a grid', async () => {
  const client = fakeClient(byTechnique('tritone-sub'));
  const result = await reharmonize(client, piece('| Dm7 | G7 | Cmaj7 |'), { style: 'tritone', intensity: 'light', plan: false, review: false });

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].action, 'execute');
  assert.equal(client.calls[0].options.system, PROMPTS.execute.system);
  assert.equal(client.calls[0].options.schema, PROMPTS.execute.schema);
  assert.equal('plan' in inputOf(client, 'execute'), false);
  assert.equal(result.promptVersion, PROMPTS.execute.version);
  assert.equal(result.model, 'fake-model');
  assert.equal(result.plan, null);

  assert.deepEqual(symbolsOf(result), ['Dm7', 'Db7', 'Cmaj7']);
  assert.equal(result.originalGrid, '| Dm7 | G7 | Cmaj7 |');
  assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 |');
  assert.equal(result.gridParses, true);
  assert.deepEqual(result.slots.map(s => s.changed), [false, true, false]);
  assert.equal(result.slots[1].technique, 'tritone-sub');
  assert.equal(result.slots[1].why, 'because of b2s1-tritone-sub-Db7');
  assert.equal(result.slots[0].why, '');
  assert.deepEqual(result.problems, []);
  assert.equal(result.scores.clashes, 0);
  assert.equal(result.scores.density, 1 / 3);
  assert.deepEqual(result.scores.densityTarget, { min: 0, max: 0.25 });
  assert.equal(result.candidates.slots.length, 3);
});

test('an id that does not exist leaves the slot on the original and is reported, never thrown (DoD 3)', async () => {
  const grid = '| Dm7 | G7 | Cmaj7 |';
  const invented = await reharmonize(fakeClient(slot => (slot.bar === 2 ? 'b2s1-whatever-Xmaj7' : undefined)), piece(grid));
  assert.deepEqual(symbolsOf(invented), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(invented.problems.map(p => [p.bar, p.slot]), [[2, 1]]);
  assert.match(invented.problems[0].reason, /b2s1-whatever-Xmaj7/);
  assert.equal(invented.grid, grid);

  const shapes = [
    { payload: {} },                                                            // no bars at all
    { payload: { bars: 'nope' } },
    { payload: { bars: [{ bar: 9, slot: 1, candidateId: 'b9s1-orig', why: '' }] } },   // no such slot
    { payload: { bars: [{ candidateId: 'b1s1-orig' }] } },                      // no coordinates
    { payload: { bars: [null] } },
  ];
  for (const shape of shapes) {
    const result = await reharmonize(fakeClient(null, shape), piece(grid));
    assert.deepEqual(symbolsOf(result), ['Dm7', 'G7', 'Cmaj7'], JSON.stringify(shape));
    assert.ok(result.problems.length >= 1, JSON.stringify(shape));
    assert.equal(result.scores.density, 0);
  }

  const twice = await reharmonize(fakeClient(null, { payload: { bars: [
    { bar: 2, slot: 1, candidateId: 'b2s1-tritone-sub-Db7', why: 'first' },
    { bar: 2, slot: 1, candidateId: 'b2s1-sus-color-G7sus4', why: 'second' },
  ] } }), piece(grid));
  assert.deepEqual(symbolsOf(twice), ['Dm7', 'Db7', 'Cmaj7']);              // the first one wins
  assert.match(twice.problems[0].reason, /twice|already/i);
});

test('a shortened id is recovered from the menu by its chords; an unoffered chord is still refused', async () => {
  const grid = '| Dm7 | G7 | Cmaj7 |';
  const short = await reharmonize(fakeClient(null, { payload: { bars: [
    { bar: 2, slot: 1, candidateId: 'b2s1-Db7', why: 'the short form the model sometimes writes' },
  ] } }), piece(grid));
  assert.deepEqual(symbolsOf(short), ['Dm7', 'Db7', 'Cmaj7']);
  assert.deepEqual(short.problems, []);
  assert.deepEqual(short.repairs.map(r => [r.bar, r.slot, r.wrote, r.used]), [[2, 1, 'b2s1-Db7', 'b2s1-tritone-sub-Db7']]);
  assert.equal(short.slots[1].why, 'the short form the model sometimes writes');
  assert.equal(short.scores.density, 1 / 3);

  const bare = await reharmonize(fakeClient(null, { payload: { bars: [{ bar: 2, slot: 1, candidateId: 'Db7', why: '' }] } }), piece(grid));
  assert.deepEqual(symbolsOf(bare), ['Dm7', 'Db7', 'Cmaj7']);              // no prefix at all still matches

  const invented = await reharmonize(fakeClient(null, { payload: { bars: [{ bar: 2, slot: 1, candidateId: 'b2s1-Xmaj7', why: '' }] } }), piece(grid));
  assert.deepEqual(symbolsOf(invented), ['Dm7', 'G7', 'Cmaj7']);
  assert.equal(invented.problems.length, 1);
  assert.deepEqual(invented.repairs, []);
});

test('a two-slot candidate fills both bars and a choice on the covered slot is reported', async () => {
  const client = fakeClient(slot => (slot.bar === 1 ? byTechnique('coltrane')(slot) : byTechnique('tritone-sub')(slot)));
  const result = await reharmonize(client, piece('| Dm7 | G7 | Cmaj7 | % |'), { style: 'coltrane', intensity: 'heavy' });
  assert.deepEqual(symbolsOf(result), ['Abmaj7', 'B7', 'Emaj7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.equal(result.grid, '| Abmaj7 B7 | Emaj7 G7 | Cmaj7 | % |');
  assert.equal(result.gridParses, true);
  assert.deepEqual(result.slots.map(s => s.changed), [true, true, false, false]);
  assert.equal(result.slots[1].coveredBy, result.slots[0].candidate.id);
  assert.deepEqual(result.problems.map(p => [p.bar, p.slot]), [[2, 1]]);
  assert.match(result.problems[0].reason, /covered/i);
  assert.equal(result.scores.techniqueMix, 1);
});

test('a bar whose chords land off the equal division is written out in full and still parses', async () => {
  const result = await reharmonize(fakeClient(byTechnique('related-ii')), piece('| Dm7 G7 | Cmaj7 |'), { intensity: 'medium' });
  assert.equal(result.grid, '| Dm7 Dm7 Dm7 G7 | Cmaj7 |');
  assert.equal(result.gridParses, true);
  assert.deepEqual(parseGrid(result.grid).bars[0].chords.map(c => c.beat), [1, 2, 3, 4]);
});

test('the safety net: a chord that clashes with the melody reverts to the original and is reported', async () => {
  const tune = piece('| Dm7 | G7 | Cmaj7 |', [raw('B4', 2, 1, 4)]);
  // A doctored menu, as lock & regenerate will also supply: Ebmaj7 does not contain B.
  const menu = {
    slots: [
      { bar: 1, slot: 1, beat: 1, original: 'Dm7', candidates: [{ id: 'b1s1-orig', chords: [{ symbol: 'Dm7', bar: 1, beat: 1 }], technique: 'original', spans: 1, bassStepToNext: 5, warnings: [] }] },
      { bar: 2, slot: 1, beat: 1, original: 'G7', candidates: [
        { id: 'b2s1-orig', chords: [{ symbol: 'G7', bar: 2, beat: 1 }], technique: 'original', spans: 1, bassStepToNext: 5, warnings: [] },
        { id: 'b2s1-other-Ebmaj7', chords: [{ symbol: 'Ebmaj7', bar: 2, beat: 1 }], technique: 'other', spans: 1, bassStepToNext: 3, warnings: [] },
      ] },
      { bar: 3, slot: 1, beat: 1, original: 'Cmaj7', candidates: [{ id: 'b3s1-orig', chords: [{ symbol: 'Cmaj7', bar: 3, beat: 1 }], technique: 'original', spans: 1, bassStepToNext: 0, warnings: [] }] },
    ],
  };
  const result = await reharmonize(fakeClient(byTechnique('other')), tune, { candidates: menu });
  assert.deepEqual(symbolsOf(result), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(result.problems.map(p => [p.bar, p.slot]), [[2, 1]]);
  assert.match(result.problems[0].reason, /B4.*Ebmaj7/);
  assert.equal(result.scores.clashes, 0);                                  // the score sees the corrected grid
  assert.equal(result.scores.density, 0);
  assert.equal(result.slots[1].status, 'rejected');
});

test('a failed call is not swallowed: the caller sees the AiError', async () => {
  const failing = { call: async () => { throw new AiError('rate-limited', 'slow down', { status: 429 }); } };
  await assert.rejects(() => reharmonize(failing, piece('| Dm7 | G7 |')), error => error instanceof AiError && error.kind === 'rate-limited');
});

test('the result carries the reharmonized piece, with its real onsets and the melody, ready to realize', async () => {
  const tune = piece('| Dm7 G7 | Cmaj7 |', [raw('E4', 1, 1, 2), raw('F4', 1, 3, 1), raw('E4', 2, 1, 4)]);
  const result = await reharmonize(fakeClient(byTechnique('related-ii')), tune);
  assert.deepEqual(result.reharmonized.bars[0].chords, [{ symbol: 'Dm7', beat: 1 }, { symbol: 'Dm7', beat: 3 }, { symbol: 'G7', beat: 4 }]);
  assert.deepEqual(result.reharmonized.bars[1].chords, [{ symbol: 'Cmaj7', beat: 1 }]);
  assert.deepEqual(result.reharmonized.bars.map(bar => bar.melody), tune.bars.map(bar => bar.melody));
  assert.equal(result.reharmonized.tempo, tune.tempo);
  assert.deepEqual(result.reharmonized.timeSignature, tune.timeSignature);
  assert.equal(result.reharmonized.analysis, undefined);                // a plain piece, not the analyzed one
  assert.notEqual(result.reharmonized.bars[1].melody, tune.bars[1].melody);   // copied, not shared
});

// ---- Phase 3b: plan -------------------------------------------------------------------------

const EIGHT = '| Dm7 | G7 | Cmaj7 | % | Dm7 | G7 | Cmaj7 | % |';

test('plan first, then execute with the plan, each step announced before its call', async () => {
  const steps = [];
  const client = fakeClient(byTechnique('tritone-sub'), {
    plan: input => ({ phrases: input.phrases.map((phrase, i) => ({ bars: phrase.bars, strategy: `Phrase ${i + 1}: tritone into the cadence.`, techniques: ['tritone-sub'] })) }),
  });
  const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'light', review: false, onStep: step => steps.push([step, client.calls.length]) });

  assert.deepEqual(client.calls.map(call => call.action), ['plan', 'execute']);
  assert.deepEqual(steps, [['plan', 0], ['execute', 1]]);
  assert.equal(client.calls[0].options.system, PROMPTS.plan.system);
  assert.equal(client.calls[0].options.schema, PROMPTS.plan.schema);

  // The plan sees, per phrase, what the menu can actually give (light: four techniques at most).
  const planInput = inputOf(client, 'plan');
  assert.deepEqual(planInput.phrases.map(phrase => phrase.bars), [[1, 4], [5, 8]]);
  assert.deepEqual(planInput.phrases[0].techniques, ['tritone-sub', 'related-ii', 'quality-change']);
  assert.deepEqual(planInput.phrases[0].slots.map(slot => slot.original), ['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.equal(planInput.phrases[0].slots[1].roman, 'V7');

  const plan = [
    { bars: [1, 4], strategy: 'Phrase 1: tritone into the cadence.', techniques: ['tritone-sub'] },
    { bars: [5, 8], strategy: 'Phrase 2: tritone into the cadence.', techniques: ['tritone-sub'] },
  ];
  assert.deepEqual(result.plan, plan);
  assert.deepEqual(inputOf(client, 'execute').plan, plan);           // execute follows the plan

  assert.deepEqual(result.calls.map(call => call.action), ['plan', 'execute']);
  assert.deepEqual(result.promptVersions, { plan: PROMPTS.plan.version, execute: PROMPTS.execute.version });
  assert.deepEqual(result.usage, { input_tokens: 20, output_tokens: 40 });     // both calls
  assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 | % | Dm7 | Db7 | Cmaj7 | % |');
});

test('the plan is checked against the piece: foreign phrases, repeats and techniques the menu lacks are dropped and reported', async () => {
  const client = fakeClient(null, { plan: { phrases: [
    { bars: [1, 4], strategy: 'A section: one tritone.', techniques: ['tritone-sub', 'coltrane', 'tritone-sub'] },
    { bars: [2, 5], strategy: 'Not a phrase of this piece.', techniques: [] },
    { bars: [1, 4], strategy: 'The same phrase again.', techniques: [] },
    { bars: [5, 8], strategy: 'Close plainly.', techniques: ['other'] },
    { bars: [9], strategy: 'Half a range.', techniques: [] },
  ] } });
  const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'light', review: false });

  assert.deepEqual(result.plan, [
    { bars: [1, 4], strategy: 'A section: one tritone.', techniques: ['tritone-sub'] },
    { bars: [5, 8], strategy: 'Close plainly.', techniques: [] },
  ]);
  const planProblems = result.problems.filter(problem => problem.stage === 'plan');
  assert.equal(planProblems.length, 5);
  assert.ok(planProblems.some(problem => /coltrane/.test(problem.reason) && /1–4/.test(problem.reason)));
  assert.ok(planProblems.some(problem => /other/.test(problem.reason)));
  assert.ok(planProblems.some(problem => /2–5/.test(problem.reason)));
  assert.ok(planProblems.some(problem => /twice/.test(problem.reason)));
  assert.ok(planProblems.every(problem => problem.bar === null));
  assert.deepEqual(inputOf(client, 'execute').plan, result.plan);

  const empty = await reharmonize(fakeClient(null, { plan: { nothing: true } }), piece(EIGHT), { review: false });
  assert.equal(empty.plan, null);
  assert.match(empty.problems.find(problem => problem.stage === 'plan').reason, /without/i);
});

test('a plan the model could not give does not stop the run; a proxy that cannot be reached does', async () => {
  for (const kind of ['refusal', 'truncated', 'invalid-json', 'upstream']) {
    const client = fakeClient(byTechnique('tritone-sub'), { plan: () => { throw new AiError(kind, `plan went ${kind}`); } });
    const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'light', review: false });
    assert.equal(result.plan, null, kind);
    assert.deepEqual(client.calls.map(call => call.action), ['plan', 'execute'], kind);
    assert.equal('plan' in inputOf(client, 'execute'), false, kind);
    assert.match(result.problems.find(problem => problem.stage === 'plan').reason, new RegExp(`plan went ${kind}`), kind);
    assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 | % | Dm7 | Db7 | Cmaj7 | % |', kind);
  }
  for (const kind of ['network', 'forbidden', 'rate-limited', 'not-configured']) {
    const client = fakeClient(null, { plan: () => { throw new AiError(kind, kind); } });
    await assert.rejects(() => reharmonize(client, piece(EIGHT), { review: false }), error => error instanceof AiError && error.kind === kind, kind);
    assert.deepEqual(client.calls.map(call => call.action), ['plan'], kind);
  }
});
