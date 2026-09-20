import { RUNG, type DetectedSpan } from './types';
import { dniNieCheck, ibanCheck, luhnCheck } from './validators';

const collect = (
  regex: RegExp,
  text: string,
  build: (match: RegExpExecArray) => DetectedSpan | null,
): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const span = build(match);
    if (span) spans.push(span);
    if (match[0].length === 0) regex.lastIndex++;
  }
  return spans;
};

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g;

export const detectEmails = (text: string): DetectedSpan[] =>
  collect(new RegExp(EMAIL_REGEX), text, (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    category: 'EMAIL',
    text: m[0],
    confidence: 1,
    source: 'regex',
    rung: RUNG.VALIDATED_REGEX,
  }));

const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g;

export const detectPhones = (text: string): DetectedSpan[] =>
  collect(new RegExp(PHONE_REGEX), text, (m) => {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'PHONE',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

const STREET_KEYWORDS = [
  'Rúa', 'Rua', 'Calle', 'C/', 'Avenida', 'Avda', 'Plaza', 'Praza', 'Camiño',
  'Street', 'Avenue', 'Road', 'Rd',
];

const ADDRESS_REGEX = new RegExp(
  `(?:${STREET_KEYWORDS.map((k) => k.replace('/', '\\/')).join('|')})` +
    `\\s+\\p{Lu}\\p{L}*(?:\\s+\\p{Lu}\\p{L}*)*` +
    `\\s+\\d+[A-Za-z]?` +
    `(?:,?\\s*\\d{5})?` +
    `(?:,?\\s*\\p{Lu}\\p{L}*)?`,
  'gu',
);

export const detectAddresses = (text: string): DetectedSpan[] =>
  collect(new RegExp(ADDRESS_REGEX), text, (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    category: 'ADDRESS',
    text: m[0],
    confidence: 1,
    source: 'regex',
    rung: RUNG.ADDRESS,
  }));

const DNI_REGEX = /\b\d{8}[A-Za-z]\b/g;
const NIE_REGEX = /\b[XYZxyz]\d{7}[A-Za-z]\b/g;

export const detectDni = (text: string): DetectedSpan[] =>
  collect(new RegExp(DNI_REGEX), text, (m) => {
    if (!dniNieCheck(m[0])) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'DNI',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

export const detectNie = (text: string): DetectedSpan[] =>
  collect(new RegExp(NIE_REGEX), text, (m) => {
    if (!dniNieCheck(m[0])) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'NIE',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

const IBAN_REGEX = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}\b/g;

export const detectIbans = (text: string): DetectedSpan[] =>
  collect(new RegExp(IBAN_REGEX), text, (m) => {
    if (!ibanCheck(m[0])) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'IBAN',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

const CREDIT_CARD_REGEX = /\b(?:\d[ -]?){13,19}\b/g;

export const detectCreditCards = (text: string): DetectedSpan[] =>
  collect(new RegExp(CREDIT_CARD_REGEX), text, (m) => {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return null;
    if (!luhnCheck(digits)) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'CREDIT_CARD',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

export const runDeterministicDetectors = (text: string): DetectedSpan[] => [
  ...detectEmails(text),
  ...detectIbans(text),
  ...detectCreditCards(text),
  ...detectDni(text),
  ...detectNie(text),
  ...detectPhones(text),
  ...detectAddresses(text),
];
