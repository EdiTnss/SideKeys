// English, the default. Every key here has a twin in ro.js with the same {params};
// test/i18n.test.js fails when one is missing.

export default {
  'header.connect': 'Connect a MIDI keyboard',

  // The analyzer's messages (src/i18n/messages.js). In English they must read exactly as the
  // analyzer's own `text`; test/messages.test.js compares them.
  'msg.missing': 'Missing {note} ({degree})',
  'msg.bass': 'Bass should be {wanted}, not {played}',
  'msg.bass.none': 'Bass should be {wanted}, not nothing',
  'msg.rootless': 'Rootless voicing (no {root})',
  'msg.wrong': 'Wrong note: {note} is not in {chord}',
  'msg.avoid': 'Avoid note: {note} ({degree})',
  'msg.caution': 'Caution: {note} ({degree})',
  'msg.muddy': 'Muddy: {lower}–{upper} ({interval}) is too low',
  'msg.doubling': 'Doubled: {note}',

  'interval.1': 'm2',
  'interval.2': 'M2',
  'interval.3': 'm3',
  'interval.4': 'M3',
  'interval.5': 'P4',
  'interval.6': 'A4',
  'interval.7': 'P5',
  'interval.other': '{semitones} semitones',

  'voicing.shell': 'Shell',
  'voicing.rootless-A': 'Rootless A',
  'voicing.rootless-B': 'Rootless B',
  'voicing.drop-2': 'Drop 2',
  'voicing.drop-3': 'Drop 3',
  'voicing.drop-2-4': 'Drop 2&4',
  'voicing.quartal': 'Quartal',
  'voicing.upper-structure': 'Upper structure triad',
  'voicing.close': 'Close position',
  'voicing.spread': 'Spread',
  'voicing.detail': '{name} ({detail})',
  'voicing.bass.root': '{name}, root in the bass',
  'voicing.bass.5': '{name}, 5th in the bass',
  // What a voicing with no name of its own is called when it is not the shape asked for.
  'voicing.other': 'another shape',

  'inversion.root': 'root position',
  'inversion.1st': '1st inversion',
  'inversion.2nd': '2nd inversion',
  'inversion.3rd': '3rd inversion',
};
