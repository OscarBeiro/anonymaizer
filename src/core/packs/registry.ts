import { GALICIAN_PACK } from './gl';
import { LANGUAGE_PROFILES, type DetectedLanguage } from './languageProfiles';
import { languageLexicon } from './lexicons';
import type { LanguagePack } from './types';

const createPack = (id: 'en' | 'es' | 'gl', greetings: readonly string[]): LanguagePack => {
  const lexicon = languageLexicon([id]);
  return {
    id, greetings, lexicon,
    stopwords: lexicon.stopwords,
    nameParticles: lexicon.nameParticles,
    companyPrefixes: lexicon.companyPrefixes,
    shieldLexicon: [...lexicon.legalHeads, ...lexicon.titleLexemes, ...lexicon.institutionHeads],
    profileWords: LANGUAGE_PROFILES[id].profileWords,
  };
};

/** Suggestions in P24 do not imply that a complete anonymization pack exists. */
export const LANGUAGE_PACKS: Readonly<Partial<Record<DetectedLanguage, LanguagePack>>> = {
  en: createPack('en', ['Dear', 'Hello', 'Hi', 'Regards', 'Sincerely', 'Best', 'Thanks', 'Yours']),
  es: createPack('es', ['Hola', 'Estimado', 'Estimada', 'Buenos', 'Buenas', 'Saludos', 'Gracias', 'Atentamente']),
  gl: createPack('gl', GALICIAN_PACK.greetings),
};
