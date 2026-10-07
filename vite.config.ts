import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pkg from './package.json' with { type: 'json' }

// Two production builds, because one output cannot keep both promises
// (measured in P8a/P8b — see docs/plans/done/m3-parsers.md):
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
    const paths = ['/', '/app', '/about', '/privacy', '/cookies', '/terms']
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

// P21b: stamp dist/sw.js's CACHE_NAME with the version and a hash of the
// emitted file names — a rebuild with no change keeps the cache; any change to
// the bundle, or a version bump, produces a new one — and give it the list of
// chunks to precache: the entry plus the three lazy routes (wizard, landing,
// legal) and everything they statically import, with their CSS. Without it an
// installed PWA opened offline at /app finds no wizard chunk, since P19 made
// it lazy. Parser and NER chunks stay fetch-on-first-use, as before.
const ROUTE_CHUNKS = /\/src\/(App|landing\/Landing|landing\/LegalPage)\.tsx$/
const swVersion = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'anonymaizer-sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((f) => f.type === 'chunk')
      const byName = new Map(chunks.map((c) => [c.fileName, c]))
      const keep = new Set<string>()
      const visit = (fileName: string) => {
        const chunk = byName.get(fileName)
        if (!chunk || keep.has(fileName)) return
        keep.add(fileName)
        chunk.viteMetadata?.importedCss.forEach((css) => keep.add(css))
        chunk.imports.forEach(visit)
        chunk.dynamicImports.filter((d) => ROUTE_CHUNKS.test(byName.get(d)?.facadeModuleId ?? '')).forEach(visit)
      }
      chunks.filter((c) => c.isEntry).forEach((c) => visit(c.fileName))
      const precache = [...keep].sort().map((f) => `/${f}`)

      const file = join(outDir, 'sw.js')
      const hash = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 8)
      writeFileSync(
        file,
        readFileSync(file, 'utf8')
          .replace('__SW_VERSION__', `${pkg.version}-${hash}`)
          .replace("'__PRECACHE__'", JSON.stringify(precache).slice(1, -1)),
      )
    },
  }
}

// P22: dist/_headers for Cloudflare Pages, generated rather than static so the
// CSP can carry the hash of index.html's inline theme script (P17) — no
// 'unsafe-inline' for scripts — and so the analytics hosts are allowed only in
// a build flagged for analytics (P21): a preview deploy's CSP forbids them.
const NER_HOSTS = ['https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co', 'https://cdn.jsdelivr.net']
const ANALYTICS_HOSTS = {
  script: ['https://www.googletagmanager.com', 'https://tracker.metricool.com'],
  connect: [
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://tracker.metricool.com',
  ],
  img: ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://tracker.metricool.com'],
}
const headersFile = (withAnalytics: boolean): Plugin => {
  let outDir = 'dist'
  return {
    name: 'anonymaizer-headers',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
      )
      const a = withAnalytics ? ANALYTICS_HOSTS : { script: [], connect: [], img: [] }
      const csp = [
        "default-src 'self'",
        // wasm-unsafe-eval + jsDelivr: the opt-in NER worker's onnxruntime.
        ['script-src', "'self'", "'wasm-unsafe-eval'", ...hashes, 'https://cdn.jsdelivr.net', ...a.script].join(' '),
        ['connect-src', "'self'", ...NER_HOSTS, ...a.connect].join(' '),
        ['img-src', "'self'", 'data:', 'blob:', ...a.img].join(' '),
        // React renders a few style attributes; styles cannot run code.
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
      const noCache = ['/', '/index.html', '/app', '/about', '/privacy', '/cookies', '/terms', '/sw.js', '/manifest.webmanifest']
      writeFileSync(
        join(outDir, '_headers'),
        [
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
          '',
          // Hashed names never change content.
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          // Must revalidate, or the CDN undoes the service-worker update path (P21b).
          ...noCache.flatMap((p) => [p, '  Cache-Control: no-cache', '']),
        ].join('\n'),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(portable ? [viteSingleFile()] : [seoFiles(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_ORIGIN), swVersion(), headersFile(analytics)]),
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
