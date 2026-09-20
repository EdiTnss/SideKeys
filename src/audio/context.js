// The page's one AudioContext, and the arithmetic between the two clocks the app schedules on.
//
// The metronome and the synth share a context on purpose: browsers limit how many a page may
// open, and two of them would drift apart, which would be heard as the arrangement sliding off
// the click. Web MIDI timestamps are performance.now() milliseconds while Web Audio schedules in
// seconds on its own clock, so everything timed crosses through the pair below.
// The conversions are pure and tested in Node; only audioContext() needs a browser.

let shared = null;

/** The page's AudioContext, built on first use (after a user gesture) and resumed if suspended. */
export function audioContext() {
  shared ??= new AudioContext();
  if (shared.state === 'suspended') shared.resume();
  return shared;
}

/**
 * Both clocks read at the same instant: { contextTime, performanceTime }. getOutputTimestamp is
 * the pair as heard at the output, which is what matters for playing in time; a context that has
 * only just started can report zeros, and then the current time stands in.
 */
export function clockStamp(context) {
  const stamp = context.getOutputTimestamp?.();
  if (stamp && Number.isFinite(stamp.contextTime) && stamp.performanceTime > 0) {
    return { contextTime: stamp.contextTime, performanceTime: stamp.performanceTime };
  }
  return { contextTime: context.currentTime, performanceTime: performance.now() };
}

/** performance.now() milliseconds → seconds on the context clock. */
export function toContextTime(performanceMs, { contextTime, performanceTime }) {
  return contextTime + (performanceMs - performanceTime) / 1000;
}

/** Seconds on the context clock → performance.now() milliseconds. */
export function toPerformanceTime(seconds, { contextTime, performanceTime }) {
  return performanceTime + (seconds - contextTime) * 1000;
}
