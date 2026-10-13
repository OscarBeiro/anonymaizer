import type { DetectedLanguage } from './langDetect';
import { DEFAULT_PROFILE, resolveProfile, type DetectionProfile } from './packs/profile';
import { LEGACY_LEXICON, languageLexicon, type DetectorLexicon } from './packs/lexicons';
import { LANGUAGE_PACKS } from './packs/registry';
import type { JurisdictionPack, PackDetector } from './packs/types';
import { COMPANY_ACRONYM, DEFAULT_CATEGORY_SETTINGS, isCategoryOn, type CategorySettings } from './categories';
import { detectMoney } from './money';
import { detectLocations, detectSpanishPostalAddressFragments } from './locations';
import { RUNG, type DetectedSpan } from './types';
import { ibanCheck, inspectDniNie, luhnCheck } from './validators';

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

const STREET_KEYWORDS = LEGACY_LEXICON.streetKeywords;

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

const DNI_REGEX = /\b\d{2}\.?\d{3}\.?\d{3}-?[A-Za-z]\b/g;
const NIE_REGEX = /\b[XYZxyz]\d{7}[A-Za-z]\b/g;

// D1: a label right before the number ("DNI 45678912Q", "NIF: …",
// "documento nº …"). Contextual evidence that the thing is an identity
// document even when its check letter says otherwise — it raises the
// confidence of an INVALID_ID, it is not a gate (see below).
// L2: how far back buildIdSpan looks for a label or a URL character.
const LOOKBACK_CHARS = 40;

const ID_LABEL_BEFORE_RE = new RegExp(
  `(?:D\\.?N\\.?I\\.?|N\\.?I\\.?E\\.?|N\\.?I\\.?F\\.?|documento|identidad)` +
    // Filler between the label and the number: "DNI nº", "el DNI es".
    `(?:${WS}+(?:es|son|num(?:\\.|ero)?|número))?${WS}*(?:n[ºo°]\\.?)?${WS}*[:\\-]?${WS}*$`,
  'iu',
);

// D1: a number that is ID-shaped only because it sits inside a URL or a
// query string is the one false positive worth excluding outright — there is
// no plausible reading of `…/76543210X` as somebody's DNI, and URLs are
// common enough in these documents to matter.
const URLISH_BEFORE_RE = /[/=&?#]$/;

/**
 * DNI/NIE, valid or not (D1).
 *
 * The checksum used to be a gate: a number whose check letter did not match
 * was not tagged as anything and went out in plain text. That fails open on
 * exactly the documents most likely to be mangled (OCR, hand-editing), and it
 * has bitten this repo twice — a fixture's `45678912Q` at P8b, and the
 * clinical-report bench's own `33112244F`, which the suite had therefore
 * never once seen redacted.
 *
 * So the checksum now only *classifies*: a valid number stays `DNI`/`NIE` at
 * confidence 1 exactly as before, and an ID-shaped number with a bad check
 * letter is tagged `INVALID_ID` — a distinct category, deliberately, because
 * the user reviewing step 2 must be able to tell a verified ID from a guess,
 * and confidence alone is not visible enough for that.
 *
 * On the false-positive surface: any 8-digit-plus-letter token is now a
 * candidate (an invoice number, a product code). We take that over-mask
 * knowingly — per the plan's settled trade-off, an over-mask is visible in
 * step 2 and untickable, a missed ID is silent and already out the door — and
 * the cost is measured in the tests (`detectors.test.ts`, "over-masks an
 * invoice-style code"). A label anchor is *not* required, because the
 * fixture that motivated this session (`… LAURA - 33112244F`, a signature
 * block) has no label; it raises confidence from 0.5 to 0.9 instead.
 */
const buildIdSpan = (
  text: string,
  m: RegExpExecArray,
  validCategory: 'DNI' | 'NIE',
): DetectedSpan | null => {
  const inspection = inspectDniNie(m[0]);
  if (!inspection) return null;

  const base = { start: m.index, end: m.index + m[0].length, text: m[0], source: 'regex' as const };

  if (inspection.valid) {
    return { ...base, category: validCategory, confidence: 1, rung: RUNG.VALIDATED_REGEX };
  }

  // L2: a bounded look-back; both patterns are anchored at the end of `before`
  // and only ever look a few tokens back, so the full prefix was O(n) per match.
  const before = text.slice(Math.max(0, m.index - LOOKBACK_CHARS), m.index);
  if (URLISH_BEFORE_RE.test(before)) return null;

  return {
    ...base,
    category: 'INVALID_ID',
    confidence: ID_LABEL_BEFORE_RE.test(before) ? 0.9 : 0.5,
    rung: RUNG.INVALID_ID,
  };
};

export const detectDni = (text: string): DetectedSpan[] =>
  collect(new RegExp(DNI_REGEX), text, (m) => buildIdSpan(text, m, 'DNI'));

export const detectNie = (text: string): DetectedSpan[] =>
  collect(new RegExp(NIE_REGEX), text, (m) => buildIdSpan(text, m, 'NIE'));

// EU VAT identifiers (including Spain's NIF/CIF company identifiers). This
// recognizes country-specific shapes offline; it does not query VIES or
// establish that an identifier is currently registered. Separators commonly
// used in documents are accepted and removed before validation.
const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /U\d{8}/,
  BE: /[01]\d{9}/,
  BG: /\d{9,10}/,
  CY: /\d{8}[A-Z]/,
  CZ: /\d{8,10}/,
  DE: /\d{9}/,
  DK: /\d{8}/,
  EE: /\d{9}/,
  EL: /\d{9}/,
  ES: /[ABCDEFGHJNPQRSUVWXYZ]\d{7}[A-Z0-9]|\d{8}[A-Z]/,
  FI: /\d{8}/,
  FR: /[A-HJ-NP-Z0-9]{2}\d{9}/,
  HR: /\d{11}/,
  HU: /\d{8}/,
  IE: /\d{7}[A-W][A-I]?/,
  IT: /\d{11}/,
  LT: /(?:\d{9}|\d{12})/,
  LU: /\d{8}/,
  LV: /\d{11}/,
  MT: /\d{8}/,
  NL: /\d{9}B\d{2}/,
  PL: /\d{10}/,
  PT: /\d{9}/,
  RO: /\d{2,10}/,
  SE: /\d{12}/,
  SI: /\d{8}/,
  SK: /\d{10}/,
};
const VAT_PREFIXES = Object.keys(VAT_PATTERNS).join('|');
const VAT_PREFIX_REGEX = new RegExp(`\\b(?:${VAT_PREFIXES})`, 'g');
const ES_CIF_LABEL_REGEX = /\b(?:CIF(?:\/NIF)?|NIF(?:-IVA)?|VAT|IVA)\b[ \t:./-]*((?:ES)?[ABCDEFGHJNPQRSUVW]\d[\d \t./-]{5,10}[A-Z0-9])\b/giu;
const VAT_BODY_CHARS = /^[A-Z0-9 \t./-]$/i;
const VAT_MAX_BODY_LENGTH = 26;

const isValidSpanishCif = (candidate: string): boolean => {
  const normalized = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]$/.test(normalized)) return false;
  const digits = normalized.slice(1, 8);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else sum += n;
  }
  const control = (10 - (sum % 10)) % 10;
  const letters = 'JABCDEFGHI';
  const initial = normalized[0];
  const check = normalized[8];
  const needsLetter = 'KPQRSNW'.includes(initial);
  const needsDigit = 'ABEH'.includes(initial);
  return (!needsLetter || check === letters[control]) && (!needsDigit || check === String(control)) &&
    (needsLetter || needsDigit || check === letters[control] || check === String(control));
};

const isValidVatShape = (candidate: string): boolean => {
  const normalized = candidate.toUpperCase().replace(/^[A-Z]{2}/, '').replace(/[^A-Z0-9]/g, '');
  const country = candidate.slice(0, 2).toUpperCase();
  const pattern = VAT_PATTERNS[country];
  if (!pattern || !new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace('g', '').replace('y', '')).test(normalized)) return false;
  // Spanish CIF/NIF: verify the control character for the common 8-char CIF
  // form. The remaining national formats are shape-checked only here.
  if (country === 'ES' && /^[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]$/.test(normalized)) return isValidSpanishCif(normalized);
  return true;
};

export const detectVatNumbers = (text: string): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  const countryRegex = new RegExp(VAT_PREFIX_REGEX);
  let match: RegExpExecArray | null;
  while ((match = countryRegex.exec(text)) !== null) {
    const bodyStart = match.index + match[0].length;
    let bodyEnd = bodyStart;
    while (bodyEnd < text.length && bodyEnd - bodyStart < VAT_MAX_BODY_LENGTH && VAT_BODY_CHARS.test(text[bodyEnd])) bodyEnd++;
    const body = text.slice(bodyStart, bodyEnd);
    for (let end = body.length; end > 0; end--) {
      const candidate = `${match[0]}${body.slice(0, end)}`.replace(/[ \t./-]+$/, '');
      const boundary = text[match.index + candidate.length];
      if (/[A-Z0-9]/i.test(boundary ?? '')) continue;
      // A space followed by digits continues a grouped identifier. Do not
      // accept a valid-looking prefix from an overlong number such as
      // "DE123456789 123".
      if (/[ \t./-]/.test(boundary ?? '') && /^\s*\d/.test(text.slice(match.index + candidate.length))) continue;
      if (!isValidVatShape(candidate)) continue;
      spans.push({ start: match.index, end: match.index + candidate.length, text: candidate, category: 'VAT_NUMBER', confidence: 0.75, source: 'regex', rung: RUNG.ID_CODE });
      break;
    }
    if (match[0].length === 0) countryRegex.lastIndex++;
  }
  const cifRegex = new RegExp(ES_CIF_LABEL_REGEX);
  while ((match = cifRegex.exec(text)) !== null) {
    const candidate = match[1];
    const companyId = candidate.toUpperCase().replace(/^ES/, '');
    const valid = isValidSpanishCif(companyId);
    spans.push({ start: match.index + match[0].indexOf(candidate), end: match.index + match[0].indexOf(candidate) + candidate.length, text: candidate, category: 'VAT_NUMBER', confidence: valid ? 0.9 : 0.65, source: 'regex', rung: RUNG.ID_CODE });
  }
  const unique = new Map<string, DetectedSpan>();
  for (const span of spans) {
    const key = `${span.start}:${span.end}:${span.category}`;
    const previous = unique.get(key);
    if (!previous || span.confidence > previous.confidence) unique.set(key, span);
  }
  return [...unique.values()];
};

// Group width is 1-4, not a fixed 4: several countries' conventional
// display grouping ends in a short trailing group (German IBANs, e.g.
// "DE89 3704 0044 0532 0130 00", end in a 2-char group).
const IBAN_REGEX = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{1,4}){2,7}\b/g;

export const detectIbans = (text: string): DetectedSpan[] =>
  collect(new RegExp(IBAN_REGEX), text, (m) => {
    // The greedy group run can swallow a trailing token ("… 1332 EUR"), so on
    // a failed checksum retry with trailing groups dropped before giving up.
    let candidate = m[0];
    while (!ibanCheck(candidate)) {
      const cut = candidate.search(/\s?[A-Z0-9]{1,4}$/);
      if (cut <= 4) return null;
      candidate = candidate.slice(0, cut);
    }
    return {
      start: m.index,
      end: m.index + candidate.length,
      category: 'IBAN',
      text: candidate,
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

// A run of digits/letters/mask glyphs containing a mask run of 2+ — the
// checksum-validated detectors above (DNI, IBAN, credit card) can't fire on
// a partially-redacted value like "76****12E", so without this the value
// stays exposed and, worse, a lone trailing letter can look like a NAME
// token to a detector that doesn't know it's attached to a masked ID.
const MASK_GLYPHS = '*xX•_';
const MASKED_ID_TOKEN_REGEX = new RegExp(
  `(?<![0-9A-Za-z${MASK_GLYPHS}])[0-9A-Za-z${MASK_GLYPHS}]+(?![0-9A-Za-z${MASK_GLYPHS}])`,
  'g',
);
const MASK_RUN_REGEX = new RegExp(`[${MASK_GLYPHS}]{2,}`);

export const detectMaskedIds = (text: string): DetectedSpan[] =>
  collect(new RegExp(MASKED_ID_TOKEN_REGEX), text, (m) => {
    const token = m[0];
    if (!MASK_RUN_REGEX.test(token)) return null;
    const alnumCount = token.replace(new RegExp(`[${MASK_GLYPHS}]`, 'g'), '').length;
    if (alnumCount < 4) return null;
    return {
      start: m.index,
      end: m.index + token.length,
      category: 'MASKED_ID',
      text: token,
      confidence: 1,
      source: 'regex',
      rung: RUNG.VALIDATED_REGEX,
    };
  });

// Label-anchored codes with no universal shape of their own — a professional
// membership number, a case/expediente reference. The label word is the only
// thing that makes these recognizable as PII at all, so it is what anchors
// the match; only the code itself becomes a span (and a placeholder) — the
// label stays in the text so "Colegiada [[ID_CODE_001]]" still reads.
// Longest/most specific first, same reasoning as COMPANY_SUFFIXES: "Nº
// Colegiado" before the bare "Nº".
const ID_CODE_TRIGGERS = [
  'Nº${WS}+de${WS}+afiliación', 'Nº${WS}+Colegiado', 'Colegiada', 'Colegiado',
  'Expediente', 'Referencia', 'Ref\\.', 'Matrícula', 'NUSS',
  'Historia${WS}+clínica', 'Protocolo', 'Núm\\.', 'Nº',
].map((t) => t.replace(/\$\{WS\}/g, WS));

const ID_CODE_REGEX = new RegExp(
  `\\b(?:${ID_CODE_TRIGGERS.join('|')})${WS}*[:\\-]?${WS}*([A-Z]{0,3}[-/]?\\d[\\dA-Z/-]*)`,
  'giud',
);

export const detectIdCodes = (text: string): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  const regex = new RegExp(ID_CODE_REGEX);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // 'd' flag: match.indices gives each capture group's own [start, end],
    // which is how the label stays out of the span while the trigger word
    // still anchors the match.
    const indices = (match as RegExpExecArray & { indices: Array<[number, number] | undefined> }).indices;
    const group = indices?.[1];
    if (group) {
      const [start, end] = group;
      spans.push({
        start,
        end,
        category: 'ID_CODE',
        text: text.slice(start, end),
        confidence: 1,
        source: 'regex',
        rung: RUNG.ID_CODE,
      });
    }
    if (match[0].length === 0) regex.lastIndex++;
  }
  return spans;
};

// P11: a detector runs only when one of the categories it can emit is on
// (skipping the work, not hiding it afterwards); its output is then trimmed
// to the categories that are on — detectDni/detectNie emit both a valid
// category and INVALID_ID, which toggle independently.
const gated = (
  settings: CategorySettings,
  categories: string[],
  detect: (text: string) => DetectedSpan[],
  text: string,
): DetectedSpan[] => {
  const on = categories.filter((c) => isCategoryOn(settings, c));
  if (on.length === 0) return [];
  return detect(text).filter((span) => on.includes(span.category));
};

export const runDeterministicDetectors = (
  text: string,
  settings: CategorySettings = DEFAULT_CATEGORY_SETTINGS,
): DetectedSpan[] => [
  ...gated(settings, ['EMAIL'], detectEmails, text),
  ...gated(settings, ['IBAN'], detectIbans, text),
  ...gated(settings, ['VAT_NUMBER'], detectVatNumbers, text),
  ...gated(settings, ['CREDIT_CARD'], detectCreditCards, text),
  ...gated(settings, ['DNI', 'INVALID_ID'], detectDni, text),
  ...gated(settings, ['NIE', 'INVALID_ID'], detectNie, text),
  ...gated(settings, ['MASKED_ID'], detectMaskedIds, text),
  ...gated(settings, ['ID_CODE'], detectIdCodes, text),
  ...gated(settings, ['PHONE'], detectPhones, text),
  ...gated(settings, ['MONEY'], detectMoney, text),
  ...gated(settings, ['ADDRESS'], value => [...detectAddresses(value), ...detectSpanishPostalAddressFragments(value)], text),
  ...gated(settings, ['LOCATION'], detectLocations, text),
];

const alternatives = (values: readonly string[]): string => values.length ? values.join('|') : '(?!)';

const createLanguageDetectors = (lexicon: DetectorLexicon) => {
  // Legal-form suffixes, longest/most-specific first so alternation doesn't
  // stop at a shorter overlapping prefix (e.g. "SLU" before "SL"). Hoisted
  // above the NAME section (D2) because detectNames' comma-continuation guard
  // needs it too, to keep "Acme Consulting, S.L." from being read as a person.
  const COMPANY_SUFFIXES = lexicon.companySuffixes;

  const COMPANY_SUFFIX_REGEX = new RegExp(
    `\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*,?${WS}+(?:${alternatives(COMPANY_SUFFIXES)})(?=[\\s.,;:!?)]|$)`,
    'gu',
  );

  const COMPANY_PREFIXES = lexicon.companyPrefixes;

  const COMPANY_PREFIX_REGEX = new RegExp(
    `\\b(?:${alternatives(COMPANY_PREFIXES)})${WS}+\\p{Lu}\\p{L}*(?:${WS}+\\p{Lu}\\p{L}*)*`,
    'gu',
  );

  const detectCompanies = (text: string): DetectedSpan[] => {
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

  // Fiscal/technical terms, plus (D5) legal, business and tech vocabulary that
  // reads as an acronym but never names a counterparty. Public bodies written as
  // acronyms (AEAT, CNMV…) are not here: they are shielded via INSTITUTION_HEADS.
  const ACRONYM_EXCLUSIONS = new Set(lexicon.acronymExclusions);

  const COMPANY_ACRONYM_REGEX = /\b[A-Z]{2,}\b/g;

  const detectCompanyAcronyms = (text: string): DetectedSpan[] =>
    collect(new RegExp(COMPANY_ACRONYM_REGEX), text, (m) => {
      if (ACRONYM_EXCLUSIONS.has(m[0])) return null;
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
  // Exported for entities.ts (P7c): canonicalizing a name for clustering drops
  // the same particles that NAME already treats as connective, not name-bearing.
  const NAME_PARTICLES = lexicon.nameParticles;

  const NAME_STOPWORDS = new Set(lexicon.stopwords);

  // Professional-title lexemes (also used by detectProfessionalTitles below to
  // shield a title + its closed qualifier list). A bare title immediately
  // before a real name — "Psicóloga Ester Cuni" — must not pull that title
  // into the NAME candidate, so it is peeled off the front the same way a
  // stopword is, not excluded by rejecting the whole match.
  const TITLE_LEXEMES = lexicon.titleLexemes;

  // At least two letters per token, with one explicit exception for a real
  // initial ("J." in "J. Smith") — otherwise a lone capital letter left behind
  // by a masked ID or a code (the "E" in "76****12E") is itself a valid token,
  // and picks up a real name's tokenCount>=2 floor for free by combining with
  // whatever capitalized word happens to follow it.
  const NAME_TOKEN = '(?:\\p{Lu}\\p{L}+(?:-\\p{Lu}\\p{L}+)?|\\p{Lu}\\.)';
  const NAME_MAX_TOKENS = 6;

  const NAME_REGEX = new RegExp(
    `${NAME_TOKEN}(?:${WS}+(?:(?:${alternatives(NAME_PARTICLES)})${WS}+)?${NAME_TOKEN}){0,${NAME_MAX_TOKENS - 1}}`,
    'gu',
  );

  // Words that legitimately open a line and are followed by a capitalized value,
  // so the value must not be read as a *given name*: "Expediente EV-014",
  // "Informe Final", "Paciente Mario Prieto Casal". They are peeled off the
  // front like a stopword or a title (see stripLeadingLabels), which is why
  // "Paciente Mario Prieto Casal" still yields the name — rejecting the whole
  // match instead would turn the most name-dense lines in a document into a
  // blind spot.
  //
  // Matched case-insensitively, because headings are as often "INFORME" as
  // "Informe".
  const STRUCTURE_HEADS = lexicon.structureHeads;

  // D6: nouns that introduce a lettered item ("Punto G.", "Opción C.") — with
  // NAME_TOKEN's initial exception, "Punto G. Anexo" otherwise reads as a person
  // with a middle initial. Consulted only for a match that contains an initial.
  const LETTERED_ITEM_HEADS = lexicon.letteredItemHeads;
  const LETTERED_CONTEXT_WORDS = new Set(
    [...LETTERED_ITEM_HEADS, ...STRUCTURE_HEADS].map((word) => word.toLowerCase()),
  );
  const INITIAL_TOKEN_RE = /^\p{Lu}\.$/u;

  // A match with an initial is a lettered item, not a person, when any of its
  // full words is a structure or lettered-item head: "Punto G. Anexo",
  // "B. Cláusula". A real "Juan G. Pérez" has no such word.
  const isLetteredItem = (match: string): boolean => {
    const words = match.split(/\s+/);
    if (!words.some((word) => INITIAL_TOKEN_RE.test(word))) return false;
    return words.some((word) => LETTERED_CONTEXT_WORDS.has(word.toLowerCase()));
  };

  const isSentenceInitial = (text: string, index: number): boolean => {
    let i = index - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    if (i < 0) return true;
    return /[.!?]/.test(text[i]);
  };

  const tokenCount = (match: string): number =>
    match.split(/\s+/).filter((word) => !NAME_PARTICLES.includes(word)).length;

  // Longest phrase first so "Trabajador Social" matches whole rather than
  // stopping at "Trabajador" (which isn't itself in either list).
  const LEADING_LABELS = [...TITLE_LEXEMES, ...NAME_STOPWORDS].sort((a, b) => b.length - a.length);
  const LEADING_LABEL_RE = new RegExp(`^(?:${alternatives(LEADING_LABELS)})\\b${WS}*`, 'u');

  // An honorific is part of the address, not of the name, and `\p{Lu}\.` makes
  // it a valid NAME_TOKEN — so "D. Mario Prieto Casal" would otherwise cluster
  // separately from "Mario Prieto Casal" and mint a second placeholder for the
  // same person. Peeled like any other leading label. The trailing period is
  // required, which is what keeps this from eating a real initial ("D Mario").
  const HONORIFICS = lexicon.honorifics;
  const HONORIFIC_RE = new RegExp(`^(?:${alternatives(HONORIFICS)})\\.${WS}*`, 'u');

  // A name never begins with a connective particle. Stripping it matters for
  // more than tidiness: "Informe de Evaluación Anual" loses "Informe" as a
  // structure head and would otherwise stand as the candidate
  // "de Evaluación Anual" — two non-particle tokens, so it clears the floor.
  // Peeling the particle lets the strip loop reach "Evaluación", another
  // structure head, and the heading collapses to one token and is rejected.
  const LEADING_PARTICLE_RE = new RegExp(`^(?:${alternatives(NAME_PARTICLES)})\\b${WS}*`, 'u');

  const STRUCTURE_HEAD_RE = new RegExp(
    `^(?:${alternatives([...STRUCTURE_HEADS].sort((a, b) => b.length - a.length))})\\b${WS}*`,
    'iu',
  );

  /**
   * A leading stopword ("Dear", "Estimado") or bare professional title
   * ("Psicóloga") must not swallow a real name into one bogus match — "Dear
   * Clara Vance" would otherwise dedup as a different string than "Clara
   * Vance" and mint a second placeholder, and "Psicóloga Ester Cuni" would
   * lose the name entirely once detectProfessionalTitles' shield claims
   * "Psicóloga" and arbitration drops the whole overlapping NAME candidate. So
   * both are peeled off the front here, not used to reject the whole match.
   */
  const stripLeadingLabels = (matchText: string, start: number, extraLabels?: RegExp): { text: string; start: number } => {
    let text = matchText;
    let offset = start;
    for (;;) {
      const leading =
        extraLabels?.exec(text) ??
        LEADING_LABEL_RE.exec(text) ??
        HONORIFIC_RE.exec(text) ??
        STRUCTURE_HEAD_RE.exec(text) ??
        INSTITUTION_LEAD_RE.exec(text) ??
        LEADING_PARTICLE_RE.exec(text);
      if (!leading) break;
      const consumed = leading[0].length;
      text = text.slice(consumed);
      offset += consumed;
    }
    return { text, start: offset };
  };

  const NAME_STOPWORDS_LOWER = new Set([...NAME_STOPWORDS].map((word) => word.toLowerCase()));

  /**
   * A stopword anywhere in the candidate, not just at the front.
   *
   * Only consulted for a sentence-initial candidate, where there is no
   * lowercase-context evidence at all and a capitalized pair is as likely to be
   * ordinary prose ("Muchas Gracias", "Buenas Tardes") as a person. Mid-sentence
   * the leading-strip is enough, and this would wrongly reject a real surname
   * that happens to collide with the list.
   */
  const containsStopword = (matchText: string, extra?: ReadonlySet<string>): boolean =>
    matchText.split(/\s+/).some((word) => NAME_STOPWORDS_LOWER.has(word.toLowerCase()) || extra?.has(word.toLowerCase()));

  const isLabelColon = (text: string, endIndex: number): boolean => text[endIndex] === ':';

  // Rejects a candidate that starts mid-token — right after a letter, digit, or
  // a masking character (*, ·, •). Without this, a NAME match can begin inside
  // a masked ID or a code (e.g. picking up the trailing check letter of
  // "76****12E") and never shows up as a standalone single-token match to be
  // caught by the token floor above, because it borrows a following word to
  // clear the two-token minimum.
  const PRECEDING_ATTACHED_RE = /[\p{L}\p{N}*·•_]$/u;

  const startsAttachedToPrevious = (text: string, index: number): boolean =>
    index > 0 && PRECEDING_ATTACHED_RE.test(text[index - 1]);

  // D2: "Ferreiro Iglesias, Laura" is one person, not a truncated surname plus
  // a stray given name left in plain text. The base NAME_REGEX above never
  // crosses a comma (deliberately — WS only, no comma in the separator), so a
  // candidate ending right at one is exactly the "Surname Surname," half that
  // this exists to complete.
  //
  // Capped at 1-2 trailing tokens ("require the trailing part to be short") so
  // a citation or a sentence fragment after the comma can't be mistaken for a
  // name continuation, and the trailing capture itself is excluded when its
  // first token is a company suffix, a stopword/title (peeled the same way a
  // leading label is) or a structure head — that's what keeps "Acme
  // Consulting, S.L." and "Ferreiro Iglesias, responsable del proyecto…" from
  // being swallowed. A table cell boundary ("Prieto Casal, Mario | 45678912S")
  // needs no special case: "|" and a digit-shaped token are not NAME_TOKEN
  // shaped, so the trailing capture simply stops at "Mario" on its own.
  // Tested against the raw text right after "," + whitespace — not against
  // what COMMA_CONTINUATION_RE captures, because a suffix like "S.L." is two
  // NAME_TOKENs' worth of characters ("S." then "L.") while the continuation
  // only ever captures one NAME_TOKEN before deciding whether to keep going;
  // checking the untruncated tail catches the suffix regardless of where the
  // token boundary falls.
  // \b, not a lookahead, would fail here exactly like it would in
  // COMPANY_SUFFIX_REGEX: a dotted suffix ends in ".", a non-word char, so
  // "L." followed by a space has no word/non-word transition for \b to catch.
  // U10: an ID keyword after the comma ("Anxo Nogueira Vidal, DNI 12345678Z")
  // is a label for the next field, not a given name.
  const ID_KEYWORDS = 'DNI|NIE|NIF|CIF|NUSS|IBAN';
  const COMMA_TRAILING_EXCLUSION_RE = new RegExp(
    `^(?:${alternatives(COMPANY_SUFFIXES)}|${alternatives(LEADING_LABELS)}|${alternatives(STRUCTURE_HEADS)}|${ID_KEYWORDS})` +
      '(?=[\\s.,;:!?)]|$)',
    'iu',
  );
  const COMMA_CONTINUATION_RE = new RegExp(`^,${WS}*(${NAME_TOKEN}(?:${WS}+${NAME_TOKEN})?)`, 'u');
  const COMMA_WS_RE = new RegExp(`^,${WS}*`, 'u');

  /**
   * Reorders the comma form to given-name-first for clustering. `entities.ts`
   * clusters by token set, order-independent, so this is purely about what the
   * cluster's *canonical* spelling ends up being (`buildMappings` picks the
   * longest variant as canonical) — a reordered "Laura Ferreiro Iglesias" is
   * itself a normal given-first name and wins that comparison cleanly, whereas
   * the literal, comma-bearing surname-first text would be an odd thing to
   * show the user as the canonical spelling of a person.
   */
  const tryExtendCommaForm = (
    text: string,
    matchText: string,
    start: number,
  ): { text: string; end: number } | null => {
    const tail = text.slice(start + matchText.length);
    const afterComma = COMMA_WS_RE.exec(tail);
    if (!afterComma || COMMA_TRAILING_EXCLUSION_RE.test(tail.slice(afterComma[0].length))) return null;
    const continuation = COMMA_CONTINUATION_RE.exec(tail);
    if (!continuation) return null;
    const given = continuation[1];
    return { text: `${given} ${matchText}`, end: start + matchText.length + continuation[0].length };
  };

  const detectNames = (text: string, extraLabels?: RegExp, extraStopwords?: ReadonlySet<string>): DetectedSpan[] =>
    collect(new RegExp(NAME_REGEX), text, (m) => {
      if (isLetteredItem(m[0])) return null;
      const { text: matchText, start } = stripLeadingLabels(m[0], m.index, extraLabels);
      if (tokenCount(matchText) < 2) return null;
      // A sentence-initial candidate is accepted, but only on the strength of
      // the candidate itself: no lowercase word precedes it, so the two-token
      // floor plus the leading strip above (stopwords, titles, structure heads)
      // is all the evidence there is. It used to be rejected outright, which
      // made every line-initial name invisible — the exact blind spot M3's
      // documents are full of. The residual cost is over-masking a title-case
      // heading like "Evaluación Externa Anual"; that is reviewable in step 2,
      // where an unmasked name is not.
      if (isSentenceInitial(text, start) && containsStopword(matchText, extraStopwords)) return null;
      if (startsAttachedToPrevious(text, start)) return null;

      const extended = tryExtendCommaForm(text, matchText, start);
      if (extended) {
        // The label-colon guard below only applies to the un-extended form: a
        // comma-form match, by construction, never ends right before a colon.
        return {
          start,
          end: extended.end,
          category: 'NAME',
          text: extended.text,
          confidence: 0.6,
          source: 'regex',
          rung: RUNG.NAME,
        };
      }

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

  // --- Shields ---------------------------------------------------------------
  //
  // A shield is an ordinary span that wins §4a arbitration like any other, but
  // is dropped before mints and before substitution (see runDetectionPipeline).
  // It exists for text a heuristic would otherwise misread as PII — the fix
  // here is "nothing should touch this", not "tag it as some other category".

  // Longest/most-specific first, same reasoning as COMPANY_SUFFIXES: alternation
  // must not stop at "Real Decreto" before trying "Real Decreto Legislativo".
  const LEGAL_HEADS = lexicon.legalHeads;

  // A citation continues with connector words, more capitalized words, or a
  // numeric/instrument reference such as "1/2013" or "2000/78/CE".
  const LEGAL_CONTINUATION = lexicon.legalContinuation;

  const LEGAL_CITATION_REGEX = new RegExp(
    `\\b(?:${alternatives(LEGAL_HEADS)})(?:${WS}+${LEGAL_CONTINUATION})*`,
    'gu',
  );

  const detectLegalCitations = (text: string): DetectedSpan[] =>
    collect(new RegExp(LEGAL_CITATION_REGEX), text, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      category: 'SHIELD',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.SHIELD,
      shield: true,
    }));

  // TITLE_LEXEMES is declared above, near NAME_STOPWORDS — detectNames' leading
  // -label strip needs it before this point in the file.

  // Deliberately closed: a title lexeme followed by an open capitalized run
  // (like NAME's own shape) would swallow a real name that immediately follows
  // the title — "Psicóloga Ester Cuni" must still yield a NAME. Only words on
  // this list continue the shield past the bare title.
  const TITLE_QUALIFIERS = lexicon.titleQualifiers;

  const PROFESSIONAL_TITLE_REGEX = new RegExp(
    `\\b(?:${alternatives(TITLE_LEXEMES)})(?:${WS}+(?:${alternatives(TITLE_QUALIFIERS)}))*`,
    'gu',
  );

  const detectProfessionalTitles = (text: string): DetectedSpan[] =>
    collect(new RegExp(PROFESSIONAL_TITLE_REGEX), text, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      category: 'SHIELD',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.SHIELD,
      shield: true,
    }));

  // D3: relaxing detectNames' sentence-initial guard (02-name-line-start.md)
  // closed a leak but opened one false positive — two capitalized public-body
  // names joined by "y" (`Seguridad Social y Agencia Tributaria`) have exactly
  // NAME's shape. Not a lexicon meant to grow the way NAME_STOPWORDS or
  // COMPANY_SUFFIXES might: this stays a small, obviously Spain-only array: if
  // this becomes the session that introduces a shared lexicon-pack shape (see
  // the M1 backlog), that decision happens there, not by quietly growing this
  // list.
  const INSTITUTION_HEADS = lexicon.institutionHeads;

  // Unlike a legal citation, an institution's name never continues across "y":
  // with it, "Hacienda y Juan Pérez" shielded the person. Two institutions joined
  // by "y" are each a head, so they are still shielded separately.
  const INSTITUTION_CONTINUATION = lexicon.institutionContinuation;

  const INSTITUTION_REGEX = new RegExp(
    `\\b(?:${alternatives(INSTITUTION_HEADS)})(?:${WS}+${INSTITUTION_CONTINUATION})*`,
    'gu',
  );

  // NAME treats "y" as a particle, so "Hacienda y Juan Pérez" is one NAME
  // candidate; it overlaps the Hacienda shield and arbitration drops it whole,
  // leaking the person. Peeling the institution (and its "y") off the front, like
  // any other leading label, leaves "Juan Pérez" to be masked on its own.
  // Referenced only at call time by stripLeadingLabels, so declaring it here,
  // after INSTITUTION_HEADS, is safe.
  const INSTITUTION_LEAD_RE = new RegExp(
    `^(?:${alternatives(INSTITUTION_HEADS)})(?:${WS}+[ye])?${WS}+`,
    'u',
  );

  const detectPublicInstitutions = (text: string): DetectedSpan[] =>
    collect(new RegExp(INSTITUTION_REGEX), text, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      category: 'SHIELD',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.SHIELD,
      shield: true,
    }));

  // Dates and timestamps that would otherwise pass PHONE's digit-count check
  // (e.g. a signature block's "2026.09.18 13:42:10"). Shielding the whole
  // date/time run is cheaper and more robust than teaching PHONE to recognize
  // every date shape, and it protects the surrounding line from NAME too.
  const DATE_TIME_REGEX = new RegExp(
    '\\b(?:' +
      `\\d{4}[.\\-/]\\d{2}[.\\-/]\\d{2}(?:${WS}+\\d{2}:\\d{2}(?::\\d{2})?)?` +
      '|' +
      `\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}(?:${WS}+\\d{2}:\\d{2}(?::\\d{2})?)?` +
      '|' +
      '\\d{2}:\\d{2}:\\d{2}' +
      ')\\b',
    'g',
  );

  const detectDateTimes = (text: string): DetectedSpan[] =>
    collect(new RegExp(DATE_TIME_REGEX), text, (m) => ({
      start: m.index,
      end: m.index + m[0].length,
      category: 'SHIELD',
      text: m[0],
      confidence: 1,
      source: 'regex',
      rung: RUNG.SHIELD,
      shield: true,
    }));

  const runShieldDetectors = (text: string): DetectedSpan[] => [
    ...detectLegalCitations(text),
    ...detectProfessionalTitles(text),
    ...detectPublicInstitutions(text),
  ];

  const runHeuristicDetectors = (
    text: string,
    settings: CategorySettings = DEFAULT_CATEGORY_SETTINGS,
  ): DetectedSpan[] => [
    ...gated(settings, ['COMPANY'], detectCompanies, text),
    ...gated(settings, ['NAME'], detectNames, text),
    // The acronym guess is a COMPANY span: it needs COMPANY on as well as its own switch.
    ...(isCategoryOn(settings, COMPANY_ACRONYM) ? gated(settings, ['COMPANY'], detectCompanyAcronyms, text) : []),
  ];
  return { detectCompanies, detectCompanyAcronyms, detectNames, detectLegalCitations, detectProfessionalTitles, detectPublicInstitutions, detectDateTimes, runShieldDetectors, runHeuristicDetectors };
};

export const NAME_PARTICLES = [...LEGACY_LEXICON.nameParticles];
export const { detectCompanies, detectCompanyAcronyms, detectNames, detectLegalCitations, detectProfessionalTitles, detectPublicInstitutions, detectDateTimes, runShieldDetectors: legacyLanguageShields, runHeuristicDetectors } = createLanguageDetectors(LEGACY_LEXICON);
export const runShieldDetectors = (text: string): DetectedSpan[] => [...legacyLanguageShields(text), ...detectDateTimes(text)];

/** Jurisdiction detectors stay separate from language context. */
export const JURISDICTION_PACKS: Readonly<Record<string, JurisdictionPack>> = {
  ES: {
    id: 'ES', defaultLanguages: ['es', 'gl'],
    detectors: [
      { categories: ['DNI', 'INVALID_ID'], detect: detectDni },
      { categories: ['NIE', 'INVALID_ID'], detect: detectNie },
      { categories: ['MASKED_ID'], detect: detectMaskedIds },
      { categories: ['ID_CODE'], detect: detectIdCodes },
      { categories: ['PHONE'], detect: detectPhones },
      { categories: ['ADDRESS'], detect: value => [...detectAddresses(value), ...detectSpanishPostalAddressFragments(value)] },
    ],
  },
};

const commonDetectors: readonly PackDetector[] = [
  { categories: ['SHIELD'], detect: detectDateTimes, shield: true },
  { categories: ['EMAIL'], detect: detectEmails },
  { categories: ['IBAN'], detect: detectIbans },
  { categories: ['CREDIT_CARD'], detect: detectCreditCards },
  { categories: ['MONEY'], detect: detectMoney },
  { categories: ['VAT_NUMBER'], detect: detectVatNumbers },
  { categories: ['LOCATION'], detect: detectLocations },
];

const runPackDetectors = (text: string, settings: CategorySettings, detectors: readonly PackDetector[], origin: Pick<DetectedSpan, 'pack' | 'packs'>): DetectedSpan[] =>
  detectors.flatMap(detector => {
    if (detector.switch && !isCategoryOn(settings, detector.switch)) return [];
    const spans = detector.shield ? detector.detect(text) : gated(settings, [...detector.categories], detector.detect, text);
    return spans.map(span => ({ ...span, ...origin }));
  });

/** Category switches gate the active pack detectors; shields are never toggleable.
 * Unsupported languages/jurisdictions contribute no guessed rules. */
export const runAllDetectors = (
  text: string,
  settings: CategorySettings = DEFAULT_CATEGORY_SETTINGS,
  input: DetectionProfile | readonly DetectedLanguage[] = DEFAULT_PROFILE,
): DetectedSpan[] => {
  const profile = resolveProfile(input);
  const packs = [...new Set(profile.languages)].filter(lang => LANGUAGE_PACKS[lang]).sort();
  const candidates = runPackDetectors(text, settings, commonDetectors, { pack: 'common' });
  for (const id of new Set(profile.jurisdictions)) {
    const pack = JURISDICTION_PACKS[id];
    if (pack) candidates.push(...runPackDetectors(text, settings, pack.detectors, { pack: pack.id }));
  }
  // Checksummed IDs stay broad per M6: country selection gates unvalidated
  // guesses, while a valid checksum remains useful evidence in foreign text.
  if (!profile.jurisdictions.includes('ES')) {
    candidates.push(...runPackDetectors(text, settings, [
      { categories: ['DNI'], detect: value => detectDni(value).filter(span => span.category === 'DNI') },
      { categories: ['NIE'], detect: value => detectNie(value).filter(span => span.category === 'NIE') },
    ], { pack: 'ES' }));
  }
  if (packs.length) {
    // One merged name pass keeps greetings/particles from every active language
    // consistent and avoids overlapping partial names from independent passes.
    const detectors = createLanguageDetectors(languageLexicon(packs));
    candidates.push(...runPackDetectors(text, settings, [
      { categories: ['SHIELD'], detect: detectors.runShieldDetectors, shield: true },
      { categories: ['COMPANY'], detect: detectors.detectCompanies },
      { categories: ['NAME'], detect: detectors.detectNames },
      { categories: ['COMPANY'], detect: detectors.detectCompanyAcronyms, switch: COMPANY_ACRONYM },
    ], { packs }));
  }
  return candidates;
};
