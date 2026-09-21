import JSZip from 'jszip';

// Builds a minimal valid .pptx in memory — same rule as its siblings.
//
// A .pptx keeps each slide in ppt/slides/slideN.xml, and a slide's speaker
// notes in a *separate* part that the slide points at through its own
// relationships file. The fixture reproduces that indirection rather than
// assuming notesSlideN belongs to slideN, because a real deck's numbering
// drifts apart as slides are added and deleted — which is exactly the way
// notes end up attached to the wrong slide.

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const paragraphs = (lines: string[]): string =>
  lines.map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`).join('');

/** A text box. Each string is one paragraph inside it. */
export const shape = (lines: string[]): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="TextBox"/><p:nvSpPr/></p:nvSpPr>` +
  `<p:txBody>${paragraphs(lines)}</p:txBody></p:sp>`;

/** A paragraph split across several runs, as PowerPoint emits edited text. */
export const splitRunShape = (parts: string[]): string =>
  `<p:sp><p:txBody><a:p>${parts
    .map((part) => `<a:r><a:t>${escapeXml(part)}</a:t></a:r>`)
    .join('')}</a:p></p:txBody></p:sp>`;

/** A table, which lives in a graphicFrame rather than a shape. */
export const tableFrame = (rows: string[][]): string =>
  `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${rows
    .map(
      (cells) =>
        `<a:tr>${cells.map((cell) => `<a:tc><a:txBody>${paragraphs([cell])}</a:txBody></a:tc>`).join('')}</a:tr>`,
    )
    .join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;

export const picture = (): string =>
  `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Imagen"/></p:nvPicPr><p:blipFill/></p:pic>`;

export const chartFrame = (): string =>
  `<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
  `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId9" xmlns:r="${R_NS}"/>` +
  `</a:graphicData></a:graphic></p:graphicFrame>`;

export interface Slide {
  /** Shape XML, e.g. from `shape()` / `tableFrame()`. */
  body: string;
  /** Speaker notes, stored in their own part and linked by relationship. */
  notes?: string;
}

const slideXml = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${P_NS}" xmlns:a="${A_NS}"><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;

const notesXml = (text: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="${P_NS}" xmlns:a="${A_NS}"><p:cSld><p:spTree>${shape([text])}</p:spTree></p:cSld></p:notes>`;

/**
 * `slides` is in presentation order. `notesNumbering` optionally decides which
 * notesSlideN.xml each slide's notes are written to — pass a descending order
 * to prove the parser follows relationships rather than matching numbers.
 */
export const buildPptx = async (
  slides: Slide[],
  notesNumbering?: (slideIndex: number) => number,
): Promise<ArrayBuffer> => {
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
  <Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="${P_NS}" xmlns:r="${R_NS}"><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
      .join('')}</p:sldIdLst></p:presentation>`,
  );

  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    zip.file(`ppt/slides/slide${slideNumber}.xml`, slideXml(slide.body));

    if (slide.notes === undefined) {
      zip.file(
        `ppt/slides/_rels/slide${slideNumber}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}"/>`,
      );
      return;
    }

    const notesNumber = notesNumbering ? notesNumbering(index) : slideNumber;
    zip.file(`ppt/notesSlides/notesSlide${notesNumber}.xml`, notesXml(slide.notes));
    zip.file(
      `ppt/slides/_rels/slide${slideNumber}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_NS}">
  <Relationship Id="rId2" Type="${R_NS}/notesSlide" Target="../notesSlides/notesSlide${notesNumber}.xml"/>
</Relationships>`,
    );
  });

  return zip.generateAsync({ type: 'arraybuffer' });
};
