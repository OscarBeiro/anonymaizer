import TurndownService from 'turndown';

// Shared HTML→Markdown conversion (P7f). Not src/core/ — TurndownService
// parses HTML via the DOM (native DOMParser in the browser, `domino` as
// turndown's own Node fallback, which is why this still tests fine under
// Vitest's `node` environment with no DOM polyfill needed).
//
// Two things are deliberately turned off relative to turndown's defaults,
// both because the anonymizer's detectors run char-class regexes over the
// resulting string, not a Markdown renderer:
//
// 1. `<strong>`/`<b>`/`<em>`/`<i>` are unwrapped to their plain text content
//    instead of turndown's default `**bold**`/`_italic_` markers. A `**`/`_`
//    landing next to a name is not cosmetic here: `PRECEDING_ATTACHED_RE` and
//    `MASK_GLYPHS` (src/core/detectors.ts) both treat `*`/`_` as "attached to
//    a masked ID", by design, for input like `76****12E` — so
//    `**Ester Cuni**` was silently dropping the name (rejected as
//    starts-attached-to-previous) and `**Ester** Cuni` was misdetected as a
//    MASKED_ID span ("**Ester**": a 2-char mask run + 5 alphanumerics),
//    stealing "Ester" from the NAME candidate via §4a's arbitration.
// 2. Turndown's default `escape()` backslash-escapes every literal `*` and
//    `_` in text content (not just ones it introduces), so plain prose
//    containing an underscore — "Ester_Cuni" — comes out as `Ester\_Cuni`,
//    which trips the exact same `*`/`_`-adjacency guards as (1) even though
//    no HTML emphasis was ever involved. Every other default escape (leading
//    `#`/`-`/`>`, backslash itself, brackets, code fences, numbered lists) is
//    kept: none of those characters are in `MASK_GLYPHS` or
//    `PRECEDING_ATTACHED_RE`, so there is no detection reason to touch them.
const KEEP_ESCAPES: Array<[RegExp, string]> = [
  [/\\/g, '\\\\'],
  [/^-/g, '\\-'],
  [/^\+ /g, '\\+ '],
  [/^(=+)/g, '\\$1'],
  [/^(#{1,6}) /g, '\\$1 '],
  [/`/g, '\\`'],
  [/^~~~/g, '\\~~~'],
  [/\[/g, '\\['],
  [/\]/g, '\\]'],
  [/^>/g, '\\>'],
  [/^(\d+)\. /g, '$1\\. '],
];

// Turndown has no table rules of its own: without these it recurses into a
// <table> and emits every cell's text run together, which both destroys the
// document's meaning and glues unrelated values into single detection
// candidates. M3's .docx, .odt, .xlsx and .pptx parsers all arrive here with
// tables, so the rules live in the shared converter rather than in one parser.
//
// The first row is always emitted as the header, whether its cells are <th>
// or <td>: GFM requires a delimiter row after row one regardless, so there is
// no "headerless table" shape to preserve.
const addTableRules = (service: TurndownService): void => {
  const cellText = (content: string): string =>
    content.trim().replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|');

  const isFirstRow = (node: Node): boolean => {
    let ancestor: Node | null = node.parentNode;
    while (ancestor && ancestor.nodeName !== 'TABLE') ancestor = ancestor.parentNode;
    return (ancestor as HTMLElement | null)?.querySelector('tr') === node;
  };

  service.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content) => ` ${cellText(content)} |`,
  });

  service.addRule('tableRow', {
    filter: 'tr',
    replacement: (content, node) => {
      const row = `|${content.trimEnd()}`;
      if (!isFirstRow(node)) return `\n${row}`;
      // childNodes, not children: turndown's Node fallback (domino) does not
      // make the HTMLCollection iterable.
      const columns = Array.from(node.childNodes).filter((c) => ['TH', 'TD'].includes(c.nodeName)).length;
      return `\n${row}\n|${' --- |'.repeat(columns)}`;
    },
  });

  service.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content) => content,
  });

  service.addRule('table', {
    filter: 'table',
    replacement: (content) => `\n\n${content.trim()}\n\n`,
  });
};

const createHtmlToMarkdown = (): TurndownService => {
  // 'atx' ('# Heading') for every level, not turndown's default mixed style
  // (setext '====='/'-----' underlines for h1/h2, atx '###' from h3 down) —
  // one consistent heading marker is simpler for a human or an LLM to scan.
  // `bulletListMarker: '-'` for the same reason as (1) and (2) below, not for
  // looks: turndown's default `*` is in MASK_GLYPHS, so an M3 document's
  // bullet list would hand the detectors an asterisk immediately before every
  // item's text.
  const service = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

  service.escape = (text: string): string =>
    KEEP_ESCAPES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);

  service.addRule('stripEmphasis', {
    filter: ['strong', 'b', 'em', 'i'],
    replacement: (content) => content,
  });

  addTableRules(service);

  return service;
};

// One shared instance — every ingest path (paste, and every M3 document
// parser) goes through the same rules, so the fix lands once.
const htmlToMarkdown = createHtmlToMarkdown();

export const convertHtmlToMarkdown = (html: string): string => htmlToMarkdown.turndown(html);
