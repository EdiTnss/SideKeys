// Stage 0: run the model over a faithful re-synthesis of voicings Edi really
// played, with and without a simulated acoustic path, and report how often the
// notes come back exactly right -- octave included.
//
//   node measure.js --set tune --chain direct,laptop --thresholds 0.5,0.4
//
// Every reader sees the same inference: running the model is the slow part,
// reading its output is not, so comparing readers is nearly free.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadBasicPitch } from './model.js';
import { renderPerformance, SAMPLE_RATE } from './synth.js';
import { degrade, CHAINS } from './degrade.js';
import { runModel, sustainSet, noteEventSet, gapSet, cliffSet, oracleThreshold } from './read.js';
import { compareNotes, compareVerdict } from './metrics.js';
import { writeWav } from './wav.js';

const argv = process.argv.slice(2);
const arg = (key, fallback) => {
  const at = argv.indexOf(`--${key}`);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const options = {
  sets: arg('set', 'tune').split(','),
  chains: arg('chain', 'direct').split(','),
  thresholds: arg('thresholds', arg('threshold', '0.4')).split(',').map(Number),
  floors: arg('floors', '0.12').split(',').map(Number),
  limit: Number(arg('limit', '0')),
  out: arg('out', ''),
  wav: argv.includes('--wav'),
};

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const name = n => NAMES[n % 12] + (Math.floor(n / 12) - 1);
const pct = (hits, total) => (total ? `${((100 * hits) / total).toFixed(0)}%` : '--');

const corpus = JSON.parse(readFileSync('corpus.json', 'utf8'))
  .filter(item => options.sets.includes('all') || options.sets.includes(item.set));
const items = options.limit ? corpus.slice(0, options.limit) : corpus;

// The window we read: after every note is down and past its attack, for up to a
// second, but never past the first release.
function windowFor(item, leadInSec) {
  const lastOn = Math.max(...item.voices.map(v => v.onSec));
  const firstOff = Math.min(...item.voices.map(v => v.offSec));
  const fromSec = leadInSec + lastOn + 0.12;
  let toSec = Math.min(leadInSec + firstOff + 0.05, fromSec + 1.0);
  if (toSec < fromSec + 0.2) toSec = fromSec + 0.2;
  return { fromSec, toSec };
}

function readAll(frames, onsets, window, truth) {
  const readings = new Map();
  for (const threshold of options.thresholds) {
    readings.set(`flat @${threshold}`, sustainSet(frames, { ...window, threshold }).notes);
  }
  for (const floor of options.floors) {
    readings.set(`gap ${floor}`, gapSet(frames, { ...window, floor }).notes);
  }
  for (const floor of options.floors) {
    readings.set(`cliff ${floor}`, cliffSet(frames, { ...window, floor }).notes);
  }
  readings.set('tracker', noteEventSet(frames, onsets, window).notes);
  readings.set('oracle', oracleThreshold(frames, window, truth).notes);
  return readings;
}

const basicPitch = await loadBasicPitch();
const results = [];
if (options.wav) mkdirSync('clips', { recursive: true });

for (const chain of options.chains) {
  if (!(chain in CHAINS)) throw new Error(`unknown chain: ${chain}`);
  console.log(`\n--- chain: ${chain}  (${items.length} voicings)`);
  for (const item of items) {
    const rendered = renderPerformance(item.voices);
    const audio = degrade(rendered.samples, chain);
    if (options.wav) writeFileSync(`clips/${item.id}-${chain}.wav`, writeWav(audio, SAMPLE_RATE));
    const window = windowFor(item, rendered.leadInSec);
    const started = Date.now();
    const { frames, onsets } = await runModel(basicPitch, audio);

    const readings = {};
    for (const [label, heard] of readAll(frames, onsets, window, item.notes)) {
      readings[label] = {
        heard,
        ...compareNotes(item.notes, heard),
        verdict: compareVerdict(item.symbol, item.notes, heard),
      };
    }
    const row = {
      id: item.id,
      set: item.set,
      chain,
      symbol: item.symbol,
      size: item.size,
      lowest: item.lowest,
      highest: item.highest,
      truth: item.notes,
      window,
      ms: Date.now() - started,
      readings,
    };
    results.push(row);

    const mark = r => (r.exact
      ? 'OK   '
      : `${r.missing.length ? '-' + r.missing.length : '  '}${r.extra.length ? '+' + r.extra.length : '  '}`);
    const labels = Object.keys(readings);
    const shown = readings[labels.find(l => l.startsWith('gap'))] || readings[labels[0]];
    console.log(
      `  ${item.id} ${String(item.symbol).padEnd(6)} ${item.size}n ${name(item.lowest).padEnd(4)}`
      + ` | ${labels.map(l => mark(readings[l])).join(' ')}`
      + (shown.exact ? '' : ` | gap heard ${shown.heard.map(name).join(' ') || '(nothing)'}`),
    );
  }
}

function summarize(rows, label) {
  const read = row => row.readings[label];
  const exact = rows.filter(r => read(r).exact).length;
  const judged = rows.filter(r => read(r).verdict);
  const sameVerdict = judged.filter(r => read(r).verdict.same).length;
  const mean = key => rows.reduce((sum, r) => sum + read(r)[key], 0) / (rows.length || 1);
  const bySize = {};
  for (const row of rows) {
    const key = row.size <= 4 ? '3-4 notes' : row.size <= 6 ? '5-6 notes' : '7+ notes';
    bySize[key] = bySize[key] || { n: 0, exact: 0, recall: 0 };
    bySize[key].n++;
    bySize[key].exact += read(row).exact ? 1 : 0;
    bySize[key].recall += read(row).recall;
  }
  return {
    voicings: rows.length,
    exact,
    exactRate: rows.length ? exact / rows.length : 0,
    sameVerdict,
    verdictRate: judged.length ? sameVerdict / judged.length : 0,
    precision: mean('precision'),
    recall: mean('recall'),
    octaveErrors: rows.reduce((n, r) => n + read(r).octaveErrors.length, 0),
    ghosts: rows.reduce((n, r) => n + read(r).ghosts.length, 0),
    missed: rows.reduce((n, r) => n + read(r).missing.length, 0),
    bySize,
  };
}

console.log('\n--- summary');
const report = { ranAt: new Date().toISOString(), options, chains: {} };
const labels = Object.keys(results[0].readings);
for (const chain of options.chains) {
  const rows = results.filter(r => r.chain === chain);
  report.chains[chain] = {};
  let winner = null;
  for (const label of labels) {
    const summary = summarize(rows, label);
    report.chains[chain][label] = summary;
    // The oracle is the ceiling, not a reader: it is allowed to look at the answer.
    if (label !== 'oracle' && (!winner || summary.exact > report.chains[chain][winner].exact)) {
      winner = label;
    }
    console.log(
      `${chain.padEnd(7)} ${label.padEnd(12)} exact ${pct(summary.exact, summary.voicings)}`
      + ` (${summary.exact}/${summary.voicings})`
      + `  same verdict ${pct(summary.sameVerdict, summary.voicings)}`
      + `  recall ${(100 * summary.recall).toFixed(0)}%  precision ${(100 * summary.precision).toFixed(0)}%`
      + `  octave slips ${summary.octaveErrors}  ghosts ${summary.ghosts}`,
    );
  }
  report.chains[chain].best = winner;
  console.log(`        best reader: ${winner}`);
  for (const [key, v] of Object.entries(report.chains[chain][winner].bySize)) {
    console.log(`        ${key.padEnd(10)} exact ${pct(v.exact, v.n)} (${v.exact}/${v.n})`
      + `  recall ${(100 * v.recall / v.n).toFixed(0)}%`);
  }
}
// The report keeps the notes, not the two full verdict objects per reading: those
// are derived from `truth` and `heard` and can be recomputed at any time, and
// they were four fifths of the file.
report.rows = results.map(row => ({
  ...row,
  readings: Object.fromEntries(Object.entries(row.readings).map(([label, r]) => [label, {
    heard: r.heard,
    exact: r.exact,
    missing: r.missing,
    extra: r.extra,
    octaveErrors: r.octaveErrors,
    ghosts: r.ghosts,
    precision: Number(r.precision.toFixed(3)),
    recall: Number(r.recall.toFixed(3)),
    sameVerdict: r.verdict ? r.verdict.same : null,
  }])),
}));
const out = options.out || `report-${options.sets.join('+')}-${options.chains.join('+')}.json`;
writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
console.log(`\nwritten ${out}`);
