// Test substitute for ../pdfWorkerSrc.ts, wired up in vitest.config.ts.
//
// Under Vitest the real module's `new URL(..., import.meta.url)` resolves to
// an `http://` module specifier that Node's ESM loader refuses to import, and
// pdfjs fails hard with "Setting up fake worker failed". pdfjs's `legacy`
// build — which is what the test config resolves `pdfjs-dist` to — runs the
// worker on the main thread when no `workerSrc` is set, so leaving it
// undefined is both what works here and what the parser's
// `if (PDF_WORKER_SRC)` guard is for.
export const PDF_WORKER_SRC: string | undefined = undefined;
