# Wizard layout/UX fixes (post-P7e) + placeholder format change + DNI fix

## Context

P7e shipped a 3-step wizard (Ingest/Review/Restore) replacing the old
3-column "one screen" layout. After trying it, the user reported several
concrete layout/UX problems, asked for the placeholder format itself to
change, and reported a detection bug:

1. Too much unused horizontal space. **Reviewed:** the real culprit is
   `src/index.css:53` — `#root { width: 1126px; margin: 0 auto; text-align:
   center; border-inline: …; min-height: 100svh }`. `.app`'s `max-width:
   1600px` never even binds. A descendant cannot override an ancestor's
   `width`, so `#root` must change too.
2. The step nav (currently a horizontal row above the per-step content)
   visually shifts position between steps because the page content
   reflows around it — it should be a fixed left sidebar instead.
3. The Review step's mapping/placeholder area feels cramped — panels need
   to fill available height, not sit at a small fixed min-height.
4. Rules editing is currently a slide-over drawer opened from Review. The
   user wants it promoted to its own sub-step ("2.1 Rules", informally),
   shown *before* the sanitized text/mapping list ("2.2"), not behind a
   drawer trigger.
5. The whole app should never trigger the browser's own page scrollbar —
   it should fill the viewport exactly, and each panel (textarea, table)
   scrolls internally within its own bounds instead.
6. In the sanitized-text panel, placeholder tokens (`[EMAIL_1]`, `[NAME_1]`,
   …) should render in a visually distinct color — today it's a plain
   unstyled `<textarea>`.
7. The Restore step's two panels should also go full-width/full-height,
   same treatment as Review, no browser scroll.
8. **Placeholder format change (superseding an earlier "leave as-is"
   answer):** the user has now explicitly asked for double brackets
   (`[[NAME_1]]`) **and** zero-padded counters up to 3 digits (`001`…`999`,
   e.g. `[[NAME_001]]`). This is a real, in-scope change, not a deferred
   backlog note.
9. Bug: the Spanish DNI detector misses dot-grouped forms like
   `76.123.312-E` and `76.123.312E` — only the compact `\d{8}[A-Za-z]`
   form is currently detected.

Already settled, not to relitigate:
- Highlighting keeps the existing "Copy sanitized text" button as the only
  copy path — no native browser select-and-copy needed on the highlighted
  view; the copy button still copies the plain `anonymizedText` string.

## Approach

### A. Placeholder format: `[[CATEGORY_001]]`

This is the one change that ripples across core + tests, so it's listed
first since everything else (highlighting regex, reversal) depends on it.

- **Minting** — the only two places a placeholder string is actually
  built:
  - `src/core/span.ts:73` — `` `[${span.category}_${count}]` `` becomes
    `` `[[${span.category}_${String(count).padStart(3, '0')}]]` ``.
  - `src/App.tsx` `handleSplit` (manual split path, ~line 112) — same
    template change, reusing the same padding.
  - `nextCounter` in `src/App.tsx` (~line 91) currently parses the trailing
    number via `m.id.slice(m.id.lastIndexOf('_') + 1)` — this reads the
    **id**, not the placeholder, so it's unaffected by padding (ids stay
    plain, e.g. `NAME_1`, no brackets/padding needed there — only the
    user-facing `placeholder` string changes). Confirm `MappingItem.id` is
    never parsed assuming a padded/bracketed shape elsewhere (grep for
    `.id.slice` / `.id.split('_')`).
- **Reversal** — `src/core/reverse.ts`:
  - Line 28's bracket-stripping `item.placeholder.replace(/[[\]]/g, '')`
    already strips *all* `[`/`]` characters regardless of how many appear
    consecutively (it's a character-class match, not a literal `[[`), so
    it needs **no change** for double brackets.
  - Line 30's regex `` `\[?\b${flexibleToken}\b\]?` `` currently makes a
    *single* optional bracket on each side. Change to `` `\[{0,2}\b${
    flexibleToken}\b\]{0,2}` `` so it still tolerantly restores whether the
    AI's reply comes back as `[[NAME_001]]`, `[NAME_001]`, or bare
    `NAME_001` (AI responses are lossy/inconsistent about markup — keep
    the existing tolerance, just widen it to 0–2 brackets instead of 0–1).
  - `tokenRaw` is taken directly from the real `item.placeholder`, which
    already contains the zero-padded digits (e.g. `NAME_001`), so the
    numeric matching is exact against what was actually minted — no
    separate padding-tolerance logic needed in reversal.
    **Reviewed — overruled.** Padding tolerance *is* needed: an AI reply that
    writes `[NAME_1]` instead of `[[NAME_001]]` must still restore, same
    rationale as the existing bracket/underscore/case tolerance. Split the
    trailing `_<digits>` off `tokenRaw`, strip its leading zeros, and build
    `` `\[{0,2}\b${escapedPrefix}[\s_]?0{0,2}${unpaddedDigits}\b\]{0,2}` ``.
    All four of `[[NAME_001]]`, `[NAME_001]`, `[NAME_1]`, `NAME_1` then
    restore — add a reverse test per shape.
    Note: the sort-by-`placeholder.length`-descending guard (so `NAME_1`
    can't eat `NAME_11`) becomes a no-op once every placeholder is the same
    length; it's the `0{0,2}` + `\b` anchoring that does the work now. Keep
    the sort, don't rely on it.
- **Apply** — `src/core/apply.ts` substitutes `item.placeholder` verbatim
  into the text; it does not construct or parse the bracket format itself,
  so no change needed there.
- **Highlighting regex** (see section E) must match the new double-bracket
  padded shape: `/(\[\[[A-Z][A-Z0-9_]*\]\])/g`.
- **Tests** — update every literal `[NAME_1]`/`[EMAIL_1]`/etc. string to the
  new `[[NAME_001]]`-style format. Mechanical, but do one pass per file and
  verify each suite still asserts the same *behavior*. **Reviewed — actual
  occurrence counts:**

  | File | Occurrences |
  |---|---|
  | `src/core/reverse.test.ts` | 15 |
  | `src/core/pipeline.test.ts` | 10 |
  | `src/core/apply.test.ts` | 9 |
  | `src/core/anonymize.test.ts` | 3 |
  | `src/core/span.test.ts` | 3 |
  | `src/core/fieldReport.test.ts` | 2 |
  | `src/core/types.ts` | 2 (comments, lines 14 and 45) |
  | `src/core/detectors.ts` | 1 (comment, line 203) |
  | `docs/spec.md` | ~18 lines |

  `entities.test.ts` and the `src/core/__fixtures__/` bench fixtures contain
  **none** — drop them from the sweep. `src/core/detectors.ts:203`
  (`"Colegiada [ID_CODE_1]"`) and `src/core/types.ts:45` (`-> [PROJECT_NAME_1]`)
  were missing from this list — add them. `src/core/reverse.ts:12`'s
  doc-comment also needs the new example format.
- **Spec doc** — `docs/spec.md` needs more than "update the example(s)":
  §5's documented reversal regex (line 279), the tolerance sentence (line
  174), the `[NAME_1]`/`[NAME_11]` sorting note (line 292) and every
  acceptance-test expectation (lines 300–324) all encode the old format.

### B. App shell: sidebar + full-height, no page scroll

- **`src/index.css` first (this is the blocker).** Change `#root` to
  `width: 100%; height: 100dvh; overflow: hidden; text-align: left;` and drop
  `border-inline` and `min-height: 100svh`. `body { margin: 0 }` already
  exists at line 64 — do **not** re-add it, and `html`/`body` need no
  `height` once `#root` carries `100dvh`.
- `.app` becomes a fixed-height flex **row**: `height: 100%; display:
  flex; flex-direction: row; overflow: hidden;` — drop the current
  `max-width`/`margin: 0 auto`/`min-height` entirely (fixes #1). `height:
  100%`, not `100dvh`: the viewport unit now lives on `#root`.
- **Edge gutter (~2%, per the user).** Put it on the inner boxes, never on
  `#root` — gutter on `#root` would inset the sidebar divider and stop the
  scroll regions reaching the viewport edge. `%`/`vh` rather than fixed px so
  the proportion holds on small and ultrawide screens alike. Both boxes need
  `box-sizing: border-box` so the padding doesn't add to the flex heights
  section C depends on (check for a global `box-sizing` rule first).
- New `.app-sidebar`: `flex: 0 0 220px; display: flex; flex-direction:
  column; padding: 2vh 1.2% 2vh 2%; box-sizing: border-box; border-right: 1px
  solid var(--border); overflow-y: auto;` — holds the `<h1>`/tagline (moved
  here from the top of `.app`, since "maximize sub-windows" means `.app-main`
  should be pure content) plus `<StepNav>`.
  **Reviewed:** `src/index.css:73` sets `h1 { font-size: 56px; margin: 32px 0 }`
  globally — unusable in a narrow sidebar. Add
  `.app-sidebar h1 { font-size: 1.1rem; margin: 0 0 4px; letter-spacing: 0; }`
  and shrink or drop the tagline `<p>` there.
- New `.app-main`: `flex: 1; min-width: 0; display: flex; flex-direction:
  column; padding: 2vh 2% 2vh 1.5%; box-sizing: border-box; overflow: hidden;
  min-height: 0;` — holds
  the per-step content. Structurally outside any per-step conditional
  reflow, which is what actually fixes #2 (the sidebar never changes
  shape when `step` changes).
- `src/App.tsx`: wrap the header + `<StepNav>` in `<aside
  className="app-sidebar">`, and the step-conditional content in `<main
  className="app-main">`.
- `.step-nav` CSS: `flex-direction: column; gap: 4px;` (was `row`), buttons
  full-width/left-aligned — fixes the "always on the left" ask structurally
  via B's shell, and visually via this column orientation.

### C. Internal scroll, panels fill height (fixes #3, #5, #7)

The classic nested-flex/grid scroll trap: every ancestor in the chain
needs `min-height: 0` (flex/grid children default to `min-height: auto`,
which prevents shrinking below content size — this is what causes a
"maximized" panel to instead grow the whole page and push a scrollbar onto
`body` even when a parent has `overflow: hidden`).

- `.split`: add `min-height: 0; flex: 1; overflow: hidden;` alongside the
  existing grid columns.
- `.panel`: add `min-height: 0; overflow: hidden;` (currently just
  `flex: 1`, no height constraint).
- `.panel-textarea`: change from `min-height: 320px; resize: vertical;` to
  `flex: 1; min-height: 0;` — remove the manual resize handle since
  "maximized, self-contained scroll" replaces manual resizing as the
  interaction model. A `<textarea>` already scrolls its own overflow
  internally once height-constrained, so no extra `overflow` property
  needed there.
- New `.sanitized-highlight` (the highlighted-text container replacing the
  textarea in `SanitizedTextPanel`, see E) and the rules table / mapping
  table wrappers get the same `flex: 1; min-height: 0; overflow-y: auto;`
  treatment so they scroll internally instead of growing the page.
- `ReversalPanel.tsx` needs no structural change — it already uses
  `.split`/`.panel`/`.panel-textarea`, so B+C's CSS changes make it
  full-height/no-scroll for free (fixes #7).

### D. Review step becomes two sub-steps (2.1 Rules, 2.2 Sanitized text)

- Delete `src/components/RulesDrawer.tsx` and its backdrop/close/
  Escape-to-close logic entirely — no longer needed once Rules is a full
  sub-step rather than a drawer.
- `src/components/ReviewStep.tsx`: add local state
  `useState<'rules' | 'sanitized'>('rules')` (starts on Rules, per the
  user's explicit ordering ask). Render a small inline sub-nav (two
  buttons, "2.1 Rules" / "2.2 Sanitized text", visually distinct from but
  consistent with `StepNav`'s styling) above the content. When on
  `'rules'`, render `<RulesEditor>` directly (no drawer chrome) sized to
  fill `.app-main` per section C; when on `'sanitized'`, render the
  existing `.split` grid (`<SanitizedTextPanel>` + `<MappingList>`).
  **Reviewed:** `.split` is currently `ReviewStep`'s *outer* element (with
  `<RulesDrawer>` nested inside it) — it must move **inside** the
  `'sanitized'` branch, not stay as the wrapper.
- `NerToggle` (currently rendered by `App.tsx` above `ReviewStep`) stays
  above the sub-nav, visible on both sub-steps — it's a detection-affecting
  toggle relevant to both rules and the mapping list, not just one.
- `src/App.tsx`: drop the drawer-open boolean plumbing; `ReviewStep` keeps
  the same external props (`dictionaryRules`, `onRulesChange`, mappings,
  handlers) but owns the sub-step toggle internally — no new prop needed
  from `App.tsx`.
- This sub-step is ephemeral UI state, not persisted to `localStorage` —
  `lib/session.ts`'s `WizardStep` type/`STEP_KEY` stay untouched; widening
  that contract for what's essentially a tab isn't warranted.

### E. Placeholder highlighting in sanitized text (fixes #6)

- New helper in `src/components/MappingPanels.tsx` (colocated since it's
  only used by `SanitizedTextPanel`, no need for a separate file): a pure
  function `renderHighlighted(text: string): ReactNode[]` that does
  `text.split(/(\[\[[A-Z][A-Z0-9_]*\]\])/g)` (matches the new
  double-bracket padded shape from section A) and maps odd-indexed
  segments to `<mark className="sanitized-placeholder" key={i}>{seg}
  </mark>`, even-indexed to plain text (React auto-escapes text-node
  children — no `dangerouslySetInnerHTML`, no manual HTML-escaping needed;
  this is what makes it safe).
- `SanitizedTextPanel` swaps `<textarea readOnly value={anonymizedText}
  />` for `<div className="panel-textarea sanitized-highlight">
  {renderHighlighted(anonymizedText)}</div>`. The "Copy sanitized text"
  button's `onClick` is unchanged — it already copies the raw
  `anonymizedText` string via `navigator.clipboard.writeText`, not DOM
  content, so copy behavior is unaffected by the textarea→div swap.
- CSS: `.sanitized-highlight { white-space: pre-wrap; word-break:
  break-word; border: 1px solid var(--border); border-radius: 6px; padding:
  8px; font-family: inherit; font-size: 0.9rem; }` (replicating the
  textarea's visual box now that it's a div) and `.sanitized-placeholder {
  background: var(--accent-bg); color: var(--accent); border-radius: 3px;
  padding: 0 2px; }`.
  **Reviewed — "no dark mode exists yet" is wrong.** `src/index.css` has a
  full `@media (prefers-color-scheme: dark)` block redefining `--text`,
  `--text-h`, `--bg`, `--border`, `--accent`, `--accent-bg`. Use those
  tokens (or declare a `--highlight-bg` in *both* `:root` blocks) — never a
  bare hex, which would be unreadable in dark mode.

### F. DNI dotted-form fix

- `src/core/detectors.ts` `DNI_REGEX` (currently
  `/\b\d{8}[A-Za-z]\b/g`): widen to
  `/\b\d{2}\.?\d{3}\.?\d{3}-?[A-Za-z]\b/g` — matches plain `12345678Z`,
  dotted `76.123.312E`, and dotted-plus-dash `76.123.312-E`.
- `src/core/validators.ts` `dniNieCheck` line 34: extend
  `value.replace(/[\s-]/g, '')` to `value.replace(/[\s.-]/g, '')` so dotted
  forms normalize correctly before the existing checksum check — no other
  change needed there.
- `src/core/detectors.test.ts`: **Reviewed —** `76123312 % 23` → `M`, so the
  reported sample `76.123.312-E` is *not* checksum-valid and will still be
  rejected by `dniNieCheck` after the regex widens. The user confirmed it was
  fabricated test data and that strict checksum validation stays. Therefore:
  - positive: `76.123.312-M` and `76.123.312M`;
  - negative: `76.123.312-E`, with a comment recording that a
    checksum-invalid grouped DNI is intentionally not detected;
  - unchanged: the plain ungrouped `12345678Z` form still passes.
- One arbitration case worth locking in with a pipeline-level test:
  `PHONE_REGEX` (`src/core/detectors.ts:36`) also matches `76.123.312`, at
  the same `RUNG.VALIDATED_REGEX`. The DNI span is longer (12 vs 10 chars) so
  longest-wins arbitration picks DNI — not obvious from either regex, so
  assert it.

## Files to change (dependency order)

0. `src/index.css` — `#root` full-bleed (blocks all of section B).
1. `src/core/span.ts` — double-bracket, zero-padded placeholder minting.
2. `src/App.tsx` `handleSplit` — same placeholder template change; later, shell markup (aside/main wrap).
3. `src/core/reverse.ts` — 0–2 brackets **and** leading-zero tolerance in the restore regex; update doc-comment example.
4. `src/core/types.ts` — doc-comment examples at lines 14 *and* 45.
5. `docs/spec.md` — placeholder format across ~18 lines, incl. §5's regex (279), tolerance note (174), sorting note (292), acceptance tests (300–324).
6. `src/core/*.test.ts` (reverse, pipeline, apply, anonymize, span, fieldReport) — update literal placeholder strings; add the four bracket/padding restore shapes. Not entities.test.ts, not `__fixtures__/`.
7. `src/core/validators.ts` — strip `.` in `dniNieCheck` normalization.
8. `src/core/detectors.ts` — widen `DNI_REGEX` for dot-grouping.
9. `src/core/detectors.test.ts` — new DNI dotted-form test cases.
10. `src/components/MappingPanels.tsx` — `renderHighlighted` helper; `SanitizedTextPanel` swaps textarea for highlighted div.
11. `src/components/ReviewStep.tsx` — sub-step toggle (Rules/Sanitized), drop drawer usage.
12. `src/components/RulesDrawer.tsx` — delete.
13. `src/components/StepNav.tsx` — verify against new vertical/sidebar CSS (likely no code change, class-driven only).
14. `src/App.css` — sidebar shell + 2% gutter, sidebar `h1` override, vertical step-nav, internal-scroll `min-height:0` fixes, sub-nav, `.sanitized-highlight`/`.sanitized-placeholder` using the `index.css` tokens; remove `.drawer-backdrop`, `.drawer`, `.drawer-close`, `.edit-rules-button`.

## Verification

- `podman exec anonymaizer-5173-dev npx tsc -b` — type check.
- `podman exec anonymaizer-5173-dev npm run test` — full Vitest suite,
  including updated placeholder-format literals and new DNI dotted-form
  cases.
- `podman exec anonymaizer-5173-dev npm run lint` — oxlint clean.
- Manual check at `http://localhost:5173`: confirm no page-level scrollbar
  at normal viewport sizes, sidebar stays fixed switching steps, Review
  opens on the Rules sub-step first, sanitized text shows
  `[[CATEGORY_001]]`-style placeholders with a colored highlight, pasting a
  restore response as any of `[[NAME_001]]` / `[NAME_001]` / `[NAME_1]` /
  `NAME_1` still restores correctly, Restore panels fill the viewport
  width/height, and the ~2% edge gutter reads right on both a laptop and a
  wide screen. Check the highlight colors in **both** OS light and dark mode.
