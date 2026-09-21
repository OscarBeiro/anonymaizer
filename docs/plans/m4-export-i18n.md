# Milestone 4 — Export & localization

## Export

**User request, recorded for scoping, not started.** Beyond copy-to-clipboard
(already shipped for Sanitized text and Restored text), let the user save
either panel's text to a file:

- **Easy tier, do first:** `.txt` (raw), `.html` (wrap in a minimal styled
  shell — reuse the highlighting markup from `renderHighlighted` for the
  sanitized-text export specifically), `.md` (the underlying data is already
  Markdown from the turndown ingest path, so this is close to a no-op —
  `anonymizedMarkdown`/restored text saved as-is). All three are pure
  client-side `Blob` + `URL.createObjectURL` + a synthetic `<a download>`
  click, same pattern `RulesEditor.tsx#exportRules` already uses for JSON —
  no new dependency needed.
- **Later tier, only if easy:** `.docx` and `.odt` *export* (not to be
  confused with the M3 *import* parsers for the same extensions above —
  export is Markdown → document, the opposite direction, and likely a
  different library even if the extension matches). `docx` (the npm
  package, not mammoth.js which is import-only) is the natural candidate for
  `.docx`; `.odt` export has no equally simple client-side library today —
  worth a quick feasibility check before committing to it, and dropping it
  from scope entirely is an acceptable outcome if there isn't one.
- **`.xlsx` export — user's own use case, promote to the easy tier.** The M3
  `.xlsx` *importer* already hand-rolls its reading on `jszip` (P8f, no
  SheetJS dependency — see hard rule 3 on network-calling deps, SheetJS's
  community build is fine but was avoided for bundle-size reasons per that
  session's notes) rather than pulling in a library; export needs the
  inverse: take the Markdown table(s) in the sanitized/restored text and
  hand-roll a minimal `.xlsx` (a zip of a few small XML parts — workbook,
  one sheet, shared strings — `jszip` again is enough, no new dependency).
  Open question worth deciding up front: a document that was never tabular
  to begin with (plain prose, a `.docx` letter) has no natural sheet
  structure — does `.xlsx` export only offer itself when the *source* was
  tabular (`.csv`/`.xlsx` import), or does it always dump one column of
  Markdown-table rows / one cell of raw text otherwise? The former is
  probably right and cheaper, but confirm against the actual use case
  (which document types the user needs this for) before building it.
- Where in the UI: a small format-picker + "Save as…" button, one per
  relevant sub-step (2.3 Sanitized text, 3.2 Restored text) — not a new
  wizard step of its own.

## Pseudonymization — plausible fake data instead of placeholders

**User request, recorded for scoping, not started (2026-09-21).** Today every
category becomes an opaque `[[NAME_001]]`-style placeholder. The ask is a mode
where masked values are replaced with *plausible fake data of the same shape*
instead — a Spanish name swapped for another Spanish name, a company for
another company, a money amount perturbed rather than blanked. Motivation:
placeholders are visibly redacted and sometimes "too fake" reads worse for the
use case than a realistic stand-in (an LLM prompt that flows better, a demo
document that still looks real).

This is a genuinely different reversal shape from today's, not an additive
option, so it needs real design before a `P` block is written:

- **Reversal still has to work.** Today `MappingItem.originalText` is restored
  verbatim from the placeholder text itself (`reverseText`, `reverse.ts`), which
  is exactly why the placeholder is a token like `[[NAME_001]]` rather than
  free text — an LLM's response echoes the token, and the token *is* the
  lookup key. A fake name/company has no equivalent anchor: if the anonymized
  text says "Marta Souto" instead of "[[NAME_001]]", nothing in an LLM's reply
  distinguishes "Marta Souto" (to be reversed) from a name the LLM invented on
  its own (not to be reversed, and possibly colliding with the fake one
  chosen). Needs a decision before anything else: keep bracketed placeholders
  as the reversal mechanism and only change what's *shown* in step 2's preview
  (fake data is cosmetic, real placeholder still goes to the LLM), or actually
  send fake data downstream and accept that reversal becomes best-effort/lossy
  for this mode. The first is far less risky and is probably right, but the
  user should confirm — it changes what "anonymize" even promises.
- **New category: amounts.** No detector for money today. Needs a regex (ISO
  4217 codes, €/$/£ symbols, `1.234,56` ES-style vs `1,234.56` EN-style
  grouping, "mil euros" written out) and a place on the §4a rung ladder.
  Whether amounts even get a *fake-data* treatment or just the usual
  placeholder is a separate question from detecting them at all — detection
  is useful either way and could land as its own `D`-style session before
  the pseudonymization mode exists to consume it.
- **Fake-data generation per category, offline.** Hard rule 2 (no network)
  rules out any hosted fake-data API. Needs bundled data: a name pool for
  NAME (already Spain-shaped work like `NAME_STOPWORDS`/lexicon packs —
  candidate to share infrastructure with D3's shield lexicon and the M1
  backlog's per-language stopword packs, all three are "small bundled
  language data" problems), a company-name generator or pool for COMPANY,
  and for MONEY specifically a **perturbation** rather than a swap — multiply
  by a random factor in some band, or add/subtract a random percentage, so
  "12.450,00 €" becomes some other plausible amount rather than an unrelated
  fabricated one. Needs a decision on the perturbation band and whether it is
  seeded per-session (same input → same fake output, useful for consistency
  checks) or per-mapping (every amount perturbed independently).
- **Per-category, not global.** Likely a per-category toggle next to each
  mapping (or a session-wide default), since a user may want fake names but
  real placeholders for IDs — worth confirming against the actual review-step
  UI before assuming the shape.
- **`src/core/` stays pure** (hard rule 4) — a fake-data generator is
  ordinary logic and fits there like `dictionary.ts`/`entities.ts` do; it's
  the *data pool* (name lists, company-name templates) that needs a
  decision on bundled-vs-fetched, and "bundled" is the only option network
  rule 2 leaves.

No `P` block yet — next planning pass should split this into at least "detect
MONEY" (mechanical, low-risk, useful standalone) and "fake-data substitution
mode" (needs the reversal-mechanism decision above resolved first).

## Localization — Localazy via GitHub

**User request, recorded for scoping, not started.** The UI is English-only and
every string is hardcoded across `src/App.tsx` and the eight `src/components/`
files. Goal: translatable UI, with translations managed in Localazy and synced
through GitHub Actions.

Two constraints shape the design, both from `CLAUDE.md`:

- **No runtime network calls.** Localazy's CDN / OTA delivery is therefore out.
  Locale files are committed to the repo and imported at build time, which also
  keeps the `vite-plugin-singlefile` build working offline.
- **`src/core/` stays pure.** No i18n in core. Where core surfaces user-facing
  text today it must return a stable code and let the UI translate it — that
  audit is part of P9, not a follow-up.

No i18n dependency: a ~40-line `t()` over a flat key map covers this app, and
every candidate library either pulls in a CDN backend or has to be audited
against hard rule 3. Shape:

```
src/locales/en.json     # source of truth, hand-edited
src/locales/<lang>.json # written by Localazy, committed via PR
src/i18n.ts             # t(), language detection, persisted to localStorage
```

Keys grouped by component (`review.title`, `rules.addRule`) — maps straight onto
Localazy's JSON format and keeps the file navigable.

### [ ] P9 — Extract strings + i18n layer

**Decided — plain language codes, not region-qualified.** Locale files are `en`,
`es`, `gl`, `pt`, not `en_GB`/`gl_ES`. Region variants double the translation
work for near-identical text, and `gl` has no second region to disambiguate
against. Add a region code only where the content genuinely diverges — `pt_BR`
vs `pt_PT` is the one likely split, and it can be added later as a new file with
no restructuring. This costs nothing to defer.

That makes the resolver the load-bearing part: browsers report `gl-ES`,
`en-GB`, `es-AR`, so lookup falls back exact locale → base language → `en`. It
must handle both filename shapes from day one, because the day `pt_BR` lands the
directory holds a mix.

> Add `src/i18n.ts` exposing `t(key, params?)` over `src/locales/en.json`, loading
> locale files with `import.meta.glob('./locales/*.json', { eager: true })` — no
> new dependency, no network. Language comes from a persisted user choice falling
> back to `navigator.language`, resolved exact locale → base language → `en`
> (`gl-ES` → `gl.json`), with a picker in the UI. Locale files are named by plain
> language code; the resolver must also accept region-qualified filenames such as
> `pt_BR.json`. Move every hardcoded user-facing string in `src/App.tsx` and
> `src/components/` into `en.json`. Audit `src/core/` for user-facing text and
> convert it to codes the UI translates; core stays pure. Add tests for the
> fallback chain (`gl-ES` → `gl`, unknown language → `en`, region-qualified file
> preferred over its base when both exist) and that `en.json` has no duplicate or
> unused keys.

### [ ] P10 — Localazy sync through GitHub Actions

**Decided:** the official Localazy GitHub Actions with repository secrets — not
the CLI in a hand-rolled step, not a local developer sync.

> Add `localazy.json` at the repo root: upload `src/locales/en.json` as source
> (`type: json`, `lang: en`), download to `src/locales/${lang}.json` —
> `${lang}` deliberately, not `${locale}`, per the P9 decision. Add
> `.github/workflows/localazy-upload.yml` — on push to `main` touching
> `src/locales/en.json`, run `localazy/upload@v1` with `LOCALAZY_WRITE_KEY`. Add
> `.github/workflows/localazy-download.yml` — `workflow_dispatch` + schedule, run
> `localazy/download@v1` with `LOCALAZY_READ_KEY`, then open a PR with
> `peter-evans/create-pull-request` so translations pass `npm run build` and
> `npm test` before landing. Add a test asserting every `src/locales/*.json` has
> the same key set as `en.json`, so a half-translated language cannot ship blank
> UI.

Both keys are GitHub Actions secrets (`LOCALAZY_WRITE_KEY`, `LOCALAZY_READ_KEY`),
taken from the Localazy project's Integrations page after `localazy init`.
P10 depends on P9 — there is nothing to upload until `en.json` exists.
