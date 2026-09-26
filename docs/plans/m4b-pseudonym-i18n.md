# Milestone 4b — Pseudonymization & localization

The second half of M4. M4a is a prerequisite for the ordering reason spelled out
below, not a technical one: the i18n extraction (P14) must run *after* the
features that add user-facing strings, or it gets done twice and `en.json` is
stale the day Localazy first uploads it.

Decided in planning (2026-09-21), do not re-litigate:

- **Pseudonymized output is one-way.** Realistic fake data is a *different
  output*, not a different placeholder format, and it is not reversible. The
  question "how does an LLM's reply tell a substituted name from one the model
  invented?" has no good answer, so this mode does not try: it exists for
  documents that need to *look* real (demos, samples, shared examples), and step
  3 restoration does not apply to text produced in it.
- **It surfaces as an output-mode switch on 2.3**, "Placeholders / Realistic",
  over the same detection run and the same mappings — one pipeline, two
  renderings — with a visible warning that the realistic output cannot be
  reversed. Not a per-row choice in 2.2, not a separate wizard branch.
- **MONEY detection is its own session** (P12) and lands first. It is useful on
  its own whether or not anything pseudonymizes it.
- **i18n stays dependency-free** — a ~40-line `t()` over a flat key map. Every
  candidate library either pulls a CDN backend or needs auditing against hard
  rule 3, for a feature this app can write in an afternoon.

---

### [x] P12 — MONEY detector

**Done 2026-09-26 (v0.7.0).** Lives in `src/core/money.ts` (not `detectors.ts`)
with its companion API: `inferMoneyConvention(text)` is the recorded
convention — P13 calls it on the same text — and `parseMoneyAmount(span,
convention)` gives the signed value (magnitude words applied, null for
written-out). Rung `MONEY: 3.7`. Only currency-marked numbers vote on the
convention; dates and versions would be noise. Found on the way: a spaced
IBAN followed by a token (`… 1332 EUR`) was never detected — the group run
swallowed the token and the checksum failed; `detectIbans` now retries with
trailing groups dropped.

No detector for amounts exists today. Detection is useful standalone (an
invoice's figures are often the confidential part) and it is what P13's
perturbation consumes.

The hard part is not the regex, it is the two grouping conventions: ES-style
`1.234,56` and EN-style `1,234.56` are mutually ambiguous in isolation
(`1.234` is one thousand two hundred thirty-four, or one point two three four).
Resolve per-document, not per-match: pick the convention from the majority of
unambiguous occurrences in the text and apply it uniformly, defaulting to ES
when the text gives no evidence. Record the chosen convention so P13 can
re-emit a perturbed amount in the same style it found.

> Add `detectMoney` to `src/core/detectors.ts` with a `MONEY` category and a
> rung on the §4a ladder — below the validated-regex block (an IBAN or a card
> number must never lose its span to an amount inside it) and above ADDRESS.
> Match: a currency symbol (€ $ £ ¥) before or after the number, ISO 4217 codes
> (`EUR`, `USD`, …) either side, and the written-out Spanish forms ("mil
> euros", "dos millones de euros"). A bare number with no currency marker is
> **not** a match — precision-first, per §4a; a document is full of numbers.
> Tests first, covering both grouping conventions, symbol-before and
> symbol-after, the ISO-code forms, negative and parenthesised amounts, the
> written-out Spanish forms, the convention-inference tie-break, and that a
> number inside a matched IBAN/card span never mints a MONEY span.
> Add MONEY to the P11 category-toggle list (default **on**).

### [ ] P13 — Realistic output mode

One detection run, two renderings. The mappings are unchanged; what differs is
the string each placeholder resolves to when the sanitized text is built.

Fake data must be bundled — hard rule 2 rules out any hosted generator — and
generated in `src/core/` like `dictionary.ts` and `entities.ts` are. The data
pools (a Spanish given-name and surname list, company-name components) are the
same "small bundled language data" problem as D3's shield lexicon and the
backlog's per-language stopword packs; put them under `src/core/data/` with a
shape those two can adopt later rather than inventing a third convention.

MONEY is a **perturbation**, not a swap: multiply by a random factor in ±10–25%
and round to the same precision and grouping convention P12 recorded, so
"12.450,00 €" becomes another plausible figure of the same magnitude rather than
an unrelated fabrication. Substitution is **seeded from the session id**, so the
same document renders the same fake data every time it is opened — a user
comparing two renderings of their own document must not see the names shuffle.
The seeded PRNG is a few lines (mulberry32 or similar); no dependency, and
`Math.random` is not acceptable here for that reason.

> Add `src/core/pseudonymize.ts`: `pseudonymFor(item, seed)` returning a fake
> value per category — NAME and COMPANY from the bundled pools, MONEY
> perturbed, and a **placeholder passthrough for every category with no
> plausible fake form** (DNI/NIE/IBAN/CREDIT_CARD — a fake but validly
> checksummed identifier is worse than an obvious token, and an invalid one
> fools nobody). Uniqueness is enforced within a session: two different people
> never draw the same fake name.
> Add `renderPseudonymized(session)` beside the existing anonymized-text build,
> reusing the same span application (`apply.ts`) so the two paths cannot drift.
> Tests first: determinism for a fixed seed; no two mappings sharing a fake
> value; perturbed amounts landing in the band and keeping their grouping
> convention and currency marker; passthrough categories emitting the
> placeholder verbatim; and that the mapping list itself is untouched by the
> rendering.
> UI: a "Placeholders / Realistic" radio on 2.3 in `MappingPanels.tsx` with a
> persistent warning line — realistic output cannot be restored in step 3. Copy
> and the P9/P10 export both follow the selected mode. Step 3 either refuses
> text that was produced in realistic mode or states plainly that it can only
> restore placeholder output; decide which when building it, and say so in the
> UI either way.

### [ ] P14 — Extract strings + i18n layer

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

Layout:

```
src/locales/en.json     # source of truth, hand-edited
src/locales/<lang>.json # written by Localazy, committed via PR
src/i18n.ts             # t(), language detection, persisted to localStorage
```

Keys grouped by component (`review.title`, `rules.addRule`) — maps straight onto
Localazy's JSON format and keeps the file navigable.

> Add `src/i18n.ts` exposing `t(key, params?)` over `src/locales/en.json`, loading
> locale files with `import.meta.glob('./locales/*.json', { eager: true })` — no
> new dependency, no network. Language comes from a persisted user choice falling
> back to `navigator.language`, resolved exact locale → base language → `en`
> (`gl-ES` → `gl.json`), with a picker in the UI. Locale files are named by plain
> language code; the resolver must also accept region-qualified filenames such as
> `pt_BR.json`. Move every hardcoded user-facing string in `src/App.tsx` and
> `src/components/` into `en.json` — including everything M4a and P12/P13 added.
> Audit `src/core/` for user-facing text and convert it to codes the UI
> translates; core stays pure (hard rule 4) and gets no i18n import. Add tests
> for the fallback chain (`gl-ES` → `gl`, unknown language → `en`,
> region-qualified file preferred over its base when both exist) and that
> `en.json` has no duplicate or unused keys.

### [ ] P15 — Localazy sync through GitHub Actions

**Decided:** the official Localazy GitHub Actions with repository secrets — not
the CLI in a hand-rolled step, not a local developer sync.

> Add `localazy.json` at the repo root: upload `src/locales/en.json` as source
> (`type: json`, `lang: en`), download to `src/locales/${lang}.json` —
> `${lang}` deliberately, not `${locale}`, per the P14 decision. Add
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
P15 depends on P14 — there is nothing to upload until `en.json` exists.

---

## Optional, only if cheap — `.docx` / `.odt` export

Not a `P` block, and dropping it entirely is an acceptable outcome. This is
Markdown → document, the opposite direction from M3's import parsers for the
same extensions, and likely a different library even where the extension
matches. `docx` (the npm package — *not* mammoth.js, which is import-only) is
the natural candidate for `.docx`; `.odt` export has no equally simple
client-side library today. Before committing to either: check the candidate
against hard rule 3 (no dependency may make a network request) and against the
`vite-plugin-singlefile` portable build's size budget. If the feasibility check
is not clean and short, close this out as "not doing it" rather than letting it
sit open.

## Deferred to a later milestone

- **Simplified wildcard syntax for dictionary rules** (`TG-*`, `TG-??` compiling
  down to the existing `isRegex` path). Recorded in the index file's backlog; it
  is a thin UI layer over machinery that already exists, and it is not gated on
  anything in M4.
- **Per-language stopword packs**, which should share the `src/core/data/`
  convention P13 establishes.
