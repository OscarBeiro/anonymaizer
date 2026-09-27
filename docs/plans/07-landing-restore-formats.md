# 07 — Landing content, About page, restore formats

Planned and done 2026-09-27 (v0.17.0), from one session of user feedback on
the hosted build. `U1`–`U4` are done; `U5`–`U7` are the follow-ups found on the
way, not started.

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

### [ ] U5 — Money range control not visible

The user could not find the Realistic MONEY range (`MoneyRange`, P13
follow-up, meant for 2.3 while Realistic is selected). Suspect the S1–S4
mode split hides it. Find and fix; the landing now says only "a percentage
you choose".

### [ ] U6 — English pseudonym pools

Realistic mode draws only from `src/core/data/es/pseudonyms.ts`, but the
landing shows an English example (Emily Carter, Northbridge Holdings Ltd).
Add `src/core/data/en/` pools, chosen by document language once M6's
`langDetect` exists (or by a setting before then).

### [ ] U7 — Dates of birth

The medical and CV use cases list date of birth as data at risk, but there
is no DATE category. Either add one (off by default?) or suggest a custom
rule in the landing copy.

**Not in this plan:** the language selector the user asked for needs P14
(i18n layer) first; see `m6-language-packs.md`.
