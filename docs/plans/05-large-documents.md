# 05 — Large documents: quick fixes

Found on 2026-09-27 while asking whether a 1000-page PDF would work. Parsing
is fine: `src/lib/parsers/pdf.ts` reads one page at a time and frees each one.
What comes after parsing breaks. The structural fixes (worker, chunking,
IndexedDB, windowed rendering) are in [`m7-scale.md`](m7-scale.md). These
blocks are the cheap fixes, done before M6.

---

### [ ] L1 — Session save can't crash

A 1000-page PDF is ~2–3 M characters. `saveSession` (`src/lib/session.ts`)
stores both the raw and the anonymized text in localStorage (quota ~5 MB) from
an effect in `App.tsx`. `setItem` is not wrapped in try/catch, so the
`QuotaExceededError` escapes into React.

- Wrap every `setItem` in `session.ts` in try/catch. On a quota error, keep the
  session in memory and show "This document is too large to survive a reload".
- Test: a mocked quota error doesn't throw, and the flag is reported.

### [ ] L2 — Detector benchmark, remove quadratic scans

`buildIdSpan` (`src/core/detectors.ts`) runs `text.slice(0, m.index)` and a
regex test on that prefix for every match. On a book-length text that is
O(n × matches).

- Add a time-budget test on a synthetic ~3 MB text, one entry per detector.
- Replace full-prefix look-backs with a bounded window (~40 chars) wherever the
  pattern appears.
- Tests: detections are identical on the existing fixtures, and the benchmark
  finishes within budget.

### [ ] L3 — Honest large-file warning for NER

- Above `LONG_DOCUMENT_PAGES`, warn before the NER model runs. Turn NER off by
  default above a page threshold (choose it from L2's numbers). The user can
  still turn it on.
