// Web Audio metronome. Browser only.
//
// Clicks are scheduled ahead of time on the AudioContext clock (a lookahead scheduler, never
// setInterval for the sound itself, which would drift). A JavaScript timer only wakes the
// scheduler up; the UI gets an onBeat callback close to the moment the click is heard.

import { beatDuration, positionAt, timeOf } from '../theory/timing.js';

const LOOKAHEAD_S = 0.12;   // schedule clicks this far ahead
const TICK_MS = 25;         // scheduler wake-up interval

export function createMetronome({ tempo = 120, timeSignature = [4, 4], countInBars = 1, onBeat = () => {} } = {}) {
  let context = null;
  let running = false;
  let startTime = 0;
  let nextBeat = 0;
  let timer = null;

  const timeOfBeat = n => startTime + n * beatDuration(tempo);

  function start() {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    startTime = context.currentTime + 0.1;
    nextBeat = 0;
    running = true;
    tick();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
  }

  function tick() {
    if (!running) return;
    while (timeOfBeat(nextBeat) < context.currentTime + LOOKAHEAD_S) {
      schedule(nextBeat);
      nextBeat += 1;
    }
    timer = setTimeout(tick, TICK_MS);
  }

  function schedule(n) {
    const beatsPerBar = timeSignature[0];
    const time = timeOfBeat(n);
    const beat = (n % beatsPerBar) + 1;
    const bar = Math.floor(n / beatsPerBar) - countInBars + 1;
    click(time, beat === 1, bar < 1);
    const delay = Math.max(0, (time - context.currentTime) * 1000);
    setTimeout(() => {
      if (running) onBeat({ bar, beat, time, countIn: bar < 1 });
    }, delay);
  }

  function click(time, accent, countIn) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = countIn ? 700 : accent ? 1400 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.35, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
  }

  /** performance.now() milliseconds → seconds on this context's clock, as heard at the output. */
  function toContextTime(performanceMs) {
    const stamp = context.getOutputTimestamp?.();
    if (stamp && Number.isFinite(stamp.contextTime)) {
      return stamp.contextTime + (performanceMs - stamp.performanceTime) / 1000;
    }
    return context.currentTime - (performance.now() - performanceMs) / 1000;
  }

  /** Where a performance.now() timestamp falls on the grid: { bar, beat }. */
  function positionOf(performanceMs) {
    return positionAt(toContextTime(performanceMs), { tempo, timeSignature, startTime, countInBars });
  }

  /**
   * When (bar, beat) is heard, in performance.now() milliseconds: the inverse of positionOf, for
   * scheduling Web MIDI messages on the metronome's grid. Call it after start().
   */
  function performanceTimeOf(bar, beat) {
    const contextTime = timeOf(bar, beat, { tempo, timeSignature, startTime, countInBars });
    const stamp = context.getOutputTimestamp?.();
    // A context that has only just started can report a zero stamp; fall back to the current time then.
    if (stamp && Number.isFinite(stamp.contextTime) && stamp.performanceTime > 0) {
      return stamp.performanceTime + (contextTime - stamp.contextTime) * 1000;
    }
    return performance.now() + (contextTime - context.currentTime) * 1000;
  }

  return {
    start,
    stop,
    positionOf,
    performanceTimeOf,
    get running() { return running; },
    get tempo() { return tempo; },
    set tempo(value) { if (!running) tempo = value; },
    set timeSignature(value) { if (!running) timeSignature = value; },
  };
}
