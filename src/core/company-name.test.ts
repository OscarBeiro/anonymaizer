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

  // D5: legal/business/tech acronyms are vocabulary, not counterparties.
  it.each(['NDA', 'SLA', 'CEO', 'CTO', 'RGPD', 'GDPR', 'LOPD', 'KPI', 'ONG', 'BOE', 'EUR', 'USD', 'IT', 'RRHH', 'CRM', 'ERP', 'FAQ'])(
    'does not flag %s',
    (acronym) => {
      expect(detectCompanyAcronyms(`Revisad el ${acronym} antes del lunes.`)).toHaveLength(0);
    },
  );

  it('still flags an unknown acronym next to a known one', () => {
    const spans = detectCompanyAcronyms('Firmamos el NDA con ACME ayer.');
    expect(spans.map((s) => s.text)).toEqual(['ACME']);
  });
});

describe('detectNames: lone initials (D6)', () => {
  it.each([
    'Véase el Punto G. Anexo A del contrato.',
    'Según el Anexo B. Cláusula tercera, procede.',
    'Elegimos la Opción C. Según lo acordado, sigue.',
    'Ver Apartado D. Sección segunda.',
  ])('does not read a lettered item as a person: %s', (text) => {
    expect(detectNames(text)).toEqual([]);
  });

  it.each(['Juan G. Pérez', 'J. Smith', 'María J. López García'])('still detects %s', (name) => {
    const spans = detectNames(`Firmó ayer ${name} el acuerdo.`);
    expect(spans.map((s) => s.text)).toContain(name);
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

  // D2: "Surname Surname, Given" is one person. The base regex above never
  // crosses a comma, so without this the comma ends the candidate and the
  // given name is left in plain text — worse than an ordinary miss, since
  // the mapping doesn't record them as one person either.
  describe('comma form (D2)', () => {
    it('reads "Surname Surname, Given" as one NAME span covering the whole string', () => {
      const spans = detectNames('Ferreiro Iglesias, Laura firmó el acta.');
      expect(spans).toHaveLength(1);
      expect(spans[0].category).toBe('NAME');
      // The document range covers the literal comma-bearing text — only the
      // recorded span.text is reordered (see the "given-name-first" test).
      expect(spans[0].start).toBe(0);
      expect(spans[0].end).toBe('Ferreiro Iglesias, Laura'.length);
    });

    it('canonicalizes the recorded text given-name-first, comma dropped', () => {
      const [span] = detectNames('Ferreiro Iglesias, Laura firmó el acta.');
      expect(span.text).toBe('Laura Ferreiro Iglesias');
    });

    it('does not require the comma form — a plain given-first name is untouched', () => {
      const spans = detectNames('Laura Ferreiro firmó el acta.');
      expect(spans.map((s) => s.text)).toEqual(['Laura Ferreiro']);
    });

    it('does not widen across the comma when only one token precedes it', () => {
      // The trap from the plan: "Mario, Laura y Ana" is a list, not a
      // two-part name — "Mario" alone never clears the 2-token floor that
      // gates the comma extension in the first place.
      const spans = detectNames('Mario, Laura y Ana asistieron.');
      expect(spans.some((s) => s.text.startsWith('Mario'))).toBe(false);
    });

    it('does not swallow a locality pair', () => {
      expect(detectNames('Vive en Madrid, Spain desde hace años.')).toHaveLength(0);
    });

    it('does not swallow a company suffix across the comma', () => {
      const spans = detectNames('Contrató a Acme Consulting, S.L. para el proyecto.');
      // "Acme Consulting" still matches as NAME on its own (arbitration in
      // the full pipeline is what lets COMPANY win it — see pipeline.test.ts
      // / detectors' §4a ordering), but the span must stop before the comma.
      expect(spans.map((s) => s.text)).toEqual(['Acme Consulting']);
    });

    it('does not swallow an ID that happens to follow the comma', () => {
      expect(detectNames('Firmante: Prieto, 45678912S')).toHaveLength(0);
    });

    it('does not swallow a non-name sentence fragment after the comma', () => {
      const spans = detectNames('Ferreiro Iglesias, responsable del proyecto y firmante del acta.');
      expect(spans.map((s) => s.text)).toEqual(['Ferreiro Iglesias']);
    });

    it('stops at a table cell boundary instead of reaching into the next cell', () => {
      const spans = detectNames('| Prieto Casal, Mario | 45678912S |');
      expect(spans.map((s) => s.text)).toEqual(['Mario Prieto Casal']);
    });
  });
});
