import JSZip from 'jszip';
import type { ParsedDocument } from '../../core/parsers';

// .odt via jszip + the native DOMParser (M3/P8d). The DOMParser is why this
// file lives in src/lib/ and not src/core/ — CLAUDE.md rule 4.
//
// Elements are matched on `localName`, never on the qualified name: an ODF
// producer is free to bind `urn:…:text:1.0` to any prefix it likes, and
// `text:` is only a convention. (Namespace URIs would be stricter still, but
// localName is unambiguous here — no two ODF vocabularies share these names in
// a document body.)
//
// **ODF metadata is PII, and the decision is: extract it, warn, and keep it
// out of the Markdown.** meta.xml routinely carries an author's full name that
// appears nowhere in the visible text. Putting it into the Markdown would add
// PII to the text the user pastes elsewhere — text that was never going to
// leave their machine otherwise — and if detection then missed it, this tool
// would have *created* a leak. Dropping it silently is no good either: the
// user would never learn that the original file they forward carries those
// names. So it is reported in `warnings`, values included, which stay in the
// UI and never enter the Markdown. The same reasoning governs the authors of
// comments and tracked changes below, and sets the precedent for .docx's
// core.xml and .pptx.

const MARKDOWN_TABLE_DELIMITER = ' --- |';

/** Depth-first text of an element, with span boundaries closed up. */
const textOf = (element: Element): string => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const cellText = (element: Element): string => textOf(element).replace(/\|/g, '\\|');

const childrenByLocalName = (parent: Element, ...names: string[]): Element[] =>
  [...parent.children].filter((child) => names.includes(child.localName));

const tableToMarkdown = (tableElement: Element): string => {
  const rows = tableElement.getElementsByTagName('*');
  const rowElements = [...rows].filter((r) => r.localName === 'table-row');
  const lines = rowElements.map(
    (row) =>
      `| ${[...row.children]
        .filter((c) => c.localName === 'table-cell')
        .map(cellText)
        .join(' | ')} |`,
  );
  if (lines.length === 0) return '';
  const columns = [...(rowElements[0]?.children ?? [])].filter((c) => c.localName === 'table-cell').length;
  // Same choice as the shared HTML converter: the first row is the header,
  // because GFM needs a delimiter row after row one either way.
  return [lines[0], `|${MARKDOWN_TABLE_DELIMITER.repeat(columns)}`, ...lines.slice(1)].join('\n');
};

const listToMarkdown = (listElement: Element, depth = 0): string[] => {
  const lines: string[] = [];
  for (const item of childrenByLocalName(listElement, 'list-item', 'list-header')) {
    for (const child of item.children) {
      if (child.localName === 'list') {
        lines.push(...listToMarkdown(child, depth + 1));
      } else {
        const text = textOf(child);
        if (text !== '') lines.push(`${'  '.repeat(depth)}- ${text}`);
      }
    }
  }
  return lines;
};

/** Every `dc:creator` under an element, deduplicated and in document order. */
const creatorsOf = (element: Element): string[] => {
  const names = [...element.getElementsByTagName('*')]
    .filter((node) => node.localName === 'creator')
    .map((node) => textOf(node))
    .filter((name) => name !== '');
  return [...new Set(names)];
};

const listSentence = (names: string[]): string => names.join(', ');

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  const unreadable = (cause: unknown): Error =>
    new Error(`Could not read "${fileName}" — it does not look like a valid ODF text document.`, {
      cause,
    });

  let contentXml: string;
  let metaXml: string | null;
  try {
    const zip = await JSZip.loadAsync(bytes);
    const contentFile = zip.file('content.xml');
    if (!contentFile) throw new Error('content.xml is missing');
    contentXml = await contentFile.async('string');
    metaXml = (await zip.file('meta.xml')?.async('string')) ?? null;
  } catch (cause) {
    throw unreadable(cause);
  }

  const document = new DOMParser().parseFromString(contentXml, 'text/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw unreadable(new Error('content.xml is not well-formed XML'));
  }

  const body = [...document.getElementsByTagName('*')].find((el) => el.localName === 'text');
  if (!body) throw unreadable(new Error('no office:text element'));

  const warnings: string[] = [];
  const blocks: string[] = [];

  for (const node of body.children) {
    switch (node.localName) {
      case 'h': {
        const level = Number(node.getAttribute('text:outline-level') ?? node.getAttribute('outline-level') ?? 1);
        const text = textOf(node);
        if (text !== '') blocks.push(`${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`);
        break;
      }
      case 'p': {
        const text = textOf(node);
        if (text !== '') blocks.push(text);
        break;
      }
      case 'list': {
        const lines = listToMarkdown(node);
        if (lines.length > 0) blocks.push(lines.join('\n'));
        break;
      }
      case 'table': {
        const markdown = tableToMarkdown(node);
        if (markdown !== '') blocks.push(markdown);
        break;
      }
      case 'tracked-changes': {
        // Deliberately not reconstructed into the text: the revision
        // machinery is not prose, and a deleted passage reappearing in the
        // output would be a surprise. Its authors are the privacy-relevant
        // part, so they are named.
        const authors = creatorsOf(node);
        warnings.push(
          authors.length > 0
            ? `This document has tracked changes recorded by ${listSentence(authors)}. ` +
              'They are not included in the text above, but the original file still carries them.'
            : 'This document has tracked changes, which are not included in the text above.',
        );
        break;
      }
      default:
        break;
    }
  }

  // Comments are content — someone's note about the document — so their text
  // goes into the Markdown to be detected and masked. Their authors are
  // metadata and stay in the warning.
  const annotations = [...body.getElementsByTagName('*')].filter((el) => el.localName === 'annotation');
  if (annotations.length > 0) {
    const authors = creatorsOf(body).filter((name) => name !== '');
    const commentTexts = annotations
      .map((note) =>
        childrenByLocalName(note, 'p')
          .map((p) => textOf(p))
          .join(' ')
          .trim(),
      )
      .filter((text) => text !== '');
    if (commentTexts.length > 0) {
      blocks.push(`Comments:\n${commentTexts.map((text) => `- ${text}`).join('\n')}`);
    }
    warnings.push(
      `This document has ${annotations.length} comment(s)` +
        (authors.length > 0 ? ` by ${listSentence(authors)}` : '') +
        '. Their text is included above; the authors’ names are not.',
    );
  }

  const images = [...body.getElementsByTagName('*')].filter((el) => el.localName === 'image').length;
  if (images > 0) {
    warnings.push(
      `${images} image(s) were dropped. Anything written inside an image cannot be read or masked.`,
    );
  }
  const objects = [...body.getElementsByTagName('*')].filter((el) => el.localName === 'object').length;
  if (objects > 0) {
    warnings.push(`${objects} embedded object(s) (a chart or spreadsheet, say) were dropped.`);
  }

  if (metaXml) {
    const meta = new DOMParser().parseFromString(metaXml, 'text/xml');
    const named = [...meta.getElementsByTagName('*')]
      .filter((el) => el.localName === 'creator' || el.localName === 'initial-creator')
      .map((el) => textOf(el))
      .filter((name) => name !== '');
    const people = [...new Set(named)];
    if (people.length > 0) {
      warnings.push(
        `The file’s metadata names ${listSentence(people)}. That is stored in the document ` +
          'itself, not in its text, so it is not shown or masked above — but it travels with the ' +
          'original file if you send it on.',
      );
    }
  }

  const markdown = blocks.join('\n\n');
  if (markdown.trim() === '') {
    warnings.push(
      'This document contained no extractable text. Any content it has may be images or embedded objects.',
    );
  }

  return {
    markdown,
    format: 'odt',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
