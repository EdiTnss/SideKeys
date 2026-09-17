// Chord symbol → pitch-class sets: chord tones, tensions, avoid notes. Pure, no DOM.
// The quality table from CLAUDE.md lives here as data (QUALITIES). Keep both in sync.

export const QUALITIES = {};

export class ChordParseError extends Error {
  constructor(symbol, reason) {
    super(`Cannot parse chord symbol "${symbol}": ${reason}`);
    this.name = 'ChordParseError';
    this.symbol = symbol;
    this.reason = reason;
  }
}

function notImplemented() {
  throw new Error('not implemented');
}

/**
 * 'C7b9/E' → { symbol, root, rootPc, quality, extensions, chordTones, guideTones, required,
 *              tensions: { available, altered }, avoid, caution, degrees, bass, bassPc }
 * All lists are pitch classes in degree order. degrees[pc] is a label like 'b9', or null for a wrong note.
 * Throws ChordParseError on invalid symbols.
 */
export function parseChord(symbol, { minorFunction = 'ii' } = {}) { notImplemented(); }

/** → { role: 'chordTone' | 'tension' | 'altered' | 'avoid' | 'wrong', degree: string | null, caution: boolean } */
export function classifyPc(chord, pc) { notImplemented(); }

/** Canonical quality ids for the drill picker: ['maj7', 'm7', '7', …] */
export function qualityIds() { notImplemented(); }
