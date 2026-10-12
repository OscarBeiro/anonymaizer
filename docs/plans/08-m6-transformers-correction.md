# 08 — M6 correction (transformers v4) and lockfile audit fix

Documentation portion resolved by the 2026-10-12 review; dependency updates and
implementation checks remain unstarted. See
[M06-01](M06-01-Browser-local-model-review-plan.md). P38–P40 identifiers were retained
for reference stability: P38 now covers runtime correctness, P39 model evaluation,
and P40 model choice. No dependency, version or changelog changes were made.

## Context

The M6 plan (merged in PR #5) assumed the app is on `@xenova/transformers`
2.17.2. That number came from the old M2 doc. `package.json` and
`src/workers/ner.worker.ts` show the app is already on
`@huggingface/transformers` 4.3.0. So:

- The former `P38` library upgrade is unnecessary; P38 now covers runtime correctness.
- The warning that ModernBERT support needs a library upgrade is wrong. The installed runtime
  registers ModernBERT token classification, but P39 must still verify the exact
  compressed graph and tokenizer in a browser.

## Tasks

1. **Correct M6 documentation — done**:
   - Replace the obsolete upgrade with runtime/alignment/coverage hardening.
   - Keep P38–P40 numbering; link the updated browser model review in the index.
   - Require exact artifact/browser validation despite architecture registration.
2. **Patch the lockfile**: `npm update sharp source-map-js`, then
   `npm test` and `npm run build`.
3. **Housekeeping**: bump the `package.json` version and add a changelog
   entry (per the project rules).

## Done when

- [x] M6 and index are consistent; P38–P40 retained with corrected scope
- [ ] Lockfile moves to patched `sharp` / `source-map-js`
- [ ] `npm test` and `npm run build` pass
- [ ] Version bumped, changelog entry added
