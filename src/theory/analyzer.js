// Voicing analysis: what was played against what was asked. Pure, no DOM.
// Input: MIDI notes (60 = C4) and a chord from parseChord. Output: a plain object the UI
// renders and, in Phase 3a, the prompt receives unchanged.

import { pitchClass, octave, midiToName, spellDegree } from './notes.js';
import { classifyPc } from './chords.js';

// Lower note of an adjacent pair below `below` → that interval is muddy. Data, so the
// classic per-interval limits can replace these later without touching the code.
export const LOW_INTERVAL_LIMITS = [
  { below: 48, semitones: [1, 2, 3] },   // under C3: m2, M2, m3
  { below: 43, semitones: [4] },         // under G2: M3
];

const INTERVAL_NAMES = { 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4', 6: 'A4', 7: 'P5' };
const TYPE_NAMES = {
  shell: 'Shell', 'rootless-A': 'Rootless A', 'rootless-B': 'Rootless B',
  'drop-2': 'Drop 2', 'drop-3': 'Drop 3', 'drop-2-4': 'Drop 2&4',
  quartal: 'Quartal', 'upper-structure': 'Upper structure triad',
  close: 'Close position', spread: 'Spread',
};

const isFifth = label => label === '5' || label === 'b5';
const isSpecific = type => type !== 'close' && type !== 'spread';
const span = sorted => sorted[sorted.length - 1] - sorted[0];
const isClose = sorted => span(sorted) <= 12;
const unique = list => [...new Set(list)];

/**
 * → { notes, roles, missing, hasRoot, wrong, avoid, caution, muddy, doublings, voicing, messages }
 * Lists of notes are pitch classes; `voicing` is { type, bass, detail }; `messages` are
 * { level: 'warning' | 'info', code, text } in order of importance.
 */
export function analyzeVoicing(notes, chord, { limits = LOW_INTERVAL_LIMITS } = {}) {
  const sorted = [...notes].sort((a, b) => a - b);
  const roles = sorted.map(midi => {
    const pc = pitchClass(midi);
    return { midi, pc, ...classifyPc(chord, pc) };
  });
  const pcs = new Set(roles.map(r => r.pc));

  const missing = chord.required.filter(pc => !pcs.has(pc));
  const hasRoot = pcs.has(chord.rootPc);
  const wrong = unique(roles.filter(r => r.role === 'wrong').map(r => r.pc));
  const avoid = unique(roles.filter(r => r.role === 'avoid').map(r => r.pc));
  const caution = unique(roles.filter(r => r.caution).map(r => r.pc));
  const muddy = findMuddyIntervals(sorted, limits);
  const doublings = findDoublings(roles, chord);
  const voicing = classifyVoicing(sorted, chord);
  const messages = buildMessages({ chord, missing, hasRoot, wrong, avoid, caution, muddy, doublings, voicing });

  return { notes: sorted, roles, missing, hasRoot, wrong, avoid, caution, muddy, doublings, voicing, messages };
}

function findMuddyIntervals(sorted, limits) {
  const muddy = [];
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1];
    const upper = sorted[i];
    const semitones = upper - lower;
    if (limits.some(limit => lower < limit.below && limit.semitones.includes(semitones))) {
      muddy.push({ lower, upper, semitones });
    }
  }
  return muddy;
}

// A pitch class played more than once, unless it is the root or the 5 sitting in the bass.
function findDoublings(roles, chord) {
  const counts = new Map();
  for (const { pc } of roles) counts.set(pc, (counts.get(pc) ?? 0) + 1);
  const bass = roles[0];
  const exempt = bass && (bass.pc === chord.rootPc || isFifth(bass.degree)) ? bass.pc : null;
  return [...counts].filter(([pc, count]) => count > 1 && pc !== exempt).map(([pc]) => pc);
}

// The whole voicing first. If that is only close/spread and the bass is the root or the 5,
// the notes above it get their own chance: C2 + E4 G4 B4 D5 is "rootless A, root in the bass".
function classifyVoicing(sorted, chord) {
  const whole = classifyNotes(sorted, chord);
  if (!isSpecific(whole.type) && sorted.length >= 3) {
    const bassLabel = chord.degrees[pitchClass(sorted[0])];
    const bass = bassLabel === '1' ? 'root' : isFifth(bassLabel) ? '5' : null;
    if (bass) {
      const upper = classifyNotes(sorted.slice(1), chord);
      if (isSpecific(upper.type)) return { ...upper, bass };
    }
  }
  return { ...whole, bass: null };
}

// First match wins. Quartal comes before the drop checks because any four stacked fourths
// are also the drop 2 of a close voicing with a second in it, and a pianist calls them quartal.
function classifyNotes(sorted, chord) {
  const n = sorted.length;
  if (n < 2) return { type: null, detail: null };
  if (isShell(sorted, chord)) return { type: 'shell', detail: null };
  if (n === 4) {
    const labels = sorted.map(midi => chord.degrees[pitchClass(midi)]);
    const pcs = sorted.map(pitchClass);
    if (matchesRootless(pcs, labels, chord, 'A')) return { type: 'rootless-A', detail: null };
    if (matchesRootless(pcs, labels, chord, 'B')) return { type: 'rootless-B', detail: null };
  }
  if (isQuartal(sorted)) return { type: 'quartal', detail: null };
  if (n === 4) {
    const drop = dropType(sorted);
    if (drop) return { type: drop, detail: null };
  }
  const triad = upperStructure(sorted, chord);
  if (triad) return { type: 'upper-structure', detail: triad };
  return { type: isClose(sorted) ? 'close' : 'spread', detail: null };
}

// 2–3 notes, nothing but the guide tones (3 and 7, or their equivalents) and maybe the root.
function isShell(sorted, chord) {
  if (chord.guideTones.length < 2 || sorted.length < 2 || sorted.length > 3) return false;
  const pcs = new Set(sorted.map(pitchClass));
  const allowed = new Set([...chord.guideTones, chord.rootPc]);
  return [...pcs].every(pc => allowed.has(pc)) && chord.guideTones.every(pc => pcs.has(pc));
}

// A: 3-5-7-9 from the bottom, B: 7-9-3-5. On a dominant the 5 slot also takes 13 or b13
// and the 9 slot also takes b9 or #9, so G7alt as B Eb F Ab is still an A voicing.
function matchesRootless(pcs, labels, chord, form) {
  if (chord.guideTones.length < 2) return false;
  const dominant = chord.quality === '7';
  const [third, seventh] = chord.guideTones;
  const slots = {
    third: i => pcs[i] === third,
    seventh: i => pcs[i] === seventh,
    fifth: i => isFifth(labels[i]) || (dominant && (labels[i] === '13' || labels[i] === 'b13')),
    ninth: i => labels[i] === '9' || (dominant && (labels[i] === 'b9' || labels[i] === '#9')),
  };
  const order = form === 'A' ? ['third', 'fifth', 'seventh', 'ninth'] : ['seventh', 'ninth', 'third', 'fifth'];
  return order.every((slot, i) => slots[slot](i));
}

// Adjacent intervals all perfect or augmented fourths; one major third tolerated from four notes up.
function isQuartal(sorted) {
  if (sorted.length < 3) return false;
  const intervals = sorted.slice(1).map((midi, i) => midi - sorted[i]);
  if (intervals.some(interval => interval !== 4 && interval !== 5 && interval !== 6)) return false;
  // Two augmented fourths in a row span an octave exactly, so the outer note is doubled: that is
  // a symmetric shape, not a quartal voicing.
  if (intervals.filter(interval => interval === 6).length > 1) return false;
  const thirds = intervals.filter(interval => interval === 4).length;
  if (thirds === 0) return true;
  // The one major third is the "So What" cap, so it sits on top; lower down, the voicing reads
  // from its third and the drop rules name it better. Three notes are too few for the cap: a
  // fourth under a third is a triad in second inversion (D–G–B).
  return thirds === 1 && intervals[intervals.length - 1] === 4 && sorted.length >= 4;
}

// Raise the lowest note (or the two lowest) by an octave: if the result is close position,
// the position the raised note lands in, counted from the top, names the drop.
function dropType(sorted) {
  const check = (indices, wanted) => {
    const lifted = sorted.map((midi, i) => (indices.includes(i) ? midi + 12 : midi));
    const ascending = [...lifted].sort((a, b) => a - b);
    if (!isClose(ascending)) return false;
    const fromTop = [...ascending].reverse();
    const positions = indices.map(i => fromTop.indexOf(sorted[i] + 12) + 1).sort();
    return positions.join() === wanted.join();
  };
  if (check([0], [2])) return 'drop-2';
  if (check([0], [3])) return 'drop-3';
  if (check([0, 1], [2, 4])) return 'drop-2-4';
  return null;
}

// On a dominant with at least five notes: the top three form a major or minor triad whose
// root is not the chord's root, above a base that holds both guide tones. Returns the triad's name.
function upperStructure(sorted, chord) {
  if (chord.quality !== '7' || sorted.length < 5) return null;
  const lower = new Set(sorted.slice(0, -3).map(pitchClass));
  if (!chord.guideTones.every(pc => lower.has(pc))) return null;
  const triad = findTriad(sorted.slice(-3).map(pitchClass));
  if (!triad || triad.root === chord.rootPc) return null;
  return pcName(triad.root, chord) + (triad.quality === 'minor' ? 'm' : '');
}

function findTriad(pcs) {
  const set = new Set(pcs);
  if (set.size !== 3) return null;
  for (const root of set) {
    if (set.has((root + 4) % 12) && set.has((root + 7) % 12)) return { root, quality: 'major' };
    if (set.has((root + 3) % 12) && set.has((root + 7) % 12)) return { root, quality: 'minor' };
  }
  return null;
}

// Spelled from the chord when the note has a degree (b9 on C is Db, not C#); flats otherwise.
function pcName(pc, chord) {
  const label = chord.degrees[pc];
  return label ? spellDegree(chord.root, label) : midiToName(pc).replace(/-?\d+$/, '');
}

const noteName = (midi, chord) => pcName(pitchClass(midi), chord) + octave(midi);

function buildMessages({ chord, missing, hasRoot, wrong, avoid, caution, muddy, doublings, voicing }) {
  const withDegree = pc => `${pcName(pc, chord)} (${chord.degrees[pc]})`;
  const messages = [];
  for (const pc of missing) messages.push({ level: 'warning', code: 'missing', text: `Missing ${withDegree(pc)}` });
  if (!hasRoot) messages.push({ level: 'info', code: 'rootless', text: `Rootless voicing (no ${chord.root})` });
  for (const pc of wrong) messages.push({ level: 'warning', code: 'wrong', text: `Wrong note: ${pcName(pc, chord)} is not in ${chord.symbol}` });
  for (const pc of avoid) messages.push({ level: 'warning', code: 'avoid', text: `Avoid note: ${withDegree(pc)}` });
  for (const pc of caution) messages.push({ level: 'info', code: 'caution', text: `Caution: ${withDegree(pc)}` });
  for (const { lower, upper, semitones } of muddy) {
    const interval = INTERVAL_NAMES[semitones] ?? `${semitones} semitones`;
    messages.push({ level: 'warning', code: 'muddy', text: `Muddy: ${noteName(lower, chord)}–${noteName(upper, chord)} (${interval}) is too low` });
  }
  for (const pc of doublings) messages.push({ level: 'info', code: 'doubling', text: `Doubled: ${pcName(pc, chord)}` });
  if (voicing.type) messages.push({ level: 'info', code: 'type', text: describeVoicing(voicing) });
  return messages;
}

function describeVoicing({ type, bass, detail }) {
  let text = TYPE_NAMES[type];
  if (detail) text += ` (${detail})`;
  if (bass) text += `, ${bass === 'root' ? 'root' : '5th'} in the bass`;
  return text;
}
