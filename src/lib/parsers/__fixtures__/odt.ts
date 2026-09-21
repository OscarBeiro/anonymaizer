import JSZip from 'jszip';

// Builds a minimal valid .odt in memory — same rule as the .docx and .pdf
// fixtures: nothing binary is committed and every byte is readable in the diff.
//
// An ODF package is a zip whose first member must be an uncompressed
// `mimetype`. jszip is told `{ compression: 'STORE' }` for that one file
// accordingly; the rest may compress.

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
].join(' ');

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const heading = (text: string, level = 1): string =>
  `<text:h text:outline-level="${level}">${escapeXml(text)}</text:h>`;

export const paragraph = (text: string): string => `<text:p>${escapeXml(text)}</text:p>`;

/** A paragraph whose text is broken across spans, as a real editor emits it. */
export const spannedParagraph = (parts: string[]): string =>
  `<text:p>${parts.map((p) => `<text:span>${escapeXml(p)}</text:span>`).join('')}</text:p>`;

/** `items` may nest: a string is an item, an array is a sublist of the item before it. */
export type ListItems = (string | ListItems)[];

export const list = (items: ListItems, ordered = false): string => {
  const tag = ordered ? 'text:list text:continue-numbering="false"' : 'text:list';
  const body = items
    .map((item) =>
      typeof item === 'string'
        ? `<text:list-item>${paragraph(item)}</text:list-item>`
        : `<text:list-item>${list(item, ordered)}</text:list-item>`,
    )
    .join('');
  return `<${tag}>${body}</text:list>`;
};

export const table = (rows: string[][]): string => {
  const row = (cells: string[]): string =>
    `<table:table-row>${cells
      .map((c) => `<table:table-cell office:value-type="string">${paragraph(c)}</table:table-cell>`)
      .join('')}</table:table-row>`;
  return `<table:table table:name="Tabla1">${rows.map(row).join('')}</table:table>`;
};

/** A comment anchored in the text: `dc:creator` is a reviewer's real name. */
export const annotation = (author: string, text: string): string =>
  `<office:annotation><dc:creator>${escapeXml(author)}</dc:creator>` +
  `<dc:date>2026-09-18T13:42:10</dc:date>${paragraph(text)}</office:annotation>`;

/** An insertion recorded by track-changes, with its author in the change list. */
export const trackedChanges = (author: string): string =>
  `<text:tracked-changes><text:changed-region text:id="ct1"><text:insertion>` +
  `<office:change-info><dc:creator>${escapeXml(author)}</dc:creator>` +
  `<dc:date>2026-09-18T09:00:00</dc:date></office:change-info>` +
  `</text:insertion></text:changed-region></text:tracked-changes>`;

export const image = (href = 'Pictures/photo.png'): string =>
  `<text:p><draw:frame draw:name="Imagen1"><draw:image xlink:href="${href}" ` +
  `xmlns:xlink="http://www.w3.org/1999/xlink"/></draw:frame></text:p>`;

export const embeddedObject = (): string =>
  `<text:p><draw:frame draw:name="Objeto1"><draw:object xlink:href="./Object 1" ` +
  `xmlns:xlink="http://www.w3.org/1999/xlink"/></draw:frame></text:p>`;

export interface OdtMeta {
  creator?: string;
  initialCreator?: string;
  editingCycles?: number;
}

const metaXml = ({ creator, initialCreator, editingCycles }: OdtMeta): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NS}><office:meta>
${initialCreator ? `<meta:initial-creator>${escapeXml(initialCreator)}</meta:initial-creator>` : ''}
${creator ? `<dc:creator>${escapeXml(creator)}</dc:creator>` : ''}
${editingCycles ? `<meta:editing-cycles>${editingCycles}</meta:editing-cycles>` : ''}
<meta:generator>LibreOffice/25.2</meta:generator>
</office:meta></office:document-meta>`;

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

export const buildOdt = async (bodyXml: string, meta: OdtMeta = {}): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', MANIFEST);
  zip.file('meta.xml', metaXml(meta));
  zip.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS}><office:body><office:text>${bodyXml}</office:text></office:body></office:document-content>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
};
