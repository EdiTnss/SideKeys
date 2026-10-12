// The daily challenge: the same ten chords for everyone, chosen by the day and nothing else.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord } from '../src/theory/chords.js';
import { plainName } from '../src/theory/notes.js';
import { analyzeVoicing } from '../src/theory/analyzer.js';
import { suggestVoicings } from '../src/theory/voicings.js';
import {
  EPOCH, RUNGS, SQUARES,
  challengeNumber, dailyChallenge, challengeStates, shareText,
} from '../src/game/challenge.js';

const on = (symbol, notes) => analyzeVoicing(notes, parseChord(symbol));

/** The day n days after a 'YYYY-MM-DD' stamp, as the same kind of stamp. */
const dayAfter = (date, n) => {
  const [year, month, day] = date.split('-').map(Number);
  const moved = new Date(year, month - 1, day + n);
  const pad = value => String(value).padStart(2, '0');
  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}`;
};

const year = Array.from({ length: 366 }, (_, n) => dayAfter(EPOCH, n));

test('challengeNumber: the epoch is #1, and it counts days, not calls', () => {
  assert.equal(challengeNumber(EPOCH), 1);
  assert.equal(challengeNumber(dayAfter(EPOCH, 1)), 2);
  assert.equal(challengeNumber(dayAfter(EPOCH, 365)), 366);
  // A clock set before the epoch must not produce #0 or a negative puzzle.
  assert.equal(challengeNumber(dayAfter(EPOCH, -5)), 1);
});

test('dailyChallenge: the same day gives the same chords, with no server to ask', () => {
  const date = dayAfter(EPOCH, 40);
  const first = dailyChallenge(date);
  const again = dailyChallenge(date);
  assert.deepEqual(first.asks, again.asks);
  assert.equal(first.number, 41);
  assert.equal(first.date, date);
});

test('dailyChallenge: ten rungs, every one of them a chord the analyzer can judge', () => {
  for (const date of year) {
    const { asks } = dailyChallenge(date);
    assert.equal(asks.length, RUNGS.length, `${date}: ${asks.length} rungs`);
    assert.equal(asks.length, 10, 'the ramp is ten chords long');
    for (const ask of asks) {
      assert.doesNotThrow(() => parseChord(ask.symbol), `${date}: ${ask.symbol}`);
    }
  }
});

test('dailyChallenge: it climbs — a bare triad at the bottom, a shape demanded at the top', () => {
  const { asks } = dailyChallenge(dayAfter(EPOCH, 7));
  assert.equal(asks[0].texture, null, 'the first rung asks for a triad, any voicing');
  assert.equal(parseChord(asks[0].symbol).guideTones.length, 1, 'a triad, not a seventh chord');
  assert.equal(asks.at(-1).texture, 'quartal', 'the last rung is the hardest shape in the engine');
  // The shapes arrive in the order the path teaches them, so nothing is demanded before its unit.
  const demanded = asks.map(ask => ask.texture).filter(Boolean);
  assert.deepEqual(demanded, ['shell', ['rootless-A', 'rootless-B'], 'drop-2', 'quartal']);
});

test('dailyChallenge: different days give different chords', () => {
  const distinct = new Set(year.map(date => dailyChallenge(date).asks.map(ask => ask.symbol).join(' ')));
  assert.ok(distinct.size > 300, `only ${distinct.size} distinct challenges in a year`);
});

test('dailyChallenge: no rung repeats the chord before it', () => {
  for (const date of year) {
    const { asks } = dailyChallenge(date);
    for (let at = 1; at < asks.length; at += 1) {
      assert.notEqual(asks[at].symbol, asks[at - 1].symbol, `${date}: ${asks[at].symbol} twice over`);
    }
  }
});

test('every rung that demands a shape can be answered, on every day of a year', () => {
  // The same conservative oracle the path uses: the engine's own generator, which only offers
  // warning-free voicings. A seed is not content someone reviewed, so this has to hold for every
  // day the calendar can produce, not for a sample.
  for (const date of year) {
    for (const ask of dailyChallenge(date).asks) {
      if (!ask.texture) continue;
      const wanted = [].concat(ask.texture);
      const found = suggestVoicings(parseChord(ask.symbol)).some(candidate => wanted.includes(candidate.type));
      assert.ok(found, `${date}: no ${wanted.join(' or ')} voicing for ${ask.symbol}`);
    }
  }
});

// ---- The grid --------------------------------------------------------------------------------

test('challengeStates: clean, right, missed, and never reached', () => {
  const attempts = [
    { symbol: 'Cmaj7', notes: [60, 64, 67, 71], analysis: on('Cmaj7', [60, 64, 67, 71]) },
    { symbol: 'Cmaj7', notes: [60, 64, 65, 71], analysis: on('Cmaj7', [60, 64, 65, 71]) },
    { symbol: 'Dm7', notes: [62, 66, 69, 72], analysis: on('Dm7', [62, 66, 69, 72]) },
    { symbol: 'G7', notes: [], analysis: null },
  ];
  assert.deepEqual(challengeStates(attempts), ['clean', 'right', 'missed', 'unplayed']);
});

test('challengeStates: a rung that demanded a shape is judged on that shape', () => {
  const shell = { symbol: 'C7', notes: [60, 64, 70], texture: 'shell', analysis: on('C7', [60, 64, 70]) };
  const close = { symbol: 'C7', notes: [60, 64, 67, 70], texture: 'shell', analysis: on('C7', [60, 64, 67, 70]) };
  assert.deepEqual(challengeStates([shell, close]), ['clean', 'missed']);
  // Without the demand it is simply a clean chord, which is what the lower rungs are.
  assert.deepEqual(challengeStates([{ ...close, texture: null }]), ['clean']);
});

test('shareText: the number, the score and the grid — and nothing that needs an account', () => {
  const states = ['clean', 'clean', 'right', 'missed', 'unplayed'];
  const text = shareText({ number: 12, states, url: 'https://example.test/' });
  const [headline, grid, link] = text.split('\n');
  assert.match(headline, /SideKeys #12/);
  assert.match(headline, /2\/5/, 'the score counts the clean squares');
  assert.equal(grid, `${SQUARES.clean}${SQUARES.clean}${SQUARES.right}${SQUARES.missed}${SQUARES.unplayed}`);
  assert.equal(link, 'https://example.test/');
  assert.ok(!text.includes('undefined'), text);
});

test('every chord a textured rung could ever draw has a voicing of that shape', () => {
  // The year-long walk above draws at random, so it proves nothing about the pools themselves.
  // This one is the whole cross product: every key against every quality the rung allows. It is
  // the guarantee that matters, because the seed is not content anybody reviewed.
  for (const [at, rung] of RUNGS.entries()) {
    if (!rung.texture) continue;
    const wanted = [].concat(rung.texture);
    for (const key of rung.keys) {
      for (const quality of rung.qualities) {
        const symbol = `${key}${quality}`;
        const found = suggestVoicings(parseChord(symbol)).some(candidate => wanted.includes(candidate.type));
        assert.ok(found, `rung ${at + 1}: no ${wanted.join(' or ')} voicing for ${symbol}`);
      }
    }
  }
});

test('no day of the year asks for a chord a chart would not write', () => {
  for (const date of year) {
    for (const { symbol } of dailyChallenge(date).asks) {
      const chord = parseChord(symbol);
      for (const name of [chord.root, chord.bass]) {
        if (name) assert.equal(plainName(name), name, `${date}: ${symbol}`);
      }
      const minorThird = chord.chordTones.includes((chord.rootPc + 3) % 12);
      assert.ok(!(minorThird && ['Db', 'Gb'].includes(chord.root)), `${date}: ${symbol} is written from C# or F#`);
    }
  }
});
