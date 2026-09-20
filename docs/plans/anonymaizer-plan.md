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

- **Simplified wildcard syntax for custom dictionary rules, default mode
  (M4?).** Full regex is the current `isRegex` option, but the target user
  is office staff, not engineers — raw regex is the wrong default surface.
  Proposed: a glob-like mini-syntax as the default (non-regex) rule type,
  e.g. `TG-*` (matches everything after `TG-` up to the next whitespace)
  and `TG-??` (matches exactly two characters after `TG-`). This compiles
  down to a real regex internally — `*` → `\S*`, `?` → `\S` — so it's a thin
  UI/parsing layer over the existing `isRegex` path, not a new detection
  engine. Full regex stays available as an "advanced mode" toggle next to
  it (`RulesEditor.tsx`'s existing `isRegex` checkbox), not removed.

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

### [x] P6 — Ship M1

> Add `vite-plugin-singlefile` and a PWA manifest + service worker so the build
> produces an offline single-file HTML. Verify with devtools that a full session
> makes zero network requests.

---

# Milestone 2 — Detection quality, then local NLP (separate sessions)

M1 was run against a real structured Spanish document (a psychological
evaluation report) and the reviewer came back with 12 distinct failures. They
reduce to five root causes, all reproducible from the M1 code:

| # | Root cause | Symptoms |
|---|---|---|
| R1 | `NAME_TOKEN` accepts a **one-letter** token, and a NAME span may start mid-word | `76****12[NAME_2]` (ate a DNI check letter), `[NAME_11]-04250` (ate `Colegiada T`) |
| R2 | No **negative/shield** concept — any capitalized multi-word run is a NAME candidate | `Prevención de Riesgos Laborales`, `Real Decreto Legislativo`, `Texto Refundido`, `Convención Internacional`, `Directiva 2000/78/CE`, `Psicóloga General Sanitaria` |
| R3 | No detector for **masked** or **label-anchored** identifiers | `76****12E` unmatched, `T-04250` exposed, `EV-023/2026` untouched |
| R4 | Dedup is by **exact `originalText`** (`buildMappings`, `src/core/span.ts`) | `Ester Cuni` / `Ester Cuni Peirote` / `CUNI PEIROTE ESTER` → three placeholders for one person |
| R5 | `PHONE_REGEX` allows `.` separators and only checks digit count (9–15) | signature timestamp `2026.09.18 13` → `[PHONE_1]` |

Only R2 genuinely needs context. The rest are deterministic, so **P7a–P7c land
before the NER worker** — the model then only has to solve what a regex can't.

### [x] P7a — NAME precision: token floor, boundaries, shield spans

> Fix R1 and R5 and introduce shield spans. `NAME_TOKEN` becomes
> `\p{Lu}\p{L}+` (≥2 letters) plus an explicit initial form (`\p{Lu}\.`, so
> `J. Smith` survives), keeping the hyphenated-compound branch. `detectNames`
> rejects a candidate whose preceding character is alphanumeric or `*`/`·`/`•`.
> Then add `shield?: true` to `DetectedSpan` and `RUNG.SHIELD = -1`: a shield
> is an ordinary span that wins arbitration and is then dropped in
> `runDetectionPipeline` before `buildMappings` — it claims text so nothing
> else can touch it, and mints no placeholder. Ship three shield detectors:
> legal citations (`Ley`, `Ley Orgánica`, `Real Decreto (Legislativo)`,
> `Reglamento`, `Directiva`, `Convenio`, `Convención`, `Texto Refundido`,
> `Estatuto`, `Orden`, `Resolución`, `Sentencia`, `artículo`/`art.` + trailing
> capitalized words, digits, `/`, `CE`/`UE`); professional titles (title lexeme
> + **closed** qualifier list only); and date/time shapes (`YYYY.MM.DD`,
> `YYYY-MM-DD`, `DD/MM/YYYY`, `HH:MM:SS`), which is what kills R5 without
> touching `PHONE_REGEX`. Also add the `\b` guard `reverseText` already has to
> `applyEnabledMappings` — it currently rewrites `Análisis` when `Ana` is a
> toggled mapping.
> Write tests first: one case per report symptom against the new fixture
> corpus; `Psicóloga Ester Cuni` must still yield a `[NAME_n]`; the §6 negative
> corpus still yields zero detections; the §6 arbitration case still yields
> exactly `COMPANY_1 / COMPANY_2 / ADDRESS_1`.

> **Trap — the title shield must not run greedily.** A `title + capitalized
> words` shape swallows `Psicóloga Ester Cuni` whole, and §4a's
> whole-candidate-drop rule then silently deletes a real name from the output.
> The closed qualifier list (`General`, `Sanitaria`, `Clínica`, `Forense`,
> `Laboral`, `Social`, `Titular`, `Superior`, …) is the mechanism that prevents
> this, and it needs its own test.

### [x] P7b — Masked identifiers and label-anchored codes

> Fix R3 with two detectors. `MASKED_ID` at `RUNG.VALIDATED_REGEX`: an
> alphanumeric run containing a mask run of ≥2 of `*`/`x`/`X`/`•`/`_` with ≥4
> alphanumerics total (`76****12E`, `****1234`). No checksum is possible, but
> the partial is still PII and claiming the span is what stops NAME reaching
> into it. `ID_CODE` on a new rung between `VALIDATED_REGEX` and `ADDRESS`:
> a trigger lexicon (`Colegiada/o`, `Nº Colegiado`, `Expediente`, `Ref.`,
> `Referencia`, `Nº`, `Núm.`, `Matrícula`, `NUSS`, `Protocolo`,
> `Historia clínica`) + `[:\s-]*` + a code shape (`[A-Z]{0,3}[-/]?\d[\dA-Z/-]*`).
> The label stays in the text and only the code is replaced —
> `Colegiada [ID_CODE_1]` keeps the document readable.
> Write tests first: `colegiada T-04250` → `colegiada [ID_CODE_1]`;
> `Expediente EV-023/2026` → `[ID_CODE_n]`; `76****12E` → one `[MASKED_ID_1]`
> with no NAME overlap; and the negative — a bare `2000/78` with no trigger
> word is not detected.

### [x] P7c — Entity clustering: one person, one placeholder

> Fix R4. New `src/core/entities.ts`: canonicalize a NAME (NFD-normalize and
> strip combining marks, lowercase, drop honorifics `D.`/`Dª`/`Sr.`/`Sra.`/
> `Don`/`Doña` and the existing `NAME_PARTICLES`) into a token set, then
> cluster two NAME spans when one token set is a subset of the other **and**
> they share ≥2 tokens. That merges `Ester Cuni` ⊂ `Ester Cuni Peirote`, and
> permutation (`CUNI PEIROTE ESTER`) falls out for free; single-token overlap
> must not merge. `MappingItem` gains `variants: string[]`, canonical first
> (longest, then first-occurring). Three call sites move off text-keyed
> lookups: `buildMappings` keys by cluster; `runDetectionPipeline`'s
> `placeholderByText`/`enabledTexts` are built from every variant;
> `applyEnabledMappings` replaces every variant, sorting all variants of all
> mappings by length descending together. Then `MappingTable.tsx` (read-only
> today) lists variants under the original and gains **split** and **merge**
> actions.
> Reversal becomes lossy on purpose: `reverseText` restores the canonical form,
> so a document saying `Ester Cuni` in one place and `Ester Cuni Peirote` in
> another comes back with the canonical in both. State that in a code comment,
> in the spec, and in the UI.

> This also settles the **accent/diacritic normalization** item in the backlog
> above — implement it once here and reuse it for dictionary matching.

### [x] P7d — NER worker

> Add `src/workers/ner.worker.ts` using @xenova/transformers with a quantized
> bert-base-NER ONNX model. Worker-only, lazy-loaded on user opt-in. Merge results
> into mappings with `source: 'ner'` and real confidence scores; flag anything
> under 0.8 in the table. On overlapping spans, `source: 'ner'` supersedes both
> M1 heuristics from P1b — the NAME regex and the ALL-CAPS COMPANY guess — by
> entering the §4a ladder above them. Both heuristics stay as the fallback for
> users who don't opt into the model.
> NER spans enter above `RUNG.NAME` but **below** `RUNG.SHIELD` — a shield
> encodes a fact the model cannot know (that this run of capitalized words is a
> statute title). NER output feeds the P7c clusterer like any other NAME span.

**Decided:** the PWA caches the model on first opt-in (single build target
stays the artifact). Checked against Hugging Face directly: the quantized
ONNX model (`Xenova/bert-base-NER`, `model_quantized.onnx`) is **~104MB** —
smaller quantizations (q4/bnb4) came out *larger* for this model due to export
overhead, so quantized/int8 is in fact the smallest usable option. The opt-in
control states the ~104MB size and stays disabled mid-download so nothing
half-loaded can be triggered twice; the rest of the app keeps working on the
M1/P7a-c heuristics regardless of opt-in state, since NER is additive.

**Fixed (post-M2, wizard follow-up session):** the model was being
re-downloaded on every run, not just "first opt-in" as decided above. Root
cause: `@xenova/transformers`'s default cache (`env.useBrowserCache`) uses
the browser's Cache Storage API, which is unavailable on the `file://`
origin this single-file build is meant to be opened from — `caches` is
`undefined` there in most browsers, so caching silently never engaged.
Fixed by switching to `env.useCustomCache` with an IndexedDB-backed adapter
(`src/workers/nerModelCache.ts`) implementing the same `match`/`put`
contract as the Web Cache API — IndexedDB, unlike Cache Storage, works on
`file://`. Wired in `src/workers/ner.worker.ts`.

**Known risk, tracked, not blocking:** `npm install @xenova/transformers`
pulls in `onnxruntime-web` → `protobufjs` with a **critical** advisory
(code injection / prototype pollution parsing a protobuf schema) — live in
the runtime path, since ONNX model files are protobuf. Accepted for now: the
model URL is hardcoded to Xenova's official HF repo, not attacker-controlled
input: the realistic exposure needs a compromised CDN/MITM, not a malicious
document being anonymized. `npm audit fix --force` only offers a downgrade to
`@xenova/transformers@1.4.2`, breaking against the pipeline API used here.
**Revisit when transformers.js/onnxruntime-web cuts a patched release, or
when M3 evaluates an alternative in-browser ONNX runtime that avoids this
protobufjs path** (candidate for the M3 backlog, not solved here).

**Build output caveat:** `vite-plugin-singlefile` does not inline
`src/workers/ner.worker.ts` — it stays a separate ~810KB chunk
(`dist/ner.worker-*.js`) alongside `dist/index.html`. That's the right
outcome (the transformers.js library only loads for users who opt in,
instead of adding ~810KB to every load), but it means the P6 "one portable
HTML file" guarantee now has an exception: shipping NER means shipping two
files, not one. `index.html` alone still works standalone with NER simply
unavailable — the worker file only matters if the user opts in — so this
doesn't regress the offline-core promise, just narrows "single-file" to
"single-file for everything except the opt-in model."

Implementation notes for anyone revisiting this: the installed
`@xenova/transformers` (2.17.2) has no `aggregation_strategy` option, so the
worker gets raw per-token BIO predictions (`B-PER`/`I-PER`/…) and
`aggregateBioTokens` (`src/core/ner.ts`, pure, unit-tested) does the merge
into whole entities itself — this is also what made "mock the pipeline, test
the merge logic" straightforward: every merge/threshold/ladder-priority
decision lives in `src/core/ner.ts` and `anonymizeWithNer`
(`src/core/anonymize.ts`), fully testable with hand-built `NerEntity[]`
fixtures, no model or worker involved. Only `src/workers/ner.worker.ts` (the
actual `pipeline()` call) and `src/lib/nerClient.ts` (the `Worker` wrapper)
are unverified by the test suite — those need one manual `npm run dev` check
with the opt-in box actually ticked.

### [x] P7e — Wizard UI (after P7c, so the mapping table is reshaped once)

The M1 layout renders all three panels in a 3-column grid (`.app-panels`,
`src/App.css`) with the rules editor as a fourth block below. On a real document
it fails: each textarea gets a third of a 1100px container at a 160px
min-height, so the text you are trying to read is the smallest thing on screen,
and the restore panel holds a column permanently even though it is only needed
after a round trip to an AI. **This supersedes P4's "one screen" wording** —
one step at a time, each using the whole viewport. Still no router; steps are
React state.

> Build a three-step wizard. **Step 1 Ingest**: a maximized paste area (keep
> `PastePanel`'s turndown HTML→Markdown path and its select-text→create-rule
> button verbatim) plus a drop zone / file picker. **Step 2 Review**: a
> two-column split — sanitized text and its copy button on the left, the
> placeholder list on the right — with an "Edit rules" button opening
> `RulesEditor` in a slide-over drawer (backdrop, close button,
> Escape-to-close). **Step 3 Restore**, optional and independently reachable:
> the same two-column split, AI response pasted left, restored text and its
> copy button right. `StepNav` disables step 2 while `rawMarkdown` is empty and
> enables step 3 whenever `mappings.length > 0`, including from a session
> rehydrated out of localStorage. Persist the current step under its own
> localStorage key via `src/lib/session.ts` — **do not** add `step` to
> `MappingSession`; that type is the spec §3 data contract, and wizard position
> is UI state.
> Layout: replace the 3-column grid with a flex column that fills the viewport,
> switch `.panel-textarea` from `min-height: 160px` to `flex: 1`, widen `.app`
> to ~1600px, and add a `.split` 2-column grid collapsing to one column at the
> existing 900px breakpoint.

Step 1's import needs somewhere to send a file, so this block also creates the
**M3 seam** early: `src/core/parsers/index.ts` (+ tests) with
`registerParser(extensions, parser)`, `parseDocument(fileName, bytes)` and
`supportedExtensions()`, shipping only a plain-text parser for `.txt`/`.md`.
Each M3 parser then registers itself with zero UI work; an unsupported file
shows an inline error naming the formats that do work. Populate the
`inputType: 'FILE'`, `fileName` and `originalFormat` fields that already exist
on `MappingSession` and are currently never set.

> **Trap — `src/core/` is pure TypeScript (CLAUDE.md rule 4).** The registry
> takes `ArrayBuffer` + a filename string, **never** a `File`: `File` is a DOM
> type and would break the Capacitor path. The UI does `await
> file.arrayBuffer()` and passes `file.name`. `TextDecoder` is a
> platform-neutral global and is fine inside core.

### Fixtures

There is no bench corpus today — every case is inline in a `.test.ts`, which is
why a 12-failure report had nowhere to land. P7a creates
`src/core/__fixtures__/` and puts the report's shapes there: masked DNI,
`Colegiada T-…`, `Expediente …/2026`, a statute paragraph, and a
digital-signature block with an ALL-CAPS surname-first name and a timestamp.

**Do not commit the source document.** It is a psychological evaluation naming
real, identifiable people. The fixture is synthesized — same shapes, invented
values.

---

# Milestone 3 — Document parsers

**Backlog item carried over from P7d:** evaluate an alternative in-browser
ONNX runtime for the NER worker that avoids `onnxruntime-web`'s vulnerable
`protobufjs` dependency (critical advisory, tracked in P7d's notes above) —
e.g. a newer onnxruntime-web release once it drops/patches protobufjs, or a
non-transformers.js ONNX loading path. Not blocking M2; revisit once M3's
parser work is underway or the upstream advisory is patched.

**Backlog item — placeholder tagging collision.** `reverseText`'s restore
regex runs case-insensitive (`i` flag) so an LLM that lowercases
`[name_1]` in its reply still restores — but that means two custom
dictionary categories differing only by case (`Custom` vs `CUSTOM`,
user-defined via `CustomDictionaryRule.targetCategory`) can collide on
restore. Fix is to canonicalize category casing when a custom rule mints
one (or reject a case-only collision at rule-creation time). Not a risk for
the built-in categories (`NAME`, `EMAIL`, …), which are all fixed and
distinct; only user-defined `CATEGORY`-type rules can produce this.
The other tagging question raised alongside this — whether `[NAME_1]` risks
colliding with literal bracketed text already in a document, whether
double brackets (`[[NAME_1]]`) would help, and whether the counter should
be zero-padded — was answered in-session: the existing length-descending
placeholder sort already prevents `[NAME_1]`/`[NAME_11]` prefix-eating
(that's the P3 spec-trap fix, not a bracket-style concern), double brackets
don't dodge Markdown's own `[[wiki-link]]` syntax so gain nothing, and
zero-padding fixes nothing the length-sort doesn't already fix. No action
needed on those three; only the case-collision item above is real.

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
