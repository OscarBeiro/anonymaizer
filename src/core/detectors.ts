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

// Deliberately narrower than full RFC 5322: the exotic local-part chars
// (!#$%&'*/=^_`{|}~) are almost never real emails and, in the case of `*`,
// actively swallow adjacent Markdown bold markers (`**clara@x.com**`) into
// the match, leaving broken syntax behind after substitution.
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

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

// Same-line whitespace only. A generic \s matches newlines, which lets a
// multi-word heuristic match chain across lines in a structured document
// (a "Name: Clara Vance" line followed by "Email: ..." would otherwise
// merge into one bogus candidate) — addresses, company names and person
// names are always single-line entities.
const WS = '[ \\t]';

const ADDRESS_REGEX = new RegExp(
  `(?:${STREET_KEYWORDS.map((k) => k.replace('/', '\\/')).join('|')})` +
    `${WS}+\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*` +
    `${WS}+\\d+[A-Za-z]?` +
    `(?:,?${WS}*\\d{5})?` +
    `(?:,?${WS}*\\p{Lu}\\p{L}*)?`,
  'gu',
);

// US/UK-style number-first address: "742 Evergreen Terrace, Springfield, OR
// 97477". No street keyword to anchor on here, so city + 2-letter state +
// ZIP are required (not optional, unlike the keyword-form's locality) to
// keep this precision-first — that trailing shape is distinctive enough to
// not fire on ordinary "<number> <Capitalized word>" text.
const US_ADDRESS_REGEX = new RegExp(
  `\\b\\d+${WS}+\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*){0,3}` +
    `,${WS}*\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*` +
    `,${WS}*[A-Z]{2}${WS}+\\d{5}(?:-\\d{4})?\\b`,
  'gu',
);

export const detectAddresses = (text: string): DetectedSpan[] => {
  const build = (m: RegExpExecArray): DetectedSpan => ({
    start: m.index,
    end: m.index + m[0].length,
    category: 'ADDRESS',
    text: m[0],
    confidence: 1,
    source: 'regex',
    rung: RUNG.ADDRESS,
  });
  return [
    ...collect(new RegExp(ADDRESS_REGEX), text, build),
    ...collect(new RegExp(US_ADDRESS_REGEX), text, build),
  ];
};

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

// Group width is 1-4, not a fixed 4: several countries' conventional
// display grouping ends in a short trailing group (German IBANs, e.g.
// "DE89 3704 0044 0532 0130 00", end in a 2-char group).
const IBAN_REGEX = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{1,4}){2,7}\b/g;

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
  `\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*,?${WS}+(?:${COMPANY_SUFFIXES.join('|')})(?=[\\s.,;:!?)]|$)`,
  'gu',
);

const COMPANY_PREFIXES = [
  'Grupo', 'Banco', 'Fundación', 'Asociación', 'Universidade', 'Universidad',
  'Instituto', 'Consellería', 'Ayuntamiento', 'Concello',
];

const COMPANY_PREFIX_REGEX = new RegExp(
  `\\b(?:${COMPANY_PREFIXES.join('|')})${WS}+\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*`,
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
  // common sentence-starters (ES)
  'Hola', 'Estimado', 'Estimada', 'Buenos', 'Buenas', 'Saludos', 'Gracias',
  'Atentamente', 'El', 'La', 'Los', 'Las', 'Un', 'Una', 'Por', 'Para',
  'Cuando', 'Aunque', 'Además', 'También', 'Sin', 'Pero', 'Señor', 'Señora',
  // common sentence-starters (EN) — greetings/sign-offs precede a name often
  // enough (emails, letters) that they need to be peeled off, not just
  // rejected wholesale.
  'Dear', 'Hello', 'Hi', 'Regards', 'Sincerely', 'Best', 'Thanks', 'Yours',
]);

const NAME_TOKEN = '\\p{Lu}\\p{L}*(?:-\\p{Lu}\\p{L}*)?';
const NAME_MAX_TOKENS = 6;

const NAME_REGEX = new RegExp(
  `${NAME_TOKEN}(?:${WS}+(?:(?:${NAME_PARTICLES.join('|')})${WS}+)?${NAME_TOKEN}){0,${NAME_MAX_TOKENS - 1}}`,
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

const LEADING_WORD_RE = /^(\S+)(\s*)/;

/**
 * A leading stopword ("Dear", "Estimado") must not swallow a real name
 * into one bogus match ("Dear Clara Vance" would otherwise dedup as a
 * different string than "Clara Vance" and mint a second placeholder) — so
 * it's peeled off the front, not used to reject the whole candidate.
 */
const stripLeadingStopwords = (matchText: string, start: number): { text: string; start: number } => {
  let text = matchText;
  let offset = start;
  for (;;) {
    const leading = LEADING_WORD_RE.exec(text);
    if (!leading || !NAME_STOPWORDS.has(leading[1])) break;
    const consumed = leading[0].length;
    text = text.slice(consumed);
    offset += consumed;
  }
  return { text, start: offset };
};

const isLabelColon = (text: string, endIndex: number): boolean => text[endIndex] === ':';

export const detectNames = (text: string): DetectedSpan[] =>
  collect(new RegExp(NAME_REGEX), text, (m) => {
    const { text: matchText, start } = stripLeadingStopwords(m[0], m.index);
    if (tokenCount(matchText) < 2) return null;
    if (isSentenceInitial(text, start)) return null;
    if (isLabelColon(text, start + matchText.length)) return null;
    return {
      start,
      end: start + matchText.length,
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
