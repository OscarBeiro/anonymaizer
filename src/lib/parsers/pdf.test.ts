import { describe, expect, it } from 'vitest';
import { buildPdf, buildPredefinedCMapPdf, twoColumnPage } from './__fixtures__/pdf';
import { parse } from './pdf';

describe('.pdf parser', () => {
  it('reflows a page into paragraphs, joining wrapped lines', async () => {
    const bytes = buildPdf([
      [
        { x: 60, y: 700, text: 'Informe psicologico sobre el' },
        { x: 60, y: 684, text: 'expediente EV-014/2026.' },
        // A wide vertical gap: a new paragraph, not a wrapped line.
        { x: 60, y: 620, text: 'Mario Prieto Casal fue evaluado' },
        { x: 60, y: 604, text: 'por Laura Ferreiro.' },
      ],
    ]);
    const { markdown, format } = await parse(bytes, 'informe.pdf');
    expect(format).toBe('pdf');
    expect(markdown).toBe(
      'Informe psicologico sobre el expediente EV-014/2026.\n\n' +
        'Mario Prieto Casal fue evaluado por Laura Ferreiro.',
    );
  });

  it('keeps pages in order and separates them', async () => {
    const bytes = buildPdf([
      [{ x: 60, y: 700, text: 'Pagina uno' }],
      [{ x: 60, y: 700, text: 'Pagina dos' }],
    ]);
    const { markdown } = await parse(bytes, 'dos.pdf');
    expect(markdown).toBe('Pagina uno\n\nPagina dos');
  });

  it('reads two columns one after the other instead of interleaving them', async () => {
    const bytes = buildPdf([
      twoColumnPage(
        ['Izquierda linea uno', 'Izquierda linea dos'],
        ['Derecha linea uno', 'Derecha linea dos'],
      ),
    ]);
    const { markdown } = await parse(bytes, 'columnas.pdf');
    expect(markdown).toBe(
      'Izquierda linea uno Izquierda linea dos\n\nDerecha linea uno Derecha linea dos',
    );
  });

  it('joins runs on the same line, inserting a space only across a real gap', async () => {
    const bytes = buildPdf([
      [
        { x: 60, y: 700, text: 'DNI' },
        // Inside the box pdfjs computes for "DNI", i.e. no gap at all, which
        // is what a tightly-kerned producer emits: no space inserted.
        { x: 72, y: 700, text: ':' },
        { x: 140, y: 700, text: '45678912S' },
      ],
    ]);
    const { markdown } = await parse(bytes, 'dni.pdf');
    expect(markdown).toBe('DNI: 45678912S');
  });

  it('warns and returns empty markdown for a scanned, image-only document', async () => {
    const bytes = buildPdf([[], []]);
    const { markdown, warnings } = await parse(bytes, 'escaneado.pdf');
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/scanned/i);
    expect(warnings?.join(' ')).toMatch(/no text/i);
  });

  it('leaves warnings undefined for an ordinary text document', async () => {
    const bytes = buildPdf([[{ x: 60, y: 700, text: 'Texto sin sorpresas.' }]]);
    const { warnings } = await parse(bytes, 'limpio.pdf');
    expect(warnings).toBeUndefined();
  });

  it('warns rather than silently grinding on a very long document', async () => {
    const pages = Array.from({ length: 120 }, (_, i) => [
      { x: 60, y: 700, text: `Pagina ${i + 1}` },
    ]);
    const { markdown, warnings } = await parse(buildPdf(pages), 'largo.pdf');
    expect(markdown).toContain('Pagina 120');
    expect(warnings?.join(' ')).toMatch(/120 pages/);
  });

  it('warns that text in a predefined (CJK) CMap was dropped, since pdfjs drops it silently', async () => {
    const bytes = buildPredefinedCMapPdf('Latin line: Mario Prieto Casal', '\u4f60\u597d\u4e16\u754c');
    const { markdown, warnings } = await parse(bytes, 'cjk.pdf');
    // What pdfjs actually does without a cMap: the Latin run survives, the
    // CJK run is gone, and nothing in the API mentions it.
    expect(markdown).toBe('Latin line: Mario Prieto Casal');
    expect(markdown).not.toContain('\u4f60');
    expect(warnings?.join(' ')).toMatch(/could not be read/i);
  });

  it('does not cry CMap over an ordinary WinAnsi document', async () => {
    const bytes = buildPdf([[{ x: 60, y: 700, text: 'Texto normal.' }]]);
    const { warnings } = await parse(bytes, 'normal.pdf');
    expect(warnings).toBeUndefined();
  });

  it('throws an error naming the file when the bytes are not a PDF', async () => {
    const notAPdf = new TextEncoder().encode('just some text, no %PDF header').buffer;
    await expect(parse(notAPdf, 'roto.pdf')).rejects.toThrow(/roto\.pdf/);
  });

  it('carries a document through to the same detections as pasted text', async () => {
    const bytes = buildPdf([
      [
        { x: 60, y: 700, text: 'Mario Prieto Casal, con DNI 45678912S,' },
        { x: 60, y: 684, text: 'escribe desde mario.prieto@example.com.' },
      ],
    ]);
    const { markdown } = await parse(bytes, 'clinico.pdf');
    expect(markdown).toContain('45678912S');
    expect(markdown).toContain('mario.prieto@example.com');
  });
});
