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

**Done 2026-09-26 (v0.7.0).** (Masking of symbol-edged amounts was broken until v0.7.1 — see P13.) Lives in `src/core/money.ts` (not `detectors.ts`)
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

### [x] P13 — Realistic output mode

**Done 2026-09-26 (v0.7.1).** `src/core/pseudonymize.ts` (`pseudonymFor`,
`pseudonymMap` for session-wide uniqueness, `renderPseudonymized`),
`src/core/random.ts` (mulberry32 + FNV-1a seed), pools in
`src/core/data/es/pseudonyms.ts` — the `data/<lang>/<purpose>.ts` convention for
D3's lexicon and the stopword packs to follow. `applyEnabledMappings` takes a
`render` function, so both modes go through one replacement. NAME keeps token
count and all-caps; COMPANY keeps the legal suffix; MONEY keeps
precision/roundness, grouping and marker; written-out amounts and every other
category pass the placeholder through. The mode is UI state
(`anonymaizer.outputMode`), the realistic text is derived, never stored.
Step 3 decision: **states it, does not refuse** — realistic text can't be
recognised reliably, and its passthrough placeholders still restore.
Found on the way (P12 bug): `applyEnabledMappings` wrapped every variant in
`\b…\b`, which never matches beside `€` or `(`, so symbol-edged MONEY spans
were detected but never masked. Boundaries now apply only on word-character
edges, Unicode-aware.
Follow-up (v0.7.2, user request): the MONEY band is a parameter —
`MoneyRange { min, max }` in percent (default 10–25, clamped 0–90), edited on
2.3 while Realistic is selected, persisted as `anonymaizer.moneyRange`.

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

### P14 — Extract strings + i18n layer — moved to M6

Moved to [`m6-language-packs.md`](m6-language-packs.md), with its decisions and
prompt (2026-10-07).

### P15 — Localazy sync through GitHub Actions — moved to M6

Moved to [`m6-language-packs.md`](m6-language-packs.md) beside `P14`, which it
depends on (2026-10-07).

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
