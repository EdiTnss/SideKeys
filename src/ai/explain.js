// "Explain & suggest" on a drill chord: Claude proposes two alternative voicings with a reason,
// the analyzer checks each one before it reaches the screen or the Genos. A suggestion is kept
// only when it has no warnings (missing, wrong, avoid, muddy) and the analyzer detects exactly
// the voicing type Claude promised in `label`: that is Phase 3a's first DoD, as code.

import { classifyPc } from '../theory/chords.js';
import { spellDegree, midiToName } from '../theory/notes.js';
import { analyzeVoicing } from '../theory/analyzer.js';
import { DEFAULT_REGISTER } from '../theory/voicings.js';
import { PROMPTS } from './prompts.js';

/** What the model gets to see: the chord as degrees with note names, the register, the played voicing. */
export function buildExplainInput(chord, analysis = null, { register = DEFAULT_REGISTER } = {}) {
  const chordTones = {};
  const tensions = {};
  const avoid = {};
  for (let pc = 0; pc < 12; pc++) {
    const { role, degree } = classifyPc(chord, pc);
    if (role === 'wrong') continue;
    const name = spellDegree(chord.root, degree);
    if (role === 'chordTone') chordTones[degree] = name;
    else if (role === 'avoid') avoid[degree] = name;
    else tensions[degree] = name;
  }
  return {
    chord: {
      symbol: chord.symbol,
      required: chord.required.map(pc => chord.degrees[pc]),
      chordTones,
      tensions,
      avoid,
    },
    register: { low: midiToName(register[0]), high: midiToName(register[1]), midi: [...register] },
    played: analysis
      ? {
        midi: [...analysis.notes],
        names: analysis.notes.map(midi => midiToName(midi)),
        type: analysis.voicing.type,
        bass: analysis.voicing.bass,
        remarks: analysis.messages.map(message => message.text),
      }
      : null,
  };
}

/**
 * validateSuggestions(data, chord, { register, played }) →
 *   { accepted: [{ notes, label, why, analysis }], rejected: [{ notes, label, why, reason }] }
 * Never throws on a malformed answer: a broken suggestion is rejected with a reason.
 */
export function validateSuggestions(data, chord, { register = DEFAULT_REGISTER, played = null } = {}) {
  const accepted = [];
  const rejected = [];
  const list = Array.isArray(data?.voicings) ? data.voicings : [];
  const seen = new Set();
  const playedKey = played ? [...played].sort((a, b) => a - b).join(',') : null;

  for (const raw of list) {
    const label = typeof raw?.label === 'string' ? raw.label : '';
    const why = typeof raw?.why === 'string' ? raw.why : '';
    const notes = Array.isArray(raw?.notes) ? [...new Set(raw.notes.map(Number))].sort((a, b) => a - b) : [];
    const reason = check(notes, label, chord, register, seen, playedKey);
    if (reason) {
      rejected.push({ notes, label, why, reason });
      continue;
    }
    seen.add(notes.join(','));
    accepted.push({ notes, label, why, analysis: analyzeVoicing(notes, chord) });
  }
  return { accepted, rejected };
}

function check(notes, label, chord, register, seen, playedKey) {
  if (notes.length < 2 || notes.some(n => !Number.isInteger(n))) return 'needs at least two MIDI notes';
  const [low, high] = register;
  if (notes.some(n => n < low || n > high)) return `outside the register ${midiToName(low)}–${midiToName(high)}`;
  const key = notes.join(',');
  if (key === playedKey) return 'the same voicing as what was played';
  if (seen.has(key)) return 'duplicate of an earlier suggestion';
  const analysis = analyzeVoicing(notes, chord);
  const warnings = analysis.messages.filter(message => message.level === 'warning').map(message => message.text);
  if (warnings.length > 0) return warnings.join('; ');
  if (analysis.voicing.type !== label) return `promised ${label || 'no label'}, the analyzer hears ${analysis.voicing.type}`;
  return null;
}

/**
 * explainVoicing(client, chord, analysis, { register, effort, maxTokens }) →
 *   { suggestions, rejected, model, usage, promptVersion }
 * Rejects with the client's AiError when the call itself fails.
 */
export async function explainVoicing(client, chord, analysis = null, { register = DEFAULT_REGISTER, effort = 'low', maxTokens = 4096 } = {}) {
  const prompt = PROMPTS.explain;
  const input = buildExplainInput(chord, analysis, { register });
  const { data, model, usage } = await client.call('explain', {
    system: prompt.system,
    messages: prompt.build(input),
    schema: prompt.schema,
    maxTokens,
    effort,
  });
  const { accepted, rejected } = validateSuggestions(data, chord, { register, played: analysis?.notes ?? null });
  return { suggestions: accepted, rejected, model, usage, promptVersion: prompt.version };
}
