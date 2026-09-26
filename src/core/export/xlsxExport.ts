import type { MappingSession } from '../types';
import type { ExportSide } from './textExport';
import { exportFileStem } from './textExport';

// .xlsx export (M4a/P10) — the inverse of the hand-rolled importer in
// src/lib/parsers/xlsx.ts, and for the same reason: no spreadsheet library.
// Core stays pure (hard rule 4): this returns the XML parts by path, and
// src/lib/xlsxZip.ts zips them.
//
// Every cell is written as an inline string (`t="inlineStr"`). The sanitized
// text is Markdown: a number or a date in it is already text, and guessing a
// type back risks turning an ID like 007 into 7.

export interface MarkdownTable {
  name?: string;
  rows: string[][];
}

export interface XlsxExport {
  fileName: string;
  mimeType: string;
  parts: Record<string, string>;
}

export const canExportXlsx = (session: MappingSession): boolean =>
  session.originalFormat === 'csv' || session.originalFormat === 'xlsx';

const DELIMITER_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const isRow = (line: string): boolean => line.trimStart().startsWith('|');

/** A GFM table row to its cells; `\|` is a literal pipe (see markdownTable.ts#toCell). */
const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());

/**
 * The GFM tables in a Markdown text, each named after the `## ` heading
 * directly above it (the importers write one heading per sheet).
 */
export const parseMarkdownTables = (markdown: string): MarkdownTable[] => {
  const lines = markdown.split('\n');
  const tables: MarkdownTable[] = [];
  let heading: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      heading = h[1];
      continue;
    }
    if (isRow(line) && i + 1 < lines.length && DELIMITER_ROW.test(lines[i + 1].trim())) {
      const rows = [splitRow(line)];
      i += 2;
      while (i < lines.length && isRow(lines[i])) rows.push(splitRow(lines[i++]));
      i--;
      tables.push({ name: heading, rows });
      heading = undefined;
    }
  }
  return tables;
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columnLetters = (index: number): string => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

// Excel rejects []:*?/\ in a sheet name, names over 31 characters, and two
// names that differ only in case.
const sheetNames = (tables: MarkdownTable[]): string[] => {
  const used = new Set<string>();
  return tables.map((t, i) => {
    const base = (t.name ?? `Sheet${i + 1}`).replace(/[[\]:*?/\\]/g, '_').slice(0, 31) || `Sheet${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
};

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

const sheetXml = (rows: string[][]): string => {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) =>
          value === '' ? '' : `<c r="${columnLetters(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
        )
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `${XML_HEAD}<worksheet xmlns="${SS_NS}"><sheetData>${body}</sheetData></worksheet>`;
};

export const buildXlsxExport = (text: string, session: MappingSession, side: ExportSide): XlsxExport => {
  if (!canExportXlsx(session)) throw new Error('.xlsx export is only offered for csv or xlsx sources.');
  const tables = parseMarkdownTables(text);
  if (tables.length === 0) throw new Error('There is no table in this text to export as .xlsx.');

  const names = sheetNames(tables);
  const parts: Record<string, string> = {
    '[Content_Types].xml':
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${SHEET_TYPE}"/>`).join('') +
      '</Types>',
    '_rels/.rels':
      `${XML_HEAD}<Relationships xmlns="${PKG_NS}">` +
      `<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/>` +
      '</Relationships>',
    'xl/workbook.xml':
      `${XML_HEAD}<workbook xmlns="${SS_NS}" xmlns:r="${R_NS}"><sheets>` +
      names.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      `${XML_HEAD}<Relationships xmlns="${PKG_NS}">` +
      names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      '</Relationships>',
  };
  tables.forEach((t, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(t.rows);
  });

  return {
    fileName: `${exportFileStem(session)}-${side}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    parts,
  };
};
