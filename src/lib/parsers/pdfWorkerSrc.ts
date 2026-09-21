// Where pdf.js loads its worker from, isolated in its own module so the test
// config can substitute it (see vitest.config.ts).
//
// Bundled deliberately, never a CDN URL: pdfjs's default is to resolve the
// worker by URL at runtime, which would be a silent breach of hard rules 2
// and 3. Vite rewrites this `new URL(..., import.meta.url)` at build time and
// emits the worker as an asset beside the bundle.
export const PDF_WORKER_SRC: string | undefined = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;
