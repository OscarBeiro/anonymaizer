# Milestone 8 — Batch processing

Planned 2026-09-27. Many files in, many files out. This builds on M7
([`m7-scale.md`](m7-scale.md)): worker, chunking, IndexedDB and windowed
rendering are prerequisites. It needs no new dependency, because jszip is
already bundled.

**M09 coordination (2026-10-12):** batch exports depend on the
[round-trip release gate](M09-01-Safe-document-round-trip-plan.md). Reuse its
immutable token/snapshot identities, coverage reports, output preparation and
retention policy. Exports are supported sanitized derivatives; original layout
and file-format fidelity are outside the committed scope. Restoration keys are
always delivered separately from upload artifacts.

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
> listed, not silently dropped. Extend M09 phase 11's single-document limits with
> aggregate entry/count/expanded-size/time limits and per-file isolation. Reject
> nested archives unless explicitly supported under the same aggregate budget.

### [ ] P34 — Batch model in core

> `BatchSession { files[], mode: 'shared' | 'separate' }` in `src/core/`.
> Shared mode merges entities across files (reuse `entities.ts`) and keeps one
> consistent placeholder numbering. Tests first: in a 3-file batch "Ana García"
> gets the same placeholder in every file, and separate mode gives three
> independent mappings.
> Shared tokens remain immutable after export under M09 phase 08. Each file has
> its own revision and coverage report; separate mode uses distinct namespaces.

### [ ] P35 — Batch review UI

> A combined mapping list with "appears in N files" and a drill-down per file.
> Toggling a mapping applies to every file in shared mode.

### [ ] P36 — Batch export

> A ZIP of supported sanitized derivatives, initially structured Markdown/HTML
> and existing rebuilt XLSX where supported, with format conversion disclosed.
> Use M09 phase 10 preparation for each file and freeze the batch manifest and
> snapshots together. Use neutral filenames/archive paths; include no private
> mappings, source metadata or untouched source ZIP parts. Disclose omitted or
> blocked files in a manifest using neutral IDs and safe status codes. Export
> encrypted restoration keys separately (shared or per-file as appropriate).

### [ ] P37 — Batch reversal

> Many AI outputs (files or a ZIP) plus explicitly selected private restoration
> keys/snapshots → a ZIP of restored derivatives. Support shared and separate
> scopes. Report restored occurrences, unknown/ambiguous tokens and verified,
> mismatched or unverifiable revisions under M09 phase 08. Unused mappings are
> normal for summaries and must not be counted as restoration failures.

## Verification

- Core tests for both modes. An end-to-end run with a zip of mixed formats
  (pdf, docx, eml) in both modes, then reverse.
- Verify conversion disclosure, aggregate resource limits, immutable snapshots,
  per-file coverage gates and absence of private keys/original filenames in the
  upload ZIP. Changes during preparation cannot produce a stale batch download.
- `npm test`, `npm run lint`, `npm run build:portable` on `file://`.
