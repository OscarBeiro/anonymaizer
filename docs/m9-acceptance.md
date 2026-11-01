# M9 implementation and acceptance evidence — 2026-10-12

**Frontend rollback:** at the user's request, `src/App.tsx`, the components,
legal-page presentation and update-prompt behavior were restored to `fbd7944`
(the version before M9). The sections below describe the earlier implementation
and historical validation, not the current UI. Private-key controls, output
review/preparation integration, manual occurrence review and retention controls
are removed from the interface. Core modules and adapters remain available.
The M9 browser runner describes the removed interface and is not an acceptance
claim for the restored frontend.

M9 is in progress. The browser round-trip foundation is implemented, but the
full milestone release gate is not satisfied. Parent checkboxes remain open
where their follow-up acceptance is incomplete. Do not ship this as a completed
M9 release solely on the evidence below.

## Implemented

- One-pass literal restoration, exact scoped tokens by default, explicit legacy
  and tolerant previews, unknown/ambiguous/malformed token reports. Canonical
  merged-name restoration remains intentionally lossy.
- Stable cryptographically random conversation namespaces, monotonic counters,
  separate revision identities and immutable export snapshots. Explicit snapshot
  selection and key import work without the original document. Matching tokens
  alone never establish verified provenance.
- Shared runtime-neutral preparation for Standard copy, Advanced panel/footer
  copy and every sanitized download. Review gates include extraction coverage,
  disabled categories, deliberately visible mappings and residual values/patterns.
  Acknowledgments are scoped to exact output revisions. Async XLSX serialization
  rechecks current revision before delivery. Failed delivery retains the snapshot.
- One bounded detection worker (the M7 P29 seam), request-aware NER and effective
  worker termination. Stale processing cannot commit after edits/reset/policy
  changes. NER downloads are prohibited on local/self-hosted/portable copies.
- Actual streamed ZIP expansion validation for DOCX/ODT/XLSX/PPTX in an isolated
  terminable worker: 2000 entries, 2 MB per entry, 20 MB expanded, 10-second limit.
  Input files: 20 MB; source/response text: 2 million characters; mappings: 10,000;
  generated output: 4 million characters; PDF pages: 1000; XLSX columns: 16,384.
  These are conservative initial budgets, not fully calibrated stress limits.
- Persisted extraction reports and conservative mixed image/text PDF warnings.
  Parser handles are cleaned in finally blocks. Exports have neutral filenames
  and titles and never reuse source document containers or private keys.
- Semantic Markdown/HTML rendering shared across restoration preview, rich
  clipboard and HTML download. Original values are inserted into parsed text
  nodes; images/links become inert labels and raw HTML becomes literal text.
  GFM headings, paragraphs, nested lists, rectangular tables and code are covered.
- Accepted occurrence anchors drive toggles and realistic rendering. Advanced
  review has selected-occurrence/all-occurrences redaction, contextual source
  selection, undo and separate dictionary creation. Matching manual anchors are
  replayed during scans; lost decisions produce a review notice.
- Ephemeral document/rule retention by default, separate explicit retention
  choices, recoverable legacy migration and generation-revoked stale writers.
  Retained sessions validate identity, snapshots, fields and occurrence anchors.
  Clear-data invalidates processing and private-key jobs and clears cooperating
  tabs; downloaded files remain outside browser clearing.
- AES-256-GCM private keys with PBKDF2-HMAC-SHA256, bounded envelope validation,
  authenticated headers, Unicode passwords and atomic validated import. The
  format is specified in `restoration-key-format.md`. Raw source text is excluded.
- Executable GA/Metricool loaders removed, consent policy version bumped, CSP
  analytics hosts removed and constant visit schemas allowlisted. Events are
  omitted until a compatible audited browser-only transport is selected. No
  backend or provider integration was added. Update prompts warn about ephemeral
  work and private-key recovery before reload.
- Design-only browser integration ADR and local mock transport scope/no-send tests
  in `browser-integration-contract.md` and `integrationContract.test.ts`.

## Verification

The shell defaults to Node 20.20.2 / npm 10.8.2; that runtime produces nine jsdom
startup errors. Use the Node 24 pinned in `.nvmrc`. No dependencies were added.

Commands:

```
export PATH=/home/oscar/.nvm/versions/node/v24.22.2/bin:$PATH
npm test -- --reporter=dot
npm run lint
npm run build
npm run build:portable
sh scripts/check-no-analytics.sh dist
sh scripts/check-no-analytics.sh dist-portable
```

The unit/parser suite reached 56 suites / 595 passing tests. Hosted and portable
builds passed. Lint passed without warnings. Final rerun results should accompany
this document if subsequent changes alter these counts.

Chrome's actual UI passed Standard worker detection, Standard clipboard content,
Advanced review and both Advanced copy routes, semantic HTML download, encrypted
key download, ephemeral reload, key import without source, structured restoration,
rich clipboard MIME types and resource/request containment. The final portable
file run passed Standard processing, Advanced review and the recovery/download journey with HTTP/HTTPS denied. The
portable clipboard is not claimed supported: its browser context may reject
clipboard access; download and key recovery remain available.

Runner: `scripts/m9-browser.mjs`, Node 22 and an isolated Chrome debugging profile:

```
google-chrome --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9222 --user-data-dir=/tmp/anonymaizer-m9-chrome about:blank
npm run preview -- --host 127.0.0.1 --port 4173
npm run test:browser
M9_URL=file:///absolute/path/to/dist-portable/index.html npm run test:browser
```

The asset acceptance run bypasses service workers so it tests the current build.
It does not establish cached-PWA rollout acceptance. It activates actual UI
controls through DOM events and enters text through CDP input; it is not a manual
keyboard-only acceptance run. Synthetic fixtures only; no provider requests.

## Remaining release gates by phase

| Phase | Remaining acceptance |
| --- | --- |
| 01 | Broader structured/legacy/malformed response fixtures and the parent 08–09 follow-ups. |
| 02 | Actual delayed NER UI races across every reset/policy path, plus complete parser cancellation under 11. |
| 03 | Format-by-feature capability evidence and explicit headerless/multiline/merged/nested-table conversions. Most parser unit counts remain document-level rather than detailed units. |
| 04 | Full migration/retention/key compatibility browser matrix under 12–13; recoverable-navigation reminders beyond explicit reset/update. |
| 05 | Full manual review/merge/split/rescan browser coverage, independently evaluated residual fixtures, and keyboard-only acceptance. |
| 06 | Live deployment CSP/request capture, actual cached old-PWA update and the complete release fixture/matrix gates. |
| 07 | Design and mock acceptance implemented; provider/server/streaming work remains deliberately deferred. |
| 08 | Full A→merge/split→B→key-reload browser acceptance and conflicting legacy snapshot cases. |
| 09 | Headerless/multiline tables, merged-cell and nested-table conversion reports across parsers; exact cross-format semantic comparisons. |
| 10 | Browser assertions for every format including async ZIP edit races, failed clipboard retry and stale acknowledgment. |
| 11 | XML node/depth limits and calibrated expanded-document/time/memory budgets. DOM-based Office parsing remains on the main thread after bounded archive validation; cancellation is cooperative between operations, not interruption of synchronous DOM/library calls. Pathological compressed/archive/parser stress and repeated cancel/retry browser acceptance remain open. |
| 12 | Actual two-tab editing during clearing, suspended-tab resume, retention-transition and blocked-storage UI browser cases. LocalStorage generation revocation is implemented; M7 IndexedDB scale work is deferred. |
| 13 | Published independent interoperability fixtures, KDF calibration, broader tamper/Unicode/schema cases and supported browser/file matrix. Current implementation has no plaintext fallback. |
| 14 | Compatible visit transport selection if events are desired, old-cookie cleanup verification and cached-PWA recovery/update acceptance. Omitting events is permitted by the plan. |
| 15 | Full UI/path/format/stress coverage; supported-browser matrix beyond Linux Chrome; live hosted deployment, cached-PWA rollout and a manual keyboard-only round trip. |

M8 exports remain gated on completing these checks. Work is local and uncommitted;
no deploy, provider transport or external publication was performed.
