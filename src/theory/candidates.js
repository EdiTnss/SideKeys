// Reharmonization candidates: for every slot, the chords compatible with the melody's target
// notes, labeled by technique relative to the original chord and its neighbours. Pure.
// Claude only ever picks from this list (constrained selection), so a chord that clashes with
// the melody cannot reach the piece.

import { parseChord, classifyPc } from './chords.js';
import { parseNoteName, midiToName } from './notes.js';

export const TECHNIQUES = ['original', 'quality-change', 'tritone-sub', 'secondary-dominant', 'related-ii', 'backdoor', 'diminished-passing', 'chromatic-approach', 'modal-interchange', 'coltrane', 'sus-color', 'other'];

const CANDIDATE_QUALITIES = ['maj7', '6/9', 'm7', 'm6', 'mMaj7', '7', '7alt', '7b9', '7sus4', 'ø7', '°'];
const DOMINANT_QUALITIES = new Set(['7', '7alt', '7b9']);
const FLAT_KEYS = new Set(['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
const LIGHT = new Set(['original', 'tritone-sub', 'related-ii', 'quality-change']);
export const STYLES = {
  tritone: ['tritone-sub', 'related-ii', 'quality-change', 'chromatic-approach', 'secondary-dominant', 'backdoor', 'sus-color', 'modal-interchange', 'diminished-passing', 'coltrane'],
  'chromatic-approach': ['chromatic-approach', 'diminished-passing', 'tritone-sub', 'related-ii', 'secondary-dominant', 'quality-change', 'backdoor', 'sus-color', 'modal-interchange', 'coltrane'],
  coltrane: ['coltrane', 'secondary-dominant', 'tritone-sub', 'related-ii', 'quality-change', 'chromatic-approach', 'backdoor', 'sus-color', 'modal-interchange', 'diminished-passing'],
  modal: ['modal-interchange', 'quality-change', 'sus-color', 'backdoor', 'related-ii', 'tritone-sub', 'secondary-dominant', 'chromatic-approach', 'diminished-passing', 'coltrane'],
  free: TECHNIQUES.slice(1, -1),
};
const EPSILON = 1e-6;

const chordCache = new Map();
const chordOf = symbol => {
  if (!chordCache.has(symbol)) chordCache.set(symbol, parseChord(symbol));
  return chordCache.get(symbol);
};
const noteName = (pc, flats) => midiToName(pc, { accidentals: flats ? 'flat' : 'sharp' }).replace(/-?\d+$/, '');

/**
 * → { slots: [{ bar, slot, beat, original, candidates: [{ id, chords: [{ symbol, bar, beat }], technique,
 *     spans, bassStepToNext, warnings: [{ midi, beat, degree }] }] }] }
 */
export function generateCandidates(piece, { style = 'free', intensity = 'medium', maxPerSlot = 12 } = {}) {
  const key = piece.analysis.key;
  const tonic = parseNoteName(key.tonic).pc;
  const flats = FLAT_KEYS.has(key.tonic);
  const beatsPerBar = piece.timeSignature[0];
  const priorities = STYLES[style] ?? STYLES.free;

  const slots = piece.bars.flatMap((bar, barIndex) => bar.chords.map((chord, slotIndex) => ({
    bar: barIndex + 1,
    slot: slotIndex + 1,
    beat: chord.beat,
    endBeat: bar.chords[slotIndex + 1]?.beat ?? beatsPerBar + 1,
    symbol: chord.symbol,
    chord: chordOf(chord.symbol),
    structural: chord.analysis.melody.structural,
  })));

  return {
    slots: slots.map((slot, i) => {
      const prev = slots[i - 1] ?? null;
      const next = slots[i + 1] ?? null;
      const after = slots[i + 2] ?? null;
      const context = { slot, prev, next, after, tonic, mode: key.mode, flats };
      const list = [
        makeCandidate(slot, [{ symbol: slot.symbol, bar: slot.bar, beat: slot.beat }], 'original', 1, next, fit(slot.symbol, slot.structural).warnings),
        ...singleChordCandidates(context),
        ...relatedTwoCandidates(context),
        ...coltraneCandidates(context),
      ];
      const allowed = list.filter(c => c.technique === 'original' || allowedBy(c.technique, intensity, style));
      const seen = new Set();
      const unique = allowed.filter(c => {
        const signature = c.chords.map(ch => `${ch.bar}:${ch.beat}:${ch.symbol}`).join('|');
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
      const rank = c => {
        if (c.technique === 'other') return 99;
        const at = priorities.indexOf(c.technique);
        return at === -1 ? 50 : at;
      };
      unique.sort((a, b) =>
        (a.technique === 'original' ? -1 : b.technique === 'original' ? 1 : 0)
        || rank(a) - rank(b)
        || a.bassStepToNext - b.bassStepToNext
        || symbolsOf(a).localeCompare(symbolsOf(b)));
      return { bar: slot.bar, slot: slot.slot, beat: slot.beat, original: slot.symbol, candidates: diversify(unique, maxPerSlot) };
    }),
  };
}

// The first candidate of every technique (in priority order), then the second of each, and so
// on up to the limit: a menu of twelve quality changes on one root would be useless to Claude.
function diversify(sorted, limit) {
  const groups = new Map();
  for (const candidate of sorted) {
    if (!groups.has(candidate.technique)) groups.set(candidate.technique, []);
    groups.get(candidate.technique).push(candidate);
  }
  const picked = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const group of groups.values()) {
      if (group[round] && picked.length < limit) {
        picked.push(group[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}

const symbolsOf = candidate => candidate.chords.map(c => c.symbol).join(' ');

function allowedBy(technique, intensity, style) {
  if (intensity === 'light') return LIGHT.has(technique);
  if (technique === 'other') return intensity === 'heavy' && style === 'free';
  return true;
}

/** Every structural note must be a chord tone or a tension; avoid notes are kept with a warning. */
function fit(symbol, notes) {
  const chord = chordOf(symbol);
  const warnings = [];
  for (const note of notes) {
    const { role, degree } = classifyPc(chord, note.midi % 12);
    if (role === 'wrong') return { ok: false, warnings: [] };
    if (role === 'avoid') warnings.push({ midi: note.midi, beat: note.beat, degree });
  }
  return { ok: true, warnings };
}

function makeCandidate(slot, chords, technique, spans, next, warnings) {
  const id = technique === 'original'
    ? `b${slot.bar}s${slot.slot}-orig`
    : `b${slot.bar}s${slot.slot}-${technique}-${chords.map(c => c.symbol).join('_')}`;
  const lastRoot = chordOf(chords[chords.length - 1].symbol).rootPc;
  const step = next ? Math.abs(lastRoot - next.chord.rootPc) % 12 : 0;
  return { id, chords, technique, spans, bassStepToNext: Math.min(step, 12 - step), warnings };
}

// ---- Single-chord candidates: 12 roots × the candidate qualities ---------------------------

function singleChordCandidates(context) {
  const { slot, next, flats } = context;
  const out = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const quality of CANDIDATE_QUALITIES) {
      const symbol = spellRoot(pc, quality, context, flats) + quality;
      if (symbol === slot.symbol) continue;
      const result = fit(symbol, slot.structural);
      if (!result.ok) continue;
      const technique = classify(pc, quality, context);
      out.push(makeCandidate(slot, [{ symbol, bar: slot.bar, beat: slot.beat }], technique, 1, next, result.warnings));
    }
  }
  return out;
}

// A passing diminished chord is spelled in the direction it travels (C#° up, Db° down).
function spellRoot(pc, quality, { prev, next }, flats) {
  if (quality === '°' && prev && next) {
    const from = prev.chord.rootPc;
    const to = next.chord.rootPc;
    if (to === (from + 2) % 12 && pc === (from + 1) % 12) return noteName(pc, false);
    if (to === (from + 10) % 12 && pc === (from + 11) % 12) return noteName(pc, true);
  }
  return noteName(pc, flats);
}

function classify(pc, quality, { slot, prev, next, tonic, mode }) {
  const originalRoot = slot.chord.rootPc;
  const originalDominant = slot.chord.quality === '7';
  const dominant = DOMINANT_QUALITIES.has(quality);
  const nextRoot = next?.chord.rootPc ?? null;
  const sameRoot = pc === originalRoot;

  if (sameRoot && originalDominant && quality === '7sus4') return 'sus-color';
  if (dominant && next && pc === (tonic + 10) % 12 && nextRoot === tonic) return 'backdoor';
  if (dominant && originalDominant && pc === (originalRoot + 6) % 12) return 'tritone-sub';
  if (dominant && next && pc === (nextRoot + 7) % 12 && !(sameRoot && originalDominant)) return 'secondary-dominant';
  if (quality === '°' && prev && next) {
    const from = prev.chord.rootPc;
    const up = nextRoot === (from + 2) % 12 && pc === (from + 1) % 12;
    const down = nextRoot === (from + 10) % 12 && pc === (from + 11) % 12;
    if (up || down) return 'diminished-passing';
  }
  if ((dominant || quality === 'm7') && next && !sameRoot && (pc === (nextRoot + 1) % 12 || pc === (nextRoot + 11) % 12)) return 'chromatic-approach';
  if (isBorrowed(pc, quality, tonic, mode)) return 'modal-interchange';
  if (sameRoot) return 'quality-change';
  return 'other';
}

// Chords borrowed from the parallel minor (in major) or major (in minor).
function isBorrowed(pc, quality, tonic, mode) {
  const degree = (pc - tonic + 12) % 12;
  const minorish = ['m7', 'm6', 'mMaj7'].includes(quality);
  const majorish = ['maj7', '6/9'].includes(quality);
  if (mode === 'minor') {
    return (degree === 5 && (majorish || quality === '7')) || (degree === 2 && quality === 'm7') || (degree === 0 && majorish);
  }
  return (degree === 5 && minorish) || (degree === 8 && majorish) || (degree === 3 && majorish)
    || (degree === 2 && quality === 'ø7') || (degree === 10 && (majorish || quality === '7')) || (degree === 0 && minorish);
}

// ---- Related ii: the slot splits into ii + the original dominant ---------------------------

function relatedTwoCandidates({ slot, next, flats }) {
  if (slot.chord.quality !== '7' || slot.endBeat - slot.beat < 2) return [];
  const mid = slot.beat + (slot.endBeat - slot.beat) / 2;
  const targetMinor = next ? ['m7', 'm6', 'mMaj7', 'm7b5'].includes(next.chord.quality) : false;
  const ii = noteName((slot.chord.rootPc + 7) % 12, flats) + (targetMinor ? 'ø7' : 'm7');   // a fifth above the dominant
  const [first, second] = splitNotes(slot.structural, mid);
  const fitFirst = fit(ii, first);
  const fitSecond = fit(slot.symbol, second);
  if (!fitFirst.ok || !fitSecond.ok) return [];
  const chords = [{ symbol: ii, bar: slot.bar, beat: slot.beat }, { symbol: slot.symbol, bar: slot.bar, beat: mid }];
  return [makeCandidate(slot, chords, 'related-ii', 1, next, [...fitFirst.warnings, ...fitSecond.warnings])];
}

// ---- Coltrane cycle: two slots of descending major thirds into the target -----------------

function coltraneCandidates({ slot, next, after, flats }) {
  if (!next || !after || next.chord.quality !== '7') return [];
  if ((next.chord.rootPc + 5) % 12 !== after.chord.rootPc) return [];
  if (slot.endBeat - slot.beat < 2 || next.endBeat - next.beat < 2) return [];
  const target = after.chord.rootPc;
  const midA = slot.beat + (slot.endBeat - slot.beat) / 2;
  const midB = next.beat + (next.endBeat - next.beat) / 2;
  const chords = [
    { symbol: `${noteName((target + 8) % 12, flats)}maj7`, bar: slot.bar, beat: slot.beat },
    { symbol: `${noteName((target + 11) % 12, flats)}7`, bar: slot.bar, beat: midA },
    { symbol: `${noteName((target + 4) % 12, flats)}maj7`, bar: next.bar, beat: next.beat },
    { symbol: `${noteName((target + 7) % 12, flats)}7`, bar: next.bar, beat: midB },
  ];
  const [a1, a2] = splitNotes(slot.structural, midA);
  const [b1, b2] = splitNotes(next.structural, midB);
  const fits = [fit(chords[0].symbol, a1), fit(chords[1].symbol, a2), fit(chords[2].symbol, b1), fit(chords[3].symbol, b2)];
  if (fits.some(f => !f.ok)) return [];
  return [makeCandidate(slot, chords, 'coltrane', 2, after, fits.flatMap(f => f.warnings))];
}

function splitNotes(notes, mid) {
  return [notes.filter(n => n.beat < mid - EPSILON), notes.filter(n => n.beat >= mid - EPSILON)];
}
