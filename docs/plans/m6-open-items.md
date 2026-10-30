# M6 — open items after P26, P28, P38–P41

Written 2026-10-30. What is left from the model, language-pack and provisioning
work. Done work is in [m6-language-packs.md](m6-language-packs.md) and the
results in [M06-01](M06-01-Browser-local-model-review-plan.md). Branches are
stacked draft PRs: #10 (P26) ← #11 (P38) ← #12 (P39) ← #13 (P40) ← #14 (P28/P41).
None is merged; merge in that order.

## 1. P40 gate D — offline cold/warm browser run (blocks closing P40)

- [ ] `scripts/p40-browser.mjs` has never completed a green run. It got through
      package import and the cold scan across several fixes (wrong cache key for
      `config.json`, the `env.fetch` guard blocking same-origin `/ort/`, a race in
      the script itself); the last run was cut off. Re-download the small model
      files (≈151 MB, see `src/core/nerModels.ts` for sizes and hashes), rerun
      with the commands in the script header, and fix what is left.
- [ ] Tick P40 (`[~]` → `[x]`) and gate D in M06-01 only after a full green run
      with zero blocked external requests.
- [ ] Also verify the hosted path: opt-in confirmation with size, download from
      the model host, cancel mid-download, quota error, retry after failure,
      delete while another tab holds the database (should report, not claim success).

## 2. Model and evaluation gaps (M06-01 gates B–D)

- [ ] Galician regression: nym-small 94.3 % vs BERT 99.4 % on two acceptance
      documents; Basque 68.3 % vs 100 % rules-only on one. Needs a larger,
      native-reviewed GL/CA/EU/PT/ES fixture set before any default changes.
- [ ] Native-speaker review of every fixture and of the pt/ca/eu word lists.
- [ ] Reference-device matrix: only one development machine, headless Chrome,
      WASM, main thread. Still to measure: a constrained device, real worker UI
      stalls, WASM memory (the heap figures exclude it), cancel latency.
- [ ] WebGPU: no adapter in headless Chrome, so untested.
- [ ] Hosted downloads fetch `config.json` from `main`, not the pinned commit
      (transformers.js behaviour); imported files are hash-checked. Decide whether
      to accept this, or pre-seed or vendor the file.
- [ ] Per-category thresholds were tuned on a handful of tuning documents
      (uniform 0.5); retune on the larger set.
- [ ] nym-large works only from a local package with its pruned tokenizer and was
      too slow (2.4 s per 1,000 characters). Not offered; revisit only if the
      larger fixture set shows a clear recall gain.

## 3. Language packs

- [ ] P27 Galician pack is still open: move the Galician lists out of the ES
      lists, add tests that a DNI in a Galician document detects and `langDetect`
      returns `gl`.
- [ ] Catalan/Basque/Portuguese: the interface has no `ca`/`eu`/`pt` UI
      translations (only the document languages were added).
- [ ] Basque institution heads are suffixes ("Donostiako Udala"); the prefix
      heads in `companyPrefixes` are weak. Add inflection-aware matching if the
      reviewed fixtures show misses.
- [ ] Pseudonym data (`src/core/data/*/pseudonyms.ts`) exists only for es/en;
      pt/ca/eu documents get the generic replacements.
- [ ] Portuguese: NIF accepted unlabelled only for first digits 1/3/5/6/8;
      numbers starting 2 or 9 need a label. Revisit with real documents.
- [ ] French, Italian and German still have detection profiles but no packs.

## 4. Housekeeping

- [ ] M06-01 gates B, C and D remain unticked in the plan file.
- [ ] Update the index table in [anonymaizer-plan.md](anonymaizer-plan.md)
      (rows for M6 and the model review still say "planned").
- [ ] `scripts/ner-bench.*`, `scripts/ner-eval.mts` and `scripts/p40-browser.mjs`
      are development harnesses; document how to run them in one README.
- [ ] Stale local processes from the session may still be running (vite on 5173
      and 5198, headless Chrome on 9236–9238).
