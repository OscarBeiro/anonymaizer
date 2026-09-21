// Builds a minimal, valid, uncompressed PDF in memory — no binary fixture is
// committed, and every byte of the file under test is readable in the diff
// (the rule `src/core/__fixtures__/clinicalReport.ts` states for the clinical
// report).
//
// PDF has no notion of paragraphs or reading order: a page is a list of text
// runs, each placed at an absolute point by a `Td` operator. That is exactly
// what the parser has to reflow, so the fixture speaks in the same terms —
// place a string at (x, y), in PDF user space where **y grows upwards** from
// the bottom-left corner.

export interface TextRun {
  /** Points from the left edge. */
  x: number;
  /** Points from the *bottom* edge — higher is further up the page. */
  y: number;
  text: string;
  /** Font size in points; the parser uses it to judge line and paragraph gaps. */
  size?: number;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

// Only the characters that would otherwise terminate a PDF string literal.
const escapePdfString = (text: string): string => text.replace(/([\\()])/g, '\\$1');

const contentStream = (runs: TextRun[]): string =>
  runs
    .map(
      ({ x, y, text, size = 12 }) =>
        `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfString(text)}) Tj ET`,
    )
    .join('\n');

/**
 * `pages` is one array of runs per page. A page with no runs is a page with no
 * extractable text — which is what an image-only (scanned) PDF looks like to
 * a text extractor, and is how the "scanned document" warning gets tested
 * without embedding an actual image.
 */
export const buildPdf = (pages: TextRun[][]): ArrayBuffer => {
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // Object numbers have to be known before the Pages object can list its kids,
  // so reserve 1 for the catalog and 2 for the page tree and start real
  // objects at 3.
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(''); // placeholder for the page tree, filled in below
  const fontRef = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageRefs = pages.map((runs) => {
    const stream = contentStream(runs);
    const contentsRef = addObject(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    return addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentsRef} 0 R >>`,
    );
  });

  objects[1] =
    `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] >>`;

  return assemble(objects);
};

// Serialises numbered objects into a PDF, recording each one's byte offset for
// the xref table. pdfjs can rebuild a broken xref, but a fixture that leans on
// that recovery path is testing pdfjs's error handling instead of our reflow.
const assemble = (objects: string[]): ArrayBuffer => {
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // latin1, not utf-8: the offsets above are string indices, and any
  // multi-byte character would desynchronise them from real byte positions.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes.buffer;
};

/**
 * A one-page PDF mixing Latin text with a Type0 font that uses a *predefined*
 * CMap (`/UniGB-UCS2-H`) — the shape that makes pdfjs want to download a cMap
 * file. Without one it extracts the Latin text and drops the CJK text
 * entirely, silently, which is the case the parser has to warn about.
 */
export const buildPredefinedCMapPdf = (latinText: string, cjkText: string): ArrayBuffer => {
  const hex = [...cjkText]
    .map((c) => (c.codePointAt(0) ?? 0).toString(16).padStart(4, '0'))
    .join('');

  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const descendant = addObject(
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light ' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /DW 1000 >>',
  );
  const cjkFont = addObject(
    '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H ' +
      `/DescendantFonts [${descendant} 0 R] >>`,
  );
  const latinFont = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const stream =
    `BT /F1 18 Tf 1 0 0 1 60 700 Tm <${hex}> Tj ET\n` +
    `BT /F2 12 Tf 1 0 0 1 60 660 Tm (${escapePdfString(latinText)}) Tj ET`;
  const contentsRef = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const pageRef = addObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${cjkFont} 0 R /F2 ${latinFont} 0 R >> >> ` +
      `/Contents ${contentsRef} 0 R >>`,
  );
  objects[1] = `<< /Type /Pages /Count 1 /Kids [${pageRef} 0 R] >>`;

  return assemble(objects);
};

/** A one-page document whose text sits in two columns, to catch interleaving. */
export const twoColumnPage = (left: string[], right: string[]): TextRun[] => [
  ...left.map((text, i) => ({ x: 60, y: 700 - i * 16, text })),
  ...right.map((text, i) => ({ x: 340, y: 700 - i * 16, text })),
];
