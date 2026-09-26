import { RUNG, type DetectedSpan } from './types';

// P12: MONEY. Lives beside detectors.ts rather than in it because it carries
// its own companion API — the grouping-convention inference and the amount
// parser P13's perturbation consumes — and detectors.ts is long enough.
//
// Precision-first (§4a): a number is an amount only with a currency marker —
// a symbol, an ISO 4217 code or a currency word — on one side. A bare number
// never matches.

/** `ES` = `1.234,56`, `EN` = `1,234.56`. */
export type MoneyConvention = 'ES' | 'EN';

const SYMBOL = '[€$£¥]';
const ISO = '(?:EUR|USD|GBP|JPY|CHF|CAD|AUD|MXN|ARS|COP|CLP|PEN|BRL|CNY)';
const WORD = '(?:euros?|d[óo]lares|d[óo]lar|dollars?)';
// Grouped (1.234.567,89 / 1,234,567.89) first, so the plain form can't stop
// short at "1.23"; decimals are 1–2 digits, so a 3-digit tail is a group.
const NUM = '(?:\\d{1,3}(?:[.,\\u00A0\\u202F]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
const NUM_END = '(?![\\p{N}]|[.,]\\p{N})';
const MAG = '(?:mil\\s+millones|millones|mill[óo]n|billones|bill[óo]n|mil|million|billion)(?![\\p{L}])';
const SIGN = '[-−]';
const START = '(?<![\\p{L}\\p{N}.,])';
const SEP = '[ \\u00A0\\u202F]?';

const PREFIXED = `${START}\\(?${SIGN}?(?:${SYMBOL}|${ISO}(?![\\p{L}]))${SEP}${SIGN}?${NUM}${NUM_END}(?:\\s+${MAG})?\\)?`;
const SUFFIXED = `${START}\\(?${SIGN}?${NUM}${NUM_END}(?:\\s+${MAG})?(?:\\s+de)?${SEP}(?:${SYMBOL}|(?:${ISO}|${WORD})(?![\\p{L}\\p{N}]))\\)?`;
const NUMERIC_REGEX = new RegExp(`${PREFIXED}|${SUFFIXED}`, 'gu');

// Written-out Spanish ("mil euros", "dos millones de euros", "treinta y
// cinco euros"): a run of number words, then the currency word.
const NUMBER_WORD =
  '(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|' +
  'diecis[ée]is|diecisiete|dieciocho|diecinueve|veinte|veinti\\p{L}+|treinta|cuarenta|cincuenta|' +
  'sesenta|setenta|ochenta|noventa|cien|ciento|(?:dos|tres|cuatro|seis|sete|ocho|nove)cient[oa]s|' +
  'quinient[oa]s|mil|mill[óo]n|millones|bill[óo]n|billones)';
const WRITTEN_REGEX = new RegExp(
  `(?<![\\p{L}])${NUMBER_WORD}(?:\\s+(?:y\\s+)?${NUMBER_WORD})*\\s+(?:de\\s+)?${WORD}(?![\\p{L}])`,
  'giu',
);

/** Drop a paren the regex took on one side only: "(total 30 €)" → "30 €". */
const balance = (start: number, text: string): [number, string] => {
  const open = text.startsWith('(');
  const close = text.endsWith(')');
  if (open && !close) return [start + 1, text.slice(1)];
  if (close && !open) return [start, text.slice(0, -1)];
  return [start, text];
};

const matches = (regex: RegExp, text: string): Array<[number, string]> =>
  [...text.matchAll(regex)].map((m) => balance(m.index, m[0]));

// A written-out match can overlap a numeric one ("2,5 millones de euros"
// also reads as "millones de euros"): the numeric match, found first, wins.
const withoutOverlaps = (found: Array<[number, string]>): Array<[number, string]> => {
  const kept: Array<[number, string]> = [];
  for (const [start, match] of found) {
    const end = start + match.length;
    if (!kept.some(([s, m]) => start < s + m.length && s < end)) kept.push([start, match]);
  }
  return kept;
};

export const detectMoney = (text: string): DetectedSpan[] =>
  withoutOverlaps([...matches(NUMERIC_REGEX, text), ...matches(WRITTEN_REGEX, text)]).map(([start, match]) => ({
    start,
    end: start + match.length,
    category: 'MONEY',
    text: match,
    confidence: 1,
    source: 'regex',
    rung: RUNG.MONEY,
  }));

const DIGITS = /\d(?:[\d.,  ]*\d)?/;

/** What the separators alone say about one number, or null when they can't tell. */
const ownConvention = (num: string): MoneyConvention | null => {
  const dots = num.split('.').length - 1;
  const commas = num.split(',').length - 1;
  if (dots && commas) return num.lastIndexOf('.') > num.lastIndexOf(',') ? 'EN' : 'ES';
  if (!dots && !commas) return null;
  const sep = dots ? '.' : ',';
  if (dots + commas > 1) return sep === '.' ? 'ES' : 'EN'; // repeated → grouping
  const tail = num.length - num.indexOf(sep) - 1;
  if (tail === 3) return null; // "1.234": a group or three decimals
  return sep === '.' ? 'EN' : 'ES'; // decimal separator
};

/**
 * The document's grouping convention, from the majority of unambiguous
 * currency-marked amounts in it; ES on a tie or no evidence. Only amounts
 * count — dates, versions and article numbers would vote noise.
 */
export const inferMoneyConvention = (text: string): MoneyConvention => {
  let es = 0;
  let en = 0;
  for (const [, match] of matches(NUMERIC_REGEX, text)) {
    const num = DIGITS.exec(match)?.[0];
    const vote = num ? ownConvention(num) : null;
    if (vote === 'ES') es++;
    if (vote === 'EN') en++;
  }
  return en > es ? 'EN' : 'ES';
};

const MAGNITUDES: Array<[RegExp, number]> = [
  [/mil\s+millones|billion/iu, 1e9],
  [/billones|bill[óo]n/iu, 1e12],
  [/millones|mill[óo]n|million/iu, 1e6],
  [/(?<![\p{L}])mil(?![\p{L}])/iu, 1e3],
];

/**
 * The signed value of a numeric MONEY span, read in `convention` unless the
 * number's own separators settle it. Null for written-out amounts.
 */
export const parseMoneyAmount = (text: string, convention: MoneyConvention): number | null => {
  const num = DIGITS.exec(text)?.[0];
  if (!num) return null;
  const style = ownConvention(num) ?? convention;
  const [group, decimal] = style === 'ES' ? ['.', ','] : [',', '.'];
  const plain = num.replace(/[  ]/g, '').split(group).join('').replace(decimal, '.');
  let value = Number(plain);
  const rest = text.slice(text.indexOf(num) + num.length);
  const magnitude = MAGNITUDES.find(([re]) => re.test(rest));
  if (magnitude) value *= magnitude[1];
  const negative = /[-−]/.test(text) || (text.startsWith('(') && text.endsWith(')'));
  return negative ? -value : value;
};
