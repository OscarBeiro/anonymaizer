# 05 — Large documents: quick fixes

Found on 2026-09-27 while asking whether a 1000-page PDF would work. Parsing
is fine: `src/lib/parsers/pdf.ts` reads one page at a time and frees each one.
What comes after parsing breaks. The structural fixes (worker, chunking,
IndexedDB, windowed rendering) are in [`m7-scale.md`](../m7-scale.md). These
blocks are the cheap fixes, done before M6.

---

### [x] L1 — Session save can't crash

**Done 2026-10-07 (v0.18.1).** Every `setItem` in `session.ts` goes through a private `write()` that catches. `saveSession` returns false on failure and drops the stale stored copy; `App.tsx` shows a "too large to survive a reload" alert. Tests in `session.test.ts`.

A 1000-page PDF is ~2–3 M characters. `saveSession` (`src/lib/session.ts`)
stores both the raw and the anonymized text in localStorage (quota ~5 MB) from
an effect in `App.tsx`. `setItem` is not wrapped in try/catch, so the
`QuotaExceededError` escapes into React.

- Wrap every `setItem` in `session.ts` in try/catch. On a quota error, keep the
  session in memory and show "This document is too large to survive a reload".
- Test: a mocked quota error doesn't throw, and the flag is reported.

### [x] L2 — Detector benchmark, remove quadratic scans

**Done 2026-10-07 (v0.18.1).** `src/core/benchmark.test.ts` times every detector, the full pipeline and `applySpans` on a ~3 MB synthetic text. Baseline before the fixes: `detectDni` 3.0 s, `applySpans` 222 s, pipeline 112 s. Causes and fixes:

- `buildIdSpan` took `text.slice(0, m.index)` per match: now a 40-char look-back.
- `applySpans` rebuilt the whole string per span: now one pass over sorted spans.
- `arbitrateSpans` scanned every accepted span per candidate (10.8 s for 99k spans): now a binary search over an offset-ordered list. A randomized test checks it equals the exhaustive scan.

After: `detectDni` 13 ms, pipeline 0.37 s, all other detectors under 100 ms. Budgets in the test are 3 s per detector, 6 s for the pipeline.

`buildIdSpan` (`src/core/detectors.ts`) runs `text.slice(0, m.index)` and a
regex test on that prefix for every match. On a book-length text that is
O(n × matches).

- Add a time-budget test on a synthetic ~3 MB text, one entry per detector.
- Replace full-prefix look-backs with a bounded window (~40 chars) wherever the
  pattern appears.
- Tests: detections are identical on the existing fixtures, and the benchmark
  finishes within budget.

### [x] L3 — Honest large-file warning for NER

**Done 2026-10-07 (v0.18.1).** NER was already off at load (opt-in), so the "off by default" half held. `src/lib/nerLimits.ts`: above 200 000 characters (~70 pages; the regex numbers from L2 say detection is not the bottleneck, so this is a judgement call, not a measurement) turning NER on asks for confirmation, and an enabled NER shows a note on large documents. No NER timing was measured.

- Above `LONG_DOCUMENT_PAGES`, warn before the NER model runs. Turn NER off by
  default above a page threshold (choose it from L2's numbers). The user can
  still turn it on.
