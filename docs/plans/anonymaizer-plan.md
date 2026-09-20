# AnonymAIzer — Prompt Plan

Client-side text anonymization & reversal tool. Zero backend, zero egress.

**How to use this file:** each `P` block below is one prompt to paste into Claude Code,
one per session, in order. Tick the box when the session is done and tests pass.
`P8` is repeated once per file format — never batch them.
`P1` is split into `P1a` and `P1b`: the name/company heuristics get their own
session, because that is where the iteration happens.

**The spec lives at `docs/spec.md`.** Where a prompt says "§3 of the spec" or
"the §6 Spanish test bench case", read that section from `docs/spec.md`.

**Stack:** Vite + React + TypeScript + Vitest.
Vite is a build tool, not a framework — right default for a zero-backend SPA.
Next.js assumes a server; plain esbuild means wiring everything yourself.

---

## Three spec traps

The first two are still live in `docs/spec.md` §5 — fix them in the prompts, not
later. The third has already been corrected in the spec (§4a); it is recorded
here because §5's wording still reads as though it applied to anonymization.

1. **Reversal regex underscore bug.** The spec's
   `tokenRaw.replace('_', '[\\s_]?')` replaces only the *first* underscore, so
   `PROJECT_NAME_1` breaks. Needs `replaceAll` plus escaping of regex-special
   characters in the token.

2. **Sort key on reversal.** Reversal must sort by **placeholder** length
   descending, so `[NAME_1]` never eats `[NAME_11]`.

3. **Length-descending sort is the wrong mechanism for anonymization.**
   *(Resolved in spec §4a.)* With the
   M1 detection range, `NAME` fires inside `ADDRESS` and inside `COMPANY`, and no
   sort order resolves that — one detector must lose the span outright.
   Anonymization is span-based and offset-driven; see §4a of the spec. Sorting by
   `originalText.length` survives only in the reversal path (§5 / P3).

---

## Backlog (post-MVP)

Not in scope for M1. Recorded here so they aren't lost.

- **Dictionary rule case-insensitivity.** `CustomDictionaryRule` matching is
  case-sensitive in P2. A per-rule case-insensitive toggle is a natural
  follow-up.
- **Accent/diacritic-insensitive dictionary matching.** Normalize both the
  rule term and candidate text (e.g. á/ä/â → a) before comparison, so a rule
  written without accents still catches accented occurrences and vice versa.
  Needs a decision on Unicode normalization (NFD strip-combining-marks vs. a
  manual map) before implementation.
- **Per-language/country NAME_STOPWORDS packs, with a language setup step.**
  The stopword list (greetings, sign-offs, days/months) currently hardcodes
  ES + EN ad hoc, growing one word at a time as bugs surface (e.g. "Dear"
  had to be added after it swallowed a name into a bogus match). That
  doesn't scale — Portuguese alone needs separate PT-PT and PT-BR lists
  (different greeting conventions), and every added language is more surface
  for the same class of false positive/negative. Proposed shape: split
  `NAME_STOPWORDS` into per-language modules, let the user pick which
  language packs are active (a setup/settings step, not autodetection), and
  keep the list open to community contribution (a lang pack is just a data
  file, not a code change). Needs a decision on how language selection
  interacts with detection (one active pack vs. several simultaneously) and
  where the data lives (bundled vs. user-editable/importable, similar to
  custom dictionary rules).

  Genuinely ambiguous cases complicate this further: "June", "May" and
  Spanish "Amparo"/"Paz"/"Alba"/"Mercedes" are common given names *and*
  calendar/common words — the stopword approach is precision-first by
  design (§4a), so blanket-listing them trades a name false-positive for a
  guaranteed miss on anyone actually named June. A stopword pack alone
  can't resolve this; it needs either context (M2's NER model, which this
  is explicitly a stopgap for) or a narrower rule than "reject the whole
  word" — e.g. only treat "June"/"May" as the month sense when followed by
  a day/year number, leaving the bare capitalized word available to NAME.

## Mobile

Path is Vite + React → **Capacitor**: same build wrapped in a native iOS/Android
shell. Same codebase, store distribution, native share sheet so text can be sent
into the tool from any app. Added later, no rewrite.

What makes that work is the `src/core/` rule in P0 — pure TypeScript, no React,
no DOM. That rule is the mobile insurance. Don't let it slip.

Constraints to plan around:
- **NER (M2)** is the problem, not the app. Quantized ONNX in WASM is tens of MB
  and slow on phones; iOS WKWebView memory limits will bite. Opt-in, desktop-first.
- **PDF parsing** via pdfjs is memory-heavy on mobile for large files.

React Native or Flutter would be a rewrite — mammoth, pdfjs and turndown are all
browser libraries. Not worth it.

---

# Milestone 1 — "Paste & Revert" PoC

### [x] P0 — Scaffold + CLAUDE.md

> Create a Vite + React + TypeScript app called anonymaizer. Zero backend, no
> network calls at runtime. Add Vitest. Write a CLAUDE.md stating: all logic runs
> client-side; `src/core/` is pure TypeScript with no React or DOM imports; every
> core module ships with tests; no dependency may make a network request.

### [x] P1a — Types + deterministic detectors + span arbitration

> In `src/core/`, implement the `MappingItem`, `MappingSession` and
> `CustomDictionaryRule` types [paste §3 of the spec], including the open
> `Category` type. Then implement the detection pipeline of §4a: an internal
> span type, the priority ladder, whole-candidate drop on overlap, dedup by
> `originalText`, and right-to-left offset substitution — P1b and P2 both build
> on these. Then the deterministic detectors returning spans: EMAIL, PHONE (ES +
> international), ADDRESS (street keyword + name + number, postal code and
> trailing locality both optional), Spanish DNI/NIE, IBAN and credit card — each
> of the last four validated by checksum (Luhn, mod-97, DNI/NIE letter), with a
> failed checksum discarding the match. Counters per category start at 1.
> Write tests first: the §6 Spanish bench case minus the name (that is P1b's),
> one valid and one invalid-checksum case per validated detector, and a dedup
> case where the same email occurs three times and yields one `[EMAIL_1]`.

### [x] P1b — COMPANY + NAME heuristics

> Add the two heuristic detectors from §4 of the spec to the P1a ladder.
> COMPANY by three routes: the widened legal-form suffix list, the prefix forms
> (`Grupo`/`Banco`/`Fundación`/`Universidade`/…), and the ALL-CAPS acronym
> heuristic at confidence `0.4` with `enabled: false` and the fiscal-acronym
> exclusion list. NAME as specified — 2+ tokens, Unicode-letter class for
> "capitalized" (not a hardcoded accent list), hyphenated compounds, ES/FR/DE/PT
> nobiliary particles, capped at ~6 tokens, must end on a capitalized or
> hyphenated-compound token, precision-first (sentence-initial and stopword-led
> sequences rejected), confidence `0.6`, source `'regex'`.
> Write tests first: `TICGAL, SL` / `TICGAL SLU` / `Acme Corp.` / `Müller GmbH`
> / `Grupo Inditex` → `[COMPANY_n]`; `Oscar Beiro` → `[NAME_n]` at confidence
> 0.6; `Miguel Ángel García de la Vega`, `Laura Fernández-Smith`,
> `François Müller`, `Amélie de la Tour`, `João da Silva`, `Ana Söder`,
> `Ludwig von Trapp` → each a single `[NAME_n]` covering the whole compound
> name; a lone sentence-initial capitalized word must NOT false-positive;
> the §6 negative corpus yields zero detections; and the §6 arbitration case
> yields exactly `[COMPANY_1]`, `[COMPANY_2]`, `[ADDRESS_1]` and no `NAME`.

### [x] P2 — Tier 1 dictionary + anonymizer

> Add `applyDictionary(text, rules)` supporting FIXED and CATEGORY replacement
> types, regex and literal terms. Dictionary matches are resolved to spans and
> fed into the §4a ladder at top priority — not string-replaced ahead of
> detection. Then `anonymize(text, rules)` orchestrating dictionary → regex
> through that ladder. Test that "Project Alpha" overrides auto-matching, and
> that a dictionary term overlapping a regex hit wins the whole span.

### [x] P3 — Reversal engine

> Implement `reverseText(aiResponse, mappings)`. Escape regex metacharacters,
> replace *all* underscores with `[\s_]?`, sort by placeholder length descending.
> Tests: round-trip 100% restoration; `[NAME_1]` / `[NAME 1]` / `[Name_1]` / bare
> `NAME_1` all restore; `[NAME_1]` never eats `[NAME_11]`; "Ana" inside
> "Análisis" survives.

### [x] P4 — UI

> Build the three panels: smart paste (clipboard `text/html` → Markdown via
> turndown, plain text passthrough), interactive mapping table with per-row enable
> toggles and a copy-sanitized-text button, and a reversal panel. Add a
> **select text → create dictionary rule** affordance: bare brand names
> (`TICGAL` with no legal-form suffix) are unreachable by regex by design, so
> this is how they get anonymized. Rows with `enabled: false` — ALL-CAPS company
> guesses now, sub-0.8 NER hits from P7 later — must render visibly distinct
> from applied ones. State in React only, session persisted to localStorage.
> Keep it one screen, no router.

### [x] P5 — Custom dictionary management

> Add a rules editor: create/edit/delete `CustomDictionaryRule`, regex toggle with
> live validation, persisted to localStorage, importable/exportable as JSON.

### [ ] P6 — Ship M1

> Add `vite-plugin-singlefile` and a PWA manifest + service worker so the build
> produces an offline single-file HTML. Verify with devtools that a full session
> makes zero network requests.

---

# Milestone 2 — Local NLP (separate session)

### [ ] P7 — NER worker

> Add `src/workers/ner.worker.ts` using @xenova/transformers with a quantized
> bert-base-NER ONNX model. Worker-only, lazy-loaded on user opt-in. Merge results
> into mappings with `source: 'ner'` and real confidence scores; flag anything
> under 0.8 in the table. On overlapping spans, `source: 'ner'` supersedes both
> M1 heuristics from P1b — the NAME regex and the ALL-CAPS COMPANY guess — by
> entering the §4a ladder above them. Both heuristics stay as the fallback for
> users who don't opt into the model.

**Decide before starting P7:** the model is tens of MB and can't live inside a
single-file HTML bundle. Either the PWA caches it on first opt-in, or M2 ships as
a separate build target.

---

# Milestone 3 — Document parsers

One prompt per format, one session each. Template:

### [ ] P8 — `.docx` (mammoth.js)

> Add a `.docx` parser in `src/core/parsers/` using mammoth.js, exposing
> `parse(file): Promise<{markdown, format}>`. Do not touch other parsers or the UI
> beyond registering it.

Then repeat verbatim, swapping library and format:

- [ ] `.pdf` — pdfjs-dist (positional X/Y text reflow into Markdown)
- [ ] `.eml` — letterparser / eml-parse-js
- [ ] `.pptx` — jszip + native DOMParser XML processing
- [ ] `.xlsx` / `.csv` — xlsx (SheetJS)
- [ ] `.odt` — jszip + native DOMParser XML processing
