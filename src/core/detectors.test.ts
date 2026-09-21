import { describe, expect, it } from 'vitest';
import {
  detectAddresses,
  detectCreditCards,
  detectDni,
  detectEmails,
  detectIbans,
  detectNie,
  detectPhones,
} from './detectors';

describe('detectEmails', () => {
  it('finds an email', () => {
    const spans = detectEmails('contact oscar@example.com now');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ text: 'oscar@example.com', category: 'EMAIL' });
  });

  it('does not swallow a leading Markdown bold marker into the match', () => {
    const spans = detectEmails('reach out **clara@example.com** any time');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('clara@example.com');
  });
});

describe('detectPhones', () => {
  it('finds a Spanish national number', () => {
    const spans = detectPhones('llamame al 612 345 678 gracias');
    expect(spans.some((s) => s.text.replace(/\D/g, '') === '612345678')).toBe(true);
  });

  it('finds an international number', () => {
    const spans = detectPhones('call +34 612 345 678 please');
    expect(spans.some((s) => s.text.includes('612'))).toBe(true);
  });

  it('ignores short digit runs like house numbers', () => {
    const spans = detectPhones('vivo en el numero 12 de la calle');
    expect(spans).toHaveLength(0);
  });
});

describe('detectAddresses', () => {
  it('matches street + name + number with optional postal code and locality', () => {
    const spans = detectAddresses('vivo en Rúa Fernando Olmedo 12, Pontevedra.');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Rúa Fernando Olmedo 12, Pontevedra');
  });

  it('matches without postal code or locality', () => {
    const spans = detectAddresses('Calle Mayor 5');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('Calle Mayor 5');
  });

  it('matches a US/UK-style number-first address', () => {
    const spans = detectAddresses('I live at 742 Evergreen Terrace, Springfield, OR 97477.');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('742 Evergreen Terrace, Springfield, OR 97477');
  });

  it('does not fire on an ordinary "<number> <Capitalized word>" sequence', () => {
    const spans = detectAddresses('We shipped 12 Widgets last week.');
    expect(spans).toHaveLength(0);
  });
});

describe('detectDni', () => {
  it('accepts a valid DNI', () => {
    const spans = detectDni('mi dni es 12345678Z gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('DNI');
  });

  it('accepts a dotted-and-dashed DNI', () => {
    const spans = detectDni('mi dni es 76.123.312-M gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('DNI');
  });

  it('accepts a dotted DNI without the trailing dash', () => {
    const spans = detectDni('mi dni es 76.123.312M gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('DNI');
  });

  it('still accepts the plain ungrouped form', () => {
    const spans = detectDni('mi dni es 12345678Z gracias');
    expect(spans).toHaveLength(1);
  });
});

// D1. A bad check letter used to mean "not tagged at all", which let a
// mangled ID through in plain text. It is now tagged INVALID_ID; a valid one
// is untouched, at today's category and confidence.
describe('detectDni — ID-shaped numbers with a wrong check letter (D1)', () => {
  it('tags the P8b number the old gate dropped', () => {
    // 45678912 % 23 -> 'S', so the 'Q' is wrong.
    const spans = detectDni('mi dni es 45678912Q gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('INVALID_ID');
    expect(spans[0].text).toBe('45678912Q');
  });

  it('tags the clinical-report bench number the suite never saw redacted', () => {
    const spans = detectDni('Firmado por FERREIRO IGLESIAS LAURA - 33112244F Fecha:');
    expect(spans.map((s) => [s.category, s.text])).toEqual([['INVALID_ID', '33112244F']]);
  });

  it('tags the dotted form too', () => {
    // 76.123.312-E: 76123312 % 23 -> 'M', not 'E'.
    const spans = detectDni('mi dni es 76.123.312-E gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('INVALID_ID');
  });

  it('is more confident when a label anchors it', () => {
    const [anchored] = detectDni('DNI: 45678912Q');
    const [bare] = detectDni('ref 45678912Q');
    expect(anchored.confidence).toBe(0.9);
    expect(bare.confidence).toBe(0.5);
  });

  it('leaves a valid DNI exactly as it was — category and confidence', () => {
    const [span] = detectDni('mi dni es 12345678Z gracias');
    expect(span.category).toBe('DNI');
    expect(span.confidence).toBe(1);
  });

  it('does not fire on something merely digit-shaped', () => {
    for (const text of ['12345678', 'teléfono 986 123 456', 'factura 2026/0012', 'CP 15702']) {
      expect(detectDni(text)).toHaveLength(0);
    }
  });

  it('does not fire on an ID-shaped number inside a URL', () => {
    expect(detectDni('https://ejemplo.gal/expedientes/76543210X')).toHaveLength(0);
  });

  // The measured cost of dropping the checksum gate, per the plan's settled
  // trade-off: an 8-digit-plus-letter invoice or product code now over-masks.
  // Visible in step 2 and untickable there; a missed ID would be silent.
  it('over-masks an invoice-style code, knowingly', () => {
    const spans = detectDni('Factura 20260012B pendiente');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('INVALID_ID');
    expect(spans[0].confidence).toBe(0.5);
  });
});

describe('detectNie', () => {
  it('accepts a valid NIE', () => {
    const spans = detectNie('mi nie es X1234567L gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('NIE');
  });

  // D1: same treatment as DNI — a wrong check letter is tagged, not dropped.
  it('tags a NIE with a bad check letter as INVALID_ID', () => {
    const spans = detectNie('mi nie es X1234567A gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('INVALID_ID');
    expect(spans[0].confidence).toBe(0.9);
  });
});

describe('detectIbans', () => {
  it('accepts a valid IBAN', () => {
    const spans = detectIbans('transfiere a ES9121000418450200051332 hoy');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('IBAN');
  });

  it('discards an invalid checksum outright', () => {
    const spans = detectIbans('transfiere a ES9121000418450200051333 hoy');
    expect(spans).toHaveLength(0);
  });

  it('matches a German IBAN whose last display group is shorter than 4 chars', () => {
    const spans = detectIbans('IBAN: DE89 3704 0044 0532 0130 00');
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe('DE89 3704 0044 0532 0130 00');
  });
});

describe('detectCreditCards', () => {
  it('accepts a valid Luhn number', () => {
    const spans = detectCreditCards('paga con 4111111111111111 ahora');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('CREDIT_CARD');
  });

  it('discards an invalid checksum, e.g. an order number', () => {
    const spans = detectCreditCards('pedido numero 4111111111111112 confirmado');
    expect(spans).toHaveLength(0);
  });
});
