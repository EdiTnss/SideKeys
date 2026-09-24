import { writeFileSync } from 'node:fs';
import { buildCorpus, splitCorpus } from './corpus.js';

const tape = '../harness/sessions/genos-2026-09-19-drill-blues-rhythm.json';
const items = splitCorpus(buildCorpus(tape));
writeFileSync('corpus.json', JSON.stringify(items, null, 1) + '\n');

const count = key => items.filter(i => i.set === key).length;
console.log(`corpus: ${items.length} voicings  (tune ${count('tune')}, gate ${count('gate')}, extra ${count('extra')})`);
const bySize = {};
for (const i of items) bySize[i.size] = (bySize[i.size] || 0) + 1;
console.log('sizes:', JSON.stringify(bySize));
console.log('with a problem in the verdict:', items.filter(i => i.hasProblem).length);
console.log('arpeggio spread: max', Math.max(...items.map(i => i.spreadSec)).toFixed(2), 's,',
  'median', items.map(i => i.spreadSec).sort((a, b) => a - b)[Math.floor(items.length / 2)].toFixed(2), 's');
console.log('\ngate set:');
for (const i of items.filter(i => i.set === 'gate')) {
  console.log(`  ${i.id}  ${String(i.symbol).padEnd(6)} ${i.size} notes  MIDI ${i.lowest}-${i.highest}  ${i.verdict.type}${i.hasProblem ? '  (problem)' : ''}`);
}
