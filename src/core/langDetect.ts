import { LANGUAGE_PROFILES } from './packs/languageProfiles';
import type { DetectedLanguage } from './packs/languageProfiles';
export type { DetectedLanguage } from './packs/languageProfiles';

/** Languages with implemented anonymization rules, separate from suggestions. */
export type DocumentLanguage = 'en' | 'es' | 'gl';
export type DocumentLanguageChoice = 'auto' | DocumentLanguage;
export interface LanguageScore { lang: DetectedLanguage; score: number }
export interface LanguageSummary {
  status: 'detected' | 'mixed' | 'undetermined';
  languages: DetectedLanguage[];
  ranked: LanguageScore[];
}
export interface ParagraphLanguageDetection extends LanguageSummary {
  /** UTF-16 offsets into the original text, excluding paragraph separators. */
  start: number;
  end: number;
}
export interface LanguageDetection extends LanguageSummary {
  paragraphs: ParagraphLanguageDetection[];
}

const languages = Object.keys(LANGUAGE_PROFILES) as DetectedLanguage[];
const profiles = languages.map(lang => ({
  lang,
  words: new Set<string>(LANGUAGE_PROFILES[lang].profileWords),
  hints: LANGUAGE_PROFILES[lang].characterHints,
}));
const wordWeights = new Map<string, number>();
for (const profile of profiles) for (const word of profile.words) {
  const shared = profiles.filter(candidate => candidate.words.has(word)).length;
  // Shared function words are weak evidence; distinctive words carry more weight.
  wordWeights.set(word, shared === 1 ? (word.length <= 2 ? 1 : 3) : 1 / shared);
}
const MIN_WORDS = 20;
const MIN_SCORE = 6;
const WINNER_MARGIN = 1.25;
const rank = (scores: readonly number[]): LanguageScore[] => languages
  .map((lang, index) => ({ lang, score: scores[index] }))
  .sort((a, b) => b.score - a.score);
const winner = (ranked: LanguageScore[], wordCount: number, profileMatches: number): DetectedLanguage[] =>
  wordCount >= MIN_WORDS && profileMatches >= 3 && ranked[0].score >= MIN_SCORE
    && ranked[0].score > ranked[1].score * WINNER_MARGIN ? [ranked[0].lang] : [];
const summary = (ranked: LanguageScore[], suggested: DetectedLanguage[]): LanguageSummary => ({
  status: suggested.length > 1 ? 'mixed' : suggested.length ? 'detected' : 'undetermined',
  languages: suggested,
  ranked,
});

/** Offline heuristic over the full document. Scores are evidence weights, not
 * probabilities. Blank lines delimit paragraphs; wrapped lines stay together.
 * Short or ambiguous text stays undetermined. Character hints supplement words. */
export const langDetect = (text: string): LanguageDetection => {
  const paragraphs: ParagraphLanguageDetection[] = [];
  const totalScores = languages.map(() => 0);
  const totalMatches = languages.map(() => 0);
  let totalWords = 0;
  const paragraphLanguages = new Set<DetectedLanguage>();

  const scoreParagraph = (start: number, end: number) => {
    const paragraph = text.slice(start, end);
    if (!paragraph.trim()) return;
    const scores = languages.map(() => 0);
    const matches = languages.map(() => 0);
    let wordCount = 0;
    for (const match of paragraph.normalize('NFC').toLowerCase().matchAll(/\p{L}+/gu)) {
      const word = match[0];
      wordCount++;
      for (const [index, profile] of profiles.entries()) {
        if (profile.words.has(word)) {
          scores[index] += wordWeights.get(word)!;
          matches[index]++;
        }
        // Limit each token to one hint, so overlapping suffix/character cues
        // do not count the same evidence twice (e.g. Portuguese -ção and ã).
        if (word.length > 1 && profile.hints.some(hint => hint.test(word))) scores[index] += 2;
      }
    }
    const ranked = rank(scores);
    const selected = winner(ranked, wordCount, matches[languages.indexOf(ranked[0].lang)]);
    for (const lang of selected) paragraphLanguages.add(lang);
    paragraphs.push({ start, end, ...summary(ranked, selected) });
    totalWords += wordCount;
    for (const index of languages.keys()) {
      totalScores[index] += scores[index];
      totalMatches[index] += matches[index];
    }
  };

  let start = 0;
  for (const separator of text.matchAll(/(?:\r?\n)[^\S\r\n]*(?:\r?\n)(?:[^\S\r\n]*\r?\n)*/gu)) {
    scoreParagraph(start, separator.index);
    start = separator.index + separator[0].length;
  }
  scoreParagraph(start, text.length);
  const ranked = rank(totalScores);
  const selected = new Set(winner(ranked, totalWords, totalMatches[languages.indexOf(ranked[0].lang)]));
  for (const lang of paragraphLanguages) selected.add(lang);
  // Keep suggested languages in the same order as the document ranking.
  return { ...summary(ranked, ranked.filter(item => selected.has(item.lang)).map(item => item.lang)), paragraphs };
};

/** Until P25 adds profile gating, only implemented rules can be activated. */
export const documentLanguages = (text: string, choice: DocumentLanguageChoice): DocumentLanguage[] => {
  if (choice !== 'auto') return [choice];
  const detected = langDetect(text).languages.filter((lang): lang is DocumentLanguage =>
    lang === 'en' || lang === 'es' || lang === 'gl');
  return detected.length ? detected : ['en', 'es', 'gl'];
};
