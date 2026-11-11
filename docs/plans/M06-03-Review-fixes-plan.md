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

### [x] 3 — Session and rule persistence match what the app says
`saveSession`/`saveDictionaryRules` wrote only after an opt-in that has no UI,
while the landing, cookie and privacy pages promise that a reload loses
nothing. **Decided 2026-11-11 (user): save by default.** `remembered()` in
`src/lib/retention.ts` is true unless explicitly set to `false`. The
"Remember on this device" switches and any change of default stay with
M09-01 tasks 04/12. Checked in headless Chrome: a document and its mappings
survive a reload.

### [x] 4 — No model download from a local copy (hard rule 2)
`modelDownloadAllowed()` exists but nothing calls it. Offer the AI model only
where it returns true; a dev-only override keeps it testable on localhost.

### [-] 5 — Legal text matches the code — deferred to launch
Consent banner, cookie and privacy pages name Google Analytics 4 and
Metricool; `src/lib/analytics.ts` sends nothing. These pages are pre-launch
drafts (`DRAFT FOR LEGAL REVIEW`, unfilled `{{…}}` placeholders, three
languages) and the replacement analytics transport is not chosen.
**Decided 2026-11-11 (user): do not rewrite now.** Launch checklist item:
once the transport is decided, rewrite the banner, `src/legal/cookies.tsx`
(cookie table), `src/legal/privacy.tsx` (processors, transfers, retention) and
the `cookies.*`/`privacy.*`/`ConsentBanner.*` strings in every language, bump
`CONSENT_POLICY_VERSION`, and drop `VITE_GA4_ID`/`VITE_METRICOOL_HASH` from
`deploy.yml` and `src/vite-env.d.ts`. Nothing is deployed meanwhile
(`deploy.yml` is manual-only).

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
