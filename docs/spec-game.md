# SideKeys — spec-game.md

Stelele și XP-ul: ce înseamnă un rezultat bun la un exercițiu, cu praguri măsurate, nu presupuse.
Scris și aprobat pe 2026-10-11 (decizia deschisă 3 din [DIRECTION.md](DIRECTION.md), acum
închisă). Pragurile de mai jos sunt măsurate; metoda e în secțiunea de praguri, ca să poată fi
refăcută când se adaugă o progresie.

Regula de scop: aici nu intră nimic despre cum arată ecranul. Formula stă în `theory/` sau
alături, ca să ruleze la fel în browser, în teste și (când va exista clasament) pe server.

## Cele trei stele

Fiecare stea adaugă **o singură idee**, iar fiecare se calculează din ce întoarce deja
`analyzeVoicing`. Un exercițiu („un nivel") e o trecere cu N acorduri cerute; stelele se dau pe
trecere, nu pe acord.

| Stea | Nume (UI) | Ce cere | Din ce se calculează |
|---|---|---|---|
| ★ | **Right** | ≥ **60%** dintre acorduri sunt *corecte* | `missing` și `wrong` goale |
| ★★ | **Clean** | ≥ **80%** dintre acorduri sunt *curate* | niciun mesaj `level: 'warning'` |
| ★★★ | **Smooth** | mod **timed** obligatoriu, plus mișcare medie pe voce sub pragul progresiei | `compareVoicings().averageMove` |

Sub 60% corecte: nicio stea, nivelul nu e trecut.

### ★ Right — „ai cântat acordul cerut"

Un acord e **corect** când are toate notele pe care acordul le cere și n-are nicio notă din
afara lui:

```js
const right = analysis.missing.length === 0 && analysis.wrong.length === 0;
```

Notele de evitat, registrul mâlos și dublările **nu** strică steaua asta — ele sunt ce adaugă
steaua a doua. Pragul de 60% e decizia lui Edi (2026-10-11): o primă stea trebuie să fie
accesibilă unui începător care încă greșește o treime din acorduri, altfel nimeni nu trece de
primul nivel.

### ★★ Clean — „fără nimic de reproșat"

```js
const clean = analysis.messages.every(m => m.level !== 'warning');
```

Analizorul a decis deja ce e reproș și ce e observație, iar steaua se sprijină pe asta fără să
inventeze o a doua listă: **avertismente** sunt `missing`, `wrong`, `avoid` și `muddy`;
**informative** sunt `rootless`, `caution`, `doubling` și `type`. Deci **o dublare nu strică
Clean** — nici nu trebuia, un bas dublat la octavă e muzică normală cu două mâini. `caution`
(o tensiune permisă dar sensibilă pe acordul ăla) la fel: rămâne observație.

Clean ⊂ Right: dacă n-ai avertismente, n-ai nici note lipsă, nici note greșite. Deci a doua stea
o implică pe prima, și nu trebuie verificate amândouă.

**Pragul de 80%** a fost propunerea mea, aprobată de Edi pe 2026-10-11: 100% curat pe 12 acorduri
e aspru pentru un nivel de mijloc — o singură notă de evitat ar șterge steaua — iar 80% lasă două
scăpări din zece.

### Ce mai poate cere un nivel

Pe lângă acord, un nivel poate cere **o textură**: `texture: 'shell'`, `'rootless-A'`, `'drop-2'`,
`'quartal'` — sau o listă, când „forma A sau forma B" e același exercițiu. Verificarea nu e un
verdict separat, e **parte din Right**: notele corecte în forma greșită nu trec nivelul, iar
ecranul o spune cu propriile cuvinte („Right notes, wrong shape — that is Close position"),
pentru că e singurul eșec fără avertisment în spatele lui — analizorul a fost întrebat despre
acord, nu despre exercițiu. O listă goală nu cere nimic, ca un nivel cu date incomplete să fie
lax, nu imposibil.

Textura nu intră în analizor, fiindcă nu e o proprietate a acordului: `analyzeVoicing` raportează
`voicing.type`, iar `isRight(analysis, { texture })` din `stars.js` compară. Basul de slash e
invers — **acolo** e o proprietate a acordului, deci stă în analizor
([spec-analyzer.md](spec-analyzer.md), punctul 1b).

**Un nivel trebuie să fie jucabil, nu doar parsabil.** Un test merge prin fiecare cerere a
fiecărui nivel cu textură și verifică, prin `suggestVoicings`, că există măcar un voicing fără
avertismente de forma cerută. Oracolul e conservator: o textură pe care un om ar putea-o cânta
dar generatorul n-o construiește ține nivelul afară din drum. Mai bine așa decât un nivel pe care
nimeni nu-l poate trece. Ce a tăiat oracolul, măsurat pe 2026-10-11: **shell** nu există pe
m7b5, dim7 sau m6; **quartal** nu există pe nicio dominantă (regula strânsă din 2026-09-20 —
cel mult o cvartă mărită); **rootless A** lipsește pe Abm7b5, o margine de registru.

**Tempoul**: 120 bpm, un acord pe măsură — două secunde ca să-l auzi, să-l găsești și să-l cânți
(decizie Edi, 2026-10-11).

### ★★★ Smooth — „legat, la tempo"

Trei condiții, toate obligatorii:

1. **Modul timed.** Fără metronom nu se dă a treia stea, oricât de curat ai cânta. (Decizie Edi,
   2026-10-11.)
2. **Clean la același prag** ca steaua a doua.
3. **Mișcarea medie pe voce** peste toată trecerea, sub pragul progresiei din tabelul de mai jos.

```js
// media lui averageMove pe schimbările de acord, nu pe acorduri:
// un acord repetat (| Cmaj7 | % |) nu e o schimbare și nu intră în medie.
const smooth = timed && cleanRatio >= CLEAN && meanAverageMove <= threshold(progression);
```

Numele vine din motor, nu din marketing: `compareVoicings` întoarce deja
`rating: 'smooth' | 'ok' | 'jumpy'`, cu `smooth` la **≤ 1,5 semitonuri pe voce**. A treia stea e
chiar pragul pe care codul îl numește așa de la Faza 2.

## Pragurile de mișcare, măsurate

Metoda, reproductibilă: pentru fiecare progresie din `PROGRESSIONS` (în C), se înlănțuie
`suggestVoicings` — la fiecare acord se ia cel mai bun candidat față de voicing-ul anterior, cu
textura păstrată — și se măsoară `averageMove` pe fiecare schimbare. Acordurile repetate nu intră.
Coloana „ales la întâmplare" e mediana aceluiași set de candidați fără avertismente, adică ce
obții dacă joci curat dar nu te gândești deloc la voice leading.

| Progresie | bine condus (semitonuri/voce) | ales la întâmplare | **prag ★★★** |
|---|---|---|---|
| ii–V–I major | 0,75 | 4,00 | **1,25** |
| ii–V–i minor | 1,00 | 5,00 | **1,50** |
| Blues (basic) | 1,00 | 4,13 | **1,50** |
| Jazz blues | 0,90 | 3,65 | **1,50** |
| Rhythm changes (A) | 0,92 | 4,12 | **1,50** |
| Turnaround I–VI–ii–V | 1,25 | 2,92 | **1,75** |
| Coltrane changes | 0,83 | 3,08 | **1,50** |
| Drill (12 acorduri la întâmplare, 40 de rulări) | 0,80 | 4,01 | **1,50** |
| Nivel: ii–V–I în C, F, Bb, Eb (12 cereri) | 0,82 | 4,14 | **1,25** |
| Nivel: ii–V–I în toate cele 12 tonalități | 0,86 | 4,55 | **1,25** |

**Un nivel cu mai multe tonalități păstrează pragul progresiei** (măsurat 2026-10-11, întrebarea
rămasă de la nivele): schimbarea de tonalitate costă ~1,00 semitonuri pe voce, dar pașii dinăuntrul
lui ii–V–I sunt aproape gratis (0,25), deci media abia urcă — 0,82 pe patru tonalități și 0,86 pe
douăsprezece, față de 0,75 într-una singură. Pe douăsprezece tonalități cel mai scump pas urcă la
2,50, dar media rămâne sub prag, ceea ce e exact ce măsoară regula: un salt scump e iertat dacă
restul e strâns.

Ce spun cifrele: **distanța dintre „condus" și „la întâmplare" e de patru ori**, deci pragul nu e
o chestiune de reglaj fin — orice valoare între 1,25 și 2 separă corect. De aceea regula e simplă
și are doar două excepții, amândouă măsurate:

- **1,50 implicit** — exact `smooth` din `voiceLeading.js`, deci nu apare un al doilea prag în cod.
- **1,25 pe ii–V–I major**, fiindcă se leagă aproape gratis (0,75 măsurat): la pragul comun ar fi
  fost steaua cea mai ușoară din joc, pe exercițiul care se repetă cel mai des.
- **1,75 pe turnaround**, fiindcă mișcarea de bas pe terțe costă mai mult (1,25 măsurat, cel mai
  scump din bibliotecă). La 1,50 ar fi fost singura progresie unde steaua cere mai bine decât
  cântă generatorul.

Când se adaugă o progresie nouă în bibliotecă, i se măsoară pragul în același fel și intră în
tabel, ca la tabelul de calități al analizorului.

## XP — propunere, nu decizie

Edi a cerut stelele; XP-ul de mai jos e propunerea mea, de aprobat separat.

- **XP pe calitate și dificultate, nu pe volum** (regulă din `DIRECTION.md`):
  `XP = stele × dificultatea unității`, unde dificultatea e poziția unității pe drum (1 pentru
  Triade … 9 pentru Comping). Un nivel de triade cu trei stele dă 3; același rezultat pe
  rootless dă 15.
- **Plafon pe repetiții**: a doua trecere prin același nivel în aceeași zi dă jumătate, a treia și
  următoarele zero. Nivelul rămâne jucabil la nesfârșit — numai XP-ul se oprește, ca să nu fie
  mai profitabil să spamezi triade decât să mergi mai departe.
- **Nimic pentru timp petrecut.** Obiectivul zilnic în minute e pentru streak, nu pentru XP.

## Antrenamentul zilnic (2026-10-11)

Coada de recapitulare e ținută pe **calități de acord**, nu pe acorduri: un punct slab e „m7b5",
nu „Abm7b5, atunci". Regula, exact cum o cere DoD-ul P1:

- un acord care n-a ieșit curat pune calitatea lui în coadă, **scadentă mâine** — nu azi, fiindcă
  spațierea e tot rostul;
- un răspuns curat la o calitate din coadă urcă numărul de reușite; **la trei, iese**;
- **o ratare pune numărul înapoi la zero**, deci cele trei trebuie să fie consecutive;
- o calitate ratată măcar o dată într-o trecere **nu** se consideră curată în trecerea aia,
  oricâte alte acorduri de felul ei au ieșit bine.

Streak-ul numără zilele consecutive în care s-a cântat ceva, iar o zi în care încă nu s-a cântat
**nu** îl rupe — ziua nu s-a terminat. Obiectivul zilnic e în minute (15 implicit) și numără
**timpul cântat**: ceasul pornește la primul răspuns dintr-o trecere, nu când se deschide ecranul.

## Ce nu intră aici

- Challenge-ul zilei (stil Wordle, cu grilă partajabilă) — e punct separat în P1 și cere un seed
  zilnic determinist plus partajarea; nu e în ecranul Azi deocamdată.
- Formula completă de repetiție spațiată (SM-2 peste `weakSpots`) — ce există acum e regula
  simplă de mai sus, cerută de DoD; SM-2 rămâne pentru P2.
- Conținutul testului de plasare — teoria e a lui Edi, decizia deschisă 2.
- Cum arată stelele pe ecran: în prototip sunt albe, tocmai ca să nu intre o culoare de teorie
  într-un verdict (vezi `assets/BRAND.md`).
