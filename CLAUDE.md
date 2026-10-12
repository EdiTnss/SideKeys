# SideKeys — CLAUDE.md

Antrenor de voicings și reharmonizare pentru pianiști de jazz. Conectezi clapa (Yamaha Genos) prin USB-MIDI la browser, aplicația îți cere un acord, tu îl cânți, iar ea îți spune instant ce ai cântat (tip de voicing, tensiuni, note evitate, calitatea voice leading-ului). În fazele următoare, Claude propune alternative și reharmonizări pe care le auzi direct pe Genos prin MIDI out.

Din 2026-10-11, SideKeys e un **joc**, nu un panou de control: același motor, servit ca drum cu unități, nivele, stele și un challenge zilnic, pentru oricine cântă din acorduri — de la triade până la jazz. Direcția și ordinea de construcție sunt în [docs/DIRECTION.md](docs/DIRECTION.md).

Numele e **SideKeys**, ales de Edi pe 2026-09-20: repo `EdiTnss/SideKeys`, GitHub Pages pe `editnss.github.io/SideKeys`. Proiectul s-a numit **Voicing Lab** până atunci; s-a redenumit pentru că numele se lovea de **VoicingLab Ltd**, companie britanică activă cu produs plătit pentru exact aceiași pianiști, iar în aceeași nișă mai stă și JazzPianoLab. De aici încolo numele nu se mai schimbă: GitHub Pages nu face redirect după redenumire, deci fiecare redenumire omoară link-ul demo — acum a costat puțin doar pentru că nu-l văzuse încă nimeni. Verificarea `Origin` din Worker nu depinde de numele repo-ului: header-ul `Origin` conține doar `https://editnss.github.io`, fără cale. `package.json` păstrează `"name": "sidekeys"` (npm cere litere mici). Ce a salvat un browser sub numele vechi (setări, piese, statistici) se mută singur la prima citire, prin `src/storage.js`.

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
- **Teste**: `node --test` (test runner-ul încorporat în Node, fără instalare; Node ≥ 22 — 20 a ieșit din suport în aprilie 2026), pornit cu `npm test`. CI pe GitHub Actions rulează `npm test` pe Node 22 și 24 la fiecare push, cu badge în README; GitHub pornește o singură rulare per push, pe ultimul commit, deci commit-urile `test:` roșii dinaintea `feat:` nu produc rulări roșii dacă se împing împreună. `package.json` există doar pentru `"type": "module"` (Node tratează `.js` ca ES modules pe orice versiune) și scriptul de test — **fără nicio dependență**. Modulele din `src/theory/` sunt JS pur, fără DOM, exact ca să poată fi testate în Node. Fără framework de test în shell până nu cere ceva anume: logica nouă de scor (stele, XP) se scrie testabilă cu `node --test`, ca restul.
- **Deploy**: GitHub Pages (static, HTTPS → Web MIDI merge). Proxy-ul AI din Faza 3a e separat, pe Cloudflare Workers.
- **Cheia Anthropic nu ajunge niciodată în frontend sau în repo.** Doar în variabilele de mediu ale Worker-ului (local în `worker/.dev.vars`, ignorat de git).
- Excepțiile de la „zero dependențe" sunt trei, toate foldere izolate cu `package.json` propriu, din care `src/` nu importă nimic: `worker/` (cu `wrangler` ca dev dependency, pentru rulare locală și deploy) și `mic-proto/` (cu `@spotify/basic-pitch`, care aduce TensorFlow.js — aprobat de Edi pe 2026-09-24, pentru prototipul de microfon). A treia e **`app/`**, shell-ul nou (Vite + TypeScript + Svelte 5), aprobat de Edi pe 2026-10-11 odată cu direcția din `DIRECTION.md`. Aplicația din `src/` nu importă nimic din npm și nimic din `app/`. O a patra excepție se cere explicit.
- **Limbă**: cod, comentarii, commit-uri, README, UI — engleză (recrutorii citesc repo-ul). Acest fișier, `docs/` și discuțiile — română.
- Commit-uri mici, mesaje în stil `feat:`, `fix:`, `test:`, `docs:`.
- Audio: MIDI out spre Genos e sunetul principal. Web Audio (sintetizator simplu) doar ca fallback pentru demo mode.

## Structura repo-ului

```
app/                       shell-ul (Vite + TS + Svelte 5), cu package.json propriu și versiuni fixate
  vite.config.ts           fs.allow pe rădăcina repo-ului, ca ../src să poată fi importat neatins
  svelte.config.js         runes only: fără stores, fără `export let`, fără `$:`
  src/App.svelte           ține progresul, prețuiește o trecere înainte s-o înregistreze, alege ecranul
  src/bridge/theory.ts     ușa spre teorie: analizor, acorduri, stele, mapările de clape
  src/bridge/midi.ts       ușa spre note: capture, porturi virtuale, synth, clapa de ecran
  src/lib/instrument.svelte.ts  sesiunea MIDI în runes: ce ține mâna, ce e armat, ce aparat e conectat
  src/screens/Game.svelte  ecranul de joc: acordul cerut, clapa, verdictul, progresul nivelului
  src/screens/Result.svelte  rezultatul trecerii: stele, XP, un singur lucru de reparat
  src/game/level.svelte.ts   nivelul: cererile, încercările, metronomul și ce acord răspunde un voicing
  src/bridge/time.ts       ușa spre ceas: metronomul, sesiunea, regula de anticipare
  src/bridge/game.ts       ușa spre drum: unitățile, deblocarea, stelele și XP-ul salvate
  src/screens/Path.svelte  harta: unități, nivele, lacăte, stele
  src/screens/Today.svelte ecranul de start: streak, minute, „continuă drumul", antrenamentul
  src/lib/Keyboard.svelte  învelește src/ui/keyboard.js; Svelte decide când se colorează
  src/lib/clipboard.ts     copiază un text și spune dacă a reușit (grila zilei, în două ecrane)
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
  theory/stars.js          stelele: isRight / isClean pe acord, scoreRun și xpFor pe trecere (docs/spec-game.md)
  game/path.js             unitățile și nivelele ca date, cererile lor și regulile de deblocare; testat
  game/progress.js         stelele, XP-ul, zilele, streak-ul, coada de recapitulare și grila zilei; testat
  game/challenge.js        challenge-ul zilei: seed din dată, rampa de 10, grila și textul partajat; testat
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

La 2026-10-12. **Cum s-a ajuns aici stă în [docs/JOURNAL.md](docs/JOURNAL.md)**, nu aici: secțiunea
asta se citește la fiecare sesiune, deci ține doar ce e adevărat acum, ce e nedecis și ce așteaptă
pe Edi. Regulile de teorie stau în `docs/spec-*.md`, nu în povestea care le-a produs.

### Ce există și merge

- **Motorul** (`src/theory/`, `src/game/`, `src/midi/`, `src/audio/`): JS pur, fără dependențe,
  **311 teste** verzi, CI pe Node 22 și 24. Local, `npm run test:quiet`.
- **Jocul**, în shell-ul din `app/` (Vite + TS + Svelte 5, `npm --prefix app run dev`): cele patru
  ecrane din prototip — Azi, Drumul, Jocul, Rezultatul — peste opt unități (Triade → ii–V–I), cu
  stele Right/Clean/Smooth, XP plafonat pe repetiții, streak, antrenament zilnic pe calități,
  challenge zilnic partajabil și PWA instalabilă care merge fără rețea. Regulile:
  [docs/spec-game.md](docs/spec-game.md).
- **Laboratorul** (`index.html` + `src/ui/`, `npx serve .`): drill, progresii, grilă text, metronom,
  statistici, aranjament pe Genos, reharm cu Claude dacă pornești Worker-ul local. Publicat la
  **`/lab/`** de pe 2026-10-12; tab-ul Reharm și „Ask Claude" rămân ascunse acolo, verificat pe viu.
- **Totul e publicat** din `.github/workflows/pages.yml`: jocul la rădăcină, bancul la `/lab/`,
  bancul copiat **după** build ca să nu intre în precache-ul PWA-ului.
- **Harness-ul**: port MIDI virtual (`?midi=virtual`), banda sesiunii, reluare în Node și în CI pe
  trei sesiuni înregistrate, una de 11 minute reale pe Genos. Jocul și reluarea folosesc **aceeași**
  funcție (`snapshotTarget`) ca să decidă ce acord răspunde un voicing, deci nu pot ajunge să spună
  lucruri diferite.
- **Sunetul e un pian adevărat**: 17 înregistrări din Salamander Grand Piano V3 (Yamaha C5), sub
  CC BY 3.0, cu creditul pe ecranul Azi fiindcă licența îl cere. `audio/synth.js` rămâne ca prima
  voce, până se decodează înregistrările, și ca plasă dacă manifestul lipsește.
- **Clapele răspund**: verdictul înflorește o dată pe notele cântate, nota greșită primește o
  împingere de un pixel, nota lipsă respiră. Numai transform, opacitate și filtru — nimic nu
  atinge layout-ul — și nicio culoare nouă. `prefers-reduced-motion` le oprește pe toate.
- **Brandul** e legat în pagină, cu o regulă portantă: accentul magenta nu atinge niciodată o clapă
  sau un verdict (`assets/BRAND.md`, comentariul din `styles.css`).

### Ce nu există încă

- **Unitatea Comping** lipsește din drum: cere Gig Mode, care nu e scris.
- **Laboratorul nu se reface în shell** (decizia 5, închisă pe 2026-10-12): rămâne pagina care e,
  publicată alături, la `/lab/`. Animațiile de clapă sunt doar în shell — bancul rămâne sobru.

### Verificat pe hardware (Genos)

- Pornirea MIDI: Genos apare ca intrare, e ales singur ca ieșire, literele `A S D F…` tac cât e
  conectat (2026-10-05).
- Aranjamentul complet, cu melodia deasupra, după repararea registrului (2026-10-05; regula, în
  [docs/spec-reharm.md](docs/spec-reharm.md)).
- Stop oprește cu adevărat redarea. Cauza găsită atunci rămâne valabilă: **Chrome nu implementează
  `MIDIOutput.clear()`**, deci `output.sendScheduled` predă felie cu felie, pe lookahead-ul
  metronomului.
- **Neverificat pe Genos: tot shell-ul.** Jocul a fost probat doar cu mouse-ul, clapa de ecran și
  portul virtual. „Connect a MIDI keyboard" cere permisiunea Chrome și se poate confirma doar la Edi.

### Decizii care nu se schimbă (și de ce)

- **Worker-ul nu se publică** (Edi, 2026-09-20): site-ul public nu face niciun apel AI, deci nu poate
  costa nimic. `PUBLISHED_PROXY_URL` rămâne gol, iar „Ask Claude" apare doar cu un proxy în Settings.
- **Modul microfon rămâne închis**: 45% măsurat față de pragul de 90%, cu tavan de 72% — nici cea mai
  bună regulă de prag nu ajunge ([docs/spec-mic.md](docs/spec-mic.md)). Se redeschide doar dacă se
  schimbă modelul, nu regula de citire.
- **Reharm-ul cu apel AI e înghețat** (`ai/pipeline.js`): dovadă tehnică, fără lucru nou. Aranjamentul
  (`realize.js`, `player.js`) **nu** e reharm — e unealta de comping, și e al produsului.
- **Piesa demo nu blochează nimic**: fără `demo/reharm.json`, tab-ul Reharm nu apare pe site.
- **Poarta P1 e suspendată** până există amândouă, clipul și formularul (`PRODUCT.md`).

### Ce așteaptă pe Edi

- **Drumul, pe Genos**: joacă lanțul (Azi → drum → un nivel în timp → o recapitulare) și corectează
  **conținutul** din `src/game/path.js`. Ordinea unităților și tempoul 120 sunt aprobate; tonalitățile
  și ce lipsește dintr-o unitate sunt teoria lui.
- **Să asculte pianul** și să spună dacă stratul de velocitate ales (v9 din 16) e potrivit: cu un
  singur strat, timbrul nu se schimbă cu forța, doar volumul. Se schimbă într-o comandă.
- **Să asculte pianul pe site-ul viu** și să spună dacă stratul de velocitate (v9 din 16) e
  potrivit. Cu un singur strat, timbrul nu se schimbă cu forța, doar volumul.
- **Formularul de email** (furnizor, GDPR, unde stau adresele) și clipul de 15 s / videoul de 60–90 s
  pentru README (`<!-- demo.gif -->` marchează locul).
- **La P2, nu acum**: opinie de marcă pe familia „Sidekick", clasele 9 și 41, înainte de înregistrare.

### Cioburi de care te lovești dacă nu le știi

- **Prototipul celor patru ecrane**, aprobat, trăiește în afara repo-ului:
  https://claude.ai/artifact/LwezgTTnCurF57ZN1DecAY
- **O vizită cu adevărat rece nu s-a putut măsura** din browserul de test (cache-ul HTTP servea tot,
  0 KB prin rețea). Ce se știe sigur: shell-ul e ~156 KB în 3 cereri, iar pianul se încarcă abia la
  intrarea într-un nivel, deci nu stă pe drumul către primul acord. DoD-ul de 30 de secunde din P1
  nu e în pericol, dar cifra lui o dă o măsurătoare pe un profil curat.
- **Sesiunile din `harness/sessions/`** poartă `"app": "voicing-lab"`, fiindcă au fost înregistrate
  înainte de redenumire. Nimic nu citește câmpul, și sunt înregistrări — nu se rescriu.
- **Necommis**: `Voicing Lab ca produs.pdf` (numele de pe disc, cum e în `.gitignore`), care nu intră
  în repo; analiza de piață stă în afara lui.

## Următorul pas

**Măsoară DoD-ul P1 pe site-ul publicat, dintr-un profil curat** (fereastră incognito, fără service
worker și fără cache): cronometrează de la deschiderea https://editnss.github.io/SideKeys/ până la
primul acord cântat pe clapa de ecran, și scrie cifra în `docs/PRODUCT.md`, la P1 — e singurul lucru
din fază care nu așteaptă nici pe Edi, nici clapa, iar cifra de până acum (187 ms) e dintr-un browser
cu cache cald, deci nu spune nimic despre un vizitator nou.

După aceea, în ordinea blocajelor:

1. **Formularul de email** — ultimul punct din P1. Așteaptă de la Edi furnizorul (Buttondown,
   ConvertKit, Tally, un Google Form) și unde stau adresele, fiindcă are coadă GDPR. După alegere,
   e un link sau un embed în pagină și în README.
2. **Edi joacă drumul pe Genos** și corectează conținutul din `src/game/path.js` — tonalitățile și ce
   lipsește dintr-o unitate. Tot atunci se confirmă și clapa reală în shell, singurul lucru
   neverificat pe hardware.
3. **Clipul de 15 s** pentru README (`<!-- demo.gif -->` marchează locul). Împreună cu formularul,
   pornește ceasul porții P1: 40 de adrese în 4 săptămâni.

Ordinea din `PRODUCT.md` nu se scurtcircuitează — buclă → structură → meta-joc — iar regula „niciun
feature care nu e pe lista fazei curente" se aplică și când ideea e bună.

## Documentație

| Fișier | Ce conține | Când se citește |
|---|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | poziționarea, ce iese din v1, fazele P0–P4 cu porțile lor, regulile de scop | la începutul fiecărei sesiuni |
| [docs/DIRECTION.md](docs/DIRECTION.md) | consemnarea deciziei din 2026-10-11: diagnosticul, pitch-ul, mecanicile de joc, ecranele, livrarea, și deciziile încă deschise | când se caută *de ce* arată produsul așa, sau o mecanică de joc |
| [docs/spec-capture.md](docs/spec-capture.md) | snapshot-ul de voicing: debounce, staccato, nota de „next", canalele; harness-ul: portul virtual, banda sesiunii, reluarea | `midi/capture.js`, `midi/input.js`, `midi/virtual.js`, `ui/tape.js`, `harness/` |
| [docs/spec-analyzer.md](docs/spec-analyzer.md) | parserul de chord symbol, tabelul calităților, clasificarea voicing-ului, voice leading | `theory/chords.js`, `analyzer.js`, `voiceLeading.js`, `voicings.js` |
| [docs/spec-reharm.md](docs/spec-reharm.md) | piesa, recorder-ul, analiza, candidații, pipeline-ul AI și Worker-ul, scorurile, validarea, realizarea, partenerul de studiu, evaluarea | `piece.js`, `recorder.js`, `analysis.js`, `candidates.js`, `scoring.js`, `realize.js`, `player.js`, `ai/`, `worker/`, `eval/` |
| [docs/spec-game.md](docs/spec-game.md) | stelele (Right · Clean · Smooth) cu pragurile măsurate, XP-ul, antrenamentul zilnic și challenge-ul zilei | logica de scor a jocului, `src/game/`, orice progresie nouă în bibliotecă |
| [docs/spec-mic.md](docs/spec-mic.md) | prototipul de microfon: ce s-a măsurat, cum, cifrele și verdictul | `mic-proto/`; dacă se reia vreodată modul microfon |
| [docs/PHASES.md](docs/PHASES.md) | planul inițial pe faze 0–5, cu DoD-urile și vechiul scope guard | **istoric**: toate fazele de acolo sunt bifate. Se citește doar dacă se caută un DoD vechi |
| [docs/session-log/](docs/session-log/) | rapoarte de predare, scrise la finalul sesiunilor lungi | când o sesiune se închide cu mult context de predat |
| [docs/JOURNAL.md](docs/JOURNAL.md) | jurnalul sesiunilor, cu deciziile și cifrele măsurate | la final (intrare nouă); istoricul, la nevoie |
