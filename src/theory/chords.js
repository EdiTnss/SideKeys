// Chord symbol → pitch-class sets: chord tones, tensions, avoid notes. Pure, no DOM.
// The quality table from CLAUDE.md lives here as data (QUALITIES). Keep both in sync.
// Degree labels follow the Berklee / Real Book convention:
// 7 = major seventh, b7 = minor seventh, bb7 = diminished seventh.

import { parseNoteName, DEGREE_SEMITONES } from './notes.js';

// One row per quality. Every list holds degree labels; parseChord turns them into pitch classes.
// `required` is what the drill demands (root is never required: rootless voicings are a goal).
// `caution` is a subset of `tensions`: valid, but flagged as informational.
export const QUALITIES = {
  maj7: {
    aliases: ['maj7', 'Δ7', '∆7', 'M7', 'MA7', 'ma7', 'Δ', '∆'],
    chordTones: ['1', '3', '5', '7'], guideTones: ['3', '7'], required: ['3', '7'],
    tensions: ['9', '#11', '13'], altered: [], avoid: ['11'], caution: [],
  },
  '6': {
    aliases: ['6'],
    chordTones: ['1', '3', '5', '6'], guideTones: ['3', '6'], required: ['3', '6'],
    tensions: ['9', '#11', '7'], altered: [], avoid: ['11'], caution: [],
  },
  '6/9': {
    aliases: ['6/9', '69'],
    chordTones: ['1', '3', '5', '6', '9'], guideTones: ['3', '6'], required: ['3', '6', '9'],
    tensions: ['#11', '7'], altered: [], avoid: ['11'], caution: [],
  },
  m7: {
    aliases: ['m7', '-7', 'min7', 'mi7', 'MI7'],
    chordTones: ['1', 'b3', '5', 'b7'], guideTones: ['b3', 'b7'], required: ['b3', 'b7'],
    tensions: ['9', '11', '13'], altered: [], avoid: [], caution: [], // 13 is caution when the chord is a ii
  },
  m6: {
    aliases: ['m6', '-6', 'min6', 'mi6'],
    chordTones: ['1', 'b3', '5', '6'], guideTones: ['b3', '6'], required: ['b3', '6'],
    tensions: ['9', '11', '7'], altered: [], avoid: [], caution: [],
  },
  mMaj7: {
    aliases: ['mMaj7', 'mmaj7', 'm(maj7)', 'mM7', 'minMaj7', '-Δ7', '-Δ', '-∆7', '-∆', '-M7'],
    chordTones: ['1', 'b3', '5', '7'], guideTones: ['b3', '7'], required: ['b3', '7'],
    tensions: ['9', '11', '13'], altered: [], avoid: [], caution: [],
  },
  '7': {
    aliases: ['7'],
    chordTones: ['1', '3', '5', 'b7'], guideTones: ['3', 'b7'], required: ['3', 'b7'],
    tensions: ['9', '13'], altered: ['b9', '#9', '#11', 'b13'], avoid: ['11'], caution: [],
  },
  '7sus4': {
    aliases: ['7sus4', '7sus'],
    chordTones: ['1', '4', '5', 'b7'], guideTones: ['4', 'b7'], required: ['4', 'b7'],
    tensions: ['9', '13'], altered: [], avoid: ['3'], caution: [],
  },
  sus4: {
    aliases: ['sus4', 'sus'],
    chordTones: ['1', '4', '5'], guideTones: ['4'], required: ['4'],
    tensions: ['9', '13', 'b7'], altered: [], avoid: ['3'], caution: [],
  },
  m7b5: {
    aliases: ['m7b5', 'm7(b5)', '-7b5', '-7(b5)', 'mi7(b5)', 'MI7(b5)', 'ø7', 'ø', 'Ø7', 'Ø'],
    chordTones: ['1', 'b3', 'b5', 'b7'], guideTones: ['b3', 'b7'], required: ['b3', 'b5', 'b7'],
    tensions: ['9', '11', 'b13'], altered: [], avoid: [], caution: ['9'],
  },
  dim7: {
    aliases: ['dim7', '°7', 'º7', 'o7', 'dim', '°', 'º'], // a bare ° or dim reads as dim7, as in charts
    chordTones: ['1', 'b3', 'b5', 'bb7'], guideTones: ['b3', 'bb7'], required: ['b3', 'b5', 'bb7'],
    tensions: ['9', '11', 'b13', '7'], altered: [], avoid: [], caution: [],
  },
  maj: {
    aliases: ['', 'maj', 'M', 'MA', 'ma'], // plain 'C'
    chordTones: ['1', '3', '5'], guideTones: ['3'], required: ['3'],
    tensions: ['7', '9', '#11', '13'], altered: [], avoid: ['11'], caution: [],
  },
  m: {
    aliases: ['m', '-', 'min', 'mi', 'MI'],
    chordTones: ['1', 'b3', '5'], guideTones: ['b3'], required: ['b3'],
    tensions: ['b7', '7', '9', '11', '13'], altered: [], avoid: [], caution: [],
  },
};

// Table order for the drill picker. Kept by hand because Object.keys() moves the
// integer-like keys '6' and '7' to the front. Checked against the table at load time.
const QUALITY_IDS = ['maj7', '6', '6/9', 'm7', 'm6', 'mMaj7', '7', '7sus4', 'sus4', 'm7b5', 'dim7', 'maj', 'm'];
if ([...QUALITY_IDS].sort().join() !== Object.keys(QUALITIES).sort().join()) {
  throw new Error('QUALITY_IDS and QUALITIES are out of sync');
}

// 'C9', 'Cm11', 'Cmaj13': an extension right after the family name implies the family's seventh chord.
const SHORTHAND_FAMILIES = [
  { prefixes: [''], quality: '7' },
  { prefixes: ['m', '-', 'min', 'mi', 'MI'], quality: 'm7' },
  { prefixes: ['maj', 'Δ', '∆', 'M', 'MA', 'ma'], quality: 'maj7' },
];

// Every accepted alias → what it means. Sorted longest first so 'm7b5' wins over 'm7' and
// 'C6/9' is never read as 'C6' with a bass note.
const ALIASES = buildAliases();

function buildAliases() {
  const entries = [];
  for (const [quality, row] of Object.entries(QUALITIES)) {
    for (const alias of row.aliases) entries.push([alias, { quality, extensions: [] }]);
  }
  for (const { prefixes, quality } of SHORTHAND_FAMILIES) {
    for (const prefix of prefixes) {
      for (const ext of ['9', '11', '13']) entries.push([prefix + ext, { quality, extensions: [ext] }]);
    }
  }
  for (const ext of ['9', '13']) {
    entries.push([`${ext}sus4`, { quality: '7sus4', extensions: [ext] }]);
    entries.push([`${ext}sus`, { quality: '7sus4', extensions: [ext] }]);
  }
  entries.push(['alt', { quality: '7', extensions: ['alt'] }]); // 'Calt' = 'C7alt'
  return entries.sort((a, b) => b[0].length - a[0].length);
}

// An explicit extension makes the other forms of the same degree wrong notes.
// b9 and #9 coexist (both live in the half-whole scale), so neither excludes the other.
const EXCLUDES = {
  b9: ['9'], '#9': ['9'], '9': ['b9', '#9'],
  b13: ['13'], '13': ['b13'],
  '11': [], '#11': [],
};

// Dominant-only spellings. '#5' is the b13 with the natural 5 gone; 'alt' also drops 9 and 13
// and keeps b9, #9, #11 and b13 available: the augmented core is required, the rest is color.
const DOMINANT_SHORTHANDS = {
  b5: { label: '#11', wrong: [] },
  '#5': { label: 'b13', wrong: ['5', '13'] },
  alt: { label: 'b13', wrong: ['5', '9', '13'] },
};

const ROOT_RE = /^[A-G][#b]?/;
const EXTENSION_RE = /^(alt|b13|#11|b9|#9|b5|#5|13|11|9)/;
const SEPARATOR_RE = /^[\s,()]+/;

export class ChordParseError extends Error {
  constructor(symbol, reason) {
    super(`Cannot parse chord symbol "${symbol}": ${reason}`);
    this.name = 'ChordParseError';
    this.symbol = symbol;
    this.reason = reason;
  }
}

/**
 * 'C7b9/E' → { symbol, root, rootPc, quality, extensions, chordTones, guideTones, required,
 *              tensions: { available, altered }, avoid, caution, degrees, bass, bassPc }
 * All lists are pitch classes in degree order. degrees[pc] is a label like 'b9', or null for a wrong note.
 * Throws ChordParseError on invalid symbols.
 */
export function parseChord(symbol, { minorFunction = 'ii' } = {}) {
  if (typeof symbol !== 'string' || symbol.trim() === '') {
    throw new ChordParseError(String(symbol), 'empty symbol');
  }
  const text = symbol.trim();

  // 1. Slash bass. '/9' is part of '6/9', not a bass note.
  let body = text;
  let bass = null;
  const slash = text.lastIndexOf('/');
  if (slash > 0 && text.slice(slash) !== '/9') {
    bass = text.slice(slash + 1);
    body = text.slice(0, slash);
    try {
      parseNoteName(bass);
    } catch {
      throw new ChordParseError(text, `invalid bass note "${bass}"`);
    }
  }

  // 2. Root.
  const rootMatch = ROOT_RE.exec(body);
  if (!rootMatch) throw new ChordParseError(text, 'missing or invalid root');
  const root = rootMatch[0];
  const rootPc = parseNoteName(root).pc;
  const afterRoot = body.slice(root.length);

  // 3. Quality: longest alias that the remainder starts with.
  const [alias, meaning] = ALIASES.find(([a]) => afterRoot.startsWith(a));
  const quality = meaning.quality;
  const row = QUALITIES[quality];

  // 4. Extensions: the alias's implied ones, then whatever follows it.
  const explicit = [...meaning.extensions, ...tokenizeExtensions(afterRoot.slice(alias.length), text)];

  // 5. Apply the row, then the explicit extensions on top of it.
  let chordTones = [...row.chordTones];
  let available = [...row.tensions];
  let altered = [...row.altered];
  let avoid = [...row.avoid];
  const required = [...row.required];
  const caution = [...row.caution];
  if (quality === 'm7' && minorFunction === 'ii') caution.push('13');

  const extensions = [];
  for (const token of explicit) {
    let label = token;
    let wrong = EXCLUDES[token] ?? [];
    if (token in DOMINANT_SHORTHANDS) {
      if (quality !== '7') throw new ChordParseError(text, `"${token}" is only valid on a dominant 7`);
      ({ label, wrong } = DOMINANT_SHORTHANDS[token]);
    }
    if (![...available, ...altered, ...avoid].includes(label)) {
      throw new ChordParseError(text, `"${label}" is not available on ${quality}`);
    }
    if (!extensions.includes(label)) extensions.push(label);
    if (!required.includes(label)) required.push(label);
    if (avoid.includes(label)) {
      avoid = avoid.filter(d => d !== label);
      available.push(label);
    }
    const isWrong = d => wrong.includes(d);
    chordTones = chordTones.filter(d => !isWrong(d));
    available = available.filter(d => !isWrong(d));
    altered = altered.filter(d => !isWrong(d));
    avoid = avoid.filter(d => !isWrong(d));
  }

  // 6. Degree labels → pitch classes.
  const toPc = label => (rootPc + DEGREE_SEMITONES[label]) % 12;
  const degrees = Array(12).fill(null);
  for (const label of [...chordTones, ...available, ...altered, ...avoid]) degrees[toPc(label)] = label;

  return {
    symbol: text,
    root,
    rootPc,
    quality,
    extensions,
    chordTones: chordTones.map(toPc),
    guideTones: row.guideTones.map(toPc),
    required: required.map(toPc),
    tensions: { available: available.map(toPc), altered: altered.map(toPc) },
    avoid: avoid.map(toPc),
    caution: caution.map(toPc),
    degrees,
    bass,
    bassPc: bass === null ? null : parseNoteName(bass).pc,
  };
}

/** 'b9#11' or '(b9, #11)' → ['b9', '#11']. Throws on anything that is not an extension. */
function tokenizeExtensions(text, symbol) {
  const tokens = [];
  let rest = text;
  while (rest.length > 0) {
    const separator = SEPARATOR_RE.exec(rest);
    if (separator) {
      rest = rest.slice(separator[0].length);
      continue;
    }
    const match = EXTENSION_RE.exec(rest);
    if (!match) throw new ChordParseError(symbol, `unknown quality or extension "${rest}"`);
    tokens.push(match[1]);
    rest = rest.slice(match[1].length);
  }
  return tokens;
}

/** → { role: 'chordTone' | 'tension' | 'altered' | 'avoid' | 'wrong', degree: string | null, caution: boolean } */
export function classifyPc(chord, pc) {
  const degree = chord.degrees[pc];
  const caution = chord.caution.includes(pc);
  if (chord.chordTones.includes(pc)) return { role: 'chordTone', degree, caution };
  if (chord.tensions.available.includes(pc)) return { role: 'tension', degree, caution };
  if (chord.tensions.altered.includes(pc)) return { role: 'altered', degree, caution };
  if (chord.avoid.includes(pc)) return { role: 'avoid', degree, caution };
  return { role: 'wrong', degree: null, caution: false };
}

/** Canonical quality ids in table order: ['maj7', '6', '6/9', 'm7', …] */
export function qualityIds() {
  return [...QUALITY_IDS];
}
