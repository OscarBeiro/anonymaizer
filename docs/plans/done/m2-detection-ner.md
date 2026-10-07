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
