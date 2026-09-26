import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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
// P21: analytics exist only in a build the deploy workflow flags, and never in
// the portable one. When false, src/lib/analyticsLoader.ts is not bundled.
const analytics = !portable && process.env.ANONYMAIZER_ANALYTICS === '1'

// P19: robots.txt and sitemap.xml for the hosted build, generated so they
// share VITE_SITE_ORIGIN (.env) with index.html instead of hardcoding it twice.
// The portable build is never crawled and gets neither.
const seoFiles = (origin: string): Plugin => ({
  name: 'anonymaizer-seo-files',
  apply: 'build',
  generateBundle() {
    const paths = ['/', '/app', '/privacy', '/cookies', '/terms']
    this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    })
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        paths.map((p) => `  <url><loc>${origin}${p}</loc></url>\n`).join('') +
        '</urlset>\n',
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(portable ? [viteSingleFile()] : [seoFiles(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_ORIGIN)]),
  ],
  build: portable ? { outDir: 'dist-portable' } : {},
  // P19: the base differs per build, and getting it wrong ships a white page.
  // Portable: relative, so index.html resolves its siblings from a file://
  // origin (viteSingleFile's recommended config sets this too) — and so the
  // portable build has no router at all (see src/Root.tsx), since file:// has
  // no server to rewrite /app or /privacy back to index.html.
  // Hosted: absolute, because the history router serves index.html at /app,
  // /privacy, … and a relative `./assets/x.js` would resolve to
  // `/app/assets/x.js` and 404. The hosted build therefore needs to live at
  // the domain root, not a subdirectory.
  base: portable ? './' : '/',
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
    __PORTABLE__: JSON.stringify(portable),
    __ANALYTICS_ENABLED__: JSON.stringify(analytics),
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
}))
