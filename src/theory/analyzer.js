// Voicing analysis: what was played against what was asked. Pure, no DOM.
// Input: MIDI notes (60 = C4) and a chord from parseChord. Output: a plain object the UI
// renders and, in Phase 3a, the prompt receives unchanged.

// Lower note of an adjacent pair below `below` → that interval is muddy. Data, so the
// classic per-interval limits can replace these later without touching the code.
export const LOW_INTERVAL_LIMITS = [
  { below: 48, semitones: [1, 2, 3] },   // under C3: m2, M2, m3
  { below: 43, semitones: [4] },         // under G2: M3
];

export function analyzeVoicing(notes, chord, { limits = LOW_INTERVAL_LIMITS } = {}) {
  throw new Error('not implemented');
}
