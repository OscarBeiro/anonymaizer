# M06-02 — Detection quality: measure, then fix (Galician PDFs first)

Milestone: M06 · GitHub milestone `0.19.0` · Started 2026-11-03.
Companion to [M6](m6-language-packs.md) (P38 owns full NER coverage) and
[M06-01](M06-01-Browser-local-model-review-plan.md) (model choice).

## Why

User report: on Galician PDFs detection both misses personal data and flags
things that are not personal. A probe on a synthetic Galician social-services
resolution (2026-11-03) reproduced both:

- **Missed:** street part of `rúa do Progreso, 14, 2º esquerda` (only `27001 Lugo`
  caught); later surname-only mention `Sra. Fernández`; the tail of a name
  hyphenated across a PDF line (`Rodrí-` + `guez` → `[[NAME]]-guez`).
- **Over-flagged:** `Departamento de Servizos Sociais`, `CEIP Rosalía de Castro`,
  `Caixa Rural Galega` as NAME (capitalised-run heuristic, confidence 0.6);
  `Galicia` inside a law citation as LOCATION.
- **Model:** `src/workers/ner.worker.ts` passes the whole document in one call to
  `Xenova/bert-base-NER` (512-token window), so likely only the start of a
  document is scanned; and the model is English-only (PER/ORG used).

No accuracy measurement exists — `benchmark.test.ts` only times detectors.

## Tasks

### [ ] 1 — Evaluation corpus and scorer
- Hand-labelled documents (Galician first, then Spanish, English), inline
  markup `{CATEGORY|text}`, including PDF-shaped variants (hard wraps,
  hyphenated breaks).
- Pure scorer in `src/core/eval/`: per category, gold spans caught (fully
  covered by any PII span) vs leaked (fully or partly), and predicted spans
  overlapping no gold span (over-flags).
- A test that prints the table and fails if a score drops below the recorded
  baseline (ratchet), so fixes are measured and regressions caught.

### [ ] 2 — NER over the whole document
- Pure chunker in `src/core/ner.ts`: overlapping character windows split on
  whitespace, sized for the 512-token window; merge entities with offsets
  shifted and overlap duplicates resolved. Worker runs it per chunk.

### [ ] 3 — Rule fixes, each measured against task 1
- PDF parser rejoins words hyphenated across lines.
- Galician street vocabulary in addresses (rúa, avenida, praza, estrada,
  camiño, lugar, travesía, rolda…), with number/floor/door tail.
- Institution/department/bank shields (Departamento, Servizo, Consellería,
  Concello, CEIP/IES, Caixa, Banco…) so capitalised runs are not names.
- No LOCATION inside legal citations.
- Later mentions of a detected name: honorific + surname, surname alone.

### [ ] 4 — Multilingual model (M6 P39/P40)
Evaluate `Wismut/nym-pii-multilingual-small` against the corpus before switching.
Not in this plan's PR.

## Verification
`npm test` (including the scorecard), `npm run lint`, `npm run build`,
`npm run build:portable`; scores before/after recorded in the dev changelog.
