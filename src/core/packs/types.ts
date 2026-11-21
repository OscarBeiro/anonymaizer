import type { DetectedSpan } from '../types';
import type { DetectedLanguage } from './languageProfiles';
import type { DetectorLexicon } from './lexicons';

export interface PackDetector {
  readonly categories: readonly string[];
  readonly detect: (text: string) => DetectedSpan[];
  readonly shield?: boolean;
  readonly switch?: string;
}

export interface LanguagePack {
  readonly id: DetectedLanguage;
  readonly stopwords: readonly string[];
  readonly greetings: readonly string[];
  readonly nameParticles: readonly string[];
  readonly companyPrefixes: readonly string[];
  readonly shieldLexicon: readonly string[];
  readonly profileWords: readonly string[];
  readonly lexicon: DetectorLexicon;
}

export interface JurisdictionPack {
  readonly id: string;
  readonly defaultLanguages: readonly DetectedLanguage[];
  readonly categoryPreset: readonly string[];
  readonly detectors: readonly PackDetector[];
}
