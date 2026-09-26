import JSZip from 'jszip';
import type { ParsedDocument } from '../../core/parsers';
import { toMarkdownTable } from './markdownTable';

// .xlsx, hand-rolled on jszip + DOMParser (M3/P8f), no spreadsheet library.
//
// **Why not SheetJS.** The `xlsx` package on npm is stuck at 0.18.5 (2022) and
// `npm audit` reports it as 1 high with *no fix available* — prototype
// pollution plus a ReDoS, both fixed only in the 0.19.3+/0.20.x builds SheetJS
// distributes from their own CDN. Installing from npm would have reintroduced
// exactly the kind of Dependabot alert P8sec spent a session clearing;
// installing from a CDN URL puts a non-registry host in the lockfile, and
// vendoring a ~900 kB blob puts an unreviewable file in the repo. Measured
// alternative: `exceljs` is 2 moderate advisories (via `uuid`) and 22 MB
// installed. An .xlsx is a zip of XML and jszip is already here for .odt, so
// the reader is ~120 lines we can actually audit. Recorded in
// docs/plans/m3-parsers.md, P8f.
//
// What this deliberately does *not* do: styles beyond "is this a date", merged
// cells, charts, pivot tables, defined names. None of them carry text a
// detector needs that the cells do not already have.

// Same threshold and reasoning as .csv: a Markdown table longer than this is
// unusable to read and slow to run detection over.
const MANY_ROWS = 5000;

// Built-in numFmtIds that mean "date" or "time" without declaring a format
// code. 14-22 and 45-47 are the date/time block; a custom format (163+)
// declares its own code, checked separately.
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

// Built-in percent formats: 9 is `0%`, 10 is `0.00%`. Value = decimals shown.
const BUILTIN_PERCENT_FORMATS = new Map([
  [9, 0],
  [10, 2],
]);

/**
 * Decimals a percent format code shows (`0.0%` → 1), or undefined when the
 * code is not a percentage. Only the first (positive) section counts.
 */
const percentDecimals = (code: string): number | undefined => {
  const section = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').split(';')[0];
  if (!section.includes('%')) return undefined;
  return /\.([0#?]+)/.exec(section)?.[1].length ?? 0;
};

/** Does this format code render a date rather than a number? */
const isDateFormatCode = (code: string): boolean =>
  // Strip quoted literals and colour/condition sections first, so a currency
  // format like `[$-409]#,##0.00` cannot be read as containing a date token.
  /[dmyhs]/i.test(code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''));

const byLocalName = (root: Document | Element, name: string): Element[] =>
  [...root.getElementsByTagName('*')].filter((el) => el.localName === name);

/** Excel's serial day number to an ISO date. */
const serialToIsoDate = (serial: number): string => {
  // Excel's epoch is 1899-12-31 = 1, *and* it believes 1900-02-29 existed.
  // Serials above that phantom day are therefore one day ahead of reality,
  // which is why the offset changes at 60 rather than being a constant.
  const days = serial >= 60 ? serial - 1 : serial;
  const millis = Date.UTC(1899, 11, 31) + days * 86_400_000;
  return new Date(millis).toISOString().slice(0, 10);
};

/** Column letters of a cell reference ("BC12" → 28, zero-based). */
const columnIndexOf = (reference: string): number => {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  return [...letters].reduce((acc, letter) => acc * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
};

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  const unreadable = (cause: unknown): Error =>
    new Error(`Could not read "${fileName}" — it does not look like a valid Excel workbook.`, { cause });

  let zip: JSZip;
  let workbookXml: string;
  try {
    zip = await JSZip.loadAsync(bytes);
    const workbook = zip.file('xl/workbook.xml');
    if (!workbook) throw new Error('xl/workbook.xml is missing');
    workbookXml = await workbook.async('string');
  } catch (cause) {
    throw unreadable(cause);
  }

  const parser = new DOMParser();
  const workbook = parser.parseFromString(workbookXml, 'text/xml');

  // The string table most text cells point into, by index.
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const sharedStrings = sharedStringsXml
    ? byLocalName(parser.parseFromString(sharedStringsXml, 'text/xml'), 'si').map(
        // A single `si` may hold several `t` runs when the cell text was
        // formatted piecemeal; its textContent is the whole string.
        (si) => si.textContent ?? '',
      )
    : [];

  // Style index → is that style a date? `cellXfs` is positional: a cell's `s`
  // attribute indexes into it.
  const stylesXml = await zip.file('xl/styles.xml')?.async('string');
  const dateStyles = new Set<number>();
  // Style index → decimals, for cells Excel shows as a percentage: the stored
  // value is the fraction (0.25), the user sees 25%.
  const percentStyles = new Map<number, number>();
  if (stylesXml) {
    const styles = parser.parseFromString(stylesXml, 'text/xml');
    const customDateFormats = new Set(
      byLocalName(styles, 'numFmt')
        .filter((fmt) => isDateFormatCode(fmt.getAttribute('formatCode') ?? ''))
        .map((fmt) => Number(fmt.getAttribute('numFmtId'))),
    );
    const customPercentFormats = new Map<number, number>();
    for (const fmt of byLocalName(styles, 'numFmt')) {
      const decimals = percentDecimals(fmt.getAttribute('formatCode') ?? '');
      if (decimals !== undefined) customPercentFormats.set(Number(fmt.getAttribute('numFmtId')), decimals);
    }
    const cellXfs = byLocalName(styles, 'cellXfs')[0];
    const xfs = cellXfs ? [...cellXfs.children].filter((xf) => xf.localName === 'xf') : [];
    xfs.forEach((xf, index) => {
      const numFmtId = Number(xf.getAttribute('numFmtId') ?? 0);
      const percent = BUILTIN_PERCENT_FORMATS.get(numFmtId) ?? customPercentFormats.get(numFmtId);
      if (percent !== undefined) {
        percentStyles.set(index, percent);
      } else if (BUILTIN_DATE_FORMATS.has(numFmtId) || customDateFormats.has(numFmtId)) {
        dateStyles.add(index);
      }
    });
  }

  const warnings: string[] = [];
  const blocks: string[] = [];
  let sawFormula = false;

  const sheetNames = byLocalName(workbook, 'sheet').map(
    (sheet, index) => sheet.getAttribute('name') ?? `Sheet${index + 1}`,
  );

  for (const [index, name] of sheetNames.entries()) {
    // Sheets are read by position rather than by following the relationship
    // ids: a workbook whose sheets were reordered or deleted has ids that no
    // longer match sheetN.xml, and position is what the `sheets` element
    // already encodes.
    const sheetFile = zip.file(`xl/worksheets/sheet${index + 1}.xml`);
    if (!sheetFile) continue;

    const sheet = parser.parseFromString(await sheetFile.async('string'), 'text/xml');
    const rows: string[][] = [];

    for (const rowElement of byLocalName(sheet, 'row')) {
      const cells: string[] = [];
      for (const cell of [...rowElement.children].filter((c) => c.localName === 'c')) {
        // Placed by its reference, not by its position among siblings: a
        // producer omits untouched cells entirely, so "the third `c` element"
        // is not "column C".
        const column = columnIndexOf(cell.getAttribute('r') ?? '');
        const type = cell.getAttribute('t');
        const valueElement = [...cell.children].find((child) => child.localName === 'v');
        const inlineString = [...cell.children].find((child) => child.localName === 'is');
        if ([...cell.children].some((child) => child.localName === 'f')) sawFormula = true;

        let value: string;
        if (type === 's') {
          // Shared string: `v` is an index into the table.
          value = sharedStrings[Number(valueElement?.textContent ?? -1)] ?? '';
        } else if (type === 'inlineStr') {
          value = inlineString?.textContent ?? '';
        } else if (type === 'str') {
          // A formula's cached string result.
          value = valueElement?.textContent ?? '';
        } else if (type === 'b') {
          value = valueElement?.textContent === '1' ? 'TRUE' : 'FALSE';
        } else {
          const raw = valueElement?.textContent ?? '';
          const style = Number(cell.getAttribute('s') ?? -1);
          const numeric = raw !== '' && Number.isFinite(Number(raw));
          const percentDigits = percentStyles.get(style);
          value =
            numeric && percentDigits !== undefined
              ? `${(Number(raw) * 100).toFixed(percentDigits)}%`
              : numeric && dateStyles.has(style)
                ? serialToIsoDate(Number(raw))
                : raw;
        }

        while (cells.length < column) cells.push('');
        cells[column] = value;
      }
      if (cells.some((cell) => cell.trim() !== '')) rows.push(cells);
    }

    if (rows.length === 0) {
      warnings.push(`Sheet “${name}” is empty and was skipped.`);
      continue;
    }
    if (rows.length > MANY_ROWS) {
      warnings.push(
        `Sheet “${name}” has ${rows.length} rows. The table below will be unwieldy and detection ` +
          'over it will be slow.',
      );
    }
    blocks.push(`## ${name}\n\n${toMarkdownTable(rows)}`);
  }

  if (sawFormula) {
    warnings.push(
      'Formulas were flattened to their last calculated value. If the file was saved without ' +
        'recalculating, a value here may be stale.',
    );
  }

  const markdown = blocks.join('\n\n');
  if (markdown.trim() === '') {
    warnings.push('This workbook contained no extractable text: every sheet was empty.');
  }

  return {
    markdown,
    format: 'xlsx',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
