import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: vitest ships its own nested
// copy of Vite, and merging its `test` key into the rolldown-based Vite 8
// config makes `tsc -b` fail on incompatible Plugin types.
//
// Two projects rather than one environment, and the split is deliberate
// enforcement, not convenience (M3/P8a): src/core/ is pure TypeScript with
// no DOM (CLAUDE.md rule 4), so it runs on `node` and a stray `document`
// keeps failing there. The concrete parsers in src/lib/parsers/ use
// DOMParser by design (.odt/.pptx/.eml), so only they get happy-dom.
// Widening core to a DOM environment would silently retire rule 4 — don't.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'src/lib/parsers/**'],
        },
      },
      {
        test: {
          name: 'parsers-dom',
          environment: 'happy-dom',
          include: ['src/lib/parsers/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
})
