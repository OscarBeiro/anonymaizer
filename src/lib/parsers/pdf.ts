import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { ParsedDocument } from '../../core/parsers';
import { PDF_WORKER_SRC } from './pdfWorkerSrc';

// .pdf via pdfjs-dist (M3/P8c). Main thread, not a Web Worker of our own —
// pdfjs already runs its own worker (see pdfWorkerSrc.ts), and "heavy parsing
// ⇒ our own worker" is the wrong inference from ner.worker.ts.
//
// **Zero network, by construction.** pdfjs resolves five kinds of asset by
// URL if you let it, and four of them only for documents that happen to need
// them — which is what makes the breach invisible in ordinary testing:
//   - the worker → bundled, see pdfWorkerSrc.ts;
//   - cMaps (CJK and other non-Latin encodings) → deliberately **not**
//     provided. A full cMap bundle is megabytes for a tool whose expected
//     input is Latin-script business documents, and we never render a page,
//     only read text. The cost is that text in such a font is dropped
//     entirely and silently, which is why `usesPredefinedCMap` below reads
//     the raw bytes to catch it and warn;
//   - standard font data (the 14 built-in PDF fonts) → likewise not provided.
//     pdfjs logs a console warning about it even on plain Latin text where
//     extraction is perfect, which is why that warning is not forwarded to
//     the user;
//   - `wasmUrl` (image codecs) and `iccUrl` (colour profiles) → not provided
//     either, and never needed: this parser reads text and never decodes an
//     image or resolves a colour.
// The omissions are the whole point: passing no URL means there is nothing to
// fetch. Do not "fix" the console warning by pointing any of these at a CDN.
if (PDF_WORKER_SRC) GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

// Above this, extraction is slow enough and the resulting Markdown large
// enough that the user deserves to be told rather than left watching a
// frozen step.
const LONG_DOCUMENT_PAGES = 100;

// Font encodings that need no cMap file: the simple built-in ones, and
// Identity, where the code *is* the glyph index.
const SELF_CONTAINED_ENCODINGS = new Set([
  'Identity-H',
  'Identity-V',
  'WinAnsiEncoding',
  'MacRomanEncoding',
  'MacExpertEncoding',
  'StandardEncoding',
]);

/**
 * Does this document name a predefined CMap (`/UniGB-UCS2-H` and friends)?
 *
 * This has to be answered from the raw bytes because pdfjs gives no usable
 * signal: with no `cMapUrl` it drops text in such a font **silently** — no
 * error, no U+FFFD, just a shorter document than the user is looking at.
 * Measured against a `/UniGB-UCS2-H` PDF: the Latin text came through, the
 * CJK text vanished, and nothing in the API said so. Guessing from output
 * alone is impossible, so detect the cause instead.
 */
const usesPredefinedCMap = (bytes: ArrayBuffer): boolean => {
  // latin1 keeps byte offsets and cannot throw on binary; names in a PDF are
  // ASCII, which is all this looks for.
  const raw = new TextDecoder('latin1').decode(bytes);
  for (const [, name] of raw.matchAll(/\/Encoding\s*\/([A-Za-z0-9-]+)/g)) {
    if (!SELF_CONTAINED_ENCODINGS.has(name)) return true;
  }
  return false;
};

interface Run {
  text: string;
  x: number;
  /** Distance from the *bottom* of the page: higher is further up. */
  y: number;
  width: number;
  size: number;
}

const toRuns = (items: TextItem[]): Run[] =>
  items
    .filter((item) => item.str.trim() !== '')
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      // `height` is 0 for some producers; the vertical scale in the transform
      // is the reliable one.
      size: item.height || Math.abs(item.transform[3]) || 12,
    }));

/**
 * The x coordinate of a gutter running the full height of the text, or null.
 *
 * Content-stream order is not reading order, so a two-column page can arrive
 * as left-line-1, right-line-1, left-line-2… and sorting by y would then
 * interleave the columns into nonsense. One split is enough for the layout
 * this matters for (a two-column report); chasing arbitrary column counts
 * would be speculation.
 */
const findColumnGutter = (runs: Run[]): number | null => {
  if (runs.length < 4) return null;

  const left = Math.min(...runs.map((r) => r.x));
  const right = Math.max(...runs.map((r) => r.x + r.width));
  const candidate = (left + right) / 2;

  const crossesCandidate = runs.some((r) => r.x < candidate && r.x + r.width > candidate);
  if (crossesCandidate) return null;

  const before = runs.filter((r) => r.x + r.width <= candidate);
  const after = runs.filter((r) => r.x >= candidate);
  if (before.length === 0 || after.length === 0) return null;

  // Two stacked blocks of text are not two columns: the halves have to
  // actually coexist vertically.
  const span = (group: Run[]): [number, number] => [
    Math.min(...group.map((r) => r.y)),
    Math.max(...group.map((r) => r.y)),
  ];
  const [beforeLow, beforeHigh] = span(before);
  const [afterLow, afterHigh] = span(after);
  const overlap = Math.min(beforeHigh, afterHigh) - Math.max(beforeLow, afterLow);
  return overlap > 0 ? candidate : null;
};

/** Runs sharing a baseline, in reading order, joined into one string. */
const toLines = (runs: Run[]): { text: string; y: number; size: number }[] => {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Run[][] = [];

  for (const run of sorted) {
    const current = lines.at(-1);
    const baseline = current?.[0];
    // Half the font size: enough to absorb sub/superscripts and rounding,
    // tight enough not to swallow the next line.
    if (baseline && Math.abs(baseline.y - run.y) <= baseline.size * 0.5) {
      current.push(run);
    } else {
      lines.push([run]);
    }
  }

  return lines.map((line) => {
    const ordered = [...line].sort((a, b) => a.x - b.x);
    const text = ordered.reduce((acc, run, i) => {
      if (i === 0) return run.text;
      const previous = ordered[i - 1];
      // pdfjs splits a visually continuous line into runs wherever the
      // producer did, so a gap is the only evidence of an actual space.
      const gap = run.x - (previous.x + previous.width);
      const separator = gap > run.size * 0.25 ? ' ' : '';
      return acc + separator + run.text;
    }, '');
    return { text, y: ordered[0].y, size: ordered[0].size };
  });
};

/** Lines grouped into paragraphs on vertical gaps, each paragraph one string. */
const toParagraphs = (runs: Run[]): string[] => {
  const lines = toLines(runs);
  if (lines.length === 0) return [];

  const paragraphs: string[][] = [[lines[0].text]];
  for (let i = 1; i < lines.length; i += 1) {
    const gap = lines[i - 1].y - lines[i].y;
    // A wrapped line sits roughly one line-height below its predecessor;
    // anything appreciably larger is the producer's paragraph spacing.
    const isNewParagraph = gap > Math.max(lines[i - 1].size, lines[i].size) * 1.6;
    if (isNewParagraph) paragraphs.push([lines[i].text]);
    else paragraphs.at(-1)?.push(lines[i].text);
  }

  return paragraphs.map((lines) => lines.join(' '));
};

const pageToParagraphs = (runs: Run[]): string[] => {
  const gutter = findColumnGutter(runs);
  if (gutter === null) return toParagraphs(runs);
  return [
    ...toParagraphs(runs.filter((r) => r.x < gutter)),
    ...toParagraphs(runs.filter((r) => r.x >= gutter)),
  ];
};

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  const warnings: string[] = [];
  let paragraphs: string[];
  let pageCount: number;

  // Before pdfjs touches them: it transfers the buffer to its worker, which
  // detaches it here, and the scan then silently reads zero bytes.
  const hasPredefinedCMap = usesPredefinedCMap(bytes);

  try {
    // The loading task, not just its promise: `destroy()` lives on the task,
    // and it is what releases the worker's copy of the document.
    const task = getDocument({
      data: new Uint8Array(bytes),
      // The worker fetches nothing: the P6 zero-network guarantee as an API
      // parameter. (pdfjs 6 no longer has `isEvalSupported` — it dropped eval.)
      useWorkerFetch: false,
    });
    const doc = await task.promise;

    pageCount = doc.numPages;
    const pages: string[][] = [];
    for (let i = 1; i <= pageCount; i += 1) {
      const page = await doc.getPage(i);
      const { items } = await page.getTextContent();
      pages.push(pageToParagraphs(toRuns(items as TextItem[])));
      page.cleanup();
    }
    await task.destroy();
    paragraphs = pages.flat();
  } catch (cause) {
    throw new Error(`Could not read "${fileName}" — it does not look like a readable PDF.`, { cause });
  }

  const markdown = paragraphs.join('\n\n');

  if (markdown.trim() === '') {
    warnings.push(
      'This PDF appears to be scanned images: text extraction found no text at all. ' +
        'Reading text out of page images is not supported.',
    );
  }
  if (pageCount > LONG_DOCUMENT_PAGES) {
    warnings.push(`This PDF has ${pageCount} pages, so extraction and detection will be slow.`);
  }
  if (markdown.includes('�')) {
    warnings.push(
      'Some characters could not be mapped and appear as �. This tool omits the ' +
        'multi-megabyte character maps needed for non-Latin scripts, so text in those ' +
        'scripts may be unreadable — and anything unreadable cannot be detected.',
    );
  }
  if (hasPredefinedCMap) {
    warnings.push(
      'This PDF uses a non-Latin character encoding (a predefined CMap, typically ' +
        'Chinese, Japanese or Korean). That text could not be read and is missing from ' +
        'the extracted text above — so nothing sensitive in it has been detected or masked.',
    );
  }

  return {
    markdown,
    format: 'pdf',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
