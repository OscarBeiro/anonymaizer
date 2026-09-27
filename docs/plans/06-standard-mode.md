# 06 — Standard (quick) mode and Advanced mode

Planned 2026-09-27. The current wizard (Ingest → Review 2.1–2.3 → Restore) is
powerful but slow for the common case: "drop a document, get it anonymized".
Split the app into two modes:

- **Standard** — drop or paste a document and get the anonymized result, with
  copy/download. Nothing else on screen except one **Fine-tune** button, which
  opens the same session in Advanced mode.
- **Advanced** — today's wizard, unchanged.

Do this after [`05-large-documents.md`](05-large-documents.md) and before M6.
It is UI-only. `src/core/` does not change, and detection runs exactly as it
does now, with the current category settings and dictionary rules.

Settings stay in the existing P18 `SettingsMenu.tsx`. That menu already holds
Language (slot), Theme, Detection (category toggles, NER), Dictionary and
About (version, legal links, "Clear all local data").

---

### [x] S1 — Mode model and persistence

**Done 2026-09-27 (v0.16.0).** Two states in `App.tsx`: `defaultMode`
(persisted, set by the ingest buttons and Settings) and `viewMode` (what is on
screen). Fine-tune switches only the view, so one fine-tune does not make
Advanced the default. Advanced shows a "Quick view" header button to go back.
Standard always shows the placeholder rendering, so its output stays
restorable. S4 adds a "Delete downloaded AI model" button to Data & privacy;
the contextual one in the NER toggle stays.

- `type AppMode = 'standard' | 'advanced'` in `src/lib/session.ts`, stored
  under an `anonymaizer.` key so "Clear all local data" wipes it too. Default:
  `standard`.
- Pure helpers in `src/lib/wizard.ts`: which steps each mode shows, and the
  step Fine-tune jumps to (Review 2.1 Placeholders).
- Tests: the persistence round-trip, the default for a first visit, and a
  corrupt value falling back to `standard`.

### [x] S2 — Ingest offers Quick and Detailed

- `IngestStep.tsx`: after a document is dropped or pasted, show two buttons:
  **Quick** (Standard) and **Detailed** (Advanced). The last choice becomes the
  default and gets the primary style. Settings can change it too.
- Quick runs `runAnonymize` (plus NER if it's on) and shows the result view.
  Detailed goes into the wizard as it does today.

### [x] S3 — Standard result view + Fine-tune

- New `src/components/QuickResult.tsx`: the anonymized text, Copy, Download
  (reuse `SaveAsControl`/`download.ts`), **Fine-tune**, and **New document**.
- The sidebar step nav, stats and step footer are hidden in Standard mode.
- Fine-tune switches to Advanced mode on the same session (no rerun) and opens
  Review 2.1. A way back to the quick view stays visible.
- Restore stays reachable from Standard through a small "Restore AI output"
  link, since reversal is half of the tool's purpose.

### [x] S4 — Settings menu tidy-up

- Add **Default mode** (Standard / Advanced) under a new **General** section,
  with Language and Theme.
- Move "Clear all local data" and "Delete downloaded AI model" into a
  **Data & privacy** section. The NER opt-in stays in Detection.
- About keeps version, legal links and credits.
- Section order: General · Detection · Dictionary · Data & privacy · About.
  The existing `openSettings(section)` deep links keep working (update the
  `SettingsSection` union).

### [x] S5 — TICGAL branding: light theme colours + © footer

Added 2026-09-27. The light theme uses TICGAL's colours. The main blue is
**Azul `#658BC5`** (RGB 101, 139, 197).

- **Contrast constraint.** `#658BC5` on white is only 3.47:1. That fails WCAG
  AA for body text and for white text on a button. So:
  - `#658BC5` is the brand colour for large/decorative use: header bar or logo
    mark, borders, focus ring, `--color-accent-subtle` tints, and placeholder
    `<mark>` backgrounds.
  - Text, links and primary buttons use a darker shade from the same hue:
    `--color-accent: #3E64A3` (5.9:1), `--color-accent-hover: #355791`,
    `--color-accent-active: #2C4A7C`, with `--color-on-accent: #fff`.
  - `--color-accent-subtle: rgba(101, 139, 197, 0.12)` and
    `--color-accent-border: rgba(101, 139, 197, 0.5)`.
  - A neutral surface with a slight blue tint (e.g. `#F5F8FC`), so the page
    doesn't look pure white/grey next to the brand blue.
- Only the light-theme values change, in `src/styles/tokens.css` (`:root` and
  the matching light block). Give dark mode the same hue in a lighter tint
  (about `#8FB0E0`) instead of today's purple, so both themes read as one brand.
  Keep the two dark blocks identical, as the file's header comment requires.
  Check the landing page (`src/landing/landing.css`) for hardcoded purple.
- **Footer.** Add "© TICGAL 2026" linking to `https://tic.gal` to the app footer (`App.tsx`,
  `app-footer`) and the landing `SiteFooter.tsx`, and a line in the settings
  About section. Use `target="_blank" rel="noopener"`. It is a plain link, so
  nothing is fetched and hard rule 2 still holds, including on `file://`.
- Tests: a small contrast test over the token values (accent vs surface ≥ 4.5,
  on-accent vs accent ≥ 4.5) so a future palette edit can't regress AA.

## Open — decide after UX review

- **Quick summary in the Standard result.** S3 shipped with none, as
  requested. The candidate is one line above the text, e.g. "12 items masked —
  5 NAME · 3 DNI · 2 EMAIL" (`countByCategory` in `src/core/stats.ts`), maybe
  plus a warning when nothing was detected.
- **Let the user check the detections at a glance.** The purpose is to spot
  missed, wrong or partial detections without opening Fine-tune. The
  placeholder view alone can't show a miss, because unmasked text looks like
  ordinary text. Options:
  - an "Original / Anonymized" toggle, where the original shows each detected
    span highlighted in its category colour, with the placeholder on hover. A
    name left unhighlighted is then an obvious miss, and a highlight that
    covers "Juan García" but not "Pérez" is an obvious partial match;
  - summary chips per category that jump to and flash their spans;
  - from any highlight or selection: "not personal data" (disable that
    mapping) and "mask this" (the existing `handleCreateRule`), so small fixes
    don't need the full review.
  The spans are already available: every `MappingItem` has `variants`, and
  `applyEnabledMappings` knows the positions. Decide after testing the UX by
  hand.

## Verification

- `npm test` (the new `wizard`/`session` tests), `npm run lint`.
- By hand, in `npm run dev` and `build:portable` on `file://`: drop a PDF,
  choose Quick, get the result, download it; Fine-tune opens Review with the
  same mappings; a reload keeps the mode; Clear all local data resets it to
  Standard.
