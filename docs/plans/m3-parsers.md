# Milestone 3 — Document parsers

### [x] P8sec — Dependency security: transformers.js v2 → v4 (**do this first**)

This is really M2 work — it is the P7d backlog item below, promoted — but M2
is not being reopened, so it runs first in M3, ahead of P8a.

**Why:** GitHub reported 13 Dependabot advisories on `main` (1 critical, 7
high, 5 moderate; `npm audit` counts 5, GitHub counts each advisory). All of
them trace to one root — `@xenova/transformers@2.17.2`, which is unmaintained:

```
@xenova/transformers 2.17.2
├─ onnxruntime-web <=1.16 → onnx-proto (abandoned) → protobufjs <=7.6.2
│                                        ← the critical + most of the highs
└─ sharp <=0.35.4-rc.0                   ← libvips / libheif highs
```

No release of `@xenova/transformers` fixes this; `npm audit fix --force`
tries to *downgrade* to 1.4.2. The successor is `@huggingface/transformers`
(same authors, v4.3.0), whose onnxruntime-web is 1.31 — `onnx-proto` and
`protobufjs` are gone entirely — and whose `sharp ^0.35.4` is above the
vulnerable range.

**Status — started 2026-09-20, left uncommitted in the working tree:**

- [x] Swapped the dependency; `npm audit` reports **0 vulnerabilities**.
- [x] `src/workers/ner.worker.ts` imports `@huggingface/transformers`;
      v2's `quantized: true` is v3+'s `dtype: 'q8'` — the same int8 weights,
      so the cached ~104MB model and its cache keys are unchanged.
- [x] `env.customCache` survives the move: v4's `CacheInterface` is still
      `match(key) => Response|undefined` / `put(key, response)`, so
      `nerModelCache.ts` needed no change beyond a stale comment.
- [x] Bundle-size trap, found and fixed: onnxruntime-web 1.31's default
      browser entry embeds ~54MB of `.wasm` via `new URL(...)`, which
      `viteSingleFile` base64-inlines — the worker went 811kB → **72MB**.
      `vite.config.ts` now sets the `onnxruntime-web-use-extern-wasm`
      resolve condition, selecting ort's external-wasm build. Worker is now
      492kB, *smaller* than the 811kB v2 baseline.
- [x] `npm run build` and all 176 tests pass.

**What is left — start here tomorrow:**

1. ~~**Pin `wasmPaths`.**~~ **Done 2026-09-21.** Confirmed by hand
   (`curl -I`) that the default jsdelivr CDN URL resolves for the installed
   `-dev` version (both `ort-wasm-simd-threaded.asyncify.{wasm,mjs}` return
   200), so left unpinned; recorded the verification as a comment in
   `ner.worker.ts`.
2. ~~**Verify NER in a real browser.**~~ **Done 2026-09-21 — found and
   fixed a real regression, not just a runtime check.** Driven via a
   throwaway Playwright script (`npx playwright` + cached Chromium, no
   project dependency added) against `npm run dev`: the model downloads,
   caches correctly in IndexedDB (109MB ONNX + 27MB wasm, confirmed
   `[NER cache] stored`/`hit` log lines), and reaches `status: 'ready'`.
   First pass found **zero NER entities ever reached the anonymizer** —
   `[[COMPANY_001]]`/`[[EMAIL_001]]` (regex/dictionary detectors) tagged
   correctly, `John Smith`/`Maria Garcia` were left in plaintext.
   **Root cause:** `@huggingface/transformers` v4's
   `TokenClassificationPipeline._call` never sets `start`/`end` character
   offsets at all (`// TODO: Add support for start and end` in
   `node_modules/@huggingface/transformers/dist/transformers.js`); v2
   computed these. `aggregateBioTokens` correctly drops every token with
   no offset — the bug was upstream, not in our merge logic.
   **Fix:** added `computeTokenOffsets` (`src/core/ner.ts`), a pure
   function that reconstructs `start`/`end` by walking the token list in
   order and matching each decoded `word` against `text` (exact-case
   first, falling back to case-insensitive), treating a `##`-prefixed
   WordPiece continuation as always sitting immediately after the
   previous token regardless of its own B-/I- tag. That last part matters:
   bert-base-NER under v4 was observed re-tagging a continuation subword
   as a fresh `B-` instead of `I-` (e.g. "Acme" → `B-ORG "A"`, `B-ORG
   "##c"`, `I-ORG "##me"`), which `aggregateBioTokens` had to be taught to
   still merge (a `##` token can never start a new word). Also had to fix
   a real offset-collision bug along the way: the pipeline's default
   `ignore_labels: ['O']` drops every non-entity token, so there is no
   "works"/"at" token to advance the cursor between "Smith" and "Acme" —
   a case-insensitive search for "A" was matching the lowercase "a" inside
   the skipped word "at" before reaching the real, capitalized "Acme".
   Fixed by trying exact case first.
   Added 8 new unit tests to `src/core/ner.test.ts` covering all of the
   above (176 → 184 tests). Re-verified live in the browser after the
   fix: `John Smith` → `[[NAME_001]]`, `Maria Garcia` → `[[NAME_002]]`,
   `Acme Corp` → `[[COMPANY_002]]` (no more spurious extra entities),
   confidence 1.0 on all. Also verified: reload → re-enabling NER made
   **zero** new `model_quantized.onnx` requests (real IndexedDB cache
   hit) and re-tagged names correctly; **Delete model** cleared the cache
   and a subsequent re-enable did a full re-download, confirming the two
   actions stay properly distinct.
3. ~~**Re-check the `file://` single-file path.**~~ **Done 2026-09-21.**
   Opened `dist/index.html` via `file://` in headless Chromium: exactly
   one request total (the page itself) through a full paste → sanitize →
   restore round trip — zero network calls, placeholders rendered
   correctly. (NER itself not re-tested from `file://` — the ~104MB
   download there is unchanged from the working `npm run dev` path and
   P7d already covers the `file://`-specific IndexedDB-vs-CacheStorage
   concern; nothing about the offset fix is `file://`-sensitive.)
4. ~~**Commit, push, and confirm Dependabot goes quiet on `main`.**~~
   Committed and pushed (`main` level with `origin/main` as of the start of
   P8a). Worth an eyeball on the GitHub security tab to confirm the 13
   advisories have closed, but nothing is left to change in the tree.

**Note:** `npm install` also warns `EBADENGINE` on Node 20.20.2 — something
in the tree wants newer. Unrelated to the advisories; worth a look separately.

**Backlog item carried over from P7d (superseded by P8sec above, keep until
it is committed):** evaluate an alternative in-browser ONNX runtime for the
NER worker that avoids `onnxruntime-web`'s vulnerable `protobufjs`
dependency.

**Backlog item — placeholder tagging collision.** `reverseText`'s restore
regex runs case-insensitive (`i` flag) so an LLM that lowercases
`[name_1]` in its reply still restores — but that means two custom
dictionary categories differing only by case (`Custom` vs `CUSTOM`,
user-defined via `CustomDictionaryRule.targetCategory`) can collide on
restore. Fix is to canonicalize category casing when a custom rule mints
one (or reject a case-only collision at rule-creation time). Not a risk for
the built-in categories (`NAME`, `EMAIL`, …), which are all fixed and
distinct; only user-defined `CATEGORY`-type rules can produce this.
The other tagging question raised alongside this — whether `[NAME_1]` risks
colliding with literal bracketed text already in a document, whether
double brackets (`[[NAME_1]]`) would help, and whether the counter should
be zero-padded — was answered in-session: the existing length-descending
placeholder sort already prevents `[NAME_1]`/`[NAME_11]` prefix-eating
(that's the P3 spec-trap fix, not a bracket-style concern), double brackets
don't dodge Markdown's own `[[wiki-link]]` syntax so gain nothing, and
zero-padding fixes nothing the length-sort doesn't already fix. No action
needed on those three; only the case-collision item above is real.

**Backlog item — tag DNI/NIE with a wrong check letter too.**
`validators.ts` (`DNI_LETTERS[digits % 23] === letter`) currently only
confirms a candidate; a document number that *looks* like a DNI/NIE but has
the wrong check letter (typo, OCR error, deliberately obscured) is not
flagged as an ID at all today and leaks through unmasked. Suggested by the
user 2026-09-21, e.g. `76.123.312-E` — worth computing the expected letter
and tagging the number regardless, distinguishing "valid ID" from "ID-shaped
number with a bad check letter" (perhaps a distinct category or a warning)
rather than silently passing invalid ones through. Not yet scoped to a
session — revisit when picking the next M3/backlog item.

One prompt per format, one session each — plus a prep session first, because
four decisions have to be made once rather than rediscovered (and answered
differently) in each format session.

## Shared decisions — settled, do not re-litigate in a session

The original one-line-per-format template hid four problems, each of which
would have blown up mid-session:

1. **Rule 4 collision.** `src/core/` is pure TypeScript — no React, no DOM; it
   is the Capacitor insurance. But mammoth, pdfjs, `DOMParser` (pptx/odt) and
   turndown (eml HTML bodies) are all browser libraries. Every M3 parser except
   `.csv` would have violated rule 4.
   → **The registry stays pure in `src/core/parsers/`; concrete parsers live in
   a new `src/lib/parsers/`.** Rule 4 stays absolute.
2. **Bundle weight vs. the P6 single-file promise.** Parsers register by import
   side effect, so a static import graph inlines mammoth + pdfjs + SheetJS +
   jszip into `index.html` for every user, including the ones who only paste
   text. → **Lazy-loaded per format via dynamic `import()`.** (P8a found the
   sting in the tail: a lazy chunk cannot be fetched from a `file://` page, so
   this holds for the hosted build and the portable build inlines instead —
   see P8a's outcome.)
3. **Runtime network risk.** pdfjs-dist fetches cMaps and standard fonts from a
   CDN by default — a silent breach of hard rules 2 and 3, and only on
   documents with CJK or embedded fonts. → Handled explicitly in P8c.
4. **`ParsedDocument` is too thin.** `{ markdown, format }` has no channel for
   partial failure (an image-only PDF, dropped email attachments, sheet 7 of
   40), and `format` is a free string feeding `MappingSession.originalFormat`.
   → **`warnings?: string[]` plus a closed `DocumentFormat` union.**

A fifth, found while planning: `vitest.config.ts` pins `environment: 'node'`
and `include: ['src/**/*.test.ts']`. Every DOM-using parser test needs a
different environment, and no format session would expect to touch test config.
→ Handled in P8a.

**Order:** `.docx`, `.pdf`, `.odt` first (they match the documents the tool is
actually being used on), then `.csv` and `.xlsx` as *separate* sessions (csv
needs no dependency at all), then `.eml` and `.pptx`.

**Scanned/image-only PDFs are out of scope.** OCR means another multi-MB WASM
model and a second opt-in flow — that is M2-shaped work, not parser work. The
`.pdf` parser detects "zero extractable text" and warns.

### [x] P8a — Parser infrastructure (prep session, no new format)

> Widen the parser seam before any real format lands.
> In `src/core/parsers/index.ts`: add `format: DocumentFormat` (a closed union
> — `'raw_text' | 'docx' | 'pdf' | 'odt' | 'csv' | 'xlsx' | 'eml' | 'pptx'`,
> declared in `src/core/types.ts` and used for `MappingSession.originalFormat`)
> and `warnings?: string[]` to `ParsedDocument`. `DocumentFormat` lives in
> `types.ts` and is imported by the registry, not the other way round —
> `MappingSession` should not reach into the registry for the shape of one of
> its own fields.
> Change the registry from `Map<string, Parser>` to `Map<string, ParserLoader>`
> where `ParserLoader = () => Promise<Parser>`; `registerParser` keeps its
> `(extensions, parser)` shape for eager parsers like plain text, and a new
> `registerLazyParser(extensions, loader)` takes the loader.
> `supportedExtensions()` must still answer from the key set without invoking
> any loader — that is what keeps the drop-zone hint free. `parseDocument`
> awaits the loader, caches the resolved parser, and on loader rejection throws
> an error naming the format rather than leaking a chunk-load message.
> Create `src/lib/parsers/index.ts` as the single registration site the UI
> imports (`import '../lib/parsers'` from `App.tsx`), each entry one line:
> `registerLazyParser(['docx'], async () => (await import('./docx')).parse)`.
> That file must contain **no library imports** — only the thunks.
> Surface `warnings` in `IngestStep.tsx`: `onFileImport` gains a `warnings`
> argument and the drop zone renders them as a non-blocking notice, visually
> distinct from the existing `.form-error`.
> Update `vitest.config.ts` so `src/lib/parsers/**/*.test.ts` runs under a DOM
> environment (`environmentMatchGlobs`, or `happy-dom`/`jsdom` as a
> devDependency) while `src/core/**` stays on `node` — core purity is the point
> of that split, so keep it explicit in the config comment.
> Write tests first: `supportedExtensions()` lists a lazily-registered format
> without calling its loader (assert with a spy); `parseDocument` invokes the
> loader exactly once across two calls; a rejecting loader produces an error
> message naming the extension; a parser returning `warnings` round-trips them.

> **Trap — `vite-plugin-singlefile` and dynamic imports.** The plugin's
> recommended build config sets rollup's `inlineDynamicImports`, which would
> inline every parser chunk back into `index.html` and erase the whole point of
> lazy loading. P7d already established the precedent — the NER worker ships as
> a separate file beside `index.html` ("single-file for everything except the
> opt-in model"). **This session must verify empirically, not assume**: run
> `npm run build` and inspect `dist/`. If parser chunks are inlined, configure
> the plugin to leave them out (its `inlinePattern`/`useRecommendedBuildConfig`
> options) and confirm a chunk emitted beside `index.html` still loads from a
> `file://` origin — that is the origin this build is meant to be opened from,
> and exactly where the NER model cache broke in P7d. Record the measured
> outcome here the way P7d's "Build output caveat" note does.
> Two constraints to know before experimenting: rollup rejects
> `output.manualChunks` together with `inlineDynamicImports`, so that is not a
> combination to reach for; and if `file://` chunk loading proves impossible,
> the fallback is the P7d shape — a second rollup entry per heavy parser,
> emitted beside `index.html` exactly as `ner.worker-*.js` is. Web Workers have
> no `DOMParser`, so a Worker-based fallback would **not** cover
> `.odt`/`.pptx`/`.eml`; those parse on the main thread by necessity, and each
> should carry a one-line comment saying so — "heavy parsing ⇒ worker" is the
> obvious wrong inference from `ner.worker.ts`.

**Outcome — done 2026-09-21.** Everything above landed as written, plus one
decision the prompt could not pre-make.

- **Registry.** `ParsedDocument` now carries `format: DocumentFormat` (closed
  union in `src/core/types.ts`, also the type of
  `MappingSession.originalFormat`) and `warnings?: string[]`. Two maps: a
  `loaders` map that `supportedExtensions()` reads keys from without invoking
  anything, and a `resolved` cache so a loader runs once. A rejected loader is
  rewrapped as `Could not load the .<ext> parser.` with the original as
  `cause`, and is **not** cached, so a transient failure can be retried by
  re-dropping the file. 11 registry tests (190 total, from 184).
- **Test-environment split.** `environmentMatchGlobs` is gone in Vitest 5, so
  `vitest.config.ts` uses `test.projects`: a `core` project on `node`
  (`src/**/*.test.ts`, excluding `src/lib/parsers/**`) and a `parsers-dom`
  project on `happy-dom` (`src/lib/parsers/**/*.test.ts`). `happy-dom` added as
  a devDependency; `npm audit` still clean.
  `src/lib/parsers/domEnvironment.test.ts` asserts the DOM is actually there —
  it guards the split itself, so if it is ever lost, P8d/P8h fail for the right
  reason instead of looking like parser bugs.
- **Warnings in the UI.** `onFileImport` gained a `warnings: string[]`
  argument; `App` holds them in `importWarnings` state (cleared on any manual
  edit, deliberately not persisted with the session) and passes them back down,
  so `IngestStep` renders an amber, boxed, `role="status"` `.import-warnings`
  notice, visually distinct from red `.form-error`.

**Build-output caveat — two builds, not one.** Verified empirically with a
throwaway `src/lib/parsers/__probe.ts` lazy parser (added, measured, removed)
and headless Chromium via `npx playwright`, not assumed:

1. With `viteSingleFile`'s default `useRecommendedBuildConfig`, the probe chunk
   **was** inlined into `index.html` and no chunk file was emitted. On Vite 8
   the plugin sets rolldown's `output.codeSplitting = false` (the Vite ≤7 path
   sets `inlineDynamicImports`), which defeats lazy loading entirely.
2. Opting out (`useRecommendedBuildConfig: false`, plus `inlinePattern`
   restricted to the root-level entry) did emit
   `dist/chunks/__probe-<hash>.js` beside `index.html` with the marker string
   out of `index.html`, and over `http://` it was fetched only on file import
   — **but this half-and-half shape is broken, and P8b caught it** (see that
   session's outcome). A lazily-imported chunk shares modules with the entry
   chunk, which the plugin inlines *and then deletes*, so the chunk is left
   importing a file that is not there: `GET /index-<hash>.js` → **404**.
   Keeping the file (`deleteInlinedFiles: false`) is worse, not better: the
   chunk would then load a second instance of the entry module graph,
   mounting the app twice and giving the parser registry two disconnected
   copies. **Single-file and code splitting cannot be combined at all.**
3. **And a chunk cannot load from `file://` regardless.** Chromium refuses a
   dynamic `import()` from a `file://` page — *"Access to script at
   'file:///…' from origin 'null' has been blocked by CORS policy"*. The
   plan's suggested fallback (a second rollup entry per parser, the
   `ner.worker.js` shape) does **not** help: the block is on module-script
   fetching from origin `null`, not on code splitting, so any emitted `.js`
   sibling fails the same way.
4. **Resolution: two production builds, and the hosted one drops the plugin
   entirely.** `npm run build` → `dist/`, a plain code-split Vite build
   (`index.html` + `assets/`), for http(s) and the PWA.
   `npm run build:portable` → `dist-portable/`, `viteSingleFile` with
   everything inlined, for the `file://` story. `ANONYMAIZER_PORTABLE=1`
   switches `vite.config.ts` between them. Anything else would have cost
   either the paste-only user a multi-megabyte download of mammoth + pdfjs +
   SheetJS they never use, or the portable build its ability to open a
   document at all.
5. **`file://` round trip on `dist-portable/`: 1 request total** (the page),
   zero console errors, through paste → `[[EMAIL_001]]`/`[[DNI_001]]` →
   sanitized panel, then a `.probe` import (the inlined lazy path resolves) and
   a `.txt` import. The P6 zero-network guarantee holds.
6. **`public/sw.js` had to follow.** It precached a fixed app-shell list on the
   premise that all JS was inlined into `index.html`; with the hosted build
   code-split, offline would have loaded the page and then failed to fetch
   `/assets/*.js`. It now precaches only the shell and adds same-origin `GET`
   responses to the cache as they are fetched, so a parser chunk is cached the
   first time that format is imported and never before. Cache name bumped to
   `anonymaizer-v2` so installed clients discard the stale shell.

**Size baseline.** The signal changed with the build shape, so measure the
**entry chunk**, not `index.html` (which is now a 0.57 kB stub in the hosted
build). At the end of P8b, with `.docx` registered:

| File | Size |
| --- | --- |
| `dist/index.html` | 0.57 kB |
| `dist/assets/index-*.js` (entry) | 480.96 kB |
| `dist/assets/docx-*.js` (lazy) | 390.24 kB |
| `dist/assets/ner.worker-*.js` | 492.28 kB |
| `dist-portable/index.html` (all inlined) | 879.25 kB |

**Re-check the entry chunk in every later format session.** If it grows by
roughly a parser library's weight, the lazy split has silently regressed and
nothing else will tell you. The portable `index.html` is *expected* to grow
with each format — that one only needs to stay under whatever a user will
tolerate downloading once.

### [x] P8b — `.docx` (mammoth.js)

> Add `src/lib/parsers/docx.ts` exporting
> `parse(bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument>`, using
> mammoth's `convertToHtml({ arrayBuffer })` and converting the HTML to Markdown
> with the **existing** turndown dependency — do not add a second HTML→MD
> library, and do not construct a `TurndownService` here: use the shared
> `src/lib/htmlToMarkdown.ts` from P7f, which is what keeps emphasis markers out
> of the string the detectors run offsets over.
> Collect mammoth's own `messages` array into `warnings` — it reports
> unsupported styles and dropped images. Return `format: 'docx'`.
> Register it lazily in `src/lib/parsers/index.ts`; touch no other parser and no
> UI beyond that one line.
> Write tests first, against a programmatically built fixture (see Fixtures):
> headings and lists survive as Markdown; a table becomes a Markdown table;
> mammoth warnings land in `warnings`; a corrupt/truncated zip throws rather
> than silently yielding an empty document.

**Outcome — done 2026-09-21.** `src/lib/parsers/docx.ts`, registered lazily,
mammoth 1.12.3 + jszip 3.10.2 installed (`npm audit`: 0 vulnerabilities; both
trees grepped clean of `fetch`/`XMLHttpRequest`, so hard rules 2 and 3 hold).
207 tests (from 190). Five things worth carrying forward:

- **The "build that ships vs. build that tests" trap is real, and it arrived at
  P8b rather than P8c.** mammoth ships two zip readers and selects between them
  through package.json's `browser` field: the Node one takes `{path}`/`{buffer}`,
  the browser one takes `{arrayBuffer}` — the only shape the pure
  `src/core/parsers` seam can hand it. `vite build` **does** apply that mapping
  (verified by grepping the built chunk: it contains only the
  `e.arrayBuffer ? …` branch and no `fs`), so the parser's plain
  `import mammoth from 'mammoth'` is right for the browser and correctly typed.
  **Vitest resolves the Node entry** and every document then throws. Fixed with
  `resolve.alias: { mammoth: 'mammoth/mammoth.browser.js' }` scoped to the
  `parsers-dom` project in `vitest.config.ts` — the test environment's
  requirement stays out of what ships. Neither `resolve.conditions`/`mainFields`
  nor `server.deps.inline` moved it; don't retry those.
- **Turndown has no table rules**, so tables came through as one run-together
  text blob — which is also a detection hazard, gluing unrelated cell values
  into single candidates. Added table/tr/th/td/thead/tbody/tfoot rules to the
  shared `src/lib/htmlToMarkdown.ts` (not to the parser): the first row is
  always the header since GFM needs a delimiter row after row one regardless,
  pipes inside cells are escaped, and multi-line cells flatten onto one row.
  `.odt`, `.xlsx` and `.pptx` inherit this. Note `node.children` is not
  iterable under turndown's Node fallback (domino) — use `childNodes`.
- **`bulletListMarker: '-'`**, for the same reason P7f strips emphasis: turndown
  defaults to `*`, which is in `MASK_GLYPHS`, so every bullet would have put an
  asterisk immediately before its item's text.
- **mammoth's `messages` land in `warnings` verbatim**, and `warnings` stays
  `undefined` on a clean document. An empty conversion additionally warns that
  the document had no extractable text (the same shape `.pdf` needs in P8c).
  A truncated or non-OOXML zip throws an error naming the file rather than
  yielding an empty document.
- **Document metadata (core.xml: author, last-modified-by) is not extracted.**
  mammoth does not expose it. The deliberate decision is deferred to P8d, whose
  ODF-metadata trap answers it for all three OOXML/ODF formats.

Verified live in headless Chromium against a generated `.docx` (headings, a
bullet list, a table, an undefined paragraph style), on **both** builds: from
`file://` on `dist-portable/` — **1 request total** — and over `http://` on
`dist/`, where the 390 kB `docx` chunk is fetched only on import and never at
page load. Markdown comes out with `#`/`##` headings, `-` bullets and a real
Markdown table; detection through it yields `NAME`, `MASKED_ID`, `COMPANY`,
`EMAIL`, `PHONE`, `ID_CODE` and — inside a table cell — `DNI`, and mammoth's
warnings render in the amber notice.

**False alarm worth recording:** a DNI in a table cell first appeared
undetected. The number was simply invalid (`45678912Q` — the correct check
letter is `S`), which is exactly the backlog item above about ID-shaped numbers
with a bad check letter passing through unmasked. Detection through table cells
is fine; that backlog item is now a *demonstrated* leak, not a hypothetical one.

### [ ] P8c — `.pdf` (pdfjs-dist)

> Add `src/lib/parsers/pdf.ts`. Use `pdfjs-dist`'s `getDocument`, walk pages,
> and reflow `getTextContent()` items into Markdown using their transform —
> group items into lines by Y proximity, join with spaces, break paragraphs on
> vertical gaps. Return `format: 'pdf'`.
> If total extracted text is empty or near-empty, return the empty markdown plus
> a `warnings` entry saying the PDF appears to be scanned images and that text
> extraction found nothing — **no OCR**, deliberately out of scope. Warn on page
> count above a threshold rather than silently taking minutes.
> Write tests first: a two-page generated PDF reflows into paragraphs in reading
> order; a two-column layout does not interleave columns; an image-only PDF
> yields the scanned-document warning and no throw.

> **Trap — pdfjs phones home (hard rules 2 and 3).** By default pdfjs fetches
> cMaps and standard fonts from a CDN, and resolves its worker by URL. Set
> `GlobalWorkerOptions.workerSrc` to a bundled worker
> (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`), and pass
> **no** `cMapUrl`/`standardFontDataUrl` rather than the CDN defaults. A full
> local cMap bundle is heavy for a tool whose expected input is Latin-script
> business documents, and we never render — so accept degraded glyph mapping on
> exotic scripts, add it to `warnings`, and say so in a code comment. **Verify
> in devtools with the network tab open on a CJK PDF and on a PDF with embedded
> fonts** — this is the P6 zero-network guarantee, and a default-config pdfjs
> breaks it only on documents that happen to need those assets.

> **Trap — the build that ships and the build that tests differ.** pdfjs's
> standard ESM export and its `pdfjs-dist/legacy` build behave differently under
> Vite/browser vs. Vitest, where `DOMMatrix`/`Path2D` can be missing even in a
> DOM environment. Confirm which entry `getTextContent()` actually needs on each
> side before settling on an import path, and do not let the test environment's
> requirement leak into what ships to the browser.

### [ ] P8d — `.odt` (jszip + DOMParser)

> Add `src/lib/parsers/odt.ts`. Unzip with jszip, read `content.xml`, parse with
> the native `DOMParser` (this is why the file lives in `src/lib/`), and walk
> `text:h` / `text:p` / `text:list` into Markdown, mapping `text:h`'s
> `text:outline-level` to heading depth and `table:table` to Markdown tables.
> Return `format: 'odt'`. Warn on embedded objects and images that are dropped.
> Write tests first: heading levels, nested lists, and a table survive; a
> document with a tracked-change or annotation node does not leak the reviewer's
> name into the output silently — either include it or warn that it was dropped,
> but decide and test it, because unreviewed metadata is a privacy leak in a
> tool whose whole job is privacy.

> **Trap — ODF metadata is PII.** `meta.xml` carries author, initials, editing
> cycles and often a full name that never appears in the visible text. Decide
> explicitly whether to extract it (so the anonymizer can *see* it) or drop it,
> and state the choice in a code comment. The same question returns for `.docx`
> and `.pptx`; answering it here sets the precedent.

> **Trap — jszip is a shared dependency, not an odt one.** `.pptx` needs it too,
> and `.eml` may. Install it once here and keep the call shape
> (`JSZip.loadAsync(bytes)`) identical, so P8h can copy the pattern rather than
> re-derive it.

### [ ] P8e — `.csv` (no dependency)

> Add `src/lib/parsers/csv.ts` — a hand-rolled RFC 4180 reader (quoted fields,
> escaped `""`, embedded newlines and commas, `\r\n`), with delimiter sniffing
> for `,` / `;` / `\t`. Emit a Markdown table. Return `format: 'csv'`.
> No library: SheetJS is not worth pulling in for this. The parser is small
> enough to be *nearly* pure — put it in `src/lib/parsers/` anyway, for
> consistency with its siblings.
> Warn above a row threshold: a 50k-row CSV becomes an unusable Markdown table
> and a very slow detection pass.
> Write tests first: a quoted field containing the delimiter; an embedded
> newline inside quotes; the `""` escape; a semicolon-delimited European export;
> a ragged row with fewer cells than the header.

### [ ] P8f — `.xlsx` (SheetJS)

> Add `src/lib/parsers/xlsx.ts` using SheetJS, one Markdown table per sheet with
> the sheet name as a heading. Return `format: 'xlsx'`. Warn when formulas are
> flattened to values, and when sheet or row counts exceed a usable threshold.
> Reuse `csv.ts`'s Markdown-table emitter rather than writing a second one.
> Write tests first: a two-sheet workbook produces two headed tables; a date
> cell is not emitted as an Excel serial number; an empty sheet is skipped with
> a warning.

> **Trap — where SheetJS comes from.** The `xlsx` package on npm is stale and
> deprecated upstream; SheetJS distributes current builds from their own CDN.
> A CDN-sourced dependency is an install-time supply-chain decision, not a
> runtime network call, but it still needs a conscious choice: pin the npm
> version and accept it, or vendor the CDN build. Decide before installing and
> record which, the way P7d recorded the protobufjs advisory.

### [ ] P8g — `.eml` (letterparser / eml-parse-js)

> Add `src/lib/parsers/eml.ts`. Parse MIME, prefer the `text/plain` part; when
> only `text/html` exists, convert it with the shared `src/lib/htmlToMarkdown.ts`
> from P7f. Prepend a header block (From / To / Cc / Subject / Date) as
> Markdown — those headers are the densest PII in the file and must reach the
> detectors. Decode quoted-printable and base64 bodies and honour the declared
> charset. Return `format: 'eml'`. Warn listing attachment filenames, dropped.
> Write tests first: a quoted-printable body with accented Spanish decodes
> correctly; a multipart/alternative message prefers the plain part; headers
> appear in the output so `EMAIL`/`NAME` detection reaches them; a latin-1
> message does not produce mojibake.

### [ ] P8h — `.pptx` (jszip + DOMParser)

> Add `src/lib/parsers/pptx.ts`. Unzip, iterate `ppt/slides/slideN.xml` in
> **numeric** order (not lexicographic — `slide10` must not sort before
> `slide2`), extract `a:t` text runs grouped by shape, and emit one `## Slide N`
> section per slide. Include speaker notes from `ppt/notesSlides/` under a
> sub-heading. Return `format: 'pptx'`. Warn about dropped images and charts.
> Write tests first: slide order is numeric; text inside a table shape is
> extracted; speaker notes appear and are labelled; a deck with no notes parts
> does not throw.

### M3 fixtures

Binary fixtures are **generated, never committed as real documents** — the same
rule `src/core/__fixtures__/clinicalReport.ts` already states for the clinical
report. Each format session adds a small builder under
`src/lib/parsers/__fixtures__/` that constructs a minimal valid file in memory
(a hand-built OOXML/ODF zip via jszip for docx/odt/pptx; a hand-written minimal
uncompressed PDF byte string for pdf; a template literal for csv/eml), so the
suite stays dependency-light and every fixture's contents are readable in the
diff. Reuse the shapes from `CLINICAL_REPORT_FIXTURE` as the text payload
wherever a format needs prose, so a parser regression surfaces as a detection
regression in the same corpus.

### M3 verification

Development runs in Podman (`~/containers/anonymaizer/README.md`) and
`node_modules` is not installed on the host, so every command below runs
**inside the container**.

Per session: `npm test` (tests written first, per CLAUDE.md rule 5) and
`npm run lint`.

At P8a, additionally — this gates the whole milestone:

1. `npm run build`, then inspect `dist/`: confirm parser code is **not** inlined
   into `index.html`. The pass/fail signal is `dist/index.html`'s byte size
   before vs. after — record the baseline, and re-check it in every later format
   session, since a lazy split that silently regresses is invisible otherwise.
2. Open `dist-portable/index.html` (`npm run build:portable`) from a
   `file://` URL, paste text, complete a full
   sanitize/restore round trip with the network tab open — **zero requests**.
   Then import a `.txt` file and confirm the lazy path still resolves from
   `file://`.
3. Record the measured outcome here, in the style of P7d's "Build output
   caveat".

At P8c, additionally: import a CJK PDF and a PDF with embedded fonts from the
`file://` build with the network tab open — still zero requests.

At each format session: `npm run dev`, drop a real document of that format into
step 1, and confirm step 2 shows sanitized text with sensible placeholders and
that any warnings render.
