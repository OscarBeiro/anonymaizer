import { describe, expect, it } from 'vitest';
import { detectSalutationNames, propagateNameMentions } from './nameMentions';
import { RUNG, type DetectedSpan } from './types';

const texts = (spans: DetectedSpan[]) => spans.map((s) => s.text);

describe('detectSalutationNames', () => {
  it.each([
    ['Ola Iria,\n\ngrazas polo resumo.', 'Iria'],
    ['Hola Marta,\nte paso los datos', 'Marta'],
    ['Hi Sarah,\nFollowing up', 'Sarah'],
    ['Dear Mr Patel,\nThank you', 'Patel'],
    ['Nota: a Sra. Fernández debe achegar', 'Fernández'],
    ['en tratamento co Dr. Suárez, do Centro', 'Suárez'],
    ['Que o señor Costas é propietario', 'Costas'],
    ['en seguimiento por la Dra. Herrera en el', 'Herrera'],
  ])('finds the name in %j', (text, name) => {
    const spans = detectSalutationNames(text);
    expect(texts(spans)).toEqual([name]);
    expect(text.slice(spans[0].start, spans[0].end)).toBe(name);
  });

  it('keeps multi-word names whole', () => {
    expect(texts(detectSalutationNames('Dona María do Carme Fernández, con DNI'))).toEqual(['María do Carme Fernández']);
  });

  it.each([
    'Hola Mundo cruel y frío',
    'a dona da casa',
    'Dear Team,',
  ])('leaves %j alone', (text) => {
    expect(detectSalutationNames(text, new Set(['team']))).toEqual([]);
  });
});

describe('propagateNameMentions', () => {
  const name = (text: string, value: string): DetectedSpan => {
    const start = text.indexOf(value);
    return { start, end: start + value.length, category: 'NAME', text: value, confidence: 0.6, source: 'regex', rung: RUNG.NAME };
  };

  it('finds later standalone mentions of a found name', () => {
    const text = 'Paciente: Antía Varela Souto. Durante o ingreso a Antía evoluciona. Varela non fuma.';
    const spans = propagateNameMentions(text, [name(text, 'Antía Varela Souto')]);
    expect(texts(spans)).toEqual(['Antía', 'Varela']);
    expect(spans.every((s) => s.rung === RUNG.NAME && s.confidence === 0.5)).toBe(true);
  });

  it('ignores lower-case words, particles and excluded words', () => {
    const text = 'Paulo de Souto e Informe. O souto de Paulo. Informe final.';
    const spans = propagateNameMentions(text, [name(text, 'Paulo de Souto e Informe')], new Set(['informe']));
    expect(texts(spans)).toEqual(['Paulo']);
  });

  it('returns nothing without names and skips shields', () => {
    const text = 'Lei de Galicia. Galicia.';
    expect(propagateNameMentions(text, [])).toEqual([]);
    expect(propagateNameMentions(text, [{ ...name(text, 'Lei de Galicia'), shield: true }])).toEqual([]);
  });
});
