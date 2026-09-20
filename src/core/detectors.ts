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

// Legal-form suffixes, longest/most-specific first so alternation doesn't
// stop at a shorter overlapping prefix (e.g. "SLU" before "SL").
const COMPANY_SUFFIXES = [
  'S\\.L\\.U\\.', 'S\\.A\\.U\\.', 'S\\.Coop\\.', 'S\\.L\\.', 'S\\.A\\.',
  'SLU', 'SAU', 'SCP', 'SL', 'SA',
  'Inc\\.', 'Inc', 'Ltd\\.', 'Ltd', 'LLC', 'LLP',
  'Corp\\.', 'Corp', 'PLC', 'GmbH', 'AG', 'mbH', 'BV', 'NV', 'SAS', 'SARL',
  'Lda', 'Ltda', 'Oy', 'AB', 'A\\/S', 'Pty',
];

const COMPANY_SUFFIX_REGEX = new RegExp(
  `\\p{Lu}\\p{L}*(?:\\s+\\p{Lu}\\p{L}*)*,?\\s+(?:${COMPANY_SUFFIXES.join('|')})(?=[\\s.,;:!?)]|$)`,
  'gu',
);

const COMPANY_PREFIXES = [
  'Grupo', 'Banco', 'Fundación', 'Asociación', 'Universidade', 'Universidad',
  'Instituto', 'Consellería', 'Ayuntamiento', 'Concello',
];

const COMPANY_PREFIX_REGEX = new RegExp(
  `\\b(?:${COMPANY_PREFIXES.join('|')})\\s+\\p{Lu}\\p{L}*(?:\\s+\\p{Lu}\\p{L}*)*`,
  'gu',
);

export const detectCompanies = (text: string): DetectedSpan[] => {
  const build = (m: RegExpExecArray): DetectedSpan => ({
    start: m.index,
    end: m.index + m[0].length,
    category: 'COMPANY',
    text: m[0],
    confidence: 1,
    source: 'regex',
    rung: RUNG.COMPANY,
  });
  return [
    ...collect(new RegExp(COMPANY_SUFFIX_REGEX), text, build),
    ...collect(new RegExp(COMPANY_PREFIX_REGEX), text, build),
  ];
};

const FISCAL_ACRONYM_EXCLUSIONS = new Set([
  'IVA', 'IRPF', 'NIF', 'CIF', 'DNI', 'NIE', 'IBAN', 'SEPA', 'PDF', 'URL', 'API', 'OK',
]);

const COMPANY_ACRONYM_REGEX = /\b[A-Z]{2,}\b/g;

export const detectCompanyAcronyms = (text: string): DetectedSpan[] =>
  collect(new RegExp(COMPANY_ACRONYM_REGEX), text, (m) => {
    if (FISCAL_ACRONYM_EXCLUSIONS.has(m[0])) return null;
    return {
      start: m.index,
      end: m.index + m[0].length,
      category: 'COMPANY',
      text: m[0],
      confidence: 0.4,
      source: 'regex',
      rung: RUNG.COMPANY_ACRONYM,
      enabled: false,
    };
  });

// ES/FR/DE/PT nobiliary/name particles, longest first so "de la"/"von der"/
// "van der" aren't cut short by their single-word forms.
const NAME_PARTICLES = [
  'de la', 'von der', 'van der',
  'del', 'de', 'y', 'du', 'des', 'le', 'van', 'von', 'da', 'do', 'dos', 'das',
];

const NAME_STOPWORDS = new Set([
  // days
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
  // months
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  // common sentence-starters
  'Hola', 'Estimado', 'Estimada', 'Buenos', 'Buenas', 'Saludos', 'Gracias',
  'Atentamente', 'El', 'La', 'Los', 'Las', 'Un', 'Una', 'Por', 'Para',
  'Cuando', 'Aunque', 'Además', 'También', 'Sin', 'Pero', 'Señor', 'Señora',
]);

const NAME_TOKEN = '\\p{Lu}\\p{L}*(?:-\\p{Lu}\\p{L}*)?';
const NAME_MAX_TOKENS = 6;

const NAME_REGEX = new RegExp(
  `${NAME_TOKEN}(?:\\s+(?:(?:${NAME_PARTICLES.join('|')})\\s+)?${NAME_TOKEN}){0,${NAME_MAX_TOKENS - 1}}`,
  'gu',
);

const isSentenceInitial = (text: string, index: number): boolean => {
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?]/.test(text[i]);
};

const tokenCount = (match: string): number =>
  match.split(/\s+/).filter((word) => !NAME_PARTICLES.includes(word)).length;

export const detectNames = (text: string): DetectedSpan[] =>
  collect(new RegExp(NAME_REGEX), text, (m) => {
    const matchText = m[0];
    if (tokenCount(matchText) < 2) return null;
    if (isSentenceInitial(text, m.index)) return null;
    const firstWord = matchText.split(/\s+/)[0];
    if (NAME_STOPWORDS.has(firstWord)) return null;
    return {
      start: m.index,
      end: m.index + matchText.length,
      category: 'NAME',
      text: matchText,
      confidence: 0.6,
      source: 'regex',
      rung: RUNG.NAME,
    };
  });

export const runHeuristicDetectors = (text: string): DetectedSpan[] => [
  ...detectCompanies(text),
  ...detectNames(text),
  ...detectCompanyAcronyms(text),
];

export const runAllDetectors = (text: string): DetectedSpan[] => [
  ...runDeterministicDetectors(text),
  ...runHeuristicDetectors(text),
];
