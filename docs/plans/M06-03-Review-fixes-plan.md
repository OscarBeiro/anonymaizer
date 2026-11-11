# M06-03 — Fixes from the full project review

Milestone: M06 · GitHub milestone `0.19.0` · Started 2026-11-11.
Related: [M09-01](M09-01-Safe-document-round-trip-plan.md) (owns the unwired
round-trip code), [M06-02](M06-02-Detection-quality-plan.md) (PR #18; its two
review items were fixed there).

## Why

A read of the whole project (2026-11-11) found the checks green but several
defects, most of them left by reverting the frontend to pre-M9 (`b9b8a34`)
while keeping M9 library code. Findings were from reading the code, not from a
browser.

## Tasks

### [x] 1 — Merge/split keep every occurrence hidden
`handleMerge` (`src/App.tsx`) kept only the first entry's `occurrences`;
`applyEnabledMappings` replaces by occurrence, so the other merged values
reappeared in the sanitized text. Move split and merge into a pure, tested
`src/core/mappingEdits.ts`; both keep positions.

### [x] 2 — Restored view never loads a remote resource
`DOMPurify.sanitize` kept `<img src="https://…">`, so an AI reply could make
the browser request a URL carrying a restored value. Strip resource-loading
elements when sanitizing; add a CSP `<meta>` to the portable build, which has
no response headers.

### [ ] 3 — Session and rule persistence match what the app says
`saveSession`/`saveDictionaryRules` write only after an opt-in that has no UI,
while the landing, cookie and privacy pages promise that a reload loses
nothing. **Open decision (user):** A — save by default again; B — keep
nothing-saved as default, add "Remember on this device" switches and rewrite
the texts.

### [x] 4 — No model download from a local copy (hard rule 2)
`modelDownloadAllowed()` exists but nothing calls it. Offer the AI model only
where it returns true; a dev-only override keeps it testable on localhost.

### [ ] 5 — Legal text matches the code
Consent banner, cookie and privacy pages name Google Analytics 4 and
Metricool; `src/lib/analytics.ts` sends nothing. Rewrite in `en.json` and
`gl.json`; drop the unused workflow variables.

### [x] 6 — CI on pull requests
`deploy.yml` is manual-only, so nothing runs lint or tests automatically. Add
`.github/workflows/ci.yml`: lint, tests, both builds, no-analytics check.

### [x] 7 — Exported HTML uses the TICGAL palette
`src/core/export/textExport.ts` still highlights placeholders in purple.

## Not in this plan (recorded for their owners)

- M09-01: `DetectionClient`/`detection.worker`, `identifyMappings`/`mintToken`,
  `restorationKey.ts`, `revisionStatus`, `prepareArtifact`, parser `coverage`
  and cancellation are tested but unused; detection, including user regex
  rules, still runs on the UI thread with no timeout.
- M6 UI language: no Spanish UI; hard-coded English in `PastePanel`,
  `RulesEditor`, `MappingPanels`, parser and AI-model messages.
- M7: unmeasured slow paths on very large documents (`pipeline.ts`
  occurrences, `identifyMappings`, `restoreText`); language detectors rebuilt
  per run.
- PDF parser: a cancelled import is reported as "not a readable PDF".

## Verification
`npm test`, `npm run lint`, `npm run build`, `npm run build:portable`; browser
checks listed in the PR description.
