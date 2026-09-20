import { describe, expect, it } from 'vitest';
import { dniNieCheck, ibanCheck, luhnCheck } from './validators';

describe('luhnCheck', () => {
  it('accepts a valid card number', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
  });

  it('rejects an invalid card number', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });
});

describe('ibanCheck', () => {
  it('accepts a valid Spanish IBAN', () => {
    expect(ibanCheck('ES9121000418450200051332')).toBe(true);
  });

  it('rejects an invalid IBAN', () => {
    expect(ibanCheck('ES9121000418450200051333')).toBe(false);
  });
});

describe('dniNieCheck', () => {
  it('accepts a valid DNI', () => {
    expect(dniNieCheck('12345678Z')).toBe(true);
  });

  it('rejects an invalid DNI letter', () => {
    expect(dniNieCheck('12345678A')).toBe(false);
  });

  it('accepts a valid NIE', () => {
    expect(dniNieCheck('X1234567L')).toBe(true);
  });

  it('rejects an invalid NIE letter', () => {
    expect(dniNieCheck('X1234567A')).toBe(false);
  });
});
