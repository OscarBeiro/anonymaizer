import { describe, expect, it } from 'vitest';
import { runAllDetectors } from './detectors';
import { detectMoney, inferMoneyConvention, parseMoneyAmount } from './money';
import { arbitrateSpans } from './span';
import { RUNG } from './types';

const texts = (text: string) => detectMoney(text).map((s) => s.text);

describe('detectMoney — symbols', () => {
  it('matches a symbol after the number, ES grouping', () => {
    expect(texts('Total: 1.234,56 € a pagar')).toEqual(['1.234,56 €']);
    expect(texts('Total: 1.234,56€.')).toEqual(['1.234,56€']);
  });

  it('matches a symbol before the number, EN grouping', () => {
    expect(texts('The fee is $1,234.56 today')).toEqual(['$1,234.56']);
    expect(texts('costs £ 99.99, or ¥12,000')).toEqual(['£ 99.99', '¥12,000']);
  });

  it('matches plain integers and large groupings', () => {
    expect(texts('una multa de 600 € y otra de 1.250.000 €')).toEqual(['600 €', '1.250.000 €']);
    expect(texts('raised $3,500,000 in seed')).toEqual(['$3,500,000']);
  });

  it('keeps a magnitude word with the amount', () => {
    expect(texts('una inversión de 2,5 millones de euros')).toEqual(['2,5 millones de euros']);
    expect(texts('valorada en 3 mil millones de €')).toEqual(['3 mil millones de €']);
    expect(texts('about $4.2 million')).toEqual(['$4.2 million']);
  });
});

describe('detectMoney — ISO codes and currency words', () => {
  it('matches ISO 4217 codes either side', () => {
    expect(texts('importe: EUR 1.500,00')).toEqual(['EUR 1.500,00']);
    expect(texts('importe: 1.500,00 EUR')).toEqual(['1.500,00 EUR']);
    expect(texts('paid USD 250 and 3,000 GBP')).toEqual(['USD 250', '3,000 GBP']);
  });

  it('matches a currency word after the number', () => {
    expect(texts('una fianza de 1.500 euros')).toEqual(['1.500 euros']);
    expect(texts('cobró 20 dólares')).toEqual(['20 dólares']);
  });

  it('does not match an ISO code or word glued inside a longer word', () => {
    expect(texts('ref 1500EURO2 y 30 eurostars')).toEqual([]);
  });
});

describe('detectMoney — sign', () => {
  it('matches negative amounts, sign before symbol or number', () => {
    expect(texts('saldo: -1.234,56 €')).toEqual(['-1.234,56 €']);
    expect(texts('balance: -$50.00')).toEqual(['-$50.00']);
    expect(texts('balance: $-50.00')).toEqual(['$-50.00']);
    expect(texts('saldo: −20 €')).toEqual(['−20 €']);
  });

  it('matches parenthesised (accounting) amounts, parens included', () => {
    expect(texts('pérdida (1.234,56 €) en el ejercicio')).toEqual(['(1.234,56 €)']);
    expect(texts('loss ($1,200) this year')).toEqual(['($1,200)']);
  });

  it('leaves an unbalanced paren out of the span', () => {
    expect(texts('(total 30 €)')).toEqual(['30 €']);
    expect(texts('(pagó $30, luego)')).toEqual(['$30']);
  });
});

describe('detectMoney — written-out Spanish', () => {
  it('matches written-out amounts', () => {
    expect(texts('una indemnización de mil euros')).toEqual(['mil euros']);
    expect(texts('asciende a dos millones de euros.')).toEqual(['dos millones de euros']);
    expect(texts('un millón de euros')).toEqual(['un millón de euros']);
    expect(texts('Doscientos cincuenta mil euros')).toEqual(['Doscientos cincuenta mil euros']);
    expect(texts('treinta y cinco euros')).toEqual(['treinta y cinco euros']);
  });

  it('does not take a non-number word before "euros"', () => {
    expect(texts('varios euros')).toEqual([]);
    expect(texts('los euros')).toEqual([]);
  });
});

describe('detectMoney — precision', () => {
  it('never matches a bare number', () => {
    expect(texts('Artículo 1.234, apartado 3, año 2024, 12,5 %')).toEqual([]);
  });

  it('does not take digits glued to a preceding word or number', () => {
    expect(texts('código A12 €')).toEqual([]);
  });

  it('emits MONEY spans on the MONEY rung, above ADDRESS and below the validated regexes', () => {
    const [span] = detectMoney('100 €');
    expect(span).toMatchObject({ category: 'MONEY', start: 0, end: 5, confidence: 1, source: 'regex', rung: RUNG.MONEY });
    expect(RUNG.MONEY).toBeGreaterThan(RUNG.VALIDATED_REGEX);
    expect(RUNG.MONEY).toBeLessThan(RUNG.ADDRESS);
  });
});

describe('MONEY vs IBAN / card spans', () => {
  const moneyAfter = (text: string) =>
    arbitrateSpans(runAllDetectors(text)).filter((s) => s.category === 'MONEY').map((s) => s.text);

  it('a number inside an IBAN never mints a MONEY span', () => {
    const text = 'Cuenta ES91 2100 0418 4502 0005 1332 EUR';
    expect(detectMoney(text).length).toBeGreaterThan(0); // the candidate exists …
    expect(moneyAfter(text)).toEqual([]); // … and loses to the IBAN
  });

  it('a number inside a card number never mints a MONEY span', () => {
    expect(moneyAfter('tarjeta 4111 1111 1111 1111 €')).toEqual([]);
  });

  it('an amount beside an IBAN still survives', () => {
    expect(moneyAfter('Transferir 1.500 € a ES9121000418450200051332')).toEqual(['1.500 €']);
  });

  it('is gated by the MONEY category toggle', () => {
    expect(runAllDetectors('100 €', { MONEY: false }).some((s) => s.category === 'MONEY')).toBe(false);
  });
});

describe('inferMoneyConvention', () => {
  it('defaults to ES with no evidence', () => {
    expect(inferMoneyConvention('sin importes')).toBe('ES');
    expect(inferMoneyConvention('1.234 € y 5.000 €')).toBe('ES'); // all ambiguous
  });

  it('reads unambiguous amounts', () => {
    expect(inferMoneyConvention('$1,234.56')).toBe('EN');
    expect(inferMoneyConvention('1.234,56 €')).toBe('ES');
    expect(inferMoneyConvention('$12.50')).toBe('EN');
    expect(inferMoneyConvention('12,5 €')).toBe('ES');
    expect(inferMoneyConvention('$1,234,567')).toBe('EN');
    expect(inferMoneyConvention('1.234.567 €')).toBe('ES');
  });

  it('goes with the majority and breaks a tie towards ES', () => {
    expect(inferMoneyConvention('$1.50, $2.75 y 3,20 €')).toBe('EN');
    expect(inferMoneyConvention('$1.50 y 3,20 €')).toBe('ES');
  });

  it('only counts numbers carrying a currency marker', () => {
    expect(inferMoneyConvention('versión 2.5, 3.1 y 4.0; total 1.234,56 €')).toBe('ES');
  });
});

describe('parseMoneyAmount', () => {
  it('parses an amount in the given convention', () => {
    expect(parseMoneyAmount('1.234,56 €', 'ES')).toBe(1234.56);
    expect(parseMoneyAmount('$1,234.56', 'EN')).toBe(1234.56);
    expect(parseMoneyAmount('1.234 €', 'ES')).toBe(1234);
    expect(parseMoneyAmount('$1.234', 'EN')).toBe(1.234);
    expect(parseMoneyAmount('(1.200 €)', 'ES')).toBe(-1200);
    expect(parseMoneyAmount('-$50.00', 'EN')).toBe(-50);
  });

  it('returns null for written-out amounts', () => {
    expect(parseMoneyAmount('mil euros', 'ES')).toBeNull();
  });
});
