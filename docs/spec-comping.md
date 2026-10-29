# SideKeys — spec-comping.md

Raportul de comping: ce spune după ce ai acompaniat câteva chorusuri, în ce ordine și cu ce
praguri. E primul punct din P2 (`PRODUCT.md`): **fără specificația asta aprobată de Edi nu se scrie
cod**. Starea documentului: **aprobată de Edi pe 2026-10-29**, cu deciziile lui din aceeași zi
(lista e la final). Ce e marcat _propunere_ e o cifră a lui Claude, de calibrat pe sesiunile lui Edi; metoda
de calibrare e la final.

**DoD-ul P2:** pe o sesiune de 4 chorusuri înregistrată de Edi, raportul spune cel puțin 5 lucruri
adevărate pe care el le confirmă, și **niciunul fals**. De aici vine regula de bază a raportului:
**precizia bate acoperirea**. Un lucru se spune numai când datele îl susțin clar; la limită, tace.
Un raport cu șase observații adevărate trece, unul cu douăzeci și una falsă pică.

## Contextul sesiunii (decis de Edi, 2026-10-29)

- **Două mâini, cu bas.** Aplicația cântă basul, tu acompaniezi cu amândouă mâinile. Fundamentala
  nu e cerută în voicing (regula analizorului pentru septacorduri rămâne cum e), iar notele nu se
  împart pe mâini: raportul vede un singur strat de acord.
- Basul vine din aranjamentul existent (`realize.js` → `player.js`), numai partea de bas
  (`parts`), fără strat de acord și fără melodie. Tobele nu există, iar v1 nu le cere: metronomul
  ține timpul.
- **Fără melodie** în v1. „Ai dublat melodia" rămâne pentru cine o înregistrează, mai târziu.
- Progresia: orice grilă din bibliotecă sau scrisă de mână. **O sesiune salvată în
  `harness/sessions/` e publică**, deci cele 4 chorusuri pentru DoD se cântă pe o progresie
  originală sau din domeniul public (un blues de 12 măsuri merge), nu pe un standard.

## Intrarea: banda sesiunii, nu captura

Raportul se calculează **după** cântat, dintr-o bandă (`ui/tape.js`, formatul 1). Banda are deja
tot ce trebuie: MIDI-ul brut de la clapă (note și pedale), progresia (`grid`, `timeSignature`) și
pornirea metronomului (`tempo`, `bar1At`). Notele de bas trimise de aplicație nu intră pe bandă
(`keepMidi` ține doar intrarea), deci nu se amestecă în voicings.

**Captura de 300 ms nu se folosește.** E făcută pentru „cântă un acord și ține-l": la comping, două
lovituri pe optimi la 160 bpm sunt la 188 ms una de alta și s-ar topi într-un singur snapshot.
Raportul își face propria segmentare, pe atacuri. Captura, harness-ul și reluarea rămân neatinse.

### Atacul

- Un **atac** e un grup de note-on la cel mult **50 ms** de primul din grup (_propunere_: un acord
  plaqué real se întinde pe 10–40 ms).
- **Voicing-ul atacului** = toate clapele apăsate la sfârșitul grupului, inclusiv cele ținute din
  atacul de dinainte. Pedala de sustain nu adaugă note: judecăm mâinile, nu rezonanța.
- Un grup cu **o singură notă nouă** peste un acord ținut e o **mișcare de voce**, nu un atac:
  intră în voice leading și în linia de sus, nu și în ritm. Un grup cu o singură notă și nimic
  ținut se ignoră (o notă scăpată nu e un acord).
- **Poziția** atacului vine din ceasul metronomului (`positionAt` din `theory/timing.js`), iar
  pentru ritm se cuantizează pe optimi (`quantizePosition`, `division: 2`). Abaterea de la grilă
  se păstrează în milisecunde, pentru „puncte slabe în timp".
- **Acordul judecat** e slotul din grilă în care cade atacul, cu o excepție: anticiparea. Un atac
  în ultima jumătate de timp dinaintea unei schimbări de acord **peste bara de măsură** (optimea a
  doua din 4, în 4/4) e judecat pe acordul următor, ca în joc (`ANTICIPATION_BEATS`, regula din
  `spec-capture.md`). **Nu se anticipează în mijlocul măsurii** (Edi, 2026-10-29): un atac de pe
  „și"-ul lui 2 se judecă pe acordul de pe 1, ca în joc. Comping-ul și jocul citesc anticiparea la
  fel.

## Ce raportează, în ordine

Ordinea urmează analizorul: întâi identitatea acordului, apoi registrul, apoi mișcarea, apoi
varietatea. Fiecare constatare are un **cod**, un **nivel** (`problem` sau `strength`), un
**număr** și **măsurile** în care s-a întâmplat (ca să poată fi ascultate), plus `params` pentru
cele două limbi, ca mesajele analizorului (`spec-i18n.md`). Raportul spune și ce merge, nu doar ce
nu merge: DoD-ul numără lucruri adevărate, iar o constatare bună e la fel de verificabilă.

### 1. Acordurile (corectitudine și puncte slabe)

Fiecare atac trece prin `analyzeVoicing` pe acordul judecat. Se adună pe **calitate** și pe
**simbol**, ca `weakSpots` din `ui/stats.js`.

| Cod | Spune | Când (_propunere_) |
|---|---|---|
| `missed-change` | „Nu ai cântat Gm7 în măsurile 6 și 18" | un slot fără niciun atac judecat pe el |
| `stale-chord` | „Ai rămas pe C7 după schimbare, de 3 ori" | primul atac dintr-un slot are notă greșită pentru el, dar e corect pe slotul de dinainte |
| `missing-tone` | „Pe m7b5 îți lipsește b5, de 4 ori din 6" | aceeași notă obligatorie lipsă în ≥ 3 atacuri **și** ≥ 50% din atacurile pe acea calitate |
| `wrong-note` | ca mai sus, pe nota străină | aceleași praguri |
| `avoid-note` | ca mai sus, pe nota de evitat | aceleași praguri |
| `quality-clean` (strength) | „Dominantele: curate în 23 din 24" | ≥ 90% curate, pe ≥ 8 atacuri |

Un atac izolat greșit **nu se raportează**: la comping o notă scăpată e zgomot, nu un obicei.

### 2. Registrul

Fereastra, acceptată de Edi: **nota de sus până la G5 inclusiv** (MIDI 79), ca să nu acoperi
solistul; **jos, limitele de interval din analizor** (`LOW_INTERVAL_LIMITS`, aceleași praguri);
**centrul în jurul lui C4**.

| Cod | Spune | Când (_propunere_) |
|---|---|---|
| `too-high` | „Nota de sus trece de G5 în 7 atacuri (măsurile …)" | ≥ 3 atacuri peste G5 |
| `muddy` | „Prea jos: B2–D3 pe Gm7, de 4 ori" | aceeași pereche tulbure în ≥ 3 atacuri; orice pereche în ≥ 10% din atacuri |
| `center-drift` | „Voicings-urile tale coboară spre final: centrul trece de la D4 la A3" | media notelor pe chorus se mută cu ≥ 4 semitonuri între primul și ultimul chorus |
| `center-out` | „Centrul tău stă sub F3 în 40% din atacuri" | centrul atacului (media notelor) în afara ferestrei F3–G4 în ≥ 25% din atacuri |
| `register-ok` (strength) | „Ai stat în registru: niciun atac peste G5, nimic tulbure" | zero `too-high` și zero `muddy` pe ≥ 4 chorusuri |

Fereastra centrului, F3–G4 în jurul lui C4, e acceptată de Edi (2026-10-29). Pragul de 25% rămâne
_propunere_.

### 3. Voice leading

`compareVoicings` din `voiceLeading.js`, **numai între ultimul atac de pe un acord și primul de pe
următorul** (repetarea aceluiași voicing pe un acord nu e mișcare). Ratingul și pragurile sunt cele
existente (`smooth` ≤ 1,5 semitonuri pe voce, `ok` ≤ 3, altfel `jumpy`), iar saltul între două
voicings spread rămâne schimbare de registru intenționată, ca acum.

| Cod | Spune | Când (_propunere_) |
|---|---|---|
| `jumpy-spot` | „Saltul de la D7 la Gm7 e mare de fiecare dată (măsurile 4, 16, 28, 40)" | aceeași schimbare de acord `jumpy` în ≥ 3 din 4 chorusuri |
| `jumpy-overall` | „O schimbare din trei sare" | ≥ 30% din schimbări `jumpy` |
| `smooth-overall` (strength) | „Mișcare medie de 1,2 semitonuri pe voce" | ≥ 80% din schimbări `smooth` |

`jumpy-spot` e constatarea cea mai utilă: un loc anume din formă, repetat, e un obicei de mână.

### 4. Varietatea

Patru axe, toate cerute de Edi. Aici sunt cele mai multe cifre de calibrat, fiindcă „prea puțină
varietate" e o judecată de gust, nu o regulă.

**Tipuri de voicing.** Tipul din analizor (`shell`, `rootless-A`, `rootless-B`, `drop-2`,
`quartal`, `upper-structure`, `close`, `spread`).

| Cod | Când (_propunere_) |
|---|---|
| `one-type` — „Aproape numai rootless A (88%)" | un singur tip în ≥ 80% din atacuri |
| `types-mixed` (strength) — „Ai alternat rootless A/B, drop 2 și quartal" | ≥ 3 tipuri, fiecare în ≥ 10% |

**Densitate.** Numărul de note pe atac.

| Cod | Când (_propunere_) |
|---|---|
| `one-density` — „Mereu 4 note" | același număr de note în ≥ 90% din atacuri |
| `density-varied` (strength) | atât atacuri de 2–3 note, cât și de 4+, fiecare grup în ≥ 20% |

**Linia de sus.** Nota de sus a primului atac de pe fiecare acord, în ordinea formei.

| Cod | Când (_propunere_) |
|---|---|
| `static-top` — „Nota de sus stă între E4 și F4 tot chorusul" | întinderea liniei de sus pe un chorus ≤ 2 semitonuri, în ≥ 2 chorusuri |
| `top-line` (strength) — „Linia de sus se mișcă, mai ales pe treptat" | ≥ 60% din pașii liniei de sus sunt de 1–2 semitonuri, cu întinderea pe chorus ≥ 5 |

O notă comună ținută sus nu e o greșeală: `static-top` cere un chorus întreg pe loc, nu două acorduri.

**Ritmul.** Pe atacurile cuantizate pe optimi.

| Cod | Spune | Când (_propunere_) |
|---|---|---|
| `same-pattern` | „Același ritm în 80% din măsuri (pe 1 și pe 3)" | cel mai des tipar de măsură în ≥ 60% din măsuri |
| `downbeats-only` | „Doar pe timpi, niciodată pe optimea a doua" | ≥ 90% din atacuri pe timp |
| `too-busy` | „În medie 6 atacuri pe măsură" | media ≥ 5 pe măsură |
| `pushes` (strength) | „Ai anticipat schimbările în 14 locuri" | ≥ 10% din schimbări anticipate |
| `rushing` / `dragging` | „Cazi cu 35 ms înaintea timpului" | abaterea medie ≤ −25 ms sau ≥ +25 ms, pe ≥ 20 de atacuri |
| `timing-loose` | „Abateri mari: ±60 ms" | abaterea standard ≥ 45 ms |

**Swing sau drept e o setare a sesiunii, implicit swing în triolet** (Edi, 2026-10-29): optimea a
doua cade la ⅔ din timp. Fără setare, orice optime swingată ar părea întârziată cu ~80 ms la
120 bpm, iar `dragging` ar deveni o constatare falsă, adică exact ce interzice DoD-ul. Setarea
se scrie pe bandă, ca reluarea să judece la fel.

## Ce se arată

Ieșirea e un obiect simplu, ca la analizor:

```js
compingReport(attacks, form, options) → {
  choruses, bars, attacks: n,        // ce s-a judecat
  findings: [{ code, level, count, of, bars, params }],   // în ordinea secțiunilor de mai sus
  perChorus: [{ center, topRange, types, pattern }],      // cifrele brute, pentru verificare
}
```

Ecranul arată **întâi cel mult trei probleme**, cu măsurile lor, apoi **punctele tari**, apoi
restul, strâns. E ecranul Rezultat cu „un singur lucru de reparat", lărgit: un raport pe patru
chorusuri are mai mult de spus decât un nivel, dar o listă de douăzeci nu repară nimic.

**Raportul apare întâi în Laborator** (Edi, 2026-10-29). Acolo există deja banda, „Save session",
grila și aranjamentul, deci lipsesc doar două lucruri: basul cântat singur și panoul de raport.
Gig Mode din joc, cu tobe, vine după, ca forma lui plătită; el cere întâi banda în shell.

## Unde stă codul

- **`src/theory/comping.js`**: raportul, JS pur, fără DOM, testat cu `node --test`. Primește
  atacurile deja segmentate (note, poziție, abatere în ms) și forma (sloturile progresiei); nu
  știe de MIDI. Test întâi, ca la orice atinge raportul de comping (regula din `PRODUCT.md`).
- **Segmentarea** (bandă → atacuri): lângă bandă, în `src/ui/`, fiindcă citește evenimente MIDI;
  tot pură și testată.
- Pragurile stau într-un **tabel de date** exportat, ca `LOW_INTERVAL_LIMITS`, ca să fie mutate
  după calibrare fără să se schimbe codul.

## Cum se calibrează (înainte de a numi raportul gata)

Ca la microfon: se măsoară, nu se ghicește.

1. Edi înregistrează **4 chorusuri cum ar cânta pe gig** (sesiunea de DoD) și **un chorus prost
   intenționat**: același voicing, mereu pe 1 și pe 3, sus peste G5, câteva acorduri sărite.
2. Raportul trebuie să găsească **fiecare** defect plantat în chorusul prost, iar pe cele 4
   chorusuri bune să nu spună nimic fals. Ce spune pe ele, Edi confirmă sau infirmă rând cu rând.
3. Un prag care produce o constatare falsă **se strânge**, nu se discută: precizia bate acoperirea.
4. Cifrele finale, sesiunile folosite și verdictul lui Edi se scriu aici, ca la `spec-game.md`.
   Sesiunile intră în `harness/sessions/` (progresie originală, deci se pot publica), iar raportul
   lor devine un test: dacă se schimbă, se vede.

## Deciziile lui Edi (2026-10-29)

- Contextul: **două mâini, basul din aplicație**, fără melodie.
- Registrul: **sus până la G5**, jos limitele de interval, **centrul F3–G4**.
- Varietatea are **patru axe**: tipuri de voicing, densitate, linia de sus, ritm.
- **Fără anticipare în mijlocul măsurii**, ca în joc.
- **Swing în triolet implicit**, drept ca setare.
- Raportul apare **întâi în Laborator**.

Specificația e aprobată în întregul ei (2026-10-29). Rămân de aprobat, după calibrare, pragurile
marcate _propunere_.
