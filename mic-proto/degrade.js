// What the room, the speakers and a laptop microphone do to the signal before
// the model ever sees it. This is the whole point of stage 0: if the acoustic
// path alone breaks the reading, we know before Edi records anything.
//
// Everything is a fixed, deterministic filter -- a measurement has to repeat.
import { SAMPLE_RATE } from './synth.js';

// A sparse impulse response: a few early reflections, then a decaying tail.
function roomImpulse(sampleRate, { reflections = 14, spreadMs = 70, rt60 = 0.45 }) {
  const length = Math.round(rt60 * sampleRate);
  const ir = new Float32Array(length);
  ir[0] = 1;
  for (let r = 1; r <= reflections; r++) {
    // fixed pseudo-random delays: the same room every run
    const frac = (Math.sin(r * 12.9898) * 43758.5453) % 1;
    const delayMs = 3 + Math.abs(frac) * spreadMs;
    const at = Math.round((delayMs / 1000) * sampleRate);
    if (at < length) ir[at] += (r % 2 ? -1 : 1) * 0.5 * Math.exp(-delayMs / 1000 / (rt60 / 3));
  }
  for (let i = 0; i < length; i++) {
    ir[i] += (Math.sin(i * 0.7891) * 0.02) * Math.exp(-i / sampleRate / (rt60 / 4));
  }
  return ir;
}

function convolve(samples, ir) {
  const out = new Float32Array(samples.length + ir.length);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s === 0) continue;
    for (let j = 0; j < ir.length; j++) out[i + j] += s * ir[j];
  }
  return out.subarray(0, samples.length);
}

function onePoleHigh(samples, hz, sampleRate, poles = 1) {
  let out = samples;
  for (let p = 0; p < poles; p++) {
    const rc = 1 / (2 * Math.PI * hz);
    const dt = 1 / sampleRate;
    const a = rc / (rc + dt);
    const next = new Float32Array(out.length);
    let prevIn = out[0];
    let prevOut = 0;
    for (let i = 0; i < out.length; i++) {
      prevOut = a * (prevOut + out[i] - prevIn);
      prevIn = out[i];
      next[i] = prevOut;
    }
    out = next;
  }
  return out;
}

function onePoleLow(samples, hz, sampleRate) {
  const rc = 1 / (2 * Math.PI * hz);
  const dt = 1 / sampleRate;
  const a = dt / (rc + dt);
  const out = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev += a * (samples[i] - prev);
    out[i] = prev;
  }
  return out;
}

// Pink-ish noise floor: white through a one-pole, plus mains hum.
function addNoise(samples, snrDb, sampleRate) {
  let energy = 0;
  for (const s of samples) energy += s * s;
  const rms = Math.sqrt(energy / samples.length) || 1e-6;
  const target = rms * Math.pow(10, -snrDb / 20);
  const out = Float32Array.from(samples);
  let pink = 0;
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const white = (seed / 0x3fffffff) - 1;
    pink = 0.97 * pink + 0.03 * white;
    const hum = 0.25 * Math.sin(2 * Math.PI * 50 * i / sampleRate);
    out[i] += target * (pink * 8 + white * 0.4 + hum);
  }
  return out;
}

export const CHAINS = {
  // straight out of the synth: the ceiling, no acoustic path at all
  direct: null,
  // Genos through its speakers, a metre or two away, laptop microphone:
  // the mic's own bass rolloff is the part that worries me for low voicings
  laptop: { rt60: 0.45, highpassHz: 110, poles: 2, lowpassHz: 9000, snrDb: 34 },
  // same room, worse placement and a noisier machine
  harsh: { rt60: 0.7, highpassHz: 190, poles: 2, lowpassHz: 7000, snrDb: 24 },
};

export function degrade(samples, chainName, sampleRate = SAMPLE_RATE) {
  const chain = CHAINS[chainName];
  if (!chain) return samples;
  let out = convolve(samples, roomImpulse(sampleRate, { rt60: chain.rt60 }));
  out = onePoleHigh(out, chain.highpassHz, sampleRate, chain.poles);
  out = onePoleLow(out, chain.lowpassHz, sampleRate);
  out = addNoise(out, chain.snrDb, sampleRate);
  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0.99) for (let i = 0; i < out.length; i++) out[i] *= 0.99 / max;
  return out;
}
