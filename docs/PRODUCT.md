# Voicing Lab — PRODUCT.md

Ce construim, pentru cine, și în ce ordine. Deciziile de teorie și de implementare stau în
`CLAUDE.md` și în `docs/spec-*.md`; aici stă doar scopul produsului.

Analiza completă de piață, economia și partea juridică nu sunt în repo (repo-ul devine public
în Faza 4). Trăiesc în documentul „Voicing Lab ca produs" din Claude.

## Poziționare

**Voicing Lab e profesorul care stă lângă tine și îți spune ce ai greșit la mâini.**

Nu „te învață acorduri" — asta fac zece aplicații. Te ascultă și te corectează: tipul de
voicing, note lipsă, note greșite, low interval limits, voice leading, dublări, puncte slabe
în timp. Toate se calculează determinist, în browser, din codul care există deja în `theory/`.

Utilizatorul țintă: pianistul de jazz care studiază serios și are o clapă MIDI lângă un
calculator. Nu începătorul, nu utilizatorul de iPad (Web MIDI nu există pe Safari).

## Ce iese din scopul v1

**Reharm iese din produs.** Rămâne în repo, în demo-ul public și în README, ca dovadă
tehnică a arhitecturii hibride. Nu intră în tiere, nu intră în roadmap, nu primește lucru nou.

Motivul principal nu e costul, e coerența: era singurul feature care contrazicea poziționarea
de mai sus. Se reintroduce doar dacă cel puțin 20% dintre abonații activi îl cer explicit.

Consecințe pentru cod:
- Worker-ul rămâne proxy simplu: `Origin`, cheie, limită pe IP, plus token și un contor pentru
  `explain`. Fără cotă complexă, fără alegere de model, fără job de noapte, fără Batch API.
- `explain` din drill rămâne singurul apel AI din produs. Sub un cent, ~3 secunde.
- `pipeline.js`, `candidates.js`, `analysis.js`, `scoring.js`, `realize.js` rămân neatinse și
  testate. Le folosește demo-ul.

## Ce NU se atinge

`src/theory/**` rămâne JS pur, fără DOM, fără dependențe, testat cu `node --test`. Motivele
sunt acum comerciale, nu doar de portofoliu: același cod rulează în browser, în Worker și în
teste, iar cele 179 de teste sunt singura garanție că produsul nu strică teoria.

Fără migrare în TypeScript pentru `theory/`. TypeScript doar pe codul nou (shell, backend).

## Fazele produsului

Fiecare fază se termină cu o poartă măsurabilă. Dacă poarta nu se deschide, nu se scrie mai
mult cod — se repară ipoteza.

### P0 — Închidem ce avem (săptămânile 1–2)

- Execuția pe fraze pentru piese peste 32 de măsuri (ultimul punct din Faza 3b).
- Faza 4 integral: demo mode, claviatură pe ecran, `audio/synth.js`, repo public, Pages,
  Worker publicat.
- Harness de verificare permanent: port MIDI fals + sesiuni înregistrate care se reiau.
- Spargerea lui `CLAUDE.md` în reguli / jurnal / specificații.
- Prototip de intrare pe microfon cu `basic-pitch-ts`, măsurat pe 20 de voicings.
  Prag de acceptare: peste 90% identificate corect **cu octava exactă**.

**DoD:** demo-ul public merge fără clapă; harness-ul reia o sesiune înregistrată și raportează;
verdictul microfonului e scris în jurnal.

### P1 — Scheletul de produs (săptămânile 3–6)

- Shell nou ca PWA: Vite + React sau Svelte, cu `theory/` importat neatins, mod offline.
- Supabase: auth, profiluri, istoric de studiu sincronizat, regiune UE.
- Drill adaptiv: repetiție spațiată (SM-2) peste `weakSpots` din `ui/stats.js`. Logica stă în
  `theory/` sau alături, ca să fie testabilă cu `node --test`.
- Puzzle zilnic de voicing, fără cont, cu partajare.
- Primele 15 studii originale (grilă + melodie), scrise de Edi.
- Onboarding de 30 de secunde: conectezi clapa, cânți un acord, primești verdictul.

**DoD:** un utilizator nou ajunge de la deschiderea paginii la primul feedback în sub 60 de
secunde, fără cont; drill-ul adaptiv readuce un acord ratat și îl retrage după 3 reușite.

### P2 — Monetizare (săptămânile 7–10)

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

- Niciun feature nou până la poarta P2. Dacă nu e pe lista fazei, nu se construiește — oricât
  de repede s-ar putea.
- Test întâi pentru orice atinge `analyzer.js`, `chords.js`, raportul de comping sau
  scheduler-ul de repetiție spațiată.
- Fără conturi de utilizator în `theory/`. Logica de teorie rămâne pură și rulabilă offline;
  doar cota și cheia stau pe server.
- Fără grile sau melodii de standarde în repo. Doar material original sau din domeniul public,
  verificat.
- Fără bucle de agenți, fără framework în `theory/`, fără bundler pentru modulele de teorie.
