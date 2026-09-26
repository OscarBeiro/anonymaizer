import { describe, expect, it } from 'vitest';
import { buildXlsx, date, empty, formula, number, percent, text } from './__fixtures__/xlsx';
import { parse } from './xlsx';

describe('.xlsx parser', () => {
  it('emits one headed Markdown table per sheet, in workbook order', async () => {
    const bytes = await buildXlsx([
      { name: 'Clientes', rows: [[text('Nombre'), text('DNI')], [text('Mario Prieto Casal'), text('45678912S')]] },
      { name: 'Facturas', rows: [[text('Numero')], [text('F-001')]] },
    ]);
    const { markdown, format } = await parse(bytes, 'libro.xlsx');
    expect(format).toBe('xlsx');
    expect(markdown).toBe(
      [
        '## Clientes',
        '',
        '| Nombre | DNI |',
        '| --- | --- |',
        '| Mario Prieto Casal | 45678912S |',
        '',
        '## Facturas',
        '',
        '| Numero |',
        '| --- |',
        '| F-001 |',
      ].join('\n'),
    );
  });

  it('renders a percent cell as Excel shows it, not as the stored fraction', async () => {
    const bytes = await buildXlsx([
      { name: 'P', rows: [[text('Avance'), text('Desvío')], [percent(0.25), percent(0.125, 2)], [percent(1), percent(0.0007, 2)]] },
    ]);
    const { markdown } = await parse(bytes, 'p.xlsx');
    expect(markdown).toContain('| 25% | 12.50% |');
    expect(markdown).toContain('| 100% | 0.07% |');
    expect(markdown).not.toContain('0.25');
  });

  it('renders a date cell as a date, not an Excel serial number', async () => {
    // 46283 is 2026-09-18 in Excel's 1900 system.
    const bytes = await buildXlsx([{ name: 'H', rows: [[text('Fecha')], [date(46283)]] }]);
    const { markdown } = await parse(bytes, 'f.xlsx');
    expect(markdown).toContain('2026-09-18');
    expect(markdown).not.toContain('46283');
  });

  it('does not mistake the 1900 leap-year bug boundary', async () => {
    // Serial 59 is 1900-02-28, 61 is 1900-03-01; serial 60 is Excel's
    // non-existent 1900-02-29.
    const bytes = await buildXlsx([{ name: 'H', rows: [[date(59)], [date(61)]] }]);
    const { markdown } = await parse(bytes, 'f.xlsx');
    expect(markdown).toContain('1900-02-28');
    expect(markdown).toContain('1900-03-01');
  });

  it('keeps a number as a number', async () => {
    const bytes = await buildXlsx([{ name: 'H', rows: [[text('Importe')], [number(1234.56)]] }]);
    const { markdown } = await parse(bytes, 'n.xlsx');
    expect(markdown).toContain('1234.56');
  });

  it('uses a formula\'s cached value and warns that formulas were flattened', async () => {
    const bytes = await buildXlsx([
      { name: 'H', rows: [[text('Total')], [formula('SUM(B1:B9)', '42')]] },
    ]);
    const { markdown, warnings } = await parse(bytes, 'form.xlsx');
    expect(markdown).toContain('| 42 |');
    expect(markdown).not.toContain('SUM');
    expect(warnings?.join(' ')).toMatch(/formula/i);
  });

  it('keeps an empty cell as an empty column rather than shifting the row', async () => {
    const bytes = await buildXlsx([
      { name: 'H', rows: [[text('a'), text('b'), text('c')], [text('1'), empty(), text('3')]] },
    ]);
    const { markdown } = await parse(bytes, 'e.xlsx');
    expect(markdown).toContain('| 1 |  | 3 |');
  });

  it('places a cell by its column reference, so a sparse row is not compacted', async () => {
    // A real producer omits untouched cells entirely: this row jumps A -> C.
    const bytes = await buildXlsx([{ name: 'H', rows: [[text('a'), text('b'), text('c')]] }]);
    const { markdown } = await parse(bytes, 's.xlsx');
    expect(markdown).toContain('| a | b | c |');
  });

  it('skips an empty sheet and warns, naming it', async () => {
    const bytes = await buildXlsx([
      { name: 'Datos', rows: [[text('a')], [text('1')]] },
      { name: 'Hoja vacia', rows: [] },
    ]);
    const { markdown, warnings } = await parse(bytes, 'v.xlsx');
    expect(markdown).not.toContain('Hoja vacia');
    expect(warnings?.join(' ')).toContain('Hoja vacia');
  });

  it('leaves warnings undefined for an ordinary workbook', async () => {
    const bytes = await buildXlsx([{ name: 'H', rows: [[text('a')], [text('1')]] }]);
    const { warnings } = await parse(bytes, 'ok.xlsx');
    expect(warnings).toBeUndefined();
  });

  it('warns when a sheet is very large', async () => {
    const rows = Array.from({ length: 6000 }, (_, i) => [text(`n${i}`), text(`d${i}`)]);
    const { warnings } = await parse(await buildXlsx([{ name: 'Grande', rows }]), 'g.xlsx');
    expect(warnings?.join(' ')).toMatch(/6000 rows/);
  });

  it('throws an error naming the file when the bytes are not a workbook', async () => {
    const notAWorkbook = new TextEncoder().encode('nope').buffer;
    await expect(parse(notAWorkbook, 'roto.xlsx')).rejects.toThrow(/roto\.xlsx/);
  });

  it('warns and returns empty markdown when every sheet is empty', async () => {
    const bytes = await buildXlsx([{ name: 'Uno', rows: [] }]);
    const { markdown, warnings } = await parse(bytes, 'vacio.xlsx');
    expect(markdown).toBe('');
    expect(warnings?.join(' ')).toMatch(/no extractable text/i);
  });
});
