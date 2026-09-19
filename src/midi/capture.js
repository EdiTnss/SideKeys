// Voicing capture: turns note-on / note-off events into chord snapshots. Pure, no Web MIDI here.
//
// Rules (see docs/spec-capture.md):
// - every note-on restarts a debounce timer; a note-off never does, because fingers do not
//   lift together any more than they land together;
// - the first note-off after the last note-on keeps a copy of the set, so a staccato chord
//   released inside the window is still captured;
// - when the timer fires: the current set if it has ≥ 2 notes (a quickly corrected wrong
//   note is never reported), else the copy if it has ≥ 2 notes, else nothing;
// - the "next" note is intercepted before it can enter the set.

export class VoicingCapture {
  constructor({
    debounceMs = 300,
    nextNote = 28,                 // E1, the lowest key on a 76-key Genos; null disables it
    onVoicing = () => {},
    onNext = () => {},
    onChange = () => {},
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = id => clearTimeout(id),
    now = () => performance.now(),
  } = {}) {
    this.debounceMs = debounceMs;
    this.nextNote = nextNote;
    this.onVoicing = onVoicing;
    this.onNext = onNext;
    this.onChange = onChange;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.now = now;
    this.held = new Set();
    this.timer = null;
    this.beforeRelease = null;
    this.startedAt = null;         // time of the first note-on of the snapshot being built
  }

  noteOn(midi, velocity = 1) {
    if (velocity === 0) return this.noteOff(midi);
    if (midi === this.nextNote) return this.onNext();
    if (this.startedAt === null) this.startedAt = this.now();
    this.held.add(midi);
    this.beforeRelease = null;
    this.restartTimer();
    this.onChange(this.snapshot());
  }

  noteOff(midi) {
    if (midi === this.nextNote || !this.held.has(midi)) return;
    if (this.timer !== null && this.beforeRelease === null) this.beforeRelease = this.snapshot();
    this.held.delete(midi);
    this.onChange(this.snapshot());
  }

  /** Drops a pending snapshot (the chord changed, the old one is no longer of interest). */
  cancel() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.beforeRelease = null;
    this.startedAt = null;
  }

  /** Currently held notes, sorted ascending. */
  snapshot() {
    return [...this.held].sort((a, b) => a - b);
  }

  restartTimer() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => this.fire(), this.debounceMs);
  }

  fire() {
    this.timer = null;
    const current = this.snapshot();
    const notes = current.length >= 2 ? current : this.beforeRelease ?? [];
    const startedAt = this.startedAt;
    this.beforeRelease = null;
    this.startedAt = null;
    if (notes.length >= 2) this.onVoicing(notes, { startedAt });
  }
}
