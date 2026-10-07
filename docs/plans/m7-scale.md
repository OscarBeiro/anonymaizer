# Milestone 7 — Large-document scale

Planned 2026-09-27. A 1000-page document must parse, detect, be reviewed and
survive a reload without freezing the tab. [`05-large-documents.md`](done/05-large-documents.md)
removes the crashes. This milestone removes the ceilings. It is also the
foundation for batch processing in [`m8-batch.md`](m8-batch.md).

Constraints: detection logic stays in pure `src/core/`. The worker and storage
live in `src/lib/` and `src/workers/`. IndexedDB is local and makes no network
calls (hard rule 2).

---

### [ ] P29 — Detection in a Web Worker

> Move `anonymize`/`anonymizeWithNer` calls from `App.tsx` into
> `src/workers/detect.worker.ts` (the pattern is `nerClient.ts`). Report
> progress and support cancel. Check first that the worker still works in
> `build:portable` (single inlined file on `file://`). If it doesn't, fall back
> to an inline Blob worker.

### [ ] P30 — Chunked detection

> Split the text into paragraph-aligned chunks with overlap and detect each
> chunk. Merge spans across chunk edges and remove duplicates in the overlap.
> Chunk NER input the same way. Tests (pure core): chunked output is identical
> to whole-text output on every fixture, including an entity that straddles a
> chunk edge.

### [ ] P31 — IndexedDB session store

> Replace localStorage for document text and mappings with IndexedDB. Small
> preferences (theme, step, settings) stay in localStorage. Migrate an
> existing localStorage session on first load. Handle the private-window case
> where IndexedDB is unavailable (in-memory, with the L1 notice).

### [ ] P32 — Windowed rendering

> Render only the visible part of the sanitized-text view and the mapping
> panel, with no new dependency unless it is vetted against hard rule 3.
> Placeholder highlighting and click-to-select keep working.

## Verification

- A generated 1000-page PDF fixture goes through parse → detect → review with
  a responsive UI (cancel works), survives a reload, and exports.
- `npm test`, `npm run lint`, `npm run build:portable` on `file://`.
