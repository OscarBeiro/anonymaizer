export type KnownCategory =
  | 'NAME' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'COMPANY'
  | 'DNI' | 'NIE' | 'IBAN' | 'CREDIT_CARD'
  | 'CUSTOM' | 'REGEX';

// CATEGORY dictionary rules mint their own (e.g. 'PROJECT_NAME'), so the type
// stays open while keeping autocompletion for the known ones.
export type Category = KnownCategory | (string & {});

export interface MappingItem {
  id: string;
  originalText: string;
  placeholder: string; // e.g., "[NAME_1]", "[ADDRESS_1]"
  category: Category;
  confidence: number; // 1.0 dictionary/manual & checksum-validated regex;
                       // < 1.0 heuristic regex (NAME 0.6, ALL-CAPS COMPANY 0.4) and NER
  source: 'dictionary' | 'regex' | 'ner' | 'manual';
  enabled: boolean;
}

export interface MappingSession {
  sessionId: string;
  createdAt: string;
  inputType: 'PASTE' | 'FILE';
  fileName?: string;
  originalFormat: string; // e.g., 'raw_text', 'docx', 'pdf', 'eml'
  mappings: MappingItem[];
  rawMarkdown: string;
  anonymizedMarkdown: string;
}

export interface CustomDictionaryRule {
  id: string;
  termOrPattern: string;
  replacementType: 'FIXED' | 'CATEGORY';
  targetCategory?: string; // e.g., "PROJECT_NAME" -> [PROJECT_NAME_1]
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
}

// §4a priority ladder, highest priority first. Detectors tag their spans with
// the matching rung number.
export const RUNG = {
  DICTIONARY: 0,
  VALIDATED_REGEX: 1, // EMAIL / IBAN / CREDIT_CARD / DNI / NIE / PHONE
  ADDRESS: 2,
  COMPANY: 3, // suffix and prefix forms
  NAME: 4,
  COMPANY_ACRONYM: 5, // ALL-CAPS heuristic, off by default
} as const;
