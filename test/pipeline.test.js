import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToMidi } from '../src/theory/notes.js';
import { createPiece, addMelody } from '../src/theory/piece.js';
import { parseGrid } from '../src/theory/progressions.js';
import { analyzePiece } from '../src/theory/analysis.js';
import { generateCandidates } from '../src/theory/candidates.js';
import { PROMPTS } from '../src/ai/prompts.js';
import { AiError } from '../src/ai/client.js';
import { reharmonize, splitIntoParts, MAX_PART_SLOTS } from '../src/ai/pipeline.js';
import { MAX_BODY_BYTES } from '../worker/src/index.js';

const raw = (name, bar, beat, durationBeats) => ({ midi: nameToMidi(name), bar, beat, durationBeats, velocity: 80 });
const piece = (grid, melody = []) => addMelody(createPiece({ key: 'C', grid }), melody);

// A client that answers every call. `execute` runs `choose` on every slot of the prompt input:
// `choose(slot)` returns a candidate, an id, or nothing (which keeps the original); `payload`
// replaces the whole execute answer, and `execute(input)`, when given, runs first and may throw
// to fail that call. `plan` and `review` are an answer, or a function of the prompt input that
// returns one (or throws); by default the plan names every phrase with no techniques and the
// review changes nothing.
const fakeClient = (choose, { payload = null, plan = null, review = null, execute = null } = {}) => {
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
      execute?.(input);
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
  assert.equal(result.review, null);

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

// ---- Phase 3b: review -----------------------------------------------------------------------

// Execute changes bars 2 and 6 to the tritone sub; the review is given as a function of its input.
const tritoneOn = bars => slot => (bars.includes(slot.bar) ? byTechnique('tritone-sub')(slot) : undefined);
const idOf = (input, bar, technique) => input.slots.find(slot => slot.bar === bar).candidates.find(c => c.technique === technique).id;

test('the full chain: plan, execute, review, in that order; the review sees the draft, its reasons and its scores', async () => {
  const steps = [];
  const client = fakeClient(tritoneOn([2, 6]));
  const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'medium', onStep: step => steps.push(step) });

  assert.deepEqual(client.calls.map(call => call.action), ['plan', 'execute', 'review']);
  assert.deepEqual(steps, ['plan', 'execute', 'review']);
  assert.equal(client.calls[2].options.system, PROMPTS.review.system);
  assert.equal(client.calls[2].options.schema, PROMPTS.review.schema);
  assert.deepEqual(result.promptVersions, { plan: PROMPTS.plan.version, execute: PROMPTS.execute.version, review: PROMPTS.review.version });
  assert.deepEqual(result.usage, { input_tokens: 30, output_tokens: 60 });

  const input = inputOf(client, 'review');
  assert.equal(input.originalGrid, '| Dm7 | G7 | Cmaj7 | % | Dm7 | G7 | Cmaj7 | % |');
  assert.equal(input.proposedGrid, '| Dm7 | Db7 | Cmaj7 | % | Dm7 | Db7 | Cmaj7 | % |');
  assert.deepEqual(input.plan, result.plan);
  assert.equal(input.scores.density, 0.25);
  assert.equal(input.scores.densityOk, false);
  assert.equal(input.scores.maxRunLimit, 4);
  assert.deepEqual(input.scores.techniques, { 'tritone-sub': 2 });
  assert.deepEqual(input.slots[1].chosen, { id: 'b2s1-tritone-sub-Db7', chords: 'Db7', technique: 'tritone-sub', why: 'because of b2s1-tritone-sub-Db7' });
  assert.deepEqual(input.slots[0].chosen, { id: 'b1s1-orig', chords: 'Dm7', technique: 'original', why: '' });
  assert.ok(input.slots[1].candidates.some(c => c.id === 'b2s1-related-ii-Dm7_G7'));

  // Nothing changed: the result is the draft, and says so.
  assert.deepEqual(result.review, { verdict: 'Fine as it is.', changes: [], undone: null });
  assert.equal(result.grid, result.draft.grid);
  assert.deepEqual(result.draft.scores, result.scores);
});

test('review changes are applied and re-scored; the draft stays visible and the revised slots carry the reviewer\'s reasons', async () => {
  const client = fakeClient(tritoneOn([2, 6]), {
    review: input => ({ verdict: 'Two tritones in a row is monotonous; A7 pulls into bar 5.', changes: [
      { bar: 4, slot: 1, candidateId: idOf(input, 4, 'secondary-dominant'), why: 'A7 as V of Dm7.' },
      { bar: 6, slot: 1, candidateId: 'b6s1-orig', why: 'Keep the second V plain.' },
    ] }),
  });
  const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'medium' });

  assert.equal(result.draft.grid, '| Dm7 | Db7 | Cmaj7 | % | Dm7 | Db7 | Cmaj7 | % |');
  assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 | A7 | Dm7 | G7 | Cmaj7 | % |');
  assert.deepEqual(result.draft.scores.techniques, { 'tritone-sub': 2 });
  assert.deepEqual(result.scores.techniques, { 'tritone-sub': 1, 'secondary-dominant': 1 });
  assert.equal(result.review.undone, null);
  assert.deepEqual(result.review.changes.map(change => [change.bar, change.from, change.to]), [
    [4, 'b4s1-orig', 'b4s1-secondary-dominant-A7'],
    [6, 'b6s1-tritone-sub-Db7', 'b6s1-orig'],
  ]);
  assert.deepEqual(result.slots.map(slot => slot.revised), [false, false, false, true, false, true, false, false]);
  assert.equal(result.slots[3].why, 'A7 as V of Dm7.');
  assert.equal(result.slots[5].why, 'Keep the second V plain.');
  assert.equal(result.slots[5].changed, false);
  assert.equal(result.slots[1].why, 'because of b2s1-tritone-sub-Db7');     // untouched slots keep execute's reason
  assert.deepEqual(result.reharmonized.bars[3].chords, [{ symbol: 'A7', beat: 1 }]);
});

test('at most four review changes; entries it cannot use cost only themselves', async () => {
  const client = fakeClient(tritoneOn([2, 6]), {
    review: input => ({ verdict: 'Busy.', changes: [
      { bar: 3, slot: 1, candidateId: 'b3s1-nope', why: '' },
      { bar: 4, slot: 1, candidateId: idOf(input, 4, 'secondary-dominant'), why: 'A7.' },
      { bar: 4, slot: 1, candidateId: 'b4s1-orig', why: 'Changed my mind.' },
      { bar: 9, slot: 1, candidateId: 'b9s1-orig', why: '' },
      { bar: 8, slot: 1, candidateId: idOf(input, 8, 'quality-change'), why: 'Fifth change, never read.' },
    ] }),
  });
  const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'medium' });
  assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 | A7 | Dm7 | Db7 | Cmaj7 | % |');
  const reviewProblems = result.problems.filter(problem => problem.stage === 'review');
  assert.equal(reviewProblems.length, 4);
  assert.ok(reviewProblems.some(problem => /5 changes/.test(problem.reason) && /first 4/.test(problem.reason)));
  assert.ok(reviewProblems.some(problem => /b3s1-nope/.test(problem.reason)));
  assert.ok(reviewProblems.some(problem => /twice/.test(problem.reason)));
  assert.ok(reviewProblems.some(problem => problem.bar === 9));
  assert.deepEqual(result.review.changes.map(change => change.bar), [4]);

  const shapeless = await reharmonize(fakeClient(tritoneOn([2, 6]), { review: { verdict: 'Hm.' } }), piece(EIGHT), { style: 'tritone', intensity: 'medium' });
  assert.equal(shapeless.grid, shapeless.draft.grid);
  assert.match(shapeless.problems.find(problem => problem.stage === 'review').reason, /no list of changes/i);
});

test('a review that breaks a target the draft met is undone as a whole, and says why', async () => {
  // Draft: bars 2, 4, 6 and 8 changed, 50%, inside the medium target, no run longer than 1.
  const draftBars = slot => ({ 2: 'tritone-sub', 4: 'secondary-dominant', 6: 'tritone-sub', 8: 'quality-change' })[slot.bar];
  const execute = slot => (draftBars(slot) ? byTechnique(draftBars(slot))(slot) : undefined);
  const busy = input => ({ verdict: 'More colour.', changes: [1, 3, 5].map(bar => ({ bar, slot: 1, candidateId: idOf(input, bar, 'quality-change'), why: 'More.' })) });
  const result = await reharmonize(fakeClient(execute, { review: busy }), piece(EIGHT), { style: 'tritone', intensity: 'medium' });

  assert.equal(result.draft.scores.densityOk, true);
  assert.equal(result.grid, result.draft.grid);
  assert.deepEqual(result.scores, result.draft.scores);
  assert.match(result.review.undone, /density/);
  assert.match(result.review.undone, /run of 6/);                               // bars 1–6
  assert.deepEqual(result.review.changes.map(change => change.bar), [1, 3, 5]);   // what it proposed, for the record
  assert.ok(result.slots.every(slot => !slot.revised));

  // A new avoid note is enough on its own: G7sus4 makes the melody C a chord tone, the original G7 makes it an avoid note.
  const tune = piece('| Dm7 | G7 | Cmaj7 |', [raw('C5', 2, 1, 4)]);
  const back = await reharmonize(fakeClient(byTechnique('sus-color'), { review: { verdict: 'Plainer.', changes: [{ bar: 2, slot: 1, candidateId: 'b2s1-orig', why: 'Plain V.' }] } }), tune, { style: 'tritone', intensity: 'medium' });
  assert.equal(back.draft.scores.warnings, 0);
  assert.equal(back.grid, '| Dm7 | G7sus4 | Cmaj7 |');
  assert.match(back.review.undone, /avoid/);
});

test('a review choosing a two-slot candidate takes over the next slot; a choice there is reported', async () => {
  const client = fakeClient(tritoneOn([2]), {
    review: input => ({ verdict: 'Coltrane it.', changes: [{ bar: 1, slot: 1, candidateId: idOf(input, 1, 'coltrane'), why: 'Giant steps into C.' }] }),
  });
  const result = await reharmonize(client, piece('| Dm7 | G7 | Cmaj7 | % |'), { style: 'coltrane', intensity: 'heavy' });
  assert.equal(result.grid, '| Abmaj7 B7 | Emaj7 G7 | Cmaj7 | % |');
  assert.deepEqual(result.problems.filter(problem => problem.stage === 'review').map(problem => [problem.bar, problem.slot]), [[2, 1]]);
  assert.match(result.problems.find(problem => problem.stage === 'review').reason, /covered/);
});

test('a review that fails keeps the draft: the call already paid for is never lost', async () => {
  for (const kind of ['network', 'rate-limited', 'upstream', 'refusal', 'truncated', 'invalid-json']) {
    const client = fakeClient(tritoneOn([2, 6]), { review: () => { throw new AiError(kind, `review went ${kind}`); } });
    const result = await reharmonize(client, piece(EIGHT), { style: 'tritone', intensity: 'medium' });
    assert.equal(result.review, null, kind);
    assert.equal(result.grid, '| Dm7 | Db7 | Cmaj7 | % | Dm7 | Db7 | Cmaj7 | % |', kind);
    assert.match(result.problems.find(problem => problem.stage === 'review').reason, new RegExp(`review went ${kind}`), kind);
  }
  const buggy = fakeClient(tritoneOn([2]), { review: () => { throw new TypeError('a bug'); } });
  await assert.rejects(() => reharmonize(buggy, piece(EIGHT)), TypeError);    // a bug is not a model failure
});

// ---- Phase 3b: long pieces, in parts ----------------------------------------------------------

const barsOf = bars => `| ${bars.join(' | ')} |`;
const times = (count, ...bars) => Array.from({ length: count }, () => bars).flat();
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
const rangesOf = parts => parts.map(part => part.bars);
const partsOf = (grid, analysis = {}) => {
  const analyzed = analyzePiece(piece(grid), analysis);
  return splitIntoParts(analyzed, generateCandidates(analyzed, { style: 'tritone' }));
};
const inputsOf = (client, action) => client.calls.filter(call => call.action === action).map(call => JSON.parse(call.options.messages[0].content));
// 36 bars, one slot each, a ii–V closing every phrase: the parts are bars 1–20 and 21–36.
const LONG = barsOf(times(9, 'Cmaj7', 'Cmaj7', 'Dm7', 'G7'));
// Every ii changes quality and every V becomes its tritone sub: 18 of 36 slots, 50%.
const iiV = slot => (slot.original === 'Dm7' ? byTechnique('quality-change')(slot) : slot.original === 'G7' ? byTechnique('tritone-sub')(slot) : undefined);

test('a piece of up to 32 slots is one part with its own menu; a longer one is cut at phrase boundaries, as evenly as they allow', () => {
  assert.equal(MAX_PART_SLOTS, 32);
  const short = analyzePiece(piece(EIGHT));
  const menu = generateCandidates(short, { style: 'tritone' });
  const parts = splitIntoParts(short, menu);
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0].bars, [1, 8]);
  assert.deepEqual(parts[0].phrases, [[1, 4], [5, 8]]);
  assert.equal(parts[0].candidates, menu);                                   // the very menu: a short piece runs as before

  assert.deepEqual(rangesOf(partsOf(barsOf(times(8, 'Dm7', 'G7', 'Cmaj7', 'Cmaj7')))), [[1, 32]]);            // 32 slots
  assert.deepEqual(rangesOf(partsOf(barsOf(times(16, 'Dm7', 'G7', 'Cmaj7', 'Cmaj7')))), [[1, 32], [33, 64]]);
  assert.deepEqual(rangesOf(partsOf(LONG)), [[1, 20], [21, 36]]);                                           // 20 + 16, not 32 + 4
  const twoABar = barsOf(times(8, 'Dm7 G7', 'Cmaj7 A7', 'Dm7 G7', 'Cmaj7 C7'));                              // 32 bars, 64 slots
  assert.deepEqual(rangesOf(partsOf(twoABar)), [[1, 16], [17, 32]]);                                        // the limit counts slots, not bars

  const oneLongPhrase = partsOf(twoABar, { phraseLength: 32 });                                             // a phrase too big for one part
  assert.deepEqual(rangesOf(oneLongPhrase), [[1, 16], [17, 32]]);                                          // is cut at a bar line
  assert.deepEqual(oneLongPhrase.map(part => part.phrases), [[[1, 16]], [[17, 32]]]);

  const long = partsOf(LONG);
  assert.deepEqual(long[1].phrases, [[21, 24], [25, 28], [29, 32], [33, 36]]);
  const keys = long.flatMap(part => part.candidates.slots.map(slot => `${slot.bar}:${slot.slot}`));
  assert.deepEqual(keys, range(1, 36).map(bar => `${bar}:1`));                                               // every slot once, in order
});

test('a long piece: one plan, then execute part by part, in order, each part told what the one before chose', async () => {
  const steps = [];
  // In the second part its first bar changes too, so a run of changed slots crosses the boundary.
  const client = fakeClient(slot => (slot.bar === 21 ? byTechnique('quality-change')(slot) : iiV(slot)));
  const result = await reharmonize(client, piece(LONG), { style: 'tritone', intensity: 'medium', onStep: (step, info) => steps.push([step, info]) });

  assert.deepEqual(client.calls.map(call => call.action), ['plan', 'execute', 'execute', 'review', 'review']);
  assert.deepEqual(steps, [
    ['plan', null],
    ['execute', { part: 1, parts: 2, bars: [1, 20] }],
    ['execute', { part: 2, parts: 2, bars: [21, 36] }],
    ['review', { parts: 2 }],
  ]);
  assert.equal(inputOf(client, 'plan').phrases.length, 9);                 // the plan sees the whole tune

  const [first, second] = inputsOf(client, 'execute');
  assert.deepEqual(first.slots.map(slot => slot.bar), range(1, 20));
  assert.deepEqual(first.phrases, [[1, 4], [5, 8], [9, 12], [13, 16], [17, 20]]);
  assert.deepEqual(first.plan.map(phrase => phrase.bars), first.phrases);   // only this part's plan
  assert.deepEqual(first.part, { index: 1, of: 2, bars: [1, 20], tuneBars: 36, previousChords: [], changedInARowBefore: 0 });
  assert.deepEqual(second.slots.map(slot => slot.bar), range(21, 36));
  assert.deepEqual(second.plan.map(phrase => phrase.bars), second.phrases);
  assert.deepEqual({ ...second.part, previousChords: null }, { index: 2, of: 2, bars: [21, 36], tuneBars: 36, previousChords: null, changedInARowBefore: 2 });
  // What sounds before bar 21 as chosen, not as written: the ii in another quality, the V as Db7.
  const [ii, v] = second.part.previousChords;
  assert.deepEqual(v, { bar: 20, beat: 1, chord: 'Db7', technique: 'tritone-sub' });
  assert.deepEqual([ii.bar, ii.beat, ii.technique], [19, 1, 'quality-change']);
  assert.notEqual(ii.chord, 'Dm7');

  // Validation and scores stay on the whole tune: the run of bars 19–21 crosses the boundary.
  assert.equal(result.scores.maxRun, 3);
  assert.equal(result.scores.density, 19 / 36);
  assert.equal(result.scores.clashes, 0);
  assert.deepEqual(result.parts, [[1, 20], [21, 36]]);
  assert.deepEqual(result.calls.map(call => [call.action, call.part ?? null]), [['plan', null], ['execute', 1], ['execute', 2], ['review', 1], ['review', 2]]);
  assert.deepEqual(result.usage, { input_tokens: 50, output_tokens: 100 });
  assert.equal(parseGrid(result.grid).bars.length, 36);
});

test('a long piece: one review per part, all sent at once, each on its own slots; the guard judges them in order, on the whole tune', async () => {
  const review = input => (input.part.index === 1
    ? { verdict: 'Colour the opening.', changes: [{ bar: 1, slot: 1, candidateId: idOf(input, 1, 'quality-change'), why: 'A brighter tonic.' }] }
    : { verdict: 'More, everywhere.', changes: [21, 22, 25, 26].map(bar => ({ bar, slot: 1, candidateId: idOf(input, bar, 'quality-change'), why: 'More.' })) });
  const client = fakeClient(iiV, { review });
  const result = await reharmonize(client, piece(LONG), { style: 'tritone', intensity: 'medium' });

  const [first, second] = inputsOf(client, 'review');
  assert.deepEqual(first.part, { index: 1, of: 2, bars: [1, 20], tuneBars: 36 });
  assert.deepEqual(first.slots.map(slot => slot.bar), range(1, 20));
  assert.deepEqual(second.part, { index: 2, of: 2, bars: [21, 36], tuneBars: 36 });
  assert.deepEqual(second.slots.map(slot => slot.bar), range(21, 36));
  assert.equal(first.proposedGrid, result.draft.grid);                      // both read the whole draft
  assert.equal(second.proposedGrid, result.draft.grid);
  assert.equal(first.scores.density, 0.5);                                  // and the whole tune's scores

  // Part 1 stands (19 of 36); part 2 would make 23 of 36 and a run over bars 19–24, so it is undone alone.
  const [one, two] = result.review.parts;
  assert.deepEqual([one.bars, one.undone], [[1, 20], null]);
  assert.deepEqual(two.bars, [21, 36]);
  assert.match(two.undone, /density/);
  assert.match(two.undone, /run of 6/);
  assert.deepEqual(two.changes.map(change => change.bar), [21, 22, 25, 26]);  // what it proposed, for the record
  assert.deepEqual(result.review.changes.map(change => change.bar), [1]);    // what stands
  assert.equal(result.review.undone, null);
  assert.equal(result.review.verdict, 'Bars 1–20: Colour the opening. Bars 21–36: More, everywhere.');
  assert.deepEqual(result.slots.filter(slot => slot.revised).map(slot => slot.bar), [1]);
  assert.equal(result.slots[0].why, 'A brighter tonic.');
  assert.equal(result.scores.density, 19 / 36);
  assert.deepEqual(result.slots.slice(20, 22).map(slot => slot.changed), [false, false]);
});

test('a long piece: a part the model could not answer keeps the original; a proxy failure, or every part failing, stops the run', async () => {
  const cutPart = index => input => { if (input.part?.index === index) throw new AiError('truncated', `part ${index} was cut off`); };
  const client = fakeClient(byTechnique('tritone-sub'), { execute: cutPart(2) });
  const result = await reharmonize(client, piece(LONG), { style: 'tritone', intensity: 'medium' });
  assert.deepEqual(client.calls.map(call => call.action), ['plan', 'execute', 'execute', 'review', 'review']);
  assert.deepEqual(result.slots.filter(slot => slot.changed).map(slot => slot.bar), [4, 8, 12, 16, 20]);
  const failed = result.problems.find(problem => problem.stage === 'execute');
  assert.match(failed.reason, /21–36/);
  assert.match(failed.reason, /part 2 was cut off/);

  const everyPart = fakeClient(null, { execute: () => { throw new AiError('truncated', 'cut off'); } });
  await assert.rejects(() => reharmonize(everyPart, piece(LONG)), error => error instanceof AiError && error.kind === 'truncated');
  assert.deepEqual(everyPart.calls.map(call => call.action), ['plan', 'execute', 'execute']);

  const limited = fakeClient(null, { execute: () => { throw new AiError('rate-limited', 'slow down'); } });
  await assert.rejects(() => reharmonize(limited, piece(LONG)), error => error instanceof AiError && error.kind === 'rate-limited');
  assert.deepEqual(limited.calls.map(call => call.action), ['plan', 'execute']);

  // A short piece is one part: its execute failing fails the run, as before.
  const short = fakeClient(null, { execute: () => { throw new AiError('truncated', 'cut off'); } });
  await assert.rejects(() => reharmonize(short, piece(EIGHT)), error => error instanceof AiError && error.kind === 'truncated');
});

test('a long piece: a two-slot candidate that would cross into the next part is left out of the menu, and out of the plan\'s', async () => {
  const grid = barsOf(times(9, 'G7', 'Cmaj7', 'Cmaj7', 'Dm7'));             // bar 20, a ii, closes the first part
  const whole = generateCandidates(analyzePiece(piece(grid)), { style: 'coltrane', intensity: 'heavy' });
  const coltraneAt = (menu, bar) => menu.slots.find(slot => slot.bar === bar).candidates.some(c => c.technique === 'coltrane');
  assert.ok(coltraneAt(whole, 16) && coltraneAt(whole, 20));

  const client = fakeClient(null);
  const result = await reharmonize(client, piece(grid), { style: 'coltrane', intensity: 'heavy', review: false });
  const [first] = inputsOf(client, 'execute');
  const offered = bar => first.slots.find(slot => slot.bar === bar).candidates.some(c => c.technique === 'coltrane');
  assert.equal(offered(16), true);                                          // bars 16–17 stay inside the part
  assert.equal(offered(20), false);                                         // bars 20–21 would not
  assert.equal(coltraneAt(result.candidates, 20), false);
  const phrases = inputOf(client, 'plan').phrases;
  assert.ok(phrases.find(phrase => phrase.bars[0] === 13).techniques.includes('coltrane'));
  assert.equal(phrases.find(phrase => phrase.bars[0] === 17).techniques.includes('coltrane'), false);
});

test('every request of a long piece fits under the Worker\'s body limit, even with two chords a bar and full menus', async () => {
  const client = fakeClient(byTechnique('tritone-sub'));
  const tune = piece(barsOf(times(16, 'Dm7 G7', 'Cmaj7 A7', 'Dm7 G7', 'Cmaj7 C7')));   // 64 bars, 128 slots, no melody: every menu is full
  const result = await reharmonize(client, tune, { style: 'free', intensity: 'heavy' });
  assert.equal(result.parts.length, 4);
  for (const { action, options } of client.calls) {
    const bytes = Buffer.byteLength(JSON.stringify({ action, ...options }));   // the body client.js sends
    assert.ok(bytes <= MAX_BODY_BYTES, `${action}: ${bytes} bytes`);
  }
});
