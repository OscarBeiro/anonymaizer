import JSZip from 'jszip';
import type { ParsedDocument } from '../../core/parsers';
import { toMarkdownTable } from './markdownTable';

// .pptx via jszip + the native DOMParser (M3/P8h), the same shape as .odt —
// which is why this file is in src/lib/ and not src/core/ (rule 4). Parsing
// happens on the main thread deliberately: a Web Worker has no DOMParser, so
// "heavy parsing ⇒ worker" is the wrong inference from ner.worker.ts.
//
// Metadata follows the precedent set at P8d: docProps/core.xml's author names
// are not put into the Markdown. (Unlike .odt, a deck's *notes* are visible
// content and do go in — see below.)

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;
const NOTES_RELATIONSHIP = /notesSlide$/;

const byLocalName = (root: Document | Element, name: string): Element[] =>
  [...root.getElementsByTagName('*')].filter((el) => el.localName === name);

/** The text of one `a:p`, with its runs rejoined. */
const paragraphText = (paragraph: Element): string =>
  byLocalName(paragraph, 't')
    .map((run) => run.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Text of a shape, one line per `a:p`.
 *
 * Grouped by shape rather than flattened for the whole slide, because a slide
 * is a set of independent boxes: running two of them together would invent
 * sentences that were never adjacent, and a detector reading across that seam
 * would produce candidates spanning two unrelated pieces of text.
 */
const shapeLines = (shape: Element): string[] =>
  byLocalName(shape, 'p')
    .map(paragraphText)
    .filter((line) => line !== '');

const tableRows = (table: Element): string[][] =>
  byLocalName(table, 'tr').map((row) =>
    byLocalName(row, 'tc').map((cell) => byLocalName(cell, 'p').map(paragraphText).join(' ').trim()),
  );

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  const unreadable = (cause: unknown): Error =>
    new Error(`Could not read "${fileName}" — it does not look like a valid PowerPoint deck.`, { cause });

  let zip: JSZip;
  let slidePaths: string[];
  try {
    zip = await JSZip.loadAsync(bytes);
    slidePaths = Object.keys(zip.files).filter((path) => SLIDE_PATH.test(path));
    if (slidePaths.length === 0) throw new Error('no ppt/slides/slideN.xml parts');
  } catch (cause) {
    throw unreadable(cause);
  }

  // **Numerically**, not lexicographically: sorting these as strings puts
  // slide10 immediately after slide1, silently reordering any deck with ten or
  // more slides.
  slidePaths.sort(
    (a, b) => Number(SLIDE_PATH.exec(a)?.[1] ?? 0) - Number(SLIDE_PATH.exec(b)?.[1] ?? 0),
  );

  const parser = new DOMParser();
  const warnings: string[] = [];
  const sections: string[] = [];
  let images = 0;
  let charts = 0;

  for (const [index, path] of slidePaths.entries()) {
    const slideNumber = index + 1;
    const slide = parser.parseFromString(await zip.files[path].async('string'), 'text/xml');

    const blocks: string[] = [];
    // Walk the shape tree in document order so a table and the text boxes
    // around it keep their relative positions.
    const tree = byLocalName(slide, 'spTree')[0];
    for (const node of tree ? [...tree.children] : []) {
      if (node.localName === 'sp') {
        const lines = shapeLines(node);
        if (lines.length > 0) blocks.push(lines.join('\n\n'));
      } else if (node.localName === 'graphicFrame') {
        const table = byLocalName(node, 'tbl')[0];
        if (table) {
          const rows = tableRows(table).filter((row) => row.some((cell) => cell !== ''));
          if (rows.length > 0) blocks.push(toMarkdownTable(rows));
        }
        if (byLocalName(node, 'chart').length > 0) charts += 1;
      } else if (node.localName === 'pic') {
        images += 1;
      }
    }

    // Speaker notes are found through the slide's own relationships, never by
    // assuming notesSlideN belongs to slideN: a deck's part numbering drifts
    // apart from its slide order as slides are added and deleted, and that is
    // exactly how notes end up displayed against the wrong slide.
    const rels = zip.file(`ppt/slides/_rels/slide${SLIDE_PATH.exec(path)?.[1]}.xml.rels`);
    if (rels) {
      const relationships = parser.parseFromString(await rels.async('string'), 'text/xml');
      const notesTarget = byLocalName(relationships, 'Relationship')
        .find((rel) => NOTES_RELATIONSHIP.test(rel.getAttribute('Type') ?? ''))
        ?.getAttribute('Target');
      if (notesTarget) {
        const notesPath = notesTarget.replace(/^\.\.\//, 'ppt/');
        const notesFile = zip.file(notesPath);
        if (notesFile) {
          const notes = parser.parseFromString(await notesFile.async('string'), 'text/xml');
          const notesText = byLocalName(notes, 'p')
            .map(paragraphText)
            .filter((line) => line !== '')
            .join('\n\n');
          // Notes are content, not metadata: they are as PII-dense as a slide
          // and the presenter can see them, so they belong in the Markdown
          // where detection reaches them. Labelled, so the user knows what
          // they are looking at.
          if (notesText !== '') blocks.push(`### Speaker notes\n\n${notesText}`);
        }
      }
    }

    if (blocks.length > 0) sections.push(`## Slide ${slideNumber}\n\n${blocks.join('\n\n')}`);
  }

  if (images > 0) {
    warnings.push(
      `${images} image(s) were dropped. Text inside an image cannot be read, so it cannot be masked.`,
    );
  }
  if (charts > 0) {
    warnings.push(`${charts} chart(s) were dropped, including any data labels they carry.`);
  }

  const markdown = sections.join('\n\n');
  if (markdown.trim() === '') {
    warnings.push('This deck contained no extractable text: every slide was images or empty shapes.');
  }

  return {
    markdown,
    format: 'pptx',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
