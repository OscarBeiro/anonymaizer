# AnonymAIzer

Client-side text anonymization & reversal tool. Vite + React + TypeScript + Vitest.

The development plan lives at `docs/plans/anonymaizer-plan.md` — one `P` block
per session, in order. Tick the box when the session is done and its tests pass.

## Hard rules

1. **All logic runs client-side.** There is no backend and there never will be.
2. **No network calls at runtime.** Not for telemetry, fonts, analytics or model
   downloads (the M2 NER model is the one planned exception, and it must be
   opt-in and cached locally).
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
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

Development runs in Podman — see `~/containers/anonymaizer/README.md`.
