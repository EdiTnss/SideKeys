# SideKeys — spec-i18n.md

Jocul în două limbi: engleză și română. Aprobat de Edi pe 2026-10-27 și construit în aceeași zi,
în șase etape (jurnalul). Laboratorul (`/lab/`, `index.html` + `src/ui/`) rămâne doar în engleză.

## Ce se traduce și ce nu

- **Engleza e implicită.** Româna pornește singură doar când **prima** limbă a browserului e `ro`
  sau `ro-…` (`rof`, `rom` sunt alte limbi). Comutatorul `EN | RO` din antet schimbă limba pe loc,
  iar alegerea se ține în `localStorage` sub `sidekeys.locale`; fără storage (fereastră privată)
  comutarea merge, doar nu se ține minte.
- **Rămân în engleză și în română**: jargonul de jazz (voicing, shell, rootless A/B, drop 2, drop 3,
  drop 2&4, quartal, upper structure triad, close position, spread, avoid note, voice leading,
  slash chord, guide tones, ii–V–I, root position / 1st / 2nd / 3rd inversion), notele cu litere
  („Lipsește E (3)", nu Mi), numele stelelor (Right / Clean / Smooth) și textul de share al
  challenge-ului.
- **Se traduc**: tot restul, inclusiv „muddy" („Prea jos: C2–E2 (terță mare)") și numele
  intervalelor.

## Unde stau cheile

Tot ce ține de limbă e JS pur, fără DOM, testat în Node; shell-ul doar ține limba aleasă
(`app/src/lib/locale.svelte.ts`) și afișează.

| Fișier | Ce face |
|---|---|
| `src/i18n/i18n.js` | `detectLocale`, `translate` (parametri `{nume}`, plural, cădere pe engleză) |
| `src/i18n/en.js`, `src/i18n/ro.js` | dicționarele, cheie cu cheie |
| `src/i18n/messages.js` | mesajele analizorului, tipul de voicing, răsturnarea, punctul slab — compuse din chei |
| `src/i18n/names.js` | numele din motor după id: unități, nivele, forme, grupe, progresii, sesiunile de Training, challenge-ul |
| `src/i18n/terms.js` | `splitTerms`: împarte un text în bucăți simple și termeni din glosar |
| `src/game/lessons.ro.js` | cuvintele paginilor de teorie; exemplele vin din `lessons.js` (`lessonIn`) |
| `src/game/glossary.js` | glosarul, numai în română |

**Motorul nu traduce nimic și nu se schimbă de dragul traducerii.** Unde shell-ul avea nevoie de
bucățile unei propoziții, motorul a primit câmpuri **în plus**, cu textul englezesc neatins:

- `analyzeVoicing` → fiecare mesaj are `params` lângă `text` (detaliile în
  [spec-analyzer.md](spec-analyzer.md)); promptul din `ai/explain.js` primește tot doar `text`.
- `weakSpots` (`ui/stats.js`) → `kind` și `degree` lângă `problem`.
- `trainingPlan` → `shape`, `progressionId`, `key`; `challengeLevel` → `number`;
  `QUALITY_GROUPS` → `id`.

Propoziția nu se traduce niciodată după ce a fost construită în engleză: se compune din chei. De
aceea testele cer ca, **în engleză**, compunerea să dea literă cu literă textul motorului
(`test/messages.test.js`, `test/names.test.js`). Un mesaj reformulat în analizor pică testul
până primește cheile lui.

## Regulile

1. **O cheie nouă intră în ambele dicționare, în același commit.** `test/i18n.test.js` cere
   aceleași chei, aceiași parametri `{…}` în ambele limbi și niciun text gol. O cheie care
   lipsește totuși în română cade pe engleză; una care lipsește peste tot apare pe ecran ca
   numele ei, ca să poată fi găsită.
2. **Un text cu număr are forme de plural**, ca obiect: `{ one, other }` în engleză,
   `{ one, few, other }` în română („o zi", „2 zile", „20 de zile"). Forma o alege
   `Intl.PluralRules` după `params.count`.
3. **Un nivel, o unitate, o formă, o grupă sau o progresie nouă** are nevoie de nume în ambele
   limbi (`unit.<id>.name`, `unit.<id>.blurb`, `level.<id>`, `shape.<id>`, `group.<id>`,
   `progression.<id>`); `test/names.test.js` pică altfel.
4. **O pagină de teorie nouă** are nevoie de geamăna ei în `lessons.ro.js`, cu aceeași formă: același
   număr de secțiuni și paragrafe, câte un caption pe exemplu și pe acordul din lanț, câte un rând
   pe fiecare rând „listens". `test/lessons.test.js` verifică forma, iar fiecare afirmație
   românească stă pe același test ca perechea ei englezească.

## Glosarul

Textul e al lui Edi, aprobat cuvânt cu cuvânt pe 2026-10-27, cu o singură schimbare aprobată în
aceeași zi: pragul de la Smooth (1,5 în general, 1,25 pe ii–V–I, cum cere `stars.js`).

- **Pagina „Glosar"** e ultima din lista Teoriei și există doar în română.
- **În joc, în română**, `Glossed.svelte` subliniază termenii din mesajele analizorului, din
  verdict, din „Cântă-l ca …", din titlul nivelului (Joc, Rezultat, Azi) și din numele unităților
  pe Drum; la clic arată explicația scurtă. **Nu** se pune pe text din interiorul unui buton
  (nivelele de pe Drum, butoanele din Training): ar fi un buton în buton, iar clicul ar porni
  nivelul. În engleză nu apare nimic nou.

**Cum se adaugă un termen**: o intrare în `GLOSSARY` (`id`, `group`, `name`, `short`, `long`,
`examples`, `match`). `match` sunt cuvintele cu care termenul apare în textul românesc al jocului,
cu litere mici; se potrivesc indiferent de majuscule, doar ca cuvinte întregi, iar cel mai lung
câștigă. Un exemplu își scrie așteptarea (`type`, `detail`, `inversion`, `says`, `muddy`), iar
`test/glossary.test.js` îl trece prin analizor: un exemplu care nu mai e ce spune glosarul pică.

## Ce nu e făcut

- **Zecimalele calculate** (mișcarea pe voce, pe Teorie și în joc) ies cu punct și în română
  („1.25 semitonuri"), deși textul scris le are cu virgulă.
- **„Rootless" singur** (fără A sau B) și „Forma A" din numele nivelelor nu sunt legate de niciun
  termen din glosar.
