import { OFFERED_NER_MODEL_IDS } from '../core/nerModels';

// The user's explicit model choice. A model being cached never changes it: the
// only writer is the chooser in the interface.
const KEY = 'anonymaizer.nerModel';
export const DEFAULT_NER_MODEL_ID = 'bert-base-ner';

export const readNerChoice = (storage: Pick<Storage, 'getItem'> | null = safeStorage()): string => {
  try {
    const value = storage?.getItem(KEY);
    return value && OFFERED_NER_MODEL_IDS.includes(value) ? value : DEFAULT_NER_MODEL_ID;
  } catch {
    return DEFAULT_NER_MODEL_ID;
  }
};

export const saveNerChoice = (id: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean => {
  if (!OFFERED_NER_MODEL_IDS.includes(id)) return false;
  try {
    storage?.setItem(KEY, id);
    return storage !== null;
  } catch {
    return false;
  }
};

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
