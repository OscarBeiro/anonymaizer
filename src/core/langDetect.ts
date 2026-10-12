export type DocumentLanguage = 'en' | 'es' | 'gl';
export type DocumentLanguageChoice = 'auto' | DocumentLanguage;
export interface LanguageScore { lang: DocumentLanguage; score: number }
export interface LanguageDetection {
  status: 'detected' | 'mixed' | 'undetermined';
  languages: DocumentLanguage[];
  ranked: LanguageScore[];
}
const WORDS: Record<DocumentLanguage, readonly string[]> = {
  en: ['the', 'and', 'with', 'this', 'that', 'from', 'for', 'is', 'are', 'not', 'was', 'have', 'has', 'will', 'please', 'your', 'you', 'our', 'their', 'which', 'report', 'document'],
  es: ['el', 'la', 'los', 'las', 'del', 'que', 'para', 'por', 'con', 'una', 'este', 'esta', 'como', 'pero', 'cuando', 'también', 'porque', 'sus', 'nuestro', 'tiene', 'ha', 'su', 'se', 'es'],
  gl: ['o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'que', 'para', 'por', 'con', 'unha', 'non', 'xa', 'hoxe', 'tamén', 'cando', 'porque', 'noso', 'voso', 'súa', 'seu', 'ten', 'foi', 'coa', 'coas', 'polo', 'pola', 'son', 'é'],
};
const sets = Object.fromEntries(Object.entries(WORDS).map(([lang, words]) => [lang, new Set(words)])) as Record<DocumentLanguage, Set<string>>;
const rank = (words: string[]): LanguageScore[] => (['en', 'es', 'gl'] as const).map(lang => {
  let score = 0;
  for (const word of words) if (sets[lang].has(word)) {
    const shared = Object.values(sets).filter(set => set.has(word)).length;
    score += shared === 1 ? (word.length <= 2 ? 1 : 3) : 1;
  }
  return { lang, score };
}).sort((a, b) => b.score - a.score);
/** Local bounded heuristic. Scores are evidence weights, never probabilities.
 * Short and unsupported texts remain undetermined; UI locale is not an input. */
export const langDetect = (text: string): LanguageDetection => {
  const sample = text.slice(0, 50000);
  const words = sample.toLowerCase().match(/\p{L}+/gu) ?? [];
  const ranked = rank(words);
  if (words.length < 20 || ranked[0].score < 6 || ranked[0].score === ranked[1].score) return { status: 'undetermined', languages: [], ranked };
  const languages = new Set<DocumentLanguage>();
  languages.add(ranked[0].lang);
  for (const paragraph of sample.split(/\n\s*\n/).slice(0, 200)) {
    const tokens = paragraph.toLowerCase().match(/\p{L}+/gu) ?? [];
    const scores = rank(tokens);
    if (tokens.length >= 20 && scores[0].score >= 6 && scores[0].score > scores[1].score * 1.25) languages.add(scores[0].lang);
  }
  return { status: languages.size > 1 ? 'mixed' : 'detected', languages: [...languages], ranked };
};
export const documentLanguages = (text: string, choice: DocumentLanguageChoice): DocumentLanguage[] => {
  if (choice !== 'auto') return [choice];
  const detection = langDetect(text);
  return detection.languages.length ? detection.languages : ['en', 'es', 'gl'];
};
