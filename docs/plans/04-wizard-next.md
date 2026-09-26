# 04 — Wizard navigation: Back/Next buttons and sidebar stats

Found on 2026-09-26 while testing v0.4.1 by hand: the only way to move
between steps is the sidebar `StepNav`. Nothing on the page tells a new user
what to do after pasting text. This isn't P9 (P9 is "Save as…" export). Do it
after D5–D6 in [`03-detection-backlog.md`](03-detection-backlog.md), and before
P9.

The wider visual polish stays in M5 (`P16`–`P17`). Whether to move it ahead of
M4 is an open question for the user.

---

### [x] W1 — Back/Next footer on every step

- New component `src/components/StepFooter.tsx`, rendered by `App.tsx` below
  the active step: a secondary **Back** button and a primary **Next** button.
- Step order: Ingest → Review (sub-steps from `ReviewStep.tsx`: Rules →
  Placeholders → Sanitized → Statistics) → Restore. Next walks the Review
  sub-steps before it moves on to Restore, so the sub-step state has to be
  lifted from `ReviewStep` into `App` (or passed through a callback).
- Gating: reuse the `canReview` / `canRestore` conditions that `App.tsx`
  already passes to `StepNav`, extracted into one shared helper so the sidebar
  and the footer can't disagree. A disabled Next shows why (for example, "Paste
  or drop a document first").
- Ingest shows only Next. Restore shows only Back.
- Put the ordering logic in a pure helper (`nextStep` / `prevStep` in
  `src/lib/`) and test it there. That covers the logic without needing a
  component-testing setup.

> Write tests first: `nextStep`/`prevStep` over every step and sub-step,
> including the gated cases (no text → no Next from Ingest; no mappings → no
> Restore).

**Done 2026-09-26 (v0.4.7).**
- `src/lib/wizard.ts` holds the order (`nextPosition` / `prevPosition`), the
  gate (`canEnter`) and `REVIEW_SUB_STEPS`, tested in `wizard.test.ts`.
- `StepNav` now takes `gate` instead of `canReview`/`canRestore`.
- `ReviewStep`'s sub-step is lifted into `App`.
- Back from Restore lands on the last Review sub-step (Statistics).
- Restore's own internal "Restore →" flow (`ReversalPanel`) is untouched; the
  footer only shows Back there.
- The Review sub-step isn't persisted: a reload re-enters Review at Rules.
- Follow-up (v0.4.8, user request): on 2.3 Sanitized text, the footer's primary
  button is **Copy sanitized text**. Once the copy succeeds, it's replaced by
  "✓ Copied — your text is ready to send to the AI." and **Next: Statistics**.
  The footer stores the exact text copied, so if a later change edits the
  sanitized text, the Copy button returns. The panel's own copy button stays.
- Follow-up (v0.4.9, user request): Restore's 3.1/3.2 are now wizard positions
  (`RESTORE_SUB_STEPS` in `wizard.ts`), and their buttons have moved to the
  footer on the bottom right. On 3.1, Next reads **Restore →** and stays
  disabled until an AI response is pasted (`gate.hasAiResponse`). On 3.2, the
  footer shows **Copy restored text** (the same `CopyAction` pattern as 2.3),
  and there's no Next because it's the last position. The AI response and the
  sub-step are lifted into `App`, so the pasted response now survives a trip
  back to Review. It still isn't persisted across reloads.
- Follow-up (v0.4.10): 3.2's footer always offers **Start again →**. It's
  secondary until the restored text is copied, then primary. After a
  `window.confirm`, it clears the session (text, mappings, AI response, import
  warnings) and returns to Ingest. Custom rules and the cached NER model are
  kept. The confirmation says why it matters: without the mappings, that
  document's AI response can't be restored.

### Verification

`podman exec anonymaizer-5173-dev npm test`, plus `npm run lint` and
`npm run build`. Then in the browser (:5173): on an empty session, Next is
disabled and its hint is visible. Paste text and click Next all the way to
Restore, then click Back all the way to Ingest. Check that the sidebar
highlight follows at every step.

---

### [x] W2 — Compact stats in the sidebar

Requested 2026-09-26: below `StepNav`, the left column (`<aside
className="app-sidebar">` in `App.tsx`) is empty. Fill it with a live summary.
**This is in addition to** the detailed Statistics sub-step
(`StatisticsPanel`, `src/components/MappingPanels.tsx`), which stays as it is.

- New component `src/components/SidebarStats.tsx`, rendered under `StepNav`
  once `session.mappings.length > 0`. Before that it shows nothing, or a
  one-line hint.
- Contents: the total number of masked items (enabled mappings) and how many
  are unticked; one row per category with its count, using the same category
  colour as the placeholder highlighting; and the source file name and format
  when the session came from a file.
- Data: reuse `countByCategory` from `src/core/stats.ts`. If a new aggregate is
  needed (enabled vs disabled, for example), add it there with a test.
  `src/core/` stays pure (hard rule 4).
- Clicking a category row could jump to Review → Placeholders filtered to that
  category. That's nice to have; leave it out if the filter doesn't exist yet.
- On narrow screens, where the sidebar collapses, hide the block or turn it
  into a single summary line.

> Write tests first for any new function in `stats.ts` (enabled/disabled split,
> empty session).

**Done 2026-09-26 (v0.4.11).**
- `summarizeMappings` in `src/core/stats.ts` (enabled / disabled / per-category
  over enabled only), tested in `stats.test.ts`.
- `src/components/SidebarStats.tsx` under `StepNav`: file name + format badge
  (file sessions only), "N masked · M unticked", one row per category. Renders
  nothing while there are no mappings.
- There is no per-category colour yet: placeholder highlighting uses the one
  accent colour, so the category chips use it too. Per-category colours belong
  in the M5 design pass (P16).
- The sidebar never collapses today (fixed 220px, no breakpoint), so no narrow
  layout was added. Revisit with P16's shell work.
- Category-row click-to-filter left out: Placeholders has no category filter.

### Verification

In addition to W1's checks: with an empty session the sidebar shows no stats.
Paste text and the counts appear. Untick a mapping in Review and the sidebar
updates immediately and still matches the Statistics sub-step.
