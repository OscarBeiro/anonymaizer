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
});

describe('detectDni', () => {
  it('accepts a valid DNI', () => {
    const spans = detectDni('mi dni es 12345678Z gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('DNI');
  });

  it('discards an invalid checksum outright', () => {
    const spans = detectDni('mi dni es 12345678A gracias');
    expect(spans).toHaveLength(0);
  });
});

describe('detectNie', () => {
  it('accepts a valid NIE', () => {
    const spans = detectNie('mi nie es X1234567L gracias');
    expect(spans).toHaveLength(1);
    expect(spans[0].category).toBe('NIE');
  });

  it('discards an invalid checksum outright', () => {
    const spans = detectNie('mi nie es X1234567A gracias');
    expect(spans).toHaveLength(0);
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
