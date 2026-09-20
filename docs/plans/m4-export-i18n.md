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
- Where in the UI: a small format-picker + "Save as…" button, one per
  relevant sub-step (2.3 Sanitized text, 3.2 Restored text) — not a new
  wizard step of its own.

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
