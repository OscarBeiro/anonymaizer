import { describe, expect, it } from 'vitest';
import { runAllDetectors } from '../../core/detectors';
import { runDetectionPipeline } from '../../core/pipeline';
import { parse } from './csv';

const toBytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer;

describe('.csv parser', () => {
  it('emits a Markdown table with the header row first', async () => {
    const { markdown, format } = await parse(toBytes('Nombre,DNI\nMario Prieto Casal,45678912S'));
    expect(format).toBe('csv');
    expect(markdown).toBe('| Nombre | DNI |\n| --- | --- |\n| Mario Prieto Casal | 45678912S |');
  });

  it('keeps a delimiter that sits inside a quoted field', async () => {
    const { markdown } = await parse(toBytes('a,b\n"Prieto Casal, Mario",x'));
    expect(markdown).toContain('| Prieto Casal, Mario | x |');
  });

  it('flattens a newline embedded in a quoted field onto the row', async () => {
    const { markdown } = await parse(toBytes('a,b\n"linea uno\nlinea dos",x'));
    expect(markdown).toContain('| linea uno linea dos | x |');
    expect(markdown.split('\n')).toHaveLength(3);
  });

  it('unescapes a doubled quote inside a quoted field', async () => {
    const { markdown } = await parse(toBytes('a,b\n"dijo ""hola""",x'));
    expect(markdown).toContain('| dijo "hola" | x |');
  });

  it('sniffs a semicolon-delimited European export', async () => {
    const { markdown } = await parse(toBytes('Nombre;Importe\nMario;1.234,56'));
    expect(markdown).toBe('| Nombre | Importe |\n| --- | --- |\n| Mario | 1.234,56 |');
  });

  it('sniffs a tab-delimited export', async () => {
    const { markdown } = await parse(toBytes('Nombre\tDNI\nMario\t45678912S'));
    expect(markdown).toContain('| Nombre | DNI |');
  });

  it('counts delimiters only outside quotes when sniffing', async () => {
    // Three commas, but all inside one quoted field; the real delimiter is ';'.
    const { markdown } = await parse(toBytes('a;b\n"uno,dos,tres,cuatro";x'));
    expect(markdown).toContain('| uno,dos,tres,cuatro | x |');
  });

  it('handles CRLF line endings', async () => {
    const { markdown } = await parse(toBytes('a,b\r\n1,2\r\n'));
    expect(markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('pads a ragged row rather than dropping its cells', async () => {
    const { markdown, warnings } = await parse(toBytes('a,b,c\n1,2\n3,4,5,6'));
    const lines = markdown.split('\n');
    // Widened to the longest row: a dropped cell would be data lost to
    // detection, which matters more here than a tidy table.
    expect(lines[0]).toBe('| a | b | c |  |');
    expect(lines).toContain('| 1 | 2 |  |  |');
    expect(lines).toContain('| 3 | 4 | 5 | 6 |');
    expect(warnings?.join(' ')).toMatch(/rows have a different number of cells/i);
  });

  it('ignores a trailing newline instead of emitting an empty row', async () => {
    const { markdown } = await parse(toBytes('a,b\n1,2\n\n'));
    expect(markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('drops an all-blank row, which holds nothing to detect', async () => {
    const { markdown } = await parse(toBytes('a,b\n1,2\n,\n3,4'));
    expect(markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |');
  });

  it('warns above the row threshold', async () => {
    const rows = ['nombre,dni', ...Array.from({ length: 6000 }, (_, i) => `n${i},d${i}`)].join('\n');
    const { warnings } = await parse(toBytes(rows));
    expect(warnings?.join(' ')).toMatch(/6001 rows/);
  });

  it('leaves warnings undefined for an ordinary small file', async () => {
    const { warnings } = await parse(toBytes('a,b\n1,2'));
    expect(warnings).toBeUndefined();
  });

  it('warns and returns empty markdown for an empty file', async () => {
    const { markdown, warnings } = await parse(toBytes('   \n'));
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/no rows/i);
  });

  it('strips a UTF-8 BOM so the first header is not corrupted', async () => {
    const { markdown } = await parse(toBytes('﻿Nombre,DNI\nMario,45678912S'));
    expect(markdown.startsWith('| Nombre |')).toBe(true);
  });

  // D2, end to end: found at P8e in exactly this shape — a contact-list
  // export with "Apellidos, Nombre" columns quoted together (see "keeps a
  // delimiter that sits inside a quoted field" above), read alongside a
  // second row naming the same person given-first. Round-tripped through the
  // real .csv parser rather than a hand-built string, so the parser's own
  // Markdown-table escaping is exercised too, not just detectNames in
  // isolation.
  it('carries the "Apellidos, Nombre" case through parsing to one clustered NAME (D2)', async () => {
    const { markdown } = await parse(
      toBytes('Nombre,Cargo\n"Ferreiro Iglesias, Laura",Psicóloga\n"Laura Ferreiro",Testigo'),
    );
    const { mappings, anonymizedText } = runDetectionPipeline(markdown, runAllDetectors(markdown));

    const nameMappings = mappings.filter((m) => m.category === 'NAME');
    expect(nameMappings).toHaveLength(1);
    expect(nameMappings[0].originalText).toBe('Laura Ferreiro Iglesias');
    expect(anonymizedText).not.toContain('Laura');
    expect(anonymizedText).toContain('| [[NAME_001]] | Psicóloga |');
    expect(anonymizedText).toContain('| [[NAME_001]] | Testigo |');
  });
});
