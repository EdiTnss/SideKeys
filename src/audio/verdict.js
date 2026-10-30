// The two sounds of a verdict, made with Web Audio and no files (Edi chose them on 2026-10-30
// from a page of six; docs/spec-game.md). They play on the page's one AudioContext, beside the
// piano, so they must never cover the chord just played:
//
// - right: two wooden knocks, the chord's root and then its fifth, from octave 5 — above where
//   the hands play, and made of the chord, so they ring with it rather than against it;
// - wrong: a low muted thud with no pitch, which has nothing to argue with whatever was played.
//
// Only chimeNotes is pure and tested in Node; the rest needs a browser.

import { audioContext } from './context.js';

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

/**
 * The two notes of the chime: the root in octave 5, then the fifth above it.
 *
 * @param {number} rootPc  the chord's root as a pitch class
 * @returns {[number, number]}
 */
export function chimeNotes(rootPc) {
  const root = 72 + (((rootPc % 12) + 12) % 12);
  return [root, root + 7];
}

/**
 * The verdict's voice. `level` is read at every sound, so a setting changed in between is heard
 * at once; 0 is silence, and nothing is built for it.
 *
 * @param {{ level?: () => number, context?: () => AudioContext }} [options]
 * @returns {{ right: (rootPc: number) => void, wrong: () => void }}
 */
export function createVerdictSound({ level = () => 1, context = audioContext } = {}) {
  let out = null;

  function start() {
    const volume = level();
    if (volume <= 0) return null;
    const ctx = context();
    if (!out) {
      out = ctx.createGain();
      out.connect(ctx.destination);
    }
    out.gain.value = 0.7 * volume;
    return ctx;
  }

  function tone(ctx, { freq, at, decay, peak, attack = 0.002, glideTo = 0, glide = 0 }) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + glide);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  function noise(ctx, { at, length, peak, filter }) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = filter;
    const gain = ctx.createGain();
    gain.gain.value = peak;
    source.connect(lowpass).connect(gain).connect(out);
    source.start(at);
  }

  return {
    // A marimba-like knock: the fundamental, a short fourth partial and a click of noise.
    right(rootPc) {
      const ctx = start();
      if (!ctx) return;
      const [root, fifth] = chimeNotes(rootPc);
      for (const [midi, delay, peak] of [[root, 0, 0.18], [fifth, 0.09, 0.2]]) {
        const at = ctx.currentTime + delay;
        tone(ctx, { freq: hz(midi), at, decay: 0.45, peak });
        tone(ctx, { freq: hz(midi) * 4, at, decay: 0.08, peak: peak * 0.35, attack: 0.001 });
        noise(ctx, { at, length: 0.015, peak: 0.08, filter: 3000 });
      }
    },
    // A falling sine and a brush of low noise.
    wrong() {
      const ctx = start();
      if (!ctx) return;
      const at = ctx.currentTime;
      tone(ctx, { freq: 150, glideTo: 55, glide: 0.14, at, decay: 0.2, peak: 0.45 });
      noise(ctx, { at, length: 0.05, peak: 0.12, filter: 800 });
    },
  };
}
