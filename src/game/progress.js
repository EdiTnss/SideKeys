// What the player has to show for it: the best stars on each level, the days played, what is
// due to come back, and the level played last. No DOM beyond localStorage, and never mutated in
// place. There is no XP: it bought nothing the stars and the streak did not already say, and
// it went on 2026-10-12 (Edi).
//
// It lives here rather than in the shell because `node --test` has to reach it, and because the
// same arithmetic would have to run on a server the day a leaderboard needs checking.

import { storageKey } from '../storage.js';
import { parseChord } from '../theory/chords.js';
import { isClean } from '../theory/stars.js';
import { pathState, levelById } from './path.js';

/** Three clean answers in a row retire a weak spot; one miss puts the count back to zero. */
export const REVIEW_HITS = 3;

export function emptyProgress() {
  return { stars: {}, days: {}, review: {}, challenge: null, last: null };
}

/**
 * What any playing leaves behind, on the path or off it: the seconds added to the day, and the
 * review queue moved by what was missed and what came back clean. `missed` and `cleared` are
 * chord qualities, which is what the queue is keyed by: a weak spot is "m7b5", not "Abm7b5 that
 * one time".
 */
function played(progress, { today, seconds = 0, missed = [], cleared = [] }) {
  const review = { ...(progress.review ?? {}) };

  for (const quality of missed) {
    const entry = review[quality];
    // Back tomorrow, not today: sleeping on it is the point of spacing it out.
    review[quality] = { misses: (entry?.misses ?? 0) + 1, hits: 0, dueOn: nextDay(today) };
  }
  for (const quality of cleared) {
    const entry = review[quality];
    if (!entry) continue;                       // nothing to review: a clean answer is just clean
    const hits = entry.hits + 1;
    if (hits >= REVIEW_HITS) delete review[quality];
    else review[quality] = { ...entry, hits, dueOn: nextDay(today) };
  }

  return {
    days: { ...(progress.days ?? {}), [today]: (progress.days?.[today] ?? 0) + Math.max(0, Math.round(seconds)) },
    review,
  };
}

/**
 * A finished run. Stars are kept at their best — a worse pass never takes a star away — and a
 * level on the path becomes the place "continue" picks up from. The minutes and the review
 * queue move as they do for any playing.
 *
 * @param {any} progress
 * @param {{ levelId: string, stars: number, today: string,
 *           seconds?: number, missed?: string[], cleared?: string[] }} run
 */
export function recordRun(progress, { levelId, stars, today, seconds = 0, missed = [], cleared = [] }) {
  return {
    // Spread first: this used to list the fields it kept, which silently dropped the daily
    // challenge the day that field was added.
    ...progress,
    stars: { ...progress.stars, [levelId]: Math.max(progress.stars[levelId] ?? 0, stars) },
    ...played(progress, { today, seconds, missed, cleared }),
    // The review and the challenge are not places on the path, so they do not move it.
    last: levelById(levelId) ? levelId : progress.last ?? null,
  };
}

/**
 * A stretch of Training: free practice, off the path. It is playing, so the minutes, the streak
 * and the weak spots count exactly as they do anywhere else. It is not the path, so no star is
 * earned and the place "continue" picks up from does not move (Edi, 2026-10-12).
 *
 * @param {any} progress
 * @param {{ today: string, seconds?: number, missed?: string[], cleared?: string[] }} practice
 */
export function recordPractice(progress, { today, seconds = 0, missed = [], cleared = [] }) {
  return { ...progress, ...played(progress, { today, seconds, missed, cleared }) };
}

/**
 * The day's challenge, filed once. Only the first pass of the day is the official one: the
 * grid someone pastes is the one they played cold, and a second run is practice (Edi,
 * 2026-10-11). Only the latest day is kept — a history of grids is not something anything
 * asks for yet, and the day it does it belongs in an account, not in this browser.
 *
 * @param {any} progress
 * @param {{ date: string, number: number, states: string[], stars: number }} result
 */
export function recordChallenge(progress, result) {
  if (progress.challenge?.date === result.date) return progress;
  return { ...progress, challenge: { ...result } };
}

/** The official result for a day, or null when that day has not been played. */
export function challengeResult(progress, date) {
  const record = progress.challenge;
  return record && record.date === date ? record : null;
}

/** The day after a 'YYYY-MM-DD' stamp, in local time. */
function nextDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return dayStamp(new Date(year, month - 1, day + 1));
}

/**
 * Days played in a row, counting back from today. A day with nothing in it yet does not break
 * the streak — the day is not over — so a streak that ran to yesterday still stands.
 */
export function streak(progress, today) {
  const days = progress.days ?? {};
  let from = days[today] ? today : previousDay(today);
  if (!days[from]) return 0;
  let count = 0;
  while (days[from]) {
    count += 1;
    from = previousDay(from);
  }
  return count;
}

function previousDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return dayStamp(new Date(year, month - 1, day - 1));
}

/** Seconds played on a given day, for the minutes goal. */
export function secondsOn(progress, date) {
  return progress.days?.[date] ?? 0;
}

/**
 * Which chord qualities a run got clean and which it did not. A quality missed even once counts
 * as missed, however often it came back clean in the same run: the weak spot is what matters.
 */
export function outcomesFor(attempts) {
  const missed = new Set();
  const cleared = new Set();
  for (const attempt of attempts) {
    if (!attempt.analysis) continue;
    const chord = parseChord(attempt.symbol);
    // The symbol without its root and without its slash bass. The bass is cut by what the
    // parser found, not at the first slash, which would file a 6/9 under 6.
    const body = attempt.symbol.slice(chord.root.length);
    const quality = chord.bass ? body.slice(0, -(chord.bass.length + 1)) : body;
    (isClean(attempt.analysis) ? cleared : missed).add(quality);
  }
  for (const quality of missed) cleared.delete(quality);
  return { missed: [...missed], cleared: [...cleared] };
}

/** The weak spots due for review, worst first. */
export function dueReviews(progress, today) {
  return Object.entries(progress.review ?? {})
    .filter(([, entry]) => entry.dueOn <= today)
    .map(([quality, entry]) => ({ quality, ...entry }))
    .sort((a, b) => b.misses - a.misses || a.quality.localeCompare(b.quality));
}

/**
 * Where "continue the path" goes: the first open level short of three stars, looked for from the
 * level played last and round to the start again. Every unit is open, so looking from the top
 * would send someone who began at Rootless back to the triads.
 *
 * @param {Record<string, number>} stars
 * @param {string | null} [last] The level played last, or anything else to start from the top.
 * @returns {{ unit: any, level: any, stars: number } | null}
 */
export function nextLevel(stars, last = null) {
  const open = pathState(stars).flatMap(entry => entry.levels
    .filter(item => item.unlocked)
    .map(item => ({ unit: entry.unit, level: item.level, stars: item.stars })));
  const from = Math.max(0, open.findIndex(item => item.level.id === last));
  return [...open.slice(from), ...open.slice(0, from)].find(item => item.stars < 3) ?? null;
}

/** Today, as the key the counts are filed under. Local time: the player's day, not UTC's. */
export function dayStamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(storageKey('progress'));
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    // Anything that is not the shape we wrote starts over: progress is a convenience, and a
    // broken file must never stop someone from playing.
    if (!data || typeof data !== 'object') return emptyProgress();
    if (typeof data.stars !== 'object' || data.stars === null || Array.isArray(data.stars)) return emptyProgress();
    return {
      // A file from before 2026-10-12 also carries `xp` and `plays`. They are simply not read:
      // the stars in that file were earned, and it must not be thrown away for the rest.
      stars: data.stars,
      // Added after the first saves went out, so an older file simply starts these empty.
      days: (typeof data.days === 'object' && data.days) || {},
      review: (typeof data.review === 'object' && data.review) || {},
      challenge: (typeof data.challenge === 'object' && data.challenge) || null,
      last: typeof data.last === 'string' ? data.last : null,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage?.setItem(storageKey('progress'), JSON.stringify(progress));
  } catch {
    // A full or blocked storage is not worth interrupting a session for.
  }
}
