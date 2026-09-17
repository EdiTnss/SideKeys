// Phase 3a's pipeline: analysis → candidates → one `execute` call → validation → scores.
// Claude only ever picks ids from the menu the code computed, so a chord that clashes with the
// melody cannot reach the piece. Everything the model gets wrong is recorded in `problems` and
// costs that slot its change, never the run: an invented id, a slot answered twice, a choice on
// a slot already covered by a two-slot candidate, or (a bug if it ever fires) a chord the
// validator rejects.
//
// Phase 3b adds `plan` and `review` around this; the `candidates` option is also what Phase 5's
// lock & regenerate will use to pin the slots the user liked.

import { analyzePiece } from '../theory/analysis.js';
import { generateCandidates } from '../theory/candidates.js';
import { resolveChoices, scoreReharm } from '../theory/scoring.js';
import { validateReharm } from '../theory/piece.js';
import { formatGrid, parseGrid } from '../theory/progressions.js';
import { PROMPTS } from './prompts.js';

const EPSILON = 1e-6;
// How many chords a bar of grid text can hold: they split the bar equally.
const DIVISIONS = { 3: [1, 3], 4: [1, 2, 4] };

/**
 * reharmonize(client, piece, options) → {
 *   analyzed, candidates, slots, chosen, scores, grid, originalGrid, gridParses,
 *   problems, model, usage, promptVersion }
 * Rejects only when the call itself fails (the client's AiError).
 */
export async function reharmonize(client, piece, {
  style = 'free', intensity = 'medium', maxPerSlot = 12, maxTokens = 8192, effort = 'medium', candidates: given = null,
} = {}) {
  const analyzed = analyzePiece(piece);
  const candidates = given ?? generateCandidates(analyzed, { style, intensity, maxPerSlot });
  const prompt = PROMPTS.execute;
  const { data, model, usage } = await client.call('execute', {
    system: prompt.system,
    messages: prompt.build({ piece: analyzed, candidates, style, intensity }),
    schema: prompt.schema,
    maxTokens,
    effort,
  });

  const problems = [];
  let { chosen, why } = readAnswer(data, candidates, problems);
  let slots = resolveChoices(analyzed, chosen);
  reportCovered(slots, chosen, problems);

  const rejected = new Set();
  let validation = validateReharm(analyzed, slots);
  if (!validation.ok) {
    for (const reject of validation.rejects) {
      rejected.add(`${reject.bar}:${reject.slot}`);
      problems.push(reject);
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

  return {
    analyzed,
    candidates,
    slots: detailed,
    chosen,
    scores: scoreReharm(analyzed, chosen, { intensity }),
    grid,
    originalGrid: formatGrid(piece.bars),
    gridParses,
    issues: validation.issues,
    problems,
    model,
    usage,
    promptVersion: prompt.version,
  };
}

// Turns the model's answer into choices. Anything unusable becomes a problem and leaves the
// slot on its original chord.
function readAnswer(data, candidates, problems) {
  const chosen = [];
  const why = new Map();
  const entries = Array.isArray(data?.bars) ? data.bars : null;
  if (!entries) {
    problems.push({ bar: null, slot: null, reason: 'The answer had no list of bars, so nothing changed.' });
    return { chosen, why };
  }

  const menu = new Map(candidates.slots.map(slot => [`${slot.bar}:${slot.slot}`, slot]));
  const taken = new Set();
  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.bar) || !Number.isInteger(entry.slot)) {
      problems.push({ bar: null, slot: null, reason: `An entry without a bar and slot was ignored: ${JSON.stringify(entry)}` });
      continue;
    }
    const key = `${entry.bar}:${entry.slot}`;
    const slot = menu.get(key);
    if (!slot) {
      problems.push({ bar: entry.bar, slot: entry.slot, reason: `There is no slot ${entry.slot} in bar ${entry.bar}.` });
      continue;
    }
    if (taken.has(key)) {
      problems.push({ bar: entry.bar, slot: entry.slot, reason: `Bar ${entry.bar} slot ${entry.slot} was answered twice; the first answer stands.` });
      continue;
    }
    const candidate = slot.candidates.find(option => option.id === entry.candidateId);
    if (!candidate) {
      problems.push({ bar: entry.bar, slot: entry.slot, reason: `"${entry.candidateId}" is not a candidate for bar ${entry.bar}; the original stays.` });
      continue;
    }
    taken.add(key);
    if (typeof entry.why === 'string') why.set(key, entry.why);
    if (candidate.technique !== 'original') chosen.push({ bar: entry.bar, slot: entry.slot, candidate });
  }
  return { chosen, why };
}

// A two-slot candidate already owns the slot after it; a choice there was never applied.
function reportCovered(slots, chosen, problems) {
  const picked = new Set(chosen.map(choice => `${choice.bar}:${choice.slot}`));
  for (const slot of slots) {
    if (slot.coveredBy && picked.has(`${slot.bar}:${slot.slot}`)) {
      problems.push({ bar: slot.bar, slot: slot.slot, reason: `Bar ${slot.bar} slot ${slot.slot} is covered by a two-slot candidate; the choice there was ignored.` });
    }
  }
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
