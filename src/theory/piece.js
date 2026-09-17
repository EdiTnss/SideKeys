// The piece model: a chord grid plus a recorded melody placed on bars. Pure, no DOM.
//
// Raw notes come from the recorder in musical time: { midi, bar, beat, durationBeats, velocity },
// unquantized. addMelody places them on the bars, quantized (eighths by default), and marks the
// structural ones: on a strong beat or held for at least a beat, and at least a subdivision long.
// Notes shorter than 60 ms only live in `raw`. The melody is the last recording.

import { parseGrid } from './progressions.js';
import { parseChord, classifyPc } from './chords.js';
import { midiToName } from './notes.js';
import { quantizePosition } from './timing.js';

const STORAGE_KEY = 'voicing-lab.pieces';
const EPSILON = 1e-9;
const BEAT_EPSILON = 1e-6;

export function createPiece({ title = 'Untitled', key = 'C', timeSignature = [4, 4], tempo = 120, grid, bars } = {}) {
  const source = bars ?? parseGrid(grid, { timeSignature }).bars;
  return {
    title,
    key,
    timeSignature: [...timeSignature],
    tempo,
    bars: source.map(bar => ({ chords: bar.chords.map(chord => ({ ...chord })), melody: [] })),
    raw: [],
  };
}

/** A new piece with `rawNotes` as its melody. Does not modify the input. */
export function addMelody(piece, rawNotes, { division = 2, minDurationMs = 60 } = {}) {
  const beatsPerBar = piece.timeSignature[0];
  const minBeats = minDurationMs / (60000 / piece.tempo);
  const step = 1 / division;
  const notes = rawNotes
    .map(note => ({ ...note, start: (note.bar - 1) * beatsPerBar + (note.beat - 1) }))
    .sort((a, b) => a.start - b.start);
  const melody = piece.bars.map(() => []);

  notes.forEach((note, i) => {
    if (note.bar < 1) return;                                          // count-in
    const next = notes[i + 1];
    let duration = note.durationBeats;
    if (next && next.start < note.start + duration) duration = next.start - note.start;   // ends where the next one starts
    if (duration < minBeats) return;                                   // too short to be a note: raw only
    const position = quantizePosition({ bar: note.bar, beat: note.beat }, { division, timeSignature: piece.timeSignature });
    if (position.bar > piece.bars.length) return;                      // past the last bar
    const quantized = Math.max(step, Math.round(duration * division) / division);
    const structural = duration >= step - EPSILON && (isStrongBeat(position.beat, beatsPerBar) || quantized >= 1);
    melody[position.bar - 1].push({ midi: note.midi, beat: position.beat, duration: quantized, structural });
  });

  return {
    ...piece,
    timeSignature: [...piece.timeSignature],
    bars: piece.bars.map((bar, i) => ({ chords: bar.chords.map(chord => ({ ...chord })), melody: melody[i] })),
    raw: rawNotes.map(note => ({ ...note })),
  };
}

// Beat 1, and the middle beat when the bar has an even number of beats (3 in 4/4).
function isStrongBeat(beat, beatsPerBar) {
  return beat === 1 || (beatsPerBar % 2 === 0 && beat === 1 + beatsPerBar / 2);
}

/** The target notes, flattened: [{ bar, midi, beat, duration }]. What a reharmonization must respect. */
export function structuralMelody(piece) {
  return piece.bars.flatMap((bar, i) =>
    bar.melody.filter(note => note.structural).map(note => ({ bar: i + 1, midi: note.midi, beat: note.beat, duration: note.duration })));
}

// ---- The reharmonization safety net ------------------------------------------------------
//
// Runs on the final result whatever its source (pipeline, hand editing, import). With candidates
// generated correctly an 'outside' issue cannot happen; if one does, it is a bug with a test to
// write, and meanwhile the slot goes back to its original chord.

const chordCache = new Map();
const chordOf = symbol => {
  if (!chordCache.has(symbol)) chordCache.set(symbol, parseChord(symbol));
  return chordCache.get(symbol);
};

/**
 * Every structural melody note against the chord sounding under it. Passing notes are free.
 * `sequence` is the chords in piece order: [{ symbol, bar, beat }]; the caller's own objects
 * come back on `chord`, so extra fields (an owning slot, say) survive the trip.
 * → [{ note: { bar, beat, midi }, chord, symbol, degree, relation }], relation 'avoid' | 'outside'
 */
export function checkMelody(piece, sequence) {
  const issues = [];
  piece.bars.forEach((bar, barIndex) => {
    for (const note of bar.melody) {
      if (!note.structural) continue;
      const chord = activeChord(sequence, barIndex + 1, note.beat);
      if (!chord) continue;
      const { role, degree } = classifyPc(chordOf(chord.symbol), note.midi % 12);
      if (role !== 'wrong' && role !== 'avoid') continue;
      issues.push({
        note: { bar: barIndex + 1, beat: note.beat, midi: note.midi },
        chord,
        symbol: chord.symbol,
        degree: role === 'wrong' ? null : degree,
        relation: role === 'wrong' ? 'outside' : 'avoid',
      });
    }
  });
  return issues;
}

// The last chord that starts at or before (bar, beat); the sequence is in piece order.
function activeChord(sequence, bar, beat) {
  let active = null;
  for (const chord of sequence) {
    if (chord.bar < bar || (chord.bar === bar && chord.beat <= beat + BEAT_EPSILON)) active = chord;
    else break;
  }
  return active;
}

/**
 * validateReharm(piece, slots) → { issues, warnings, rejects, ok }
 * `slots` is the resolved list from scoring.js. An avoid note is a warning and the slot stays;
 * an outside note rejects the slot that put the chord there, along with any slot it covers.
 */
export function validateReharm(piece, slots) {
  const sequence = slots.flatMap(slot => slot.chords.map(chord => ({ ...chord, owner: slot })));
  const issues = checkMelody(piece, sequence).map(issue => ({
    note: issue.note,
    symbol: issue.symbol,
    degree: issue.degree,
    relation: issue.relation,
    slot: { bar: issue.chord.owner.bar, slot: issue.chord.owner.slot },
  }));

  const rejects = [];
  const seen = new Set();
  const add = (bar, slot, reason) => {
    const key = `${bar}:${slot}`;
    if (seen.has(key)) return;
    seen.add(key);
    rejects.push({ bar, slot, reason });
  };
  for (const issue of issues) {
    if (issue.relation !== 'outside') continue;
    const owner = slots.find(slot => slot.bar === issue.slot.bar && slot.slot === issue.slot.slot);
    add(issue.slot.bar, issue.slot.slot, `${midiToName(issue.note.midi)} is not in ${issue.symbol}`);
    for (const covered of slots) {
      if (owner?.candidate && covered.coveredBy === owner.candidate.id) {
        add(covered.bar, covered.slot, `covered by the rejected candidate from bar ${owner.bar}`);
      }
    }
  }
  return { issues, warnings: issues.filter(issue => issue.relation === 'avoid').length, rejects, ok: rejects.length === 0 };
}

export function toJSON(piece) {
  return JSON.stringify(piece, null, 2);
}

/** Parses and validates; throws with a readable message on anything that is not a piece. */
export function fromJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a piece: invalid JSON');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.bars)) throw new Error('Not a piece: missing bars');
  const bars = data.bars.map((bar, i) => {
    if (!bar || !Array.isArray(bar.chords)) throw new Error(`Not a piece: bar ${i + 1} has no chords`);
    const chords = bar.chords.map(chord => {
      parseChord(chord.symbol);                                        // throws ChordParseError on garbage
      return { symbol: chord.symbol, beat: Number(chord.beat) };
    });
    const melody = Array.isArray(bar.melody)
      ? bar.melody.map(note => ({ midi: Number(note.midi), beat: Number(note.beat), duration: Number(note.duration), structural: Boolean(note.structural) }))
      : [];
    return { chords, melody };
  });
  return {
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    key: typeof data.key === 'string' ? data.key : 'C',
    timeSignature: Array.isArray(data.timeSignature) && data.timeSignature.length === 2 ? data.timeSignature.map(Number) : [4, 4],
    tempo: Number.isFinite(data.tempo) ? data.tempo : 120,
    bars,
    raw: Array.isArray(data.raw) ? data.raw.map(note => ({ ...note })) : [],
  };
}

// ---- Local storage: one map of title → piece --------------------------------------------

function readAll(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeAll(all, storage) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function savePiece(piece, storage = globalThis.localStorage) {
  const all = readAll(storage);
  all[piece.title] = JSON.parse(toJSON(piece));
  return writeAll(all, storage);
}

export function loadPiece(title, storage = globalThis.localStorage) {
  const all = readAll(storage);
  return all[title] ? fromJSON(JSON.stringify(all[title])) : null;
}

export function listPieces(storage = globalThis.localStorage) {
  return Object.keys(readAll(storage)).sort((a, b) => a.localeCompare(b));
}

export function deletePiece(title, storage = globalThis.localStorage) {
  const all = readAll(storage);
  if (!(title in all)) return false;
  delete all[title];
  return writeAll(all, storage);
}
