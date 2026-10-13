import { describe, expect, it } from 'vitest';
import {
  detectAddresses,
  detectCreditCards,
  detectDni,
  detectEmails,
  detectIbans,
  detectNames,
  detectNie,
  detectPhones,
  detectVatNumbers,
} from './detectors';

describe('detectVatNumbers', () => {
  it('recognizes formatted EU VAT IDs and Spanish CIF/NIF company identifiers offline', () => {
    const spans = detectVatNumbers('VAT: DE 136695976; ES B-5837843-1; FR 40303265045');
    expect(spans.map((s) => [s.text, s.category])).toEqual([
      ['DE 136695976', 'VAT_NUMBER'],
      ['ES B-5837843-1', 'VAT_NUMBER'],
      ['FR 40303265045', 'VAT_NUMBER'],
    ]);
  });

  it('rejects malformed shapes and Spanish CIFs with an invalid control character', () => {
    expect(detectVatNumbers('DE 12345; DE 1366959760; BE 234567890; ES B58378434')).toHaveLength(0);
  });

  it('accepts internal separators and extracts a candidate before following prose', () => {
    expect(detectVatNumbers('DE 136 695 976 is registered')).toMatchObject([
      { text: 'DE 136 695 976', confidence: 0.75 },
    ]);
  });

  it('masks a CIF explicitly labeled as such even when its check character is wrong', () => {
    expect(detectVatNumbers('CIF: B12345670')).toMatchObject([
      { text: 'B12345670', category: 'VAT_NUMBER', confidence: 0.65 },
    ]);
    expect(detectVatNumbers('CIF: B12345674')).toMatchObject([
      { text: 'B12345674', category: 'VAT_NUMBER', confidence: 0.9 },
    ]);
    expect(detectVatNumbers('CIF/NIF: ESB94165495')).toMatchObject([
      { text: 'ESB94165495', category: 'VAT_NUMBER' },
    ]);
  });

  it('does not mask a valid prefix of an overlong spaced VAT number', () => {
    expect(detectVatNumbers('DE123456789 123')).toHaveLength(0);
  });

  it('finds adjacent VAT numbers independently', () => {
    expect(detectVatNumbers('DE123456789 FR40303265045').map((span) => span.text)).toEqual([
      'DE123456789', 'FR40303265045',
    ]);
  });

  it('does not interpret lowercase Spanish prose before a DNI as the ES VAT prefix', () => {
    expect(detectVatNumbers('El texto es 12.345.678-Z')).toHaveLength(0);
  });

  it('does not claim live VIES registration validation', () => {
    expect(detectVatNumbers('NL 123456789B01')).toHaveLength(1);
  });
});

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

describe('detectIbans — trailing token', () => {
  it('drops a token the group run swallowed when the checksum fails with it', () => {
    const spans = detectIbans('Cuenta ES91 2100 0418 4502 0005 1332 EUR');
    expect(spans.map((s) => s.text)).toEqual(['ES91 2100 0418 4502 0005 1332']);
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

describe('detectNames — comma form stops at ID keywords (U10)', () => {
  it.each(['DNI', 'NIE', 'NIF', 'CIF'])('does not take "%s" as a given name', (kw) => {
    const text = `Tutor legal: Anxo Nogueira Vidal, ${kw} 12345678Z`;
    const names = detectNames(text).filter((s) => s.category === 'NAME');
    expect(names.map((s) => text.slice(s.start, s.end))).toEqual(['Anxo Nogueira Vidal']);
  });

  it('still joins the surname-first form', () => {
    const text = 'Ferreiro Iglesias, Laura trabaja aquí.';
    const names = detectNames(text);
    expect(text.slice(names[0].start, names[0].end)).toBe('Ferreiro Iglesias, Laura');
  });
});
