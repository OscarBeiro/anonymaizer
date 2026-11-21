import { describe, expect, it } from 'vitest';
import { DEFAULT_NER_MODEL_ID, readNerChoice, saveNerChoice } from './nerChoice';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('nerChoice', () => {
  it('defaults to the standard model', () => {
    expect(readNerChoice(memory())).toBe(DEFAULT_NER_MODEL_ID);
  });

  it('remembers an explicit choice', () => {
    const store = memory();
    expect(saveNerChoice('nym-pii-small', store)).toBe(true);
    expect(readNerChoice(store)).toBe('nym-pii-small');
  });

  it('ignores a model that is not offered, even if it is stored', () => {
    const store = memory();
    expect(saveNerChoice('nym-pii-large', store)).toBe(false);
    store.setItem('anonymaizer.nerModel', 'nym-pii-large');
    expect(readNerChoice(store)).toBe(DEFAULT_NER_MODEL_ID);
  });

  it('survives unavailable storage', () => {
    expect(readNerChoice({ getItem: () => { throw new Error('blocked'); } })).toBe(DEFAULT_NER_MODEL_ID);
    expect(saveNerChoice('nym-pii-small', { setItem: () => { throw new Error('blocked'); } })).toBe(false);
  });
});
