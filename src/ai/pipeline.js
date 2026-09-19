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
//
// A long piece goes in parts (splitIntoParts): at most MAX_PART_SLOTS slots each, cut at phrase
// boundaries, so every request stays under the Worker's 64 KB body limit and every answer well
// under the output cap. The plan still sees the whole tune. Execute runs part by part, in order,
// each told the last two chords chosen before it and how many changed slots in a row it inherits.
// Then one review per part, all sent at once; the guard judges them in order, on the whole tune.
// Validation and scores always run on the whole tune. A piece that fits is one part and runs
// exactly as before.

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
export const REVIEW_LIMIT = 4;
// A part of 32 slots with full menus sends ~43 KB to execute and ~47 KB to review, under the
// Worker's 64 KB, and gets ~3,000 tokens back. Measured on 2026-09-19; the size test guards it.
export const MAX_PART_SLOTS = 32;

const keyOf = ({ bar, slot }) => `${bar}:${slot}`;

/**
 * reharmonize(client, piece, options) → {
 *   analyzed, candidates, parts, plan, draft: { chosen, scores, grid },
 *   review: { verdict, changes, undone, parts? } | null,
 *   reharmonized, slots, chosen, scores, grid, originalGrid, gridParses,
 *   issues, problems, repairs, model, usage, promptVersion, promptVersions, calls }
 * Options: style, intensity, maxPerSlot, maxTokens, effort, candidates, plan and review (true =
 * make that call), onStep(step, info) called before each call ('plan', 'execute', 'review'); info
 * is null for a piece in one part, else { part, parts, bars } before each execute and { parts }
 * before the reviews, which go out together.
 * `parts` is the bar range of every part; with more than one, `review.parts` holds each part's
 * { bars, verdict, changes, undone }, and `review.changes` only the changes that stand.
 * Rejects only when a call fails in a way the run cannot go around (the client's AiError).
 */
export async function reharmonize(client, piece, {
  style = 'free', intensity = 'medium', maxPerSlot = 12, maxTokens = 8192, effort = 'medium', candidates: given = null,
  plan: planning = true, review: reviewing = true, onStep = null,
} = {}) {
  const analyzed = analyzePiece(piece);
  const parts = splitIntoParts(analyzed, given ?? generateCandidates(analyzed, { style, intensity, maxPerSlot }));
  const several = parts.length > 1;
  // The menu the model actually sees: without the two-slot candidates that would cross a part.
  const candidates = several ? { slots: parts.flatMap(part => part.candidates.slots) } : parts[0].candidates;
  const problems = [];
  const repairs = [];
  const calls = [];
  const limits = { maxTokens, effort };
  const step = (action, info = null) => onStep?.(action, info);

  let plan = null;
  if (planning) {
    const phrases = phraseMenus(analyzed, candidates, style);
    step('plan');
    try {
      const { data } = await ask(client, 'plan', { piece: analyzed, candidates, style, intensity, phrases }, limits, calls);
      plan = readPlan(data, phrases, problems);
    } catch (error) {
      if (!(error instanceof AiError) || FATAL.has(error.kind)) throw error;
      problems.push({ stage: 'plan', bar: null, slot: null, reason: `No plan (${error.message}); the chords were chosen without one.` });
    }
  }

  // Part by part, in order: each one needs to know what the one before chose.
  const chosen = [];
  let why = new Map();
  let model = null;
  let answered = 0;
  let failure = null;
  for (const [i, part] of parts.entries()) {
    step('execute', several ? { part: i + 1, parts: parts.length, bars: [...part.bars] } : null);
    try {
      const context = several ? partContext(analyzed, parts, i, chosen) : null;
      const input = { piece: analyzed, candidates: part.candidates, style, intensity, plan: planFor(plan, part, several), part: context };
      const { data, model: answeredBy } = await ask(client, 'execute', input, limits, calls, several ? i + 1 : null);
      const answer = readAnswer(data, part.candidates, problems, repairs);
      chosen.push(...answer.chosen);
      for (const [key, reason] of answer.why) why.set(key, reason);
      model = answeredBy;
      answered++;
    } catch (error) {
      if (!several || !(error instanceof AiError) || FATAL.has(error.kind)) throw error;
      failure = error;
      problems.push({ stage: 'execute', bar: null, slot: null, reason: `No chords for bars ${part.bars.join('–')} (${error.message}); they keep the original.` });
    }
  }
  if (answered === 0) throw failure;

  const draft = settle(analyzed, chosen, intensity, problems, 'execute');
  const originalGrid = formatGrid(piece.bars);
  const draftGrid = gridOf(analyzed, draft.slots);

  let final = draft;
  let review = null;
  const revised = new Set();
  const rejectedLater = new Set();
  if (reviewing) {
    step('review', several ? { parts: parts.length } : null);
    const draftInput = { grid: draftGrid, originalGrid, slots: detail(draft, why), scores: draft.scores };
    // All at once: every review reads the same finished draft and touches only its own slots.
    // A failed call comes back as { error }, so the other parts still count; a bug still throws.
    const answers = await Promise.all(parts.map((part, i) => ask(client, 'review', {
      piece: analyzed, candidates: part.candidates, style, intensity, plan: planFor(plan, part, several), draft: draftInput,
      part: several ? { index: i + 1, of: parts.length, bars: [...part.bars], tuneBars: analyzed.bars.length } : null,
    }, limits, calls, several ? i + 1 : null).then(({ data }) => ({ data }), error => {
      if (!(error instanceof AiError)) throw error;
      return { error };
    })));

    // Applied in order, each judged against the tune as the reviews before it left it.
    const outcomes = [];
    why = new Map(why);
    for (const [i, part] of parts.entries()) {
      const { data, error } = answers[i];
      if (error) {
        problems.push({ stage: 'review', bar: null, slot: null, reason: `No review${several ? ` for bars ${part.bars.join('–')}` : ''} (${error.message}); the draft stands.` });
        continue;
      }
      const { text, picks } = readReview(data, part.candidates, problems, repairs);
      const { chosen: picked, changes } = applyPicks(final.chosen, picks, part.candidates);
      const after = settle(analyzed, picked, intensity, problems, 'review');
      const applied = changes.filter(change => !after.covered.has(keyOf(change)) && !after.rejected.has(keyOf(change)));
      const broken = brokenTargets(final.scores, after.scores);
      const outcome = { bars: [...part.bars], verdict: text, changes: applied, undone: broken.length ? `it ${broken.join(' and ')}` : null };
      outcomes.push(outcome);
      if (outcome.undone) continue;
      final = after;
      for (const key of after.rejected) rejectedLater.add(key);
      for (const change of applied) {
        why.set(keyOf(change), change.why);
        revised.add(keyOf(change));
      }
    }
    review = reviewOf(outcomes, several);
  }

  // A slot the validator refused in the draft stays marked, unless a review replaced it.
  const rejected = new Set([...[...draft.rejected].filter(key => !revised.has(key)), ...rejectedLater]);
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
    parts: parts.map(part => [...part.bars]),
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

// One call through the client, recorded with its model, usage, prompt version and duration, and
// with the part it was for when the piece has several.
async function ask(client, action, input, { maxTokens, effort }, calls, part = null) {
  const prompt = PROMPTS[action];
  const started = now();
  const { data, model, usage } = await client.call(action, {
    system: prompt.system,
    messages: prompt.build(input),
    schema: prompt.schema,
    maxTokens,
    effort,
  });
  calls.push({ action, ...(part ? { part } : {}), model, usage, promptVersion: prompt.version, ms: Math.round(now() - started) });
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

// ---- The parts of a long piece ------------------------------------------------------------

/**
 * splitIntoParts(analyzedPiece, candidates, { maxSlots }) →
 *   [{ bars: [first, last], phrases: [[first, last]], candidates: { slots } }]
 * A piece of up to maxSlots slots is one part, with the very menu it was given. A longer one is
 * cut at phrase boundaries into the fewest parts that fit, as even as the phrases allow (36
 * slots in phrases of 4 make 20 + 16, not 32 + 4). A phrase too big for a part on its own is cut
 * at bar lines. A two-slot candidate that would cross into the next part is left out of the
 * part's menu.
 */
export function splitIntoParts(piece, candidates, { maxSlots = MAX_PART_SLOTS } = {}) {
  const { phrases } = piece.analysis;
  if (candidates.slots.length <= maxSlots) {
    return [{ bars: [1, piece.bars.length], phrases: phrases.map(phrase => [...phrase]), candidates }];
  }
  const slotsIn = (first, last) => candidates.slots.filter(slot => slot.bar >= first && slot.bar <= last).length;
  const units = phrases.flatMap(([first, last]) => {
    const size = slotsIn(first, last);
    if (size <= maxSlots) return [{ first, last, size }];
    return Array.from({ length: last - first + 1 }, (_, i) => ({ first: first + i, last: first + i, size: slotsIn(first + i, first + i) }));
  });
  // Greedy packing gives the fewest parts; the smallest capacity that still packs into that
  // many evens them out.
  const pack = capacity => {
    const groups = [];
    for (const unit of units) {
      const open = groups.at(-1);
      if (open && open.size + unit.size <= capacity) Object.assign(open, { last: unit.last, size: open.size + unit.size });
      else groups.push({ ...unit });
    }
    return groups;
  };
  const fewest = pack(maxSlots).length;
  let capacity = Math.ceil(candidates.slots.length / fewest);
  while (pack(capacity).length > fewest) capacity++;

  return pack(capacity).map(({ first, last }) => {
    const slots = candidates.slots.filter(slot => slot.bar >= first && slot.bar <= last);
    return {
      bars: [first, last],
      phrases: phrases.filter(([a, b]) => a <= last && b >= first).map(([a, b]) => [Math.max(a, first), Math.min(b, last)]),
      candidates: {
        slots: slots.map((slot, i) => {
          const room = slots.length - i;                          // slots left in the part, this one included
          const inside = slot.candidates.filter(candidate => (candidate.spans ?? 1) <= room);
          return inside.length === slot.candidates.length ? slot : { ...slot, candidates: inside };
        }),
      },
    };
  });
}

// What a part needs from the tune around it: where it sits, its phrases, the last two chords
// already chosen before it (as they sound, for the bass) and the run of changed slots it inherits.
function partContext(piece, parts, index, chosen) {
  const { bars: [first, last], phrases } = parts[index];
  const before = resolveChoices(piece, chosen).filter(slot => slot.bar < first);
  let run = 0;
  for (const slot of before) run = slot.changed ? run + 1 : 0;
  const sounding = before.flatMap(slot => slot.chords.map(chord => ({ bar: chord.bar, beat: chord.beat, chord: chord.symbol, technique: slot.technique })));
  return {
    index: index + 1,
    of: parts.length,
    bars: [first, last],
    tuneBars: piece.bars.length,
    phrases,
    previousChords: sounding.slice(-2),
    changedInARowBefore: run,
  };
}

// The plan entries of a part's phrases, or null when it has none.
function planFor(plan, part, several) {
  if (!plan || !several) return plan;
  const [first, last] = part.bars;
  const entries = plan.filter(({ bars: [a, b] }) => a <= last && b >= first);
  return entries.length ? entries : null;
}

// The reviews' outcomes as the result reports them: one part reads as it always did; several
// keep their own outcome in `parts`, and the summary lists only the changes that stand.
function reviewOf(outcomes, several) {
  if (outcomes.length === 0) return null;
  if (!several) {
    const [{ verdict, changes, undone }] = outcomes;
    return { verdict, changes, undone };
  }
  return {
    verdict: outcomes.map(outcome => `Bars ${outcome.bars.join('–')}: ${outcome.verdict}`).join(' '),
    changes: outcomes.filter(outcome => !outcome.undone).flatMap(outcome => outcome.changes),
    undone: null,
    parts: outcomes,
  };
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
