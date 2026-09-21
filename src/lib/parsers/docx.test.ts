import { describe, expect, it } from 'vitest';
import { CLINICAL_REPORT_FIXTURE } from '../../core/__fixtures__/clinicalReport';
import { runDetectionPipeline } from '../../core/pipeline';
import { runAllDetectors } from '../../core/detectors';
import { buildDocx, listItem, paragraph, table, unknownStyleParagraph } from './__fixtures__/docx';
import { parse } from './docx';

describe('.docx parser', () => {
  it('converts headings to atx Markdown at their real depth', async () => {
    const bytes = await buildDocx(
      paragraph('Informe psicológico', 'Heading1') +
        paragraph('Antecedentes', 'Heading2') +
        paragraph('Detalle', 'Heading3'),
    );
    const { markdown, format } = await parse(bytes, 'informe.docx');
    expect(format).toBe('docx');
    expect(markdown).toContain('# Informe psicológico');
    expect(markdown).toContain('## Antecedentes');
    expect(markdown).toContain('### Detalle');
  });

  it('keeps bullet, numbered and nested list items as a Markdown list', async () => {
    const bytes = await buildDocx(
      listItem('primero') + listItem('anidado', false, 1) + listItem('segundo') + listItem('uno', true),
    );
    const { markdown } = await parse(bytes, 'lista.docx');
    expect(markdown).toContain('-   primero');
    expect(markdown).toContain('anidado');
    expect(markdown).toContain('-   segundo');
    expect(markdown).toContain('1.  uno');
  });

  it('converts a table into a Markdown table with a delimiter row', async () => {
    const bytes = await buildDocx(
      table([
        ['Nombre', 'DNI'],
        ['Mario Prieto', '45678912S'],
      ]),
    );
    const { markdown } = await parse(bytes, 'tabla.docx');
    expect(markdown).toContain('| Nombre | DNI |');
    expect(markdown).toContain('| --- | --- |');
    expect(markdown).toContain('| Mario Prieto | 45678912S |');
  });

  it('collects mammoth messages into warnings', async () => {
    const bytes = await buildDocx(unknownStyleParagraph('Confidencial'));
    const { markdown, warnings } = await parse(bytes, 'marca.docx');
    expect(markdown).toContain('Confidencial');
    expect(warnings?.length).toBeGreaterThan(0);
    expect(warnings?.join(' ')).toMatch(/CorporateWatermark/);
  });

  it('leaves warnings undefined when the document converts cleanly', async () => {
    const bytes = await buildDocx(paragraph('Texto sin sorpresas.'));
    const { warnings } = await parse(bytes, 'limpio.docx');
    expect(warnings).toBeUndefined();
  });

  it('throws on a truncated zip rather than yielding an empty document', async () => {
    const valid = await buildDocx(paragraph('algo'));
    const truncated = valid.slice(0, Math.floor(valid.byteLength / 2));
    await expect(parse(truncated, 'roto.docx')).rejects.toThrow(/roto\.docx/);
  });

  it('throws on a zip that is not a Word document', async () => {
    const notADocx = new TextEncoder().encode('PK\u0003\u0004 not really a zip').buffer;
    await expect(parse(notADocx, 'raro.docx')).rejects.toThrow(/raro\.docx/);
  });

  it('warns and returns empty markdown for a document with no text at all', async () => {
    const bytes = await buildDocx('');
    const { markdown, warnings } = await parse(bytes, 'vacio.docx');
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/no extractable text/i);
  });

  it('carries the clinical report through to the same detections as pasted text', async () => {
    const bytes = await buildDocx(
      CLINICAL_REPORT_FIXTURE.split('\n')
        .map((line) => paragraph(line))
        .join(''),
    );
    const { markdown } = await parse(bytes, 'clinico.docx');
    const { mappings } = runDetectionPipeline(markdown, runAllDetectors(markdown));
    const categories = new Set(mappings.map((m) => m.category));
    expect(categories).toContain('NAME');
    expect(categories).toContain('MASKED_ID');
    // No stray escape artefacts from the HTML hop (P7f), and the masked DNI
    // survives byte-for-byte — its own '****' is why this cannot assert the
    // absence of '**' the way the emphasis fixture's test does.
    expect(markdown).not.toContain('\\_');
    expect(markdown).toContain('45****78Q');
  });
});
