// M06-02: name mentions the two-token NAME heuristic cannot see on its own.
// Pure (rule 4).
//
// 1. After a salutation or an honorific a single capitalised word is a name:
//    "Ola Iria,", "Dear Sarah,", "Dr. Suárez", "o señor Costas".
// 2. Once a full name is found, its surnames and given name recur alone:
//    "Antía Varela Souto" … "a Antía evoluciona"; "Javier Ortega Sanz" … "El
//    señor Ortega". Those standalone mentions leaked before.
import { RUNG, type DetectedSpan } from './types';

const WS = '[ \\t]';
const TOKEN = '\\p{Lu}\\p{Ll}+(?:-\\p{Lu}\\p{Ll}+)?';
const PARTICLE = '(?:de|del|da|do|dos|das|la|y|e)';
const NAME_RUN = `${TOKEN}(?:${WS}+(?:${PARTICLE}${WS}+)?${TOKEN}){0,3}`;

const SALUTATIONS = [
  'Ola', 'Hola', 'Hi', 'Hello', 'Hey', 'Dear', 'Querido', 'Querida', 'Benquerido', 'Benquerida',
  'Estimado', 'Estimada', 'Bos días', 'Bo día', 'Boas tardes', 'Buenos días', 'Buenas tardes', 'Good morning',
];
const HONORIFICS = [
  'Sra\\.', 'Srta\\.', 'Sr\\.', 'Dra\\.', 'Dr\\.', 'Dª', 'D\\.ª', 'D\\.', 'Mrs\\.?', 'Mr\\.?', 'Ms\\.?', 'Dr(?=[ \\t])',
  'señor', 'señora', 'señorita', 'Señor', 'Señora', 'don', 'doña', 'dona', 'Don', 'Doña', 'Dona',
];
const alt = (xs: readonly string[]) => [...xs].sort((a, b) => b.length - a.length).join('|');

// A salutation needs the name to end the clause ("Ola Iria," / "Hi Sarah\n"),
// so "Hola Mundo cruel" style prose is left alone.
const SALUTATION_RE = new RegExp(
  `(?<!\\p{L})(?:${alt(SALUTATIONS)})(?:${WS}+(?:${alt(HONORIFICS)}))?${WS}+(${NAME_RUN})(?=${WS}*(?:[,:;!\\n]|$))`,
  'gud',
);
const HONORIFIC_RE = new RegExp(`(?<!\\p{L})(?:${alt(HONORIFICS)})${WS}+(${NAME_RUN})`, 'gud');

const nameSpan = (start: number, end: number, text: string, confidence: number): DetectedSpan => ({
  start, end, category: 'NAME', text, confidence, source: 'regex', rung: RUNG.NAME,
});

/** `excluded`: lower-cased words that are never a name on their own
 * (stopwords, structure heads, titles) — "Dear Team", "Sr. Presidente". */
export const detectSalutationNames = (text: string, excluded: ReadonlySet<string> = new Set()): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];
  const seen = new Set<string>();
  for (const re of [SALUTATION_RE, HONORIFIC_RE]) {
    for (const m of text.matchAll(new RegExp(re.source, 'gud'))) {
      const [start, end] = m.indices![1]!;
      const name = m[1];
      if (name.split(/\s+/).every((w) => excluded.has(w.toLowerCase()))) continue;
      if (excluded.has(name.split(/\s+/)[0].toLowerCase())) continue;
      if (seen.has(`${start}:${end}`)) continue;
      seen.add(`${start}:${end}`);
      spans.push(nameSpan(start, end, name, 0.6));
    }
  }
  return spans;
};

const WORD_RE = /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}{2,}(?:-\p{Lu}\p{Ll}+)?(?![\p{L}\p{N}])/gu;

/**
 * Standalone mentions of the words of names already found. One linear scan:
 * every capitalised word is looked up in the set of name words, and kept only
 * outside the existing NAME candidates. Lower confidence than the full name;
 * arbitration still lets any stronger span (shield, company, address) win.
 */
export const propagateNameMentions = (
  text: string,
  candidates: readonly DetectedSpan[],
  excluded: ReadonlySet<string> = new Set(),
): DetectedSpan[] => {
  const names = candidates.filter((c) => c.category === 'NAME' && !c.shield);
  if (!names.length) return [];
  const covered = new Uint8Array(text.length);
  const words = new Set<string>();
  for (const n of names) {
    covered.fill(1, n.start, n.end);
    for (const w of text.slice(n.start, n.end).match(WORD_RE) ?? []) {
      if (!excluded.has(w.toLowerCase())) words.add(w);
    }
  }
  const spans: DetectedSpan[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    if (!words.has(m[0]) || covered[m.index]) continue;
    spans.push(nameSpan(m.index, m.index + m[0].length, m[0], 0.5));
  }
  return spans;
};
