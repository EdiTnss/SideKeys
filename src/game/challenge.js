// The daily challenge: the same ten chords for everyone, chosen by the day itself.
//
// Wordle's shape with the engine's content — one ramp a day, free play, and a grid of squares to
// paste somewhere. There is no server and no account, because the date *is* the seed: two
// browsers on the same day draw the same chords without either of them being told what they are.
//
// Three decisions here are Edi's (2026-10-11), and each one costs something: the ramp climbs, so
// a beginner earns the first squares instead of a blank grid; there is no clock, so the grid
// compares one thing only; and one pass a day is the official one, so the grid stays honest.

import { parseChord, chartSymbol } from '../theory/chords.js';
import { spellPlain } from '../theory/notes.js';
import { isRight, isClean } from '../theory/stars.js';

/** Day 1. The challenge is numbered from here, the way Wordle numbers its puzzles. */
export const EPOCH = '2026-10-11';

/** Kept at the path's tempo for the day the challenge is ever played on the clock. */
const TEMPO = 120;

const TWELVE = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'];

/**
 * The ramp: ten rungs, each a pool the day draws one chord from. It follows the order the path
 * teaches — triads, inversions, sevenths, then the four shapes — so nothing is demanded before
 * the unit that teaches it, and a player who has only reached unit two still earns squares.
 *
 * Every pool here is one the generator can answer in every key; the test walks a year of seeds
 * to keep it that way, because a seed is content nobody reviewed.
 */
export const RUNGS = [
  { kind: 'chords', qualities: ['', 'm'], keys: TWELVE },
  { kind: 'chords', qualities: ['', 'm', 'sus4'], keys: TWELVE },
  {
    kind: 'slash',
    shapes: [
      { quality: '', degree: '3' }, { quality: '', degree: '5' },
      { quality: 'm', degree: 'b3' }, { quality: 'm', degree: '5' },
    ],
    keys: TWELVE,
  },
  { kind: 'chords', qualities: ['maj7', 'm7'], keys: TWELVE },
  { kind: 'chords', qualities: ['7', 'm7b5'], keys: TWELVE },
  { kind: 'chords', qualities: ['dim7', 'm6'], keys: TWELVE },
  { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, texture: 'shell' },
  { kind: 'chords', qualities: ['m7', '7', 'maj7'], keys: TWELVE, texture: ['rootless-A', 'rootless-B'] },
  { kind: 'chords', qualities: ['maj7', 'm7', '7'], keys: TWELVE, texture: 'drop-2' },
  // Quartal tops the ramp, and takes no dominant: with the tightened rule (at most one augmented
  // fourth) the generator builds no quartal voicing for one, in any key.
  { kind: 'chords', qualities: ['m7', 'maj7'], keys: TWELVE, texture: 'quartal' },
];

/** The squares the grid is pasted as. Green reads as "clean" everywhere; none of these is a
 *  theory colour, so a grid never pretends to be the keyboard's verdict. */
export const SQUARES = Object.freeze({ clean: '🟩', right: '🟨', missed: '⬛', unplayed: '⬜' });

/** The published page, until `sidekeys.app` is live and serving the shell. */
export const SHARE_URL = 'https://editnss.github.io/SideKeys/';

/** Days since the epoch, counted on the calendar rather than in hours, so a DST night is still
 *  one day. Never below 1: a clock set before the epoch gets puzzle #1, not #0. */
export function challengeNumber(date) {
  return Math.max(1, dayIndex(date) - dayIndex(EPOCH) + 1);
}

function dayIndex(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/**
 * The day's challenge: ten asks, in ramp order, each carrying the shape its rung demands.
 *
 * @param {string} date A 'YYYY-MM-DD' stamp, the player's local day (see `dayStamp`).
 * @returns {{ date: string, number: number,
 *             asks: Array<{ symbol: string, texture: string | string[] | null }> }}
 */
export function dailyChallenge(date) {
  const draw = generator(seedFrom(date));
  const pick = list => list[Math.floor(draw() * list.length)];
  const asks = [];
  for (const rung of RUNGS) {
    let ask = drawAsk(rung, pick);
    // A rung redraws rather than repeat the chord below it: ten chords should be ten chords. The
    // tries are bounded because a pool of one would otherwise spin for ever.
    for (let tries = 0; tries < 8 && ask.symbol === asks.at(-1)?.symbol; tries += 1) {
      ask = drawAsk(rung, pick);
    }
    asks.push(ask);
  }
  return { date, number: challengeNumber(date), asks };
}

function drawAsk(rung, pick) {
  const key = pick(rung.keys);
  const texture = rung.texture ?? null;
  if (rung.kind === 'slash') {
    const shape = pick(rung.shapes);
    // Spelled from the chord, so Eb/Gb never comes out as Eb/F#, and named as a chart names it.
    const chord = parseChord(chartSymbol(key, shape.quality));
    return { symbol: `${chord.symbol}/${spellPlain(chord.root, shape.degree)}`, texture };
  }
  return { symbol: chartSymbol(key, pick(rung.qualities)), texture };
}

/**
 * The challenge as something the game screen can run. `free` is the clock's absence made
 * explicit: the screen hides the timed run, because a timed grid and a free one would be pasted
 * side by side as if they meant the same thing.
 *
 * @param {string} date
 */
export function challengeLevel(date) {
  const { asks, number } = dailyChallenge(date);
  return {
    id: `challenge-${date}`,
    name: `Daily challenge #${number}`,
    tempo: TEMPO,
    free: true,
    // Already shaped, one texture per rung: `asksFor` hands these through untouched.
    asks: { kind: 'fixed', asks },
  };
}

/**
 * One square per ask. `missed` is a chord that was played and came back wrong; `unplayed` is one
 * that was never reached, and the two are worth telling apart in a grid someone else reads.
 *
 * @param {Array<{ analysis: any, texture?: string | string[] | null }>} attempts
 * @returns {Array<'clean' | 'right' | 'missed' | 'unplayed'>}
 */
export function challengeStates(attempts) {
  return attempts.map(attempt => {
    if (!attempt.analysis) return 'unplayed';
    const asked = { texture: attempt.texture ?? null };
    if (isClean(attempt.analysis, asked)) return 'clean';
    if (isRight(attempt.analysis, asked)) return 'right';
    return 'missed';
  });
}

/**
 * The grid as text to paste. Clean squares are the score, because clean is what the app is for —
 * right-but-not-clean still shows, as its own colour, so the grid says more than a number.
 *
 * @param {{ number: number, states: string[], url?: string }} result
 */
export function shareText({ number, states, url = SHARE_URL }) {
  const clean = states.filter(state => state === 'clean').length;
  const grid = states.map(state => SQUARES[state] ?? SQUARES.unplayed).join('');
  return `SideKeys #${number} · ${clean}/${states.length} clean\n${grid}\n${url}`;
}

// ---- the seed ------------------------------------------------------------------------------

/**
 * A date hashed into one 32-bit seed (xmur3), then a small generator over it (mulberry32). Both
 * are standard public-domain one-liners, written out rather than installed: the game rules take
 * no dependencies, and the whole point is that the same day draws the same chords in every
 * browser with nothing in between.
 */
function seedFrom(text) {
  let hash = 1779033703 ^ text.length;
  for (let at = 0; at < text.length; at += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(at), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function generator(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
