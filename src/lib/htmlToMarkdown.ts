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

const createHtmlToMarkdown = (): TurndownService => {
  // 'atx' ('# Heading') for every level, not turndown's default mixed style
  // (setext '====='/'-----' underlines for h1/h2, atx '###' from h3 down) —
  // one consistent heading marker is simpler for a human or an LLM to scan.
  const service = new TurndownService({ headingStyle: 'atx' });

  service.escape = (text: string): string =>
    KEEP_ESCAPES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);

  service.addRule('stripEmphasis', {
    filter: ['strong', 'b', 'em', 'i'],
    replacement: (content) => content,
  });

  return service;
};

// One shared instance — every ingest path (paste, and every M3 document
// parser) goes through the same rules, so the fix lands once.
const htmlToMarkdown = createHtmlToMarkdown();

export const convertHtmlToMarkdown = (html: string): string => htmlToMarkdown.turndown(html);
