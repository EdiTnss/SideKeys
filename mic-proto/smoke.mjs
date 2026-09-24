import { loadBasicPitch } from './model.js';
import { renderChord, SAMPLE_RATE } from './synth.js';
import { runModel, sustainSet, noteEventSet } from './read.js';

const name = n => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n % 12] + (Math.floor(n / 12) - 1);
const bp = await loadBasicPitch();

// Bill Evans rootless A on Dm7: F3 A3 C4 E4
const notes = [53, 57, 60, 64];
for (const timbre of ['clean', 'rich']) {
  const audio = renderChord(notes, { timbre });
  const t0 = Date.now();
  const { frames, onsets } = await runModel(bp, audio);
  const ms = Date.now() - t0;
  const window = { fromSec: 0.55, toSec: 1.55 };
  const sustain = sustainSet(frames, { ...window, threshold: 0.5 });
  const tracked = noteEventSet(frames, onsets, window);
  console.log(`\n--- ${timbre}: played ${notes.map(name).join(' ')} | ${frames.length} frames, ${ms} ms`);
  console.log('  sustain reader:', sustain.notes.map(name).join(' ') || '(nothing)');
  console.log('  note tracker  :', tracked.notes.map(name).join(' ') || '(nothing)');
  const top = [...sustain.scores.entries()].filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([n, v]) => `${name(n)}:${v.toFixed(2)}`);
  console.log('  strongest     :', top.join('  '));
}
