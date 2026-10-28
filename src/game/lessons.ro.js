// The theory pages in Romanian: only the words. The examples, the chain and the level each page
// leads to come from the English pages in lessons.js (`lessonIn`), so a translation can change
// what a page says but never what it plays or what the analyzer is asked about it.
//
// The shape is the English page's, item for item — the same sections and paragraphs, one caption
// per example, one line per "listens for" line — and test/lessons.test.js holds it so. Every
// claim here stands on the same test as its English twin.
//
// Claude translated these on 2026-10-27; Edi reads them before they ship. Jazz vocabulary
// (voicing, shell, rootless, drop 2, quartal, guide tones, root position, 1st inversion…) and note
// letters stay English, as everywhere else in the game.

/**
 * @typedef {{
 *   title: string,
 *   lead: string,
 *   sections: Array<{ heading: string, text: string[] }>,
 *   captions: string[],             // one per example, in the English page's order
 *   chain?: string[],               // one per chord of the chain, where the page has one
 *   listens: string[],
 * }} LessonWords
 */

/** @type {Record<string, LessonWords>} */
export default {
  triads: {
    title: 'Triade',
    lead: 'Trei note: o fundamentală, o terță deasupra ei și o cvintă deasupra ei. Orice acord de mai departe pe drum e o triadă cu ceva adăugat sau cu ceva lăsat deoparte.',
    sections: [
      {
        heading: 'Major și minor',
        text: [
          'Terța decide. La patru semitonuri deasupra fundamentalei e o terță mare, iar triada e majoră. La trei semitonuri e o terță mică, iar triada e minoră. Cvinta e aceeași în amândouă: la șapte semitonuri deasupra fundamentalei.',
        ],
      },
      {
        heading: 'Sus4',
        text: [
          'Scoate terța și pune în locul ei cvarta, la cinci semitonuri deasupra fundamentalei. Fără terță, acordul nu e nici major, nici minor. Rămâne suspendat și, de cele mai multe ori, vrea să se întoarcă la terța pe care a înlocuit-o.',
        ],
      },
      {
        heading: 'Unde stau notele',
        text: [
          'Oriunde. O triadă e aceeași triadă fie că notele ei stau una lângă alta într-o mână, fie că sunt întinse pe două octave și pe ambele mâini. Începe cu cele trei note alăturate, apoi încearcă fundamentala singură în mâna stângă și restul în dreapta.',
        ],
      },
    ],
    captions: [
      'Do major: fundamentală, terță mare, cvintă.',
      'Do minor: s-a mutat doar terța, cu un semiton mai jos.',
      'Csus4: cvarta stă acolo unde era terța.',
      'Același Do major, pe două mâini. Tot o triadă de Do major.',
    ],
    listens: [
      'Toate trei notele trebuie să fie acolo: fundamentala, terța și cvinta.',
      'Terța decide ce triadă e: un C cu Eb în el nu e C.',
      'Pe un sus4, cvarta stă acolo unde ar sta terța, iar terța nu are voie să-i ia locul.',
      'Nicio altă notă: un 9 sau o septimă adăugată face din ea alt acord, iar jocul o numără greșită.',
      'Așezarea e a ta: o mână sau două, în orice octavă.',
    ],
  },

  inversions: {
    title: 'Răsturnări',
    lead: 'Aceleași trei note, cu alta dintre ele jos. Acordul își păstrează numele; se schimbă basul, și odată cu el felul în care sună acordul.',
    sections: [
      {
        heading: 'Trei poziții',
        text: [
          'Cu fundamentala jos, triada e în root position. Cu terța jos e în 1st inversion, iar cu cvinta jos în 2nd inversion. Ce se întâmplă deasupra notei de jos nu schimbă numele.',
        ],
      },
      {
        heading: 'Cum se scrie',
        text: [
          'Bara numește basul. C/E e o triadă de Do major cu E ca notă cea mai joasă; C/G e aceeași triadă cu G jos. Se citește „C pe E”.',
        ],
      },
      {
        heading: 'La ce folosește',
        text: [
          'O răsturnare lasă basul să meargă treptat acolo unde fundamentalele ar sări, și îți lasă mâna pe loc de la un acord la altul. În unitatea asta basul e exercițiul: găsește-l întâi, apoi pune restul acordului deasupra.',
        ],
      },
    ],
    captions: [
      'Root position: C e nota cea mai joasă.',
      '1st inversion: terța, E, e jos.',
      '2nd inversion: cvinta, G, e jos.',
      'O triadă minoră se răstoarnă la fel: terța ei, Eb, e jos.',
      'Pe două mâini: E singur în stânga, restul unde cade.',
    ],
    listens: [
      'Doar nota cea mai joasă e comparată cu ce scrie după bară. Trebuie să fie nota de acolo, în orice octavă.',
      'Deasupra basului, notele pot sta oriunde.',
      'Cântă C/E cu C jos și verdictul o spune: „Basul trebuie să fie E, nu C”.',
    ],
  },

  sevenths: {
    title: 'Septacorduri',
    lead: 'O triadă cu încă o terță pusă deasupra: fundamentală, terță, cvintă, septimă. Patru note, și acordurile în care sunt scrise cele mai multe piese.',
    sections: [
      {
        heading: 'Cele patru pe care stă aproape orice piesă',
        text: [
          'Septacordul major (maj7): o triadă majoră cu septimă mare, la un semiton sub octavă. Septacordul de dominantă (7): o triadă majoră cu septimă mică, la un ton sub octavă. Septacordul minor (m7): o triadă minoră cu septimă mică. Semimicșoratul (m7b5): terță mică, cvintă micșorată și septimă mică.',
        ],
      },
      {
        heading: 'Încă două',
        text: [
          'Septacordul micșorat (dim7): terță mică, cvintă micșorată și septimă micșorată, așa că fiecare notă e la o terță mică de următoarea. Septima lui e aceeași clapă cu sexta mare. Acordul minor cu sextă (m6): o triadă minoră cu o sextă mare în loc de septimă.',
        ],
      },
      {
        heading: 'Terța și septima',
        text: [
          'Terța și septima sunt guide tones: singure, ele deosebesc un septacord major, o dominantă și un septacord minor. De aceea fiecare voicing de mai departe pe drum e construit în jurul lor, și de aceea fundamentala și cvinta pot fi lăsate altcuiva.',
          'Semimicșoratul e excepția care merită știută. Are aceeași terță și aceeași septimă ca septacordul minor, așa că acolo cvinta micșorată e nota care spune ce acord e.',
        ],
      },
    ],
    captions: [
      'Cmaj7: terță mare, septimă mare.',
      'C7: septima a coborât un semiton.',
      'Cm7: acum a coborât și terța.',
      'Cm7b5: și acum cvinta.',
      'Cdim7: septima încă o dată mai jos. Numai terțe mici, până sus.',
      'Cm6: o triadă minoră cu sexta deasupra.',
    ],
    listens: [
      'Terța și septima trebuie să fie acolo. Pe un m6, sexta stă acolo unde ar sta septima.',
      'Pe m7b5 și dim7 trebuie să fie și cvinta micșorată.',
      'Fundamentala și cvinta perfectă pot lipsi. Orice așezare e bună.',
    ],
  },

  shell: {
    title: 'Shell voicings',
    lead: 'Fundamentala, terța și septima. Minimul care încă spune acordul, și mâna stângă pe care o învață primii cei mai mulți pianiști.',
    sections: [
      {
        heading: 'Ce lipsește',
        text: [
          'Cvinta. Pe cele mai multe acorduri e o cvintă perfectă, oricare ar fi calitatea, deci nu-i spune urechii nimic ce n-a spus deja fundamentala. Fără ea acordul e mai ușor, iar deasupra rămâne loc pentru o melodie sau pentru cealaltă mână.',
        ],
      },
      {
        heading: 'Două feluri de a-l așeza',
        text: [
          'Fundamentală, terță, septimă; sau fundamentală, septimă, terță, cu terța sus. De la un acord la altul, alternarea celor două ține notele de sus aproape pe loc: pe Dm7, G7, Cmaj7, terța lui Dm7, F, e deja septima lui G7, iar septima lui, C, are doar de coborât un semiton, la B.',
        ],
      },
      {
        heading: 'Cu un basist',
        text: [
          'Lasă deoparte și fundamentala. Terța și septima singure sunt tot un shell, și sunt cele două note în jurul cărora unitatea următoare își construiește voicing-urile.',
        ],
      },
    ],
    captions: [
      'Fundamentală, terță, septimă.',
      'Fundamentală, septimă, terță: același shell, așezat invers.',
      'C7: s-a schimbat doar septima.',
      'Cm7 ca fundamentală, terță, septimă.',
      'Terța și septima singure, cu fundamentala lăsată basului.',
    ],
    listens: [
      'Doar fundamentala, terța și septima, ca două note sau trei. Adaugă cvinta, sau orice altceva, și nu mai e un shell.',
      'Ambele guide tones trebuie să fie acolo; fundamentala e opțională.',
      'Care dintre cele două e sus, și în ce octavă, alegi tu.',
    ],
  },

  rootless: {
    title: 'Rootless voicings',
    lead: 'Patru note, niciuna fundamentala. Fundamentala o are basistul, sau propria ta mână stângă, cu o octavă sau două mai jos, iar cele patru note de deasupra spun tot restul.',
    sections: [
      {
        heading: 'Forma A',
        text: [
          'De jos în sus: terță, cvintă, septimă, nonă. Pe Cmaj7 asta înseamnă E, G, B, D.',
        ],
      },
      {
        heading: 'Forma B',
        text: [
          'Aceleași patru note, întoarse: septimă, nonă, terță, cvintă. Pe Cmaj7 asta înseamnă B, D, E, G. Forma A are terța jos, forma B septima.',
        ],
      },
      {
        heading: 'Pe o dominantă',
        text: [
          'Cvinta lasă locul tercdecimei. Forma A pe G7 se citește terță, tercdecimă, septimă, nonă: B, E, F, A. Forma B se citește septimă, nonă, terță, tercdecimă: F, A, B, E.',
        ],
      },
      {
        heading: 'De ce două forme',
        text: [
          'Ca una dintre ele să fie mereu aproape de locul unde îți e deja mâna. Într-un ii–V–I ele alternează, A, apoi B, apoi A, iar mâna abia se mișcă. Ultima pagină a drumului arată asta notă cu notă.',
        ],
      },
    ],
    captions: [
      'Cmaj7, forma A: 3, 5, 7, 9.',
      'Cmaj7, forma B: 7, 9, 3, 5.',
      'Dm7, forma A: 3, 5, 7, 9.',
      'G7, forma B: 7, 9, 3, 13.',
      'G7, forma A: 3, 13, 7, 9.',
      'Forma A cu fundamentala dedesubt, în mâna stângă. Tot forma A.',
    ],
    listens: [
      'Patru note, în ordinea asta de jos în sus: terță, cvintă, septimă, nonă pentru A; septimă, nonă, terță, cvintă pentru B.',
      'Pe o dominantă, tercdecima poate sta acolo unde ar sta cvinta.',
      'O fundamentală dedesubt nu o strică: cu mâna stângă pe fundamentală, forma A rămâne forma A.',
      'Aceleași patru note în orice altă ordine nu sunt o formă rootless.',
    ],
  },

  'drop-2': {
    title: 'Drop 2',
    lead: 'Ia un acord de patru note în close position și coboară cu o octavă a doua notă de sus. Acordul se deschide, iar nota de sus rămâne sus.',
    sections: [
      {
        heading: 'Pas cu pas',
        text: [
          'Cmaj7 în close position e C, E, G, B. A doua notă de sus e G. Pune-o cu o octavă mai jos și obții G, C, E, B: o decimă de jos până sus, deschis la mijloc, cu B tot nota cea mai înaltă.',
        ],
      },
      {
        heading: 'Patru variante',
        text: [
          'Fiecare răsturnare a acordului în close position dă propriul ei drop 2, așa că fiecare notă a acordului ajunge pe rând sus. Pentru asta e voicing-ul: să pună acordul sub o notă de melodie fără să o înghesuie.',
        ],
      },
    ],
    captions: [
      'Înainte: Cmaj7 în close position. G e a doua de sus.',
      'După: G a coborât o octavă. B e tot sus.',
      'Din răsturnarea următoare: acum C e sus.',
      'Cm7, construit la fel.',
      'C7, construit la fel.',
    ],
    listens: [
      'Patru note. Urcă-o pe cea mai joasă cu o octavă: dacă ce obții e acordul în close position, cu nota aceea a doua de sus, a fost un drop 2.',
      'Oricare dintre cele patru răsturnări e bună.',
    ],
  },

  quartal: {
    title: 'Quartal',
    lead: 'Acorduri suprapuse în cvarte în loc de terțe. Deschise și puțin ambigue: sunetul modern, și cel la care jocul e cel mai strict.',
    sections: [
      {
        heading: 'Cum se construiește',
        text: [
          'Pornește de pe o notă a acordului și suprapune pe ea cvarte perfecte, de câte cinci semitonuri. D, G, C, F e un Re minor cu septimă: fundamentală, undecimă, septimă, terță.',
        ],
      },
      {
        heading: 'Voicing-ul „So What”',
        text: [
          'Trei cvarte cu o terță mare deasupra: D, G, C, F, A. Cinci note, două mâini, și cel mai cunoscut voicing quartal care există.',
        ],
      },
      {
        heading: 'Pe un septacord major',
        text: [
          'Pornește de pe septimă. B, E, A, D e Cmaj7: septimă, terță, tercdecimă, nonă.',
        ],
      },
      {
        heading: 'Pe o dominantă',
        text: [
          'Pornește de pe septimă. Primul pas în sus, până la terță, e tritonul care face din acord o dominantă: singura cvartă mărită din stivă. Restul sunt cvarte perfecte. F, B, E, A e G7: septimă, terță, tercdecimă, nonă.',
        ],
      },
      {
        heading: 'Tot trebuie să fie acordul',
        text: [
          'O stivă de cvarte căreia îi lipsește terța sau septima sună bine și e răspunsul greșit. E, A, D, G peste Dm7 nu are nici F, nici C, iar jocul aude Re minor fără ce-l face septacord minor.',
        ],
      },
    ],
    captions: [
      'Dm7 în cvarte: 1, 11, 7, 3.',
      'Voicing-ul „So What”: trei cvarte, apoi o terță mare deasupra.',
      'Cmaj7 în cvarte, de pe septimă: 7, 3, 13, 9.',
      'G7: tritonul dintre septimă și terță e singura cvartă mărită: 7, 3, 13, 9.',
    ],
    listens: [
      'Trei note sau mai multe, fiecare la o cvartă deasupra celei dinainte.',
      'Una dintre cvarte poate fi mărită. O singură terță mare e permisă, sus de tot, de la patru note în sus.',
      'Terța și septima acordului tot trebuie să fie în el.',
    ],
  },

  'ii-V-I': {
    title: 'ii–V–I',
    lead: 'Trei acorduri, fiecare la o cvartă deasupra celui dinainte: septacordul minor pe treapta a doua, dominanta pe a cincea, septacordul major pe prima. În Do: Dm7, G7, Cmaj7. E propoziția pe care e construit tot limbajul.',
    sections: [
      {
        heading: 'Ce se mișcă, și cât de puțin',
        text: [
          'Urmărește terțele și septimele. Septima lui Dm7, C, coboară un semiton la B, terța lui G7. Septima lui G7, F, coboară un semiton la E, terța lui Cmaj7.',
          'Celălalt guide tone rămâne pe loc de fiecare dată. Terța lui Dm7, F, e deja septima lui G7; terța lui G7, B, e deja septima lui Cmaj7.',
        ],
      },
      {
        heading: 'În rootless voicings',
        text: [
          'Forma A pe ii, forma B pe V, forma A pe I. Spre V se mișcă o singură notă, C coboară la B. Spre I trei note se mișcă treptat și una rămâne.',
        ],
      },
      {
        heading: 'Ce măsoară a treia stea',
        text: [
          'Într-o trecere pe metronom, jocul adună cât a călătorit fiecare voce de la un acord la altul. Condus ca mai jos, un ii–V–I se mișcă 0,75 dintr-un semiton pe voce la fiecare schimbare. A treia stea cere cel mult 1,25.',
        ],
      },
    ],
    captions: [
      'Întâi guide tones, ca shell: F și C deasupra fundamentalei.',
      'F a rămas. C a coborât un semiton la B.',
      'B a rămas. F a coborât un semiton la E.',
    ],
    chain: [
      'Dm7, forma A.',
      'G7, forma B: s-a mișcat o singură notă.',
      'Cmaj7, forma A: trei note s-au mișcat treptat.',
    ],
    listens: [
      'Orice voicing al fiecărui acord e bun pentru primele două stele.',
      'A treia stea cere trecerea pe metronom, iar vocile să se miște în medie cel mult 1,25 semitonuri la fiecare schimbare.',
    ],
  },
};
