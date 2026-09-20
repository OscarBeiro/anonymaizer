import { describe, expect, it } from 'vitest';
import { detectIdCodes, detectMaskedIds, detectNames } from './detectors';

describe('detectMaskedIds', () => {
  it('matches a masked DNI as one span', () => {
    const spans = detectMaskedIds('DNI 76****12E vigente.');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ text: '76****12E', category: 'MASKED_ID' });
  });

  it('matches a leading-masked value', () => {
    const spans = detectMaskedIds('tarjeta ****1234 caducada');
    expect(spans.some((s) => s.text === '****1234')).toBe(true);
  });

  it('leaves NAME unable to reach into the masked value once shielded by the span', () => {
    const spans = detectNames('DNI 76****12E vigente.');
    expect(spans.some((s) => s.text.endsWith('E'))).toBe(false);
  });

  it('ignores an ordinary word', () => {
    const spans = detectMaskedIds('el texto explica el proyecto');
    expect(spans).toHaveLength(0);
  });
});

describe('detectIdCodes', () => {
  it('matches a professional membership code, leaving the label untouched', () => {
    const spans = detectIdCodes('colegiada T-04250 en activo');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ text: 'T-04250', category: 'ID_CODE' });
  });

  it('matches a case reference after "Expediente"', () => {
    const spans = detectIdCodes('Ref. Expediente EV-023/2026 abierto en 2026.');
    expect(spans.some((s) => s.text === 'EV-023/2026')).toBe(true);
  });

  it('matches "Nº Colegiado" as the more specific trigger over the bare "Nº"', () => {
    const spans = detectIdCodes('Nº Colegiado 12345');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('12345');
  });

  it('does not fire on an unrelated numeric reference with no trigger word', () => {
    const spans = detectIdCodes('el artículo 2000/78 regula esto.');
    expect(spans).toHaveLength(0);
  });
});
