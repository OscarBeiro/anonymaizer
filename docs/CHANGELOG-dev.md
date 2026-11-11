# Changelog (dev)
<!-- changelog-format: 2 -->

Internal technical record. Public, end-user entries live in `/CHANGELOG.md`.

## [0.19.0-dev] - 2026-11-02

_Working version: 0.19.0-dev._

### Features

- TICGAL rebrand (design: Claude Design canvas, direction A "Veil" with the C "Swap" icon):
  - Logo: TICGAL Azul `#658bc5` disc with white two-way arrows. `src/components/AppMark.tsx` replaces the "A" tile in the app header, site header and legal pages; `public/favicon.svg` (was Vite's placeholder) is the same drawing. New token `--color-on-brand`.
  - Colours (`src/styles/tokens.css`): text is TICGAL Azul intenso `#2a5698` and darker shades (`--color-text` `#1f3f70`, `--color-text-muted` `#3f5f92`), accent `#2a5698`, borders Azul T `#a9c6e9`, new `--color-brand-light` (Azul C `#9bc9ed`). Dark theme accent is Azul C. `tokens.test.ts` AA checks pass unchanged.
  - Type: bundled webfonts in `src/styles/fonts.css` from `@fontsource-variable/urbanist`, `@fontsource-variable/inter`, `@fontsource/ibm-plex-mono` (5.3.0; CSS and woff2 only, no install scripts or runtime code, so hard rule 3 holds). Urbanist (stand-in for Nexa) for h1–h3 and the wordmark via new `--font-display`; Inter for text (latin + latin-ext); IBM Plex Mono for placeholders (latin). Hosted build serves them same-origin (CSP `font-src 'self'` unchanged); portable build inlines all five as `data:` URIs (+~190 kB raw).
  - `public/og-image.png` re-rendered in the new palette.
- Checks: `npm test`, `npm run lint`, `npm run build`, `npm run build:portable` (no external font URL left); landing and `/app` screenshotted from `vite preview`.
- Detection quality, plan `docs/plans/M06-02-Detection-quality-plan.md` (PR #18):
  - Evaluation harness: `src/core/eval/` — labelled corpus (8 gl, 3 es, 2 en documents, inline `{CAT|text}` markup, `CAT?` optional), pure leak-oriented scorer (`score.ts`: caught/partial/missed per category, over-flags), `scorecard.test.ts` writing `report.txt` and ratcheting `baseline.json` (`EVAL_UPDATE=1` to record an improvement).
  - Scores, rules only, app path (caught/total · over-flags). Before = `main` as the app called it (default es+en profile): gl 51/67 · 20, es 18/24 · 6, en 11/14 · 3. After: gl 66/67 · 1, es 23/24 · 0, en 14/14 · 1. Addresses 0/13 → 13/13 fully hidden.
  - Root cause found on the way: `App.tsx` called `anonymize()` without a profile, so the Galician pack never ran in the app. New `autoDetectionProfile()` (`langDetect.ts`) is passed by the three App call sites and used by the scorecard; `documentLanguages()` now pairs `es`/`gl` (a Galician contract scored as Spanish only).
  - `detectAddresses`: whole Iberian addresses — lower-case street types, particles, comma before number, `km`/`s/n`, floor/door tail, multi-word locality; extra street types (Estrada, Lugar, Travesía, Rolda, Paseo…); UK number-first form with street suffix and postcode (overlap with the US form dropped).
  - Lexicons: shared institution heads (Departamento, Servicio, Hospital, Centro de Salud, Juzgado, Registro, Caja, CEIP/IES…; not Instituto/Universidad/Concello/Deputación, which stay COMPANY by design per `multilanguage.test.ts`), legal heads Decreto/Código; Galician pack gains titles, structure heads, Lei/Orde/Regulamento, Galician institutions and `do/da/dos/das` continuations; EN gains Department/Court/…, `The`, job titles.
  - `detectNames`: ALL-CAPS heading leftovers starting with a connective (`DE …`, `AL …`) rejected; numbered clauses (`I. Que`) rejected; label-colon rejection only at line start (`for Tom Ellis: his…` was dropped).
  - `detectIdCodes`: bare 1–2 digit values after `nº` are ordinals, not IDs.
  - New `src/core/nameMentions.ts`: salutation/honorific single names (`Ola Iria,`, `Dr. Suárez`, `o señor Costas`) and later standalone mentions of found names (one linear pass, confidence 0.5, `RUNG.NAME`).
  - PDF: `joinWrappedLines()` rejoins words hyphenated across lines (soft hyphen always; hard hyphen before lower case; kept before a capital as a compound surname).
  - NER: `chunkText()`/`mergeChunkEntities()` in `src/core/ner.ts`; the worker runs 800-char windows with 150-char overlap instead of one call that transformers.js truncated at 512 tokens. Not yet measured in a browser.
  - Review follow-up: `propagateNameMentions` is seeded from `arbitrateSpans(candidates)`, not raw candidates, so a NAME candidate inside a shielded institution or a company no longer flags later words (`CEIP Rosalía de Castro` … `barrio de Castro`). `entities.ts` reads name particles from `LEGACY_LEXICON` instead of `detectors.ts`, which removes the `detectors → span → entities → detectors` import cycle this would have created.
  - Review follow-up, NER limits: `nerClient.ts` refused text over 100,000 characters while `nerLimits.ts` only asked for confirmation above 200,000, so the confirmation offered a run that then failed. Now `NER_MAX_CHARS` 100,000 (shared) and `NER_LONG_DOCUMENT_CHARS` 25,000. The 180 s whole-run timeout (which included the model download and, since chunking, ~150 inferences) is an idle timeout: the worker posts a `chunk` message per window and the client rearms on every message (`NER_IDLE_TIMEOUT_MS`).
  - Known gaps: bare given names in prose (`Falei con Roi`), region inside a law title (`… de Galicia`), head-final English acts (`Tenant Act`).

## [0.18.6] - 2026-11-01

### Bugs

- Dependabot/npm audit sweep, one commit per step (draft PR #16):
  - `dompurify` 3.4.16 -> 3.4.17: critical alert #28 plus GHSA-cg2g-xh64-v4q7, GHSA-mrv2-3pqr-j5jr, GHSA-c6gr-qvv4-5v3f.
  - `vite` ^8.3.0 -> ^8.3.5 (lock 8.3.5): alerts #20-25 (dev-server only); supersedes Dependabot PR #9.
  - `vitest` ^5.0.1 -> ^5.0.3 (lock 5.0.5): pulls `@vitest/mocker` 5.0.5, alerts #26-27 (dev-only).
  - `postal-mime` ^3.0.0 -> ^4.2.0: quadratic CPU on RFC 2047 headers (DoS, GHSA-f2hq-32vh-53cc). 4.x breaking changes: whitespace kept when unfolding headers, first-wins for duplicated single-value headers, `to`/`cc`/`bcc`/`replyTo` in document order. None broke the `.eml` tests, but 4.x now returns header-less plain text as `text` instead of an empty shell, so `src/lib/parsers/eml.ts` additionally rejects input with zero parsed headers (test "throws an error naming the file when the bytes are not a message").
  - `npm audit fix` for the remaining dev-only transitive advisories: `happy-dom` 21.0.4, `undici` 8.12.3 (via jsdom).
- Node 24 move landed separately on main (PR #15); this branch only adds the Podman dev image bump to `node:24-alpine` (`~/containers/anonymaizer`) and verification on Node 24.
- `package.json` `allowScripts` explicitly denies the install scripts of `protobufjs` (cosmetic version-scheme warning) and `onnxruntime-node` (binary download, would break hard rule 3); silences npm 11's unapproved-script warning. `npm ci` is now warning-free and tests pass.
- postal-mime 4.2.0 source checked: no fetch/XHR/network code (hard rule 3).
- Checks per step: `npm test`, `npm run lint`, `npm run build`; `build:portable` after dompurify and postal-mime. `npm audit`: 0 vulnerabilities.
