# SideKeys — CLAUDE.md

Antrenor de voicings și reharmonizare pentru pianiști de jazz. Conectezi clapa (Yamaha Genos) prin USB-MIDI la browser, aplicația îți cere un acord, tu îl cânți, iar ea îți spune instant ce ai cântat (tip de voicing, tensiuni, note evitate, calitatea voice leading-ului). În fazele următoare, Claude propune alternative și reharmonizări pe care le auzi direct pe Genos prin MIDI out.

Din 2026-10-11, SideKeys e un **joc**, nu un panou de control: același motor, servit ca drum cu unități, nivele, stele și un challenge zilnic, pentru oricine cântă din acorduri — de la triade până la jazz. Direcția și ordinea de construcție sunt în [docs/DIRECTION.md](docs/DIRECTION.md).

Numele e **SideKeys**, ales de Edi pe 2026-09-20: repo `EdiTnss/SideKeys`, publicat pe GitHub Pages la **`https://sidekeys.app/`** din 2026-10-28 (domeniul lui Edi, la Cloudflare, DNS only, verificat pe contul GitHub); vechea adresă `editnss.github.io/SideKeys` redirecționează acolo. Proiectul s-a numit **Voicing Lab** până atunci; s-a redenumit pentru că numele se lovea de **VoicingLab Ltd**, companie britanică activă cu produs plătit pentru exact aceiași pianiști, iar în aceeași nișă mai stă și JazzPianoLab. De aici încolo numele nu se mai schimbă: GitHub Pages nu face redirect după redenumire, deci fiecare redenumire omoară link-ul demo — acum a costat puțin doar pentru că nu-l văzuse încă nimeni. Verificarea `Origin` din Worker nu depinde de numele repo-ului: header-ul `Origin` conține doar `https://editnss.github.io`, fără cale. `package.json` păstrează `"name": "sidekeys"` (npm cere litere mici). Ce a salvat un browser sub numele vechi (setări, piese, statistici) se mută singur la prima citire, prin `src/storage.js`.

Repo-ul e **public** din 2026-09-20, cu GitHub Pages pornit. Tot istoricul e vizibil, deci regula „niciun secret în repo" se aplică de la primul commit; înainte de publicare am verificat fiecare commit și nu există nicio cheie reală în istoric. Licență: **niciuna** (toate drepturile rezervate; codul se poate citi, nu refolosi) — decizie Edi la publicare, 2026-09-20, ca să rămână libere opțiunile de monetizare din P2; `package.json` păstrează `"license": "UNLICENSED"`, iar README-ul o spune explicit. O licență se poate adăuga oricând; nu se poate retrage.

## Scop dublu

Scopul produsului, fazele lui (P0–P4) și regulile de scop sunt în [docs/PRODUCT.md](docs/PRODUCT.md), sursa de adevăr pentru scop de la 2026-09-19. Unde acest fișier sau o specificație din `docs/` îl contrazice, câștigă `PRODUCT.md`.

1. **Studiu**: Edi are 2+ ore/zi de studiu; aplicația e unealta lui de comping/voicings, deci trebuie să fie utilă din prima săptămână, nu la final.
2. **Portofoliu** pentru angajare ca AI/automation engineer: repo public, cod curat, teste, README în engleză cu demo video, integrare LLM reală (Faza 3a/3b) și un „demo mode" fără clapă MIDI ca să poată încerca oricine.

Ambele scopuri sunt egale. Dacă o decizie tehnică ajută portofoliul dar strică sesiunea de studiu (latență, fricțiune la pornire), pierde portofoliul.

## Reguli de colaborare

- Suntem parteneri pe proiect. Când Edi greșește, Claude explică de ce și dă varianta corectă — fără aprobare reflexă.
- Claude explică pe scurt fiecare concept nou de programare când apare prima dată (ES modules, event listeners, Web MIDI, teste, Workers), cu logică pas cu pas, nu doar concluzia.
- Claude propune soluții mai bune când le vede, chiar dacă nu a fost întrebat.
- Cererile ambigue primesc o întrebare de clarificare, nu o presupunere. Pașii mari se confirmă înainte de execuție.
- Edi e pianist de jazz avansat: teoria muzicală nu se explică, se implementează corect. Dacă Claude nu e sigur de o regulă de teorie (ex. ce tensiuni sunt disponibile pe un acord), întreabă, nu inventează.
- La începutul fiecărei sesiuni, Claude citește [docs/PRODUCT.md](docs/PRODUCT.md), singura sursă de adevăr pentru scop. [docs/DIRECTION.md](docs/DIRECTION.md) e consemnarea deciziei din 2026-10-11 și lista deciziilor încă deschise: se citește când se caută *de ce* arată produsul așa, sau ce mecanică de joc s-a stabilit. **Nu mai câștigă la contradicție** — direcția a intrat în `PRODUCT.md` și în acest fișier pe 2026-10-11, cu aprobarea lui Edi. Specificațiile din `docs/spec-*.md` se citesc doar când se lucrează la modulul respectiv (care pe care, în „Documentație", la final).

## Convenții pentru sesiunile cu Claude Code

- La finalul fiecărei sesiuni, adaugă o intrare în [docs/JOURNAL.md](docs/JOURNAL.md) (data, ce s-a făcut, ce urmează, decizii luate) și actualizează „Starea curentă" și „Următorul pas" din acest fișier. Jurnalul nu se citește la începutul sesiunii; se caută în el istoricul unei decizii, la nevoie.
- Înainte de o schimbare care atinge `analyzer.js` sau `chords.js`, scrie testul întâi, apoi implementarea.
- Rulează testele cu `npm run test:quiet`: o linie când sunt verzi, numele și diff-ul când pică. Raportul implicit al lui `node --test` scrie o linie pe test — circa 25 KB de context la fiecare rulare, fără nicio informație. `npm test` rămâne raportul complet, pentru CI și pentru un eșec care cere mai mult context.
- Când se adaugă o regulă de teorie nouă, se adaugă și în tabelul din [docs/spec-analyzer.md](docs/spec-analyzer.md). Când se adaugă o tehnică de substituție nouă, se adaugă în tabelul de candidați din [docs/spec-reharm.md](docs/spec-reharm.md), cu regula de detecție și un test.
- Precizările din implementare (decizii, capcane, schimbări de spec) se scriu în specificația modulului din `docs/`, în același commit cu codul, nu în acest fișier.
- **Când shell-ul consumă un modul din `src/`, modulul își primește semnătura scrisă**: `@param` și `@returns` în JSDoc, pe funcția exportată, în același commit. Motivul e mecanic, nu estetic — TypeScript deduce tipul unui callback din valoarea implicită a parametrului, deci `onVoicing = () => {}` respinge orice callback cu parametri, iar fără semnătură singura ieșire e `any` în shell. Regula s-a născut pe 2026-10-11, după ce `npm run check` a cerut-o de două ori în aceeași zi (`createKeyboard`, apoi toată granița MIDI). Sunt doar comentarii: Node nu le citește, comportamentul nu se schimbă, iar `npm run test:quiet` rămâne dovada. Unde un parametru e genuin polimorf (un port MIDI poate fi al browserului sau unul virtual), se scrie un `@typedef` cu forma comună, nu `any` împrăștiat.
- `node harness/replay.js --update` rescrie referința de regresie a harness-ului. Se rulează doar cu aprobarea lui Edi, după ce diferența raportată a fost citită și explicată, iar diferența se scrie în jurnal. E echivalentul harness-ului pentru „nu slăbi testul ca să treacă": spre deosebire de un test, referința se schimbă dintr-o comandă și nu lasă urmă vizibilă în diff.
- Orice schimbare în `ai/prompts.js` incrementează `PROMPT_VERSION` și, din Faza 5, se rulează pe setul de evaluare înainte de commit.
- Nu rula `git push --force`, nu șterge fișiere fără confirmare.

## Stack și constrângeri

- **Două straturi, cu reguli diferite.** `src/theory/**` rămâne **vanilla JS, ES modules, zero dependențe npm, fără DOM**, rulabil în Node fără build — acolo nu intră nimic. **Shell-ul** (interfața) e un proiect **Vite + TypeScript + Svelte 5**, cu dependențe, care importă `theory/` neatins. Granița e regula, nu o excepție punctuală: dacă o logică poate fi testată cu `node --test`, locul ei e în `theory/`, nu în shell.
- **Browser țintă**: Chrome/Edge (Web MIDI), ca PWA instalabilă. Safari nu suportă Web MIDI; iPad-ul vine prin shell nativ (Capacitor), mai târziu, nu prin adaptări acum. Demo mode merge oriunde.
- **Dev server**: `npm run dev` în `app/` (Vite, HMR). Pagina veche (`index.html` + `src/ui/`) rămâne servibilă cu `npx serve .` cât timp e Laboratorul; ES modules nu se încarcă de pe `file://` (CORS), iar `localhost` e context securizat, deci Web MIDI funcționează.
- **Teste**: `node --test` (test runner-ul încorporat în Node, fără instalare; Node ≥ 22 — 20 a ieșit din suport în aprilie 2026), pornit cu `npm test`. CI pe GitHub Actions rulează `npm test` pe Node 22 și 24 la fiecare push, cu badge în README; GitHub pornește o singură rulare per push, pe ultimul commit, deci commit-urile `test:` roșii dinaintea `feat:` nu produc rulări roșii dacă se împing împreună. `package.json` există doar pentru `"type": "module"` (Node tratează `.js` ca ES modules pe orice versiune) și scriptul de test — **fără nicio dependență**. Modulele din `src/theory/` sunt JS pur, fără DOM, exact ca să poată fi testate în Node. Fără framework de test în shell până nu cere ceva anume: logica nouă de scor (stelele) se scrie testabilă cu `node --test`, ca restul.
- **Deploy**: GitHub Pages (static, HTTPS → Web MIDI merge). Proxy-ul AI din Faza 3a e separat, pe Cloudflare Workers.
- **Cheia Anthropic nu ajunge niciodată în frontend sau în repo.** Doar în variabilele de mediu ale Worker-ului (local în `worker/.dev.vars`, ignorat de git).
- Excepțiile de la „zero dependențe" sunt trei, toate foldere izolate cu `package.json` propriu, din care `src/` nu importă nimic: `worker/` (cu `wrangler` ca dev dependency, pentru rulare locală și deploy) și `mic-proto/` (cu `@spotify/basic-pitch`, care aduce TensorFlow.js — aprobat de Edi pe 2026-09-24, pentru prototipul de microfon). A treia e **`app/`**, shell-ul nou (Vite + TypeScript + Svelte 5), aprobat de Edi pe 2026-10-11 odată cu direcția din `DIRECTION.md`. Aplicația din `src/` nu importă nimic din npm și nimic din `app/`. O a patra excepție se cere explicit.
- **Limbă**: UI-ul jocului e în engleză și română — engleza implicită, româna detectată din browser și aleasă din antet ([docs/spec-i18n.md](docs/spec-i18n.md)). Jargonul de jazz, notele cu litere, numele stelelor și textul de share rămân în engleză; Laboratorul e doar în engleză. Cod, comentarii, commit-uri, README — engleză (recrutorii citesc repo-ul). Acest fișier, `docs/` și discuțiile — română.
- Commit-uri mici, mesaje în stil `feat:`, `fix:`, `test:`, `docs:`.
- Audio: MIDI out spre Genos e sunetul principal. Web Audio (sintetizator simplu) doar ca fallback pentru demo mode.

## Structura repo-ului

```
app/                       shell-ul (Vite + TS + Svelte 5), cu package.json propriu și versiuni fixate
  vite.config.ts           fs.allow pe rădăcina repo-ului, ca ../src să poată fi importat neatins
  svelte.config.js         runes only: fără stores, fără `export let`, fără `$:`
  src/App.svelte           ține progresul și instrumentul (unul pe toată vizita), înregistrează o trecere, alege ecranul
  src/bridge/theory.ts     ușa spre teorie: analizor, acorduri, stele, mapările de clape
  src/bridge/midi.ts       ușa spre note: capture, porturi virtuale, synth, clapa de ecran
  src/lib/instrument.svelte.ts  sesiunea MIDI în runes: ce ține mâna, ce e armat, ce aparat e conectat
  src/screens/Game.svelte  ecranul de joc: acordul cerut și cel următor, clapa, verdictul; joacă un nivel sau o sesiune de Training
  src/screens/Result.svelte  rezultatul trecerii: stele, un singur lucru de reparat, „Next level"
  src/game/level.svelte.ts   nivelul: cererile, încercările, metronomul și ce acord răspunde un voicing; tipul `Run`
  src/game/practice.svelte.ts  o sesiune de Training: aceeași formă ca un nivel (`Run`), fără sfârșit și fără stele
  src/screens/Training.svelte  alegerea pentru Training: drill (calități, tonalități, formă) sau progresie în buclă
  src/bridge/time.ts       ușa spre ceas: metronomul, sesiunea, regula de anticipare
  src/bridge/game.ts       ușa spre drum: unitățile, ce e deschis, stelele salvate
  src/screens/Path.svelte  harta: unități, nivele, lacăte, stele, legătura spre pagina de teorie a fiecărei unități
  src/screens/Theory.svelte  teoria: lista lecțiilor și o pagină pe unitate, cu exemple colorate de analizor și cântate la clic
  src/screens/Today.svelte ecranul de start: streak, minute, „continuă drumul", Review, ușa spre Training
  src/lib/Keyboard.svelte  învelește src/ui/keyboard.js; Svelte decide când se colorează
  src/lib/clipboard.ts     copiază un text și spune dacă a reușit (grila zilei, în două ecrane)
  src/lib/locale.svelte.ts limba aleasă (EN | RO), ținută minte; t() și numele traduse pentru ecrane
  src/lib/Glossed.svelte   în română, subliniază termenii din glosar și îi explică la clic
  src/app.css              tokenii de brand și culorile de teorie (aceleași șapte ca styles.css)
  public/piano/manifest.json  ce înregistrări de pian există, sau null (fără 404, ca demo/manifest.json)
  public/manifest.webmanifest  manifestul PWA: nume, culori, iconuri, start_url relativ (merge pe subpath)
  public/icons/            iconurile aplicației instalate, generate din marcă (vezi assets/BRAND.md)
  sw.js                    service worker-ul, cu două locuri goale pe care le umple build-sw.mjs
  scripts/build-sw.mjs     scrie dist/sw.js: lista de precache (numele hashate de Vite) și numele cache-ului
index.html                 pagina veche: rămâne Laboratorul până e refăcută în shell
styles.css                 stilurile paginii (folderul styles/ e pentru profilurile JSON, Faza 5)
midi-test.html             Faza 0 — diagnostic MIDI in/out (rămâne în repo ca tool)
start.cmd                  Windows: deschide jocul publicat în fereastra lui, dintr-un dublu-clic; fără server
dev.cmd                    Windows: pornește serverul de dezvoltare al jocului; `dev.cmd lab` adaugă bancul și proxy-ul
src/
  app.js                   singurul loc care leagă theory, midi și ui
  storage.js               cheile din localStorage: un prefix și o funcție (mutarea de sub numele vechi a fost ștearsă pe 2026-10-05)
  midi/capture.js          regulile de snapshot (debounce, staccato, „next"), logică pură, testată
  midi/input.js            requestMIDIAccess (sau accesul primit), toate intrările/canalele, parseMidiMessage
  midi/virtual.js          acces MIDI fără hardware (?midi=virtual, harness) și mergeAccess:
                           porturile virtuale lângă cele reale
  midi/recorder.js         înregistrează melodia cântată în timp muzical (bar, beat, durată în timpi), pozițiile vin din metronom; testat
  midi/output.js           trimite voicings spre Genos (Faza 2), mesaje programate în timp și oprire curată (Faza 3b)
  midi/player.js           evenimentele aranjamentului → mesaje MIDI cu timp, un canal pe voce (Faza 3b)
  theory/notes.js          MIDI number ↔ nume, pitch class, intervale
  theory/chords.js         parser de chord symbol → chord tones, tensiuni, note evitate
  theory/analyzer.js       clasifică voicing-ul, low interval limits
  theory/voiceLeading.js   compareVoicings, scoreProgression (Faza 2)
  theory/progressions.js   biblioteca de progresii generice + parser de grilă text
  theory/timing.js         timp ↔ (bar, beat), cuantizare; folosit de metronom, recorder și player
  theory/stars.js          stelele: isRight / isClean pe acord, scoreRun pe trecere (docs/spec-game.md)
  game/path.js             unitățile și nivelele ca date, cererile lor și regulile de deblocare; testat
  game/progress.js         stelele, zilele, streak-ul, coada de recapitulare, grila zilei și ultimul nivel jucat; testat
  game/challenge.js        challenge-ul zilei: seed din dată, rampa de 10, grila și textul partajat; testat
  game/training.js         Training: ce se poate alege, ce se poate cânta în forma cerută, planul sesiunii; testat
  game/lessons.js          teoria: o lecție pe unitate și exemplele ei; testat contra analizorului
  game/lessons.ro.js       cuvintele paginilor de teorie în română; exemplele rămân ale lui lessons.js
  game/glossary.js         glosarul (română, textul lui Edi), cu exemple trecute prin analizor
  i18n/                    limbile jocului: dicționarele en/ro, traducerea, mesajele și numele compuse din chei, termenii
  theory/voicings.js       sugestii de voicing din șabloane, în registru, ordonate după voice leading (Faza 2; sămânța lui realize.js)
  audio/context.js         AudioContext-ul paginii și conversiile de ceas (pure, testate)
  audio/metronome.js       metronom Web Audio cu lookahead, count-in, onBeat, positionOf(performance.now)
  ui/session.js            o trecere prin progresie: sloturi, locate(bar, beat), record, summary (testat)
  ui/stats.js              statistici: încercări, curate, probleme pe calitate; sesiune + cumulativ în localStorage (testat)
  ui/tape.js               banda sesiunii: ultima oră de cântat și verdictele; reluarea ei (harness), testată
  theory/piece.js          modelul unei piese (grilă + melodie), cuantizare, validare reharm
  theory/analysis.js       analiză armonică: trepte, funcții, cadențe, fraze, note-țintă (Faza 3a)
  theory/candidates.js     generează acordurile compatibile cu melodia, etichetate pe tehnică (Faza 3a)
  theory/scoring.js        scoruri pentru un reharm: clash, bas, densitate, coerență (Faza 3a)
  theory/realize.js        simboluri → voicings cu voice leading, bas și melodie (Faza 3b)
  ui/drill.js              starea drill-ului: setări, acordul următor, localStorage
  ui/keyboard.js           claviatura SVG, colorată pe rol, cu taste care răspund la click
  ui/onscreen.js           clapa de ecran ca intrare: armare + Enter, literele ca pian, ecou spre synth
  ui/render.js             randare DOM, fără logică de teorie aici
  ai/client.js             apel spre proxy (Faza 3a)
  ai/prompts.js            toate prompturile, versionate (Faza 3a)
  ai/explain.js            explain & suggest din drill: input, validarea sugestiilor prin analizor (Faza 3a)
  ai/pipeline.js           execute: candidați → apel → validare → scoruri (Faza 3a); plan și review (Faza 3b)
  audio/synth.js           synth Web Audio în forma unui port MIDI out (demo mode)
  audio/piano.js           pian din sample-uri, același fel de port; fără înregistrări, apelantul rămâne pe synth
demo/manifest.json         mereu publicat: numește fișierele demo care există, sau null (fără 404 în consolă)
demo/piece.json            piesa demo (grilă + melodie); demo/reharm.json, răspunsul salvat — nepublicate încă
styles/*.json              profiluri de stil ca date (Faza 5)
eval/pieces/*.json         piese de test din domeniul public (Faza 5)
eval/run.js                rulează pipeline-ul pe piesele de test și raportează metrici (Faza 5)
eval/compare.js            execute singur vs plan + execute + review pe o piesă, de N ori (Faza 3b; sămânța lui run.js)
eval/reports/*.json        rapoartele măsurătorilor, păstrate ca dovadă
harness/replay.js          reia sesiunile salvate și raportează ce s-a schimbat (--update acceptă)
harness/sessions/*.json    sesiuni înregistrate de aplicație („Save session"), reluate și în CI
worker/                    Cloudflare Worker — proxy Anthropic, fără logică (Faza 3a)
mic-proto/                 prototipul de microfon, măsurat și închis (verdict în docs/spec-mic.md);
                           folder izolat, cu package.json propriu; src/ nu importă nimic din el
test/                      *.test.js, rulate cu node --test
tools/quiet-report.mjs     rulează testele și rezumă (vezi antetul: numele din tools/ nu au voie
                           să semene cu test-*, *-test, *_test sau *.test, altfel runner-ul le execută)
tools/cold-start.mjs       măsoară o primă vizită cu adevărat rece pe site-ul publicat: Chrome headless pe
                           profil nou, până la primul acord judecat; fără dependențe (DoD-ul P1)
.github/workflows/test.yml CI: npm test pe Node 22 și 24, la fiecare push (Faza 1)
package.json               fără dependențe: "type": "module" + npm test (și test:quiet)
README.md                  engleză, cu GIF/video demo
CLAUDE.md                  acest fișier, în repo (public odată cu repo-ul, la Faza 4)
docs/PRODUCT.md            scopul produsului: poziționare, fazele P0–P4, reguli de scop (sursa de adevăr)
docs/spec-*.md             specificațiile pe module: capture, analyzer, reharm
docs/PHASES.md             fazele 0–5 cu DoD și vechiul scope guard
docs/JOURNAL.md            jurnalul sesiunilor
docs/design/BRIEF.md       briefingul de brand pentru claude.ai/design (engleză)
assets/                    brandul: favicon, sidekeys.ico (iconița de Windows, generată din icon-512.png),
                           mărci, lockup-uri, imaginea OG, BRAND.md (specificația designerului);
                           fonts/ are Sora găzduit local, cu licența OFL.txt
```

Regula de dependență: `app/` importă din `src/`, niciodată invers. `theory/` nu importă nimic din `midi/`, `ui/` sau `ai/`. `midi/` nu știe de UI. `ai/` importă din `theory/` (pentru analiză și candidați) dar nu invers. UI-ul e singurul care le leagă. Worker-ul nu conține logică muzicală și nu conține prompturi — doar adaugă cheia și limitează cererile; prompturile stau în `ai/prompts.js`, vizibile în repo.

## Starea curentă

La 2026-10-27. **Cum s-a ajuns aici stă în [docs/JOURNAL.md](docs/JOURNAL.md)**, nu aici: secțiunea
asta se citește la fiecare sesiune, deci ține doar ce e adevărat acum, ce e nedecis și ce așteaptă
pe Edi. Regulile de teorie stau în `docs/spec-*.md`, nu în povestea care le-a produs.

### Ce există și merge

- **Motorul** (`src/theory/`, `src/game/`, `src/midi/`, `src/audio/`): JS pur, fără dependențe,
  **424 teste** verzi, CI pe Node 22 și 24. Local, `npm run test:quiet`.
- **Jocul**, în shell-ul din `app/` (Vite + TS + Svelte 5): Azi, Drumul, Jocul, Rezultatul, plus
  **Training** și **Theory**, peste opt unități (Triade → ii–V–I), **toate deschise**. Stele
  Right/Clean/Smooth, streak, Review zilnic pe calități, challenge zilnic partajabil, PWA care
  merge fără rețea. **Fără XP și fără „boss"** (scoase pe 2026-10-12). Regulile:
  [docs/spec-game.md](docs/spec-game.md).
- **Jocul vorbește română** (2026-10-27): ecranele, mesajele analizorului, numele unităților și
  nivelelor, paginile de teorie, plus un **Glosar** (pagină în Teorie și termeni subliniați în joc).
  Engleza rămâne implicită; comutatorul `EN | RO` e în antet. Regulile:
  [docs/spec-i18n.md](docs/spec-i18n.md).
- **Acordul următor e mereu pe ecran**, lângă cel cerut, inclusiv în măsura de numărătoare: altfel
  o trecere în timp nu putea cădea pe timpul 1.
- **Clapa se conectează o dată**, din antet, și rămâne conectată între nivele; la vizitele
  următoare se reconectează singură dacă Chrome are deja permisiunea.
- **Training**: drill liber (calități, tonalități, formă opțională) și progresii din bibliotecă în
  buclă, cu metronom care se pornește și se oprește fără să încheie sesiunea. Fără stele; minutele
  și punctele slabe contează.
- **Theory**: o pagină pe unitate, cu exemple colorate de analizor și cântate la clic. Textul l-a
  scris Claude; Edi l-a citit și l-a acceptat pe 2026-10-12.
- **O triadă cere toate trei notele** (fundamentală, terță, cvintă); septacordurile lasă în
  continuare fundamentala și cvinta altcuiva. **Dominantul quartal** (7, 3, 13, 9) e construit de
  generator, deci unitatea Quartal și Training îl pot cere.
- **Ortografia**: niciun Cb, Fb, B#, E# sau dublu accident în ce citește jucătorul; acordurile cu
  terță mică pe Db și Gb se scriu din C# și F# (`C#m/E`, `F#m/A`). `Abm` rămâne `Abm`.
- **Laboratorul** (`index.html` + `src/ui/`), publicat la **`/lab/`**: grila scrisă de mână,
  înregistrarea melodiei, aranjamentul pe Genos, reharm-ul. Drill-ul și progresiile lui au acum și
  o variantă în joc (Training).
- **Harness-ul**: port MIDI virtual, banda sesiunii, reluare în Node și în CI pe trei sesiuni
  înregistrate. Jocul, Training și reluarea folosesc **aceeași** `snapshotTarget`, deci nu pot
  ajunge să spună lucruri diferite. Toată ziua de azi a lăsat reluarea neschimbată: 110 din 110.
- **Sunetul e un pian adevărat** (Salamander Grand, CC BY 3.0, cu creditul jos, pe lista din Theory; licența cere atribuirea pe site).
- **Lansarea**: `start.cmd` (iconița de pe desktop) deschide jocul **publicat** într-o fereastră
  proprie, fără server; `dev.cmd` pornește serverul de dezvoltare, `dev.cmd lab` adaugă bancul
  și proxy-ul.

### Publicat

**Tot ce s-a făcut pe 2026-10-12 e împins și publicat** (seara, la cererea lui Edi): jocul la
rădăcină, bancul la `/lab/`. Iconița de pe desktop deschide deci versiunea de azi. Un browser care
a mai vizitat site-ul poate arăta o dată versiunea veche, până își înnoiește service worker-ul.

**La fel și ce s-a făcut pe 2026-10-13** (primul răspuns care rămâne, cele șase chei, unealta de
măsurat): împins, cu testele și publicarea trecute pe GitHub.

**Româna (2026-10-27) e împinsă și publicată**: push-ul l-a făcut Claude la 23:29, imediat după
ultimul commit, fără să-l treacă în jurnal (corectat pe 2026-10-28). Verificat pe 2026-10-28:
pachetul servit de Pages conține textul românesc și glosarul.

### Ce nu există încă

- **Unitatea Comping** lipsește din drum: cere Gig Mode, care nu e scris.
- **Testul de plasare**: nu există; de aceea toate unitățile sunt deschise.
- **Exemplele din Theory sunt doar în Do**: transpunerea ar trebui verificată tonalitate cu
  tonalitate, din cauza limitelor de registru grav.

### Verificat pe hardware (Genos)

- Pornirea MIDI, aranjamentul complet și Stop-ul din Laborator (2026-10-05).
- **Shell-ul a văzut prima dată Genos-ul pe 2026-10-12**: Edi a jucat drumul și a găsit opt
  probleme, toate rezolvate în aceeași zi (jurnal).
- **Neconfirmat pe Genos**: ce a venit după verificarea lui Edi — triada care cere trei note,
  dominantul quartal, primul răspuns care rămâne într-un timed, cele șase chei noi.
- **Confirmat de Edi pe Genos în seara de 2026-10-12** („am verificat pe Genos, este totul în
  regulă"): conexiunea care rămâne între nivele, acordul următor în timed, Training.
- **Clapa de ecran pe telefon** (două octave, săgeți, fără scurtături) a fost încercată de Edi pe
  telefonul lui pe 2026-10-28: „E bine așa”. Tot din 2026-10-28, fără Genos: click-ul care sună,
  albirea după 1,5 s, greșeala care te ține pe acord, triada strictă.
- **Româna n-a fost văzută pe Genos**: e probată doar în browser, cu clapa de ecran, deși e
  deja publicată.
- **Neauzit de nimeni altcineva decât Edi**: Claude a verificat sunetul (metronom, exemplele din
  Theory) numai prin absența erorilor, nu cu urechea.

### Decizii care nu se schimbă (și de ce)

- **Worker-ul nu se publică** (Edi, 2026-09-20): site-ul public nu face niciun apel AI.
- **Modul microfon rămâne închis**: 45% față de pragul de 90% ([docs/spec-mic.md](docs/spec-mic.md)).
- **Reharm-ul cu apel AI e înghețat** (`ai/pipeline.js`). Aranjamentul **nu** e reharm.
- **Poarta P1 e suspendată** până există amândouă, clipul și formularul (`PRODUCT.md`).
- **Id-urile ultimelor nivele se termină în `-boss`**, deși „boss" nu mai există: sunt cheile sub
  care se salvează stelele.

### Ce așteaptă pe Edi

- **Să asculte pianul** și să spună dacă stratul de velocitate (v9 din 16) e potrivit.
- **Să posteze reel-ul** pe TikTok și Instagram (`Reels/out/sidekeys-reel.mp4`, aprobat pe
  2026-10-28; în README e din aceeași zi, ca video încărcat pe GitHub, în copia comprimată
  `sidekeys-reel-web.mp4`, sub limita de 10 MB). Postarea cere întâi planul **Starter** la
  ElevenLabs: pe gratuit, vocea și muzica nu au licență comercială. Ziua primei postări pornește
  ceasul porții P1.
- **Să șteargă cheia API ElevenLabs** din cont și fișierul `Reels/cheie api eleven labs.txt`:
  a apărut în conversația din 2026-10-28, din greșeala lui Claude. Conectorul nu are nevoie de ea.
- **Să încerce formularul cu adresa lui**, după publicare: Claude nu a trimis nicio adresă de probă.
- **La P2, nu acum**: opinie de marcă pe familia „Sidekick".

### Cioburi de care te lovești dacă nu le știi

- **Garda din `.claude/hooks/guard.mjs` oprește închiderea sesiunii când scade numărul de teste.**
  Pragul (`testFloor`) urcă singur și se coboară numai cu acordul lui Edi. Când ștergerea e
  intenționată, întrebarea se pune cu `AskUserQuestion`: un mesaj obișnuit nu deblochează garda.
- **Heredoc-urile din Bash strică două lucruri**: pică la un număr impar de apostrofuri și
  înghit un backslash din două. Un script cu regex sau cu text în proză se scrie cu unealta Write.
- **Serverul de dezvoltare** se pornește din `.claude/launch.json` (`sidekeys-shell`, portul
  5173) sau cu `dev.cmd`.
- **Prototipul celor patru ecrane**, aprobat, trăiește în afara repo-ului:
  https://claude.ai/artifact/LwezgTTnCurF57ZN1DecAY
- **Pornirea la rece e măsurată** (`node tools/cold-start.mjs`, cifrele în `PRODUCT.md` la P1):
  sub 1,3 s până la verdictul primului acord, chiar și pe 4G lent. Partea omului nu e măsurată.
- **Ce primește modelul în `ai/explain.js` rămâne scris ca pe hârtie** (Cb pe Db7, cu
  `spellDegree`): Laboratorul afișează nume simple din 2026-10-28, dar intrarea modelului nu s-a
  schimbat, ca să nu schimbe răspunsurile fără o evaluare. Dacă modelul scrie „Cb” în motivația lui,
  de acolo vine. Reharm-ul e oricum înghețat.
- **Aranjamentul din Laborator primește acum și dominantul quartal** de la `suggestVoicings`;
  testele lui `realize.js` trec, dar nimeni nu a ascultat un aranjament de atunci.
- **Sesiunile din `harness/sessions/`** poartă `"app": "voicing-lab"`; nu se rescriu.
- **Creditul pianului stă jos pe lista din Teorie**, mic: licența CC BY 3.0 cere atribuirea pe
  site, deci nu se scoate de tot (README-ul nu ajunge la cine aude pianul).
- **Necommis**: `Voicing Lab ca produs.pdf`, care nu intră în repo.
- **`Reels/` e ignorat de git**: mașinăria de reel-uri (captura jocului publicat cu o clapă MIDI
  simulată, compoziția HTML cadru cu cadru, mixajul ffmpeg) și o cheie API. Se reface cu
  `node Reels/capture.mjs`, apoi `node Reels/render.mjs` (`mux` remixează doar sunetul).
  ffmpeg e instalat prin winget, dar nu e în PATH-ul sesiunilor deja pornite.
- **ElevenLabs, prin conector, rulează o singură generare odată**: mai multe deodată dau 429
  („too many requests”) și nu taxează nimic. Se pornesc pe rând, cu câte o variantă.
- **Svelte taie spațiul de la începutul unui bloc `{#if}`**: un text care trebuie să înceapă cu
  spațiu se scrie ca expresie, `{' — '}`. Așa lipsea spațiul din „Clean— Rootless A” (reparat pe
  2026-10-28; reel-ul îl arată încă fără).

## Următorul pas

**Ziua în care Edi postează reel-ul**: clipul e gata și e în README (2026-10-28), deci postarea pe
rețele pornește ceasul porții P1 (40 de adrese în 4 săptămâni). Data se scrie în `PRODUCT.md`, la
poarta P1, iar ceasul se urmărește de acolo.

Ce se poate face fără Edi, în ordinea asta:

1. **Un om cronometrat** la prima vizită: pornirea la rece e măsurată doar pe partea mașinii.
   Cere un om care n-a văzut jocul; Claude nu-l poate face singur.

Idei care **nu** sunt lucru aprobat și nu se încep fără Edi: exemplele din Theory în alte
tonalități, testul de plasare, quartal pe m6, dominanta pe treapta de sus a challenge-ului.
Regula „niciun feature care nu e pe lista fazei curente" se aplică.

## Documentație

| Fișier | Ce conține | Când se citește |
|---|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | poziționarea, ce iese din v1, fazele P0–P4 cu porțile lor, regulile de scop | la începutul fiecărei sesiuni |
| [docs/DIRECTION.md](docs/DIRECTION.md) | consemnarea deciziei din 2026-10-11: diagnosticul, pitch-ul, mecanicile de joc, ecranele, livrarea, și deciziile încă deschise | când se caută *de ce* arată produsul așa, sau o mecanică de joc |
| [docs/spec-capture.md](docs/spec-capture.md) | snapshot-ul de voicing: debounce, staccato, nota de „next", canalele; harness-ul: portul virtual, banda sesiunii, reluarea | `midi/capture.js`, `midi/input.js`, `midi/virtual.js`, `ui/tape.js`, `harness/` |
| [docs/spec-analyzer.md](docs/spec-analyzer.md) | parserul de chord symbol, tabelul calităților, clasificarea voicing-ului, voice leading | `theory/chords.js`, `analyzer.js`, `voiceLeading.js`, `voicings.js` |
| [docs/spec-reharm.md](docs/spec-reharm.md) | piesa, recorder-ul, analiza, candidații, pipeline-ul AI și Worker-ul, scorurile, validarea, realizarea, partenerul de studiu, evaluarea | `piece.js`, `recorder.js`, `analysis.js`, `candidates.js`, `scoring.js`, `realize.js`, `player.js`, `ai/`, `worker/`, `eval/` |
| [docs/spec-game.md](docs/spec-game.md) | stelele (Right · Clean · Smooth) cu pragurile măsurate, ce e deschis pe drum, antrenamentul zilnic și challenge-ul zilei | logica de scor a jocului, `src/game/`, orice progresie nouă în bibliotecă |
| [docs/spec-i18n.md](docs/spec-i18n.md) | cele două limbi: ce se traduce și ce nu, unde stau cheile, regula „cheie nouă în ambele limbi”, pluralul, glosarul și cum se adaugă un termen | orice text nou pe ecranele jocului, o pagină de teorie, un termen de glosar |
| [docs/spec-mic.md](docs/spec-mic.md) | prototipul de microfon: ce s-a măsurat, cum, cifrele și verdictul | `mic-proto/`; dacă se reia vreodată modul microfon |
| [docs/PHASES.md](docs/PHASES.md) | planul inițial pe faze 0–5, cu DoD-urile și vechiul scope guard | **istoric**: toate fazele de acolo sunt bifate. Se citește doar dacă se caută un DoD vechi |
| [docs/session-log/](docs/session-log/) | rapoarte de predare, scrise la finalul sesiunilor lungi (ultimul: `2026-10-13-1047.md`) | când o sesiune se închide cu mult context de predat |
| [docs/JOURNAL.md](docs/JOURNAL.md) | jurnalul sesiunilor, cu deciziile și cifrele măsurate | la final (intrare nouă); istoricul, la nevoie |
