# Milestone 4a — Export & detection control

The first half of M4. Everything here is user-visible value that needs no new
dependency and no change to what "anonymize" promises: get the text *out* of the
tool in the formats the user actually works in, and let them decide *up front*
what gets detected at all.

**Numbering note.** An earlier draft of `m4-export-i18n.md` numbered the i18n
work `P9`/`P10`. That numbering is superseded: i18n now lands in M4b as `P14`
and `P15`, after the features that add strings to translate. See
[`m4b-pseudonym-i18n.md`](m4b-pseudonym-i18n.md).

Decided in planning (2026-09-21), do not re-litigate:

- **Export lives on the existing sub-steps**, not a new wizard step: a format
  picker + "Save as…" on 2.3 Sanitized text and on 3.2 Restored text.
- **`.xlsx` export only offers itself when the source was tabular** —
  `session.originalFormat` is `csv` or `xlsx`. A prose document has no natural
  sheet structure and a one-column dump of lines is worse than not offering it.
- **Category toggles are a collapsible panel at the top of 2.2**, not a new 2.1
  sub-step. A user who never changes the defaults should not gain a click per
  document; a user who does finds the control next to the table it governs.
- **`.docx`/`.odt` export is not in M4a.** It is a feasibility question, parked
  in M4b's optional block.

---

### [ ] P9 — Save as… for the easy tier (`.txt`, `.md`, `.html`)

The download mechanism already exists in the codebase — `exportRules`
(`RulesEditor.tsx:72`) is `Blob` → `createObjectURL` → synthetic `<a download>`
→ `revokeObjectURL`. This session generalizes it and wires it to the two text
panels. No new dependency; hard rule 2 is untouched because nothing leaves the
page.

`.md` is close to a no-op: `anonymizedMarkdown` and the restored text are
already Markdown from the turndown ingest path, saved as-is. `.txt` is the same
bytes with a different MIME type and extension — deliberately *not* a
Markdown-stripping pass, because the user's text may legitimately contain the
characters a stripper would eat. `.html` wraps the text in a minimal
self-contained styled shell; for the **sanitized** panel specifically it reuses
the placeholder highlighting from `renderHighlighted` (`MappingPanels.tsx:7`) so
the saved file shows what the screen showed.

> Add `src/core/export/textExport.ts` (pure, hard rule 4 — it returns strings
> and file names, it does not touch `Blob`, `document` or `URL`): a
> `buildExport(kind, text, session)` returning `{ fileName, mimeType, content }`
> for `txt`, `md` and `html`. File names derive from `session.fileName` (stem
> preserved) or fall back to `anonymaizer-<sessionId-prefix>`, suffixed
> `-sanitized` / `-restored`. The `html` builder emits a complete standalone
> document — inline `<style>`, no external font or stylesheet reference (hard
> rules 2 and 3), HTML-escaping the text — and takes an optional highlight flag
> that wraps `[[CATEGORY_NNN]]` placeholders in a `<mark>` mirroring
> `renderHighlighted`.
> Add `src/core/export/textExport.test.ts` first: escaping of `<`, `&` and
> quotes; a file name derived from a `.docx` source keeping its stem and losing
> its extension; the highlighted HTML marking every placeholder and nothing
> else; `txt` and `md` round-tripping the input bytes unchanged.
> Add `src/lib/download.ts` — the one DOM-touching helper, wrapping the
> `exportRules` pattern — and refactor `RulesEditor.tsx#exportRules` to call it
> so there is a single implementation.
> In `MappingPanels.tsx` and `ReversalPanel.tsx`, add a format `<select>` plus a
> "Save as…" button beside the existing copy-to-clipboard control.

### [ ] P10 — `.xlsx` export for tabular sources

The M3 `.xlsx` *importer* (`src/lib/parsers/xlsx.ts`, P8f) hand-rolls its
reading on `jszip` rather than pulling in SheetJS. Export is the inverse and
takes the same approach: a `.xlsx` is a zip of a handful of small XML parts
(`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`,
`xl/worksheets/sheet1.xml`, and either `xl/sharedStrings.xml` or inline strings).
Writing those by hand is a bounded, testable job and adds no dependency.

Inline strings (`t="inlineStr"`) are the simpler choice than a shared-strings
table and are accepted by Excel, LibreOffice and Google Sheets — take them
unless a fixture proves otherwise. XML-escape every cell value; a sanitized
document can easily contain `&` or `<`.

> Gate the option on `session.originalFormat === 'csv' || === 'xlsx'`: the
> format picker from P9 only lists `xlsx` for those sessions, and
> `buildExport` throws for the combination so the rule is enforced in core, not
> only in the UI.
> Add `src/core/export/xlsxExport.ts`: parse the Markdown table(s) in the
> given text back into rows (reuse `src/lib/parsers/markdownTable.ts` if its
> parsing half is reusable; extract it into core rather than duplicating it if
> it is currently import-only), and return the sheet XML parts as a
> `Record<path, string>` — still pure, no `jszip` import in core. The zipping
> itself goes in `src/lib/` beside the download helper.
> Tests first in `xlsxExport.test.ts`: a two-column table with a `&` and a `<`
> in a cell producing well-formed escaped XML; a document with two tables
> producing two sheets; a source with no table at all raising the expected
> error rather than emitting an empty workbook.
> Round-trip test: feed the generated zip back through the M3 `.xlsx` importer
> and assert the cells come out as they went in. That test is the real
> specification of "valid enough" and is worth more than any fixture comparison.

### [ ] P11 — Pre-detection category toggles, persisted

Today every category is detected and every hit lands in 2.2's review table; the
only control is the per-row `enabled` checkbox — a post-hoc, one-at-a-time
opt-out. This adds a coarser, earlier gate: which categories run *at all*. It
does not replace the row checkbox.

The seam is the detector composition in `detectors.ts` —
`runDeterministicDetectors:289`, `runHeuristicDetectors:768`, `runAllDetectors:774`
already assemble per-category functions, so the enabled set is a parameter
there. Filtering the *output* would be wrong: the point is to skip the work and
the noise, not to hide it afterwards.

Three defaults need deciding explicitly rather than inherited by accident:
`COMPANY_ACRONYM` stays **off** (it is the `enabled: false` heuristic today,
`RUNG.COMPANY_ACRONYM`), `INVALID_ID` (D1) stays **on** (a wrong check letter is
still an identifier), and the D3 shield categories are **not** user-toggleable
at all — a shield exists to stop a false positive, so switching it off makes
detection worse, never more thorough. Exclude them from the toggle list.

`CustomDictionaryRule`s of type `CATEGORY` mint open-ended categories
(`PROJECT_NAME`), so the list is `KnownCategory` minus shields, plus whatever
`targetCategory` values the saved rules contribute — built at render time, not
hardcoded.

> Add `CategorySettings` (`Record<Category, boolean>`) to `src/core/types.ts`
> with a `DEFAULT_CATEGORY_SETTINGS` constant encoding the defaults above.
> Thread it through `runAllDetectors`/`runDeterministicDetectors`/
> `runHeuristicDetectors` as an optional argument defaulting to the constant, so
> every existing caller and test keeps working unchanged, and into
> `runDetectionPipeline` (`pipeline.ts:17`). Shield detectors ignore it.
> Persist with a fourth localStorage key in `src/lib/session.ts` —
> `anonymaizer.categorySettings`, `loadCategorySettings`/`saveCategorySettings`
> mirroring `loadRules`/`saveRules`. These are the user's *general* preference
> across documents, not part of `MappingSession`; a stored key naming a category
> that no longer exists is ignored, and a category absent from the stored map
> takes its default (so a future category is on by default without a migration).
> UI: a collapsible "Categories" panel at the top of `ReviewStep.tsx`'s 2.2,
> listing the categories with checkboxes, a count of what each one found in the
> current document, and a "restore defaults" link. Changing a toggle re-runs
> detection for the current document.
> Tests: a category switched off contributes no spans; switching off `NAME` does
> not affect `EMAIL`; shields still fire with an all-off settings map; the
> persistence round-trip including the unknown-key and missing-key cases.
