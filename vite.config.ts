import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// Two production builds, because one output cannot keep both promises
// (measured in P8a — see docs/plans/m3-parsers.md):
//
//   npm run build           → dist/, code-split. The M3 document parsers
//                             load on demand, so a paste-only user never
//                             downloads mammoth/pdfjs/SheetJS. For serving
//                             over http(s), including the PWA.
//   npm run build:portable  → dist-portable/, everything inlined into one
//                             index.html. Chromium refuses a dynamic
//                             import() from a file:// page (CORS, origin
//                             `null`), so the portable build has to carry
//                             its parsers inline or lose file import
//                             entirely.
//
// manifest.webmanifest and sw.js stay separate static files (see public/)
// in both; that's orthogonal to bundle inlining. The NER worker also stays
// a separate file in both — the P7d "single-file for everything except the
// opt-in model" caveat is unchanged.
const portable = process.env.ANONYMAIZER_PORTABLE === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(
      portable
        ? {}
        : {
            // `useRecommendedBuildConfig` (the default, and what the
            // portable build wants) sets rollup's `codeSplitting: false` on
            // Vite 8, which inlines every dynamic import back into
            // index.html. For the hosted build we opt out and apply the
            // rest of its recommended settings ourselves (see `build`).
            // Note rollup rejects `manualChunks` together with
            // `inlineDynamicImports`, so that pairing is not an option.
            useRecommendedBuildConfig: false,
            // Root-level `*` does not cross a `/`, so the entry JS and the
            // single CSS file get inlined while everything under chunks/ is
            // left beside index.html.
            inlinePattern: ['*.js', '*.css'],
          },
    ),
  ],
  build: portable
    ? { outDir: 'dist-portable' }
    : {
        // The settings viteSingleFile's recommended config would have set,
        // minus the code-splitting kill switch.
        assetsInlineLimit: () => true,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        assetsDir: '',
        rollupOptions: {
          output: {
            // Keeps lazy parser chunks out of the root glob above.
            chunkFileNames: 'chunks/[name]-[hash].js',
          },
        },
      },
  // Relative, so index.html and its siblings resolve from a file:// origin
  // as well as from a served path. (The portable build's recommended config
  // sets this too; the hosted one needs it stated.)
  base: './',
  resolve: {
    // onnxruntime-web 1.31's default browser entry embeds its ~54MB of
    // .wasm runtimes via `new URL(...)`, which viteSingleFile happily
    // base64-inlines — that turned the NER worker into a 72MB file. This
    // export condition selects ort's external-wasm build instead, so the
    // runtime is fetched at NER opt-in time like it was under
    // @xenova/transformers v2. See wasmPaths in src/workers/ner.worker.ts.
    conditions: ['onnxruntime-web-use-extern-wasm', 'module', 'browser', 'import', 'default'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Bind to all interfaces so the dev server is reachable from outside the
    // Podman container (see ~/containers/anonymaizer/).
    host: true,
    port: 5173,
    watch: {
      // Bind-mounted source: inotify events don't cross the mount reliably.
      usePolling: true,
    },
  },
})
