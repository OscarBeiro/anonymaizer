import { describe, expect, it } from 'vitest';
import { ccCheck, detectPtAddressFragments, detectPtCartaoCidadao, detectPtNif, detectPtPhones, nifCheck } from './ptIds';

describe('nifCheck', () => {
  it('accepts numbers with a valid mod-11 check digit', () => {
    expect(nifCheck('123456789')).toBe(true);
    expect(nifCheck('501964843')).toBe(true);
  });
  it('rejects a wrong check digit and wrong lengths', () => {
    expect(nifCheck('123456788')).toBe(false);
    expect(nifCheck('12345678')).toBe(false);
    expect(nifCheck('1234567890')).toBe(false);
  });
});

describe('ccCheck', () => {
  it('accepts the documented test number and a recomputed one', () => {
    expect(ccCheck('000000000ZZ4')).toBe(true);
  });
  it('rejects a changed digit', () => {
    expect(ccCheck('000000000ZZ5')).toBe(false);
    expect(ccCheck('00000000ZZ4')).toBe(false);
  });
});

describe('detectPtNif', () => {
  it('finds a labelled NIF whatever its first digit', () => {
    const text = 'O NIF 123456789 consta do processo.';
    expect(detectPtNif(text).map(s => [s.category, s.text])).toEqual([['NIF', '123456789']]);
  });
  it('finds a labelled number written with spaces', () => {
    expect(detectPtNif('NIF: 123 456 789.').map(s => s.text)).toEqual(['123 456 789']);
  });
  it('rejects an invalid number even when labelled', () => {
    expect(detectPtNif('NIF 123456788')).toEqual([]);
  });
  it('finds an unlabelled valid company NIF but not a valid-looking mobile number', () => {
    expect(detectPtNif('Empresa 501964843 Lda').map(s => s.text)).toEqual(['501964843']);
    expect(detectPtNif('Ligue para 912345678 hoje')).toEqual([]);
  });
  it('does not cut a longer digit run', () => {
    expect(detectPtNif('IBAN 0123456789012')).toEqual([]);
  });
});

describe('detectPtCartaoCidadao', () => {
  it('finds a valid card number with or without spaces', () => {
    expect(detectPtCartaoCidadao('CC 00000000 0 ZZ4').map(s => [s.category, s.text])).toEqual([['CARTAO_CIDADAO', '00000000 0 ZZ4']]);
    expect(detectPtCartaoCidadao('000000000ZZ4').map(s => s.text)).toEqual(['000000000ZZ4']);
  });
  it('ignores one with a bad check digit', () => {
    expect(detectPtCartaoCidadao('00000000 0 ZZ9')).toEqual([]);
  });
});

describe('detectPtPhones', () => {
  it('finds mobile, landline and +351 forms', () => {
    const text = 'Telemóvel 912 345 678, fixo 21 234 5678 e +351 222 334 455.';
    expect(detectPtPhones(text).map(s => s.text)).toEqual(['912 345 678', '21 234 5678', '+351 222 334 455']);
  });
  it('ignores a nine-digit number that is not a phone shape', () => {
    expect(detectPtPhones('Ref 512345678')).toEqual([]);
  });
});

describe('detectPtAddressFragments', () => {
  it('finds a postal code with its locality', () => {
    expect(detectPtAddressFragments('Rua das Flores 45, 4000-123 Porto').map(s => s.text)).toContain('4000-123 Porto');
  });
});
