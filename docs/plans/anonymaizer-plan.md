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

### [x] P7f — Markdown emphasis breaks detection (live bug, fix before M3)

Found while planning M3. Markdown is the right interchange format — block
structure (headings, lists, tables) is exactly what a parser must preserve, and
pipes were verified harmless to detection. **Inline emphasis is not.** Two P7a/
P7b guards, each correct for the input they were written for, misfire on
turndown's output:

1. `PRECEDING_ATTACHED_RE` (`src/core/detectors.ts:413`) includes `*` and `_`,
   added so a NAME could not start inside `76****12E`. A leading `_` or `*` now
   rejects the whole candidate.
2. `MASK_GLYPHS = '*xX•_'` (`src/core/detectors.ts:175`) makes `**Ester` a valid
   masked-ID token — a mask run of 2, five alphanumerics. It claims the span at
   `RUNG.VALIDATED_REGEX` and §4a's whole-candidate drop kills the NAME.

Measured against the current detectors:

```
"Ester Cuni"        NAME: ["Ester Cuni"]   MASKED_ID: []
"_Ester Cuni_"      NAME: []               MASKED_ID: []               ← leak
"*Ester Cuni*"      NAME: []               MASKED_ID: []               ← leak
"Ester\_Cuni"       NAME: []               MASKED_ID: []               ← leak
"**Ester** Cuni"    NAME: []               MASKED_ID: ["**Ester**"]    ← "Cuni" leaks
"**Ester Cuni**"    NAME: []               MASKED_ID: ["**Ester","Cuni**"]
```

This ships today: `PastePanel`'s turndown path produces these shapes whenever
someone pastes rich text, and `Ester\_Cuni` is turndown's own character
escaping, with no bold involved at all. M3 makes it much worse — mammoth and the
ODF walker emit emphasis on exactly the fields that are PII: letterheads,
signature blocks, form labels (`**Nombre:** Ester Cuni`), table headers.

> Keep block structure, strip inline decoration. Create
> `src/lib/htmlToMarkdown.ts` holding the single shared `TurndownService`
> instance (hoisted out of `PastePanel.tsx`'s module-level singleton, no
> behaviour change there beyond the rules below), configured to render
> `strong`/`b`/`em`/`i` as their plain text content and with turndown's
> character escaping disabled. Emphasis carries nothing an LLM needs from this
> pipeline; headings, lists and tables do. Every M3 parser then inherits the fix
> by using this helper instead of constructing its own instance — P8b's docx
> parser is the first consumer.
> Extend `src/core/__fixtures__/` with emphasis-wrapped variants of the existing
> clinical-report shapes: a bolded name in a signature block, an italicized name,
> a `**Label:** value` form line, and a name containing an underscore that
> turndown would escape.
> Write tests first: each row of the table above yields the same detections as
> its unemphasized form; `76****12E` still yields one `[MASKED_ID_1]` (the guard
> must keep working for the input it was written for); the §6 negative corpus
> still yields zero detections.

> **Trap — do not fix this in the detectors.** Teaching each detector to skip
> Markdown syntax means every one of them grows offset-mapping logic, and the
> minted placeholders still land next to stray `**`. Normalizing at the ingest
> boundary is one change in one file; the detectors keep operating on clean
> prose, which is the assumption §4a is built on.

**Shipped.** `src/lib/htmlToMarkdown.ts` holds the one shared `TurndownService`
instance: a custom `addRule` unwraps `strong`/`b`/`em`/`i` to plain content
(added rules run before turndown's built-ins, so this actually takes effect),
and `escape()` is overridden to drop only the `*`/`_` escape pairs — every
other default escape (leading `#`/`-`/`>`, backslash, brackets, code fences,
numbered lists) is kept, since those characters aren't in `MASK_GLYPHS` or
`PRECEDING_ATTACHED_RE` and there's no detection reason to touch them.
`headingStyle: 'atx'` was also set, replacing turndown's default mixed style
(setext underlines for h1/h2, atx `###` from h3 down) with one consistent
marker — a small independent cleanup, not part of the bug. `PastePanel.tsx`
now calls `convertHtmlToMarkdown` instead of holding its own
`TurndownService`; no behaviour change there beyond the fix itself.
`src/core/__fixtures__/emphasis.ts` adds `EMPHASIS_FIXTURE_HTML`: a bolded
name in a signature block, an italicized name mid-sentence, a bold `Nombre:`
label line, and a bold code value containing a literal underscore
(`REF_2026_01`) to pin the "corrupts plain prose, not just names" half of the
bug. Tests live in `src/lib/htmlToMarkdown.test.ts` (18 tests): the escape/
emphasis rules in isolation, `detectNames`/`detectMaskedIds` surviving each
emphasis form, the masked-ID guard still catching its real target
(`76****12E`), and a full-pipeline regression clustering all three spellings
of the fixture's name behind one placeholder. All pre-existing tests (176
total) and `npm run lint`/`npm run build` still pass unchanged.
One test simplification made along the way: table conversion was dropped from
scope here — plain turndown has no table rule at all (that needs the
`turndown-plugin-gfm` plugin, not installed), and M3's parsers build their own
Markdown tables directly rather than routing tabular HTML through this path.

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

One prompt per format, one session each — plus a prep session first, because
four decisions have to be made once rather than rediscovered (and answered
differently) in each format session.

## Shared decisions — settled, do not re-litigate in a session

The original one-line-per-format template hid four problems, each of which
would have blown up mid-session:

1. **Rule 4 collision.** `src/core/` is pure TypeScript — no React, no DOM; it
   is the Capacitor insurance. But mammoth, pdfjs, `DOMParser` (pptx/odt) and
   turndown (eml HTML bodies) are all browser libraries. Every M3 parser except
   `.csv` would have violated rule 4.
   → **The registry stays pure in `src/core/parsers/`; concrete parsers live in
   a new `src/lib/parsers/`.** Rule 4 stays absolute.
2. **Bundle weight vs. the P6 single-file promise.** Parsers register by import
   side effect, so a static import graph inlines mammoth + pdfjs + SheetJS +
   jszip into `index.html` for every user, including the ones who only paste
   text. → **Lazy-loaded per format via dynamic `import()`.**
3. **Runtime network risk.** pdfjs-dist fetches cMaps and standard fonts from a
   CDN by default — a silent breach of hard rules 2 and 3, and only on
   documents with CJK or embedded fonts. → Handled explicitly in P8c.
4. **`ParsedDocument` is too thin.** `{ markdown, format }` has no channel for
   partial failure (an image-only PDF, dropped email attachments, sheet 7 of
   40), and `format` is a free string feeding `MappingSession.originalFormat`.
   → **`warnings?: string[]` plus a closed `DocumentFormat` union.**

A fifth, found while planning: `vitest.config.ts` pins `environment: 'node'`
and `include: ['src/**/*.test.ts']`. Every DOM-using parser test needs a
different environment, and no format session would expect to touch test config.
→ Handled in P8a.

**Order:** `.docx`, `.pdf`, `.odt` first (they match the documents the tool is
actually being used on), then `.csv` and `.xlsx` as *separate* sessions (csv
needs no dependency at all), then `.eml` and `.pptx`.

**Scanned/image-only PDFs are out of scope.** OCR means another multi-MB WASM
model and a second opt-in flow — that is M2-shaped work, not parser work. The
`.pdf` parser detects "zero extractable text" and warns.

### [ ] P8a — Parser infrastructure (prep session, no new format)

> Widen the parser seam before any real format lands.
> In `src/core/parsers/index.ts`: add `format: DocumentFormat` (a closed union
> — `'raw_text' | 'docx' | 'pdf' | 'odt' | 'csv' | 'xlsx' | 'eml' | 'pptx'`,
> declared in `src/core/types.ts` and used for `MappingSession.originalFormat`)
> and `warnings?: string[]` to `ParsedDocument`. `DocumentFormat` lives in
> `types.ts` and is imported by the registry, not the other way round —
> `MappingSession` should not reach into the registry for the shape of one of
> its own fields.
> Change the registry from `Map<string, Parser>` to `Map<string, ParserLoader>`
> where `ParserLoader = () => Promise<Parser>`; `registerParser` keeps its
> `(extensions, parser)` shape for eager parsers like plain text, and a new
> `registerLazyParser(extensions, loader)` takes the loader.
> `supportedExtensions()` must still answer from the key set without invoking
> any loader — that is what keeps the drop-zone hint free. `parseDocument`
> awaits the loader, caches the resolved parser, and on loader rejection throws
> an error naming the format rather than leaking a chunk-load message.
> Create `src/lib/parsers/index.ts` as the single registration site the UI
> imports (`import '../lib/parsers'` from `App.tsx`), each entry one line:
> `registerLazyParser(['docx'], async () => (await import('./docx')).parse)`.
> That file must contain **no library imports** — only the thunks.
> Surface `warnings` in `IngestStep.tsx`: `onFileImport` gains a `warnings`
> argument and the drop zone renders them as a non-blocking notice, visually
> distinct from the existing `.form-error`.
> Update `vitest.config.ts` so `src/lib/parsers/**/*.test.ts` runs under a DOM
> environment (`environmentMatchGlobs`, or `happy-dom`/`jsdom` as a
> devDependency) while `src/core/**` stays on `node` — core purity is the point
> of that split, so keep it explicit in the config comment.
> Write tests first: `supportedExtensions()` lists a lazily-registered format
> without calling its loader (assert with a spy); `parseDocument` invokes the
> loader exactly once across two calls; a rejecting loader produces an error
> message naming the extension; a parser returning `warnings` round-trips them.

> **Trap — `vite-plugin-singlefile` and dynamic imports.** The plugin's
> recommended build config sets rollup's `inlineDynamicImports`, which would
> inline every parser chunk back into `index.html` and erase the whole point of
> lazy loading. P7d already established the precedent — the NER worker ships as
> a separate file beside `index.html` ("single-file for everything except the
> opt-in model"). **This session must verify empirically, not assume**: run
> `npm run build` and inspect `dist/`. If parser chunks are inlined, configure
> the plugin to leave them out (its `inlinePattern`/`useRecommendedBuildConfig`
> options) and confirm a chunk emitted beside `index.html` still loads from a
> `file://` origin — that is the origin this build is meant to be opened from,
> and exactly where the NER model cache broke in P7d. Record the measured
> outcome here the way P7d's "Build output caveat" note does.
> Two constraints to know before experimenting: rollup rejects
> `output.manualChunks` together with `inlineDynamicImports`, so that is not a
> combination to reach for; and if `file://` chunk loading proves impossible,
> the fallback is the P7d shape — a second rollup entry per heavy parser,
> emitted beside `index.html` exactly as `ner.worker-*.js` is. Web Workers have
> no `DOMParser`, so a Worker-based fallback would **not** cover
> `.odt`/`.pptx`/`.eml`; those parse on the main thread by necessity, and each
> should carry a one-line comment saying so — "heavy parsing ⇒ worker" is the
> obvious wrong inference from `ner.worker.ts`.

### [ ] P8b — `.docx` (mammoth.js)

> Add `src/lib/parsers/docx.ts` exporting
> `parse(bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument>`, using
> mammoth's `convertToHtml({ arrayBuffer })` and converting the HTML to Markdown
> with the **existing** turndown dependency — do not add a second HTML→MD
> library, and do not construct a `TurndownService` here: use the shared
> `src/lib/htmlToMarkdown.ts` from P7f, which is what keeps emphasis markers out
> of the string the detectors run offsets over.
> Collect mammoth's own `messages` array into `warnings` — it reports
> unsupported styles and dropped images. Return `format: 'docx'`.
> Register it lazily in `src/lib/parsers/index.ts`; touch no other parser and no
> UI beyond that one line.
> Write tests first, against a programmatically built fixture (see Fixtures):
> headings and lists survive as Markdown; a table becomes a Markdown table;
> mammoth warnings land in `warnings`; a corrupt/truncated zip throws rather
> than silently yielding an empty document.

### [ ] P8c — `.pdf` (pdfjs-dist)

> Add `src/lib/parsers/pdf.ts`. Use `pdfjs-dist`'s `getDocument`, walk pages,
> and reflow `getTextContent()` items into Markdown using their transform —
> group items into lines by Y proximity, join with spaces, break paragraphs on
> vertical gaps. Return `format: 'pdf'`.
> If total extracted text is empty or near-empty, return the empty markdown plus
> a `warnings` entry saying the PDF appears to be scanned images and that text
> extraction found nothing — **no OCR**, deliberately out of scope. Warn on page
> count above a threshold rather than silently taking minutes.
> Write tests first: a two-page generated PDF reflows into paragraphs in reading
> order; a two-column layout does not interleave columns; an image-only PDF
> yields the scanned-document warning and no throw.

> **Trap — pdfjs phones home (hard rules 2 and 3).** By default pdfjs fetches
> cMaps and standard fonts from a CDN, and resolves its worker by URL. Set
> `GlobalWorkerOptions.workerSrc` to a bundled worker
> (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`), and pass
> **no** `cMapUrl`/`standardFontDataUrl` rather than the CDN defaults. A full
> local cMap bundle is heavy for a tool whose expected input is Latin-script
> business documents, and we never render — so accept degraded glyph mapping on
> exotic scripts, add it to `warnings`, and say so in a code comment. **Verify
> in devtools with the network tab open on a CJK PDF and on a PDF with embedded
> fonts** — this is the P6 zero-network guarantee, and a default-config pdfjs
> breaks it only on documents that happen to need those assets.

> **Trap — the build that ships and the build that tests differ.** pdfjs's
> standard ESM export and its `pdfjs-dist/legacy` build behave differently under
> Vite/browser vs. Vitest, where `DOMMatrix`/`Path2D` can be missing even in a
> DOM environment. Confirm which entry `getTextContent()` actually needs on each
> side before settling on an import path, and do not let the test environment's
> requirement leak into what ships to the browser.

### [ ] P8d — `.odt` (jszip + DOMParser)

> Add `src/lib/parsers/odt.ts`. Unzip with jszip, read `content.xml`, parse with
> the native `DOMParser` (this is why the file lives in `src/lib/`), and walk
> `text:h` / `text:p` / `text:list` into Markdown, mapping `text:h`'s
> `text:outline-level` to heading depth and `table:table` to Markdown tables.
> Return `format: 'odt'`. Warn on embedded objects and images that are dropped.
> Write tests first: heading levels, nested lists, and a table survive; a
> document with a tracked-change or annotation node does not leak the reviewer's
> name into the output silently — either include it or warn that it was dropped,
> but decide and test it, because unreviewed metadata is a privacy leak in a
> tool whose whole job is privacy.

> **Trap — ODF metadata is PII.** `meta.xml` carries author, initials, editing
> cycles and often a full name that never appears in the visible text. Decide
> explicitly whether to extract it (so the anonymizer can *see* it) or drop it,
> and state the choice in a code comment. The same question returns for `.docx`
> and `.pptx`; answering it here sets the precedent.

> **Trap — jszip is a shared dependency, not an odt one.** `.pptx` needs it too,
> and `.eml` may. Install it once here and keep the call shape
> (`JSZip.loadAsync(bytes)`) identical, so P8h can copy the pattern rather than
> re-derive it.

### [ ] P8e — `.csv` (no dependency)

> Add `src/lib/parsers/csv.ts` — a hand-rolled RFC 4180 reader (quoted fields,
> escaped `""`, embedded newlines and commas, `\r\n`), with delimiter sniffing
> for `,` / `;` / `\t`. Emit a Markdown table. Return `format: 'csv'`.
> No library: SheetJS is not worth pulling in for this. The parser is small
> enough to be *nearly* pure — put it in `src/lib/parsers/` anyway, for
> consistency with its siblings.
> Warn above a row threshold: a 50k-row CSV becomes an unusable Markdown table
> and a very slow detection pass.
> Write tests first: a quoted field containing the delimiter; an embedded
> newline inside quotes; the `""` escape; a semicolon-delimited European export;
> a ragged row with fewer cells than the header.

### [ ] P8f — `.xlsx` (SheetJS)

> Add `src/lib/parsers/xlsx.ts` using SheetJS, one Markdown table per sheet with
> the sheet name as a heading. Return `format: 'xlsx'`. Warn when formulas are
> flattened to values, and when sheet or row counts exceed a usable threshold.
> Reuse `csv.ts`'s Markdown-table emitter rather than writing a second one.
> Write tests first: a two-sheet workbook produces two headed tables; a date
> cell is not emitted as an Excel serial number; an empty sheet is skipped with
> a warning.

> **Trap — where SheetJS comes from.** The `xlsx` package on npm is stale and
> deprecated upstream; SheetJS distributes current builds from their own CDN.
> A CDN-sourced dependency is an install-time supply-chain decision, not a
> runtime network call, but it still needs a conscious choice: pin the npm
> version and accept it, or vendor the CDN build. Decide before installing and
> record which, the way P7d recorded the protobufjs advisory.

### [ ] P8g — `.eml` (letterparser / eml-parse-js)

> Add `src/lib/parsers/eml.ts`. Parse MIME, prefer the `text/plain` part; when
> only `text/html` exists, convert it with the shared `src/lib/htmlToMarkdown.ts`
> from P7f. Prepend a header block (From / To / Cc / Subject / Date) as
> Markdown — those headers are the densest PII in the file and must reach the
> detectors. Decode quoted-printable and base64 bodies and honour the declared
> charset. Return `format: 'eml'`. Warn listing attachment filenames, dropped.
> Write tests first: a quoted-printable body with accented Spanish decodes
> correctly; a multipart/alternative message prefers the plain part; headers
> appear in the output so `EMAIL`/`NAME` detection reaches them; a latin-1
> message does not produce mojibake.

### [ ] P8h — `.pptx` (jszip + DOMParser)

> Add `src/lib/parsers/pptx.ts`. Unzip, iterate `ppt/slides/slideN.xml` in
> **numeric** order (not lexicographic — `slide10` must not sort before
> `slide2`), extract `a:t` text runs grouped by shape, and emit one `## Slide N`
> section per slide. Include speaker notes from `ppt/notesSlides/` under a
> sub-heading. Return `format: 'pptx'`. Warn about dropped images and charts.
> Write tests first: slide order is numeric; text inside a table shape is
> extracted; speaker notes appear and are labelled; a deck with no notes parts
> does not throw.

### M3 fixtures

Binary fixtures are **generated, never committed as real documents** — the same
rule `src/core/__fixtures__/clinicalReport.ts` already states for the clinical
report. Each format session adds a small builder under
`src/lib/parsers/__fixtures__/` that constructs a minimal valid file in memory
(a hand-built OOXML/ODF zip via jszip for docx/odt/pptx; a hand-written minimal
uncompressed PDF byte string for pdf; a template literal for csv/eml), so the
suite stays dependency-light and every fixture's contents are readable in the
diff. Reuse the shapes from `CLINICAL_REPORT_FIXTURE` as the text payload
wherever a format needs prose, so a parser regression surfaces as a detection
regression in the same corpus.

### M3 verification

Development runs in Podman (`~/containers/anonymaizer/README.md`) and
`node_modules` is not installed on the host, so every command below runs
**inside the container**.

Per session: `npm test` (tests written first, per CLAUDE.md rule 5) and
`npm run lint`.

At P8a, additionally — this gates the whole milestone:

1. `npm run build`, then inspect `dist/`: confirm parser code is **not** inlined
   into `index.html`. The pass/fail signal is `dist/index.html`'s byte size
   before vs. after — record the baseline, and re-check it in every later format
   session, since a lazy split that silently regresses is invisible otherwise.
2. Open `dist/index.html` from a `file://` URL, paste text, complete a full
   sanitize/restore round trip with the network tab open — **zero requests**.
   Then import a `.txt` file and confirm the lazy path still resolves from
   `file://`.
3. Record the measured outcome here, in the style of P7d's "Build output
   caveat".

At P8c, additionally: import a CJK PDF and a PDF with embedded fonts from the
`file://` build with the network tab open — still zero requests.

At each format session: `npm run dev`, drop a real document of that format into
step 1, and confirm step 2 shows sanitized text with sensible placeholders and
that any warnings render.

---

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
