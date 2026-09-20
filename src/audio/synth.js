// A small polyphonic synth in the shape of a MIDI output port: the app sends it exactly what it
// sends the Genos — note-on, note-off, all-notes-off, with or without a timestamp — and hears it
// in the browser. It is the output half of demo mode; the on-screen keyboard is the input half.
// Because it is a port, createOutput() drives it unchanged, arrangements included: messages
// scheduled with Web MIDI timestamps land on the metronome's grid through the shared clock.
//
// One patch for every channel: a triangle with a quiet sawtooth beside it, through a low-pass
// that follows the note, with an ADSR. No theory here, and no idea what a chord is.

import { audioContext, clockStamp, toContextTime } from './context.js';

export const SYNTH_ID = 'browser-synth';

const ATTACK_S = 0.006;
const DECAY_S = 0.35;          // time constant, not a duration: setTargetAtTime
const SUSTAIN = 0.32;          // of the peak
const RELEASE_S = 0.25;

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * [status, data1, data2] → { kind: 'on' | 'off' | 'allOff', channel, note, velocity }, or null
 * for a message the synth has no voice for. Pure, the same reading as midi/input.js.
 */
export function synthCommand(data) {
  const [status, data1 = 0, data2 = 0] = data;
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (type === 0x90 && data2 > 0) return { kind: 'on', channel, note: data1, velocity: data2 };
  if (type === 0x80 || type === 0x90) return { kind: 'off', channel, note: data1 };
  // 120 is All Sound Off, 123 All Notes Off: both mean stop, which is what output.silence() sends.
  if (type === 0xb0 && (data1 === 120 || data1 === 123)) return { kind: 'allOff', channel };
  return null;
}

/**
 * createSynth({ context, name, maxVoices, master }) → a MIDI output port: { id, name, type,
 * state, send(data, time), clear() }. `time` is a performance.now() millisecond timestamp, as
 * Web MIDI gives; anything in the past sounds now. clear() drops what has not sounded yet.
 */
export function createSynth({ context = null, name = 'Browser synth', maxVoices = 24, master = 0.5 } = {}) {
  let ctx = context;
  let out = null;
  const voices = new Map();    // `${channel}:${note}` → voices in the order they were started

  // The context is built on the first message, so the page opens without one: a browser only
  // lets it run after a user gesture, and the first note is always a gesture away.
  function ready() {
    ctx ??= audioContext();
    if (!out) {
      out = ctx.createGain();
      out.gain.value = master;
      out.connect(ctx.destination);
    }
    return ctx;
  }

  function send(data, time) {
    const command = synthCommand(data);
    if (!command) return;
    ready();
    const stamped = time ? toContextTime(time, clockStamp(ctx)) : ctx.currentTime;
    const at = Math.max(ctx.currentTime, stamped);
    if (command.kind === 'on') start(command, at);
    else if (command.kind === 'off') release(command, at);
    else releaseAll(command.channel, at);
  }

  function start({ channel, note, velocity }, at) {
    const frequency = midiToFrequency(note);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(frequency * 9, 9000);
    filter.Q.value = 0.6;
    // A soft velocity curve: a voicing of six notes must not clip, a single note must be heard.
    const peak = 0.22 * (velocity / 127) ** 1.4;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + ATTACK_S);
    gain.gain.setTargetAtTime(peak * SUSTAIN, at + ATTACK_S, DECAY_S);
    filter.connect(gain).connect(out);

    const oscillators = [['triangle', 0, 1], ['sawtooth', 6, 0.28]].map(([type, detune, level]) => {
      const oscillator = ctx.createOscillator();
      const mix = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      mix.gain.value = level;
      oscillator.connect(mix).connect(filter);
      oscillator.start(at);
      return oscillator;
    });

    const voice = { channel, note, at, gain, oscillators, done: false };
    oscillators[0].onended = () => {
      voice.done = true;
      gain.disconnect();
      filter.disconnect();
      drop(voice);
    };
    const key = `${channel}:${note}`;
    voices.set(key, [...(voices.get(key) ?? []), voice]);
    trim(at);
  }

  // The oldest voice first: an arrangement sends its note-ons and note-offs in order, so the
  // note-off of a repeated note belongs to the note-on that is already sounding.
  function release({ channel, note }, at) {
    const key = `${channel}:${note}`;
    const list = voices.get(key) ?? [];
    const voice = list.find(candidate => !candidate.releasing);
    if (voice) stop(voice, at);
  }

  function releaseAll(channel, at) {
    for (const list of voices.values()) {
      for (const voice of list) if (voice.channel === channel) stop(voice, at);
    }
  }

  function stop(voice, at) {
    voice.releasing = true;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setTargetAtTime(0, at, RELEASE_S / 3);
    for (const oscillator of voice.oscillators) oscillator.stop(at + RELEASE_S);
  }

  function drop(voice) {
    const key = `${voice.channel}:${voice.note}`;
    const left = (voices.get(key) ?? []).filter(candidate => candidate !== voice);
    if (left.length) voices.set(key, left);
    else voices.delete(key);
  }

  function sounding() {
    return [...voices.values()].flat().filter(voice => !voice.releasing);
  }

  /** Over the polyphony cap the oldest voice goes, so a stuck note cannot mute the new ones. */
  function trim(at) {
    const live = sounding().sort((a, b) => a.at - b.at);
    for (const voice of live.slice(0, Math.max(0, live.length - maxVoices))) stop(voice, at);
  }

  /** Like a real port's clear(): what is scheduled but has not sounded yet never sounds. */
  function clear() {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const voice of [...voices.values()].flat()) {
      if (voice.at <= now) continue;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      for (const oscillator of voice.oscillators) oscillator.stop(now);
      voice.releasing = true;
    }
  }

  return {
    id: SYNTH_ID,
    name,
    manufacturer: 'Voicing Lab',
    type: 'output',
    state: 'connected',
    connection: 'open',
    send,
    clear,
  };
}
