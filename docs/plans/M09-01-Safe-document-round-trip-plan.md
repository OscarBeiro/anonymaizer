# M09-01 — Safe document round trip and integration foundations

Status: proposed; implementation not started. Reviewed 2026-10-12.

## Outcome and priority

Make the common journey dependable: import or paste → review sensitive content →
copy/download a sanitized artifact → save a private restoration key → restore an
AI response later, even after closing the browser or starting another document.

Reserve M09 as the next unallocated milestone after the existing M6–M8 roadmap.
Its number does not mean its urgent fixes should wait: implement tasks 01–03
before expanding languages or shipping batch exports. Tasks 04–06 establish the
round-trip release gate. Task 07 defines the future integration contract; it does
not implement a proxy or send documents to a provider.

The existing pure TypeScript core, span arbitration, lazy parser registry,
Standard/Advanced modes, and substantial core tests are useful foundations.
Retain them. The biggest gap is reliable handling around detection, rather than
simply adding another detector.

Reversible placeholders provide pseudonymization: whoever possesses the mapping
can restore the values, and contextual details may still identify a person.
Use clear product wording without claiming that detected-and-replaced text is
guaranteed anonymous. Keep realistic fake data explicitly separate from the
reversible AI workflow.

## Confirmed product decisions

Confirmed by the user after the initial review:

- The first integration runs in a browser. Server execution is a future phase.
- Exported documents are new documents derived from the original information.
  Original layout and file-format fidelity are not requirements.
- Output must retain useful structure: headings, paragraphs, lists and tables.
  Markdown, HTML or DOCX are acceptable containers; format breadth is not a
  milestone acceptance criterion. Start with structured Markdown and HTML using
  the existing stack; add DOCX only when a concrete workflow needs it.

Use structured Markdown as the initial interchange representation. Test semantic
structure through sanitization, restoration, preview and export; do not accept an
HTML file that merely wraps literal Markdown in a preformatted block as the
structured HTML deliverable. Distinguish sanitized upload artifacts from restored
final documents in the UI, since the latter intentionally contain original values.

## Review findings and evidence

Paths below are relative to the repository root. Findings are source-based unless
explicitly marked as reproduced. This review did not run a browser, inspect a
live deployment, or audit every dependency.

| Priority | Finding and user impact | Evidence | Task |
| --- | --- | --- | --- |
| High | Restoration treats dollar sequences in originals as replacement syntax and rescans inserted originals. Both can corrupt restored content. | `src/core/reverse.ts`, `restored.replace(flexibleRegex, item.originalText)` inside a loop. In-memory execution of this module reproduced `Fee $&` restoring as `Fee [[CUSTOM_001]]`; an original value `[[NAME_001]]` was subsequently replaced with `Alice`. | 01 |
| High | A late NER response can overwrite newer input or undo disabling NER. Concurrent listeners also have no request IDs to distinguish results. | `src/App.tsx` `runNerScan` writes captured text after awaiting; reset/import/toggle paths do not invalidate it. `src/lib/nerClient.ts` resolves listeners on any result message. | 02 |
| High | Sanitized downloads preserve a potentially identifying filename; HTML also uses that stem as its title. | `src/core/export/textExport.ts` `exportFileStem` and `buildExport`; spreadsheet exports reuse the same stem. Example: `Ana-Garcia-medical.pdf` becomes `Ana-Garcia-medical-sanitized.txt`. | 03 |
| High | Partial extraction warnings are not carried into the result/export journey and are lost on reload. Mixed scanned/text PDFs are not covered by the all-empty PDF warning. | `src/App.tsx` stores warnings outside the session and passes them only to `IngestStep`; `QuickResult` has no warning input. `src/lib/parsers/pdf.ts` warns about scanned images only when all extracted text is empty. | 03 |
| High | Raw document text and restoration values persist automatically in plaintext browser storage; there is no portable restoration-key flow in the inspected UI. | `src/App.tsx` save effect; `src/lib/session.ts` `saveSession`; `MappingSession` includes raw text and originals. `SaveAsControl` exports document content, while the restore panel consumes the current session mapping. | 04 |
| Medium | Initial replacement uses accepted spans, but toggling and realistic rendering use global literal matching. This can change unrelated or shielded occurrences of the same text. | `src/core/pipeline.ts` versus `src/core/apply.ts`. This semantic discrepancy needs a regression fixture before a specific detector case is called a confirmed bug. | 05 |
| Medium | Redetection rebuilds mappings; the current mapping remains mutable after text has been copied. Tokens are not bound to an immutable export revision. | `src/App.tsx` `runAnonymize`, rule/category updates, merge/split, and `reverseText(aiResponse, session.mappings)`. Old replies can be interpreted using changed mappings. | 01, 04 |
| Medium | Persisted sessions and rules are largely trusted after JSON parsing; regex validation checks syntax, not execution cost, and uses different flags from execution. | `src/lib/session.ts`, `src/core/ruleValidation.ts` (`new RegExp(pattern)`), `src/core/dictionary.ts` (`gu`). Pathological user/imported regex can monopolize the main thread. | 02, 04 |
| Design | Consent-gated third-party scripts run in the same browsing context as the document tool. Explicit page-view payload restrictions do not technically isolate scripts from documents or local storage. | `src/Root.tsx`, `src/lib/analytics.ts`, `src/lib/analyticsLoader.ts`. This is a trust-boundary finding, not evidence that analytics currently sends document contents. | 06 |
| Roadmap | M8 promises original-format exports, but current exporters provide text/Markdown/HTML and rebuilt XLSX only. General PDF/DOCX/PPTX round trips are not implemented. | `docs/plans/m8-batch.md` P36; `src/components/SaveAsControl.tsx`; `src/core/export/`. | 03 |

### Verification baseline

- Ran `npm test -- --reporter=dot`: 35 suites and 462 tests passed; one suite
  failed to load `marked`, and nine worker startup errors reported missing
  `jsdom`. The complete suite is therefore **not passing in this checkout**.
- Reproduced the two restoration defects by transpiling the existing
  `reverse.ts` in memory with the installed TypeScript compiler and executing it.
- No dependencies were installed or updated; no application code was changed.
- Restore a lockfile-consistent development environment before implementation
  validation. The partial run does not establish browser or parser correctness.

## Tasks — one implementation session per block where practical

### [ ] 01 — Literal, scoped, observable restoration

Implement one-pass replacement against the response input. Insert originals
literally via a callback; never scan inserted values again. Keep existing
canonical-name restoration behavior documented: merged variants are not an
exact reconstruction of the original wording.

Define a versioned token grammar with a per-conversation/session namespace and
unique counters. Detect or escape literal token-shaped text already in input.
Provide explicit legacy compatibility for existing unnamespaced mappings.
Default new restoration to exact tokens; offer a previewed tolerant mode for
AI-altered brackets/casing/spacing. Do not silently replace ordinary bare words
that happen to resemble a token.

Return a restoration report: restored occurrences, unknown tokens, malformed or
ambiguous candidates, and mapping/revision mismatch. Unused mappings are normal
when an AI summarizes; do not treat them as failed restoration. Unknown tokens
remain visible and are never guessed.

Acceptance: literal `$&`, `$1`, `$$`, prefix/suffix replacement syntax, embedded
placeholder-looking originals, repeated tokens, Unicode, counter-prefix
collisions, unknown namespaces, legacy tokens, and summaries omitting entities
all have fixtures. An inserted original is never processed twice.

### [ ] 02 — Current-document processing and cancellation

Give parse/detect/NER operations request IDs plus document and policy revisions.
Only the current revision may commit results. Reset, import, edits, category
changes, model disable, and clear-data invalidate pending work. Worker messages
must identify their request; termination rejects pending promises and releases
listeners. Distinguish model initialization, scanning, ready, cancelled, and error.

Reuse M7 P29 for the complete detection worker; do not create a competing worker
architecture here. Establish the cancellation/revision contract first. Run custom
regex in an interruptible worker with explicit time/input limits; syntax checking
alone is insufficient. Validate with the same flags used during execution.

Acceptance: a delayed scan of A cannot replace B after import, typing, reset,
or model disable. Interleaved requests cannot consume each other's results.
Timeouts produce a visible incomplete scan state and never a ready-to-export
state. Verify portable worker behavior as required by M7.

### [ ] 03 — Extraction coverage and safe export defaults

Persist structured parser coverage with each document: format, processed units,
skipped/unsupported units, warnings, and completeness status. Report unreadable
pages and mixed image/text cases conservatively; a page containing some text does
not prove all embedded image text was read. Show the report in Standard, Advanced,
and export flows, including after reload.

Define a format capability matrix for text, tables, images, headers/footers,
comments, tracked changes, hidden sheets, notes, links, attachments, and metadata.
Mark each as extracted, omitted, unsupported, or requiring review based on tested
behavior. Do not claim the original file has been sanitized when exporting only
extracted text. Scanned content needs local OCR in a later milestone; expose that
limitation now, without a cloud OCR fallback.

Use neutral generated filenames and HTML titles by default. Never carry original
metadata, attachments, external references, or untouched source ZIP parts into a
sanitized artifact. Apply the same rule to future batch manifests and archives.

Amend M8 P36 during implementation planning: initially export supported sanitized
derivatives, with format conversion disclosed. Remove faithful original-format
redaction from the committed roadmap; reconsider only if requirements change. Never package
the private restoration key together with files intended for upload.

Acceptance: synthetic identifiers in filenames, metadata and unsupported content
cannot silently appear in an upload artifact. Partial extraction requires explicit
review/acknowledgment in the manual workflow; empty/failed extraction blocks export.
Future unattended API processing rejects incomplete extraction by default.
Structured Markdown and HTML exports preserve heading levels, list nesting and
table relationships in both sanitized and restored output. HTML must render those
structures as semantic elements through the same sanitized rendering policy as
preview, with no active scripts or remote resources. Test structure with synthetic
fixtures rather than pixel-perfect comparisons. DOCX is optional and deferred.

### [ ] 04 — Private restoration key and explicit retention

Add a versioned restoration-key envelope containing mappings, token namespace,
policy/engine versions, and immutable export revision. Exclude raw documents by
default. Freeze a mapping snapshot when exporting/copying; later edits create a
new revision rather than changing the meaning of an already-issued token.

Offer a clear ephemeral-session mode as the default for new installations and an
explicit “Remember on this device” option. Explain existing-session migration
before deleting retained work. Reuse the M7 IndexedDB storage adapter when ready;
changing storage engines alone does not protect sensitive values.

Provide “Save private restoration key” and “Load restoration key” near the common
workflow, including Standard mode. Use authenticated encryption for portable
keys through browser cryptography, with a versioned, reviewed password-based
key-derivation configuration; do not invent cryptographic primitives or store the
password beside the key. State that losing the password/key prevents recovery.
Encryption at rest does not protect an unlocked page from scripts running in it.

Validate imported and persisted data before use: schema version, field types,
size/count limits, token uniqueness and grammar, mapping consistency, migrations,
and corrupt or unsupported data. Wrong passwords or validation failures must not
partially replace the current session. Handle unavailable storage reads as well
as writes. Clear-data must cover document stores, pending jobs, and in-memory
responses; distinguish browser deletion from files users downloaded themselves.

Acceptance: export → close browser → load key → restore works; wrong key/revision
is flagged; encrypted-file tampering fails; a new document cannot silently restore
an old response using unrelated mappings; ephemeral mode leaves no document or
mapping in persistent storage. Existing users receive a recoverable migration.

### [ ] 05 — Simple review backed by consistent detection

Keep Standard mode short: result, coverage summary, review action, copy/download,
private-key action, restore. Surface disabled sensitive categories and incomplete
NER next to the result. “Nothing detected” must not imply “nothing sensitive.”

Use one occurrence/span representation for initial output, toggle, merge/split,
and realistic rendering. Preserve manual decisions across rescans where their
anchors still match; flag invalidated decisions. Let users redact a selected
occurrence or all matching occurrences explicitly, with undo and contextual
preview. Keep reusable dictionary creation a separate choice.

Add a pre-export residual check for known original variants and high-risk patterns,
including links and document labels. It is a second check, not a guarantee of
anonymity; distinguish deliberate exceptions from unexplained matches. An unchanged
second pass of the same detector is not independent evidence of safety.

Acceptance: toggling an unrelated mapping cannot rewrite a previously shielded
occurrence; decisions remain stable through rescan; keyboard-only users can
review, correct, export, load a key, and restore. Copy success/failure is announced
accessibly and stale “Copied” feedback clears when output changes.

### [ ] 06 — Privacy boundary and release evidence

Separate the marketing/analytics context from the document-processing application.
Prefer a dedicated analytics-free tool origin and a full navigation before ingest;
a route change alone does not unload third-party scripts. Adjust the landing
handoff so sensitive paste/upload occurs only inside that boundary.

Define deployment-specific network expectations precisely: hosted builds must
fetch application assets, while portable operation must work offline. Model
provisioning is a separately declared opt-in capability. Resolve the current
wording in `CLAUDE.md` that permits model downloads but also prohibits all local
runtime calls; test the actual intended behavior for each build.

Restrict rendered response content so it cannot load remote images or other
resources; HTML sanitization and network containment are different controls.
Verify CSP on the actual hosted deployment, localhost and portable entry points,
not only generated hosting headers. Treat provider responses as untrusted input.

Create synthetic fixtures with known sensitive spans, partial documents, malicious
markup, identifiers in URLs/filenames, and bilingual text. Track recall/precision
by category and language, false merges, and restoration correctness. Require zero
leaks in the enumerated release regression fixtures, while reporting that this is
not a universal guarantee. M6 owns language coverage; M7 owns large-file budgets.

Acceptance: browser network capture shows no document-derived content, mappings,
filenames or restored values leaving the processing context. Portable tests run
with the network denied. Test pasted AI image links containing placeholders before
and after restoration. Run all existing tests, lint, hosted and portable builds,
and one complete keyboard-accessible round trip after dependencies are repaired.

### [ ] 07 — Future AI intermediary contract (design only)

Write an architecture decision record and provider-neutral contract for an explicit
browser SDK/adapter used by the other application. This is an application integration,
not transparent TLS interception. Start with text-only, buffered requests/responses;
streaming, binary documents and provider tool calls require explicit later support.

The first host is a browser application. Keep detection and restoration local,
with a worker adapter for responsive processing and a host-supplied transport
interface. Document browser transport feasibility for the eventual provider,
including CORS and its supported authentication flow. Do not embed long-lived
provider secrets in a published frontend. If the selected provider cannot support
the intended browser flow, report that constraint explicitly; do not silently add
a backend to this milestone. Provider selection remains an open integration detail.

Keep the core contracts runtime-neutral so a future server adapter can reuse them.
Server execution is deferred and will need explicit tenant isolation, credential
ownership, retention and deployment decisions. Browser APIs belong in adapters,
not in core transformation logic.

Data flow:

1. The host supplies a local conversation scope, policy and structured request.
2. The core sanitizes supported fields and returns an approved outbound request
   plus a local-only mapping reference and coverage report.
3. A transport adapter sends only that approved request to the selected AI endpoint.
4. The local restore stage processes the response with the matching mapping revision
   and returns restored text plus a restoration report to the authorized host.

The pure core must remain independent of React, DOM, storage, credentials and
network. The host owns credentials and transport. Keep raw text, mappings and
restored output out of provider requests, logs, traces, exception payloads and
analytics. Restored output may return to the local host; any subsequent cloud
request must be sanitized again. Stable tokens persist within a conversation,
while independent conversations and tenants never share mappings.

Specify supported request fields (messages, system text, structured text fields)
and recursively validated handling for JSON. Reject unsupported attachments,
remote-file references and content types rather than forwarding them untouched.
Tool arguments/results are separate trust boundaries; preserve syntax and validate
schemas before any future execution. Provider-returned content must never grant
access to another conversation's restoration key.

Define cancellation, retries, idempotency, concurrency, expiration, mapping version
selection, and typed errors. Sanitization failure means no send; restoration failure
returns unresolved tokens and diagnostics without guessing. Require an outbound
allowlist/size policy and private logs. Document that local sanitization does not
prevent a provider from inferring identities from residual context.

For later streaming, buffer partial tokens across event boundaries and test every
split point, UTF-8 boundaries, malformed endings and cancellation. Never show
half-restored data as complete. Do not assume a text-only stream parser covers
structured tool-call events.

Acceptance for this design task: reviewable contract examples and mock transport
scenarios prove browser-host scope separation and specify failure behavior; no provider calls
or proxy implementation are required. A separate companion service, if the other
application requires one, needs its own approved architecture and a deliberate
change to the current “no backend” rule. Do not silently repurpose this SPA.

## Roadmap coordination and deferred work

- M6 retains i18n, jurisdiction/language packs and multilingual NER. The documentation correction in
  `08-m6-transformers-correction.md` is now resolved; follow the updated M6 and
  `M06-01-Browser-local-model-review-plan.md`. Avoid reusing P38–P40 here. These tasks use local IDs 01–07.
- M7 retains worker execution, chunking, storage scale and virtualization. Chunked
  equivalence needs a defined context bound: arbitrary dictionary regex can span
  beyond fixed overlaps, and NER can vary with context. Specify fallback or reject
  unsupported patterns rather than promising universal chunk equivalence.
- M8 retains batching, but consumes this milestone's mapping scopes, coverage
  reports, private-key separation and supported-format export contract. Add archive
  entry/count/expanded-size limits and per-file isolation before accepting ZIPs.
- Defer local OCR, provider adapters, server execution, streaming, optional DOCX
  generation, and mobile distribution to subsequent milestones with explicit gates.
  Layout-preserving PDF/Office redaction is outside current product requirements.

## Open product questions (non-blocking for this proposal)

1. Which documents dominate real use: legal/medical PDFs, Office files, email, or
   spreadsheets? This determines the next extraction/OCR investment.
2. Which AI provider/API and message formats will the browser integration use?
   This determines transport and authentication feasibility.
3. Is restoration normally same-day, or must keys survive weeks and multiple
   devices? This plan assumes explicit portable encrypted key export is required.
