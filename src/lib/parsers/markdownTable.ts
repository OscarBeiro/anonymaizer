// One Markdown-table emitter for the row-shaped formats (.csv at P8e, .xlsx at
// P8f) and for .odt, which maps its table elements to rows and comes here too.
// The HTML-shaped formats (.docx, .eml) can't use it — they arrive as a DOM
// and go through turndown's table rules in src/lib/htmlToMarkdown.ts — but the
// two implementations agree on the conventions below, so a table reads the
// same whatever file it came out of.
//
// Conventions, both forced by GFM rather than chosen:
//   - the first row is the header, because a delimiter row has to follow row
//     one whether or not the source called it a header;
//   - a pipe inside a cell is escaped, or it forges a column boundary.

/** Cell text flattened to one line, with pipes escaped. */
export const toCell = (value: string): string =>
  value.replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|').trim();

/**
 * Rows to a GFM table. Short rows are padded and long ones are **not**
 * truncated: a ragged CSV row is bad data, but dropping a cell would drop
 * whatever it held from detection entirely, so the table grows a column
 * instead. Returns '' for no rows.
 */
export const toMarkdownTable = (rows: string[][]): string => {
  if (rows.length === 0) return '';

  const columns = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]): string =>
    `| ${Array.from({ length: columns }, (_, i) => toCell(row[i] ?? '')).join(' | ')} |`;

  return [line(rows[0]), `|${' --- |'.repeat(columns)}`, ...rows.slice(1).map(line)].join('\n');
};
