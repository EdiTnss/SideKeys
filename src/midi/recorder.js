// Melody recorder: turns note-on / note-off events into raw notes in musical time.
// Positions come from an injected `positionOf(performanceMs)` (the metronome's), so this
// module has no clock of its own and is tested with a fake one.

export function createRecorder({ positionOf, timeSignature = [4, 4] }) {
  let recording = false;
  let notes = [];
  const open = new Map();           // midi → the note still sounding

  const beatsBetween = (from, to) => (to.bar - from.bar) * timeSignature[0] + (to.beat - from.beat);

  function start() {
    recording = true;
    notes = [];
    open.clear();
  }

  function noteOn(midi, velocity, performanceMs) {
    if (!recording) return;
    if (open.has(midi)) release(midi, performanceMs);
    const { bar, beat } = positionOf(performanceMs);
    const note = { midi, velocity, bar, beat, durationBeats: null };
    open.set(midi, note);
    notes.push(note);
  }

  function noteOff(midi, performanceMs) {
    if (!recording || !open.has(midi)) return;
    release(midi, performanceMs);
  }

  function release(midi, performanceMs) {
    const note = open.get(midi);
    open.delete(midi);
    note.durationBeats = beatsBetween(note, positionOf(performanceMs));
  }

  /** Ends the recording; notes still held end here. Returns the raw notes. */
  function stop(performanceMs) {
    for (const midi of [...open.keys()]) release(midi, performanceMs);
    recording = false;
    return notes.map(note => ({ ...note }));
  }

  return {
    start,
    noteOn,
    noteOff,
    stop,
    get recording() { return recording; },
    get count() { return notes.length; },
  };
}
