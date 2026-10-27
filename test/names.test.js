// The names the engine gives things — units, levels, shapes, chord groups, progressions, and
// the runs built from them — in both languages. A level, a shape or a progression added without
// a name in each language fails here, not on someone's screen.
//
// The engine keeps its English names (the Laboratory and the tests read them); in English the
// translated name must be that same string, so the two cannot drift apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import ro from '../src/i18n/ro.js';
import { PATH, reviewLevel } from '../src/game/path.js';
import { QUALITY_GROUPS, SHAPES, trainingPlan, DEFAULT_TRAINING } from '../src/game/training.js';
import { challengeLevel } from '../src/game/challenge.js';
import { PROGRESSIONS } from '../src/theory/progressions.js';
import {
  unitName, unitBlurb, levelName, shapeName, groupName, progressionName,
} from '../src/i18n/names.js';

const inBoth = key => {
  assert.ok(key in en, `${key} is missing in en.js`);
  assert.ok(key in ro, `${key} is missing in ro.js`);
};

test('every unit on the path has a name and a blurb in both languages', () => {
  for (const unit of PATH) {
    inBoth(`unit.${unit.id}.name`);
    inBoth(`unit.${unit.id}.blurb`);
    assert.equal(unitName('en', unit), unit.name);
    assert.equal(unitBlurb('en', unit), unit.blurb);
  }
});

test('every level on the path has a name in both languages', () => {
  for (const unit of PATH) {
    for (const level of unit.levels) {
      inBoth(`level.${level.id}`);
      assert.equal(levelName('en', level), level.name, level.id);
    }
  }
});

test('the review and the daily challenge are named in both languages', () => {
  inBoth('level.review');
  inBoth('level.challenge');
  assert.equal(levelName('en', reviewLevel(['7'])), 'Review');
  assert.equal(levelName('ro', reviewLevel(['7'])), 'Recapitulare');
  const challenge = challengeLevel('2026-10-27');
  assert.equal(levelName('en', challenge), challenge.name);
  assert.match(levelName('ro', challenge), new RegExp(`#${challenge.number}$`));
});

test('every shape, chord group and progression has a name in both languages', () => {
  for (const shape of SHAPES) {
    inBoth(`shape.${shape.id}`);
    assert.equal(shapeName('en', shape), shape.label);
  }
  for (const group of QUALITY_GROUPS) {
    inBoth(`group.${group.id}`);
    assert.equal(groupName('en', group), group.name);
  }
  for (const [id, progression] of Object.entries(PROGRESSIONS)) {
    inBoth(`progression.${id}`);
    assert.equal(progressionName('en', id), progression.name);
  }
});

test('a training run is named in either language, the same in English as the engine names it', () => {
  const runs = [
    trainingPlan({ ...DEFAULT_TRAINING, mode: 'drill', shape: 'any' }),
    trainingPlan({ ...DEFAULT_TRAINING, mode: 'drill', shape: 'drop-2' }),
    trainingPlan({ ...DEFAULT_TRAINING, mode: 'progression', progression: 'turnaround', key: 'Bb' }),
  ];
  for (const run of runs) {
    assert.ok(run);
    assert.equal(levelName('en', run), run.name);
  }
  assert.equal(levelName('ro', runs[0]), 'Exercițiu');
  assert.equal(levelName('ro', runs[1]), 'Exercițiu · Drop 2');
  assert.equal(levelName('ro', runs[2]), 'Turnaround I–VI–ii–V în Bb');
});

test('jazz names stay English in Romanian; the words around them do not', () => {
  assert.equal(unitName('ro', PATH.find(unit => unit.id === 'drop-2')), 'Drop 2');
  assert.equal(unitName('ro', PATH.find(unit => unit.id === 'triads')), 'Triade');
  assert.equal(shapeName('ro', SHAPES.find(shape => shape.id === 'any')), 'Orice voicing');
});

test('something with no name of its own keeps the one it came with', () => {
  assert.equal(levelName('ro', { id: 'nowhere', name: 'As it was' }), 'As it was');
});
