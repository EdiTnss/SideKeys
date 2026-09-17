// Progression library and the text grid parser. Pure, no DOM.

function notImplemented() {
  throw new Error('not implemented');
}

export class GridParseError extends Error {}

export const PROGRESSIONS = {};

export function parseGrid(text, { timeSignature = [4, 4] } = {}) { notImplemented(); }
export function formatGrid(bars) { notImplemented(); }
export function transposeSymbol(symbol, semitones, { flats = true } = {}) { notImplemented(); }
export function transposeGrid(grid, fromKey, toKey) { notImplemented(); }
export function getProgression(id, key = 'C') { notImplemented(); }
