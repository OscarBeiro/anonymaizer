import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// Two production builds, because one output cannot keep both promises
// (measured in P8a/P8b — see docs/plans/m3-parsers.md):
//
//   npm run build           → dist/, an ordinary code-split Vite build. The
//                             M3 document parsers load on demand, so a
//                             paste-only user never downloads mammoth,
//                             pdfjs or SheetJS. For serving over http(s),
//                             including the PWA.
//   npm run build:portable  → dist-portable/, one self-contained
//                             index.html. Chromium refuses a dynamic
//                             import() from a file:// page (CORS, origin
//                             `null`), so the portable build has to carry
//                             its parsers inline or lose file import
//                             entirely.
//
// Single-file and code splitting cannot be mixed, and not for the reason it
// first appears: with the entry inlined into index.html and then deleted
// from the bundle, a lazily-imported chunk is left importing a file that no
// longer exists (measured: `GET /index-<hash>.js` → 404). Keeping that file
// would be worse than the 404 — the chunk would pull in a *second* instance
// of the entry module graph, mounting the app twice and giving the parser
// registry two disconnected copies. So the hosted build simply does not use
// the plugin.
//
// manifest.webmanifest and sw.js stay separate static files (see public/)
// in both. The NER worker also stays a separate file in both — the P7d
// "single-file for everything except the opt-in model" caveat is unchanged.
const portable = process.env.ANONYMAIZER_PORTABLE === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(portable ? [viteSingleFile()] : [])],
  build: portable ? { outDir: 'dist-portable' } : {},
  // Relative, so the portable index.html and its siblings resolve from a
  // file:// origin, and so a hosted copy works from a subdirectory.
  // (viteSingleFile's recommended config sets this too; stating it keeps the
  // two builds' asset URLs identical in shape.)
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
