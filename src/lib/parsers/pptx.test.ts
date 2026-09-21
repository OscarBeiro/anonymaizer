import { describe, expect, it } from 'vitest';
import { buildPptx, chartFrame, picture, shape, splitRunShape, tableFrame } from './__fixtures__/pptx';
import { parse } from './pptx';

describe('.pptx parser', () => {
  it('emits one section per slide, headed and numbered', async () => {
    const bytes = await buildPptx([
      { body: shape(['Informe psicologico', 'Expediente EV-014/2026']) },
      { body: shape(['Conclusiones']) },
    ]);
    const { markdown, format } = await parse(bytes, 'deck.pptx');
    expect(format).toBe('pptx');
    expect(markdown).toBe(
      ['## Slide 1', '', 'Informe psicologico', '', 'Expediente EV-014/2026', '', '## Slide 2', '', 'Conclusiones'].join(
        '\n',
      ),
    );
  });

  it('orders slides numerically, so slide 10 does not come before slide 2', async () => {
    const slides = Array.from({ length: 12 }, (_, i) => ({ body: shape([`Contenido ${i + 1}`]) }));
    const { markdown } = await parse(await buildPptx(slides), 'largo.pptx');
    const order = [...markdown.matchAll(/## Slide (\d+)/g)].map((m) => Number(m[1]));
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Lexicographic ordering would put slide10's text right after slide1's.
    expect(markdown.indexOf('Contenido 2')).toBeLessThan(markdown.indexOf('Contenido 10'));
  });

  it('rejoins a paragraph split across runs', async () => {
    const bytes = await buildPptx([{ body: splitRunShape(['Mario ', 'Prieto ', 'Casal']) }]);
    const { markdown } = await parse(bytes, 'runs.pptx');
    expect(markdown).toContain('Mario Prieto Casal');
  });

  it('extracts text inside a table shape as a Markdown table', async () => {
    const bytes = await buildPptx([
      {
        body: tableFrame([
          ['Nombre', 'DNI'],
          ['Mario Prieto Casal', '45678912S'],
        ]),
      },
    ]);
    const { markdown } = await parse(bytes, 'tabla.pptx');
    expect(markdown).toContain('| Nombre | DNI |');
    expect(markdown).toContain('| --- | --- |');
    expect(markdown).toContain('| Mario Prieto Casal | 45678912S |');
  });

  it('includes speaker notes under a labelled sub-heading', async () => {
    const bytes = await buildPptx([
      { body: shape(['Portada']), notes: 'Recordar el DNI de Mario: 45678912S' },
    ]);
    const { markdown } = await parse(bytes, 'notas.pptx');
    expect(markdown).toContain('### Speaker notes');
    expect(markdown).toContain('Recordar el DNI de Mario: 45678912S');
  });

  it('follows the slide\'s relationship to find its notes, not the part number', async () => {
    // Notes written in reverse: slide 1's notes live in notesSlide2.xml.
    const bytes = await buildPptx(
      [
        { body: shape(['Primera']), notes: 'Notas de la primera' },
        { body: shape(['Segunda']), notes: 'Notas de la segunda' },
      ],
      (index) => (index === 0 ? 2 : 1),
    );
    const { markdown } = await parse(bytes, 'cruzadas.pptx');
    const firstSection = markdown.slice(markdown.indexOf('## Slide 1'), markdown.indexOf('## Slide 2'));
    expect(firstSection).toContain('Notas de la primera');
    expect(firstSection).not.toContain('Notas de la segunda');
  });

  it('does not throw for a deck with no notes parts at all', async () => {
    const bytes = await buildPptx([{ body: shape(['Sola']) }]);
    const { markdown, warnings } = await parse(bytes, 'sinnotas.pptx');
    expect(markdown).toContain('Sola');
    expect(markdown).not.toContain('Speaker notes');
    expect(warnings).toBeUndefined();
  });

  it('warns about dropped pictures and charts', async () => {
    const bytes = await buildPptx([{ body: shape(['Texto']) + picture() + chartFrame() }]);
    const { warnings } = await parse(bytes, 'media.pptx');
    const warningText = warnings?.join(' ') ?? '';
    expect(warningText).toMatch(/image/i);
    expect(warningText).toMatch(/chart/i);
  });

  it('skips a slide with no text but keeps the numbering of the others', async () => {
    const bytes = await buildPptx([
      { body: shape(['Primera']) },
      { body: picture() },
      { body: shape(['Tercera']) },
    ]);
    const { markdown } = await parse(bytes, 'hueco.pptx');
    expect(markdown).toContain('## Slide 1');
    expect(markdown).toContain('## Slide 3');
    expect(markdown).not.toContain('## Slide 2');
  });

  it('warns and returns empty markdown for a deck with no text anywhere', async () => {
    const bytes = await buildPptx([{ body: picture() }]);
    const { markdown, warnings } = await parse(bytes, 'vacio.pptx');
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/no extractable text/i);
  });

  it('throws an error naming the file when the bytes are not a deck', async () => {
    const notADeck = new TextEncoder().encode('nope').buffer;
    await expect(parse(notADeck, 'roto.pptx')).rejects.toThrow(/roto\.pptx/);
  });
});
