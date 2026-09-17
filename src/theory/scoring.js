// Deterministic scores for a reharmonization: shown after `execute` and after `review`, and
// reported by the evaluation set (Phase 5). Pure.
//
// `chosen` is the list of resolved choices, one per slot the model touched:
// [{ bar, slot, candidate }], where `candidate` is an object from candidates.js. A slot without
// a choice keeps its original chord; a slot covered by a two-slot candidate (Coltrane) is
// skipped, whatever the list says about it.
//
// Clashes and warnings are recomputed from the melody against the chosen chords, not copied
// from the candidates: this is the safety net that proves the menu was built correctly.

import { parseChord, classifyPc } from './chords.js';

export const DENSITY_TARGETS = {
  light: { min: 0, max: 0.25 },
  medium: { min: 0.4, max: 0.6 },
  heavy: { min: 0.6, max: 1 },
};
export const MAX_RUN = 4;                          // changed slots in a row tolerated below heavy
// Cost of a bass move by the smallest interval between consecutive bass notes (0–6 semitones):
// the same note, the half step and the fourth/fifth are free; the whole step and the thirds
// cost more and more; the tritone costs most.
export const BASS_COSTS = [0, 0, 0.25, 0.5, 0.75, 0, 1];
const EPSILON = 1e-6;

const chordCache = new Map();
const chordOf = symbol => {
  if (!chordCache.has(symbol)) chordCache.set(symbol, parseChord(symbol));
  return chordCache.get(symbol);
};

/**
 * The chord actually active on every slot once the choices are applied, in piece order.
 * → [{ bar, slot, beat, original, candidate, technique, changed, chords: [{ symbol, bar, beat }], coveredBy }]
 */
export function resolveChoices(piece, chosen) {
  const byKey = new Map(chosen.map(c => [`${c.bar}:${c.slot}`, c.candidate]));
  const out = [];
  let covering = null;                             // { candidate, left }: a multi-slot choice in progress
  piece.bars.forEach((bar, barIndex) => bar.chords.forEach((chord, slotIndex) => {
    const slot = { bar: barIndex + 1, slot: slotIndex + 1, beat: chord.beat, original: chord.symbol };
    if (covering && covering.left > 0) {
      covering.left--;
      out.push({ ...slot, candidate: null, technique: covering.candidate.technique, changed: true, chords: [], coveredBy: covering.candidate.id });
      return;
    }
    const candidate = byKey.get(`${slot.bar}:${slot.slot}`) ?? null;
    const technique = candidate?.technique ?? 'original';
    const chords = candidate
      ? candidate.chords.map(c => ({ ...c }))
      : [{ symbol: chord.symbol, bar: slot.bar, beat: chord.beat }];
    covering = candidate && candidate.spans > 1 ? { candidate, left: candidate.spans - 1 } : null;
    out.push({ ...slot, candidate, technique, changed: technique !== 'original', chords, coveredBy: null });
  }));
  return out;
}

/**
 * → { clashes, warnings, bassSmoothness, density, densityTarget, densityOk, maxRun, maxRunOk, techniqueMix, techniques }
 */
export function scoreReharm(piece, chosen, { intensity = 'medium' } = {}) {
  const slots = resolveChoices(piece, chosen);
  const sequence = slots.flatMap(s => s.chords);
  const { clashes, warnings } = melodyAgainst(piece, sequence);

  const changed = slots.filter(s => s.changed).length;
  const density = slots.length ? changed / slots.length : 0;
  const densityTarget = { ...(DENSITY_TARGETS[intensity] ?? DENSITY_TARGETS.medium) };
  const densityOk = density >= densityTarget.min - EPSILON && density <= densityTarget.max + EPSILON;

  let maxRun = 0;
  let run = 0;
  for (const slot of slots) {
    run = slot.changed ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  }
  const maxRunOk = intensity === 'heavy' || maxRun <= MAX_RUN;

  const techniques = {};
  for (const slot of slots) {
    if (slot.candidate && slot.changed) techniques[slot.technique] = (techniques[slot.technique] ?? 0) + 1;
  }

  return {
    clashes, warnings,
    bassSmoothness: bassSmoothness(sequence),
    density, densityTarget, densityOk,
    maxRun, maxRunOk,
    techniqueMix: Object.keys(techniques).length, techniques,
  };
}

// Every structural melody note against the chord active under it (passing notes are free).
function melodyAgainst(piece, sequence) {
  let clashes = 0;
  let warnings = 0;
  piece.bars.forEach((bar, barIndex) => {
    for (const note of bar.melody) {
      if (!note.structural) continue;
      const chord = activeChord(sequence, barIndex + 1, note.beat);
      if (!chord) continue;
      const { role } = classifyPc(chordOf(chord.symbol), note.midi % 12);
      if (role === 'wrong') clashes++;
      else if (role === 'avoid') warnings++;
    }
  });
  return { clashes, warnings };
}

// The last chord that starts at or before (bar, beat); the sequence is in piece order.
function activeChord(sequence, bar, beat) {
  let active = null;
  for (const chord of sequence) {
    if (chord.bar < bar || (chord.bar === bar && chord.beat <= beat + EPSILON)) active = chord;
    else break;
  }
  return active;
}

// 1 − the average bass-move cost; the bass is the slash note when there is one, else the root.
function bassSmoothness(sequence) {
  if (sequence.length < 2) return 1;
  let cost = 0;
  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(bassOf(sequence[i - 1]) - bassOf(sequence[i])) % 12;
    cost += BASS_COSTS[Math.min(distance, 12 - distance)];
  }
  return 1 - cost / (sequence.length - 1);
}

function bassOf(chord) {
  const parsed = chordOf(chord.symbol);
  return parsed.bassPc ?? parsed.rootPc;
}
