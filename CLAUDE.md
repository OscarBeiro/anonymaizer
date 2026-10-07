# AnonymAIzer

Client-side text anonymization & reversal tool. Vite + React + TypeScript + Vitest.

The development plan lives in `docs/plans/`: `anonymaizer-plan.md` is the index
and the cross-cutting material, with one file per open milestone beside it
(`m6-language-packs.md`, …). Finished milestones and one-off task plans are
archived in `docs/plans/done/`. Read the index *and* your milestone's
file — one `P` block per session, in order. Tick the box when the session is
done and its tests pass.

## Hard rules

1. **All logic runs client-side.** There is no backend and there never will be.
2. **No network calls at runtime from the anonymization tool itself.** The two
   exceptions are the opt-in M2 NER model download (cached locally) and, on the
   public hosted deployment only, consent-gated analytics. Any
   locally-installed copy — the portable build, a `file://` page, localhost, or
   any self-hosted origin — makes no network call of any kind, ever. (Amended
   by M5 `P21`; both gates live in `src/lib/analytics.ts#isPublicDeployment()`.)
3. **No dependency may make a network request.** Check this before adding one.
4. **`src/core/` is pure TypeScript.** No React imports, no DOM APIs, no
   `window`/`document`/`fetch`. This rule is what makes the later Capacitor
   mobile build possible — do not let it slip.
5. **Every core module ships with tests.** `src/core/foo.ts` has
   `src/core/foo.test.ts`. Write the tests first where the plan says to.

## Layout

- `src/core/` — pure logic: types, detection, dictionary, anonymize, reverse.
- `src/core/parsers/` — per-format document parsers (Milestone 3), one file each.
- `src/workers/` — Web Workers (Milestone 2 NER).
- `src/` (rest) — React UI. State in React, session persisted to localStorage.

## Commands

```
npm run dev      # dev server on :5173
npm test         # vitest, single run
npm run build    # tsc -b && vite build -> dist/, code-split (http/PWA)
npm run build:portable  # -> dist-portable/, one inlined index.html (file://)
npm run lint     # oxlint
```

Development runs in Podman — see `~/containers/anonymaizer/README.md`.
