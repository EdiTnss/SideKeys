// The theory pages: one lesson per unit of the path. Data and three lookups, no DOM.
//
// A lesson is text, a handful of voicings to look at and listen to, and a list of what the game
// listens for. The text is a DRAFT: Claude wrote it on 2026-10-12 and the theory in it is Edi's
// to correct. What is not a matter of opinion is checked: test/lessons.test.js grades every
// example with the analyzer that grades the player, and holds every "listens for" line to a
// test that fails the day the engine stops behaving that way. A page cannot say one thing while
// the verdict says another.
//
// Examples are written as note names, bottom to top, and all fit the drawn keyboard (C2–C6).
// They are in C, or in the keys of a ii–V–I in C, so that one page can be compared with the next.

import { nameToMidi } from '../theory/notes.js';

/**
 * @typedef {{
 *   symbol: string,
 *   notes: string,                 // 'C4 E4 G4', bottom to top
 *   type: string,                  // what the analyzer calls it: 'close', 'shell', 'rootless-A', …
 *   inversion?: string,            // 'root position', '1st inversion', … where the page is about that
 *   caption: string,
 * }} LessonExample
 *
 * @typedef {{
 *   unit: string,                  // the id of the unit on the path
 *   title: string,
 *   lead: string,
 *   sections: Array<{ heading: string, text: string[] }>,
 *   examples: LessonExample[],
 *   chain?: LessonExample[],       // chords played one after another, where the movement is the point
 *   listens: string[],             // what the game checks, in the page's own words
 *   level: string,                 // where "Try it" goes: the first level of the unit
 * }} Lesson
 */

/** @type {Lesson[]} */
export const LESSONS = [
  {
    unit: 'triads',
    title: 'Triads',
    lead: 'Three notes: a root, a third above it and a fifth above it. Every chord further down this path is a triad with something added, or with something left out.',
    sections: [
      {
        heading: 'Major and minor',
        text: [
          'The third decides. Four semitones above the root is a major third, and the triad is major. Three semitones is a minor third, and the triad is minor. The fifth is the same in both: seven semitones above the root.',
        ],
      },
      {
        heading: 'Sus4',
        text: [
          'Take the third out and put the fourth in its place, five semitones above the root. With no third the chord is neither major nor minor. It hangs, and most of the time it wants to fall back to the third it replaced.',
        ],
      },
      {
        heading: 'Where the notes go',
        text: [
          'Anywhere. A triad is the same triad with its notes next to each other in one hand or spread over two octaves and both hands. Start with the three notes side by side, then try the root alone in the left hand and the rest in the right.',
        ],
      },
    ],
    examples: [
      { symbol: 'C', notes: 'C4 E4 G4', type: 'close', inversion: 'root position', caption: 'C major: root, major third, fifth.' },
      { symbol: 'Cm', notes: 'C4 Eb4 G4', type: 'close', inversion: 'root position', caption: 'C minor: only the third moved, down a half step.' },
      { symbol: 'Csus4', notes: 'C4 F4 G4', type: 'close', inversion: 'root position', caption: 'Csus4: the fourth stands where the third was.' },
      { symbol: 'C', notes: 'C3 E4 G4 C5', type: 'spread', inversion: 'root position', caption: 'The same C major over two hands. Still a C major triad.' },
    ],
    listens: [
      'The third decides whether you played the chord that was asked for: C with an E flat in it is not C.',
      'On a sus4 the fourth has to be there, and the third must not take its place.',
      'The spacing is yours: one hand or two, any octave.',
    ],
    level: 'triads-major',
  },

  {
    unit: 'inversions',
    title: 'Inversions',
    lead: 'The same three notes with a different one at the bottom. The chord keeps its name; what changes is the bass, and with it the way the chord leans.',
    sections: [
      {
        heading: 'Three positions',
        text: [
          'With the root lowest, the triad is in root position. With the third lowest it is in first inversion, and with the fifth lowest in second inversion. What happens above the lowest note does not change the name.',
        ],
      },
      {
        heading: 'How it is written',
        text: [
          'A slash names the bass. C/E is a C major triad with E as its lowest note; C/G is the same triad with G lowest. Read it as "C over E".',
        ],
      },
      {
        heading: 'What it is for',
        text: [
          'An inversion lets the bass move by step where the roots would leap, and lets your hand stay where it is from one chord to the next. The bass is the exercise in this unit: find it first, then put the rest of the chord on top.',
        ],
      },
    ],
    examples: [
      { symbol: 'C', notes: 'C4 E4 G4', type: 'close', inversion: 'root position', caption: 'Root position: C is the lowest note.' },
      { symbol: 'C/E', notes: 'E4 G4 C5', type: 'close', inversion: '1st inversion', caption: 'First inversion: the third, E, is lowest.' },
      { symbol: 'C/G', notes: 'G3 C4 E4', type: 'close', inversion: '2nd inversion', caption: 'Second inversion: the fifth, G, is lowest.' },
      { symbol: 'Cm/Eb', notes: 'Eb4 G4 C5', type: 'close', inversion: '1st inversion', caption: 'A minor triad inverts the same way: its third, E flat, is lowest.' },
      { symbol: 'C/E', notes: 'E3 C4 G4', type: 'spread', inversion: '1st inversion', caption: 'Two hands: E alone in the left, the rest wherever it falls.' },
    ],
    listens: [
      'Only the lowest note is checked against the slash. It has to be the note written after it, in any octave.',
      'Above the bass the notes can go anywhere.',
      'Play C/E with C at the bottom and the verdict says so: "Bass should be E, not C".',
    ],
    level: 'inv-major-first',
  },

  {
    unit: 'sevenths',
    title: 'Seventh chords',
    lead: 'A triad with one more third stacked on top: root, third, fifth, seventh. Four notes, and the chords most tunes are written in.',
    sections: [
      {
        heading: 'The four that carry almost every tune',
        text: [
          'Major seventh (maj7): a major triad with a major seventh, a half step under the octave. Dominant seventh (7): a major triad with a minor seventh, a whole step under the octave. Minor seventh (m7): a minor triad with a minor seventh. Half-diminished (m7b5): a minor third, a flattened fifth and a minor seventh.',
        ],
      },
      {
        heading: 'Two more',
        text: [
          'Diminished seventh (dim7): a minor third, a flattened fifth and a diminished seventh, so that every note is a minor third from the next. Its seventh is the same key as the major sixth. Minor sixth (m6): a minor triad with a major sixth instead of a seventh.',
        ],
      },
      {
        heading: 'The third and the seventh',
        text: [
          'The third and the seventh are the guide tones: on their own they tell a major seventh, a dominant and a minor seventh apart, which is why every voicing later on this path is built around them and why the root and the fifth can be left to someone else.',
          'The half-diminished is the exception worth knowing. It shares its third and its seventh with the minor seventh, so there the flattened fifth is the note that says which chord it is.',
        ],
      },
    ],
    examples: [
      { symbol: 'Cmaj7', notes: 'C4 E4 G4 B4', type: 'close', caption: 'Cmaj7: major third, major seventh.' },
      { symbol: 'C7', notes: 'C4 E4 G4 Bb4', type: 'close', caption: 'C7: the seventh came down a half step.' },
      { symbol: 'Cm7', notes: 'C4 Eb4 G4 Bb4', type: 'close', caption: 'Cm7: now the third came down too.' },
      { symbol: 'Cm7b5', notes: 'C4 Eb4 Gb4 Bb4', type: 'close', caption: 'Cm7b5: and now the fifth.' },
      { symbol: 'Cdim7', notes: 'C4 Eb4 Gb4 A4', type: 'close', caption: 'Cdim7: the seventh down once more. Minor thirds all the way up.' },
      { symbol: 'Cm6', notes: 'C4 Eb4 G4 A4', type: 'close', caption: 'Cm6: a minor triad with the sixth on top.' },
    ],
    listens: [
      'The third and the seventh have to be there. On a m6, the sixth stands where the seventh would.',
      'On m7b5 and dim7 the flattened fifth has to be there as well.',
      'The root and the natural fifth can be left out. Any spacing counts.',
    ],
    level: 'sevenths-maj-min',
  },

  {
    unit: 'shell',
    title: 'Shell voicings',
    lead: 'Root, third and seventh. The least that still says the chord, and the left hand most players learn first.',
    sections: [
      {
        heading: 'What is left out',
        text: [
          'The fifth. On most chords it is a perfect fifth whatever the quality, so it tells the ear nothing that the root has not said already. Without it the chord is lighter and there is room above it for a melody or for the other hand.',
        ],
      },
      {
        heading: 'Two ways up',
        text: [
          'Root, third, seventh; or root, seventh, third, with the third on top. From one chord to the next, alternating the two keeps the upper notes almost still: over Dm7, G7, Cmaj7 the third of Dm7, F, is already the seventh of G7, and its seventh, C, only has to fall a half step to B.',
        ],
      },
      {
        heading: 'With a bass player',
        text: [
          'Leave the root out as well. The third and the seventh alone are still a shell, and they are the two notes the next unit builds its voicings around.',
        ],
      },
    ],
    examples: [
      { symbol: 'Cmaj7', notes: 'C3 E3 B3', type: 'shell', caption: 'Root, third, seventh.' },
      { symbol: 'Cmaj7', notes: 'C3 B3 E4', type: 'shell', caption: 'Root, seventh, third: the same shell the other way up.' },
      { symbol: 'C7', notes: 'C3 Bb3 E4', type: 'shell', caption: 'C7: only the seventh changed.' },
      { symbol: 'Cm7', notes: 'C3 Eb3 Bb3', type: 'shell', caption: 'Cm7 as root, third, seventh.' },
      { symbol: 'Cmaj7', notes: 'E3 B3', type: 'shell', caption: 'Third and seventh alone, the root left to the bass.' },
    ],
    listens: [
      'Only the root, the third and the seventh, as two notes or three. Add the fifth, or anything else, and it is no longer a shell.',
      'Both guide tones have to be there; the root is optional.',
      'Which of the two is on top, and in which octave, is yours to choose.',
    ],
    level: 'shell-maj-min',
  },

  {
    unit: 'rootless',
    title: 'Rootless voicings',
    lead: 'Four notes, none of them the root. The bass player has the root, or your own left hand does an octave or two below, and the four notes above it say everything else.',
    sections: [
      {
        heading: 'Form A',
        text: [
          'From the bottom: third, fifth, seventh, ninth. On Cmaj7 that is E, G, B, D.',
        ],
      },
      {
        heading: 'Form B',
        text: [
          'The same four notes turned over: seventh, ninth, third, fifth. On Cmaj7 that is B, D, E, G. Form A has the third at the bottom, form B the seventh.',
        ],
      },
      {
        heading: 'On a dominant',
        text: [
          'The fifth gives way to the thirteenth. Form A on G7 reads third, thirteenth, seventh, ninth: B, E, F, A. Form B reads seventh, ninth, third, thirteenth: F, A, B, E.',
        ],
      },
      {
        heading: 'Why two forms',
        text: [
          'So that one of them is always close to where your hand already is. Through a ii–V–I they alternate, A then B then A, and the hand barely moves. The last page of this path shows it note by note.',
        ],
      },
    ],
    examples: [
      { symbol: 'Cmaj7', notes: 'E3 G3 B3 D4', type: 'rootless-A', caption: 'Cmaj7, form A: 3, 5, 7, 9.' },
      { symbol: 'Cmaj7', notes: 'B3 D4 E4 G4', type: 'rootless-B', caption: 'Cmaj7, form B: 7, 9, 3, 5.' },
      { symbol: 'Dm7', notes: 'F3 A3 C4 E4', type: 'rootless-A', caption: 'Dm7, form A: 3, 5, 7, 9.' },
      { symbol: 'G7', notes: 'F3 A3 B3 E4', type: 'rootless-B', caption: 'G7, form B: 7, 9, 3, 13.' },
      { symbol: 'G7', notes: 'B3 E4 F4 A4', type: 'rootless-A', caption: 'G7, form A: 3, 13, 7, 9.' },
      { symbol: 'Cmaj7', notes: 'C2 E3 G3 B3 D4', type: 'rootless-A', caption: 'Form A with the root under it in the left hand. Still form A.' },
    ],
    listens: [
      'Four notes in that order from the bottom: third, fifth, seventh, ninth for A; seventh, ninth, third, fifth for B.',
      'On a dominant, the thirteenth may stand where the fifth would.',
      'A root underneath does not spoil it: with your left hand on the root, form A is still form A.',
      'The same four notes in any other order are not a rootless form.',
    ],
    level: 'rootless-a',
  },

  {
    unit: 'drop-2',
    title: 'Drop 2',
    lead: 'Take a four-note chord in close position and drop the second note from the top down an octave. The chord opens out, and the note on top stays on top.',
    sections: [
      {
        heading: 'Step by step',
        text: [
          'Cmaj7 in close position is C, E, G, B. The second note from the top is G. Put it an octave lower and you have G, C, E, B: a tenth from bottom to top, open in the middle, with B still the highest note.',
        ],
      },
      {
        heading: 'Four of them',
        text: [
          'Each inversion of the close chord gives its own drop 2, so every note of the chord gets its turn on top. That is what the voicing is for: putting the chord under a melody note without crowding it.',
        ],
      },
    ],
    examples: [
      { symbol: 'Cmaj7', notes: 'C4 E4 G4 B4', type: 'close', caption: 'Before: Cmaj7 in close position. G is second from the top.' },
      { symbol: 'Cmaj7', notes: 'G3 C4 E4 B4', type: 'drop-2', caption: 'After: the G went down an octave. B is still on top.' },
      { symbol: 'Cmaj7', notes: 'B3 E4 G4 C5', type: 'drop-2', caption: 'From the next inversion up: now C is on top.' },
      { symbol: 'Cm7', notes: 'G3 C4 Eb4 Bb4', type: 'drop-2', caption: 'Cm7, built the same way.' },
      { symbol: 'C7', notes: 'G3 C4 E4 Bb4', type: 'drop-2', caption: 'C7, built the same way.' },
    ],
    listens: [
      'Four notes. Lift the lowest one an octave: if what you get is the chord in close position, with that note second from the top, it was a drop 2.',
      'Any of the four inversions counts.',
    ],
    level: 'drop2-maj-min',
  },

  {
    unit: 'quartal',
    title: 'Quartal',
    lead: 'Chords stacked in fourths instead of thirds. Open and a little ambiguous: the modern sound, and the one the game is strictest about.',
    sections: [
      {
        heading: 'How it is built',
        text: [
          'Start on a note of the chord and stack perfect fourths on it, five semitones each. D, G, C, F is a D minor seventh: root, eleventh, seventh, third.',
        ],
      },
      {
        heading: 'The "So What" voicing',
        text: [
          'Three fourths with a major third on top: D, G, C, F, A. Five notes, two hands, and the best-known quartal voicing there is.',
        ],
      },
      {
        heading: 'On a major seventh',
        text: [
          'Start on the seventh. B, E, A, D is Cmaj7: seventh, third, thirteenth, ninth.',
        ],
      },
      {
        heading: 'It still has to be the chord',
        text: [
          'A stack of fourths that misses the third or the seventh is a fine sound and the wrong answer. E, A, D, G over Dm7 has neither F nor C in it, and the game hears D minor without what makes it a minor seventh.',
        ],
      },
    ],
    examples: [
      { symbol: 'Dm7', notes: 'D3 G3 C4 F4', type: 'quartal', caption: 'Dm7 in fourths: 1, 11, 7, 3.' },
      { symbol: 'Dm7', notes: 'D3 G3 C4 F4 A4', type: 'quartal', caption: 'The "So What" voicing: three fourths, then a major third on top.' },
      { symbol: 'Cmaj7', notes: 'B3 E4 A4 D5', type: 'quartal', caption: 'Cmaj7 in fourths, from the seventh: 7, 3, 13, 9.' },
      { symbol: 'G7', notes: 'F3 B3 E4 A4', type: 'quartal', caption: 'G7: the tritone between seventh and third is the one augmented fourth: 7, 3, 13, 9.' },
    ],
    listens: [
      'Three notes or more, each a fourth above the last.',
      'One of the fourths may be augmented. A single major third is allowed, on top, from four notes up.',
      'The third and the seventh of the chord still have to be in it.',
    ],
    level: 'quartal-minor',
  },

  {
    unit: 'ii-V-I',
    title: 'ii–V–I',
    lead: 'Three chords, each a fourth above the last: the minor seventh on the second degree, the dominant on the fifth, the major seventh on the first. In C: Dm7, G7, Cmaj7. It is the sentence the whole language is built on.',
    sections: [
      {
        heading: 'What moves, and how little',
        text: [
          'Follow the thirds and the sevenths. The seventh of Dm7, C, falls a half step to B, the third of G7. The seventh of G7, F, falls a half step to E, the third of Cmaj7.',
          'The other guide tone stays where it is each time. The third of Dm7, F, is already the seventh of G7; the third of G7, B, is already the seventh of Cmaj7.',
        ],
      },
      {
        heading: 'In rootless voicings',
        text: [
          'Form A on the ii, form B on the V, form A on the I. Into the V a single note moves, C down to B. Into the I three notes move by step and one stays.',
        ],
      },
      {
        heading: 'What the third star measures',
        text: [
          'On a timed run the game adds up how far each voice travelled from one chord to the next. Led as below, a ii–V–I moves 0.75 of a semitone a voice at each change. The third star asks for 1.25 or less.',
        ],
      },
    ],
    examples: [
      { symbol: 'Dm7', notes: 'D3 F3 C4', type: 'shell', caption: 'The guide tones first, as a shell: F and C above the root.' },
      { symbol: 'G7', notes: 'G2 F3 B3', type: 'shell', caption: 'F stayed. C fell a half step to B.' },
      { symbol: 'Cmaj7', notes: 'C3 E3 B3', type: 'shell', caption: 'B stayed. F fell a half step to E.' },
    ],
    chain: [
      { symbol: 'Dm7', notes: 'F3 A3 C4 E4', type: 'rootless-A', caption: 'Dm7, form A.' },
      { symbol: 'G7', notes: 'F3 A3 B3 E4', type: 'rootless-B', caption: 'G7, form B: one note moved.' },
      { symbol: 'Cmaj7', notes: 'E3 G3 B3 D4', type: 'rootless-A', caption: 'Cmaj7, form A: three notes moved by step.' },
    ],
    listens: [
      'Any voicing of each chord counts for the first two stars.',
      'The third star needs the timed run, and the voices moving 1.25 semitones or less at each change, on average.',
    ],
    level: 'ii-V-I-flat-keys',
  },
];

/**
 * The lesson for a unit of the path, or null.
 *
 * @param {string} unit
 * @returns {Lesson | null}
 */
export function lessonFor(unit) {
  return LESSONS.find(lesson => lesson.unit === unit) ?? null;
}

// Which page explains a shape a level can demand. Both rootless forms are one page.
const TEXTURE_LESSONS = { shell: 'shell', 'rootless-A': 'rootless', 'rootless-B': 'rootless', 'drop-2': 'drop-2', quartal: 'quartal' };

/**
 * The lesson that explains the shape a level demands, or null when it demands none (or one no
 * page is written for).
 *
 * @param {string | string[] | null | undefined} texture
 * @returns {Lesson | null}
 */
export function lessonForTexture(texture) {
  const first = [].concat(texture ?? [])[0];
  return (first && lessonFor(TEXTURE_LESSONS[first] ?? '')) || null;
}

/**
 * An example's notes as MIDI numbers, bottom to top.
 *
 * @param {{ notes: string }} example
 * @returns {number[]}
 */
export function exampleNotes(example) {
  return example.notes.split(' ').map(nameToMidi);
}
