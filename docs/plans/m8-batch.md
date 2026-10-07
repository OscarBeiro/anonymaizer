# Milestone 8 — Batch processing

Planned 2026-09-27. Many files in, many files out. This builds on M7
([`m7-scale.md`](m7-scale.md)): worker, chunking, IndexedDB and windowed
rendering are prerequisites. It needs no new dependency, because jszip is
already bundled.

Modes (all in scope):
- **Shared mapping.** One mapping across all files, so the same person gets
  the same placeholder everywhere.
- **Separate mappings.** Each file is anonymized on its own, with results in a
  zip.
- **Zip/folder input** as well as selecting several files.
- **Batch reversal.** Many AI outputs plus one mapping.

Core rule: `BatchSession` and cross-file entity merging live in `src/core/`
with tests. File I/O, jszip and IndexedDB live in `src/lib/`.

---

### [ ] P33 — Multi-file, zip and folder input

> Accept several files, a `.zip` (jszip) or a folder (`webkitdirectory`). Build
> a queue with a status per file (parsing / detecting / done / failed with a
> reason), each file running through the M7 worker. Unsupported files are
> listed, not silently dropped.

### [ ] P34 — Batch model in core

> `BatchSession { files[], mode: 'shared' | 'separate' }` in `src/core/`.
> Shared mode merges entities across files (reuse `entities.ts`) and keeps one
> consistent placeholder numbering. Tests first: in a 3-file batch "Ana García"
> gets the same placeholder in every file, and separate mode gives three
> independent mappings.

### [ ] P35 — Batch review UI

> A combined mapping list with "appears in N files" and a drill-down per file.
> Toggling a mapping applies to every file in shared mode.

### [ ] P36 — Batch export

> A zip of the anonymized files in their original formats, plus the mapping
> file (one for shared mode, one per file for separate mode).

### [ ] P37 — Batch reversal

> Many AI outputs (files or a zip) plus one mapping → a zip of restored files,
> with a report of placeholders that were not found.

## Verification

- Core tests for both modes. An end-to-end run with a zip of mixed formats
  (pdf, docx, eml) in both modes, then reverse.
- `npm test`, `npm run lint`, `npm run build:portable` on `file://`.
