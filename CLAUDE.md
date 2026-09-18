# Voicing Lab — CLAUDE.md

Antrenor de voicings și reharmonizare pentru pianiști de jazz. Conectezi clapa (Yamaha Genos) prin USB-MIDI la browser, aplicația îți cere un acord, tu îl cânți, iar ea îți spune instant ce ai cântat (tip de voicing, tensiuni, note evitate, calitatea voice leading-ului). În fazele următoare, Claude propune alternative și reharmonizări pe care le auzi direct pe Genos prin MIDI out.

Numele e **Voicing Lab**, final din Faza 0: repo `EdiTnss/Voicing-Lab` (cu majuscule, cum l-a creat Edi), GitHub Pages pe `editnss.github.io/Voicing-Lab`. Repo-ul nu se mai redenumește, pentru că GitHub Pages nu face redirect după redenumire și link-ul de demo ar muri. Verificarea `Origin` din Worker nu depinde de numele repo-ului: header-ul `Origin` conține doar `https://editnss.github.io`, fără cale. `package.json` păstrează `"name": "voicing-lab"` (npm cere litere mici). Numele rămâne consecvent în README, `<title>` și `package.json`.

Repo-ul e **privat până la Faza 4**: portofoliul are valoare abia când e prezentabil (README, demo, teste). Atunci trece pe public, pentru că GitHub Pages pe cont gratuit funcționează doar pe repo-uri publice (alternativa e GitHub Pro). La trecere devine vizibil **tot istoricul**, deci regula „niciun secret în repo" se aplică de la primul commit. Licență: **niciuna deocamdată** (toate drepturile rezervate; codul se poate citi, nu refolosi); se decide la publicare, `package.json` are `"license": "UNLICENSED"` până atunci.

## Scop dublu

1. **Studiu**: Edi are 2+ ore/zi de studiu; aplicația e unealta lui de comping/voicings, deci trebuie să fie utilă din prima săptămână, nu la final.
2. **Portofoliu** pentru angajare ca AI/automation engineer: repo public, cod curat, teste, README în engleză cu demo video, integrare LLM reală (Faza 3a/3b) și un „demo mode" fără clapă MIDI ca să poată încerca oricine.

Ambele scopuri sunt egale. Dacă o decizie tehnică ajută portofoliul dar strică sesiunea de studiu (latență, fricțiune la pornire), pierde portofoliul.

## Reguli de colaborare

- Suntem parteneri pe proiect. Când Edi greșește, Claude explică de ce și dă varianta corectă — fără aprobare reflexă.
- Claude explică pe scurt fiecare concept nou de programare când apare prima dată (ES modules, event listeners, Web MIDI, teste, Workers), cu logică pas cu pas, nu doar concluzia.
- Claude propune soluții mai bune când le vede, chiar dacă nu a fost întrebat.
- Cererile ambigue primesc o întrebare de clarificare, nu o presupunere. Pașii mari se confirmă înainte de execuție.
- Edi e pianist de jazz avansat: teoria muzicală nu se explică, se implementează corect. Dacă Claude nu e sigur de o regulă de teorie (ex. ce tensiuni sunt disponibile pe un acord), întreabă, nu inventează.

## Stack și constrângeri

- **Vanilla JS**, ES modules (`<script type="module">`), fără framework, fără bundler, **zero dependențe npm în aplicație**.
- **Browser țintă**: Chrome/Edge (Web MIDI). Safari nu suportă Web MIDI; nu ne adaptăm pentru el, dar demo mode (Faza 4) trebuie să meargă oriunde.
- **Dev server**: ES modules nu se încarcă de pe `file://` (CORS), deci pornim cu `npx serve .` sau extensia Live Server din VS Code. `localhost` e context securizat, deci Web MIDI funcționează.
- **Teste**: `node --test` (test runner-ul încorporat în Node, fără instalare; Node ≥ 22 — 20 a ieșit din suport în aprilie 2026), pornit cu `npm test`. CI pe GitHub Actions rulează `npm test` pe Node 22 și 24 la fiecare push, cu badge în README; GitHub pornește o singură rulare per push, pe ultimul commit, deci commit-urile `test:` roșii dinaintea `feat:` nu produc rulări roșii dacă se împing împreună. `package.json` există doar pentru `"type": "module"` (Node tratează `.js` ca ES modules pe orice versiune) și scriptul de test — **fără nicio dependență**. Modulele din `src/theory/` sunt JS pur, fără DOM, exact ca să poată fi testate în Node.
- **Deploy**: GitHub Pages (static, HTTPS → Web MIDI merge). Proxy-ul AI din Faza 3a e separat, pe Cloudflare Workers.
- **Cheia Anthropic nu ajunge niciodată în frontend sau în repo.** Doar în variabilele de mediu ale Worker-ului (local în `worker/.dev.vars`, ignorat de git).
- Singura excepție de la „zero dependențe": `worker/` are propriul `package.json` cu `wrangler` ca dev dependency, pentru rulare locală și deploy. Rămâne izolat în folderul lui; aplicația din `src/` nu importă nimic din npm.
- **Limbă**: cod, comentarii, commit-uri, README, UI — engleză (recrutorii citesc repo-ul). Acest fișier și discuțiile — română.
- Commit-uri mici, mesaje în stil `feat:`, `fix:`, `test:`, `docs:`.
- Audio: MIDI out spre Genos e sunetul principal. Web Audio (sintetizator simplu) doar ca fallback pentru demo mode.

## Structura repo-ului

```
index.html                 pagina aplicației
styles.css                 stilurile paginii (folderul styles/ e pentru profilurile JSON, Faza 5)
midi-test.html             Faza 0 — diagnostic MIDI in/out (rămâne în repo ca tool)
src/
  app.js                   singurul loc care leagă theory, midi și ui
  midi/capture.js          regulile de snapshot (debounce, staccato, „next"), logică pură, testată
  midi/input.js            requestMIDIAccess, toate intrările/canalele, parseMidiMessage
  midi/recorder.js         înregistrează melodia cântată în timp muzical (bar, beat, durată în timpi), pozițiile vin din metronom; testat
  midi/output.js           trimite voicings spre Genos (Faza 2)
  theory/notes.js          MIDI number ↔ nume, pitch class, intervale
  theory/chords.js         parser de chord symbol → chord tones, tensiuni, note evitate
  theory/analyzer.js       clasifică voicing-ul, low interval limits
  theory/voiceLeading.js   compareVoicings, scoreProgression (Faza 2)
  theory/progressions.js   biblioteca de progresii generice + parser de grilă text
  theory/timing.js         timp ↔ (bar, beat), cuantizare; folosit de metronom, recorder și player
  theory/voicings.js       sugestii de voicing din șabloane, în registru, ordonate după voice leading (Faza 2; sămânța lui realize.js)
  audio/metronome.js       metronom Web Audio cu lookahead, count-in, onBeat, positionOf(performance.now)
  ui/session.js            o trecere prin progresie: sloturi, locate(bar, beat), record, summary (testat)
  ui/stats.js              statistici: încercări, curate, probleme pe calitate; sesiune + cumulativ în localStorage (testat)
  theory/piece.js          modelul unei piese (grilă + melodie), cuantizare, validare reharm
  theory/analysis.js       analiză armonică: trepte, funcții, cadențe, fraze, note-țintă (Faza 3a)
  theory/candidates.js     generează acordurile compatibile cu melodia, etichetate pe tehnică (Faza 3a)
  theory/scoring.js        scoruri pentru un reharm: clash, bas, densitate, coerență (Faza 3a)
  theory/realize.js        simboluri → voicings cu voice leading, bas și melodie (Faza 3b)
  ui/drill.js              starea drill-ului: setări, acordul următor, localStorage
  ui/keyboard.js           claviatura SVG, colorată pe rol
  ui/render.js             randare DOM, fără logică de teorie aici
  ai/client.js             apel spre proxy (Faza 3a)
  ai/prompts.js            toate prompturile, versionate (Faza 3a)
  ai/explain.js            explain & suggest din drill: input, validarea sugestiilor prin analizor (Faza 3a)
  ai/pipeline.js           execute: candidați → apel → validare → scoruri (Faza 3a); plan și review (Faza 3b)
  audio/synth.js           fallback Web Audio pentru demo mode (Faza 4)
styles/*.json              profiluri de stil ca date (Faza 5)
eval/pieces/*.json         piese de test din domeniul public (Faza 5)
eval/run.js                rulează pipeline-ul pe piesele de test și raportează metrici (Faza 5)
worker/                    Cloudflare Worker — proxy Anthropic, fără logică (Faza 3a)
test/                      *.test.js, rulate cu node --test
.github/workflows/test.yml CI: npm test pe Node 22 și 24, la fiecare push (Faza 1)
package.json               fără dependențe: "type": "module" + npm test
README.md                  engleză, cu GIF/video demo
CLAUDE.md                  acest fișier, în repo (public odată cu repo-ul, la Faza 4)
```

Regula de dependență: `theory/` nu importă nimic din `midi/`, `ui/` sau `ai/`. `midi/` nu știe de UI. `ai/` importă din `theory/` (pentru analiză și candidați) dar nu invers. UI-ul e singurul care le leagă. Worker-ul nu conține logică muzicală și nu conține prompturi — doar adaugă cheia și limitează cererile; prompturile stau în `ai/prompts.js`, vizibile în repo.

## Cum funcționează captura (snapshot de voicing)

1. `input.js` ține un `Set` cu notele apăsate acum (note-on adaugă, note-off / velocity 0 scoate).
2. La fiecare **note-on**, resetează un timer de ~300 ms. Note-off scoate nota din set, dar nu repornește timer-ul; în schimb, primul note-off de după ultimul note-on reține o copie a setului de dinaintea lui. Când timer-ul expiră, emite un eveniment `voicing` cu notele sortate crescător: setul curent, dacă are ≥ 2 note; altfel copia reținută, dacă are ≥ 2 note; altfel nimic.
3. Motivul: când te așezi pe un acord, notele nu ajung simultan; fără debounce am analiza și stările intermediare. Note-off nu repornește timer-ul pentru că nici degetele nu se ridică simultan: altfel analizorul ar primi, după 300 ms, un acord parțial și ar raporta „lipsește 7" pe un acord cântat corect. Copia de dinaintea primului note-off acoperă acordurile staccato (apăsate și eliberate sub 300 ms), care altfel n-ar produce niciun snapshot; setul curent are prioritate ca o notă greșită corectată rapid să nu fie raportată. 300 ms e punct de plecare, se face configurabil.
4. Nota de „next" (o notă foarte gravă, configurabilă) e interceptată înainte să intre în set, ca să nu ajungă în analiza acordului ținut.
5. Ascultăm pe toate canalele. Genos poate transmite părțile pe canale diferite; filtrăm doar dacă apar note nedorite (ex. de la acompaniamentul auto — de dezactivat din Genos în timpul studiului).

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
   - **quartal**: ≥ 3 note, toate intervalele adiacente sunt 4P sau 4A; o singură 3M tolerată (ca în voicing-urile „So What"), dar doar de la 4 note în sus — cu 3 note, 4P + 3M e o triadă în inversiunea a doua (D-G-B). Se verifică **înaintea** drop-urilor: orice 4 cvarte suprapuse sunt și drop 2 al unei poziții strânse cu o secundă în ea (D3 G3 C4 F4 → G3 C4 D4 F4), iar un pianist le numește quartal
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

## Specificația reharmonizării unei piese

Principiu: **melodia e fixă, acordurile se schimbă.** Claude propune, `piece.js` verifică. Un acord propus e acceptat doar dacă fiecare notă melodică de deasupra lui e chord tone sau tensiune disponibilă.

### Modelul unei piese (`piece.js`)

```js
{
  title: "My Tune",            // doar local, nu se salvează în repo
  key: "F",                    // tonalitatea declarată de utilizator
  timeSignature: [4, 4],
  tempo: 120,
  bars: [
    {
      chords: [{ symbol: "Gm7", beat: 1 }, { symbol: "C7", beat: 3 }],   // beat = 1-based, poate fi 1.5 etc.
      melody: [{ midi: 65, beat: 1, duration: 2 }, { midi: 67, beat: 3, duration: 2 }]
    }
  ]
}
```

Grila vine din inputul text al Fazei 2 (`| Gm7 C7 | Fmaj7 | % |`): acordurile dintr-o măsură împart timpii egal când numărul lor divide măsura (1, 2, 4 în 4/4; 1, 3 în 3/4), altfel `GridParseError` cu numărul măsurii — durate explicite se adaugă când va fi nevoie; `%` = repetă măsura anterioară; `formatGrid` face drumul invers. Biblioteca (`PROGRESSIONS`) e scrisă în C ca text de grilă și se transpune cu ortografia tonalității-țintă (bemoli în F, Bb, Eb…, diezi în G, D, A, E, B, F#; niciodată Cb/Fb/E#/B# pe fundamentale). Melodia vine din `recorder.js`.

### Înregistrarea melodiei (`recorder.js`, Faza 2)

1. Utilizatorul pornește metronomul pe grilă (o măsură de count-in) și cântă melodia o singură dată, pe mâna dreaptă.
2. Fiecare note-on e marcat cu `event.timeStamp` al evenimentului Web MIDI (ceasul `performance.now()`, momentul real al notei, nu momentul în care rulează handler-ul), convertit în ceasul metronomului (`AudioContext`) printr-un offset calculat o dată la pornire cu `AudioContext.getOutputTimestamp()`. Nu `Date.now()` — altfel se decalează.
3. Timpul se transformă în `(bar, beat)` și se cuantizează la optime (configurabil la triolete/șaisprezecimi mai târziu). Duration = până la note-off sau până la următoarea notă.
4. Note foarte scurte (< 60 ms) și ornamentele sub o optime se păstrează în datele brute dar nu intră în melodia „structurală" trimisă la reharm — acolo contează nota de pe fiecare timp tare și notele ținute.
5. Dacă o măsură rămâne fără note (pauză), se marchează `melody: []` — orice acord e valid acolo.

Testele pentru cuantizare: timp → (bar, beat) la 4/4 și 3/4, la tempo-uri diferite, cu count-in.

### Arhitectura: codul garantează corectitudinea, Claude aduce gustul

Un LLM nu aude și teoria lui nu e infailibilă, deci nu îl lăsăm să inventeze acorduri. Fluxul e:

```
piece ──► analysis.js ──► candidates.js ──► [Claude: plan] ──► [Claude: execute] ──► scoring.js ──► [Claude: review] ──► scoring.js ──► realize.js ──► Genos
          (determinist)   (determinist)      (gust, narativ)    (alege din meniu)     (determinist)   (critic separat)   (determinist)   (voicings reale)
```

Claude alege doar dintre candidați generați de cod (nivelul „constrained selection"), deci un acord invalid față de melodie nu poate apărea. Validarea din `piece.js` rămâne ca plasă de siguranță (dacă răspunsul JSON e stricat sau referă un id inexistent).

### 1. Analiza armonică (`analysis.js`, Faza 3a, deterministă)

Input: `piece`. Output: aceeași structură, cu un obiect `analysis` pe piesă și pe măsură.

Pe piesă:
- `key` (declarată de utilizator; dacă lipsește, estimare simplă din acordul final + primul acord, marcată `guessed: true`)
- `phrases`: liste de măsuri, implicit la 4 măsuri, ajustabile de utilizator în UI (AABA la 32 de măsuri e cazul tipic)

Pe fiecare slot de acord:
- `roman`: treaptă relativă la tonalitate, cu dominante secundare (`V7/ii`), împrumuturi (`bVI`, `iv`) și „?" când nu se încadrează
- `function`: `T` / `S` / `D` / `passing`
- `cadence`: `true` când slotul e o dominantă (V, secundară sau tritonalul ei) care rezolvă pe următorul slot cu o cvintă în jos / semiton, **sau** bVII7 care rezolvă pe I (backdoor). Acordurile de pe tonică nu sunt niciodată dominante secundare și nu fac cadență: în blues, `I7` din măsura 4 rămâne `I7` (T), nu `V7/IV` — simplificare asumată.
- Convenția treptelor: gradul din distanța de litere față de tonică, alterația din distanța de pitch class față de treapta diatonică (Db în C = bII, C# = #I); în minor, referința e minorul natural, cu excepția sensibilei (B în C minor = vii°, nu #vii). Minuscule pentru calitățile cu terță mică, `ø7` / `°` pentru cele diminuate, restul simbolului păstrat ca sufix (`ii7`, `V7alt`, `Imaj7`, `bVII7`, `#i°`). Funcții: diatonice după treaptă (T = I, iii, vi; S = ii, IV; D = V, vii; la fel în minor), dominantele cu cadență = D, dim7 cromatic = passing, împrumuturile bII / bIII / bVI / bVII fără cadență = S, altfel `?`.
- `guideTones`: din parser (3 și 7 ale acordului original, sau echivalentele: 3 și 6 pe `6`, 4 și b7 pe `7sus4`)
- `melody.structural`: notele-țintă — cele de pe timpii 1 și 3 (în 4/4) și orice notă ținută ≥ 1 timp; celelalte sunt `passing`
- `melody.relation` per notă structurală: `chordTone` / `tension` / `avoid` / `outside`

Testele: piese de 8 măsuri construite manual (ii-V-I cu dominantă secundară, blues, un pasaj modal), verificate treaptă cu treaptă.

### 2. Candidații (`candidates.js`, Faza 3a, determinist)

Pentru fiecare slot: enumeră 12 fundamentale × calitățile din tabelul analizorului; păstrează un acord doar dacă **fiecare notă structurală** a melodiei de pe slot e chord tone sau tensiune disponibilă (notele `passing` nu se verifică). Apoi etichetează fiecare candidat cu tehnica față de original și context:

| technique | regulă de detecție |
|---|---|
| `original` | acordul neschimbat (întotdeauna primul candidat) |
| `quality-change` | aceeași fundamentală, altă calitate (maj7 → 6/9, 7 → 7sus4, m7 → m6, 7 → 7alt) |
| `tritone-sub` | dom7 cu fundamentala la triton față de un dom7 original |
| `secondary-dominant` | dom7 cu fundamentala la cvintă deasupra acordului din slotul următor |
| `related-ii` | slotul se împarte în două: m7 (sau m7b5) la cvintă deasupra dominantei + dominanta; fiecare jumătate verificată separat cu melodia |
| `backdoor` | bVII7 care rezolvă pe I (sau iv → bVII7 → I) |
| `diminished-passing` | dim7 pe fundamentala cromatică dintre două acorduri la un ton distanță |
| `chromatic-approach` | dom7 sau m7 la un semiton deasupra/dedesubtul acordului următor |
| `modal-interchange` | acord împrumutat din minorul/majorul paralel: `iv`, `bVI`, `bVII`, `bIII`, `iiø` |
| `coltrane` | pe două sloturi consecutive: ciclu de terțe mari spre țintă (3 tonalități) |
| `sus-color` | 7sus4 / sus2 în locul dominantei, aceeași fundamentală |
| `other` | valid față de melodie, fără etichetă; permis doar în stilul `free`, intensitate `heavy` |

Fiecare candidat: `{ id, chords: [{ symbol, beat }], technique, bassStepToNext, warnings }` — `bassStepToNext` = distanța în semitonuri de la fundamentala candidatului la cea a slotului următor (pentru scorul liniei de bas), `warnings` = notele melodice care cad pe avoid.

Limită: maximum 12 candidați pe slot, ordonați: `original`, apoi după prioritatea tehnicilor din profilul de stil, apoi după `bassStepToNext` mic. Ce nu intră în 12 nu ajunge la Claude — modelul nu trebuie să vadă 90 de opțiuni pe măsură. **Selecția e round-robin pe tehnici** (primul candidat al fiecărei tehnici în ordinea de prioritate, apoi al doilea al fiecăreia…), altfel cele 10 schimbări de calitate pe aceeași fundamentală ar umple meniul.

Precizări din implementare (`candidates.js`): calitățile enumerate sunt `maj7, 6/9, m7, m6, mMaj7, 7, 7alt, 7b9, 7sus4, ø7, °`; o notă-țintă pe o notă avoid **păstrează** candidatul cu `warning` (decizie Edi), doar notele „outside" resping; precedența etichetelor: sus-color → backdoor → tritone-sub → secondary-dominant → diminished-passing → chromatic-approach → modal-interchange → quality-change → other (Dm7 → D7 înainte de G7 e `secondary-dominant`, nu `quality-change`; Fmaj7 → Fm7 e `modal-interchange`); dim de trecere se ortografiază în direcția mersului (C#° urcând, Db° coborând); `related-ii` cere ≥ 2 timpi și pune `ø7` când ținta e minoră; `coltrane` acoperă două sloturi (`spans: 2`: `| Abmaj7 B7 | Emaj7 G7 |` spre Cmaj7) și, când e ales, slotul următor e sărit; fiecare candidat are `chords: [{ symbol, bar, beat }]`.

### 3. Pipeline-ul (`ai/pipeline.js`, Faza 3a = doar `execute`; Faza 3b = complet)

Toate apelurile trec prin `ai/client.js` → Worker → Anthropic. Prompturile stau în `ai/prompts.js` cu un `PROMPT_VERSION` pe fiecare (pentru evaluare, Faza 5). Fiecare apel cere JSON strict; răspunsul se parsează și se validează (schemă + id-uri existente) înainte de orice.

**Apelul `plan`** (Faza 3b). Input: rezumatul analizei (tonalitate, fraze, treptele și funcțiile pe măsuri, notele-țintă), stil, intensitate. Output:

```js
{ phrases: [ { bars: [1, 4], strategy: "Keep tonic area static, delay the resolution to bar 4 with a related ii-V", techniques: ["related-ii", "tritone-sub"] } ] }
```

Motivul: aranjorii lucrează pe fraze; un plan explicit dă coerență globală și e afișat utilizatorului ca explicație.

**Apelul `execute`** (Faza 3a). Input: planul (dacă există), stil, intensitate și, pentru fiecare slot, lista de candidați cu id-uri și tehnici. Output:

```js
{ bars: [ { bar: 1, slot: 1, candidateId: "b1s1-orig", why: "" }, { bar: 2, slot: 1, candidateId: "b2s1-tritone", why: "Db7 for G7: melody B is the #9, and the bass walks Db-C into bar 3" } ] }
```

Regulă strictă: `candidateId` trebuie să existe; orice altceva → slotul revine la `original`. Piesele peste 32 de măsuri se execută pe fraze, cu contextul frazei precedente (ultimele 2 acorduri alese) ca să nu rupă continuitatea.

**Scorurile** (`scoring.js`, determinist, după `execute` și după `review`):
- `clashes`: note structurale în afara chord tones ∪ tensiuni — trebuie 0 prin construcție; > 0 e bug
- `warnings`: note pe avoid
- `bassSmoothness`: media pe piesă a mișcării basului, unde semitonul, tonul și cvinta în jos costă puțin, salturile mari costă mult
- `density`: sloturi schimbate / total, comparat cu ținta intensității: `light` ≤ 25%, `medium` 40–60%, `heavy` ≥ 60%
- `maxRun`: cea mai lungă secvență de sloturi schimbate consecutiv (penalizare peste 4 la `light`/`medium`)
- `techniqueMix`: câte tehnici distincte s-au folosit (o singură tehnică repetată de 8 ori e monoton)

Precizări din implementare (`scoring.js`): `scoreReharm(analyzedPiece, chosen, { intensity })`, unde `chosen` = `[{ bar, slot, candidate }]` cu obiectul candidatului din `candidates.js` (sloturile absente rămân `original`; o alegere pe slotul acoperit de un `coltrane` e ignorată, iar cele două sloturi ale lui contează amândouă ca schimbate). `clashes` și `warnings` se recalculează din notele-țintă contra acordului activ (`classifyPc`), nu din `warnings`-urile candidaților — inclusiv pe jumătățile unui `related-ii`. Linia de bas: nota de după `/` sau fundamentala; costul unei mișcări după intervalul cel mai mic dintre note (0–6 semitonuri): unison, semiton și cvartă/cvintă 0, ton 0.25, terță mică 0.5, terță mare 0.75, triton 1; `bassSmoothness = 1 − media costurilor` (1 pentru un singur acord). `densityTarget` e `{ min, max }`, `maxRunOk` e mereu adevărat la `heavy`, `techniques` numără pe candidat (`{ 'tritone-sub': 2 }`). `resolveChoices(piece, chosen)` (acordul activ pe fiecare slot) e exportat pentru pipeline-ul din pasul 5.

**Apelul `review`** (Faza 3b). System prompt diferit: rol de aranjor exigent care verifică lucrarea unui coleg. Input: grila originală, grila propusă cu `why`-urile, planul, scorurile și, pentru fiecare slot, aceiași candidați. Output: `{ verdict: "...", changes: [ { bar, slot, candidateId, why } ] }`, maximum 4 schimbări. Codul le aplică, re-scorează, gata — o singură rundă de review (cost și latență), fără buclă.

**Intensitate și stil** (Faza 3a ca enum-uri, Faza 5 ca fișiere JSON):
- `intensity`: `light` / `medium` / `heavy`, cu țintele de densitate de mai sus; se transmite atât în prompt, cât și ca filtru: la `light`, candidații sunt doar `original`, `tritone-sub`, `related-ii`, `quality-change`
- `style`: în Faza 3a un enum (`tritone`, `chromatic-approach`, `coltrane`, `modal`, `free`) mapat pe o listă de tehnici prioritare; în Faza 5 devine profil JSON

Precizări din implementare (pasul 4, Worker + client + prompturi):
- **Worker** (`worker/src/index.js`, config în `worker/wrangler.jsonc`): corpul cererii e `{ action, system, messages, schema?, maxTokens?, effort? }`; Worker-ul răspunde la preflight CORS, acceptă doar `POST` de pe un `Origin` din `ALLOWED_ORIGINS` (403), limitează pe `CF-Connecting-IP` cu binding-ul oficial `ratelimits` (20 pe minut, 429), respinge corpuri peste 64 KB (413) și cereri malformate (400), apoi trimite spre Messages API cu cheia din `env.ANTHROPIC_API_KEY`, `MODEL` din config (`claude-opus-5`, gândire adaptivă implicită, fără `thinking` în cerere), `max_tokens` plafonat de `MAX_TOKENS_CAP` (implicit 4096), `output_config.format` = `json_schema` din `schema` și `effort` doar `low`/`medium`/`high`; răspunsul API-ului e întors ca atare, cu statusul lui. `action` e doar pentru log (JSON structurat, fără conținut). Handler-ul primește `fetch`-ul spre Anthropic ca opțiune, deci rulează integral sub `node --test` cu un `env` fals (`test/worker.test.js`). Apelul e `fetch` direct, fără SDK (decizie Edi: a doua dependență nu aducea nimic unui proxy).
- **Client** (`ai/client.js`): `createClient({ baseUrl, fetch })` → `call(action, { system, messages, schema, maxTokens, effort })` → `{ data, model, usage }` sau `AiError` cu `kind` ∈ `not-configured`, `network`, `forbidden`, `rate-limited`, `upstream`, `refusal`, `truncated`, `invalid-json`. JSON-ul e garantat de API prin structured outputs; `stop_reason: refusal` / `max_tokens` devin erori clare.
- **Prompturi** (`ai/prompts.js`): `PROMPTS.<nume> = { version, system, schema, build(input) }`, `PROMPT_VERSIONS` derivat. Schemele respectă subsetul acceptat de structured outputs: `additionalProperties: false` cu toate proprietățile `required`, `enum` permis, fără `minItems` / `minimum` / `minLength` (limitele se verifică în cod; testul `prompts.test.js` le refuză). `explain` primește acordul ca trepte → nume de note (chord tones, tensiuni, avoid), registrul și analiza a ce s-a cântat; `label` e un enum din tipurile analizorului. `execute` (folosit în pasul 5) primește tonalitatea, stilul, intensitatea cu ținta de densitate, frazele și, pe slot, originalul cu treaptă/funcție/cadență, notele-țintă cu relația lor și candidații `{ id, chords, technique, spans?, avoidWarnings? }`.
- **Explain** (`ai/explain.js`): o sugestie e acceptată doar dacă are ≥ 2 note în registru (E2–A4), nu e ce s-a cântat, nu e duplicat, trece prin `analyzeVoicing` fără niciun `warning` (missing / wrong / avoid / muddy) și tipul detectat e exact `label`-ul promis — DoD-ul (1) al Fazei 3a, ca test. Sugestiile respinse se afișează cu motivul. `effort` implicit `low`, `maxTokens` 4096.
- **UI**: URL-ul proxy-ului e o setare persistată (`proxyUrl`, doar `http(s)`; gol = funcția e oprită); buton „Ask Claude" / tasta A în drill, sugestiile cu Play sau tastele 1 / 2, conturate pe claviatură; blocul rămâne pe ecran la aceeași acord, ca voicing-ul cântat să fie comparat cu eticheta.

Precizări din implementare (pasul 5, pipeline-ul `execute`):
- **`ai/pipeline.js`**: `reharmonize(client, piece, { style, intensity, maxPerSlot, maxTokens, effort, candidates })` → `{ analyzed, candidates, slots, chosen, scores, grid, originalGrid, gridParses, issues, problems, repairs, model, usage, promptVersion }`. Un id scurtat de model (`b2s1-Ab7` în loc de `b2s1-chromatic-approach-Ab7`) se recuperează după simbolurile acordului, dacă exact un candidat al slotului le are: garanția rămâne intactă, pentru că acordul tot din meniu vine. Recuperările intră în `repairs`, nu în `problems` (semnal pentru evaluarea din Faza 5). Opțiunea `candidates` înlocuiește meniul generat (o folosește lock & regenerate din Faza 5 și testele). Singurul motiv de respingere a promisiunii e eroarea de apel; tot ce greșește modelul intră în `problems` și costă slotul, nu rularea: id inexistent, slot răspuns de două ori, intrare fără coordonate, slot inexistent, alegere pe un slot deja acoperit de un candidat pe două sloturi.
- **Plasa de siguranță** (`piece.js`): `checkMelody(piece, sequence)` verifică fiecare notă-țintă contra acordului care sună sub ea și e acum **singura** sursă de adevăr (o folosește și `scoring.js`, care nu-și mai ține propria copie); `validateReharm(piece, slots)` → `{ issues, warnings, rejects, ok }`, unde o notă avoid e warning, iar o notă „outside" respinge slotul care a pus acordul acolo **și** sloturile acoperite de el. Pipeline-ul scoate alegerile respinse, re-rezolvă și abia apoi calculează scorurile, deci scorul descrie mereu grila afișată.
- **Înapoi în text**: acordurile dintr-o măsură de grilă împart măsura egal, deci pipeline-ul le desfășoară la cea mai grosieră diviziune care le cuprinde onset-urile (1, 2 sau 4 în 4/4; 1 sau 3 în 3/4) — o măsură cu Dm7 la 1, Dm7 la 3 și G7 la 4 se scrie `| Dm7 Dm7 Dm7 G7 |`. Dacă un acord cade între diviziuni (related-ii în 3/4 ar pica pe timpul 2,5), grila nu se poate scrie ca text: `gridParses: false`, iar butonul „Practise the reharm" e dezactivat cu explicație.
- **UI**: tab nou **Reharm** (decizie Edi), care ia piesa curentă din Progression (grilă + melodie înregistrată; fără melodie spune explicit că orice acord se potrivește). Stil și intensitate ca liste, buton Reharmonize, cele două grile una sub alta cu măsurile schimbate evidențiate (galben = notă avoid, roșu = respinsă de validator), `why` la hover și la click, scorurile pe un rând, problemele ca listă. A/B: „Practise the original" / „Practise the reharm" scriu grila aleasă în caseta din Progression și comută acolo, cu melodia neatinsă (decizie Edi).

### 4. Validarea (`piece.js`, deterministă, plasă de siguranță)

Rulează pe rezultatul final, indiferent de sursă (pipeline, editare manuală, import): pentru fiecare notă structurală, acordul activ pe acel beat:
- în chord tones ∪ tensiuni disponibile → **ok**
- în lista de avoid → **warning** (galben, măsura rămâne)
- altfel → **reject**: slotul revine la original, marcat roșu, cu motivul afișat. Cu candidați generați corect, cazul nu ar trebui să apară — dacă apare, e un test de scris.

### 5. Realizarea (`realize.js`, Faza 3b, deterministă)

Grila validată devine un aranjament cântabil pe Genos: pentru fiecare slot, bas (fundamentala sau nota de după `/`), voicing de mână stângă ales din biblioteca analizorului (rootless A/B, drop 2, shell, cvartal) prin căutarea celui mai apropiat de voicing-ul precedent (aceeași funcție de voice leading din `analyzer.js`), în registrul E2–A4 (planul zicea E2–C4, dar rootless A/B standard pe Cmaj7 sunt E3 G3 B3 D4 și B3 D4 E4 G4, iar cu o octavă mai jos cad sub low interval limits; registrul e configurabil în `suggestVoicings`) cu respectarea low interval limits, și melodia deasupra. Sugestiile din Faza 2 (`voicings.js`) folosesc deja aceste reguli: șabloane rootless A/B (sloturile de 9 și 13 rezolvate după acord: b9/b13 pe dominantele alterate), shell, drop 2 în toate inversiunile, cvarte suprapuse; fiecare candidat trece prin analizor fără avertismente; ordonare: aceeași textură (număr de note) ca voicing-ul precedent, apoi deplasare minimă, apoi tipul. Output: secvență de evenimente MIDI cu timp, redată de `output.js` sincron cu metronomul. Butoane A/B: original / reharm.

### 6. Partener de studiu (Faza 5)

- **Lock & regenerate**: utilizatorul blochează măsurile care-i plac; la regenerare, sloturile blocate au un singur candidat (cel ales), restul se rezolvă normal.
- **Cereri pe măsură**: „darker", „simpler", „delay the resolution" — text liber atașat slotului, transmis în `execute` ca `hint`; codul nu îl interpretează, doar îl trimite.
- **Explain**: click pe orice acord → un apel `explain` cu analiza slotului și `why`-ul, răspuns în 2–3 propoziții.
- **Guess mode**: aplicația ascunde alegerea AI-ului pe o măsură, utilizatorul cântă ce ar pune el, analizorul identifică acordul cântat și îl compară cu candidatul ales (aceeași tehnică? aceeași fundamentală?).

### 7. Stiluri ca date și evaluarea (Faza 5)

Profil de stil (`styles/tritone.json`, exemplu):

```js
{ name: "tritone", techniques: { "tritone-sub": 1.0, "related-ii": 0.7, "quality-change": 0.5, "chromatic-approach": 0.3 }, maxDensity: 0.5, maxRun: 3, rules: ["Only substitute dominants that resolve", "Never change the first chord of a phrase"] }
```

`techniques` ordonează candidații și intră în prompt ca priorități; `rules` intră în prompt ca text. Profilurile noi se creează din UI și se pot exporta.

Few-shot cu reharm-urile proprii: perechi `{ original, reharm, notes }` salvate local (nu în repo, decât dacă piesa e din domeniul public); la `execute` se atașează maximum 2 exemple din același stil. Așa modelul învață gustul lui Edi, iar perechile sunt și material de studiu.

Evaluare: `eval/pieces/*.json` — 6–10 piese scurte din domeniul public (compozitor decedat de peste 70 de ani; verificat înainte de commit) cu melodie și grilă; `eval/run.js` rulează pipeline-ul pe toate cu un stil și un `PROMPT_VERSION` dat și scrie un raport cu metricile din `scoring.js`. Rating-urile utilizatorului (sus/jos pe fiecare măsură, în UI) se salvează local cu `PROMPT_VERSION` și stil, exportabile ca JSON. Regula: orice schimbare de prompt sau de profil se rulează pe setul de evaluare înainte de commit; dacă `clashes` > 0 sau `density` iese din țintă, nu se commit-uie.

## Faze și Definition of Done

### Faza 0 — MIDI merge (o seară)

- `midi-test.html` deschis în Chrome: Genos apare la inputs și la outputs; notele cântate apar cu nume și număr MIDI; butonul „Send test chord" sună pe Genos.
- Dacă Genos nu apare: verifică cablul USB TO HOST, driverul Yamaha USB-MIDI pe Windows, apoi setările MIDI din Genos (transmisia pe partea de keyboard trebuie să fie activă).
- Numele proiectului decis înainte de primul commit (vezi sus).
- Repo privat inițializat pe GitHub, `.gitignore` (`node_modules/`, `worker/.dev.vars`, `*.local.json`), `README.md` cu 5 rânduri (ce este + status: work in progress), primul commit.

**DoD**: ambele direcții MIDI confirmate, repo online.

### Faza 1 — MVP de studiu (1–2 săptămâni)

- `notes.js`, `chords.js`, `analyzer.js` cu teste (`node --test` trece).
- CI pe GitHub Actions adăugat odată cu primele teste verzi; badge în README.
- Drill aleatoriu: alegi calitățile de exersat (ex. „doar 7alt", „maj7 + m7") și tonalități; aplicația arată un chord symbol mare, tu cânți, feedback în < 100 ms de la snapshot.
- Feedback pe ecran: tipul detectat, tensiunile prezente, avertismente în ordinea de mai sus, notele cântate pe o claviatură desenată (SVG simplu).
- Tastă „next" (Space sau o notă foarte gravă pe clapă, configurabil) pentru acordul următor.

**DoD**: Edi face o sesiune de 20 de minute fără bug-uri și fără să se uite în consolă. Testele acoperă parserul (≥ 20 chord symbols) și fiecare tip de voicing (≥ 1 exemplu pozitiv + 1 negativ).

### Faza 2 — Progresii și MIDI out (1–2 săptămâni)

- `progressions.js`: ii-V-I major și minor, blues 12 bar (basic + jazz blues), rhythm changes secțiunea A, turnaround I-VI-ii-V, Coltrane changes pe un ciclu. Toate transpozabile.
- Input manual: text `| Dm7 | G7 | Cmaj7 | % |` → progresie. Nu includem grile de standarde din Real Book în repo (drepturi de autor; proiectul e public).
- Metronom cu Web Audio (scheduling cu `AudioContext.currentTime`, nu `setInterval`), tempo configurabil, o măsură per acord (configurabil).
- Voice leading între voicings consecutive, scor pe progresie la final.
- `output.js`: buton „play suggested voicing" trimite note-on/note-off spre Genos pe un canal ales; verifică în Genos ce canal e mapat la o voce.
- `recorder.js` + `piece.js`: mod „record melody" pe o grilă — count-in, cânți melodia o dată, aplicația o salvează cuantizată pe măsuri (vezi „Specificația reharmonizării"). Piesa se poate salva local (`localStorage` / export JSON) și reîncărca.
- Statistici de sesiune în `localStorage` (acorduri exersate, greșeli frecvente), cu try/catch și fără să depindă de ele.

**DoD**: o sesiune cu metronom pe un blues jazz, cu scor de voice leading, cel puțin o sugestie auzită pe Genos, și o piesă (grilă + melodie înregistrată) salvată și reîncărcată corect.

### Faza 3a — Hibrid de bază: analiză, candidați, un apel (1–2 săptămâni)

- `worker/`: Cloudflare Worker care primește `{ action, messages, system }`, apelează Anthropic Messages API cu cheia din env, verifică `Origin` (doar domeniul GitHub Pages + localhost) și limitează cererile pe IP. Fără altă logică, fără prompturi.
- `ai/client.js` + `ai/prompts.js` cu `PROMPT_VERSION`; parsare și validare JSON pe fiecare răspuns; dacă e invalid, mesaj clar, nu crash.
- **explain & suggest** pe un acord din drill: 2 voicings alternative, cu motivul, ca JSON `{ voicings: [{ notes: [midi], label, why }] }`, randate pe claviatură și auzite pe Genos.
- `analysis.js` cu teste pe piese de 8 măsuri construite manual; `candidates.js` cu teste pentru fiecare tehnică din tabel (un caz pozitiv + unul negativ); `scoring.js` cu teste pe grile artificiale.
- **reharmonize piece**, versiunea minimă a pipeline-ului: analiză → candidați → un singur apel `execute` → validare → scoruri afișate → rezultatul intră în drill (Faza 2), A/B original / reharm ca simboluri (fără voicings realizate încă).
- UI: grila originală și cea nouă una sub alta, măsurile schimbate evidențiate, `why` la hover/click, scorurile într-un rând.

**DoD**: (1) din drill, la un acord, ceri o alternativă, o auzi pe Genos, o cânți și analizorul o recunoaște ca ce a promis Claude; (2) înregistrezi melodia unei piese de 16 măsuri, ceri „medium / tritone", primești o grilă cu `clashes = 0` și densitatea în țintă, o exersezi în drill; (3) un test automat dovedește că un `candidateId` inexistent în răspuns duce la `original`, nu la crash.

### Faza 3b — Pipeline complet și aranjament cântabil (1–2 săptămâni)

- Apelurile `plan` și `review` în `ai/pipeline.js`; planul afișat utilizatorului pe fraze; review-ul aplicat de cod, maximum 4 schimbări, o singură rundă.
- Execuție pe fraze pentru piese > 32 de măsuri, cu contextul frazei precedente.
- `realize.js`: bas + voicing de mână stângă cu voice leading + melodie, redate pe Genos sincron cu metronomul; A/B original / reharm ca aranjament complet.
- Profilul de intensitate filtrează candidații (la `light` doar tehnicile permise), nu doar promptul.

**DoD**: pe aceeași piesă de 16 măsuri, rezultatul cu `plan + execute + review` are `bassSmoothness` și `techniqueMix` cel puțin la fel de bune ca la 3a (măsurat, nu impresie), și îl auzi pe Genos ca aranjament complet, cu melodia deasupra.

### Faza 4 — Portofoliu (câteva zile)

- **Demo mode**: claviatură pe ecran (click/touch) + sintetizator Web Audio simplu, pentru cine nu are clapă MIDI. Fără asta, jumătate din recrutori nu pot încerca nimic. Demo-ul include o piesă din domeniul public preîncărcată, ca reharm-ul să poată fi încercat în 10 secunde.
- Repo-ul trece pe public (verificat înainte că istoricul nu conține secrete) și se alege licența (MIT sau niciuna); deploy pe GitHub Pages, Worker publicat, cu limită de cereri pe IP suficient de mică încât cheia să nu poată fi golită de un vizitator.
- README în engleză: ce e, GIF de 15 secunde cu fluxul, diagrama arhitecturii hibride (piece → analysis → candidates → Claude plan/execute/review → scoring → realize → MIDI out), secțiunea „Why not just ask the LLM" cu 3 propoziții, „How the analyzer works" cu 2–3 exemple, cum rulezi local, cum rulezi testele.
- Video demo de 60–90 s cu Genos (filmat de Edi), link în README.

**DoD**: cineva fără clapă deschide link-ul, apasă 4 note pe ecran, primește analiza, apoi apasă „reharmonize" pe piesa demo și aude rezultatul în browser; cineva cu clapă face același lucru cu instrumentul.

### Faza 5 — Partener de studiu, stiluri ca date, evaluare (după portofoliu, în ritmul studiului)

- Lock & regenerate, cereri pe măsură (`hint`), `explain` pe orice acord, guess mode — vezi „6. Partener de studiu".
- Profiluri de stil în `styles/*.json`, editabile din UI, exportabile; stilul din enum-ul Fazei 3a migrează aici.
- Few-shot cu reharm-urile proprii ale lui Edi (local), maximum 2 exemple per apel.
- `eval/pieces/` (6–10 piese din domeniul public, verificate) + `eval/run.js` + rating-uri pe măsură salvate cu `PROMPT_VERSION` și stil. Regula: nicio schimbare de prompt sau profil fără rulare pe setul de evaluare.
- Opțional, dacă timpul permite: import de fișier MIDI (.mid) ca a doua cale de intrare a pieselor.

**DoD**: Edi are cel puțin 3 profiluri de stil proprii și 5 piese reharmonizate cu rating-uri; o schimbare de prompt e comparată cu precedenta pe setul de evaluare și decizia e luată pe baza raportului, nu pe impresie.

## Ce NU facem (scope guard)

- Conturi de utilizator, backend cu bază de date. Worker-ul rămâne proxy fără logică: analiza, candidații, validarea și scorurile stau în browser, ca să fie testabile cu `node --test` și vizibile în repo.
- Transcriere audio → MIDI și citire de lead sheet din imagine — nu în acest proiect.
- Bucle de review nelimitate sau „agenți" care se apelează singuri până sunt mulțumiți: o rundă de review, atât. Calitatea vine din candidați și scoruri, nu din apeluri repetate.
- Framework-uri, TypeScript, bundler — decizie luată, nu se redeschide în timpul proiectului.
- Grile din Real Book în repo. Piese în repo doar din domeniul public, verificat.
- Funcții noi înainte ca DoD-ul fazei curente să fie bifat. Faza 5 nu începe înainte ca Faza 4 (portofoliul) să fie publicată.

## Convenții pentru sesiunile cu Claude Code

- Începe fiecare sesiune citind secțiunea „Jurnal" de mai jos și actualizeaz-o la final (data, ce s-a făcut, ce urmează, decizii luate).
- Înainte de o schimbare care atinge `analyzer.js` sau `chords.js`, scrie testul întâi, apoi implementarea.
- Când se adaugă o regulă de teorie nouă, se adaugă și în tabelul din acest fișier. Când se adaugă o tehnică de substituție nouă, se adaugă în tabelul de candidați, cu regula de detecție și un test.
- Orice schimbare în `ai/prompts.js` incrementează `PROMPT_VERSION` și, din Faza 5, se rulează pe setul de evaluare înainte de commit.
- Nu rula `git push --force`, nu șterge fișiere fără confirmare.

## Jurnal

- **2026-09-17** — Plan creat împreună cu Claude (chat). Decizii: repo în Claude Code, vanilla JS, fără dependențe, teste cu `node --test`, deploy GitHub Pages + Cloudflare Worker pentru AI. Următorul pas: Faza 0 — rulează `midi-test.html`, confirmă Genos în ambele direcții, inițializează repo-ul.
- **2026-09-17 (mai târziu)** — Adăugat „reharmonize piece": piesa intră ca grilă tastată + melodie cântată pe Genos și înregistrată cu poziția pe măsuri (Faza 2); Claude reharmonizează cu melodia fixă, `piece.js` validează determinist fiecare măsură (Faza 3). Import de fișiere MIDI și lead sheet din imagine — respinse deocamdată, posibil Faza 5.
- **2026-09-17 (seara)** — Reharmonizarea ridicată la arhitectură hibridă: codul face analiza armonică și generează candidații compatibili cu melodia, etichetați pe tehnică; Claude alege doar dintre candidați (`execute`), cu `plan` pe fraze și un `review` separat; scoruri deterministe; `realize.js` transformă grila în aranjament cântabil pe Genos. Faza 3 împărțită în 3a (hibrid minim) și 3b (pipeline complet + voicings). Faza 5 nouă: interactivitate, stiluri ca JSON, few-shot cu reharm-urile proprii, set de evaluare cu metrici și rating-uri. Următorul pas neschimbat: Faza 0.
- **2026-09-17 (noaptea)** — **Faza 0**: `midi-test.html` confirmat pe Genos în ambele direcții. Nume final Voicing Lab (`voicing-lab`), licență MIT, CLAUDE.md public. Repo local inițializat (README, `.gitignore`, `package.json` fără dependențe, LICENSE, primul commit); push după ce Edi creează repo-ul gol pe GitHub. **Decizii**: snapshot armat doar la note-on, nota de „next" interceptată; 60 = C4 peste tot (comentariul din `midi-test.html` corectat); m7 implicit funcție ii; caution ⊆ tensiuni disponibile; listele din tabel sunt complete (restul = wrong), regula generică doar pentru calități fără rând; sus = terța înlocuită cu 2/4, 11 = extensie cu terța prezentă; forma `C6/9`; `C13` = `C7` + 13; `b9` explicit = obligatoriu și 9 wrong; `alt` = 5/9/13 naturale wrong; câmp `required` per calitate; quartal cu 3M tolerată doar de la 4 note. Design aprobat pentru `notes.js` / `chords.js` (semnături + 10 teste); stub-uri și cele 10 teste scrise, roșii, necommise. **Deschise**: rândurile pentru `m6`, `6/9`, `sus4`; b5 obligatoriu pe m7b5 / dim7; ce e obligatoriu pe `alt`; regula b9 extinsă la #9 / b13 / 9 / 13; low interval limits (ce notă se compară, praguri vs tabel pe interval). **Următorul pas**: push, apoi implementarea `notes.js` și `chords.js` până trec cele 10 teste.
- **2026-09-17 (revizie înainte de push)** — Recitit tot planul. **Corectat**: regula de detecție drop 2/3/2&4 (se ridică nota cea mai de jos, nu „a doua de sus"); regula generică de avoid scoasă (tabelul e singura sursă; era moartă după decizia (a)). **Adăugat, aprobat de Edi**: snapshot pentru acorduri staccato (copia setului de dinaintea primului note-off); rootless A/B acceptă alterațiile pe dominante; „bas separat" (root/5 jos + tipul restului); 7 mare e tensiune disponibilă pe `6`; aliasuri Unicode și Real Book (`∆`, `º`, `Ø`, `MA7`, `MI7`), `Calt`, `b5`/`#5` pe dominante, `mMaj7`/triade/`+`/`7#5` în gramatică (rânduri încă deschise); `minorFunction` rămâne enum extensibil (iii, vi mai târziu); recorder-ul folosește `event.timeStamp` aliniat la `AudioContext`. Shell rămâne {3, 7} ± root deocamdată (Bud Powell R–7 / R–3 respins pentru moment). **Repo**: `.gitattributes` (LF), `.gitignore` extins (`.wrangler/`, fișiere de OS), Node ≥ 22, CI planificat în Faza 1. **Deschise, în plus**: rândurile pentru `mMaj7`, triade, `+`, `7#5`.
- **2026-09-17 (înainte de push)** — Edi a ridicat problema vizibilității („nu vreau să-mi fure cineva munca"). Decis: repo **privat până la Faza 4**, apoi public (Pages cere public pe cont gratuit); **fără licență** deocamdată (LICENSE șters, `"license": "UNLICENSED"`), decizia se ia la publicare. Regula „niciun secret în repo" e valabilă și cât e privat, pentru că istoricul devine public integral.
- **2026-09-17 (push)** — **Faza 0 bifată**: MIDI în ambele direcții, repo online (privat). GitHub raportează numele `Voicing-Lab` (cu majuscule); de decis dacă se redenumește în `voicing-lab` (recomandat, URL-ul Pages devine lowercase) sau se actualizează URL-urile din acest fișier. **Faza 1 începută**: commit `test:` cu cele 10 teste și stub-uri (roșu), apoi `feat:` cu `notes.js` (4/4 verzi). Urmează `chords.js` pe cele 6 teste rămase; rândurile deschise din tabel așteaptă răspunsurile lui Edi (întrebările a–j).
- **2026-09-17 (răspunsuri a–j)** — Nume păstrat `Voicing-Lab`; remote și URL-uri actualizate; corectată justificarea (Origin nu conține calea). **Decise**: `6/9` = rândul 6 cu 9 chord tone obligatoriu; `m6` cu tensiuni 9, 11, 7; `mMaj7` = 1 b3 5 7 (C Eb G B) cu tensiuni 9, 11, 13; b5 obligatoriu pe m7b5 și dim7; extensia scrisă explicit e obligatorie și face wrong celelalte forme ale treptei (b9/#9 coexistă); `7#5` = 7 + b13 obligatoriu, 5 și 13 wrong; low interval limits pe nota de jos a perechii, praguri ca tabel pe interval. **Deschise**: (1) convenția etichetelor — Edi citește `7` = septimă mică, `7+` = mare, `-7` = micșorată; tabelul și codul folosesc Berklee (`b7`, `7`, `bb7`); de decis dacă UI-ul afișează Berklee sau are opțiune de afișare europeană; (2) sensul lui `alt` — Edi: „alterat, adică mărit, 1 3 #5"; de clarificat dacă `7alt` rămâne dominanta alterată standard (b9 #9 #11 b13) cu 3, b7 și b13 obligatorii, sau înseamnă doar `7#5`; (3) aliasurile `7+` / `+7` (european = maj7, american = 7#5) și `-7` (american = m7) — de decis ce acceptă parserul; (4) tensiunile pe `sus4`, `maj`, `m`.
- **2026-09-17 (chords.js)** — **Decise**: etichete Berklee peste tot (opțiune de afișare europeană posibilă mai târziu); `7+` / `+7` respinse, `-7` = m7; tensiuni pe `sus4` (9, 13, b7; avoid 3), `maj` (7, 9, #11, 13; avoid 11), `m` (b7, 7, 9, 11, 13). **`chords.js` implementat, 10/10 teste verzi**: tabelul ca date, cea mai lungă potrivire pe aliasuri, prescurtări (`C9`, `Cm11`, `Cmaj13`, `C9sus4`, `Calt`), extensii explicite cu regula de excludere, `b5`/`#5`/`alt` doar pe dominantă, `classifyPc` ca unic loc de decizie. **Deschis**: `alt` — Edi a scris de două ori „C7alt = C E G# Bb"; de clarificat dacă b9/#9/#11 rămân disponibile (standard, implementat acum) sau devin wrong (alt = 7#5). Întrebare mică: `C°` / `Cdim` fără 7 ca alias pentru dim7? **Următorul pas**: testele parserului până la ≥ 20 de simboluri (prescurtări, extensii explicite, ii/i, `classifyPc`, erori), apoi `analyzer.js` test-first.
- **2026-09-17 (parser complet)** — **Decise**: `alt` = dominanta alterată standard cu 3, b7, b13 obligatorii (b9/#9/#11 rămân disponibile); `C°`/`Cdim` = dim7; repo confirmat Private. Parserul are **20/20 teste, 40+ simboluri** (DoD-ul Fazei 1 pentru parser e acoperit). Capcană JS găsită de un test: `Object.keys` pune cheile numerice (`'6'`, `'7'`) primele, deci ordinea tabelului e ținută explicit în `QUALITY_IDS`, verificată la încărcare față de `QUALITIES`. **Următorul pas**: `analyzer.js` — propunere de semnătură, formă a ieșirii și primele teste, apoi implementare după confirmarea lui Edi.
- **2026-09-17 (analyzer)** — Design aprobat de Edi; **`analyzer.js` implementat, 34/34 teste** (14 noi: fiecare tip de voicing cu caz pozitiv și negativ, cum cere DoD-ul). Schimbare de spec descoperită la scrierea testelor: quartal se verifică înaintea drop-urilor (4 cvarte suprapuse sunt și un drop 2). Poziție strânsă = întindere ≤ 12 semitonuri. Din DoD-ul Fazei 1 rămân: `midi/input.js` (snapshot), UI-ul de drill cu claviatură SVG, `index.html`, tasta „next", sesiunea de 20 de minute. **Următorul pas**: propunere pentru `input.js` + UI minimal, apoi implementare.
- **2026-09-17 (drill-ul rulează)** — Aprobat de Edi: captura ca `midi/capture.js` (logică pură, 9 teste pe ceas fals) + `midi/input.js` (cablaj Web MIDI, `parseMidiMessage` testat), „next" = Space sau E1 (MIDI 28, configurabil). Implementat: `ui/drill.js` (setări persistate, teste), `ui/keyboard.js` (SVG E1–G7, 76 de clape ca Genos, colorate pe rol), `ui/render.js`, `app.js`, `index.html`, `styles.css`; CI pe GitHub Actions (Node 22/24) cu badge; hook de debug `window.voicingLab.play(...)` pentru consolă fără clapă. Verificat în browser: rootless A recunoscut, avertismentele în ordine, Space și E1 avansează. **48/48 teste.** Structura din plan s-a schimbat: `midi/capture.js` nou, `src/app.js` e cablajul, `styles.css` la rădăcină (folderul `styles/` rămâne pentru profilurile JSON din Faza 5). **Următorul pas**: sesiunea de 20 de minute a lui Edi pe Genos (DoD Faza 1); bug-urile și observațiile lui intră ca teste.
- **2026-09-17 (Faza 1 bifată)** — Edi a făcut sesiunea pe Genos: fără bug-uri, fără consolă. **DoD Faza 1 îndeplinit** (parser 40+ simboluri, fiecare tip de voicing cu caz pozitiv și negativ, 49 de teste). Singura cerere: în UI, half-diminished și diminished se afișează cu simbolurile lor, `ø7` și `°` fără 7, pentru că simbolul de diminished implică deja septima micșorată (ids-urile interne rămân `m7b5` / `dim7`; setările salvate cu numele vechi migrează). **Următorul pas**: Faza 2, în ordinea: `progressions.js` + parser de grilă text → voice leading (`compareVoicings`) → metronom Web Audio + modul progresie în UI → `output.js` (MIDI out, canalul 1, confirmat în Faza 0) → `recorder.js` + `piece.js` → statistici de sesiune.
- **2026-09-17 (Faza 2, pasul 1)** — Notație finală în drill: `ø7` și `°` (Edi: doar diminished pierde 7-ul). Ordinea Fazei 2 și biblioteca de progresii aprobate. **`progressions.js` implementat, 57/57 teste**: `parseGrid` / `formatGrid` (împărțire egală sau eroare cu numărul măsurii, `%`), `transposeSymbol` / `transposeGrid` (ortografie după tonalitate), `PROGRESSIONS` (ii-V-I, ii-V-i cu Cm6, blues, jazz blues, rhythm changes A, turnaround, Coltrane) și `getProgression(id, key)`. **Următorul pas**: pasul 2, `theory/voiceLeading.js` cu `compareVoicings`, după confirmarea designului.
- **2026-09-17 (Faza 2, pasul 2)** — Designul pașilor 2 și 3 aprobat (pasul 3 cu ambele moduri, free și timed). **`voiceLeading.js` implementat, 64/64 teste**: potrivire cu deplasare minimă (sortată, nu greedy — vezi spec), rating smooth/ok/jumpy, `scoreProgression` cu toleranță pentru schimbările de registru între voicings spread. **Următorul pas**: pasul 3 — `theory/timing.js` (timp ↔ bar/beat, testat), `audio/metronome.js`, modul progresie în UI.
- **2026-09-17 (Faza 2, pasul 3)** — Designul pasului 4 aprobat. **Pasul 3 implementat, 75/75 teste**: `timing.js` (positionAt / timeOf / quantizePosition, cu count-in), captura raportează `startedAt` (primul note-on), `ui/session.js` (sloturi, `locate` cu chorus-uri, cursor free, istoric, `summary`), `audio/metronome.js` (scheduler cu lookahead, click accentuat, count-in, `positionOf` prin `getOutputTimestamp`), UI cu tab-uri Drill / Progression: bibliotecă + grilă editabilă + tonalitate + măsură + tempo + loop, moduri free și timed, grila cu slotul curent și ✓/! pe cele cântate, raport de voice leading la fiecare chorus. Verificat în browser în ambele moduri. **Următorul pas**: pasul 4 (`theory/voicings.js`, `midi/output.js`, buton Play suggestion) și testul lui Edi pe Genos în modul timed.
- **2026-09-17 (Faza 2, pasul 4)** — Designul pașilor 5 și 6 aprobat. **Pasul 4 implementat, 83/83 teste**: `theory/voicings.js` (șabloane, registru E2–A4 în loc de E2–C4 — vezi secțiunea de realizare), `midi/output.js` (mesaje pure testate, `createOutput` cu port și canal), Settings → MIDI out (port + canal, persistate), buton „Play suggestion" / tasta P (apăsată din nou trece la următorul candidat), sugestia conturată punctat pe claviatură peste ce a cântat Edi. Bug-uri găsite la verificarea în browser și rezolvate: panoul de progresie rămânea vizibil în Drill (`display: grid` bătea `hidden`); ordinea sugestiilor favoriza shell-urile de 2 note (acum: întâi aceeași textură). **Următorul pas**: pasul 5 (`theory/piece.js`, `midi/recorder.js`, Record melody / Save / Load / Export), apoi pasul 6 (statistici); de la Edi: testele pe Genos ale modului progresie și ale sugestiilor (sunet pe canalul 1, eventual ecou MIDI înapoi în aplicație).
- **2026-09-17 (Faza 2, pasul 5)** — **Pasul 5 implementat, 94/94 teste**: `theory/piece.js` (model, `addMelody` cu cuantizare la optimi, nota se termină unde începe următoarea, < 60 ms doar în `raw`, note-țintă = timp tare sau ținută ≥ 1 timp și cel puțin o optime; JSON validat; `savePiece` / `loadPiece` / `listPieces` / `deletePiece` în `localStorage`), `midi/recorder.js` (timp muzical, poziții injectate, testat cu ceas fals), UI în panoul de progresie: Record melody (întotdeauna cu metronom, un chorus, oprire automată; captura e pauzată cât se înregistrează), melodia sub grilă (țintă îngroșat, passing estompat), Save (titlu), Load, Delete, Export JSON, Import JSON. Verificat în browser cu note simulate. **Următorul pas**: pasul 6 (`ui/stats.js`), apoi sesiunea DoD a Fazei 2 a lui Edi.
- **2026-09-17 (Faza 2, pasul 6)** — **Pasul 6 implementat, 98/98 teste**: `ui/stats.js` (obiecte imutabile; pe calitate: încercări, curate, trepte lipsă, note greșite, avoid; `weakSpots`, `summaryLine`, `loadStats`/`saveStats` cu try/catch), linia „Session" în antet, cumulativul cu Reset în Settings; fiecare analiză din drill sau progresie intră în ambele. **Toată Faza 2 e implementată**; rămâne DoD-ul, care e al lui Edi: sesiune cu metronom pe jazz blues cu raport de voice leading, o sugestie auzită pe Genos, o piesă înregistrată, salvată și reîncărcată. **Următorul pas**: sesiunea lui Edi; observațiile intră ca teste; apoi Faza 3a (Worker + `ai/client.js` + `analysis.js` / `candidates.js` / `scoring.js`).
- **2026-09-17 (Faza 2 bifată)** — Bug de UI găsit de Edi și rezolvat: dropdown-urile erau ilizibile în tema întunecată pe Windows (fundal alb, text alb moștenit) → culori de sistem `Canvas`/`CanvasText`. Sesiunea DoD pe Genos: jazz blues cu metronom și raport, sugestie auzită pe canalul 1, piesă înregistrată/salvată/reîncărcată — „totul merge bine". Genos **nu** trimite notele primite înapoi (fără ecou), deci nu e nevoie de filtru la MIDI out. **DoD Faza 2 îndeplinit**, 98 de teste. **Următorul pas**: Faza 3a, în ordinea: `analysis.js` → `candidates.js` → `scoring.js` (pure, testabile, fără cont) → `worker/` + `ai/client.js` + `ai/prompts.js` + explain & suggest → pipeline `execute` + UI de reharm. Pregătire pe partea lui Edi: cont Cloudflare și cheie Anthropic (doar în `worker/.dev.vars` și în secretele Worker-ului).
- **2026-09-17 (Faza 3a, pasul 1)** — Ordinea Fazei 3a și designul aprobate (blues: I7 = T, IV7 = S, cadență doar pe V7). **`analysis.js` implementat, 106/106 teste**, pe 8 piese construite manual: ii–V–I cu dominantă secundară, jazz blues în F, ii–V–i minor, tritonal, dim de trecere / iv / backdoor / împrumuturi, pasaj modal fără tonalitate (ghicită), relațiile melodiei, frazele. Spec precizat: backdoor = cadență; I7 din blues nu devine V7/IV. **Următorul pas**: pasul 2, `candidates.js`, după confirmarea designului.
- **2026-09-17 (Faza 3a, pasul 2)** — Design aprobat; avoid pe notă-țintă = păstrat cu warning. **`candidates.js` implementat, 117/117 teste** (un caz pozitiv și unul negativ pe fiecare tehnică, filtre de intensitate, ordonare pe stil, limită). Descoperit la teste: limita de 12 era umplută de schimbările de calitate → selecție round-robin pe tehnici; bug găsit de test: fundamentala lui ii se calcula cu o cvartă în loc de o cvintă. **Următorul pas**: pasul 3, `scoring.js`, după confirmarea designului; apoi pasul 4 (Worker + client + prompts), care are nevoie de contul Cloudflare și de cheia API ale lui Edi.
- **2026-09-17 (Faza 3a, pasul 3)** — Design aprobat (tabelul de costuri al basului inclus). **`scoring.js` implementat, 123/123 teste**, pe grile artificiale: totul original, o substituție tritonală, tabelul de costuri al basului (inclusiv bas de după `/`), clash-uri recalculate din melodie (un acord construit manual ca să se bată cu melodia dă `clashes = 1`; jumătățile unui `related-ii` verificate separat), țintele de densitate pe toate intensitățile, `maxRun` 5 respins sub `heavy`, Coltrane numărat ca două sloturi cu alegerea de pe slotul acoperit ignorată. Pe partea de mediu: plugin-ul Cloudflare pentru Claude Code instalat la nivel de utilizator (skill-urile `wrangler` și `workers-best-practices`, server MCP cu login la prima folosire); CLI-ul aplicației desktop e în `AppData\Roaming\Claude\claude-code\<versiune>`, nu pe PATH. **Următorul pas**: pasul 4 — `worker/` (proxy cu verificare `Origin` și limită pe IP, `wrangler` ca dev dependency izolată, `.dev.vars.example`), `ai/client.js`, `ai/prompts.js` cu `PROMPT_VERSION`, explain & suggest din drill; are nevoie de contul Cloudflare și de cheia Anthropic (doar în `worker/.dev.vars` și în secretele Worker-ului). Apoi pasul 5 (pipeline `execute` + UI de reharm + testul DoD cu `candidateId` inexistent).
- **2026-09-18 (Faza 3a, pasul 4)** — Decizii Edi: Worker-ul apelează Anthropic prin `fetch` direct (fără SDK), modelul e `claude-opus-5`. **Pasul 4 implementat, 140/140 teste** (laptopul lui Edi a dat blue screen la mijloc; repo-ul a rămas intact, verificat cu `git fsck` și cu testele, apoi împins): `worker/` (proxy testat sub `node --test` cu `env` fals; `wrangler` 4.134 ca dev dependency izolată, `wrangler.jsonc` cu binding-ul `ratelimits`, `wrangler deploy --dry-run` și `wrangler dev` verificate local, `.dev.vars.example`; `.gitignore` acoperă `worker/.dev.vars*` și `worker/.env*`), `ai/client.js` (erori pe tipuri), `ai/prompts.js` (`explain` și `execute` versionate, scheme în subsetul structured outputs), `ai/explain.js` (validare prin analizor = DoD 1 ca test), UI: setarea `proxyUrl`, butonul „Ask Claude" / A, tastele 1 / 2. Verificat în browser: fără URL → avertisment; cu `wrangler dev` fără cheie → „Claude: proxy not configured" afișat curat; calea de succes simulată cu un `fetch` fals → lista randată, duplicatul respins cu motiv, tasta 1 conturează clapele, voicing-ul cântat e recunoscut ca tipul promis, blocul rămâne. Capcană de mediu: npm 11 blochează scriptul de post-instalare al `workerd` („allow-scripts"), dar binarul vine din pachetul de platformă și `wrangler dev` merge. **Rămâne pe partea lui Edi**: contul Cloudflare, cheia Anthropic (în `worker/.dev.vars` local și `npx wrangler secret put ANTHROPIC_API_KEY` în cloud), `npm run deploy` din `worker/`, URL-ul Worker-ului în Settings, apoi DoD (1) pe Genos. **Următorul pas**: pasul 5 — `ai/pipeline.js` (`execute`: candidați → apel → validare id-uri → `resolveChoices` → scoruri), validarea din `piece.js`, UI de reharm cu A/B și scoruri, testul DoD (3) cu `candidateId` inexistent.
- **2026-09-18 (Faza 3a, pasul 5)** — Decizii Edi: UI-ul de reharm într-un **tab nou**, iar A/B **trimite grila aleasă în Progression**. **Pasul 5 implementat, 149/149 teste**: `ai/pipeline.js` (`reharmonize`, cu `candidates` ca opțiune pentru lock & regenerate), `checkMelody` + `validateReharm` în `piece.js` (`scoring.js` nu-și mai ține propria copie a verificării melodiei), desfășurarea grilei înapoi în text cu `gridParses`, tab-ul Reharm complet. **DoD (3) bifat**: un `candidateId` inexistent lasă slotul pe original și intră în `problems`, la fel un răspuns fără `bars`, o intrare fără coordonate, un slot inexistent, un slot răspuns de două ori și o alegere pe un slot acoperit. Bug găsit la verificarea în browser: helper-ul `h()` din `render.js` scrie și atributele cu valoare `undefined`, deci `disabled: undefined` dezactiva butonul; acum se pune pe proprietate, nu pe atribut. **Toată Faza 3a e implementată**; rămân DoD-urile (1) și (2), care sunt ale lui Edi, după ce publică Worker-ul. **Următorul pas**: Edi pune cheia și face deploy, apoi sesiunea DoD pe Genos (alternativă cerută din drill, recunoscută de analizor; piesă de 16 măsuri înregistrată, reharmonizată „medium / tritone", exersată în Progression). Observațiile lui intră ca teste. Apoi Faza 3b: `plan` și `review` în pipeline, execuție pe fraze peste 32 de măsuri, `realize.js`.
- **2026-09-18 (Faza 3a, probe pe cheia reală)** — Cheia lui Edi merge (`npm --prefix worker run check-key`, 11 modele, `claude-opus-5` disponibil). Probat cu Worker-ul local: un apel direct prin proxy, „Ask Claude" din drill (două voicings, ambele acceptate de analizor, tipul detectat = cel promis) și o reharmonizare de 16 măsuri în F, stil tritonal, intensitate medie. **Cifre de referință pentru o piesă de 16 măsuri**: 17 sloturi, 204 candidați, prompt ~19 000 de caractere, ~10 900 token-uri de intrare și ~1 400 de ieșire, 16 secunde, în jur de 9 cenți; `clashes` 0, densitate 41% în țintă, `maxRun` 2, bas 0,78, trei tehnici. Găsit la rulare: modelul scurtează uneori id-ul candidatului, iar slotul se pierdea degeaba → recuperare după simboluri (`repairs`) și regulă explicită în prompt, `execute` la `PROMPT_VERSION` 2. **Ergonomie**: `start.cmd` plus o scurtătură pe desktop pornesc pagina, proxy-ul și Chrome dintr-un dublu-clic; pe localhost adresa proxy-ului se completează singură în Settings. Terminalul lui Edi e PowerShell, deci comenzile pentru el nu folosesc `&&`.
- **2026-09-18 (Faza 3a bifată)** — Edi a făcut sesiunile pe Genos: „e ok totul". Jurnalul Worker-ului local (baza de observabilitate a lui `wrangler dev`, interogabilă din `/cdn-cgi/local/explorer/api/local/observability/query`) arată în dimineața de 18 septembrie două `explain` și două `execute`, toate cu status 200. Mărimea de 16 măsuri e acoperită și de proba mea din seara precedentă (`clashes` 0, densitate în țintă). **DoD Faza 3a îndeplinit**: (1) și (2) pe Genos de Edi, (3) prin test automat. 150 de teste. De notat pentru 3b: filtrarea candidaților după intensitate (la `light` doar tehnicile permise) e deja în `candidates.js`, deci punctul acela din Faza 3b e făcut. **Următorul pas**: Faza 3b, după confirmarea ordinii și a designului.
