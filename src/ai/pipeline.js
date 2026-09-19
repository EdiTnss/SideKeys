// The reharmonization pipeline: analysis → candidates → [plan] → execute → validation → scores.
// Claude only ever picks ids from the menu the code computed, so a chord that clashes with the
// melody cannot reach the piece. Everything the model gets wrong is recorded in `problems` and
// costs that slot its change, never the run: an invented id, a slot answered twice, a choice on
// a slot already covered by a two-slot candidate, or (a bug if it ever fires) a chord the
// validator rejects.
//
// Phase 3b wraps `execute` in two more calls, one round each:
// - `plan` comes first: a strategy and a few techniques per phrase, checked against the piece's
//   phrases and against what each phrase's menu can give, then handed to `execute`. When the
//   model cannot give one, the chords are chosen without it.
// - `review` comes last: another arranger reads the draft with its reasons and scores and may
//   change up to 4 slots, from the same menu. The code applies the changes and scores again; a
//   review that breaks a target the draft had met (density, run length, avoid notes) is undone
//   as a whole (Edi's choice), and a review that fails leaves the draft, already paid for.
// The `candidates` option is also what Phase 5's lock & regenerate will use to pin the slots the
// user liked.

import { analyzePiece } from '../theory/analysis.js';
import { generateCandidates, STYLES, TECHNIQUES } from '../theory/candidates.js';
import { resolveChoices, scoreReharm } from '../theory/scoring.js';
import { validateReharm } from '../theory/piece.js';
import { formatGrid, parseGrid } from '../theory/progressions.js';
import { AiError } from './client.js';
import { PROMPTS } from './prompts.js';

const EPSILON = 1e-6;
// How many chords a bar of grid text can hold: they split the bar equally.
const DIVISIONS = { 3: [1, 3], 4: [1, 2, 4] };
// When the proxy cannot be reached or refuses us, the next call would fail the same way.
const FATAL = new Set(['not-configured', 'network', 'forbidden', 'rate-limited']);
const PLAN_TECHNIQUES = 3;
const PLAN_MAX_TOKENS = 4096;
export const REVIEW_LIMIT = 4;

const keyOf = ({ bar, slot }) => `${bar}:${slot}`;

/**
 * reharmonize(client, piece, options) → {
 *   analyzed, candidates, plan, draft: { chosen, scores, grid }, review: { verdict, changes, undone } | null,
 *   reharmonized, slots, chosen, scores, grid, originalGrid, gridParses,
 *   issues, problems, repairs, model, usage, promptVersion, promptVersions, calls }
 * Options: style, intensity, maxPerSlot, maxTokens, effort, candidates, plan and review (true =
 * make that call), onStep(step) called before each call ('plan', 'execute', 'review').
 * Rejects only when a call fails in a way the run cannot go around (the client's AiError).
 */
export async function reharmonize(client, piece, {
  style = 'free', intensity = 'medium', maxPerSlot = 12, maxTokens = 8192, effort = 'medium', candidates: given = null,
  plan: planning = true, review: reviewing = true, onStep = null,
} = {}) {
  const analyzed = analyzePiece(piece);
  const candidates = given ?? generateCandidates(analyzed, { style, intensity, maxPerSlot });
  const problems = [];
  const repairs = [];
  const calls = [];
  const send = (action, input, limits) => {
    onStep?.(action);
    return ask(client, action, input, limits, calls);
  };

  let plan = null;
  if (planning) {
    const phrases = phraseMenus(analyzed, candidates, style);
    try {
      const { data } = await send('plan', { piece: analyzed, candidates, style, intensity, phrases }, { maxTokens: Math.min(maxTokens, PLAN_MAX_TOKENS), effort });
      plan = readPlan(data, phrases, problems);
    } catch (error) {
      if (!(error instanceof AiError) || FATAL.has(error.kind)) throw error;
      problems.push({ stage: 'plan', bar: null, slot: null, reason: `No plan (${error.message}); the chords were chosen without one.` });
    }
  }

  const { data, model } = await send('execute', { piece: analyzed, candidates, style, intensity, plan }, { maxTokens, effort });
  const answer = readAnswer(data, candidates, problems, repairs);
  const draft = settle(analyzed, answer.chosen, intensity, problems, 'execute');
  const originalGrid = formatGrid(piece.bars);
  const draftGrid = gridOf(analyzed, draft.slots);

  let final = draft;
  let why = answer.why;
  let review = null;
  const revised = new Set();
  if (reviewing) {
    try {
      const { data: verdict } = await send('review', {
        piece: analyzed, candidates, style, intensity, plan,
        draft: { grid: draftGrid, originalGrid, slots: detail(draft, why), scores: draft.scores },
      }, { maxTokens, effort });
      const { text, picks } = readReview(verdict, candidates, problems, repairs);
      const { chosen, changes } = applyPicks(draft.chosen, picks, candidates);
      const after = settle(analyzed, chosen, intensity, problems, 'review');
      const applied = changes.filter(change => !after.covered.has(keyOf(change)) && !after.rejected.has(keyOf(change)));
      const broken = brokenTargets(draft.scores, after.scores);
      review = { verdict: text, changes: applied, undone: broken.length ? `it ${broken.join(' and ')}` : null };
      if (!review.undone) {
        final = after;
        why = new Map(why);
        for (const change of applied) {
          why.set(keyOf(change), change.why);
          revised.add(keyOf(change));
        }
      }
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      problems.push({ stage: 'review', bar: null, slot: null, reason: `No review (${error.message}); the draft stands.` });
    }
  }

  // A slot the validator refused in the draft stays marked, unless the review replaced it.
  const rejected = final === draft
    ? draft.rejected
    : new Set([...[...draft.rejected].filter(key => !revised.has(key)), ...final.rejected]);
  const grid = final === draft ? draftGrid : gridOf(analyzed, final.slots);
  let gridParses = true;
  try {
    parseGrid(grid, { timeSignature: analyzed.timeSignature });
  } catch {
    gridParses = false;
  }

  const executeCall = calls.find(call => call.action === 'execute');
  return {
    analyzed,
    candidates,
    plan,
    draft: { chosen: draft.chosen, scores: draft.scores, grid: draftGrid },
    review,
    reharmonized: toPiece(piece, final.slots),
    slots: detail(final, why, { rejected, revised }),
    chosen: final.chosen,
    scores: final.scores,
    grid,
    originalGrid,
    gridParses,
    issues: final.validation.issues,
    problems,
    repairs,
    model,
    usage: totalUsage(calls),
    promptVersion: executeCall.promptVersion,
    promptVersions: Object.fromEntries(calls.map(call => [call.action, call.promptVersion])),
    calls,
  };
}

// Applies the choices to the piece and keeps only what it can take: a choice on a slot a
// two-slot candidate already covers is dropped, and so is (a bug if it ever fires) a chord the
// validator rejects. Then scores what is left, so the scores always describe the grid shown.
function settle(piece, chosen, intensity, problems, stage) {
  let slots = resolveChoices(piece, chosen);
  const covered = new Set(slots.filter(slot => slot.coveredBy).map(keyOf));
  const picked = new Set(chosen.map(keyOf));
  for (const slot of slots) {
    if (slot.coveredBy && picked.has(keyOf(slot))) {
      problems.push({ stage, bar: slot.bar, slot: slot.slot, reason: `Bar ${slot.bar} slot ${slot.slot} is covered by a two-slot candidate; the choice there was ignored.` });
    }
  }
  let kept = chosen.filter(choice => !covered.has(keyOf(choice)));

  const rejected = new Set();
  let validation = validateReharm(piece, slots);
  if (!validation.ok) {
    for (const reject of validation.rejects) {
      rejected.add(keyOf(reject));
      problems.push({ stage, ...reject });
    }
    kept = kept.filter(choice => !rejected.has(keyOf(choice)));
    slots = resolveChoices(piece, kept);
    validation = validateReharm(piece, slots);            // the originals may still hold avoid notes
  }
  return { chosen: kept, slots, validation, covered, rejected, scores: scoreReharm(piece, kept, { intensity }) };
}

// The resolved slots with their reason, their validation status and whether the review changed them.
function detail(settled, why, { rejected = settled.rejected, revised = new Set() } = {}) {
  const warned = new Set(settled.validation.issues.filter(issue => issue.relation === 'avoid').map(issue => keyOf(issue.slot)));
  return settled.slots.map(slot => {
    const key = keyOf(slot);
    return {
      ...slot,
      why: why.get(key) ?? '',
      status: rejected.has(key) ? 'rejected' : warned.has(key) ? 'warning' : 'ok',
      revised: revised.has(key),
    };
  });
}

const gridOf = (piece, slots) => formatGrid(toGridBars(piece, slots));

// One call through the client, recorded with its model, usage, prompt version and duration.
async function ask(client, action, input, { maxTokens, effort }, calls) {
  const prompt = PROMPTS[action];
  const started = now();
  const { data, model, usage } = await client.call(action, {
    system: prompt.system,
    messages: prompt.build(input),
    schema: prompt.schema,
    maxTokens,
    effort,
  });
  calls.push({ action, model, usage, promptVersion: prompt.version, ms: Math.round(now() - started) });
  return { data, model };
}

const now = () => globalThis.performance?.now() ?? Date.now();

// Every numeric usage field summed over the calls; null when no call reported any.
function totalUsage(calls) {
  const reported = calls.map(call => call.usage).filter(Boolean);
  if (reported.length === 0) return null;
  const total = {};
  for (const usage of reported) {
    for (const [field, value] of Object.entries(usage)) {
      if (typeof value === 'number') total[field] = (total[field] ?? 0) + value;
    }
  }
  return total;
}

// ---- The plan -----------------------------------------------------------------------------

// The piece's phrases, each with the techniques its menu can actually give, in the style's
// order of preference: a plan cannot promise what the candidates do not hold.
function phraseMenus(piece, candidates, style) {
  const priority = [...(STYLES[style] ?? STYLES.free), ...TECHNIQUES];
  return piece.analysis.phrases.map(([first, last]) => {
    const present = new Set(candidates.slots
      .filter(slot => slot.bar >= first && slot.bar <= last)
      .flatMap(slot => slot.candidates.map(candidate => candidate.technique))
      .filter(technique => technique !== 'original'));
    return { bars: [first, last], techniques: [...new Set(priority)].filter(technique => present.has(technique)) };
  });
}

// Keeps the entries that name one of the piece's phrases, once, with only the techniques that
// phrase can use. Null when nothing usable is left.
function readPlan(data, phrases, problems) {
  const report = reason => problems.push({ stage: 'plan', bar: null, slot: null, reason });
  const entries = Array.isArray(data?.phrases) ? data.phrases : null;
  if (!entries) {
    report('The plan had no list of phrases; the chords were chosen without one.');
    return null;
  }
  const byRange = new Map(phrases.map(phrase => [phrase.bars.join('–'), phrase]));
  const planned = new Map();
  for (const entry of entries) {
    const bars = Array.isArray(entry?.bars) ? entry.bars : [];
    const range = bars.join('–');
    const phrase = bars.length === 2 ? byRange.get(range) : null;
    if (!phrase) {
      report(`The plan named bars ${range || JSON.stringify(entry?.bars)}, which is not one of the piece's phrases; ignored.`);
      continue;
    }
    if (planned.has(range)) {
      report(`The plan gave bars ${range} twice; the first stands.`);
      continue;
    }
    const techniques = [];
    for (const technique of Array.isArray(entry.techniques) ? entry.techniques : []) {
      if (techniques.includes(technique)) continue;
      if (!phrase.techniques.includes(technique)) {
        report(`The plan named ${technique} for bars ${range}, where the menu has none; dropped.`);
        continue;
      }
      if (techniques.length < PLAN_TECHNIQUES) techniques.push(technique);
    }
    planned.set(range, { bars: [...phrase.bars], strategy: typeof entry.strategy === 'string' ? entry.strategy : '', techniques });
  }
  const plan = phrases.map(phrase => planned.get(phrase.bars.join('–'))).filter(Boolean);
  if (plan.length === 0) {
    report('The plan named none of the piece\'s phrases; the chords were chosen without one.');
    return null;
  }
  return plan;
}

// ---- The choices --------------------------------------------------------------------------

// Execute's answer as choices: the slots it moved off the original, and every reason it gave.
function readAnswer(data, candidates, problems, repairs) {
  const entries = Array.isArray(data?.bars) ? data.bars : null;
  if (!entries) {
    problems.push({ stage: 'execute', bar: null, slot: null, reason: 'The answer had no list of bars, so nothing changed.' });
    return { chosen: [], why: new Map() };
  }
  const picks = readPicks(entries, candidates, problems, repairs, 'execute');
  return {
    chosen: picks.filter(pick => pick.candidate.technique !== 'original').map(({ bar, slot, candidate }) => ({ bar, slot, candidate })),
    why: new Map(picks.filter(pick => typeof pick.why === 'string').map(pick => [keyOf(pick), pick.why])),
  };
}

// The review's answer: its verdict and the first REVIEW_LIMIT entries as picks.
function readReview(data, candidates, problems, repairs) {
  const text = typeof data?.verdict === 'string' ? data.verdict : '';
  let entries = Array.isArray(data?.changes) ? data.changes : null;
  if (!entries) {
    problems.push({ stage: 'review', bar: null, slot: null, reason: 'The review had no list of changes, so the draft stands.' });
    return { text, picks: [] };
  }
  if (entries.length > REVIEW_LIMIT) {
    problems.push({ stage: 'review', bar: null, slot: null, reason: `The review listed ${entries.length} changes; only the first ${REVIEW_LIMIT} were read.` });
    entries = entries.slice(0, REVIEW_LIMIT);
  }
  return { text, picks: readPicks(entries, candidates, problems, repairs, 'review') };
}

// Entries → [{ bar, slot, candidate, why }], each candidate taken from that slot's menu.
// Anything unusable becomes a problem and leaves the slot as it was.
function readPicks(entries, candidates, problems, repairs, stage) {
  const report = (bar, slot, reason) => problems.push({ stage, bar, slot, reason });
  const menu = new Map(candidates.slots.map(slot => [keyOf(slot), slot]));
  const taken = new Set();
  const picks = [];
  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.bar) || !Number.isInteger(entry.slot)) {
      report(null, null, `An entry without a bar and slot was ignored: ${JSON.stringify(entry)}`);
      continue;
    }
    const key = keyOf(entry);
    const slot = menu.get(key);
    if (!slot) {
      report(entry.bar, entry.slot, `There is no slot ${entry.slot} in bar ${entry.bar}.`);
      continue;
    }
    if (taken.has(key)) {
      report(entry.bar, entry.slot, `Bar ${entry.bar} slot ${entry.slot} was answered twice; the first answer stands.`);
      continue;
    }
    const exact = slot.candidates.find(option => option.id === entry.candidateId);
    const candidate = exact ?? matchBySymbols(slot, entry.candidateId);
    if (!candidate) {
      report(entry.bar, entry.slot, `"${entry.candidateId}" is not a candidate for bar ${entry.bar}; ${stage === 'review' ? 'the draft stays' : 'the original stays'}.`);
      continue;
    }
    if (!exact) repairs.push({ stage, bar: entry.bar, slot: entry.slot, wrote: entry.candidateId, used: candidate.id });
    taken.add(key);
    picks.push({ bar: entry.bar, slot: entry.slot, candidate, why: entry.why });
  }
  return picks;
}

// The review's picks laid over the draft's choices. A pick of the "-orig" candidate puts the
// original back; a pick of what the slot already has is not a change.
function applyPicks(draftChosen, picks, candidates) {
  const chosen = new Map(draftChosen.map(choice => [keyOf(choice), choice]));
  const menu = new Map(candidates.slots.map(slot => [keyOf(slot), slot]));
  const changes = [];
  for (const pick of picks) {
    const key = keyOf(pick);
    const from = chosen.get(key)?.candidate.id ?? menu.get(key).candidates.find(option => option.technique === 'original')?.id ?? null;
    if (from === pick.candidate.id) continue;
    if (pick.candidate.technique === 'original') chosen.delete(key);
    else chosen.set(key, { bar: pick.bar, slot: pick.slot, candidate: pick.candidate });
    changes.push({ bar: pick.bar, slot: pick.slot, from, to: pick.candidate.id, why: typeof pick.why === 'string' ? pick.why : '' });
  }
  return { chosen: [...chosen.values()], changes };
}

// The targets the draft met and the review would break. Bass smoothness and technique mix are
// taste, the review may trade them; these three are the brief.
function brokenTargets(before, after) {
  const broken = [];
  if (before.densityOk && !after.densityOk) broken.push('took the density out of its target');
  if (before.maxRunOk && !after.maxRunOk) broken.push(`made a run of ${after.maxRun} changed slots`);
  if (after.warnings > before.warnings) broken.push('added avoid notes');
  return broken;
}

// The model sometimes shortens an id, writing "b2s1-Ab7" for "b2s1-chromatic-approach-Ab7".
// Matching what is left against the candidates' own chord symbols recovers the choice it meant
// without loosening anything: the chords still come from the menu the code computed.
function matchBySymbols(slot, id) {
  if (typeof id !== 'string') return null;
  const wanted = id.replace(/^b\d+s\d+-/, '').trim().toLowerCase();
  if (!wanted) return null;
  const matches = slot.candidates.filter(option => option.chords.map(chord => chord.symbol).join('_').toLowerCase() === wanted);
  return matches.length === 1 ? matches[0] : null;
}

// ---- The reharmonized piece ---------------------------------------------------------------

// A plain piece with the chosen chords at their real onsets (a related ii at beat 4 stays at
// beat 4, unlike the grid text) and the melody untouched: what realize.js plays.
function toPiece(piece, slots) {
  const chordsPerBar = piece.bars.map(() => []);
  for (const slot of slots) {
    for (const chord of slot.chords) {
      if (chord.bar >= 1 && chord.bar <= chordsPerBar.length) chordsPerBar[chord.bar - 1].push({ symbol: chord.symbol, beat: chord.beat });
    }
  }
  return {
    ...piece,
    timeSignature: [...piece.timeSignature],
    bars: piece.bars.map((bar, i) => ({
      chords: chordsPerBar[i].length ? chordsPerBar[i].sort((a, b) => a.beat - b.beat) : bar.chords.map(chord => ({ ...chord })),
      melody: bar.melody.map(note => ({ ...note })),
    })),
  };
}

// ---- Back to grid text --------------------------------------------------------------------

function toGridBars(piece, slots) {
  const beatsPerBar = piece.timeSignature[0];
  const perBar = piece.bars.map(() => []);
  for (const slot of slots) {
    for (const chord of slot.chords) {
      if (chord.bar >= 1 && chord.bar <= perBar.length) perBar[chord.bar - 1].push({ symbol: chord.symbol, beat: chord.beat });
    }
  }
  return perBar.map((chords, i) => {
    if (chords.length === 0) return { chords: piece.bars[i].chords.map(chord => ({ symbol: chord.symbol, beat: chord.beat })) };
    return { chords: expand([...chords].sort((a, b) => a.beat - b.beat), beatsPerBar) };
  });
}

// Chords in a bar of grid text split it equally, so the onsets have to sit on one of those
// divisions. A bar of Dm7 at 1, Dm7 at 3 and G7 at 4 is written out as four chords.
function expand(chords, beatsPerBar) {
  for (const count of DIVISIONS[beatsPerBar] ?? [1]) {
    const step = beatsPerBar / count;
    const onsets = Array.from({ length: count }, (_, i) => 1 + i * step);
    const fits = chords.every(chord => onsets.some(onset => Math.abs(onset - chord.beat) < EPSILON));
    if (fits) return onsets.map(beat => ({ symbol: soundingAt(chords, beat), beat }));
  }
  return chords;                                              // off the beat: the caller reports gridParses false
}

function soundingAt(chords, beat) {
  let symbol = chords[0].symbol;
  for (const chord of chords) {
    if (chord.beat <= beat + EPSILON) symbol = chord.symbol;
  }
  return symbol;
}
