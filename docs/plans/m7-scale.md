# Milestone 7 — Large-document scale

Planned 2026-09-27. A 1000-page document must parse, detect, be reviewed and
survive a reload when retention is enabled, without freezing the tab. [`05-large-documents.md`](done/05-large-documents.md)
removes the crashes. This milestone removes the ceilings. It is also the
foundation for batch processing in [`m8-batch.md`](m8-batch.md).

Constraints: detection logic stays in pure `src/core/`. The worker and storage
live in `src/lib/` and `src/workers/`. IndexedDB is local and makes no network
calls (hard rule 2).

**M09 coordination (2026-10-12):** follow the
[round-trip plan](M09-01-Safe-document-round-trip-plan.md) for identity, cancellation,
resource limits and retention. P29 is pulled forward with M09 phase 11 as the
single detection-worker implementation. P31 implements M09 phase 12's policy;
storage capacity does not imply permission to persist sensitive content.

---

### [ ] P29 — Detection in a Web Worker

> Move `anonymize`/`anonymizeWithNer` calls from `App.tsx` into
> `src/workers/detect.worker.ts` (the pattern is `nerClient.ts`). Report
> progress and support cancel. Check first that the worker still works in
> `build:portable` (single inlined file on `file://`). If it doesn't, fall back
> to an inline Blob worker.
> Implement M09 task 02/phase 11 request IDs, revision checks, time/input limits,
> rejection of pending work on termination and resource cleanup. M6 NER consumes
> the same lifecycle contract; avoid a competing detection-worker architecture.

### [ ] P30 — Chunked detection

> Split the text into paragraph-aligned chunks with overlap and detect each
> chunk. Merge spans across chunk edges and remove duplicates in the overlap.
> Coordinate NER chunking with M6 P38. Define context bounds and supported
> dictionary patterns before selecting overlap. Verify equivalence for supported
> bounded rules, including entities across chunk edges. For unbounded patterns,
> use a bounded whole-document fallback or reject with an explicit incomplete
> status. Evaluate NER coverage and span correctness without promising universal
> equivalence across different contexts.

### [ ] P31 — IndexedDB session store

> Replace localStorage for document text and mappings with IndexedDB. Small
> preferences (theme, step, settings) stay in localStorage. Offer recoverable
> migration of an existing localStorage session on first load under M09's
> explicit retention choices. Handle the private-window case
> where IndexedDB is unavailable (in-memory, with the L1 notice).
> Persist only with explicit retention consent. Keep ephemeral documents,
> mappings, responses and unretained custom rules in memory. Follow M09 phase 12
> for separate dictionary consent, recoverable migration, coordinated clearing
> across tabs and rejection of stale writes after clearing. Small preferences
> must not contain sensitive document-derived values.

### [ ] P32 — Windowed rendering

> Render only the visible part of the sanitized-text view and the mapping
> panel, with no new dependency unless it is vetted against hard rule 3.
> Placeholder highlighting and click-to-select keep working.

## Verification

- A generated 1000-page PDF fixture goes through parse → detect → review with
  a responsive UI (cancel works), survives a reload with retention enabled, and
  exports through M09 phase 10's preparation operation. In ephemeral mode, reload
  retains no sensitive content. Test clearing while a second tab has pending work.
- `npm test`, `npm run lint`, `npm run build:portable` on `file://`.
