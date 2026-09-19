---
description: Încheie sesiunea — actualizează jurnalul și scrie raportul de predare pentru Claude din Cowork
argument-hint: [opțional, ce s-a lucrat]
disable-model-invocation: true
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(node --test) Read Write Edit Glob Grep
---

Încheie sesiunea curentă. Context de la Edi, dacă a dat: $ARGUMENTS

Rulează `/review` mai întâi, în gând, și rezolvă ce e de rezolvat înainte de pașii
de mai jos. Apoi:

**1. Actualizează jurnalul.** O intrare nouă în `docs/JOURNAL.md`, în stilul celor
existente: data, ce s-a implementat, numărul de teste, deciziile luate și de cine,
ce a rămas deschis, următorul pas. Nu rescrie intrări vechi.

**2. Actualizează „Stare curentă" și „Următorul pas" din `CLAUDE.md`.** Următorul pas
e o singură propoziție, concretă, pe care o sesiune nouă o poate executa fără context
suplimentar. E cea mai importantă linie din fișier.

**3. Scrie raportul de predare** în `docs/session-log/<AAAA-LL-ZZ-HHmm>.md`. Îl
citește Claude din Cowork, care nu are acces la repo-ul tău și nu poate rula git —
deci tot ce nu scrii aici, el nu vede. Structura, exact:

```markdown
# Sesiune <data> — <faza și pasul>

## Ce s-a făcut
<3–6 rânduri, în cuvinte simple>

## Fișiere
<ieșirea brută a `git diff --stat`, plus fișierele noi netracked din `git status`>

## Teste
<număr înainte → după. Ce teste noi s-au scris și ce verifică ele.
Dacă vreun test a fost modificat, șters sau marcat skip: care și de ce.>

## Decizii luate în sesiune
<fiecare decizie, cu cine a propus-o — Edi sau tu — și dacă a fost confirmată>

## Abateri
<orice regulă din CLAUDE.md sau docs/PRODUCT.md care a fost ocolită, și motivul.
Dacă nu e niciuna, scrie „niciuna" — nu sări secțiunea.>

## Rămas deschis
<întrebări pentru Edi, lucruri neterminate, lucruri de verificat pe Genos>
```

**4. Lasă repo-ul curat.** Spune-i lui Edi ce e necomitat, ce procese ai pornit și
ce porturi au rămas ocupate.

La final, dă-i lui Edi o singură linie pe care s-o trimită în Cowork, de forma:
`gata <faza, pasul> — vezi docs/session-log/<fișierul>`
