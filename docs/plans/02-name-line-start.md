# 02 — NAME detection at the start of a line

Done 2026-09-21. A one-off fix, not a milestone session: found while verifying
M3/P8c, fixed immediately at the user's direction because every parser added to
M3 makes it bite harder.

## The leak

`detectNames` rejected every *sentence-initial* candidate —
`isSentenceInitial` is true at the start of the text and after any `.!?` — so a
name opening a line was never detected:

| Input | Before | After |
| --- | --- | --- |
| `informe de Mario Prieto Casal.` | NAME | NAME |
| `Firma: Mario Prieto Casal` | NAME | NAME |
| `El paciente Mario Prieto Casal, con DNI …` | NAME | NAME |
| `Mario Prieto Casal fue evaluado.` | **nothing** | NAME |
| `Hola. Mario Prieto Casal fue evaluado.` | **nothing** | NAME |
| `Mario Prieto Casal` (bare signature line) | **nothing** | NAME |
| `Oscar Beiro llamó ayer.` | **nothing** | NAME |

Documents are made of exactly those lines: salutations, `De:`/`To:` blocks,
signature blocks, table cells, slide titles. The project's own field-report
bench had been carrying the bug in plain sight — `CLINICAL_REPORT_FIXTURE`
opens a line with `D. Mario Prieto Casal, con DNI 45****78Q, …`, and his DNI
was masked while his name was not.

## Why the guard was there, and what replaced it

A capitalized word at the start of a sentence is not evidence of a name, so
rejecting the position was a cheap way to avoid false positives. The
replacement is to keep the *candidate-side* evidence and drop the
position-based veto:

1. **Leading-label stripping was widened** (`stripLeadingLabels`, which already
   peeled stopwords and professional titles) with three new classes, applied in
   a loop so they chain:
   - **honorifics** — `D.`, `Dª`, `Sr.`, `Dra.`, `Mr.`… `\p{Lu}\.` is a valid
     NAME_TOKEN, so without this `D. Mario Prieto Casal` clusters separately
     from `Mario Prieto Casal` and mints a second placeholder for one person;
   - **document-structure heads** — `Informe`, `Expediente`, `Asunto`,
     `Paciente`, `Cliente`, `Subject`, `From`… matched case-insensitively,
     since headings are as often ALL CAPS. Stripped rather than used to reject,
     which is what keeps `Paciente Mario Prieto Casal` yielding the name;
   - **a leading particle** — a name never starts with `de`. This one is
     load-bearing for chaining: `Informe de Evaluación Anual` loses `Informe`,
     and without the particle strip the candidate stands as
     `de Evaluación Anual`, two non-particle tokens, clearing the floor. With
     it, the loop reaches `Evaluación` — another structure head — and the
     heading collapses to one token and is rejected.
2. **A sentence-initial candidate is now rejected only if it contains a
   stopword anywhere**, not just at the front (`containsStopword`). This is
   what still stops `Muchas Gracias` and `Buenas Tardes`. It applies to
   sentence-initial candidates only: mid-sentence there is lowercase context to
   go on, and the check would wrongly reject a real surname colliding with the
   list.
3. **Role titles were added to `TITLE_LEXEMES`** (`Director`, `Directora`,
   `Gerente`, `Presidenta`, `Responsable`, `Coordinador`, …). They sit on a
   line of their own under a signature — precisely the position the relaxation
   started accepting — so `Directora General` was being minted as a person.
   The existing professional-title shield handles them now.

## Accepted cost

Over-masking a title-case or ALL-CAPS heading, and institution names:
`Seguridad Social y Agencia Tributaria` now reads as one NAME. That is the
deliberate trade — an over-mask is visible and untickable in step 2, while an
unmasked name is silent and already out the door. Verified on a realistic
Spanish letter: the heading, `Asunto:`/`Fecha:` labels, `Muchas Gracias` and
the role title are all left alone; both personal names are masked.

**Follow-on backlog item:** a shield lexicon for public institutions
(Seguridad Social, Agencia Tributaria, Hacienda, INSS, SEPE, …), which would
remove the main remaining false-positive class. Bounded, but its own task — and
it interacts with the per-language stopword-pack item in the M1 backlog, which
has the same "this list grows forever" problem and the same proposed answer
(data files, not code).

## Verification

227 tests (from 225, and the two new NAME mappings changed two existing
assertions in `fieldReport.test.ts`, one of which now asserts the previously
leaked name *is* redacted). Verified live in headless Chromium through the M3
`.pdf` path on the portable `file://` build: `Mario Prieto Casal` comes back as
`[[NAME_001]]`, where before the fix it stayed in plain text.
