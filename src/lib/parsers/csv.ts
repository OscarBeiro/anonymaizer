import type { ParsedDocument } from '../../core/parsers';
import { toMarkdownTable } from './markdownTable';

// .csv, hand-rolled (M3/P8e). No library: SheetJS is not worth pulling in for
// RFC 4180, and a parser small enough to read in one sitting is easier to
// trust with a file that may be nothing but personal data.
//
// This module happens to be pure — no DOM, no library — but it lives in
// src/lib/parsers/ with its siblings rather than in src/core/, so that "every
// concrete parser is in one directory" stays true and the lazy-import site has
// nothing to special-case.

const DELIMITERS = [',', ';', '\t'] as const;

// A Markdown table this long is unusable to read and slow to run detection
// over; the user should hear about it rather than watch the step hang.
const MANY_ROWS = 5000;

/**
 * Picks the delimiter that appears most often *outside* quoted fields.
 *
 * Counting naively would pick `,` for a semicolon-delimited European export
 * whose first row contains `"uno,dos,tres"`, which is exactly the file this
 * tool gets handed.
 */
const sniffDelimiter = (text: string): string => {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') i += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  let best: (typeof DELIMITERS)[number] = DELIMITERS[0];
  for (const delimiter of DELIMITERS) {
    if ((counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0)) best = delimiter;
  }
  return best;
};

/** RFC 4180: quoted fields may contain the delimiter, newlines and `""`. */
const parseRows = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    // A single empty field is a blank line, not a row of one empty cell —
    // otherwise a trailing newline becomes a phantom table row.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') inQuotes = true;
    else if (char === delimiter) endField();
    else if (char === '\r' && text[i + 1] === '\n') {
      endRow();
      i += 1;
    } else if (char === '\n' || char === '\r') endRow();
    else field += char;
  }

  // Whatever is left when the text runs out is a final row with no newline.
  if (field !== '' || row.length > 0) endRow();

  return rows;
};

export const parse = (bytes: ArrayBuffer): ParsedDocument => {
  // A BOM would otherwise ride along inside the first header cell, where it is
  // invisible and breaks any comparison against that column's name.
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  const warnings: string[] = [];

  // A row whose every cell is blank carries nothing for detection to find,
  // and a whitespace-only file would otherwise emit a one-empty-cell table.
  const rows = parseRows(text, sniffDelimiter(text)).filter((row) =>
    row.some((cell) => cell.trim() !== ''),
  );

  if (rows.length === 0) {
    return {
      markdown: '',
      format: 'csv',
      warnings: ['This file has no rows: there was nothing to read.'],
    };
  }

  const widths = new Set(rows.map((row) => row.length));
  if (widths.size > 1) {
    warnings.push(
      'Some rows have a different number of cells than the header. The table was widened to ' +
        'the longest row rather than dropping any cell, so nothing escapes detection.',
    );
  }
  if (rows.length > MANY_ROWS) {
    warnings.push(
      `This file has ${rows.length} rows. The table below will be unwieldy and detection over ` +
        'it will be slow.',
    );
  }

  return {
    markdown: toMarkdownTable(rows),
    format: 'csv',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
