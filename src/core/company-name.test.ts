import { describe, expect, it } from 'vitest';
import { detectCompanies, detectCompanyAcronyms, detectNames } from './detectors';

describe('detectCompanies — suffix form', () => {
  it.each([
    ['TICGAL, SL', 'TICGAL, SL'],
    ['TICGAL SLU', 'TICGAL SLU'],
    ['Acme Corp.', 'Acme Corp.'],
    ['Müller GmbH', 'Müller GmbH'],
  ])('matches %s', (input, expected) => {
    const spans = detectCompanies(input);
    expect(spans.map((s) => s.text)).toContain(expected);
    expect(spans.find((s) => s.text === expected)?.category).toBe('COMPANY');
  });
});

describe('detectCompanies — prefix form', () => {
  it('matches Grupo Inditex', () => {
    const spans = detectCompanies('Grupo Inditex');
    expect(spans.some((s) => s.text === 'Grupo Inditex')).toBe(true);
  });
});

describe('detectCompanyAcronyms', () => {
  it('matches a standalone ALL-CAPS run at confidence 0.4, disabled', () => {
    const spans = detectCompanyAcronyms('el proveedor es TICGAL para este proyecto');
    const match = spans.find((s) => s.text === 'TICGAL');
    expect(match).toMatchObject({ confidence: 0.4, enabled: false, category: 'COMPANY' });
  });

  it('excludes fiscal/technical acronyms', () => {
    const spans = detectCompanyAcronyms('el IVA y el IRPF se calculan con el NIF, no el DNI, ni el PDF ni la URL de la API. OK.');
    expect(spans).toHaveLength(0);
  });
});

describe('detectNames', () => {
  it.each([
    'Oscar Beiro',
    'Miguel Ángel García de la Vega',
    'Laura Fernández-Smith',
    'François Müller',
    'Amélie de la Tour',
    'João da Silva',
    'Ana Söder',
    'Ludwig von Trapp',
  ])('matches %s as a single NAME at confidence 0.6', (name) => {
    const spans = detectNames(`Hola, hoy hablé con ${name} sobre el proyecto.`);
    const match = spans.find((s) => s.text === name);
    expect(match).toMatchObject({ category: 'NAME', confidence: 0.6, source: 'regex' });
  });

  it('does not false-positive on a lone sentence-initial capitalized word', () => {
    const spans = detectNames('Hoy fue un buen día para trabajar.');
    expect(spans).toHaveLength(0);
  });

  it('rejects a sentence-initial name candidate', () => {
    const spans = detectNames('Oscar Beiro llamó ayer.');
    expect(spans.some((s) => s.text === 'Oscar Beiro')).toBe(false);
  });

  it('rejects a stopword-led sequence like a greeting', () => {
    const spans = detectNames('Hola, Estimado Señor, le escribo por este motivo.');
    expect(spans).toHaveLength(0);
  });

  it('peels a leading English greeting off instead of swallowing the name with it', () => {
    const spans = detectNames('Dear Clara Vance, thank you for reaching out.');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Clara Vance');
  });

  it('does not treat a "Label:" line as a name', () => {
    const spans = detectNames('Phone Number: 555-0100');
    expect(spans).toHaveLength(0);
  });

  it('does not chain a name across a line break into the next field label', () => {
    const spans = detectNames('Name: Clara Vance\n\nEmail: clara@example.com');
    expect(spans.map((s) => s.text)).toContain('Clara Vance');
  });

  it('rejects a single-letter token even when it clears the two-token floor by borrowing a following word', () => {
    // The masked DNI's trailing check letter ("E") combining with a real
    // capitalized word right after it must not read as a NAME.
    const spans = detectNames('DNI 45****78Q. E Ferreiro firmó el documento.');
    expect(spans.some((s) => s.text.startsWith('E '))).toBe(false);
  });

  it('does not start a match attached to the previous character (masked ID boundary)', () => {
    const spans = detectNames('DNI 45****78Q evaluado por Laura Ferreiro.');
    expect(spans.some((s) => s.text.includes('Q evaluado') || /^Q\b/.test(s.text))).toBe(false);
    expect(spans.some((s) => s.text === 'Laura Ferreiro')).toBe(true);
  });

  it('still matches a real initial-form name ("J. Smith")', () => {
    const spans = detectNames('Contactado por J. Smith ayer.');
    expect(spans.some((s) => s.text === 'J. Smith')).toBe(true);
  });
});
