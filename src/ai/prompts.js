// Every prompt sent to Claude lives here, versioned, with the JSON schema its answer must match.
// Any change to a prompt bumps its `version` (the evaluation set, Phase 5, keys results by it).
// The Worker never sees these as anything but request data: prompts are part of the repo.
//
// Schemas follow the structured-outputs subset: every object has additionalProperties: false
// with all properties required; no min/max constraints (those are checked in code).

import { midiToName } from '../theory/notes.js';
import { DENSITY_TARGETS, MAX_RUN } from '../theory/scoring.js';
import { TECHNIQUES } from '../theory/candidates.js';

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

The user message is a JSON object with the key, the requested style and intensity, the density target (share of slots to change), the phrases (bar ranges), the part when the tune is long (see the rules), the plan when there is one (per phrase: a strategy and the techniques to prefer), and one entry per slot: bar, slot, beat, the original chord with its roman numeral, function and cadence flag, the melody's structural notes with their relation to the original chord, and the candidates with id, chords, technique, optional spans (how many slots the candidate covers) and optional avoidWarnings (how many melody notes fall on an avoid note).

Rules:
- Return exactly one entry per slot, in the same order, with candidateId copied verbatim from that slot's candidates: the whole id, including the technique in the middle, not a shortened form. The id ending in "-orig" keeps the original chord.
- Aim for the density target and never change more than 4 slots in a row unless intensity is heavy.
- A long tune is reharmonized in parts, one after the other. When there is a part (index, of, bars, tuneBars), the slots, phrases and plan are only that part's: the bars before it are already chosen and the bars after it come next. previousChords are the last chords already chosen before the part: lead the bass on from the last one. changedInARowBefore is how many changed slots in a row end the part before: they count toward the run limit. The density target applies to this part.
- When there is a plan, follow it phrase by phrase: its strategy decides where the changes go, and its techniques come first where they fit. The density target and the run limit still apply.
- Prefer the techniques the style is named after, vary them, and make the bass line move by half steps, whole steps and fifths. Keep the first chord of each phrase and the final resolution recognizable.
- Prefer candidates without avoidWarnings.
- A candidate with spans 2 also covers the next slot: when you choose it, give the next slot its "-orig" id (it is ignored).
- why is one short sentence for a changed slot, naming the technique and the melody note it works with; an empty string for an unchanged slot.`;

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    phrases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bars: { type: 'array', items: { type: 'integer' }, description: 'the first and last bar of the phrase, copied from the input' },
          strategy: { type: 'string', description: 'one or two sentences' },
          techniques: {
            type: 'array',
            items: { type: 'string', enum: TECHNIQUES.filter(technique => technique !== 'original') },
            description: 'up to three, only from this phrase\'s list, in order of preference',
          },
        },
        required: ['bars', 'strategy', 'techniques'],
        additionalProperties: false,
      },
    },
  },
  required: ['phrases'],
  additionalProperties: false,
};

const PLAN_SYSTEM = `You are an arranger planning the reharmonization of a tune for an advanced jazz pianist, phrase by phrase, before any chord is chosen. The melody is fixed. A colleague will then pick the chords, slot by slot, from a menu the app computed, following your plan.

The user message is a JSON object with the key, the requested style and intensity, the density target (share of slots to change over the whole tune), and the phrases. Each phrase has its bars (first and last), its slots (bar, slot, beat, the original chord with its roman numeral, function and cadence flag, and the melody's structural notes with their relation to the original chord) and the techniques the menu can actually offer in that phrase.

Reply with one entry per phrase, in the same order:
- bars: the phrase's first and last bar, copied from the input.
- strategy: one or two sentences on what the phrase should do harmonically and why: where the tension goes, where the harmony stays still, how the cadence is approached, and how the phrase relates to the others (the same idea on a repeated section, or a deliberate variation).
- techniques: up to three techniques for this phrase, only from that phrase's list, in order of preference. An empty list means keep the phrase close to the original.

Think about the whole form: the density target applies to the whole tune, so some phrases can stay plain while others carry the color. Prefer the techniques the style is named after, keep the first chord of each phrase and the final resolution recognizable, and aim for a bass line that moves by half steps, whole steps and fifths.`;

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', description: 'two or three sentences on the proposal as a whole' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bar: { type: 'integer' },
          slot: { type: 'integer' },
          candidateId: { type: 'string', description: 'an id taken verbatim from that slot\'s candidates' },
          why: { type: 'string', description: 'one short sentence' },
        },
        required: ['bar', 'slot', 'candidateId', 'why'],
        additionalProperties: false,
      },
      description: 'at most 4, only the slots you change',
    },
  },
  required: ['verdict', 'changes'],
  additionalProperties: false,
};

const REVIEW_SYSTEM = `You are a demanding arranger reviewing a colleague's reharmonization of a tune for an advanced jazz pianist. The melody is fixed, and every candidate in the menu already fits it, so judge taste, line and coherence, not correctness.

The user message is a JSON object with the key, the requested style and intensity, the density target, the part when the tune is long (see the rules), the plan when there is one (per phrase: a strategy and the techniques to prefer), the original grid and the proposed grid, the scores the app computed for the proposal, and one entry per slot: bar, slot, beat, the original chord with its roman numeral, function and cadence flag, the melody's structural notes with their relation to the original chord, the chosen candidate (id, chords, technique and your colleague's reason; the id ending in "-orig" is the original chord), or coveredBy when a two-slot candidate from the slot before already covers it, and the full menu of candidates with the same fields as the colleague saw.

The scores: density is the share of changed slots and must stay inside densityTarget; maxRun is the longest run of changed slots in a row and must stay at or under maxRunLimit (null means no limit); bassSmoothness runs from 0 to 1 and is higher when the bass moves by half steps, whole steps, fourths and fifths; techniqueMix counts the distinct techniques used, and one technique everywhere is monotonous; avoidWarnings counts melody notes that fall on an avoid note.

Reply with a verdict and at most 4 changes:
- verdict: two or three sentences on the proposal as a whole: what works, what does not, and what you changed.
- changes: only the slots you change, each with candidateId copied verbatim from that slot's candidates: the whole id, not a shortened form. The id ending in "-orig" puts the original chord back. An empty list is the right answer when the proposal is already good.
- Change a slot only when it clearly improves the arrangement: a smoother bass line, a tension placed where the melody supports it, a wider mix of techniques, a clearer cadence, or a closer fit to the plan.
- Never take the density out of its target, make a run longer than maxRunLimit, or add avoid notes when the proposal has none of those problems: the app undoes the whole review if you do.
- Do not change a slot marked coveredBy. A candidate with spans 2 also covers the next slot.
- A long tune is reviewed in parts, each by its own reviewer at the same time. When there is a part (index, of, bars, tuneBars), the slots, the menu and the plan are only that part's and you change only those slots; the grids show the whole tune and the scores are the whole tune's.
- why is one short sentence per change, naming the technique and the melody note or the bass motion it serves.`;

export const PROMPTS = {
  explain: {
    version: 1,
    system: EXPLAIN_SYSTEM,
    schema: EXPLAIN_SCHEMA,
    /** input: the object from buildExplainInput (src/ai/explain.js) */
    build: input => [{ role: 'user', content: JSON.stringify(input) }],
  },
  plan: {
    version: 1,
    system: PLAN_SYSTEM,
    schema: PLAN_SCHEMA,
    /** phrases: [{ bars: [first, last], techniques }], the techniques each phrase's menu offers */
    build: ({ piece, candidates, style, intensity, phrases }) => [{ role: 'user', content: JSON.stringify(planInput(piece, candidates, style, intensity, phrases)) }],
  },
  execute: {
    version: 4,          // 2: spell out that the whole candidate id must be copied; 3: follow the plan; 4: parts of a long tune
    system: EXECUTE_SYSTEM,
    schema: EXECUTE_SCHEMA,
    /**
     * piece: analyzed piece; candidates: generateCandidates() result, or one part's menu; plan: the
     * checked plan, or null; part: null for a tune in one part, else { index, of, bars, tuneBars,
     * phrases, previousChords, changedInARowBefore }
     */
    build: ({ piece, candidates, style, intensity, plan = null, part = null }) => [{ role: 'user', content: JSON.stringify(executeInput(piece, candidates, style, intensity, plan, part)) }],
  },
  review: {
    version: 2,          // 2: parts of a long tune
    system: REVIEW_SYSTEM,
    schema: REVIEW_SCHEMA,
    /** draft: { grid, originalGrid, slots (resolved, with why), scores }; part: null, or { index, of, bars, tuneBars } */
    build: ({ piece, candidates, style, intensity, plan = null, draft, part = null }) => [{ role: 'user', content: JSON.stringify(reviewInput(piece, candidates, style, intensity, plan, draft, part)) }],
  },
};

export const PROMPT_VERSIONS = Object.fromEntries(Object.entries(PROMPTS).map(([name, prompt]) => [name, prompt.version]));

function header(piece, style, intensity) {
  const { key } = piece.analysis;
  return {
    key: `${key.tonic} ${key.mode}`,
    timeSignature: `${piece.timeSignature[0]}/${piece.timeSignature[1]}`,
    style,
    intensity,
    densityTarget: { ...(DENSITY_TARGETS[intensity] ?? DENSITY_TARGETS.medium) },
  };
}

// What a slot is, before any choice: the original chord, its analysis and the melody over it.
function slotSummary(piece, slot) {
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
  };
}

function menuOf(slot) {
  return slot.candidates.map(candidate => ({
    id: candidate.id,
    chords: candidate.chords.map(c => c.symbol).join(' '),
    technique: candidate.technique,
    ...(candidate.spans > 1 ? { spans: candidate.spans } : {}),
    ...(candidate.warnings.length > 0 ? { avoidWarnings: candidate.warnings.length } : {}),
  }));
}

function planInput(piece, candidates, style, intensity, phrases) {
  return {
    ...header(piece, style, intensity),
    phrases: phrases.map(phrase => ({
      bars: phrase.bars,
      techniques: phrase.techniques,
      slots: candidates.slots
        .filter(slot => slot.bar >= phrase.bars[0] && slot.bar <= phrase.bars[1])
        .map(slot => slotSummary(piece, slot)),
    })),
  };
}

function executeInput(piece, candidates, style, intensity, plan, part) {
  const { phrases = piece.analysis.phrases, ...where } = part ?? {};
  return {
    ...header(piece, style, intensity),
    phrases,
    ...(part ? { part: where } : {}),
    ...(plan ? { plan } : {}),
    slots: candidates.slots.map(slot => ({ ...slotSummary(piece, slot), candidates: menuOf(slot) })),
  };
}

const round2 = value => Math.round(value * 100) / 100;

function reviewInput(piece, candidates, style, intensity, plan, draft, part) {
  const drafted = new Map(draft.slots.map(slot => [`${slot.bar}:${slot.slot}`, slot]));
  const { scores } = draft;
  return {
    ...header(piece, style, intensity),
    ...(part ? { part } : {}),
    ...(plan ? { plan } : {}),
    originalGrid: draft.originalGrid,
    proposedGrid: draft.grid,
    scores: {
      density: round2(scores.density),
      densityOk: scores.densityOk,
      maxRun: scores.maxRun,
      maxRunLimit: intensity === 'heavy' ? null : MAX_RUN,
      maxRunOk: scores.maxRunOk,
      bassSmoothness: round2(scores.bassSmoothness),
      techniqueMix: scores.techniqueMix,
      techniques: { ...scores.techniques },
      avoidWarnings: scores.warnings,
    },
    slots: candidates.slots.map(slot => {
      const current = drafted.get(`${slot.bar}:${slot.slot}`);
      const placed = current?.coveredBy ? { chosen: null, coveredBy: current.coveredBy } : { chosen: chosenOf(slot, current) };
      return { ...slotSummary(piece, slot), ...placed, candidates: menuOf(slot) };
    }),
  };
}

// What the draft has on a slot, in the menu's own terms: the chosen candidate, or the original.
function chosenOf(slot, current) {
  const candidate = current?.candidate ?? slot.candidates.find(option => option.technique === 'original') ?? null;
  const why = current?.why ?? '';
  if (!candidate) return { id: null, chords: slot.original, technique: 'original', why };
  return { id: candidate.id, chords: candidate.chords.map(c => c.symbol).join(' '), technique: candidate.technique, why };
}
