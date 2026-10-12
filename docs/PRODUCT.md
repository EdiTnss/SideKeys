# SideKeys — PRODUCT.md

Ce construim, pentru cine, și în ce ordine. Deciziile de teorie și de implementare stau în
`CLAUDE.md` și în `docs/spec-*.md`; aici stă doar scopul produsului.

Analiza completă de piață, economia și partea juridică nu sunt în repo (repo-ul devine public
în Faza 4). Trăiesc în documentul „SideKeys ca produs" din Claude.

## Poziționare

**SideKeys e profesorul care stă lângă tine și îți spune ce ai greșit la mâini.**

Nu „te învață cântece" — asta fac zece aplicații. Te ascultă cum cânți din acorduri și te
corectează: tipul de voicing, note lipsă, note greșite, low interval limits, voice leading,
dublări, puncte slabe în timp. Toate se calculează determinist, în browser, din codul care
există deja în `theory/`.

Utilizatorul țintă: **oricine cântă din acorduri și are o clapă lângă un calculator** —
clapiștii de trupă, pianiștii de biserică, cei care acompaniază o voce, cei care vor să cânte
din lead sheet, până la pianistul de jazz care studiază serios. Un singur produs, un singur
drum: începătorul intră la nivelul 1 (triade), avansatul face un test de plasare de ~60 de
secunde și sare la unitatea lui. Nu facem două produse.

Ce rămâne în afară: utilizatorul de iPad, până la shell-ul nativ din livrarea 4 (Safari nu are
Web MIDI), și cine vrea să învețe partituri notă cu notă — pentru asta există Simply Piano.

## Ce iese din scopul v1

**Reharm-ul cu apel AI iese din produs.** `ai/pipeline.js`, `candidates.js`, `analysis.js` și
`scoring.js` rămân în repo, în demo-ul public și în README, ca dovadă tehnică a arhitecturii
hibride, și nu primesc lucru nou. **Reharm-ul determinist revine** (2026-10-11), ca nivel avansat
de joc: „găsește substituția care merge peste melodia asta", validat în `candidates.js` +
`piece.js`, fără niciun apel AI. Motivul e același de atunci — coerența cu poziționarea: judecăm
*cum* ai cântat, nu generăm muzică în locul tău.

Consecințe pentru cod:
- Worker-ul rămâne proxy simplu: `Origin`, cheie, limită pe IP, plus token și un contor pentru
  `explain`. Fără cotă complexă, fără alegere de model, fără job de noapte, fără Batch API.
- `explain` din drill rămâne singurul apel AI din produs. Sub un cent, ~3 secunde.
- `pipeline.js` rămâne înghețat și testat: el e apelul AI, deci el e dovada adormită din demo.
  `candidates.js`, `analysis.js` și `scoring.js` **nu** sunt înghețate — sunt cod determinist, iar
  puzzle-ul de reharm din P3 se sprijină pe ele (corectat pe 2026-10-11, în aceeași capcană ca
  `realize.js` mai jos: o linie care numea fișiere, nu comportamente).
- **Excepție, corectată pe 2026-10-10**: `realize.js` și `player.js` **nu sunt reharm, sunt aranjamentul**
  — transformă orice piesă (grilă + melodie înregistrată) în bas, strat de acord și melodie, fără niciun
  apel AI. Asta e unealta de comping din poziționare, deci aparține produsului și poate fi atinsă. Linia
  de mai sus le trecuse greșit printre fișierele înghețate, iar greșeala s-a văzut când cele două reparații
  din 2026-10-05 (registrul, și Stop-ul care nu oprea) au atins `realize.js` fără ca nimeni să semnaleze
  contradicția. Consecința reală era mai gravă decât litera: butoanele de redare stăteau în tab-ul Reharm,
  care e ascuns pe site-ul publicat, deci unealta de comping era invizibilă pentru orice vizitator. Mutate
  în tab-ul Progression pe 2026-10-10 (decizie Edi), lângă grilă, melodie și Save/Load. În tab-ul Reharm
  rămâne doar „Reharmonize" și răspunsul: dovada, adormită.

## Ce NU se atinge

`src/theory/**` rămâne JS pur, fără DOM, fără dependențe, testat cu `node --test`. Motivele nu
mai sunt doar comerciale, sunt structurale: pe același cod stau exercițiile generate procedural
(12 tonalități × calități × tipuri de voicing), scorurile deterministe (stele, XP) și, când va
exista clasament, verificarea anti-trișat pe server — aceeași funcție, trei locuri. **Testele din
`test/`** sunt singura garanție că produsul nu strică teoria; numărul lor curent e în badge-ul din
README, nu scris aici, ca să nu rămână în urmă.

Shell-ul nou importă `theory/` **neatins**: fără TypeScript în `theory/`, fără bundler pentru
modulele de teorie, fără conturi de utilizator în ele. TypeScript doar pe codul nou.

## Fazele produsului

Fiecare fază se termină cu o poartă măsurabilă. Dacă poarta nu se deschide, nu se scrie mai
mult cod — se repară ipoteza.

### P0 — Închidem ce avem (săptămânile 1–2)

- [x] Execuția pe fraze pentru piese peste 32 de măsuri (ultimul punct din Faza 3b).
- [x] Harness de verificare permanent: port MIDI virtual + sesiuni înregistrate care se reiau.
- [x] Spargerea lui `CLAUDE.md` în reguli / jurnal / specificații.
- [x] Faza 4: demo mode, claviatură pe ecran, `audio/synth.js`, repo public, Pages. **Worker-ul
  rămâne nepublicat**, prin decizia lui Edi din 2026-09-20 — site-ul public nu face niciun apel
  AI, deci nu poate costa nimic. Punctul ăsta a stat nebifat o lună fiindcă enumera și partea
  scoasă din scop; restul era gata din 20 septembrie.
- [x] Prototip de intrare pe microfon cu `basic-pitch-ts`, măsurat pe 20 de voicings.
  Prag de acceptare: peste 90% identificate corect **cu octava exactă**. **Măsurat 2026-09-24:
  45%**, cu tavan de 72% pe 93 de voicings — pragul nu trece, modul microfon din P4 rămâne
  închis. Verdictul și metoda: [docs/spec-mic.md](spec-mic.md).

**DoD:** demo-ul public merge fără clapă; harness-ul reia o sesiune înregistrată și raportează;
verdictul microfonului e scris în jurnal.

#### Cerințe ferme pentru demo mode

Nu sunt propuneri; se respectă sau se renegociază explicit cu Edi înainte de cod.

1. **Reharm-ul din demo servește un rezultat pre-calculat, salvat în repo. Niciun apel live.**
   Worker-ul limitează o singură dată, pe IP, fără să deosebească acțiunile: un `execute` costă
   în jur de 25 de cenți, deci un demo public cu apel live poate fi golit de buzunar de un singur
   vizitator. Dacă la un moment dat chiar e nevoie de un apel live în demo, condiția prealabilă e
   o limită separată, mult mai strânsă, pe acțiunile scumpe.
2. **Verdictul spune pentru ce acord a fost dat.** În timed, un voicing început în fereastra de
   anticipare e judecat pe acordul următor, cât ecranul îl arată încă pe cel curent — la tempo
   lent, diferența se vede. Panoul de feedback scrie simbolul acordului judecat, iar când a fost
   o anticipare o marchează ca atare. Decizie luată de Claude din Cowork pe 2026-09-19, Edi o
   poate răsturna: varianta respinsă a fost întârzierea verdictului până la schimbarea ecranului,
   pentru că intră în conflict cu regula „feedback sub 100 ms" din `CLAUDE.md`; a doua variantă
   respinsă, acordul următor arătat estompat în fereastra de anticipare, adaugă pâlpâire înaintea
   fiecărei schimbări de acord, inclusiv când nu anticipezi nimic.

**Poarta P0** nu e „codul funcționează", ci **40 de adrese de email în 4 săptămâni de la primul
clip**.

**Suspendată pe 2026-10-05** (decizie Edi). Poarta cere două lucruri care nu există încă: un
clip și un loc unde cineva să lase o adresă — în `index.html`, `README.md` și tot `src/` nu e
niciun formular și niciun `mailto`. O poartă care nu se poate măsura nu e o poartă, iar un ceas
pornit la publicare (2026-09-20) ar expira pe 18 octombrie fără ca nimeni să fi avut vreodată
unde să lase un email. Până atunci **ceasul nu curge**, iar prioritatea e studiul, nu poarta.

Se reia când există amândouă: clipul în README și un formular găzduit, legat din pagină și din
README. Ceasul pornește atunci, de la primul clip, cum spune poarta. Amândouă sunt pe lista P1, deci
poarta se reia acolo, ca **poarta P1**.

### P1 — Jocul, prima livrare publică (~2 săptămâni)

Ordinea e obligatorie și nu se scurtcircuitează: **întâi bucla de bază să fie plăcută în sine,
apoi structura (drum, unități, nivele), abia apoi meta-jocul (XP, streak).**

- [x] Shell nou: Vite + TypeScript + Svelte 5, cu `theory/` importat neatins și testele verzi.
- [ ] Ecranul de joc: sunet de pian din sample-uri, feedback animat pe clape, stele. **Stelele sunt**
  (`theory/stars.js`) și **pianul sună** din 2026-10-12 (Salamander Grand, CC BY 3.0, 17 note).
  Rămâne nebifat pentru un singur motiv: feedback-ul pe clape **colorează, nu animează**.
- [x] Drumul, cu primele 2–3 unități (Triade, Inversiuni, Septacorduri) și boss-ul lor. **Opt unități**,
  Triade → ii–V–I; lipsește doar Comping, care cere Gig Mode.
- [x] Challenge-ul zilei, partajabil, fără cont. Rampă de zece acorduri, seed din dată, grilă de
  pătrățele; regulile și costul fiecărei decizii, în [spec-game.md](spec-game.md).
- [x] Ecranele Azi și Rezultat; progresul și streak-ul ținute local.
- [x] PWA instalabilă (manifest + service worker, offline). Worker scris de mână, fără dependență;
  lista de precache e generată din build, iar offline-ul a fost probat cu serverul oprit.
- [ ] Formular de email găzduit, legat din pagină și din README.
- [ ] **Shell-ul publicat pe Pages**, în locul Laboratorului. Adăugat pe 2026-10-12: faza se
  numește „prima livrare publică", dar nicio linie din listă nu publica nimic, iar GitHub Pages
  servește și azi `index.html`, pagina veche. Consecințele se văd deja — grila partajată a
  challenge-ului trimite la un site unde challenge-ul nu există, iar PWA-ul nu e instalabil de
  nicăieri. Cere o decizie legată: ce se întâmplă cu UI-ul vechi (decizia deschisă 5 din
  [DIRECTION.md](DIRECTION.md)).

**DoD:** un vizitator nou ajunge de la deschiderea paginii la primul acord cântat în sub 30 de
secunde, fără cont; un exercițiu ratat se întoarce în „antrenamentul tău" a doua zi și iese după
3 reușite.

**Poarta P1** (fosta poartă P0, repornită): **40 de adrese de email în 4 săptămâni de la primul
clip**. Ceasul pornește când există amândouă — clipul în README și formularul legat din pagină.
Până atunci rămâne suspendată, ca acum.

Ecranele, mecanicile de joc și țintele de fricțiune sunt în [DIRECTION.md](DIRECTION.md).

### P2 — Monetizare (săptămânile 7–10)

Din fostul P1, mutate aici fiindcă prima livrare nu are nevoie de cont (progresul stă local):
Supabase (auth, profiluri, istoric de studiu sincronizat, regiune UE), repetiția spațiată
completă (SM-2) peste `weakSpots`, primele 15 studii originale scrise de Edi. În P1 intră din
ele doar cât cere DoD-ul: un exercițiu ratat care revine a doua zi.

- **Specificația raportului de comping, ca document, înainte de orice cod.** Ce raportează, în
  ce ordine, cu ce praguri — la fel ca tabelul de calități al analizorului. Fără specificație
  aprobată, nu se scrie cod.
- Raportul v1 nu are nevoie de melodie înregistrată: registru, low interval limits, voice
  leading, varietate de texturi, puncte slabe. „Ai dublat melodia" e opțional, pentru cine
  înregistrează și melodia.
- Implementarea raportului + UI.
- Paddle sau Lemon Squeezy, tier-urile Gratuit și Pro, trial.
- Export și ștergere de cont, funcționale.

**DoD:** pe o sesiune de 4 chorusuri înregistrată de Edi, raportul spune cel puțin 5 lucruri
adevărate pe care el le confirmă, și niciunul fals.

### P3 și P4

Conținut (50 de studii, lecții), profiluri de stil ca date, import MIDI, mod microfon dacă
prototipul a trecut, mod profesor. Se detaliază când P2 e bifat.

## Reguli de scop

- **Niciun feature care nu e pe lista fazei curente.** Oricât de repede s-ar putea, oricât de
  bună ar fi ideea: intră în faza următoare, nu în asta.
- **Ordinea gamificării nu se inversează**: buclă → structură → meta-joc. Un streak pus înaintea
  unei bucle plăcute măsoară doar frecvența cu care oamenii se plictisesc.
- Test întâi pentru orice atinge `analyzer.js`, `chords.js`, formula de stele/XP, raportul de
  comping sau scheduler-ul de repetiție spațiată.
- Fără conturi de utilizator în `theory/`. Logica de teorie rămâne pură și rulabilă offline;
  doar cota și cheia stau pe server.
- Fără grile sau melodii de standarde în repo. Doar material original sau din domeniul public,
  verificat.
- Fără bucle de agenți, fără framework în `theory/`, fără bundler pentru modulele de teorie.
