# AnonymAIzer — Prompt Plan

Client-side text anonymization & reversal tool. Zero backend, zero egress.

**How to use these files:** this file is the index and the cross-cutting
material. The `P` blocks live in one file per milestone, listed below — each `P`
block is one prompt to paste into Claude Code, one per session, in order. Tick
the box when the session is done and tests pass. **Read this file plus your
milestone's file**, not the milestone alone: the spec traps and backlog here
have already settled questions a session would otherwise re-decide.
`P8` is repeated once per file format — never batch them.
`P1` is split into `P1a` and `P1b`: the name/company heuristics get their own
session, because that is where the iteration happens.

| Milestone | File | Status |
| --- | --- | --- |
| M1 — "Paste & Revert" PoC | [`m1-poc.md`](m1-poc.md) | done |
| M2 — Detection quality, then local NLP | [`m2-detection-ner.md`](m2-detection-ner.md) | done |
| M3 — Document parsers | [`m3-parsers.md`](m3-parsers.md) | done |
| M4a — Export & detection control | [`m4a-export-control.md`](m4a-export-control.md) | done |
| M4b — Pseudonymization & localization | [`m4b-pseudonym-i18n.md`](m4b-pseudonym-i18n.md) | in progress (P12 done) |
| M5 — Polish & public beta | [`m5-polish-beta.md`](m5-polish-beta.md) | planned, not started |

M4 is split in two: **M4a** is dependency-free user-visible output and control
(export, category toggles); **M4b** is the one-way realistic-output mode and the
i18n/Localazy work, which comes last on purpose so the string extraction happens
once, after everything that adds strings. The `P` numbering runs `P9`–`P11` in
M4a and `P12`–`P15` in M4b; the earlier single-file draft numbered i18n `P9`/`P10`
and that numbering is superseded. M5 continues at `P16`–`P22`.

**M5 amends hard rule 2.** The milestone adds a public landing page and
consent-gated analytics on the hosted deployment, so "no network calls at
runtime" stops being absolute for the hosted build — and becomes *more*
explicit for every local one. `P21` carries the exact replacement wording and
changes `CLAUDE.md` itself; until it runs, hard rule 2 stands as written.

One-off task docs that are not milestones keep their own numbered files:
[`01-wizard-layout-fixes.md`](01-wizard-layout-fixes.md),
[`02-name-line-start.md`](02-name-line-start.md) (a detection leak found during
M3 and fixed out of band — names at the start of a line were never masked) and
**[`03-detection-backlog.md`](03-detection-backlog.md)** — four open detection
bugs left after M3, `D1`–`D4`, one block per session like a milestone file.
Three of the four were found by *using* the parsers, not by testing them.
`D5`–`D6` (acronym and lone-initial false positives) were added 2026-09-26.
[`04-wizard-next.md`](04-wizard-next.md) — `W1`, Back/Next buttons for the
wizard, and `W2`, compact live stats in the sidebar, both found in the same
round of manual testing.

**The spec lives at `docs/spec.md`.** Where a prompt says "§3 of the spec" or
"the §6 Spanish test bench case", read that section from `docs/spec.md`.

**Stack:** Vite + React + TypeScript + Vitest.
Vite is a build tool, not a framework — right default for a zero-backend SPA.
Next.js assumes a server; plain esbuild means wiring everything yourself.

---

## Three spec traps

The first two are still live in `docs/spec.md` §5 — fix them in the prompts, not
later. The third has already been corrected in the spec (§4a); it is recorded
here because §5's wording still reads as though it applied to anonymization.

1. **Reversal regex underscore bug.** The spec's
   `tokenRaw.replace('_', '[\\s_]?')` replaces only the *first* underscore, so
   `PROJECT_NAME_1` breaks. Needs `replaceAll` plus escaping of regex-special
   characters in the token.

2. **Sort key on reversal.** Reversal must sort by **placeholder** length
   descending, so `[NAME_1]` never eats `[NAME_11]`.

3. **Length-descending sort is the wrong mechanism for anonymization.**
   *(Resolved in spec §4a.)* With the
   M1 detection range, `NAME` fires inside `ADDRESS` and inside `COMPANY`, and no
   sort order resolves that — one detector must lose the span outright.
   Anonymization is span-based and offset-driven; see §4a of the spec. Sorting by
   `originalText.length` survives only in the reversal path (§5 / P3).

---

## Backlog (post-MVP)

Not in scope for M1. Recorded here so they aren't lost.

- **Dictionary rule case-insensitivity.** `CustomDictionaryRule` matching is
  case-sensitive in P2. A per-rule case-insensitive toggle is a natural
  follow-up.
- **Accent/diacritic-insensitive dictionary matching.** Normalize both the
  rule term and candidate text (e.g. á/ä/â → a) before comparison, so a rule
  written without accents still catches accented occurrences and vice versa.
  Needs a decision on Unicode normalization (NFD strip-combining-marks vs. a
  manual map) before implementation.
- **Per-language/country NAME_STOPWORDS packs, with a language setup step.**
  The stopword list (greetings, sign-offs, days/months) currently hardcodes
  ES + EN ad hoc, growing one word at a time as bugs surface (e.g. "Dear"
  had to be added after it swallowed a name into a bogus match). That
  doesn't scale — Portuguese alone needs separate PT-PT and PT-BR lists
  (different greeting conventions), and every added language is more surface
  for the same class of false positive/negative. Proposed shape: split
  `NAME_STOPWORDS` into per-language modules, let the user pick which
  language packs are active (a setup/settings step, not autodetection), and
  keep the list open to community contribution (a lang pack is just a data
  file, not a code change). Needs a decision on how language selection
  interacts with detection (one active pack vs. several simultaneously) and
  where the data lives (bundled vs. user-editable/importable, similar to
  custom dictionary rules).

  Genuinely ambiguous cases complicate this further: "June", "May" and
  Spanish "Amparo"/"Paz"/"Alba"/"Mercedes" are common given names *and*
  calendar/common words — the stopword approach is precision-first by
  design (§4a), so blanket-listing them trades a name false-positive for a
  guaranteed miss on anyone actually named June. A stopword pack alone
  can't resolve this; it needs either context (M2's NER model, which this
  is explicitly a stopgap for) or a narrower rule than "reject the whole
  word" — e.g. only treat "June"/"May" as the month sense when followed by
  a day/year number, leaving the bare capitalized word available to NAME.

- **Simplified wildcard syntax for custom dictionary rules, default mode
  (M4?).** Full regex is the current `isRegex` option, but the target user
  is office staff, not engineers — raw regex is the wrong default surface.
  Proposed: a glob-like mini-syntax as the default (non-regex) rule type,
  e.g. `TG-*` (matches everything after `TG-` up to the next whitespace)
  and `TG-??` (matches exactly two characters after `TG-`). This compiles
  down to a real regex internally — `*` → `\S*`, `?` → `\S` — so it's a thin
  UI/parsing layer over the existing `isRegex` path, not a new detection
  engine. Full regex stays available as an "advanced mode" toggle next to
  it (`RulesEditor.tsx`'s existing `isRegex` checkbox), not removed.

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
