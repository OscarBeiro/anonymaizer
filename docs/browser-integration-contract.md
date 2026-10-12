# ADR M09-07: explicit browser integration

Accepted design scope: browser host, buffered text, local transformations,
host-supplied transport. Provider choice is unresolved. No backend, proxy,
provider SDK or provider request is introduced by this milestone.

The host allocates a cryptographically random conversation scope and supplies
policy and document revisions. The adapter runs bounded detection in the shared
worker, obtains accepted occurrences, assigns stable V1 tokens and prepares the
outbound artifact through `prepareArtifact`. The outbound transport receives only
`artifact.upload`; `privateSnapshot` stays in local host memory. Independent
conversations never share token meanings. The host explicitly chooses a snapshot
for each response. Foreign/ambiguous tokens remain visible. Token matching does
not prove an export revision; only explicit matching full revision metadata does.

Proposed host-facing interfaces (design, not a published SDK):

```ts
type TextRequest = { messages: { role: 'system' | 'user' | 'assistant'; text: string }[] };
type ApprovedRequest = { requestId: string; messages: TextRequest['messages']; idempotencyKey: string };
type LocalReference = { scope: string; exportId: string; mappingRevision: number };
interface Transport {
  send(request: ApprovedRequest, signal: AbortSignal): Promise<{ text: string; revisionEvidence?: LocalReference }>;
}
```

Only the three declared message roles and string text fields are supported.
System messages and prior assistant messages are sanitized again before each
send. JSON imports must have own allowlisted keys, no prototype-like keys,
maximum depth 8, at most 100 messages, 2 million total input characters and
4 million output characters. Recursively validate the complete shape before
processing. Reject unknown fields, binary attachments, remote-file references,
tool calls and non-text content types; never forward them untouched. Future
tool arguments/results require schema-specific handling and separate approval.

The host owns credentials and transport. Before choosing a provider, verify its
CORS policy and short-lived browser authentication flow with the actual endpoint.
Long-lived secrets must never be published in a frontend. If the chosen endpoint
cannot support browser access, report `unsupported_transport`; do not silently
add a proxy. Destination and message roles must be explicitly allowlisted.

Contract states: received → validating → detecting → prepared → sending →
restoring → complete. Cancellation aborts transport, terminates processing and
rejects once. Completion of an old request cannot commit into a changed policy,
document, cleared generation or conversation. Requests have unique IDs; duplicate
idempotency keys retry the immutable approved request and snapshot only. Edits
require a new request ID and key. Independent concurrent requests have separate
reply associations. Expiration drops local references only after recovery export
or deliberate discard. No automatically selected unrelated key is searched.

Errors: `invalid_request`, `unsupported_content`, `unsupported_transport`,
`resource_limit`, `incomplete_coverage`, `review_required`, `cancelled`,
`transport_failed`, `unknown_snapshot`, `revision_mismatch`. Sanitization failure
means no send. Restoration failures return unresolved content and diagnostics;
never infer originals. Errors/logs contain only type and request state, no source,
filenames, mappings, restored text or content-bearing exception messages.

Synthetic mock scenarios:

| Scenario | Approved transport input | Local response behavior |
| --- | --- | --- |
| A: user `a@example.com` | scoped EMAIL token for A | A token restores with A snapshot |
| B: same source in independent conversation | different B namespace | A token in B response stays unresolved |
| Edit A after export A1 | A2 snapshot, new tokens for changed meanings | A1 still restores with selected A1 |
| Partial image/text PDF in unattended call | no transport invocation | `incomplete_coverage` |
| Unsupported attachment or tool call | no transport invocation | `unsupported_content` |
| Cancel during scan/transport | at most the already handed approved request | pending operation rejects once; late reply ignored |
| Missing export metadata | approved text only | visible unverifiable revision, explicit selected snapshot |

Tests in `src/core/integrationContract.test.ts` exercise mock transport scope
separation and incomplete-coverage no-send behavior. No provider calls are made.
Streaming is deferred. A future implementation must buffer split tokens across
all split points, UTF-8 boundaries, cancellation and malformed endings, and must
model tool-call events separately. Server hosting is deferred and requires its
own tenant, credentials, retention and deployment architecture. Residual context
can still allow a provider to infer identity.
