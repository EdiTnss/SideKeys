// Progression library and the text grid parser. Pure, no DOM.
//
// Grid text: bars separated by '|', chords separated by spaces, '%' repeats the previous bar.
// Chords in a bar share the beats evenly; when they cannot, it is an error (explicit durations
// may come later). Every symbol is validated with parseChord.

import { parseChord, ChordParseError } from './chords.js';
import { parseNoteName, midiToName, pcInterval } from './notes.js';

export class GridParseError extends Error {
  constructor(bar, reason) {
    super(`Bar ${bar}: ${reason}`);
    this.name = 'GridParseError';
    this.bar = bar;
    this.reason = reason;
  }
}

// Written in C; getProgression transposes. Half-diminished is spelled ø7, diminished °.
export const PROGRESSIONS = {
  'ii-V-I': { name: 'ii–V–I (major)', grid: '| Dm7 | G7 | Cmaj7 | % |' },
  'ii-V-i': { name: 'ii–V–i (minor)', grid: '| Dø7 | G7alt | Cm6 | % |' },
  blues: { name: 'Blues (basic)', grid: '| C7 | F7 | C7 | % | F7 | % | C7 | % | G7 | F7 | C7 | G7 |' },
  'jazz-blues': { name: 'Jazz blues', grid: '| C7 | F7 | C7 | Gm7 C7 | F7 | F#° | C7 | Em7 A7 | Dm7 | G7 | C7 A7 | Dm7 G7 |' },
  'rhythm-changes-A': { name: 'Rhythm changes (A section)', grid: '| Cmaj7 A7 | Dm7 G7 | Em7 A7 | Dm7 G7 | Gm7 C7 | Fmaj7 F#° | Cmaj7 A7 | Dm7 G7 |' },
  turnaround: { name: 'Turnaround I–VI–ii–V', grid: '| Cmaj7 A7 | Dm7 G7 |' },
  coltrane: { name: 'Coltrane changes', grid: '| Cmaj7 Eb7 | Abmaj7 B7 | Emaj7 G7 | Cmaj7 |' },
};

// Keys whose accidentals are flats; everything else (G, D, A, E, B, F#, C#) gets sharps.
const FLAT_KEYS = new Set(['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);

// root, the rest of the symbol, an optional slash bass. Lazy `.*?` lets '6/9' stay in the rest.
const SYMBOL_RE = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;

/** '| Dm7 G7 | Cmaj7 | % |' → { timeSignature, bars: [{ chords: [{ symbol, beat }] }] } */
export function parseGrid(text, { timeSignature = [4, 4] } = {}) {
  if (typeof text !== 'string') throw new GridParseError(1, 'the grid must be text');
  const segments = text.split('|').map(segment => segment.trim());
  if (segments[0] === '') segments.shift();                        // leading bar line
  if (segments.length && segments[segments.length - 1] === '') segments.pop();   // trailing bar line
  if (segments.length === 0) throw new GridParseError(1, 'empty grid');

  const beats = timeSignature[0];
  const bars = [];
  segments.forEach((segment, index) => {
    const bar = index + 1;
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) throw new GridParseError(bar, 'empty bar');
    if (tokens.length === 1 && tokens[0] === '%') {
      if (bars.length === 0) throw new GridParseError(bar, '"%" has nothing to repeat');
      bars.push({ chords: bars[bars.length - 1].chords.map(chord => ({ ...chord })) });
      return;
    }
    if (beats % tokens.length !== 0) {
      throw new GridParseError(bar, `${tokens.length} chords do not divide ${beats} beats evenly`);
    }
    const step = beats / tokens.length;
    const chords = tokens.map((symbol, i) => {
      try {
        parseChord(symbol);
      } catch (error) {
        throw new GridParseError(bar, error instanceof ChordParseError ? error.message : String(error));
      }
      return { symbol, beat: 1 + i * step };
    });
    bars.push({ chords });
  });
  return { timeSignature: [...timeSignature], bars };
}

/** Back to text; a bar identical to the previous one becomes '%'. */
export function formatGrid(bars) {
  const texts = bars.map((bar, i) => {
    const previous = bars[i - 1];
    if (previous && sameChords(previous, bar)) return '%';
    return bar.chords.map(chord => chord.symbol).join(' ');
  });
  return `| ${texts.join(' | ')} |`;
}

function sameChords(a, b) {
  return a.chords.length === b.chords.length
    && a.chords.every((chord, i) => chord.symbol === b.chords[i].symbol && chord.beat === b.chords[i].beat);
}

/** 'Dm7' up 3 semitones → 'Fm7'. Root and slash bass move; quality and extensions stay as written. */
export function transposeSymbol(symbol, semitones, { flats = true } = {}) {
  const match = SYMBOL_RE.exec(symbol.trim());
  if (!match) throw new ChordParseError(symbol, 'missing or invalid root');
  const [, root, rest, bass] = match;
  const accidentals = flats ? 'flat' : 'sharp';
  // midiToName never spells Cb, Fb, E# or B#, which is what we want on chord roots.
  const move = name => midiToName(parseNoteName(name).pc + semitones, { accidentals }).replace(/-?\d+$/, '');
  return move(root) + rest + (bass ? `/${move(bass)}` : '');
}

/** The same grid in another key; accidentals follow the target key. Same key → symbols untouched. */
export function transposeGrid(grid, fromKey, toKey) {
  const semitones = pcInterval(parseNoteName(fromKey).pc, parseNoteName(toKey).pc);
  const flats = FLAT_KEYS.has(toKey);
  const bars = grid.bars.map(bar => ({
    chords: bar.chords.map(chord => ({
      symbol: semitones === 0 ? chord.symbol : transposeSymbol(chord.symbol, semitones, { flats }),
      beat: chord.beat,
    })),
  }));
  return { ...grid, timeSignature: [...grid.timeSignature], bars };
}

/** A library progression, parsed and transposed: { id, name, key, timeSignature, bars }. */
export function getProgression(id, key = 'C') {
  const entry = PROGRESSIONS[id];
  if (!entry) throw new Error(`Unknown progression "${id}"`);
  const timeSignature = entry.timeSignature ?? [4, 4];
  const grid = transposeGrid(parseGrid(entry.grid, { timeSignature }), 'C', key);
  return { id, name: entry.name, key, ...grid };
}
