// Romanian. The same keys as en.js, with the same {params}. The jazz vocabulary, note letters,
// the star names and the share text stay in English here too (Edi, 2026-10-27).

export default {
  'header.connect': 'Conectează o clapă MIDI',

  // The analyzer's messages. "Avoid note" and "rootless" are jazz words and stay English;
  // "muddy" is said as what it means (Edi, 2026-10-27).
  'msg.missing': 'Lipsește {note} ({degree})',
  'msg.bass': 'Basul trebuie să fie {wanted}, nu {played}',
  'msg.bass.none': 'Basul trebuie să fie {wanted}, dar nu s-a cântat nimic',
  'msg.rootless': 'Voicing rootless (fără {root})',
  'msg.wrong': 'Notă greșită: {note} nu face parte din {chord}',
  'msg.avoid': 'Avoid note: {note} ({degree})',
  'msg.caution': 'Atenție: {note} ({degree})',
  'msg.muddy': 'Prea jos: {lower}–{upper} ({interval})',
  'msg.doubling': 'Notă dublată: {note}',

  'interval.1': 'secundă mică',
  'interval.2': 'secundă mare',
  'interval.3': 'terță mică',
  'interval.4': 'terță mare',
  'interval.5': 'cvartă perfectă',
  'interval.6': 'cvartă mărită',
  'interval.7': 'cvintă perfectă',
  'interval.other': '{semitones} semitonuri',

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
  'voicing.bass.root': '{name}, fundamentala în bas',
  'voicing.bass.5': '{name}, cvinta în bas',
  'voicing.other': 'altă formă',

  'inversion.root': 'root position',
  'inversion.1st': '1st inversion',
  'inversion.2nd': '2nd inversion',
  'inversion.3rd': '3rd inversion',
};
