import { RUNG, type DetectedSpan } from './types';

// Portuguese jurisdiction detectors (P28): NIF, Cartão de Cidadão, phones and
// postal codes. Language context lives in packs/; this file is identity data only.

const digitsOf = (value: string): string => value.replace(/\D/g, '');

/** Número de Identificação Fiscal: nine digits, mod-11 check digit over the first eight. */
export const nifCheck = (value: string): boolean => {
  if (!/^\d{9}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(value[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(value[8]);
};

const charValue = (char: string): number => /\d/.test(char) ? Number(char) : char.toUpperCase().charCodeAt(0) - 55;

/**
 * Cartão de Cidadão: eight digits, a check digit, two version letters and a
 * final check digit. The whole twelve characters satisfy a Luhn-style sum in
 * which letters count as 10–35.
 */
export const ccCheck = (value: string): boolean => {
  const compact = value.replace(/\s/g, '');
  if (!/^\d{9}[A-Za-z]{2}\d$/.test(compact)) return false;
  let sum = 0;
  [...compact].reverse().forEach((char, index) => {
    let v = charValue(char);
    if (index % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  });
  return sum % 10 === 0;
};

const make = (m: RegExpExecArray, offset: number, text: string, category: string, rung: number, confidence = 1): DetectedSpan => ({
  start: m.index + offset, end: m.index + offset + text.length, category, text, confidence, source: 'regex', rung,
});

const NIF_LABEL = /(?:\bNIF|\bN\.?I\.?F\.?|\bNIPC|\bcontribuinte)[\s:.nºo°-]*$/iu;
const NIF_REGEX = /(?<![\d\-.,])(\d{3}[ .]?\d{3}[ .]?\d{3})(?![\d]|[ .]?\d)/gu;
// First digits of numbers that are not mobile (9) or landline (2) prefixes.
const UNLABELLED_PREFIXES = /^[13568]/;

export const detectPtNif = (text: string): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  for (const m of text.matchAll(NIF_REGEX)) {
    const raw = m[1];
    const digits = digitsOf(raw);
    if (!nifCheck(digits)) continue;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    const labelled = NIF_LABEL.test(before);
    if (!labelled && (!UNLABELLED_PREFIXES.test(digits) || /[ .]/.test(raw))) continue;
    spans.push(make(m, 0, raw, 'NIF', RUNG.VALIDATED_REGEX, labelled ? 1 : 0.8));
  }
  return spans;
};

const CC_REGEX = /(?<![\dA-Za-z])(\d{8} ?\d ?[A-Za-z]{2} ?\d)(?![\dA-Za-z])/gu;

export const detectPtCartaoCidadao = (text: string): DetectedSpan[] =>
  [...text.matchAll(CC_REGEX)].filter(m => ccCheck(m[1])).map(m => make(m, 0, m[1], 'CARTAO_CIDADAO', RUNG.VALIDATED_REGEX));

// Mobile 9[1236]x, landline 2xx, optionally with +351 / 00351; nine national digits.
const PT_PHONE_REGEX = /(?<![\d\w])(?:(?:\+|00)351[ .-]?)?((?:9[1236]\d|2\d{2})[ .-]?\d{3}[ .-]?\d{3}|(?:2\d)[ .-]?\d{3}[ .-]?\d{4}|(?:9[1236])[ .-]?\d{3}[ .-]?\d{4})(?![\d])/gu;

export const detectPtPhones = (text: string): DetectedSpan[] =>
  [...text.matchAll(PT_PHONE_REGEX)].map(m => make(m, 0, m[0], 'PHONE', RUNG.VALIDATED_REGEX));

const POSTAL_REGEX = /(?<![\d-])\d{4}-\d{3}(?:[ \t]+\p{Lu}\p{L}*(?:[ \t]+(?:de|do|da|dos|das|\p{Lu}\p{L}*))*)?/gu;

export const detectPtAddressFragments = (text: string): DetectedSpan[] =>
  [...text.matchAll(POSTAL_REGEX)].map(m => make(m, 0, m[0], 'ADDRESS', RUNG.ADDRESS));

const PT_STREETS = ['Rua', 'Avenida', 'Av\\.', 'Praça', 'Largo', 'Travessa', 'Alameda', 'Estrada', 'Beco', 'Calçada'];
const PT_STREET_REGEX = new RegExp(
  `(?<![\\p{L}])(?:${PT_STREETS.join('|')})[ \\t]+(?:(?:de|do|da|dos|das)[ \\t]+)?\\p{Lu}\\p{L}*(?:[ \\t]+(?:de|do|da|dos|das|e|\\p{Lu}\\p{L}*))*[ \\t]*,?[ \\t]*\\d+[A-Za-zº.]*(?:[ ,\\t]*\\d+\\.?º[ \\t]*(?:Esq|Dto|Esq\\.|Dto\\.)?)?`,
  'gu',
);

export const detectPtStreets = (text: string): DetectedSpan[] =>
  [...text.matchAll(PT_STREET_REGEX)].map(m => make(m, 0, m[0].replace(/[ ,.\t]+$/, ''), 'ADDRESS', RUNG.ADDRESS));
