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

  // Reversed deliberately (2026-09-21, during M3). This detector used to
  // reject every sentence-initial candidate, which meant a name opening a line
  // was never masked — and documents are full of those: salutations, From:/To:
  // blocks, signature lines, slide titles, table cells. A leak is worse than
  // an over-mask the user can untick in step 2.
  it('matches a sentence-initial name candidate', () => {
    const spans = detectNames('Oscar Beiro llamó ayer.');
    expect(spans.some((s) => s.text === 'Oscar Beiro')).toBe(true);
  });

  it('matches a name on a bare line of its own, as in a signature block', () => {
    const spans = detectNames('Mario Prieto Casal');
    expect(spans.map((s) => s.text)).toEqual(['Mario Prieto Casal']);
  });

  it('matches a name opening a sentence mid-paragraph', () => {
    const spans = detectNames('Hola. Mario Prieto Casal fue evaluado.');
    expect(spans.some((s) => s.text === 'Mario Prieto Casal')).toBe(true);
  });

  it('still rejects a sentence-initial pair containing a stopword', () => {
    expect(detectNames('Muchas Gracias por todo.')).toHaveLength(0);
    expect(detectNames('Buenas Tardes, ya lo tengo.')).toHaveLength(0);
  });

  it('strips a document-structure head instead of reading it as a given name', () => {
    expect(detectNames('Expediente EV-014/2026.')).toHaveLength(0);
    expect(detectNames('Informe Final')).toHaveLength(0);
    expect(detectNames('Asunto: Revisión')).toHaveLength(0);
  });

  it('strips a structure head but keeps the name that follows it', () => {
    const spans = detectNames('Paciente Mario Prieto Casal');
    expect(spans.map((s) => s.text)).toEqual(['Mario Prieto Casal']);
  });

  it('does not mint a role title under a signature as a person', () => {
    expect(detectNames('Atentamente,\nLaura Ferreiro\nDirectora General').map((s) => s.text)).toEqual([
      'Laura Ferreiro',
    ]);
  });

  it('strips a chain of leading labels down to the name, including a particle', () => {
    // "Informe" (structure head) then "de" (particle) then "Evaluación"
    // (structure head) leaves one token, so the heading is not a person.
    expect(detectNames('Informe de Evaluación Anual')).toHaveLength(0);
  });

  it('matches an ALL-CAPS name on a line of its own', () => {
    const spans = detectNames('FERREIRO IGLESIAS LAURA');
    expect(spans.map((s) => s.text)).toEqual(['FERREIRO IGLESIAS LAURA']);
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
