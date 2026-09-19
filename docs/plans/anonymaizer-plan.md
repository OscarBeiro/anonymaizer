# AnonymAIzer — Prompt Plan

Client-side text anonymization & reversal tool. Zero backend, zero egress.

**How to use this file:** each `P` block below is one prompt to paste into Claude Code,
one per session, in order. Tick the box when the session is done and tests pass.
`P8` is repeated once per file format — never batch them.

**Stack:** Vite + React + TypeScript + Vitest.
Vite is a build tool, not a framework — right default for a zero-backend SPA.
Next.js assumes a server; plain esbuild means wiring everything yourself.

---

## Two spec bugs — fix in the prompts, not later

1. **Reversal regex underscore bug.** The spec's
   `tokenRaw.replace('_', '[\\s_]?')` replaces only the *first* underscore, so
   `PROJECT_NAME_1` breaks. Needs `replaceAll` plus escaping of regex-special
   characters in the token.

2. **Sort key on reversal.** Length-descending by `originalText` is correct for
   *anonymization* (stops "Ana" matching inside "Análisis"). Reversal must sort by
   **placeholder** length descending, so `[NAME_1]` never eats `[NAME_11]`.

---

## Mobile

Path is Vite + React → **Capacitor**: same build wrapped in a native iOS/Android
shell. Same codebase, store distribution, native share sheet so text can be sent
into the tool from any app. Added later, no rewrite.

What makes that work is the `src/core/` rule in P0 — pure TypeScript, no React,
no DOM. That rule is the mobile insurance. Don't let it slip.

Constraints to plan around:
- **NER (M2)** is the problem, not the app. Quantized ONNX in WASM is tens of MB
  and slow on phones; iOS WKWebView memory limits will bite. Opt-in, desktop-first.
- **PDF parsing** via pdfjs is memory-heavy on mobile for large files.

React Native or Flutter would be a rewrite — mammoth, pdfjs and turndown are all
browser libraries. Not worth it.

---

# Milestone 1 — "Paste & Revert" PoC

### [ ] P0 — Scaffold + CLAUDE.md

> Create a Vite + React + TypeScript app called anonymaizer. Zero backend, no
> network calls at runtime. Add Vitest. Write a CLAUDE.md stating: all logic runs
> client-side; `src/core/` is pure TypeScript with no React or DOM imports; every
> core module ships with tests; no dependency may make a network request.

### [ ] P1 — Types + Tier 2 regex engine

> In `src/core/`, implement the `MappingItem`, `MappingSession` and
> `CustomDictionaryRule` types [paste §3 of the spec]. Then build
> `detectRegex(text)` returning `MappingItem[]` for EMAIL, PHONE (ES +
> international), ADDRESS (Rúa/Calle/Avenida/Street/Avenue/Rd + number + postal
> code), Spanish DNI/NIE, IBAN, credit card. Counters per category start at 1.
> Write tests first, including the §6 Spanish test bench case.

### [ ] P2 — Tier 1 dictionary + anonymizer

> Add `applyDictionary(text, rules)` supporting FIXED and CATEGORY replacement
> types, regex and literal terms. Then `anonymize(text, rules)` orchestrating
> dictionary → regex, dictionary always winning on overlap. Sort by
> `originalText.length` descending before substituting. Test that "Project Alpha"
> overrides auto-matching.

### [ ] P3 — Reversal engine

> Implement `reverseText(aiResponse, mappings)`. Escape regex metacharacters,
> replace *all* underscores with `[\s_]?`, sort by placeholder length descending.
> Tests: round-trip 100% restoration; `[NAME_1]` / `[NAME 1]` / `[Name_1]` / bare
> `NAME_1` all restore; `[NAME_1]` never eats `[NAME_11]`; "Ana" inside
> "Análisis" survives.

### [ ] P4 — UI

> Build the three panels: smart paste (clipboard `text/html` → Markdown via
> turndown, plain text passthrough), interactive mapping table with per-row enable
> toggles and a copy-sanitized-text button, and a reversal panel. State in React
> only, session persisted to localStorage. Keep it one screen, no router.

### [ ] P5 — Custom dictionary management

> Add a rules editor: create/edit/delete `CustomDictionaryRule`, regex toggle with
> live validation, persisted to localStorage, importable/exportable as JSON.

### [ ] P6 — Ship M1

> Add `vite-plugin-singlefile` and a PWA manifest + service worker so the build
> produces an offline single-file HTML. Verify with devtools that a full session
> makes zero network requests.

---

# Milestone 2 — Local NLP (separate session)

### [ ] P7 — NER worker

> Add `src/workers/ner.worker.ts` using @xenova/transformers with a quantized
> bert-base-NER ONNX model. Worker-only, lazy-loaded on user opt-in. Merge results
> into mappings with `source: 'ner'` and real confidence scores; flag anything
> under 0.8 in the table.

**Decide before starting P7:** the model is tens of MB and can't live inside a
single-file HTML bundle. Either the PWA caches it on first opt-in, or M2 ships as
a separate build target.

---

# Milestone 3 — Document parsers

One prompt per format, one session each. Template:

### [ ] P8 — `.docx` (mammoth.js)

> Add a `.docx` parser in `src/core/parsers/` using mammoth.js, exposing
> `parse(file): Promise<{markdown, format}>`. Do not touch other parsers or the UI
> beyond registering it.

Then repeat verbatim, swapping library and format:

- [ ] `.pdf` — pdfjs-dist (positional X/Y text reflow into Markdown)
- [ ] `.eml` — letterparser / eml-parse-js
- [ ] `.pptx` — jszip + native DOMParser XML processing
- [ ] `.xlsx` / `.csv` — xlsx (SheetJS)
- [ ] `.odt` — jszip + native DOMParser XML processing
