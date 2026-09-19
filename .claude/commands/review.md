---
description: Verifică munca nepredată contra scopului fazei curente din docs/PRODUCT.md
argument-hint: [opțional, ce anume să verific]
disable-model-invocation: true
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git log:*) Read Glob Grep
---

Verifică munca din sesiunea curentă înainte de commit. Nu schimba niciun fișier —
doar raportează. Dacă Edi a dat un argument, concentrează-te pe el: $ARGUMENTS

Citește întâi `docs/PRODUCT.md` (faza curentă și regulile de scop) și secțiunea
„Stare curentă" din `CLAUDE.md`. Apoi uită-te la ce s-a schimbat efectiv:
`git status`, `git diff` și `git diff --staged`.

Răspunde scurt, pe punctele astea, în ordinea asta:

1. **Scop.** Fiecare fișier atins aparține pasului din faza curentă? Numește explicit
   orice schimbare care nu era pe lista fazei, oricât de mică sau de utilă. Regula
   din PRODUCT.md e „niciun feature nou până la poarta P2" — aplic-o literal.

2. **Reharm.** S-a atins ceva din `pipeline.js`, `candidates.js`, `analysis.js`,
   `scoring.js`, `realize.js` sau tab-ul Reharm? Alea sunt înghețate: rămân în repo
   ca demo, nu primesc lucru nou. Dacă s-au atins, spune de ce și dacă era necesar.

3. **Teorie.** Ceva din `src/theory/` s-a schimbat fără test scris întâi? Vreun test
   a fost slăbit, marcat skip sau șters ca să treacă? Citește diff-ul din `test/`
   cu ochi critic — un test modificat în aceeași trecere cu codul pe care îl verifică
   e semnalul cel mai important din toată lista asta.

4. **Reguli de proiect.** Dependențe npm noi în aplicație, importuri din `theory/`
   către `midi/`, `ui/`, `ai/` sau `audio/`, framework sau TypeScript strecurat în
   modulele de teorie, grile sau melodii de standarde adăugate în repo, ceva care
   seamănă cu o cheie API.

5. **Decizii nedocumentate.** Ce ai decis singur în sesiunea asta, fără să întrebi?
   Enumeră-le, chiar dacă par evidente. Dacă vreuna atinge o regulă de teorie sau o
   decizie din CLAUDE.md, spune că trebuie confirmată de Edi înainte de commit.

Termină cu o singură linie: **gata de commit** sau **de reparat întâi**, și de ce.
Nu înfrumuseța. Dacă totul e curat, spune-o în două cuvinte și oprește-te.
