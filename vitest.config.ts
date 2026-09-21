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
        resolve: {
          // The M3/P8b instance of the "the build that ships and the build
          // that tests differ" trap. mammoth ships two zip readers and picks
          // between them through package.json's `browser` field: the Node one
          // takes `{path}`/`{buffer}`, the browser one takes `{arrayBuffer}` —
          // the only shape the pure src/core/parsers seam can hand it.
          // Confirmed by grepping the built chunk that `vite build` *does*
          // apply that mapping, so the parser's plain
          // `import mammoth from 'mammoth'` is right for the browser and
          // correctly typed. Vitest resolves the Node entry instead, and the
          // parser then throws on every document, so the alias belongs here —
          // in the test config only, never leaking into what ships.
          alias: {
            mammoth: 'mammoth/mammoth.browser.js',
            // Same trap, P8c's instance of it. pdfjs's default entry refuses
            // to run outside a browser ("Please use the `legacy` build in
            // Node.js environments") and its worker cannot be loaded from the
            // http:// module URL Vitest serves, so tests get the legacy build
            // plus a workerSrc stub that leaves pdfjs on the main thread. The
            // parser keeps importing plain 'pdfjs-dist' with a bundled worker,
            // which is what belongs in a browser.
            'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs',
            './pdfWorkerSrc': './__fixtures__/pdfWorkerSrc.node.ts',
          },
        },
      },
    ],
  },
})
