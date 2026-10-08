# 08 — M6 correction (transformers v4) and lockfile audit fix

Saved for later; not started.

## Context

The M6 plan (merged in PR #5) assumed the app is on `@xenova/transformers`
2.17.2. That number came from the old M2 doc. `package.json` and
`src/workers/ner.worker.ts` show the app is already on
`@huggingface/transformers` 4.3.0. So:

- `P38` (library upgrade) is unnecessary.
- The warning that ModernBERT support needs a library upgrade is wrong. v4
  will probably support it, but N1/`P39` still has to confirm that.

## Tasks

1. **Fix M6** in `docs/plans/m6-language-packs.md` and the index row in
   `anonymaizer-plan.md`:
   - Drop `P38`; renumber `P39`–`P40` to `P38`–`P39`.
   - Correct the session order and the index row.
   - Replace the "needs a library upgrade" warning with: N1/`P38` must
     confirm ModernBERT support on `@huggingface/transformers` 4.3.0.
2. **Patch the lockfile**: `npm update sharp source-map-js`, then
   `npm test` and `npm run build`.
3. **Housekeeping**: bump the `package.json` version and add a changelog
   entry (per the project rules).

## Done when

- [ ] M6 file and index row are consistent after renumbering
- [ ] Lockfile moves to patched `sharp` / `source-map-js`
- [ ] `npm test` and `npm run build` pass
- [ ] Version bumped, changelog entry added
