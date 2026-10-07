# 07 — Landing content, About page, restore formats

Planned and done 2026-09-27 (v0.17.0), from one session of user feedback on
the hosted build. All of `U1`–`U10` are done (`U5`–`U7` and `U10` on 2026-10-07, v0.18.0).

---

### [x] U1 — Landing content and the About page

**Done 2026-09-27 (v0.17.0).** `src/landing/Landing.tsx`, new
`src/landing/About.tsx` and `SiteHeader.tsx` (shared by both), `landing.css`.

- New `/about` route: `router.ts` (+ test), `Root.tsx` (lazy, title),
  sitemap and no-cache lists in `vite.config.ts`, `_redirects` comment.
  `LABS_URL` in `src/site.ts`.
- Landing gains: eyebrow + badges in the hero (the "runs entirely in your
  browser" sentence is bold), "What it catches" (six cards, checked against
  `src/core/categories.ts` — no passports, URLs or social security),
  "Placeholders — or realistic fake data" with the test-data explanation,
  "Would you upload this to an AI?" (medical report, legal document, CV),
  "For anyone trusted with other people's data" (six professional groups),
  and a TICGAL Labs section with the motto.
- About: Labs tagline, why we built it, who we are (TICGAL, values,
  milestones 2014–2026), Labs philosophy. Copy taken from tic.gal/about-us
  and tic.gal/labs.
- Card grids: `.landing-cards-3` is 3 → 2 → 1 columns; About's four values
  are 2 × 2.
- Decision: the landing stays one long page for now. A `/use-cases` page for
  the long explanations was proposed and deferred.

### [x] U2 — Restore as plain text, Markdown or HTML

**Done 2026-09-27 (v0.17.0).** New `src/core/markdownRender.ts` (+ test):
`markdownToHtml` (a private `marked` instance, GFM) and `markdownToPlainText`
(walks the lexer tokens — bullets and numbers kept, links as `text (url)`,
tables tab-separated, raw HTML dropped). Pure; the HTML is **unsanitized**.

- 3.2 in `ReversalPanel.tsx` has a segmented radio group; the choice persists
  as `anonymaizer.restoreFormat` (default `markdown`; `src/lib/session.ts`
  + test).
- `App.tsx` sanitizes once with DOMPurify, used by both the preview
  (`dangerouslySetInnerHTML`) and the clipboard.
- `CopyAction.html` in `StepFooter.tsx`: when set, copies a `ClipboardItem`
  with `text/html` and a `text/plain` fallback (the plain rendering).
- New deps `marked`, `dompurify`: neither makes a network request (hard
  rule 3).
- Save-as is unchanged; it keeps its own formats.

### [x] U3 — A new document clears the previous one

**Done 2026-09-27 (v0.17.0).** Bug: a file import, a landing handoff and a
plain paste into a non-empty box all kept the previous document's AI
response, file metadata and session id; the paste also merged the two texts.

- `resetForNewDocument()` in `App.tsx` (fresh `emptySession()`, AI response,
  warnings, sub-steps; rules and settings kept). File import builds on a
  fresh session; landing text goes through `handleNewDocumentText`.
- `PastePanel.tsx`: a paste into an empty box or over the whole text is a new
  document; a paste into part of a document asks (OK = new document,
  Cancel = insert as an edit). HTML pastes follow the same rule.

### [x] U4 — Light/dark toggle in the headers

**Done 2026-09-27 (v0.17.0).** `src/components/ThemeToggle.tsx`: one button
that flips the resolved theme. In the app header next to Settings, and in
`SiteHeader` (which loads/saves/applies the theme itself, since the landing
has no `App`). The three-state control stays in Settings.

### [x] U5 — Money range control not visible

**Done 2026-10-07 (v0.18.0).** Cause: the range only rendered in 2.3 once Realistic was selected, and Standard mode never shows 2.3. It is now always visible in 2.3 (noted "applies to Realistic output" while Placeholders is on), and the Standard result carries a hint pointing to Fine-tune → 2.3.

The user could not find the Realistic MONEY range (`MoneyRange`, P13
follow-up, meant for 2.3 while Realistic is selected). Suspect the S1–S4
mode split hides it. Find and fix; the landing now says only "a percentage
you choose".

### [x] U6 — English pseudonym pools

**Done 2026-10-07 (v0.18.0).** `src/core/data/en/pseudonyms.ts`; `PseudonymLang` / `lang` option in `pseudonymize.ts`; a "Fake names in" select in 2.3 persisted as `anonymaizer.pseudonymLang`. Chosen by setting, not auto-detected: switch to `langDetect` once M6 lands.

Realistic mode draws only from `src/core/data/es/pseudonyms.ts`, but the
landing shows an English example (Emily Carter, Northbridge Holdings Ltd).
Add `src/core/data/en/` pools, chosen by document language once M6's
`langDetect` exists (or by a setting before then).

### [x] U7 — Dates of birth

**Done 2026-10-07 (v0.18.0).** Took the cheap option: the medical and CV landing cards now say to add a custom rule for the date of birth. A DATE category is still open if wanted.

The medical and CV use cases list date of birth as data at risk, but there
is no DATE category. Either add one (off by default?) or suggest a custom
rule in the landing copy.

### [x] U8 — Realistic output leaked real names

**Done 2026-09-27 (v0.17.0).** Reported: switching Output to Realistic and
back gave a mix of fake names and placeholders. The Placeholders view is the
span-based text from detection; Realistic (and every toggle) rebuilds from
the mappings with `applyEnabledMappings`, by literal search. Two causes:

- A detector can normalise `span.text` (the clinical fixture's "Anxo Nogueira
  Vidal, DNI" is stored as "DNI Anxo Nogueira Vidal"), so no variant matched
  the document and the real name survived. `runDetectionPipeline` now adds
  each span's surface text (`text.slice(start, end)`) to its mapping's
  variants.
- `applyEnabledMappings` ran one replace per variant, so a fake containing a
  shorter original ("Raúl López" / "López") was rewritten again. Now one
  pass over a single alternation, longest first.

Tests: `pipeline.test.ts` asserts the rebuild equals the span-based text on
the clinical fixture; `apply.test.ts` asserts replaced output is never
re-scanned.

### [x] U9 — Markdown view renders

**Done 2026-09-27 (v0.17.0).** Reported: the Markdown restore view showed
source. Now Plain text = flattened; **Markdown = rendered** (copy writes
`text/html` plus the Markdown source as `text/plain`); **HTML = the
sanitized HTML source** in a textarea.

### [x] U10 — NAME span swallows ", DNI"

**Done 2026-10-07 (v0.18.0).** `ID_KEYWORDS` (DNI, NIE, NIF, CIF, NUSS, IBAN) added to the comma-form trailing exclusion in `detectors.ts`; tests in `detectors.test.ts`.

Found in U8: "Tutor legal: Anxo Nogueira Vidal, DNI 12345678Z" yields a
NAME span "Anxo Nogueira Vidal, DNI" — the D2 comma form treats "DNI" as a
given name. Stop a comma-form NAME at ID keywords (DNI, NIE, NIF, CIF…).
Belongs with the D-blocks in `03-detection-backlog.md` if preferred.

**Not in this plan:** the language selector the user asked for needs P14
(i18n layer) first; see `m6-language-packs.md`.
