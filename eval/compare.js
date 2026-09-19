// Phase 3b's measured comparison: the same piece through `execute` alone (Phase 3a) and through
// `plan + execute + review`, several times each, because the model never answers the same way
// twice. Reports bass smoothness and technique mix (the DoD's two metrics) with the rest of the
// scores, the time and an estimated cost, and writes every run to eval/reports/.
//
// Needs the local Worker (npm --prefix worker run dev). Run from the repo root:
//   node eval/compare.js --runs 3
// Options: --piece eval/pieces/study-in-f.json --style tritone --intensity medium
//          --proxy http://127.0.0.1:8787/
// The seed of eval/run.js (Phase 5).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fromJSON } from '../src/theory/piece.js';
import { createClient } from '../src/ai/client.js';
import { reharmonize } from '../src/ai/pipeline.js';

// claude-opus-5, US dollars per million tokens (Anthropic's price list, checked 2026-09-19).
const PRICE = { input: 5, output: 25 };
const ORIGIN = 'http://localhost:3000';          // the Worker only answers allowed origins

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '3' },
    piece: { type: 'string', default: 'eval/pieces/study-in-f.json' },
    style: { type: 'string', default: 'tritone' },
    intensity: { type: 'string', default: 'medium' },
    proxy: { type: 'string', default: 'http://127.0.0.1:8787/' },
  },
});
const runs = Number(args.runs);
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');

const piece = fromJSON(readFileSync(args.piece, 'utf8'));
const withOrigin = (url, init) => fetch(url, { ...init, headers: { ...init.headers, origin: ORIGIN } });
const client = createClient({ baseUrl: args.proxy, fetch: withOrigin });
const MODES = {
  execute: { plan: false, review: false },
  full: { plan: true, review: true },
};

const cost = usage => ((usage?.input_tokens ?? 0) * PRICE.input + (usage?.output_tokens ?? 0) * PRICE.output) / 1e6;
const pick = scores => ({
  bassSmoothness: scores.bassSmoothness,
  techniqueMix: scores.techniqueMix,
  density: scores.density,
  densityOk: scores.densityOk,
  maxRun: scores.maxRun,
  clashes: scores.clashes,
  warnings: scores.warnings,
});

console.log(`${piece.title}: ${piece.bars.length} bars, ${args.style} / ${args.intensity}, ${runs} run(s) per mode\n`);
const results = [];
for (let run = 1; run <= runs; run++) {
  for (const [mode, options] of Object.entries(MODES)) {          // interleaved, so both modes see the same conditions
    const started = Date.now();
    try {
      const result = await reharmonize(client, piece, { style: args.style, intensity: args.intensity, ...options });
      const entry = {
        run, mode,
        seconds: (Date.now() - started) / 1000,
        cost: cost(result.usage),
        usage: result.usage,
        scores: pick(result.scores),
        draftScores: mode === 'full' ? pick(result.draft.scores) : null,
        grid: result.grid,
        draftGrid: mode === 'full' ? result.draft.grid : null,
        plan: result.plan,
        review: result.review,
        problems: result.problems,
        repairs: result.repairs,
        parts: result.parts,
        calls: result.calls.map(({ action, part, usage, ms, promptVersion }) => ({ action, part, usage, ms, promptVersion })),
      };
      results.push(entry);
      const review = entry.review ? (entry.review.undone ? `review undone (${entry.review.undone})` : `review changed ${entry.review.changes.length}`) : '';
      console.log(`run ${run} ${mode.padEnd(7)} ${entry.seconds.toFixed(1).padStart(5)} s  bass ${entry.scores.bassSmoothness.toFixed(2)}  techniques ${entry.scores.techniqueMix}  density ${pct(entry.scores.density)}${entry.scores.densityOk ? '' : ' (off target)'}  ${review}`);
      console.log(`      ${entry.grid}`);
    } catch (error) {
      results.push({ run, mode, error: `${error.kind ?? 'error'}: ${error.message}` });
      console.log(`run ${run} ${mode}: FAILED, ${error.kind ?? 'error'}: ${error.message}`);
    }
  }
}

// ---- Summary --------------------------------------------------------------------------------

function pct(value) {
  return `${Math.round(value * 100)}%`;
}
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const range = values => `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`;

function summarize(entries, scoresOf) {
  const ok = entries.filter(entry => !entry.error);
  if (ok.length === 0) return null;
  const metric = name => ok.map(entry => Number(scoresOf(entry)[name]));
  return {
    runs: ok.length,
    failed: entries.length - ok.length,
    bassSmoothness: { mean: mean(metric('bassSmoothness')), range: range(metric('bassSmoothness')) },
    techniqueMix: { mean: mean(metric('techniqueMix')), range: range(metric('techniqueMix')) },
    density: mean(metric('density')),
    densityOk: ok.filter(entry => scoresOf(entry).densityOk).length,
    clashes: Math.max(...metric('clashes')),
    seconds: mean(ok.map(entry => entry.seconds)),
    cost: mean(ok.map(entry => entry.cost)),
  };
}

const executeRuns = results.filter(entry => entry.mode === 'execute');
const fullRuns = results.filter(entry => entry.mode === 'full');
const summary = {
  execute: summarize(executeRuns, entry => entry.scores),
  draft: summarize(fullRuns, entry => entry.draftScores),
  full: summarize(fullRuns, entry => entry.scores),
};

// The draft is the full run before its review: its time and cost are part of the full run's.
const COLUMN = 20;
console.log(`\n${''.padEnd(COLUMN)}${['execute alone', 'plan + execute', 'plan+execute+review'].map(title => title.padEnd(COLUMN)).join('')}`);
const row = (label, format, modes = ['execute', 'draft', 'full']) => console.log(label.padEnd(COLUMN)
  + ['execute', 'draft', 'full'].map(mode => (summary[mode] && modes.includes(mode) ? format(summary[mode]) : '—').padEnd(COLUMN)).join(''));
row('bass smoothness', s => `${s.bassSmoothness.mean.toFixed(2)} (${s.bassSmoothness.range})`);
row('technique mix', s => `${s.techniqueMix.mean.toFixed(2)} (${s.techniqueMix.range})`);
row('density', s => `${pct(s.density)}, ${s.densityOk}/${s.runs} in target`);
row('clashes (max)', s => String(s.clashes));
row('seconds', s => s.seconds.toFixed(1), ['execute', 'full']);
row('cost, $', s => s.cost.toFixed(3), ['execute', 'full']);

let verdict = 'not measured (failed runs)';
if (summary.execute && summary.full) {
  const bass = summary.full.bassSmoothness.mean >= summary.execute.bassSmoothness.mean - 1e-9;
  const mix = summary.full.techniqueMix.mean >= summary.execute.techniqueMix.mean - 1e-9;
  verdict = `bass smoothness ${bass ? 'at least as good' : 'WORSE'}, technique mix ${mix ? 'at least as good' : 'WORSE'}`;
}
console.log(`\nDoD (plan + execute + review vs execute alone, means): ${verdict}`);

mkdirSync('eval/reports', { recursive: true });
const file = `eval/reports/compare-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, `${JSON.stringify({ piece: args.piece, style: args.style, intensity: args.intensity, runs, price: PRICE, summary, verdict, results }, null, 2)}\n`);
console.log(`Report: ${file}`);
