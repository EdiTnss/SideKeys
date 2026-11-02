// The two sounds of a verdict, made with Web Audio and no files (Edi chose them on 2026-10-30
// from a page of six; docs/spec-game.md). They play on the page's one AudioContext, beside the
// piano, so they must never cover the chord just played:
//
// - right: two wooden knocks, the chord's root and then its fifth, from octave 5 — above where
//   the hands play, and made of the chord, so they ring with it rather than against it;
// - wrong: a low muted thud with no pitch, which has nothing to argue with whatever was played.
//
// The result of a level borrows the same knock (review of 2026-10-30, #18): one per star, climbing
// C–E–G, and a bell for a new record.
//
// Only the notes (chimeNotes, starNote, bestNotes) are pure and tested in Node; the rest needs a
// browser.

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

const STAR_NOTES = [72, 76, 79];

/**
 * The knock for one star of a result, counted from 0: C5, E5, G5, so three stars climb a triad.
 * The result has no chord to be made of, so it takes the plainest one, in the chime's octave.
 *
 * @param {number} index
 * @returns {number}
 */
export function starNote(index) {
  return STAR_NOTES[Math.min(Math.max(index, 0), STAR_NOTES.length - 1)];
}

/**
 * The bell for a new record: C6 and the fifth above it, an octave over the stars.
 *
 * @returns {[number, number]}
 */
export function bestNotes() {
  return [84, 91];
}

/**
 * The verdict's voice. `level` is read at every sound, so a setting changed in between is heard
 * at once; 0 is silence, and nothing is built for it.
 *
 * @param {{ level?: () => number, context?: () => AudioContext }} [options]
 * @returns {{ right: (rootPc: number) => void, wrong: () => void,
 *             star: (index: number) => void, best: () => void }}
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

  // A marimba-like knock: the fundamental, a short fourth partial and a click of noise.
  function knock(ctx, midi, at, peak) {
    tone(ctx, { freq: hz(midi), at, decay: 0.45, peak });
    tone(ctx, { freq: hz(midi) * 4, at, decay: 0.08, peak: peak * 0.35, attack: 0.001 });
    noise(ctx, { at, length: 0.015, peak: 0.08, filter: 3000 });
  }

  return {
    right(rootPc) {
      const ctx = start();
      if (!ctx) return;
      const [root, fifth] = chimeNotes(rootPc);
      knock(ctx, root, ctx.currentTime, 0.18);
      knock(ctx, fifth, ctx.currentTime + 0.09, 0.2);
    },
    star(index) {
      const ctx = start();
      if (ctx) knock(ctx, starNote(index), ctx.currentTime, 0.18);
    },
    // Two sines a fifth apart, ringing longer than a knock, with a faint bell partial.
    best() {
      const ctx = start();
      if (!ctx) return;
      const [low, high] = bestNotes();
      const at = ctx.currentTime;
      tone(ctx, { freq: hz(low), at, decay: 1.2, peak: 0.12, attack: 0.004 });
      tone(ctx, { freq: hz(high), at: at + 0.06, decay: 1.1, peak: 0.1, attack: 0.004 });
      tone(ctx, { freq: hz(low) * 2.76, at, decay: 0.3, peak: 0.03 });
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
