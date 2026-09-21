export type KnownCategory =
  | 'NAME' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'COMPANY'
  | 'DNI' | 'NIE' | 'IBAN' | 'CREDIT_CARD'
  | 'MASKED_ID' | 'ID_CODE'
  | 'CUSTOM' | 'REGEX';

// CATEGORY dictionary rules mint their own (e.g. 'PROJECT_NAME'), so the type
// stays open while keeping autocompletion for the known ones.
export type Category = KnownCategory | (string & {});

export interface MappingItem {
  id: string;
  originalText: string; // the canonical variant — variants[0]
  placeholder: string; // e.g., "[[NAME_001]]", "[[ADDRESS_001]]"
  category: Category;
  confidence: number; // 1.0 dictionary/manual & checksum-validated regex;
                       // < 1.0 heuristic regex (NAME 0.6, ALL-CAPS COMPANY 0.4) and NER
  source: 'dictionary' | 'regex' | 'ner' | 'manual';
  enabled: boolean;
  // Every original-text spelling this one placeholder stands for. Single-
  // element for every category except NAME, where entity clustering (P7c,
  // src/core/entities.ts) can group several spellings of one person
  // ("Ester Cuni" / "Ester Cuni Peirote" / "CUNI PEIROTE ESTER") behind one
  // placeholder. originalText is always variants[0] (canonical: longest,
  // then first-occurring). Reversal restores the canonical form for every
  // variant — that's the accepted cost of one-person-one-placeholder.
  variants: string[];
}

// Closed union rather than a free string: `originalFormat` feeds export
// naming and per-format behaviour in M4, and a typo there is silent. Lives
// here, not in the parser registry, so MappingSession never has to reach
// into the registry for the shape of one of its own fields.
export type DocumentFormat = 'raw_text' | 'docx' | 'pdf' | 'odt' | 'csv' | 'xlsx' | 'eml' | 'pptx';

export interface MappingSession {
  sessionId: string;
  createdAt: string;
  inputType: 'PASTE' | 'FILE';
  fileName?: string;
  originalFormat: DocumentFormat;
  mappings: MappingItem[];
  rawMarkdown: string;
  anonymizedMarkdown: string;
}

export interface CustomDictionaryRule {
  id: string;
  termOrPattern: string;
  replacementType: 'FIXED' | 'CATEGORY';
  targetCategory?: string; // e.g., "PROJECT_NAME" -> [[PROJECT_NAME_001]]
  isRegex: boolean;
}

// Internal detection concern (§4a) — never exposed on MappingItem.
// `rung` is the detector's position on the §4a priority ladder (lower wins);
// it exists because COMPANY appears on two separate rungs (suffix/prefix vs.
// the ALL-CAPS acronym heuristic), so category alone can't rank a span.
export interface DetectedSpan {
  start: number;
  end: number;
  category: Category;
  text: string;
  confidence: number;
  source: MappingItem['source'];
  rung: number;
  // Heuristics that must land disabled by default (ALL-CAPS COMPANY guess)
  // set this false; every other detector omits it and defaults to true.
  enabled?: boolean;
  // A shield claims a span to keep every other detector off it, then is
  // itself dropped before minting (never becomes a MappingItem, never
  // appears in the anonymized text). It exists for text that a heuristic
  // would otherwise misread as PII — a statute citation, a job title, a
  // timestamp — where the fix is "nothing should touch this", not "tag it
  // as some other category".
  shield?: true;
}

// §4a priority ladder, highest priority first. Detectors tag their spans with
// the matching rung number.
export const RUNG = {
  DICTIONARY: 0,
  SHIELD: 1, // legal citations / professional titles / date-time — never minted
  VALIDATED_REGEX: 2, // EMAIL / IBAN / CREDIT_CARD / DNI / NIE / PHONE / MASKED_ID
  ID_CODE: 3, // label-anchored codes (P7b), e.g. "Colegiada T-04250"
  ADDRESS: 4,
  COMPANY: 5, // suffix and prefix forms
  NER: 5.5, // opt-in model (P7d) — outranks NAME and the ALL-CAPS COMPANY
            // guess it supersedes, but not the checksum/shape detectors above
  NAME: 6,
  COMPANY_ACRONYM: 7, // ALL-CAPS heuristic, off by default
} as const;
