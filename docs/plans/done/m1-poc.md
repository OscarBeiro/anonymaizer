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

### [x] P6 — Ship M1

> Add `vite-plugin-singlefile` and a PWA manifest + service worker so the build
> produces an offline single-file HTML. Verify with devtools that a full session
> makes zero network requests.
