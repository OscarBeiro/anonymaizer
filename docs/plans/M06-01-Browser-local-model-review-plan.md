# M06-01 — Browser local model review and selection plan

Reviewed 2026-10-12. Documentation only; no model downloaded or benchmarked.
Companion to [M6](m6-language-packs.md) and
[M09 round-trip safety](M09-01-Safe-document-round-trip-plan.md).

## Recommendation

Use a multilingual PII span detector plus the existing deterministic rules for
browser anonymization. Keep replacement and restoration deterministic. A generative
chat LLM would add a second task—generating and validating span claims—and is not
required for the present workflow. If generation is later needed, evaluate it as a
separate feature; it must not rewrite the source document to perform redaction.

My first evaluation candidate is **Wismut/nym-pii-multilingual-small, int8/**.
The publisher describes a multilingual PII detector with 40 entity types under MIT.
Its card quotes 133 MB for the compressed graph; the file tree reports approximately
139 MB for the graph plus 12.4 MB for its matching tokenizer, around 151 MB total.
Treat model-card sizes as approximate and show measured complete download bytes in
the product. The edge-int8 variant saves space but has worse publisher-reported
out-of-distribution results, so it is not the initial choice.
Sources: [model card](https://huggingface.co/Wismut/nym-pii-multilingual-small),
[artifact tree](https://huggingface.co/Wismut/nym-pii-multilingual-small/tree/main/int8).

This is a **candidate recommendation, not a verified drop-in replacement**. Its
layout targets nym/ONNX Runtime. Test tokenizer compatibility, graph inputs,
operators and inference in the actual browser runtime before committing to it.
Language coverage claims do not establish quality on Galician or Portuguese.

| Role | Candidate | Reason and qualification |
| --- | --- | --- |
| Existing baseline | `Xenova/bert-base-NER` | English general NER; keep for comparison. Current application consumes only PER and ORG. |
| First browser candidate | `Wismut/nym-pii-multilingual-small`, `int8/` | Compact multilingual PII candidate; runtime compatibility is unproven here. |
| Optional higher-capacity candidate | `Wismut/nym-pii-multilingual`, `int8/` | Existing M6 choice; publisher quotes 359 MB compressed graph. Benchmark incremental recall against memory and latency before offering it. |
| Alternative architecture / future server comparison | `lBroth/nullpii` | GLiNER-based; current card distinguishes bare-model results from the complete detection pipeline and documents a Node runtime. Browser adaptation needs a separate feasibility test. |

The current model's upstream training is English CoNLL-2003 with PER/ORG/LOC/MISC
labels, not a multilingual PII taxonomy. See [upstream model card](https://huggingface.co/dslim/bert-base-NER).
For the larger candidate see [publisher card](https://huggingface.co/Wismut/nym-pii-multilingual).
For the GLiNER alternative see [nullpii card](https://huggingface.co/lBroth/nullpii).
Its current documentation describes ~1.2 GB FP32 and a 12-class schema, so the old
M6 table's 349 MB/~14-label claim must not be treated as a pinned artifact contract.

Do not rank models by headline F1 from different datasets or runtimes. In
particular, nullpii's full-pipeline score includes preprocessing and recognizers
that this application does not automatically acquire by loading its weights.

Do not make restricted-license models automatic fallbacks for a redistributable
product. `riidact/ner-multilingual` is marked CC-BY-NC-4.0; the current Piiranha
card is marked CC-BY-NC-ND-4.0. Keep them outside the default shortlist unless the
intended distribution is explicitly compatible. Sources:
[riidact](https://huggingface.co/riidact/ner-multilingual),
[Piiranha](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information).

## Code findings: fix these before comparing model quality

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| High | Whole-document NER is silently truncated. | `src/workers/ner.worker.ts` passes the entire string once. Installed `node_modules/@huggingface/transformers/src/pipelines/token-classification.js` uses `truncation: true` without an overflow/chunk loop. The current model tokenizer declares 512 tokens. Later document content receives no NER coverage, although regex still runs. `src/lib/nerLimits.ts` incorrectly describes chunked inference. |
| High | Reconstructed offsets can target the wrong occurrence. | `src/core/ner.ts` `computeTokenOffsets` searches decoded words from a cursor and ignores the token index. With `May is a month. May arrived.`, a synthetic PER prediction for the second May maps to the first. Reproduced by running the current helper in memory; this is not a claim that the actual model produces that prediction on this sentence. |
| High | File imports bypass an already-enabled model. | `src/App.tsx` `handleFileImport` calls `anonymize`, not `anonymizeWithNer` or `runNerScan`; the loaded model's status can remain ready. A new imported document can therefore be regex-only while the UI says local AI is on. |
| High | Offline model loading is not enforced by deployment policy. | Worker sets `allowLocalModels = false`, leaves remote loading available and WASM asset paths at CDN defaults. `nerModelCache.ts` falls back to a cache miss on errors. There is no worker equivalent of the analytics public-origin gate. This contradicts the local-build rule; no live network capture was performed. |
| High | Pending requests are not isolated. | `src/lib/nerClient.ts` messages have no request ID; `src/App.tsx` commits awaited results without a document revision guard. See M09 task 02 for the shared fix. |
| Medium | BIO grouping ignores gaps in token indices. | Default pipeline filtering removes O tokens; `aggregateBioTokens` can join an I-PER after skipped words. Synthetic tokens for Alice and Bob, indices 1 and 4, yielded the entity `Alice met Bob` in memory. Tokenizer alignment and grouping need a joint contract. |
| Medium | Current decoding is BERT-specific. | `computeTokenOffsets` and aggregation special-case WordPiece `##`. Multilingual tokenizer families must not reuse this heuristic without alignment tests. Lowercasing can also change Unicode lengths, making source offsets unsafe. |
| Medium | Low-confidence NER can reduce existing masking. | `mapNerEntitiesToSpans` marks scores below 0.8 disabled, but NER's rung outranks NAME in `arbitrateSpans`; arbitration runs before disabled mappings are removed. An overlapping disabled NER hit can displace an enabled heuristic. Source-level finding; add a regression fixture. |
| Medium | Initialization failures stick and cache outcomes are misleading. | A rejected `extractorPromise` remains cached; repeated requests cannot reinitialize without replacing the worker. Cache-write failures are console-only, and `deleteModelCache` resolves on `onblocked`, which does not establish completed deletion. |

Tokenizer limit source: [current BERT tokenizer configuration](https://huggingface.co/Xenova/bert-base-NER/blob/main/tokenizer_config.json).
The installed library contains `ModernBertForTokenClassification` and its registry
entry. This removes the rationale for M6's v2-to-v3 upgrade task, but does not prove
that either candidate's specific compressed graph runs in WASM or WebGPU.

## Changes to the existing plan

M6 still owns language packs, jurisdiction packs, model integration and localized
controls. M09 owns round-trip and lifecycle safety. M7 retains large-document scale,
but basic NER token-window coverage is a correctness prerequisite for M6 and must
not wait for 1000-page optimization.

- Replace obsolete P38 library upgrade with runtime/offset/coverage hardening;
  keep P38–P40 identifiers stable to avoid breaking existing references.
- P39 evaluates small first, then larger, through a model adapter and shared
  evaluation fixtures. Registry entries include exact revision, artifact hashes,
  tokenizer, label map, token window, decoder, backend and measured total bytes.
- P40 remembers the user's validated choice; downloading a larger model does not
  silently make it the default. Device capability and measured language results
  determine recommendations. Cache presence is not user consent to use a model.
- Replace “names/addresses in any language” with explicitly tested coverage.
  Neither multilingual pretraining nor heuristic language detection proves that
  support. Show heuristic language scores as suggestions, not calibrated percentages.
- Treat language stopwords as contextual evidence; do not blanket-remove model
  entities because an ambiguous name is also a common word. Measure recall impact.
- Keep checksum validators and dictionaries alongside NER. Preserve lower-priority
  enabled detections when a higher-priority candidate is merely awaiting review.

## Implementation and acceptance gates

### [x] A — Correct inference contract (M6 P38, M09 task 02)

Use tokenizer-derived or independently verified source alignment, including all
relevant token positions and normalization provenance. Never infer offsets by
searching only entity words. If the runtime cannot expose reliable offsets, build
and test an adapter or reject that candidate. Retaining O tokens alone does not
solve normalization or byte/subword alignment.

Use token-counted windows within the model limit, reserving special-token space,
with overlap and document-relative offsets. Reconcile duplicate and conflicting
boundary spans deterministically and report incomplete coverage. Include sentinels
before/after the current 512-token limit and at the document tail. A longer model
context is not a substitute for complete coverage.

Test repeated text, whitespace, accents, combining marks, emoji, punctuation,
non-entity gaps, overlapping entities, low-confidence arbitration, and input
changes while running. Import, paste and rescan use the same orchestrator and
expose whether the current document revision actually completed NER.

### [ ] B — Reproducible browser feasibility (M6 P39)

Pin revision and complete artifact manifest before testing. Keep each compressed
graph with its matching tokenizer/configuration; do not mix root and pruned
variants or assume that `dtype: 'q8'` resolves an arbitrary `int8/` folder.
Inspect the actual ONNX graph inputs, output labels, external data and operators.

Prefer the existing runtime if verified. If a direct ONNX Runtime Web adapter is
needed, record its maintenance cost before adopting it. Benchmark WASM first for
the supported desktop baseline, then optional WebGPU with explicit backend/dtype
compatibility. A failed GPU attempt may use a tested local fallback, never remote
inference. See [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu)
for the backend API; actual artifact support still requires execution.

Bundle runtime WASM/JS assets. For offline distributions, load a verified local
model package with no network fallback. For hosted provisioning, obtain opt-in,
show complete bytes/progress/cancellation, and pin downloads. Cache data and runtime
assets separately; report quota failure and blocked deletion truthfully. Reset a
failed initialization for an explicit retry. Verify offline cold and warm starts
with network denied and record browser/version/origin restrictions.

### [ ] C — Shared quality and usability evaluation

Use held-out, reviewed synthetic ES/GL/PT/EN documents with prose, Markdown tables,
HTML-derived text, names in lists, ambiguous common-word names, OCR corruption,
URLs and multilingual paragraphs. Separate threshold tuning data from acceptance
fixtures. Include unsupported-label tests so a new PII label cannot silently vanish
through the current PER/ORG-only mapping. Add explicit categories/policies for new
sensitive types; do not mislabel every location as a full street address.

Compare rules-only, rules + existing BERT, rules + small candidate, and rules +
larger candidate under the same policy. Report sensitive-character recall, exact
span recall/precision, false merges, and unmasked sensitive substrings by language,
category and document type. Also record human review burden; a giant span masking
an entire paragraph must not win merely by covering all sensitive characters.

Measure total download, cache footprint, cold/warm initialization, peak memory
(where instrumentation permits), p50/p95 inference, cancel latency, and UI stalls
on named reference devices. Include at least a modest laptop and a constrained
browser/device before claiming broad support. Proposed acceptance targets, to
validate on that matrix: no UI task over 100 ms from inference, cancellation within
1 second, warm processing of 1,000 characters within 2 seconds on the reference
laptop. Report failures rather than silently lowering targets.

Shipping gates: zero omissions caused by truncation/alignment in the targeted
regression fixtures; no cross-document writes; no offline egress; no enabled-rule
coverage regression from model arbitration; improve held-out ES/GL/PT recall over
the BERT pipeline without hiding category regressions in a pooled score. Select
thresholds per model/category from evaluation, not the current universal 0.8.
A model that fails stays experimental; keep an explicit rules-only mode.

### [ ] D — Evidence-backed selection and future server reuse

Publish the evaluation matrix and select a default only after gates A–C. Do not
ship all candidates or download two models by default. Preserve pure span/label
contracts so a future server adapter can reuse policies and tests without browser
APIs. Server model choice can differ after measuring throughput and isolation.

## Validation performed for this review

Read worker, cache, client, core NER, import flow, tests, installed pipeline source,
M6 and the correction plan. Ran two in-memory helper reproductions with synthetic
model outputs; no weights or real sensitive documents were used. Researched the
linked publisher cards and artifact trees. No browser inference or speed/quality
benchmark was run. The earlier full-suite attempt was incomplete due to missing
local `marked` and `jsdom`; documentation changes do not resolve that environment.

## P38 result (2026-10-29)

Gate A and the offline half of gate B's runtime requirements are implemented:
`src/core/nerWindows.ts` (token-budget windows with overlap, reconciliation,
coverage), contiguity-anchored offsets and index-gap-aware BIO grouping in
`src/core/ner.ts`, low-confidence hits on `RUNG.NER_LOW`, the worker retaining
non-entity tokens and resetting a failed load, `allowDownload` passed per
request (only `modelDownloadAllowed()` origins may fetch), the onnxruntime
runtime served from `/ort/` (jsDelivr removed from CSP and privacy text),
honest cache-write and blocked-delete reporting, and scan progress/coverage in
the UI. Real-model check (Node, `Xenova/bert-base-NER` q8, 1,195-token document,
sentinels at head, mid and tail): 3 windows, full coverage, all four sentinel
entities found with exact offsets. Not yet done: browser-run offline cold/warm
start with network denied (P39/P40 gate D).

## P39 results (2026-10-29)

Code: `src/core/nerModels.ts` (registry: pinned revisions, complete file manifests,
label policies for all 40 nym labels, thresholds), `src/core/nerEval.ts` and
`src/core/__fixtures__/nerEvalDocs.ts` (metrics, 16 synthetic ES/GL/PT/EN documents,
8 tuning / 8 acceptance), `scripts/ner-eval.mts` (quality comparison, Node),
`scripts/ner-bench.*` (browser WASM harness driven over CDP). Full table:
[M06-01-evaluation-results.txt](M06-01-evaluation-results.txt).

**Findings**

- `Wismut/nym-pii-multilingual-small` `int8/` loads with the stock transformers.js
  loader (config, tokenizer and tokenizer_config come from the repository root;
  only the graph comes from `int8/`). Complete download 151,127,134 bytes.
  Tokenizer is sentencepiece-style (leading-space words, digit-by-digit numbers,
  whitespace tokens), which `computeTokenOffsets` now aligns.
- `Wismut/nym-pii-multilingual` `int8/` **fails** with the stock loader: the root
  tokenizer (15 MB) is not the pruned one the int8 graph was exported with
  (`indices element out of data bounds`). It runs only from a local package that
  supplies `int8/tokenizer.json`.
- Thresholds chosen on tuning documents only: 0.5 for both nym models.
- Acceptance fixtures, sensitive-character recall (rules always on):
  rules only 65.8 %; + BERT (0.8) 80.6 %; + nym-small 94.3 %; + nym-large 95.3 %.
  Per category (acceptance): ADDRESS BERT 93.2 / small 100 / large 100,
  COMPANY 77.0 / 88.1 / 84.4, NAME 80.2 / 93.2 / 97.1, LOCATION 81.3 / 100 / 100.
  By language, small vs BERT: ES 96.8 vs 74.0, PT 92.6 vs 72.3, EN 88.7 vs 79.0,
  **GL 94.3 vs 99.4** — a regression on two documents, so the "no hidden category
  or language regression" gate is not strictly met. BERT's GL figure comes with
  one false merge and 6.5 % extra characters masked.
- Browser (headless Chrome, WASM, single thread, one development machine, 1,000
  characters, main-thread harness): BERT init 0.8 s, warm p50 0.78 s; nym-small
  first load 6.0 s including the download, warm p50 0.71 s, JS heap 120 MB;
  nym-large (local package) warm p50 **2.39 s** (target 2 s), JS heap 515 MB.
  WebGPU: no adapter in headless Chrome, untested. WASM linear memory is not
  included in the heap figures.

**Decision.** nym-small is the compact candidate to offer (P40) as an explicit,
experimental opt-in; BERT stays the default until Galician is re-evaluated on a
larger reviewed set. nym-large's extra recall (+1 point overall) does not justify
2.5× the download, 3× the latency and 4× the heap, and it needs a custom package:
it is not offered. Remaining for gates C/D: native-speaker review of the fixtures,
a constrained-device run, WebGPU, and the offline cold/warm start with the network
denied (P40).

## P40 status (2026-10-29)

Implemented: model chooser (size, measured languages, experimental flag), explicit
remembered choice, hosted opt-in with size confirmation, offline package import
verified by size and SHA-256, retry/cancel/delete (delete reports a blocked database
honestly), coverage/cache/quota notices, CLAUDE.md rule 2 reconciled. The worker
enforces "no network" with an `env.fetch` guard (transformers.js rejects both
local and remote models being disabled).

**Not yet verified:** gate D, the offline cold/warm browser run
(`scripts/p40-browser.mjs`, network to other hosts blocked). It progressed through
package import and the cold scan across several fixes but has not completed a
full green run. P40 stays `[~]` until it does. Known limitation: transformers.js
reads `config.json` from the moving `main` ref even when pinned, so a hosted
download of that one file is not commit-pinned (imported copies are hash-checked).
