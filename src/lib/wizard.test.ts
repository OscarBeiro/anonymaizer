import { describe, expect, it } from 'vitest';
import { canEnter, nextPosition, prevPosition, type WizardGate, type WizardPosition } from './wizard';

const open: WizardGate = { hasText: true, hasMappings: true };

describe('wizard step order', () => {
  it('walks forward through every step and Review sub-step', () => {
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
      { step: 'restore' },
    ]);
  });

  it('walks back to Ingest, entering Review at its last sub-step', () => {
    expect(prevPosition({ step: 'restore' })).toEqual({ step: 'review', subStep: 'statistics' });
    expect(prevPosition({ step: 'review', subStep: 'placeholders' })).toEqual({ step: 'review', subStep: 'rules' });
    expect(prevPosition({ step: 'review', subStep: 'rules' })).toEqual({ step: 'ingest' });
    expect(prevPosition({ step: 'ingest' })).toBeNull();
  });

  it('blocks Next from Ingest without text', () => {
    expect(nextPosition({ step: 'ingest' }, { hasText: false, hasMappings: false })).toBeNull();
  });

  it('blocks Next into Restore without mappings, but not between Review sub-steps', () => {
    const gate = { hasText: true, hasMappings: false };
    expect(nextPosition({ step: 'review', subStep: 'rules' }, gate)).toEqual({ step: 'review', subStep: 'placeholders' });
    expect(nextPosition({ step: 'review', subStep: 'statistics' }, gate)).toBeNull();
  });

  it('gates the sidebar with the same rule', () => {
    expect(canEnter('ingest', { hasText: false, hasMappings: false })).toBe(true);
    expect(canEnter('review', { hasText: false, hasMappings: false })).toBe(false);
    expect(canEnter('restore', { hasText: true, hasMappings: false })).toBe(false);
    expect(canEnter('restore', open)).toBe(true);
  });
});
