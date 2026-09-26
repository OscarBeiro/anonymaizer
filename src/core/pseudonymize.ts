import { applyEnabledMappings } from './apply';
import {
  COMPANY_LEADS,
  COMPANY_TAILS,
  DEFAULT_COMPANY_SUFFIX,
  GIVEN_NAMES,
  SURNAMES,
} from './data/es/pseudonyms';
import { inferMoneyConvention, type MoneyConvention } from './money';
import { hashSeed, mulberry32, pick } from './random';
import type { MappingItem, MappingSession } from './types';

// P13: the realistic output mode. Same detection run, same mappings — only the
// string each enabled mapping renders as differs. One-way by design: nothing
// here is reversible, and step 3 does not try.

export interface PseudonymOptions {
  /** The document's grouping convention (P12), for amounts that can't settle it themselves. */
  convention?: MoneyConvention;
  /** Redraw counter, used by pseudonymMap to resolve collisions. */
  attempt?: number;
}

const isAllCaps = (s: string): boolean => /\p{L}/u.test(s) && s === s.toUpperCase();

const fakeName = (original: string, rng: () => number): string => {
  const tokens = original.trim().split(/\s+/).length;
  const parts = [pick(rng, GIVEN_NAMES)];
  if (tokens >= 2) parts.push(pick(rng, SURNAMES));
  if (tokens >= 3) {
    let second = pick(rng, SURNAMES);
    while (second === parts[1]) second = pick(rng, SURNAMES);
    parts.push(second);
  }
  const name = parts.join(' ');
  return isAllCaps(original) ? name.toUpperCase() : name;
};

const LEGAL_SUFFIX =
  /(,?\s+)(S\.L\.U\.|S\.A\.U\.|S\.Coop\.|S\.L\.|S\.A\.|SLU|SAU|SCP|SL|SA|Inc\.?|Ltd\.?|LLC|LLP|Corp\.?|PLC|GmbH|AG|BV|NV|SAS|SARL)$/;

const fakeCompany = (original: string, rng: () => number): string => {
  const suffix = LEGAL_SUFFIX.exec(original);
  const core = `${pick(rng, COMPANY_LEADS)} ${pick(rng, COMPANY_TAILS)}`;
  const name = suffix ? `${core}${suffix[1]}${suffix[2]}` : `${core} ${DEFAULT_COMPANY_SUFFIX}`;
  return isAllCaps(original.replace(LEGAL_SUFFIX, '')) ? name.toUpperCase() : name;
};

// The numeral inside a MONEY span, and how it was written.
const NUMERAL = /\d(?:[\d.,  ]*\d)?/;

interface Numeral {
  value: number; // unsigned
  decimals: number;
  group: string | null; // the grouping character used, if any
  style: MoneyConvention;
}

const readNumeral = (num: string, fallback: MoneyConvention): Numeral => {
  const dots = num.split('.').length - 1;
  const commas = num.split(',').length - 1;
  let style = fallback;
  if (dots && commas) style = num.lastIndexOf('.') > num.lastIndexOf(',') ? 'EN' : 'ES';
  else if (dots + commas > 1) style = dots ? 'ES' : 'EN';
  else if (dots + commas === 1) {
    const tail = num.length - num.search(/[.,]/) - 1;
    if (tail !== 3) style = dots ? 'EN' : 'ES';
  }
  const decimalChar = style === 'ES' ? ',' : '.';
  const groupChar = style === 'ES' ? '.' : ',';
  const [intPart, decPart = ''] = num.split(decimalChar);
  const group = /[  ]/.exec(intPart)?.[0] ?? (intPart.includes(groupChar) ? groupChar : null);
  const digits = intPart.replace(/[^\d]/g, '');
  return { value: Number(`${digits}.${decPart || '0'}`), decimals: decPart.length, group, style };
};

const formatNumeral = (value: number, n: Numeral): string => {
  const [intDigits, decDigits] = value.toFixed(n.decimals).split('.');
  const grouped = n.group ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, n.group) : intDigits;
  return decDigits ? `${grouped}${n.style === 'ES' ? ',' : '.'}${decDigits}` : grouped;
};

/**
 * Multiply by a random factor in ±10–25% and round to the original's
 * precision — to its decimals, or for a whole round figure to its trailing
 * zeros, so "1.250.000 €" stays a round figure — then nudge by one rounding
 * unit if rounding pushed the result out of the band.
 */
const perturbMoney = (original: string, rng: () => number, convention: MoneyConvention): string | null => {
  const match = NUMERAL.exec(original);
  if (!match) return null; // written-out: no plausible numeric re-rendering
  const n = readNumeral(match[0], convention);
  if (n.value === 0) return null;

  let unit = 10 ** -n.decimals;
  if (n.decimals === 0) {
    const zeros = /0*$/.exec(String(Math.round(n.value)))![0].length;
    unit = 10 ** zeros;
    while (unit > 1 && unit > 0.15 * n.value) unit /= 10;
  }
  const direction = rng() < 0.5 ? -1 : 1;
  const factor = 1 + direction * (0.1 + rng() * 0.15);
  let fake = Math.round((n.value * factor) / unit) * unit;
  const deviation = () => Math.abs(fake / n.value - 1);
  for (let i = 0; i < 4 && deviation() < 0.1; i++) fake += direction * unit;
  for (let i = 0; i < 4 && deviation() > 0.25; i++) fake -= direction * unit;
  if (fake <= 0) fake = unit;

  const numeral = formatNumeral(fake, n);
  return original.slice(0, match.index) + numeral + original.slice(match.index + match[0].length);
};

/**
 * The realistic stand-in for one mapping: NAME and COMPANY from the bundled
 * pools, MONEY perturbed, and the placeholder itself for every category with
 * no plausible fake form (DNI/NIE/IBAN/CREDIT_CARD and the rest — a fake but
 * validly checksummed identifier is worse than an obvious token, and an
 * invalid one fools nobody). Deterministic for (item, seed, attempt).
 */
export const pseudonymFor = (item: MappingItem, seed: string, options: PseudonymOptions = {}): string => {
  const rng = mulberry32(hashSeed(seed, item.category, item.originalText, String(options.attempt ?? 0)));
  switch (item.category) {
    case 'NAME':
      return fakeName(item.originalText, rng);
    case 'COMPANY':
      return fakeCompany(item.originalText, rng);
    case 'MONEY':
      return perturbMoney(item.originalText, rng, options.convention ?? 'ES') ?? item.placeholder;
    default:
      return item.placeholder;
  }
};

const MAX_ATTEMPTS = 50;

/**
 * Every mapping's fake value, keyed by mapping id, unique within the session:
 * two different people never draw the same fake name, and no fake is a real
 * text from the same document. Collisions redraw with the next attempt.
 */
export const pseudonymMap = (
  mappings: MappingItem[],
  seed: string,
  options: Omit<PseudonymOptions, 'attempt'> = {},
): Map<string, string> => {
  const originals = new Set(mappings.flatMap((m) => m.variants.map((v) => v.toLowerCase())));
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const item of mappings) {
    let fake = pseudonymFor(item, seed, options);
    for (let attempt = 1; attempt < MAX_ATTEMPTS && (used.has(fake) || originals.has(fake.toLowerCase())); attempt++) {
      fake = pseudonymFor(item, seed, { ...options, attempt });
    }
    used.add(fake);
    result.set(item.id, fake);
  }
  return result;
};

/**
 * The realistic rendering of a session, built through the same replacement
 * as the placeholder output (applyEnabledMappings) so the two cannot drift.
 * Seeded from the session id: reopening a document shows the same fakes.
 */
export const renderPseudonymized = (session: MappingSession): string => {
  const fakes = pseudonymMap(session.mappings, session.sessionId, {
    convention: inferMoneyConvention(session.rawMarkdown),
  });
  return applyEnabledMappings(session.rawMarkdown, session.mappings, (m) => fakes.get(m.id) ?? m.placeholder);
};
