# Voicing Lab — PHASES.md

Planul inițial pe faze (Faza 0–5), cu Definition of Done, și scope guard-ul lui. Mutat neschimbat din `CLAUDE.md` pe 2026-09-19. Scopul, ordinea și regulile de scop de acum sunt în `docs/PRODUCT.md` (fazele P0–P4); fazele de aici rămân referința pentru DoD-urile la care trimite P0 (Faza 3b, Faza 4). Unde scope guard-ul de mai jos contrazice „Reguli de scop" din `PRODUCT.md` (conturi, backend, TypeScript, bundler, intrare audio), câștigă `PRODUCT.md`.

Trimiterile din text se referă la vechiul `CLAUDE.md`: numele proiectului e acum în `CLAUDE.md`, ordinea avertismentelor în `docs/spec-analyzer.md`, „Specificația reharmonizării" și „6. Partener de studiu" în `docs/spec-reharm.md`.

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
