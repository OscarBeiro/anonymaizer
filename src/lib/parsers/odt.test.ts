import { describe, expect, it } from 'vitest';
import {
  annotation,
  buildOdt,
  embeddedObject,
  heading,
  image,
  list,
  paragraph,
  spannedParagraph,
  table,
  trackedChanges,
} from './__fixtures__/odt';
import { parse } from './odt';

describe('.odt parser', () => {
  it('maps outline levels to atx heading depth', async () => {
    const bytes = await buildOdt(heading('Informe', 1) + heading('Antecedentes', 2) + heading('Detalle', 3));
    const { markdown, format } = await parse(bytes, 'informe.odt');
    expect(format).toBe('odt');
    expect(markdown).toContain('# Informe');
    expect(markdown).toContain('## Antecedentes');
    expect(markdown).toContain('### Detalle');
  });

  it('keeps paragraphs separate and rejoins text split across spans', async () => {
    const bytes = await buildOdt(
      paragraph('Primer parrafo.') + spannedParagraph(['Mario ', 'Prieto ', 'Casal']),
    );
    const { markdown } = await parse(bytes, 'p.odt');
    expect(markdown).toBe('Primer parrafo.\n\nMario Prieto Casal');
  });

  it('converts a nested list, indenting the sublist', async () => {
    const bytes = await buildOdt(list(['primero', ['anidado'], 'segundo']));
    const { markdown } = await parse(bytes, 'lista.odt');
    expect(markdown).toBe('- primero\n  - anidado\n- segundo');
  });

  it('converts a table, treating the first row as the header', async () => {
    const bytes = await buildOdt(
      table([
        ['Nombre', 'DNI'],
        ['Mario Prieto Casal', '45678912S'],
      ]),
    );
    const { markdown } = await parse(bytes, 'tabla.odt');
    expect(markdown).toBe(
      '| Nombre | DNI |\n| --- | --- |\n| Mario Prieto Casal | 45678912S |',
    );
  });

  it('escapes a pipe inside a table cell', async () => {
    const bytes = await buildOdt(table([['a | b', 'c']]));
    const { markdown } = await parse(bytes, 'pipe.odt');
    expect(markdown).toContain('| a \\| b | c |');
  });

  it('includes a comment\'s text so it reaches the detectors, and warns naming its author', async () => {
    const bytes = await buildOdt(
      paragraph('Texto principal.') + annotation('Laura Ferreiro', 'Revisar el DNI de Mario.'),
    );
    const { markdown, warnings } = await parse(bytes, 'comentario.odt');
    expect(markdown).toContain('Revisar el DNI de Mario.');
    expect(warnings?.join(' ')).toMatch(/comment/i);
    expect(warnings?.join(' ')).toContain('Laura Ferreiro');
  });

  it('warns that tracked changes name their author, rather than dropping them silently', async () => {
    const bytes = await buildOdt(trackedChanges('Laura Ferreiro') + paragraph('Texto.'));
    const { markdown, warnings } = await parse(bytes, 'cambios.odt');
    // The change-tracking machinery is not prose and must not land in the text.
    expect(markdown).toBe('Texto.');
    expect(warnings?.join(' ')).toMatch(/tracked change/i);
    expect(warnings?.join(' ')).toContain('Laura Ferreiro');
  });

  it('warns about document metadata, naming what the file carries, without putting it in the text', async () => {
    const bytes = await buildOdt(paragraph('Texto.'), {
      creator: 'Laura Ferreiro',
      initialCreator: 'Mario Prieto',
      editingCycles: 7,
    });
    const { markdown, warnings } = await parse(bytes, 'meta.odt');
    expect(markdown).toBe('Texto.');
    const warningText = warnings?.join(' ') ?? '';
    expect(warningText).toMatch(/metadata/i);
    expect(warningText).toContain('Laura Ferreiro');
    expect(warningText).toContain('Mario Prieto');
  });

  it('says nothing about metadata when the file carries none', async () => {
    const bytes = await buildOdt(paragraph('Texto.'));
    const { warnings } = await parse(bytes, 'limpio.odt');
    expect(warnings).toBeUndefined();
  });

  it('warns about dropped images and embedded objects', async () => {
    const bytes = await buildOdt(paragraph('Texto.') + image() + embeddedObject());
    const { warnings } = await parse(bytes, 'imagenes.odt');
    const warningText = warnings?.join(' ') ?? '';
    expect(warningText).toMatch(/image/i);
    expect(warningText).toMatch(/embedded object/i);
  });

  it('warns and returns empty markdown for a document with no text', async () => {
    const bytes = await buildOdt('');
    const { markdown, warnings } = await parse(bytes, 'vacio.odt');
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/no extractable text/i);
  });

  it('throws an error naming the file when the zip is not an ODF package', async () => {
    const notAnOdt = new TextEncoder().encode('nope').buffer;
    await expect(parse(notAnOdt, 'roto.odt')).rejects.toThrow(/roto\.odt/);
  });

  it('throws when the zip is valid but has no content.xml', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
    const bytes = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(parse(bytes, 'sincontenido.odt')).rejects.toThrow(/sincontenido\.odt/);
  });
});
