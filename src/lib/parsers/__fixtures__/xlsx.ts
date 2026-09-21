import JSZip from 'jszip';

// Builds a minimal valid .xlsx in memory. Same rule as its siblings: nothing
// binary committed, every byte readable in the diff.
//
// An .xlsx is a zip of XML. The members that matter to a reader are
// xl/workbook.xml (sheet names and order), xl/worksheets/sheetN.xml (the
// cells), xl/sharedStrings.xml (the string table most text cells point into)
// and xl/styles.xml (the number formats that say whether a numeric cell is
// really a date).

const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A cell: a string, a number, or a date written as an Excel serial. */
export type CellValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'date'; serial: number }
  | { kind: 'formula'; formula: string; cached: string }
  | { kind: 'empty' };

export const text = (value: string): CellValue => ({ kind: 'text', value });
export const number = (value: number): CellValue => ({ kind: 'number', value });
export const date = (serial: number): CellValue => ({ kind: 'date', serial });
export const formula = (f: string, cached: string): CellValue => ({
  kind: 'formula',
  formula: f,
  cached,
});
export const empty = (): CellValue => ({ kind: 'empty' });

export interface Sheet {
  name: string;
  rows: CellValue[][];
}

const columnName = (index: number): string => {
  let name = '';
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
};

// Style index 1 is wired to a date number format in STYLES below; 0 is General.
const DATE_STYLE = 1;

const sheetXml = (rows: CellValue[][], sharedStrings: string[]): string => {
  const rowXml = rows
    .map((cells, rowIndex) => {
      const cellXml = cells
        .map((cell, colIndex) => {
          const ref = `${columnName(colIndex)}${rowIndex + 1}`;
          switch (cell.kind) {
            case 'text': {
              let index = sharedStrings.indexOf(cell.value);
              if (index === -1) index = sharedStrings.push(cell.value) - 1;
              return `<c r="${ref}" t="s"><v>${index}</v></c>`;
            }
            case 'number':
              return `<c r="${ref}"><v>${cell.value}</v></c>`;
            case 'date':
              return `<c r="${ref}" s="${DATE_STYLE}"><v>${cell.serial}</v></c>`;
            case 'formula':
              return `<c r="${ref}"><f>${escapeXml(cell.formula)}</f><v>${escapeXml(cell.cached)}</v></c>`;
            case 'empty':
              return `<c r="${ref}"/>`;
          }
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${SS_NS}"><sheetData>${rowXml}</sheetData></worksheet>`;
};

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${SS_NS}">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
  <cellXfs count="2">
    <xf numFmtId="0" applyNumberFormat="0"/>
    <xf numFmtId="164" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

export const buildXlsx = async (sheets: Sheet[]): Promise<ArrayBuffer> => {
  const sharedStrings: string[] = [];
  const sheetFiles = sheets.map((sheet) => sheetXml(sheet.rows, sharedStrings));

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}">
  <Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${SS_NS}" xmlns:r="${R_NS}"><sheets>${sheets
      .map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}">${sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${R_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('')}</Relationships>`,
  );
  zip.file('xl/styles.xml', STYLES);
  sheetFiles.forEach((xml, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml));
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${SS_NS}" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings
      .map((s) => `<si><t>${escapeXml(s)}</t></si>`)
      .join('')}</sst>`,
  );

  return zip.generateAsync({ type: 'arraybuffer' });
};
