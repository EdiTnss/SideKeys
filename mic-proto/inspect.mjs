// Print the activation profile of one voicing, so a reading rule gets designed
// on evidence instead of intuition.
//   node inspect.mjs g13 g21 g25 --chain laptop
import { readFileSync } from 'node:fs';
import { loadBasicPitch } from './model.js';
import { renderPerformance } from './synth.js';
import { degrade } from './degrade.js';
import { runModel, sustainSet } from './read.js';

const argv = process.argv.slice(2);
const chainAt = argv.indexOf('--chain');
const chain = chainAt >= 0 ? argv[chainAt + 1] : 'laptop';
const ids = argv.filter(a => /^g\d+$/.test(a));

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const name = n => NAMES[n % 12] + (Math.floor(n / 12) - 1);

const corpus = JSON.parse(readFileSync('corpus.json', 'utf8'));
const basicPitch = await loadBasicPitch();

for (const id of ids) {
  const item = corpus.find(i => i.id === id);
  if (!item) { console.log(`${id}: not in the corpus`); continue; }
  const rendered = renderPerformance(item.voices);
  const audio = degrade(rendered.samples, chain);
  const lastOn = Math.max(...item.voices.map(v => v.onSec));
  const firstOff = Math.min(...item.voices.map(v => v.offSec));
  const fromSec = rendered.leadInSec + lastOn + 0.12;
  const toSec = Math.max(fromSec + 0.2, Math.min(rendered.leadInSec + firstOff + 0.05, fromSec + 1.0));
  const { frames } = await runModel(basicPitch, audio);
  const { scores } = sustainSet(frames, { fromSec, toSec, threshold: 1.1 });

  const truth = new Set(item.notes);
  const ranked = [...scores.entries()]
    .filter(([, v]) => v > 0.02)
    .sort((a, b) => b[1] - a[1]);
  console.log(`\n${id}  ${item.symbol}  ${item.size} notes: ${item.notes.map(name).join(' ')}`
    + `  (velocities ${item.voices.map(v => v.velocity).join(',')})`);
  console.log('  rank  pitch   score   played?   drop to next');
  ranked.slice(0, Math.min(ranked.length, item.size + 6)).forEach(([note, score], i) => {
    const next = ranked[i + 1] ? ranked[i + 1][1] : 0;
    const ratio = next > 0 ? (score / next).toFixed(2) : '--';
    console.log(`  ${String(i + 1).padStart(4)}  ${name(note).padEnd(6)} ${score.toFixed(3)}`
      + `   ${truth.has(note) ? 'yes' : ' . '}       x${ratio}`);
  });
  const missed = item.notes.filter(n => (scores.get(n) || 0) < 0.15);
  if (missed.length) console.log(`  never seen at all (<0.15): ${missed.map(name).join(' ')}`);
}
