// Every prompt sent to Claude lives here, versioned, with the JSON schema its answer must match.
// Any change to a prompt bumps its `version` (the evaluation set, Phase 5, keys results by it).
// The Worker never sees these as anything but request data: prompts are part of the repo.
//
// Schemas follow the structured-outputs subset: every object has additionalProperties: false
// with all properties required; no min/max constraints (those are checked in code).

import { midiToName } from '../theory/notes.js';
import { DENSITY_TARGETS } from '../theory/scoring.js';

/** The analyzer's voicing types, exactly as analyzeVoicing reports them. */
export const VOICING_TYPES = ['shell', 'rootless-A', 'rootless-B', 'drop-2', 'drop-3', 'drop-2-4', 'quartal', 'upper-structure', 'close', 'spread'];

const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    voicings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          notes: { type: 'array', items: { type: 'integer' }, description: 'MIDI note numbers, ascending, 60 = C4' },
          label: { type: 'string', enum: VOICING_TYPES, description: 'the voicing type as the analyzer will classify it' },
          why: { type: 'string', description: 'one or two sentences for an advanced jazz pianist' },
        },
        required: ['notes', 'label', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['voicings'],
  additionalProperties: false,
};

const EXPLAIN_SYSTEM = `You are a jazz piano teacher working with an advanced pianist who is practicing left-hand voicings. The user message is a JSON object with:
- chord: the symbol, its required notes (as degrees), and every accepted pitch class as degree → note name, split into chordTones, tensions and avoid. Anything not listed is a wrong note on this chord.
- register: the range allowed for the voicing (low and high, with MIDI numbers).
- played: what the pianist just played on this chord (notes, the analyzer's voicing type and its remarks), or null when nothing was played yet.

Reply with exactly two alternative voicings of the same chord, as JSON matching the schema.

Rules:
- notes are MIDI numbers (60 = C4), ascending, all between register.midi[0] and register.midi[1] inclusive, 2 to 6 notes.
- Every voicing contains all required degrees and uses only the listed chordTones and tensions. Never an avoid note, never an unlisted note. The root is optional (rootless voicings are welcome).
- The two voicings differ from each other and from what was played: another type, another inversion, or other tensions.
- label is the voicing type the app's analyzer will detect. Definitions: shell = only the required guide tones (3 and 7 or their equivalents), with or without the root, 2 or 3 notes; rootless-A = 4 notes, bottom to top 3-5-7-9 (on dominants the 5 may be 13 or b13 and the 9 may be b9 or #9); rootless-B = 4 notes, bottom to top 7-9-3-5 (same substitutions); drop-2 = a close-position four-note voicing with its second voice from the top dropped an octave, so the dropped voice is the lowest note; drop-3 = the third voice from the top dropped; drop-2-4 = the second and fourth voices dropped; quartal = at least 3 notes stacked in perfect or augmented fourths (one major third is tolerated from 4 notes up); upper-structure = on a dominant, the 3 and 7 below a major or minor triad whose root is not the chord root; close = all notes within one octave and none of the above; spread = anything wider and none of the above. Do not label a voicing drop-2 or drop-3 unless raising its lowest note an octave gives a close position.
- Keep the low register clean: below C3 (MIDI 48) no adjacent minor second, major second or minor third; below G2 (43) no adjacent major third either.
- why is one or two sentences for an advanced player: name the tensions by degree, say what the voicing is good for (voice leading, color, register), no basic theory.`;

const EXECUTE_SCHEMA = {
  type: 'object',
  properties: {
    bars: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bar: { type: 'integer' },
          slot: { type: 'integer' },
          candidateId: { type: 'string', description: 'an id taken verbatim from that slot\'s candidates' },
          why: { type: 'string', description: 'one short sentence for a changed slot, empty for an unchanged one' },
        },
        required: ['bar', 'slot', 'candidateId', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['bars'],
  additionalProperties: false,
};

const EXECUTE_SYSTEM = `You are an arranger reharmonizing a tune for an advanced jazz pianist. The melody is fixed. For every slot you choose one candidate chord from the menu the app computed; every candidate is already checked against the melody, so choose for taste, line and coherence, not for correctness.

The user message is a JSON object with the key, the requested style and intensity, the density target (share of slots to change), the phrases (bar ranges), and one entry per slot: bar, slot, beat, the original chord with its roman numeral, function and cadence flag, the melody's structural notes with their relation to the original chord, and the candidates with id, chords, technique, optional spans (how many slots the candidate covers) and optional avoidWarnings (how many melody notes fall on an avoid note).

Rules:
- Return exactly one entry per slot, in the same order, with candidateId copied verbatim from that slot's candidates: the whole id, including the technique in the middle, not a shortened form. The id ending in "-orig" keeps the original chord.
- Aim for the density target and never change more than 4 slots in a row unless intensity is heavy.
- Prefer the techniques the style is named after, vary them, and make the bass line move by half steps, whole steps and fifths. Keep the first chord of each phrase and the final resolution recognizable.
- Prefer candidates without avoidWarnings.
- A candidate with spans 2 also covers the next slot: when you choose it, give the next slot its "-orig" id (it is ignored).
- why is one short sentence for a changed slot, naming the technique and the melody note it works with; an empty string for an unchanged slot.`;

export const PROMPTS = {
  explain: {
    version: 1,
    system: EXPLAIN_SYSTEM,
    schema: EXPLAIN_SCHEMA,
    /** input: the object from buildExplainInput (src/ai/explain.js) */
    build: input => [{ role: 'user', content: JSON.stringify(input) }],
  },
  execute: {
    version: 2,          // 2: spell out that the whole candidate id must be copied
    system: EXECUTE_SYSTEM,
    schema: EXECUTE_SCHEMA,
    /** piece: analyzed piece; candidates: generateCandidates() result */
    build: ({ piece, candidates, style, intensity }) => [{ role: 'user', content: JSON.stringify(executeInput(piece, candidates, style, intensity)) }],
  },
};

export const PROMPT_VERSIONS = Object.fromEntries(Object.entries(PROMPTS).map(([name, prompt]) => [name, prompt.version]));

function executeInput(piece, candidates, style, intensity) {
  const { key, phrases } = piece.analysis;
  return {
    key: `${key.tonic} ${key.mode}`,
    timeSignature: `${piece.timeSignature[0]}/${piece.timeSignature[1]}`,
    style,
    intensity,
    densityTarget: { ...(DENSITY_TARGETS[intensity] ?? DENSITY_TARGETS.medium) },
    phrases,
    slots: candidates.slots.map(slot => {
      const chord = piece.bars[slot.bar - 1].chords[slot.slot - 1];
      const { roman, function: harmonicFunction, cadence, melody } = chord.analysis;
      return {
        bar: slot.bar,
        slot: slot.slot,
        beat: slot.beat,
        original: slot.original,
        roman,
        function: harmonicFunction,
        cadence,
        melody: melody.structural.map(note => `${midiToName(note.midi)} (${note.relation})`),
        candidates: slot.candidates.map(candidate => ({
          id: candidate.id,
          chords: candidate.chords.map(c => c.symbol).join(' '),
          technique: candidate.technique,
          ...(candidate.spans > 1 ? { spans: candidate.spans } : {}),
          ...(candidate.warnings.length > 0 ? { avoidWarnings: candidate.warnings.length } : {}),
        })),
      };
    }),
  };
}
