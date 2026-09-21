import JSZip from 'jszip';

// Builds a minimal but genuinely valid .docx in memory, so no binary blob is
// committed — the rule `src/core/__fixtures__/clinicalReport.ts` already
// states for the clinical report, and it keeps every fixture's contents
// readable in the diff.
//
// A .docx is an OOXML zip. mammoth needs five members here: the content-type
// map, the package relationships pointing at the main document part, the
// document itself, and — because mammoth resolves headings by style *name*
// and lists through the numbering part — styles.xml and numbering.xml. Omit
// those last two and mammoth still converts, but every heading and list item
// degrades to a bare <p> and the messages array fills with
// "style ... referenced but not defined" noise that drowns the warnings a
// test is actually asserting on.

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One paragraph. `style` is a style id defined in STYLES below, e.g. 'Heading1'. */
export const paragraph = (text: string, style?: string): string =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

/** A list item. numId 1 is the bullet list, numId 2 the numbered one. */
export const listItem = (text: string, ordered = false, level = 0): string =>
  `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${ordered ? 2 : 1}"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

/** A table from rows of cell text; the first row is marked as a header row. */
export const table = (rows: string[][]): string => {
  const row = (cells: string[], header: boolean): string =>
    `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((c) => `<w:tc><w:tcPr/>${paragraph(c)}</w:tc>`).join('')}</w:tr>`;
  return `<w:tbl>${rows.map((cells, i) => row(cells, i === 0)).join('')}</w:tbl>`;
};

/**
 * A paragraph in a style the document never defines — the simplest way to
 * make mammoth emit a real warning, which is what the .docx parser folds into
 * `ParsedDocument.warnings`.
 */
export const unknownStyleParagraph = (text: string): string => paragraph(text, 'CorporateWatermark');

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}">
  <w:abstractNum w:abstractNumId="10">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="20">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="10"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="20"/></w:num>
</w:numbering>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}">
  <Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}">
  <Relationship Id="rId10" Type="${R_NS}/styles" Target="styles.xml"/>
  <Relationship Id="rId11" Type="${R_NS}/numbering" Target="numbering.xml"/>
</Relationships>`;

export const buildDocx = async (bodyXml: string): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', PACKAGE_RELS);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/numbering.xml', NUMBERING);
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}"><w:body>${bodyXml}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
};
