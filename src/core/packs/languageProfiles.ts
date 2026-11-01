/** Lexical evidence for suggestions; these are not anonymization packs.
 * Keep profileWords here so future packs can reuse the same language data. */
export const LANGUAGE_PROFILES = {
  en: {
    profileWords: ['the', 'and', 'with', 'this', 'that', 'from', 'for', 'is', 'are', 'not', 'was', 'have', 'has', 'will', 'please', 'your', 'you', 'our', 'their', 'which', 'report', 'document'],
    characterHints: [],
  },
  es: {
    profileWords: ['el', 'la', 'los', 'las', 'del', 'que', 'para', 'por', 'con', 'una', 'este', 'esta', 'como', 'pero', 'cuando', 'también', 'porque', 'sus', 'nuestro', 'tiene', 'ha', 'su', 'se', 'es'],
    characterHints: [/ñ/u, /(?:ción|ciones)$/u],
  },
  gl: {
    profileWords: ['o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'que', 'para', 'por', 'con', 'unha', 'non', 'xa', 'hoxe', 'tamén', 'cando', 'porque', 'noso', 'voso', 'súa', 'seu', 'ten', 'foi', 'coa', 'coas', 'polo', 'pola', 'son', 'é'],
    characterHints: [/ñ/u, /cións?$/u],
  },
  pt: {
    profileWords: ['o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'que', 'para', 'por', 'com', 'uma', 'um', 'não', 'já', 'hoje', 'também', 'quando', 'porque', 'nosso', 'nossa', 'seu', 'sua', 'seus', 'suas', 'tem', 'são', 'foi', 'é', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'pelo', 'pela', 'você', 'vocês'],
    characterHints: [/(?:ção|ções)$/u, /ã|õ/u],
  },
  fr: {
    profileWords: ['le', 'la', 'les', 'des', 'du', 'de', 'un', 'une', 'et', 'avec', 'ce', 'cette', 'ces', 'pour', 'par', 'est', 'sont', 'pas', 'nous', 'vous', 'notre', 'vos', 'votre', 'leur', 'leurs', 'qui', 'que', 'dans', 'dont', 'quand', 'avez', 'veuillez'],
    characterHints: [/ç/u, /œ/u],
  },
  it: {
    profileWords: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'del', 'della', 'delle', 'che', 'e', 'con', 'per', 'è', 'sono', 'non', 'questo', 'questa', 'questi', 'queste', 'nostro', 'nostra', 'vostro', 'vostri', 'quando', 'anche', 'si', 'avete', 'dei', 'dati'],
    characterHints: [/è|ì|ò|ù/u],
  },
  de: {
    profileWords: ['der', 'die', 'das', 'den', 'dem', 'des', 'und', 'mit', 'für', 'ist', 'sind', 'nicht', 'ein', 'eine', 'einer', 'einem', 'einen', 'sie', 'wir', 'unser', 'unsere', 'ihre', 'ihren', 'diese', 'dieser', 'bitte', 'wenn', 'auch', 'zu', 'von'],
    characterHints: [/ß/u, /ä|ö|ü/u],
  },
} as const;
export type DetectedLanguage = keyof typeof LANGUAGE_PROFILES;
