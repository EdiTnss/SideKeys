// The reharmonization pipeline: analysis → candidates → [plan] → execute → validation → scores.
// Claude only ever picks ids from the menu the code computed, so a chord that clashes with the
// melody cannot reach the piece. Everything the model gets wrong is recorded in `problems` and
// costs that slot its change, never the run: an invented id, a slot answered twice, a choice on
// a slot already covered by a two-slot candidate, or (a bug if it ever fires) a chord the
// validator rejects.
//
// `plan` (Phase 3b) comes first: a strategy and a few techniques per phrase, checked against the
// piece's phrases and against what each phrase's menu can give, then handed to `execute`. It is
// an extra: when the model cannot give one, the chords are chosen without it. The `candidates`
// option is also what Phase 5's lock & regenerate will use to pin the slots the user liked.

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

/**
 * reharmonize(client, piece, options) → {
 *   analyzed, candidates, plan, reharmonized, slots, chosen, scores, grid, originalGrid, gridParses,
 *   issues, problems, repairs, model, usage, promptVersion, promptVersions, calls }
 * Options: style, intensity, maxPerSlot, maxTokens, effort, candidates, plan (true = ask for a
 * plan first), onStep(step) called before each call ('plan', 'execute').
 * Rejects only when a call fails in a way the run cannot go around (the client's AiError).
 */
export async function reharmonize(client, piece, {
  style = 'free', intensity = 'medium', maxPerSlot = 12, maxTokens = 8192, effort = 'medium', candidates: given = null,
  plan: planning = true, onStep = null,
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
  let { chosen, why } = readAnswer(data, candidates, problems, repairs);
  let slots = resolveChoices(analyzed, chosen);
  reportCovered(slots, chosen, problems);

  const rejected = new Set();
  let validation = validateReharm(analyzed, slots);
  if (!validation.ok) {
    for (const reject of validation.rejects) {
      rejected.add(`${reject.bar}:${reject.slot}`);
      problems.push({ stage: 'execute', ...reject });
    }
    chosen = chosen.filter(choice => !rejected.has(`${choice.bar}:${choice.slot}`));
    slots = resolveChoices(analyzed, chosen);
    validation = validateReharm(analyzed, slots);            // the originals may still hold avoid notes
  }

  const warned = new Set(validation.issues.filter(issue => issue.relation === 'avoid').map(issue => `${issue.slot.bar}:${issue.slot.slot}`));
  const detailed = slots.map(slot => {
    const key = `${slot.bar}:${slot.slot}`;
    return {
      ...slot,
      why: why.get(key) ?? '',
      status: rejected.has(key) ? 'rejected' : warned.has(key) ? 'warning' : 'ok',
    };
  });

  const grid = formatGrid(toGridBars(analyzed, slots));
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
    reharmonized: toPiece(piece, slots),
    slots: detailed,
    chosen,
    scores: scoreReharm(analyzed, chosen, { intensity }),
    grid,
    originalGrid: formatGrid(piece.bars),
    gridParses,
    issues: validation.issues,
    problems,
    repairs,
    model,
    usage: totalUsage(calls),
    promptVersion: executeCall.promptVersion,
    promptVersions: Object.fromEntries(calls.map(call => [call.action, call.promptVersion])),
    calls,
  };
}

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

// Turns the model's answer into choices. Anything unusable becomes a problem and leaves the
// slot on its original chord.
function readAnswer(data, candidates, problems, repairs) {
  const chosen = [];
  const why = new Map();
  const report = (bar, slot, reason) => problems.push({ stage: 'execute', bar, slot, reason });
  const entries = Array.isArray(data?.bars) ? data.bars : null;
  if (!entries) {
    report(null, null, 'The answer had no list of bars, so nothing changed.');
    return { chosen, why };
  }

  const menu = new Map(candidates.slots.map(slot => [`${slot.bar}:${slot.slot}`, slot]));
  const taken = new Set();
  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.bar) || !Number.isInteger(entry.slot)) {
      report(null, null, `An entry without a bar and slot was ignored: ${JSON.stringify(entry)}`);
      continue;
    }
    const key = `${entry.bar}:${entry.slot}`;
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
      report(entry.bar, entry.slot, `"${entry.candidateId}" is not a candidate for bar ${entry.bar}; the original stays.`);
      continue;
    }
    if (!exact) repairs.push({ bar: entry.bar, slot: entry.slot, wrote: entry.candidateId, used: candidate.id });
    taken.add(key);
    if (typeof entry.why === 'string') why.set(key, entry.why);
    if (candidate.technique !== 'original') chosen.push({ bar: entry.bar, slot: entry.slot, candidate });
  }
  return { chosen, why };
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

// A two-slot candidate already owns the slot after it; a choice there was never applied.
function reportCovered(slots, chosen, problems) {
  const picked = new Set(chosen.map(choice => `${choice.bar}:${choice.slot}`));
  for (const slot of slots) {
    if (slot.coveredBy && picked.has(`${slot.bar}:${slot.slot}`)) {
      problems.push({ stage: 'execute', bar: slot.bar, slot: slot.slot, reason: `Bar ${slot.bar} slot ${slot.slot} is covered by a two-slot candidate; the choice there was ignored.` });
    }
  }
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
