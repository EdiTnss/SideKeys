// What the player has to show for it: the best stars on each level, the XP, and how many times
// a level has paid out today. No DOM beyond localStorage, and never mutated in place.
//
// It lives here rather than in the shell because `node --test` has to reach it, and because the
// same arithmetic would have to run on a server the day a leaderboard needs checking.

import { storageKey } from '../storage.js';

export function emptyProgress() {
  return { stars: {}, xp: 0, plays: {} };
}

/**
 * A finished run. Stars are kept at their best — a worse pass never takes a star away — XP adds
 * up, and the level's count for the day goes up by one, which is what caps the XP on repeats.
 *
 * @param {{ stars: Record<string, number>, xp: number, plays: Record<string, { date: string, count: number }> }} progress
 * @param {{ levelId: string, stars: number, xp: number, today: string }} run
 */
export function recordRun(progress, { levelId, stars, xp, today }) {
  const played = progress.plays[levelId];
  const count = played?.date === today ? played.count + 1 : 1;
  return {
    stars: { ...progress.stars, [levelId]: Math.max(progress.stars[levelId] ?? 0, stars) },
    xp: progress.xp + xp,
    plays: { ...progress.plays, [levelId]: { date: today, count } },
  };
}

/** How many times this level has already paid out today — what xpFor needs to cap a repeat. */
export function playsToday(progress, levelId, today) {
  const played = progress.plays[levelId];
  return played?.date === today ? played.count : 0;
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
    if (typeof data.xp !== 'number' || !Number.isFinite(data.xp)) return emptyProgress();
    return { stars: data.stars, xp: data.xp, plays: (typeof data.plays === 'object' && data.plays) || {} };
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
