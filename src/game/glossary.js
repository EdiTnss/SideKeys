// The glossary: the jazz words the game uses, explained in Romanian. Data, no DOM.
//
// The text is Edi's, approved word for word on 2026-10-27. One sentence differs, on his say the
// same day: the Smooth threshold, which the approved text gave as 1.25 everywhere while the engine
// asks 1.25 only on a ii–V–I and 1.5 elsewhere (theory/stars.js).
//
// test/glossary.test.js plays every example to the analyzer and reads every number from the
// engine, so a page here cannot say one thing while a verdict says another. `match` lists the
// words that stand for the term in the game's Romanian text, lower case: src/i18n/terms.js finds
// them there and the shell underlines them. The words themselves stay English, like the jargon.

/**
 * @typedef {{
 *   symbol: string,
 *   notes: string,                 // bottom to top, as on the theory pages
 *   caption: string,
 *   type?: string,                 // what the analyzer must call it
 *   detail?: string,               // the triad of an upper structure
 *   inversion?: string,            // what inversionOf must say
 *   says?: string,                 // a verdict the game must give, in Romanian
 *   muddy?: number,                // how many intervals must be flagged as too low
 * }} GlossaryExample
 *
 * @typedef {{
 *   id: string,
 *   group: string,
 *   name: string,
 *   short: string,
 *   long?: string,
 *   examples?: GlossaryExample[],
 *   match?: string[],
 * }} GlossaryTerm
 */

export const GLOSSARY_GROUPS = [
  { id: 'shapes', name: 'Forme de voicing' },
  { id: 'chords', name: 'Acorduri și note' },
  { id: 'motion', name: 'Mișcare și progresii' },
  { id: 'stars', name: 'Stelele' },
];

/** @type {GlossaryTerm[]} */
export const GLOSSARY = [
  {
    id: 'voicing',
    group: 'shapes',
    name: 'Voicing',
    short: 'Felul în care așezi notele unui acord pe clapă.',
    long: 'Același acord se poate cânta în multe feluri: ce note păstrezi, în ce ordine și cât de departe le pui una de alta. Fiecare așezare e un voicing. Jocul îți spune ce voicing ai cântat, nu doar dacă acordul e corect.',
    match: ['voicing', 'voicings', 'voicinguri', 'voicing-uri', 'voicing-urile'],
  },
  {
    id: 'close',
    group: 'shapes',
    name: 'Close position',
    short: 'Toate notele în aceeași octavă.',
    long: 'Notele stau cât mai apropiat posibil, în interval de o octavă. E forma de la care pornesc aproape toate celelalte: drop 2, drop 3 și drop 2&4 se obțin din ea.',
    examples: [{ symbol: 'Cmaj7', notes: 'C4 E4 G4 B4', type: 'close', caption: 'Cmaj7 = C4 E4 G4 B4' }],
    match: ['close position'],
  },
  {
    id: 'spread',
    group: 'shapes',
    name: 'Spread',
    short: 'Notele sunt întinse pe mai mult de o octavă.',
    long: 'Orice voicing mai larg de o octavă care nu are un nume anume (nu e drop, shell sau quartal). Jocul îl numește doar ca să-ți spună cum arată.',
    examples: [{ symbol: 'C', notes: 'C3 G3 E4', type: 'spread', caption: 'C = C3 G3 E4' }],
    match: ['spread'],
  },
  {
    id: 'shell',
    group: 'shapes',
    name: 'Shell',
    short: 'Doar terța și septima, eventual cu fundamentala.',
    long: 'Scheletul acordului: cele două note care îi spun calitatea (vezi „Guide tones”), plus fundamentala dacă vrei. Are două sau trei note. E voicing-ul clasic de mâna stângă când cânți melodia cu dreapta.',
    examples: [{ symbol: 'Cmaj7', notes: 'C3 E3 B3', type: 'shell', caption: 'Cmaj7 = C3 E3 B3' }],
    match: ['shell'],
  },
  {
    id: 'guide-tones',
    group: 'shapes',
    name: 'Guide tones',
    short: 'Notele care decid calitatea acordului, de obicei terța și septima.',
    long: 'Terța spune dacă acordul e major sau minor, iar septima spune ce fel de septacord e. Pe un acord cu sextă, sexta ține locul septimei. Pe un sus4, cvarta ține locul terței. Shell-urile și rootless-urile sunt construite în jurul lor.',
    match: ['guide tones', 'guide tone'],
  },
  {
    id: 'rootless-a',
    group: 'shapes',
    name: 'Rootless A',
    short: 'Patru note fără fundamentală, de jos în sus 3–5–7–9.',
    long: 'Fundamentala o lasă basistului sau mâinii stângi. Pe o dominantă, în locul cvintei poate sta 13 (sau b13), iar în locul lui 9 poate sta b9 sau #9.',
    examples: [
      { symbol: 'Dm7', notes: 'F3 A3 C4 E4', type: 'rootless-A', caption: 'Dm7 = F3 A3 C4 E4' },
      { symbol: 'G7', notes: 'B3 E4 F4 A4', type: 'rootless-A', caption: 'G7 = B3 E4 F4 A4 (3–13–7–9)' },
    ],
    match: ['rootless a'],
  },
  {
    id: 'rootless-b',
    group: 'shapes',
    name: 'Rootless B',
    short: 'Patru note fără fundamentală, de jos în sus 7–9–3–5.',
    long: 'Aceleași note ca la forma A, dar pornind de la septimă. Într-un ii–V–I, A și B se alternează: dacă pe ii cânți A, pe V ajungi natural în B.',
    examples: [
      { symbol: 'Dm7', notes: 'C4 E4 F4 A4', type: 'rootless-B', caption: 'Dm7 = C4 E4 F4 A4' },
      { symbol: 'G7', notes: 'F3 A3 B3 E4', type: 'rootless-B', caption: 'G7 = F3 A3 B3 E4' },
    ],
    match: ['rootless b'],
  },
  {
    id: 'drop-2',
    group: 'shapes',
    name: 'Drop 2',
    short: 'Close position cu a doua notă de sus coborâtă o octavă.',
    long: 'Pornești de la patru note în close position și o cobori pe a doua de sus cu o octavă. Rezultatul e mai deschis, sună bine pe toată clapa și se împarte comod între mâini.',
    examples: [
      { symbol: 'Cmaj7', notes: 'C4 E4 G4 B4', type: 'close', caption: 'Cmaj7 C4 E4 G4 B4' },
      { symbol: 'Cmaj7', notes: 'G3 C4 E4 B4', type: 'drop-2', caption: '→ G3 C4 E4 B4' },
    ],
    match: ['drop 2'],
  },
  {
    id: 'drop-3',
    group: 'shapes',
    name: 'Drop 3',
    short: 'Close position cu a treia notă de sus coborâtă o octavă.',
    long: 'La fel ca drop 2, dar cobori a treia notă de sus. Lasă un interval mare între bas și restul notelor, ca la ghitară.',
    examples: [{ symbol: 'Cmaj7', notes: 'E3 C4 G4 B4', type: 'drop-3', caption: 'Cmaj7 → E3 C4 G4 B4' }],
    match: ['drop 3'],
  },
  {
    id: 'drop-2-4',
    group: 'shapes',
    name: 'Drop 2&4',
    short: 'Close position cu a doua și a patra notă de sus coborâte o octavă.',
    long: 'Cobori două note deodată, iar voicing-ul devine și mai larg. Mâna stângă ia cele două note de jos, dreapta pe celelalte două.',
    examples: [{ symbol: 'Cmaj7', notes: 'C3 G3 E4 B4', type: 'drop-2-4', caption: 'Cmaj7 → C3 G3 E4 B4' }],
    match: ['drop 2&4'],
  },
  {
    id: 'quartal',
    group: 'shapes',
    name: 'Quartal',
    short: 'Note suprapuse în cvarte.',
    long: 'În loc de terțe, notele sunt suprapuse în cvarte. E permisă o singură terță mare, sus de tot, ca în acordul „So What”. Sunetul e deschis și modern, fără să apese pe funcția acordului.',
    examples: [{ symbol: 'Dm7', notes: 'D3 G3 C4 F4 A4', type: 'quartal', caption: 'Dm7 = D3 G3 C4 F4 A4' }],
    match: ['quartal'],
  },
  {
    id: 'upper-structure',
    group: 'shapes',
    name: 'Upper structure triad',
    short: 'O triadă cântată deasupra guide tones-urilor unei dominante.',
    long: 'Pe o dominantă, mâna stângă ține terța și septima, iar dreapta cântă deasupra o triadă majoră sau minoră construită pe altă notă decât fundamentala. Triada aduce tensiunile cu ea. Jocul îți spune și ce triadă ai folosit.',
    examples: [{
      symbol: 'G7', notes: 'F3 B3 A4 C#5 E5', type: 'upper-structure', detail: 'A',
      caption: 'G7 = F3 B3 + A4 C#5 E5 (triada A, adică 9, #11 și 13)',
    }],
    match: ['upper structure triad', 'upper structure'],
  },

  {
    id: 'inversion',
    group: 'chords',
    name: 'Inversion (răsturnare)',
    short: 'Ce notă a acordului e în bas.',
    long: 'Root position înseamnă fundamentala în bas, 1st inversion terța în bas, 2nd inversion cvinta, 3rd inversion septima. E altceva decât tipul de voicing: tipul spune cât de întinse sunt notele, răsturnarea spune care dintre ele e jos.',
    examples: [{ symbol: 'C/E', notes: 'E3 G3 C4', inversion: '1st inversion', caption: 'C/E = E3 G3 C4 (1st inversion)' }],
    match: ['root position', '1st inversion', '2nd inversion', '3rd inversion'],
  },
  {
    id: 'slash',
    group: 'chords',
    name: 'Slash chord',
    short: 'Acord cu o notă anume cerută în bas, scrisă după bară.',
    long: 'C/E înseamnă acordul C cu E în bas. Jocul verifică separat dacă basul pe care l-ai pus e cel cerut.',
    match: ['slash chord'],
  },
  {
    id: 'tension',
    group: 'chords',
    name: 'Tension (tensiune)',
    short: 'Notă adăugată peste acord: 9, 11 sau 13.',
    long: 'Notele de peste septimă colorează acordul fără să-i schimbe funcția. Pe dominante există și tensiuni alterate (b9, #9, #11, b13). Fiecare calitate de acord are lista ei de tensiuni permise.',
  },
  {
    id: 'avoid',
    group: 'chords',
    name: 'Avoid note',
    short: 'Notă care se bate cu acordul și îi strică sunetul.',
    long: 'Tehnic face parte din gamă, dar ținută peste acord intră în conflict cu o notă esențială. Cazul clasic e 11 pe maj7 sau pe dominantă, la un semiton peste terță. Pe un 7sus4, terța e avoid; pe un sus4 cerut ca triadă, jocul o numără notă greșită.',
    examples: [{ symbol: 'Cmaj7', notes: 'C4 E4 F4 B4', says: 'Avoid note: F (11)', caption: 'Cmaj7 = C4 E4 F4 B4 → „Avoid note: F (11)”' }],
    match: ['avoid note', 'avoid notes'],
  },
  {
    id: 'muddy',
    group: 'chords',
    name: 'Muddy (prea jos)',
    short: 'Interval prea strâns cântat prea jos, care sună încărcat.',
    long: 'În registrul grav, intervalele mici devin noroi. Jocul semnalează secunde și terțe mici sub C3, și terțe mari sub G2. Voicing-ul poate fi corect pe hârtie și totuși să nu sune.',
    examples: [{ symbol: 'Cmaj7', notes: 'C2 E2 G2 B2', muddy: 2, caption: 'Cmaj7 = C2 E2 G2 B2 → două intervale semnalate' }],
    match: ['prea jos', 'muddy'],
  },

  {
    id: 'voice-leading',
    group: 'motion',
    name: 'Voice leading',
    short: 'Cum se mută fiecare voce de la un acord la următorul.',
    long: 'Un voice leading bun înseamnă că fiecare notă se mișcă cât mai puțin, ideal un semiton sau deloc. Jocul măsoară deplasarea medie pe voce, în semitonuri.',
    examples: [
      { symbol: 'Dm7', notes: 'F3 A3 C4 E4', caption: 'Dm7 F3 A3 C4 E4' },
      { symbol: 'G7', notes: 'F3 A3 B3 E4', caption: '→ G7 F3 A3 B3 E4 (se mișcă o singură voce, C → B)' },
    ],
    match: ['voice leading'],
  },
  {
    id: 'ii-V-I',
    group: 'motion',
    name: 'ii–V–I',
    short: 'Progresia de bază a jazzului: treapta a doua, a cincea, apoi tonica.',
    long: 'În Do: Dm7 → G7 → Cmaj7. Majoritatea standardelor sunt construite din lanțuri de ii–V–I-uri, de aceea e ultima unitate din drum și cea mai importantă.',
    match: ['ii–v–i'],
  },

  { id: 'right', group: 'stars', name: 'Right ★', short: 'Ai cântat acordul cerut.' },
  { id: 'clean', group: 'stars', name: 'Clean ★★', short: 'Corect și fără nimic de reproșat: fără avoid notes, fără intervale muddy.' },
  {
    id: 'smooth',
    group: 'stars',
    name: 'Smooth ★★★',
    short: 'Clean pe metronom, iar vocile se mișcă de la un acord la altul cât de puțin permite progresia. Prag: în medie, cel mult 1,5 semitonuri pe voce; pe ii–V–I, cel mult 1,25 (fiecare nivel îl spune pe al lui).',
  },
];

/**
 * The term with this id, or null.
 * @param {string} id
 * @returns {GlossaryTerm | null}
 */
export function glossaryTerm(id) {
  return GLOSSARY.find(entry => entry.id === id) ?? null;
}
