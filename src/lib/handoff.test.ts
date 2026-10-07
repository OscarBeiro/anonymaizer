import { describe, expect, it } from 'vitest';
import { setHandoff, takeHandoff } from './handoff';

describe('handoff', () => {
  it('is taken exactly once', () => {
    expect(takeHandoff()).toBeNull();
    setHandoff({ kind: 'text', text: 'hola' });
    expect(takeHandoff()).toEqual({ kind: 'text', text: 'hola' });
    expect(takeHandoff()).toBeNull();
  });
});
