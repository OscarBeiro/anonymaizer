# M09-01 — Safe document round trip and integration foundations

Status: planned; implementation not started. Reviewed and expanded 2026-10-12.

## Outcome and priority

Make the common journey dependable: import or paste → review sensitive content →
copy/download a sanitized artifact → save a private restoration key → restore an
AI response later, even after closing the browser or starting another document.

Reserve M09 as the next unallocated milestone after the existing M6–M8 roadmap.
Its number does not mean its urgent fixes should wait: implement tasks 01–03
before expanding languages or shipping batch exports. Tasks 04–06 establish the
round-trip release gate. Task 07 defines the future integration contract; it does
not implement a proxy or send documents to a provider. Review follow-up phases
08–15 below are required parts of the milestone, with dependencies and release
gates defined in the execution order. Their numbers do not imply that all of
01–07 must finish before they begin.

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
- The public website and its online tool may share the same origin and navigation
  flow. Analytics is limited to consent-gated website visits, including visits to
  the online tool. Document contents, filenames, mappings, restored responses and
  tool actions are excluded. Portable, localhost and self-hosted copies have no
  analytics. A separate tool origin or redirect is not a product requirement.

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
| Roadmap | At initial review, M8 promised original-format exports and bundled mappings. The roadmap now specifies sanitized derivatives and separate private keys; implementation remains pending. General PDF/DOCX/PPTX round trips are not implemented. | `docs/plans/m8-batch.md` P36; `src/components/SaveAsControl.tsx`; `src/core/export/`. | 03, 10 |

### Verification baseline

- Initial review run of `npm test -- --reporter=dot`: 35 suites and 463 tests passed;
  one suite failed to load `marked`, and nine worker startup errors reported
  missing `jsdom`. After restoring lockfile dependencies on 2026-10-12,
  `npm test` passed all 45 suites and 560 tests under Node 22.23.2 / npm 10.9.8.
  `npm run lint`, `npm run build` and `npm run build:portable` also passed.
  Browser and portable `file://` acceptance remain unverified.
- Reproduced the two restoration defects by transpiling the existing
  `reverse.ts` in memory with the installed TypeScript compiler and executing it.
- No dependencies were installed or updated; no application code was changed.
- Restore a lockfile-consistent development environment before implementation
  validation. The partial run does not establish browser or parser correctness.

## Tasks — one implementation session per block where practical

### [ ] 01 — Literal, scoped, observable restoration

Implement one-pass replacement against the response input. For plain text, insert
originals literally via a callback; structured output follows phase 09's text-node
and serialization contract. Never scan inserted values again. Keep existing
canonical-name restoration behavior documented: merged variants are not an
exact reconstruction of the original wording.

Define a versioned token grammar with a per-conversation/session namespace and
unique counters. Detect or escape literal token-shaped text already in input.
Provide explicit legacy compatibility for existing unnamespaced mappings.
Default new restoration to exact tokens; offer a previewed tolerant mode for
AI-altered brackets/casing/spacing. Do not silently replace ordinary bare words
that happen to resemble a token.

Return a restoration report: restored occurrences, unknown tokens, malformed or
ambiguous candidates, and mapping/revision mismatch where verifiable. Phase 08
defines the distinction between verified, mismatched and unverifiable revisions.
Unused mappings are normal
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

M8 P36 now follows this contract: initially export supported sanitized derivatives,
with format conversion disclosed. Faithful original-format redaction is outside
the committed roadmap; reconsider only if requirements change. Never package
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

Acceptance: export → close browser → load key → restore works; wrong keys and
verifiable revision mismatches are flagged, and unverifiable revisions are explicit;
encrypted-file tampering fails; a new document cannot silently restore
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

Restrict public website analytics to consent-gated visit events, including visits
to the online tool. Keep the existing same-origin navigation and in-memory landing
handoff. Do not require a redirect, separate tool origin or storage migration.
Phase 14 defines the visit-event contract and rollout. No document content,
filenames, mappings, restored responses or tool-action telemetry may be collected.
Explicit event fields alone do not constrain third-party scripts already running
in the document context; remove executable analytics integrations with that access
from the shared page and use the minimal visit-event implementation in phase 14.

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

## Review follow-up phases — implementation contracts and acceptance

These phases address the second review's gaps. They refine tasks 01–06 rather
than create parallel implementations. The owner column in the execution order
identifies which existing task consumes each deliverable. Keep all checkboxes
open until the implementation and its acceptance checks pass.

### [ ] 08 — Stable token identity and export snapshots

Extends tasks 01 and 04. Define separate conversation scope, document ID/document
revision, policy revision, mapping revision and export ID. Document their lifetime
and include the relevant identifiers in the private restoration-key schema.
Use collision-resistant namespaces generated in a browser adapter; core receives
identifiers as inputs. Never reuse an issued token for a different original value.
Merge/split, canonical-name changes and rescans must preserve old snapshots and
mint new tokens where a token's meaning would otherwise change.

Expose snapshot selection in restoration. A namespace identifies a scope, not an
exact export: a pasted response may omit every piece of export metadata. Report
revision status as verified, mismatched or unverifiable, with the evidence used.
Matching known tokens alone does not prove the response came from a particular
export. Unverifiable replies may restore against the explicitly selected snapshot
with a visible notice; ambiguous or foreign tokens remain unresolved. Legacy
unnamespaced mappings require explicit selection and cannot imply verified scope.

Acceptance: export A → edit/merge/split → export B → restore replies to both
correctly, including after key reload. Test replies containing no tokens, only
tokens shared by A and B, mixed namespaces, and conflicting legacy mappings.
Unknown tokens never cause a search through unrelated stored keys.

### [ ] 09 — Structured text and context-aware restoration

Extends tasks 01 and 03. Define a pure document representation or token tree with
text-node anchors and a documented Markdown dialect. Parse structure before
restoring values; insert restored originals as text and serialize with escaping
appropriate to each context. Never parse an inserted original as new markup.
Preserve the plain-text literal restoration contract and canonical-name behavior.
Keep DOM sanitization and browser rendering in adapters outside core.

Specify support for heading levels, paragraphs, nested lists and rectangular
tables, including headerless tables and multiline cells. Record an explicit
conversion or structural warning for merged cells, nested tables and other
unsupported shapes. Track extraction coverage separately from structural fidelity;
an extracted text count alone establishes neither reading order nor table meaning.
Markdown remains the interchange format, with documented limits and conversions.

Define handling for placeholders inside inline/fenced code, link destinations,
image destinations and raw HTML. Default resource-bearing constructs to inert text
or removal with a report; do not turn a restored value into an active destination.
Use one rendering policy for preview, rich clipboard HTML and HTML downloads.
Markdown downloads must also avoid active remote-resource constructs.

Acceptance: original values containing pipes, brackets, backticks, newlines, HTML
and Markdown image syntax remain literal in the appropriate output. Test tables
with and without headers, merged cells and nested lists. Compare text content and
semantic structure across preview, copy and export; unsupported structure is
reported rather than silently declared preserved.

### [ ] 10 — Shared preparation for every sanitized copy and download

Extends tasks 03–05; depends on 08 and the coverage/structure contracts in 09.
Create one preparation operation used by Standard copy, Advanced copy, every
sanitized download and future batch/API adapters. It validates the current
document/policy/mapping revisions, scan completion, extraction status, structural
warnings, review decisions and residual findings. Define which findings block
output and which can be acknowledged; empty/failed extraction and timed-out
processing always block. Manual acknowledgment is scoped to the exact revision;
unattended processing rejects incomplete coverage by default.

Return an immutable prepared artifact containing exact content, format, neutral
filename, coverage/review report, export ID and matching mapping snapshot. Keep
the snapshot private and separate from upload artifacts. Inspect the serialized
artifact for residual values and resource-bearing constructs, since serialization
can introduce content absent from the visible preview. Restored downloads use a
separate, clearly labelled output path because originals are intentionally present.

Edits, policy changes and invalidated manual decisions invalidate preparation and
acknowledgments. For asynchronous serialization, recheck revisions before handing
the artifact to the clipboard/download adapter; stale work must not be delivered.
Once delivery starts, content and its associated snapshot stay immutable. Distinguish
prepared, handed to the browser and failed delivery; a download click cannot prove
the user saved the file. Reversible output and realistic output have distinct
contracts; realistic output must not claim a usable restoration snapshot.

Acceptance: every copy/download route enforces the same gates. Test editing during
ZIP generation, a late model result, failed clipboard delivery, changed category
settings and stale acknowledgments. A failed delivery does not lose the snapshot
or report success, and retries use the intended immutable artifact.

### [ ] 11 — Bounded processing and effective cancellation

Extends task 02 and M7 P29. M09 owns request/revision and resource-budget contracts;
M7 P29 owns the single detection-worker implementation and is pulled forward for
this phase. M6 P38 consumes that contract for NER. Parser-specific adapters own
their cancellation hooks; do not add a second detection worker architecture.

Choose and document measured limits for input bytes, expanded archive bytes,
entry counts, XML/text size, document units, processing time, response length,
mapping count and generated output size. Apply archive limits to existing
DOCX/XLSX/PPTX/ODT imports now. M8 adds aggregate batch and nested-archive budgets
and per-file isolation later. Do not rely only on archive-declared sizes: enforce
limits during expansion where supported, or isolate/reject unsupported paths.

Cancellation must stop work and release parser handles, workers, listeners,
buffers and temporary object URLs where applicable. Ignoring a late result alone
does not meet this contract. Use parser cancellation APIs or terminable workers;
where unavailable, define a bounded fallback or reject the operation. Custom
regex cannot run synchronously on the main thread as a timeout fallback.

Acceptance: oversized and highly compressed synthetic documents, pathological
regex, oversized responses and repeated cancel/retry remain bounded and leave
the UI usable. Cancel/reset/clear-data rejects pending operations once, prevents
late commits, and allows a new document to complete. Check hosted and portable
worker behavior before considering this phase complete.

### [ ] 12 — Complete retention policy and clearing across tabs

Extends task 04. Inventory documents, mappings/snapshots, responses, custom rule
terms, review history, preferences and model assets. Separate non-sensitive
preferences/model caching from sensitive content retention. New custom rules in
ephemeral mode stay in memory unless the user explicitly chooses to retain them;
dictionary persistence is a separate choice from remembering a document.

Define transitions between ephemeral and remembered sessions, including existing
stored sessions and rules. Explain and offer recovery before deleting retained
work. Warn before discarding the only recoverable snapshot; offer key export or
explicit discard without requiring a key download for every copy. Do not claim
that browser handoff confirms a key was saved on disk.

Define a shared storage generation and coordinated clearing protocol so another
open tab or delayed save cannot restore cleared content. Revoke stale writers,
invalidate pending jobs, clear in-memory views in cooperating tabs and make
storage writes conditional on the current generation. Document the behavior when
storage or tab-coordination facilities are unavailable; persistence must fail
closed. M7 P31 implements the storage adapter under this policy.

Acceptance: ephemeral reload retains no documents, mappings, responses or newly
created unretained rule terms. Test consent changes, migration, blocked storage,
two tabs editing during clear-data, and a suspended tab resuming afterward.
Cleared data must not reappear; failures must be visible and must not claim
successful deletion. Downloaded files remain outside browser clearing.

### [ ] 13 — Versioned encrypted-key format and recovery UX

Extends task 04; depends on 08 and the retention policy in 12. Write a reviewed
format specification before implementation: authenticated encryption algorithm,
password encoding, KDF and calibrated parameters, salt/nonce generation, envelope
versioning, authenticated metadata and upgrade/compatibility rules. Use browser
cryptography in adapters and established primitives. Keep raw documents out of
the default payload and avoid originals or identifying filenames in public headers.

Bound file/header sizes and allowlist algorithm/KDF identifiers and parameter
ranges before expensive derivation, allocation or decryption. Enforce both minimum
security requirements and maximum resource costs. Reject unsupported versions,
never silently downgrade, and distinguish malformed/unsupported files from a
generic authentication failure. Import validates into temporary state and commits
atomically only after authentication and complete schema validation.

Publish synthetic interoperability fixtures and test password Unicode handling,
tampered headers/ciphertext, wrong passwords, excessive KDF parameters, truncated
files and legacy migration. Record supported browser and file:// behavior for
crypto and key download/import; unsupported environments receive an actionable
failure without plaintext fallback. A restore-only journey after browser restart
must work without the original source document. Explain password/key loss and
offer export reminders before destructive navigation or explicit reset where
browser capabilities permit, without claiming unload prompts are guaranteed.

### [ ] 14 — Website visit analytics and deployment rollout

Extends task 06. Keep the online tool on the public website with its existing
navigation and in-memory paste/upload handoff. Track only consent-gated visits;
do not introduce a separate origin, redirect or cross-origin session migration.
Portable, localhost and self-hosted builds must neither load analytics code nor
send analytics requests.

Define an allowlisted visit-event schema built from constants and approved route
identifiers, never from document state or DOM text. Exclude query strings,
fragments, arbitrary referrers, filenames, titles derived from input, mappings,
restored values, tool actions, errors containing input and persistent document or
conversation identifiers. Disable automatic interaction capture, session replay,
form capture and automatic URL enrichment. Configure the event transport's
referrer policy so excluded URL fields cannot leak through request headers.
Document ordinary network metadata
visible to the analytics destination; do not equate visit tracking with anonymity.

Use a small audited visit-event sender in the shared website/tool document rather
than executing third-party analytics scripts with access to its DOM and storage.
Remove existing script loaders and tag-manager integrations from that shared
runtime, update CSP and adapt consent handling. Check whether the selected
analytics provider supports this browser-only transport; if it does not, omit
the event until a compatible option is selected. Do not add a backend or re-enable
unrestricted scripts to preserve tracking. Analytics failure never blocks the tool.

Define rollout behavior for installed PWAs, old service workers and cached bundles
so an existing page cannot silently keep an old tracker while claiming the new
policy. Use a visible update/reload path that preserves work under phase 12's
retention rules; encrypted key export from phase 13 is available before discarding
the only recoverable snapshot. Keep storage on its current origin. If a separate
origin is proposed later, plan recoverable export/import before any redirect.

Acceptance: website and online-tool visits produce only the allowed visit payload
after consent; declining/revoking consent stops subsequent analytics. Navigate
landing → tool with synthetic sensitive input and inspect every outbound request,
including URLs and headers, before and after restoration. No content or tool-action
telemetry leaves the app. Verify portable/local/self-hosted builds send no analytics,
and test a cached old PWA updating without losing its recoverable session.

### [ ] 15 — Automated browser acceptance and release evidence

Extends task 06 and closes phases 08–14. First restore the lockfile-consistent
test environment and obtain a passing baseline; record exact versions, commands
and results. Add a small browser suite with synthetic fixtures and exercise the
actual UI entry points rather than only calling core helpers.

Cover Standard and Advanced modes, every sanitized copy/download path, structured
restoration, key export → close/reopen → import → restore, edits during processing
and export, cancellation, consent changes, clear-data across tabs, storage migration and
wrong/unverifiable snapshot handling. Assert both clipboard MIME representations
and downloaded artifact contents. Include resource-limit and malicious-markup
fixtures, while keeping expensive stress cases separate from quick regressions.

Define a supported-browser matrix and run the round trip on hosted production
assets and the actual portable file:// entry. Run portable checks with network
denied and capture hosted requests with deployment-specific allowlists; assert
that no sensitive fixture values leave the processing context. Verify rendered
content cannot create remote-resource requests before or after restoration.
Automate accessible names/focus and complete one manual keyboard-only round trip.

Acceptance: existing tests, lint, hosted and portable builds, and the browser
matrix pass. Record any unavailable target as unverified rather than passed.
Release requires all applicable gates; task 07's provider integration remains
design-only and does not authorize provider calls.

## Execution order and ownership

| Stage | Work and owner | Gate / dependencies |
| --- | --- | --- |
| A — Immediate correctness | Task 01 plain-text restoration; task 02 stale-result guards; task 03 neutral filenames and persisted coverage | Start here; do not wait for new languages, batch support or deployment work. These are partial deliverables, not completion of the parent tasks. |
| B — Identity and bounded execution | Phase 08 owns token/snapshot identity; phase 11 and M7 P29 own processing integration | Phase 08 precedes new snapshot/key schemas. Phase 11 consumes task 02 guards and supplies the shared worker contract to M6 P38. |
| C — Structure and review | Phase 09 owns structured serialization; task 05 owns occurrence-based review and residual checks | Uses task 03 coverage and phase 08 identity; document unsupported structure before promising fidelity. |
| D — Output and recovery | Phase 10 owns artifact preparation; phase 12 owns retention policy; phase 13 owns key format and task 04 integration | Phase 10 consumes B/C; phase 12 uses 08; phase 13 uses 08/12. M7 P31 implements storage policy without blocking an in-memory recovery flow. |
| E — Deployment and release | Phase 14 owns visit-only analytics and deployment updates under task 06; phase 15 owns browser acceptance | Phase 14's analytics changes may start early; its update/recovery flow consumes 12–13. Phase 15 closes 01–06 and 08–14 before the round-trip release or M8 exports. |
| F — Future integration design | Task 07 owns the browser integration contract | Consume the established identity, coverage, preparation and cancellation contracts; provider/server implementation remains deferred. |

M6 language expansion follows completion of tasks 01–03 with their required
follow-ups (08–11 and task 05 where needed for output checks); its runtime fixes
may proceed alongside stage B. M7 scale work can continue against the shared
contracts. M8 exports wait for the round-trip release gate. Deliver narrow fixes
incrementally, but tick a parent task only when all its stated acceptance criteria
and required follow-up phases are satisfied.

## Roadmap coordination and deferred work

- M6 retains i18n, jurisdiction/language packs and multilingual NER. The documentation correction in
  `08-m6-transformers-correction.md` is now resolved; follow the updated M6 and
  `M06-01-Browser-local-model-review-plan.md`. Avoid reusing P38–P40 here. These tasks use local IDs 01–15.
- M7 retains worker execution, chunking, storage scale and virtualization. Chunked
  equivalence needs a defined context bound: arbitrary dictionary regex can span
  beyond fixed overlaps, and NER can vary with context. Specify fallback or reject
  unsupported patterns rather than promising universal chunk equivalence.
- M8 retains batching, but consumes this milestone's mapping scopes, coverage,
  artifact preparation, private-key separation and supported-format export contract.
  Phase 11 owns limits for existing single-document containers; M8 adds aggregate
  archive budgets and per-file isolation before accepting batch ZIPs.
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
