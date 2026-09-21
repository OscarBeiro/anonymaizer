import { describe, expect, it } from 'vitest';
import { dniNieCheck, ibanCheck, inspectDniNie, luhnCheck } from './validators';

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

describe('inspectDniNie (D1)', () => {
  it('reports a valid DNI as valid, with the letter it expected', () => {
    expect(inspectDniNie('12345678Z')).toEqual({
      kind: 'DNI', letter: 'Z', expectedLetter: 'Z', valid: true,
    });
  });

  it('reports an ID-shaped number with a wrong check letter, and what it should be', () => {
    expect(inspectDniNie('45678912Q')).toEqual({
      kind: 'DNI', letter: 'Q', expectedLetter: 'S', valid: false,
    });
    expect(inspectDniNie('33112244F')).toEqual({
      kind: 'DNI', letter: 'F', expectedLetter: 'H', valid: false,
    });
  });

  it('does the same for a NIE', () => {
    expect(inspectDniNie('X1234567A')).toMatchObject({ kind: 'NIE', expectedLetter: 'L', valid: false });
  });

  it('returns null for something that is not ID-shaped at all', () => {
    expect(inspectDniNie('12345678')).toBeNull();
    expect(inspectDniNie('hola')).toBeNull();
  });
});
