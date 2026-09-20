# SideKeys — spec-analyzer.md

Parserul de chord symbol (`theory/chords.js`), tabelul calităților, clasificarea voicing-ului (`theory/analyzer.js`) și voice leading-ul (`theory/voiceLeading.js`). Mutat neschimbat din `CLAUDE.md` pe 2026-09-19; se citește când se lucrează la aceste module sau la `theory/voicings.js`.

## Specificația analizorului (inima proiectului)

Note ca numere MIDI (60 = C4, notație științifică). Genos afișează aceeași notă ca C3 (convenția Yamaha); în cod, UI și README folosim doar 60 = C4. Pitch class = `n % 12`. Toate regulile de mai jos primesc teste.

### Parser de chord symbol (`chords.js`)

Gramatică: `root` `quality` `extensions*` `(/bass)?`

- root: `[A-G](#|b)?`
- quality, cu aliasurile acceptate (lista exactă e `QUALITIES` din `chords.js`; ce e aici e rezumatul):
  - `maj7`: `maj7 | Δ | Δ7 | ∆ | ∆7 | M7 | MA7 | ma7`
  - `m7`: `m7 | -7 | min7 | mi7 | MI7`
  - `7`: `7`
  - `m7b5`: `m7b5 | ø | ø7 | Ø | Ø7 | mi7(b5)`
  - `dim7`: `dim7 | °7 | º7 | o7 | dim | ° | º` (fără 7 se citește tot dim7, ca în grile; triada dim pură nu are rând)
  - `6`: `6`; `6/9`: `6/9 | 69`; `m6`: `m6 | -6`; `mMaj7`: `mMaj7 | m(maj7) | -Δ | -Δ7 | mM7`; `sus4`: `sus4 | sus`; `7sus4`: `7sus4 | 7sus`
  - triade: `maj` (fără sufix: `C`, `C/E`; și `maj | M | MA | ma`), `m` (`m | - | min | mi | MI`); `+` / `aug` (triada mărită) când primește rând
  - **respinse**: `7+` și `+7` — înseamnă maj7 în convenția europeană și 7#5 în cea americană, deci dau eroare; se scrie `maj7` / `Δ` și `7#5`. `-7` rămâne m7, ca în Real Book.
  - Se alege **cea mai lungă potrivire** din aliasuri, ca `m7b5` să nu fie citit `m7` + rest și `C6/9` să nu fie citit `C6` cu bas. `Δ` (U+0394) și `∆` (U+2206), `°` și `º`, `ø` și `Ø` arată la fel în majoritatea fonturilor, de aceea sunt toate acceptate.
- prescurtări: o extensie fără 7 implică 7-ul calității — `C9`, `C13` = `C7` + 9 / 13; `Cm9`, `Cm11` = `Cm7` + 9 / 11; `Cmaj9` = `Cmaj7` + 9; `Calt` = `C7alt`.
- extensions: `9 | b9 | #9 | 11 | #11 | 13 | b13 | alt`, opțional în paranteze, separate prin virgulă sau spațiu (`C7(b9,#11)`) — `alt` = {b9, #9, #11, b13}. Pe dominante, `b5` și `#5` sunt aliasuri pentru `#11` și `b13` (același pitch class).
- extensiile scrise explicit schimbă acordul:
  - orice extensie scrisă devine obligatorie (intră în `required`) și face wrong celelalte forme ale aceleiași trepte: `b9` → 9 wrong (#9 rămâne disponibil, ambele sunt în gama semiton-ton); `#9` → 9 wrong (b9 rămâne); `9` → b9 și #9 wrong; `b13` → 13 wrong; `13` → b13 wrong
  - `11` scris explicit (`C11`) iese din avoid și devine obligatoriu
  - o extensie care nu e în tensiunile calității dă eroare (`Cmaj7b9`); `b5`, `#5` și `alt` sunt valide doar pe `7`
  - `#5` pe dominantă (`7#5`) = b13 obligatoriu, 13 și 5 naturale wrong
  - `alt` → b13 obligatoriu (nucleul mărit 3 #5 b7, cum l-a descris Edi); 5, 9 și 13 naturale wrong; b9, #9 și #11 rămân disponibile, ca în grile. Decis.
- ieșire (toate listele sunt pitch class-uri, în ordinea treptelor):

```js
{
  symbol, root, rootPc, quality, extensions,
  chordTones, guideTones, required,
  tensions: { available, altered },
  avoid, caution,
  degrees,          // degrees[pc] = eticheta treptei ('b9'), sau null = wrong note
  bass, bassPc,     // null fără slash
}
```

Chord tones, tensiuni și note obligatorii (jazz standard). Tabelul trăiește în cod ca date (`QUALITIES` din `chords.js`); cele două se actualizează împreună.

| quality | chord tones | required | tensiuni disponibile | avoid | caution |
|---|---|---|---|---|---|
| maj7 | 1 3 5 7 | 3 7 | 9, #11, 13 | 11 (semiton peste 3) | — |
| 6 | 1 3 5 6 | 3 6 | 9, #11, 7 | 11 | — |
| 6/9 | 1 3 5 6 9 | 3 6 9 | #11, 7 | 11 | — |
| m7 | 1 b3 5 b7 | b3 b7 | 9, 11, 13 | — | 13 când funcția e ii (anticipează terța lui V); nimic când e i |
| m6 | 1 b3 5 6 | b3 6 | 9, 11, 7 | — | — |
| mMaj7 | 1 b3 5 7 | b3 7 | 9, 11, 13 | — | — |
| 7 (dominantă) | 1 3 5 b7 | 3 b7 | 9, 13 + alterate b9, #9, #11, b13 | 11 | — |
| 7sus4 | 1 4 5 b7 | 4 b7 | 9, 13 | 3 (dacă nu e cerut explicit) | — |
| m7b5 | 1 b3 b5 b7 | b3 b5 b7 | 9, 11, b13 | — | 9 (în context tonal) |
| dim7 | 1 b3 b5 bb7 | b3 b5 bb7 | 9, 11, b13, 7 (= tensiune ton întreg peste fiecare chord tone) | — | — |
| sus4 | 1 4 5 | 4 | 9, 13, b7 | 3 | — |
| maj (triadă) | 1 3 5 | 3 | 7, 9, #11, 13 | 11 | — |
| m (triadă) | 1 b3 5 | b3 | b7, 7, 9, 11, 13 | — | — |

Etichetele treptelor din tabel, din cod și de pe ecran urmează convenția jazz în engleză (Berklee / Real Book): `7` = septimă mare, `b7` = septimă mică, `bb7` = septimă micșorată — decis, pentru că simbolurile de acord (`C7`, `Cmaj7`) și README-ul urmează aceeași convenție. Edi citește intervalele în convenția europeană (`7` = mică, `7+` = mare, `-7` = micșorată); notele sunt aceleași, doar eticheta diferă. O opțiune de afișare europeană (o tabelă de etichete în UI) se poate adăuga oricând, fără să atingă logica.

Regulile tabelului:

- **Listele sunt complete.** Pentru o calitate din tabel, orice pitch class care nu e chord tone, tensiune (disponibilă sau alterată) sau avoid e **wrong note** (ex. Db pe Cmaj7 e wrong, nu avoid).
- **Caution e subset al tensiunilor disponibile**: nota e validă (inclusiv ca notă de melodie în candidați și la validare), iar analizorul o marchează doar informativ.
- **Sus vs 11**: sus = terța e înlocuită cu 2 sau 4, deci e o calitate separată (`7sus4`), unde nota e treapta 4 și e chord tone. Cu terța prezentă, aceeași notă e 11 (extensie în sus) și pe maj7 și 7 e avoid.
- **Funcția lui m7** vine din context: `parseChord(symbol, { minorFunction: 'ii' | 'i' })`, implicit `ii`. În drill acordurile sunt izolate, deci ii; din Faza 2 progresia știe treapta. Enum-ul rămâne extensibil: în tonal, iii are b9 și b13 avoid, vi are b13 avoid — se adaugă când `analysis.js` știe treapta.
- Nu există regulă generică de avoid: tabelul e singura sursă. O calitate fără rând nu se parsează.
- Fără rând încă: `+` (triada mărită), amânat. `7#5` nu e calitate separată: e `7` + extensia `#5` (vezi mai sus).

### Clasificarea voicing-ului (`analyzer.js`)

Intrare: notele cântate (MIDI, sortate) + acordul parsat. Ieșire ordonată după importanță:

1. **Corectitudine**: lipsește o notă din `required` (3 și 7 sau echivalentele din tabel: 6 pe `6`, 4 pe `7sus4`, bb7 pe `dim7`, plus extensiile obligatorii, ca b9 din `C7b9`) → avertisment principal. Root lipsă e OK (rootless e un scop), se raportează doar ca informație.
2. **Note străine**: pitch class-uri care nu sunt nici chord tones, nici tensiuni → „wrong note". Note în listele de avoid → „avoid note". „Caution" → nivel informativ.
3. **Low interval limits**: pentru fiecare pereche de note adiacente se compară **nota de jos** a perechii cu pragul, strict `<`: sub C3 (MIDI 48), 2m, 2M și 3m sunt semnalate ca „muddy"; sub G2 (43) și 3M. Pragurile stau într-un tabel de date pe interval (configurabil), ca valorile clasice să poată fi puse mai târziu fără să schimbăm codul.
4. **Dublări**: același pitch class de mai multe ori (excepție root/5 în bas) → informativ.
5. **Tipul de voicing**, detectat în ordinea asta (prima potrivire câștigă):
   - **shell**: doar {3, 7} sau {3, 7} + root (2–3 note)
   - **rootless A**: 4 note, de jos în sus 3-5-7-9; pe dominantă slotul 2 acceptă 5, 13 sau b13 și slotul 4 acceptă 9, b9 sau #9 (G7alt în forma A e B Eb F Ab)
   - **rootless B**: 4 note, de jos în sus 7-9-3-5; pe dominantă slotul 2 acceptă 9, b9 sau #9 și slotul 4 acceptă 5, 13 sau b13
   - **quartal**: ≥ 3 note, toate intervalele adiacente sunt 4P sau 4A, cu două limite strânse pe 2026-09-20 (decizie Edi): **cel mult o 4A** în tot voicing-ul și **cel mult o 3M, numai ca interval de sus**, de la 4 note în sus. Motivele: două 4A adiacente fac exact o octavă, deci nota extremă e dublată — o formă simetrică, nu un voicing quartal (F3 B3 F4 B4 ieșea „quartal"); terța e capacul din „So What", iar mai jos voicing-ul se citește din terța lui și drop-urile îl numesc mai bine (D3 G3 B3 E4 = drop 2 din G3 B3 D4 E4; C3 E3 A3 D4 la fel); cu 3 note, 4P + 3M e o triadă în inversiunea a doua (D-G-B). Se verifică **înaintea** drop-urilor: orice 4 cvarte suprapuse sunt și drop 2 al unei poziții strânse cu o secundă în ea (D3 G3 C4 F4 → G3 C4 D4 F4), iar un pianist le numește quartal
   - **drop 2**: 4 note; dacă ridici **nota cea mai de jos** cu o octavă obții poziție strânsă (întindere ≤ 12 semitonuri) și nota ridicată ajunge a doua de sus. Exemplu: G3 C4 E4 B4 → C4 E4 G4 B4, G e a doua de sus
   - **drop 3**: idem, dar nota ridicată ajunge a treia de sus. Exemplu: E3 C4 G4 B4 → C4 E4 G4 B4, E e a treia de sus
   - **drop 2&4**: ridici cele două note de jos cu o octavă, obții poziție strânsă și ele ajung a doua și a patra de sus. Exemplu: C3 G3 E4 B4 → C4 E4 G4 B4
   - Regula e inversul derivării (drop 2 = din poziția strânsă cobori a doua voce de sus cu o octavă, deci ea devine nota cea mai de jos); a ridica „a doua de sus" din voicing-ul cântat nu dă niciodată poziție strânsă. Consecință de știut: C3 B3 E4 G4 e drop 3 al inversiunii a treia, nu spread
   - **upper structure triad**: pe dominantă, cele 3 note de sus formează o triadă majoră/minoră a cărei fundamentală nu e root-ul acordului, deasupra unei baze de 3/7
   - **close**: toate notele într-o octavă (și nu s-a potrivit nimic mai sus)
   - **spread / open**: orice altceva
   - **Bas separat**: dacă nota cea mai de jos e root sau 5, se clasifică și restul notelor fără ea; dacă restul primește un tip mai specific decât close/spread, se raportează `bass: 'root' | '5'` + tipul restului (C2 + E4 G4 B4 D5 → „root + rootless A", cum se compă fără basist). C E G B strâns rămâne close, pentru că restul (E G B) nu se potrivește nicăieri.
6. **Voice leading** față de voicing-ul anterior (doar în modul progresie), în `theory/voiceLeading.js`, separat de analizor: `compareVoicings(previous, next)` potrivește notele cu **deplasare totală minimă** — pentru note pe o singură dimensiune (numere MIDI) asta e potrivirea în ordine, fără încrucișări (nu greedy, cum zicea planul inițial: e mai simplă și exactă); la mărimi diferite se încearcă toate submulțimile voicing-ului mai mare. Raportează perechile, suma deplasărilor în semitonuri, notele comune, notele nepotrivite și un rating după media pe voce: `smooth` ≤ 1.5, `ok` ≤ 3, altfel `jumpy` (praguri de ajustat după studiu). `scoreProgression(steps)` însumează pe progresie; un salt între două voicings „spread" e schimbare de registru intenționată și nu intră în rating.

Ieșirea analizorului e un obiect JSON simplu; UI-ul îl randează, iar în Faza 3a exact același obiect intră în promptul spre Claude:

```js
analyzeVoicing(notes, chord, { limits = LOW_INTERVAL_LIMITS } = {}) → {
  notes,                    // MIDI sortate
  roles,                    // per notă: { midi, pc, role, degree, caution }, prin classifyPc
  missing, hasRoot,         // pc-uri obligatorii lipsă; root lipsă e doar informativ
  wrong, avoid, caution,    // pc-uri
  muddy,                    // [{ lower, upper, semitones }]
  doublings,                // pc-uri dublate, în afara root/5 din bas
  voicing: { type, bass, detail },   // type: shell | rootless-A | rootless-B | drop-2 | drop-3 | drop-2-4 | quartal | upper-structure | close | spread; bass: null | 'root' | '5'; detail: triada din UST
  messages,                 // [{ level: 'warning' | 'info', code, text }], în ordinea de mai sus
}
```

`LOW_INTERVAL_LIMITS` e o listă de date `{ below, semitones }`, configurabilă prin opțiuni. Voice leading-ul (Faza 2) va fi o funcție separată, `compareVoicings(previous, next)`, ca analiza unui acord izolat să rămână pură.
