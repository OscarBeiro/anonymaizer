import { describe, expect, it } from 'vitest';
import { canEnter, nextPosition, prevPosition, type WizardGate, type WizardPosition } from './wizard';

const open: WizardGate = { hasText: true, hasMappings: true, hasAiResponse: true };
const closed: WizardGate = { hasText: false, hasMappings: false, hasAiResponse: false };

describe('wizard step order', () => {
  it('walks forward through every step and sub-step', () => {
    const seen: WizardPosition[] = [];
    let pos: WizardPosition | null = { step: 'ingest' };
    while (pos) {
      seen.push(pos);
      pos = nextPosition(pos, open);
    }
    expect(seen).toEqual([
      { step: 'ingest' },
      { step: 'review', subStep: 'rules' },
      { step: 'review', subStep: 'placeholders' },
      { step: 'review', subStep: 'sanitized' },
      { step: 'review', subStep: 'statistics' },
      { step: 'restore', subStep: 'response' },
      { step: 'restore', subStep: 'restored' },
    ]);
  });

  it('walks back to Ingest, entering a step at its last sub-step', () => {
    expect(prevPosition({ step: 'restore', subStep: 'restored' })).toEqual({ step: 'restore', subStep: 'response' });
    expect(prevPosition({ step: 'restore', subStep: 'response' })).toEqual({ step: 'review', subStep: 'statistics' });
    expect(prevPosition({ step: 'review', subStep: 'placeholders' })).toEqual({ step: 'review', subStep: 'rules' });
    expect(prevPosition({ step: 'review', subStep: 'rules' })).toEqual({ step: 'ingest' });
    expect(prevPosition({ step: 'ingest' })).toBeNull();
  });

  it('treats a step without a sub-step as its first one', () => {
    expect(nextPosition({ step: 'review' }, open)).toEqual({ step: 'review', subStep: 'placeholders' });
    expect(nextPosition({ step: 'restore' }, open)).toEqual({ step: 'restore', subStep: 'restored' });
  });

  it('blocks Next from Ingest without text', () => {
    expect(nextPosition({ step: 'ingest' }, closed)).toBeNull();
  });

  it('blocks Next into Restore without mappings, but not between Review sub-steps', () => {
    const gate = { hasText: true, hasMappings: false, hasAiResponse: false };
    expect(nextPosition({ step: 'review', subStep: 'rules' }, gate)).toEqual({ step: 'review', subStep: 'placeholders' });
    expect(nextPosition({ step: 'review', subStep: 'statistics' }, gate)).toBeNull();
  });

  it('blocks Restore -> Restored text until an AI response is pasted', () => {
    const gate = { hasText: true, hasMappings: true, hasAiResponse: false };
    expect(nextPosition({ step: 'restore', subStep: 'response' }, gate)).toBeNull();
    expect(nextPosition({ step: 'restore', subStep: 'restored' }, open)).toBeNull();
  });

  it('gates the sidebar with the same rule', () => {
    expect(canEnter('ingest', closed)).toBe(true);
    expect(canEnter('review', closed)).toBe(false);
    expect(canEnter('restore', { ...closed, hasText: true })).toBe(false);
    expect(canEnter('restore', open)).toBe(true);
  });
});
