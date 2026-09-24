// A piano-ish tone, written from scratch so stage 0 needs no recording and no
// sample library. Two timbres on purpose: `clean` is an easy signal (few
// partials), `rich` has the inharmonic, slowly-decaying upper partials that make
// a transcriber hear octaves and fifths that were never played.
export const SAMPLE_RATE = 22050;

const TIMBRES = {
  clean: { partials: 3, rolloff: 1.6, inharmonicity: 0, decay: 2.4, decaySpread: 0.4 },
  rich: { partials: 14, rolloff: 0.9, inharmonicity: 1.2e-4, decay: 3.0, decaySpread: 0.7 },
};

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function renderChord(notes, {
  timbre = 'rich',
  sampleRate = SAMPLE_RATE,
  seconds = 3,
  onsetAt = 0.25,
  velocities = null,
  peak = 0.7,
} = {}) {
  const spec = TIMBRES[timbre];
  if (!spec) throw new Error(`unknown timbre: ${timbre}`);
  const out = new Float32Array(Math.round(seconds * sampleRate));
  const start = Math.round(onsetAt * sampleRate);
  const attack = Math.round(0.004 * sampleRate); // hammer, 4 ms

  notes.forEach((note, voice) => {
    const f0 = midiToHz(note);
    const gain = velocities ? velocities[voice] : 1;
    for (let k = 1; k <= spec.partials; k++) {
      // Piano strings are stiff, so partials sit above exact multiples.
      const freq = k * f0 * Math.sqrt(1 + spec.inharmonicity * k * k);
      if (freq >= sampleRate / 2) break;
      const amp = gain / Math.pow(k, spec.rolloff);
      const tau = spec.decay / Math.pow(k, spec.decaySpread); // highs die first
      const phase = (note * 0.37 + k * 1.13) % (2 * Math.PI); // fixed, not random
      const w = 2 * Math.PI * freq / sampleRate;
      for (let i = start; i < out.length; i++) {
        const t = (i - start) / sampleRate;
        const env = Math.exp(-t / tau) * Math.min(1, (i - start) / attack);
        out[i] += amp * env * Math.sin(w * (i - start) + phase);
      }
    }
  });

  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}

// Render a played gesture, not a block chord: each voice keeps the onset time,
// the release and the velocity Genos actually sent. Louder notes are also
// brighter, which is why velocity changes the partial rolloff, not just gain.
export function renderPerformance(voices, {
  timbre = 'rich',
  sampleRate = SAMPLE_RATE,
  leadInSec = 0.25,
  tailSec = 0.6,
  peak = 0.7,
} = {}) {
  const spec = TIMBRES[timbre];
  if (!spec) throw new Error(`unknown timbre: ${timbre}`);
  const lastOff = Math.max(...voices.map(v => v.offSec));
  const length = Math.round((leadInSec + lastOff + tailSec) * sampleRate);
  const out = new Float32Array(length);
  const attack = Math.round(0.004 * sampleRate);
  const releaseTau = 0.05; // damper on the string

  for (const voice of voices) {
    const f0 = midiToHz(voice.note);
    const loudness = Math.pow((voice.velocity || 64) / 127, 1.8);
    const brightness = spec.rolloff - 0.25 * ((voice.velocity || 64) / 127);
    const start = Math.round((leadInSec + voice.onSec) * sampleRate);
    const release = Math.round((leadInSec + voice.offSec) * sampleRate);
    for (let k = 1; k <= spec.partials; k++) {
      const freq = k * f0 * Math.sqrt(1 + spec.inharmonicity * k * k);
      if (freq >= sampleRate / 2) break;
      const amp = loudness / Math.pow(k, brightness);
      const tau = spec.decay / Math.pow(k, spec.decaySpread);
      const phase = (voice.note * 0.37 + k * 1.13) % (2 * Math.PI);
      const w = 2 * Math.PI * freq / sampleRate;
      for (let i = start; i < length; i++) {
        const t = (i - start) / sampleRate;
        let env = Math.exp(-t / tau) * Math.min(1, (i - start) / attack);
        if (i > release) env *= Math.exp(-((i - release) / sampleRate) / releaseTau);
        if (env < 1e-5 && i > release) break;
        out[i] += amp * env * Math.sin(w * (i - start) + phase);
      }
    }
  }

  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return { samples: out, leadInSec, sampleRate };
}
