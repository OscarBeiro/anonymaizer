import { describe, expect, it } from 'vitest';
import { parseConsent } from './consent';

describe('parseConsent', () => {
  const ok = JSON.stringify({ analytics: true, timestamp: '2026-09-27T00:00:00.000Z', version: 1 });

  it('reads a decision given under the current policy', () => {
    expect(parseConsent(ok, 1)).toEqual({ analytics: true, timestamp: '2026-09-27T00:00:00.000Z', version: 1 });
  });

  it('re-asks when the policy version changed', () => {
    expect(parseConsent(ok, 2)).toBeNull();
  });

  it('treats missing or malformed values as no decision', () => {
    expect(parseConsent(null, 1)).toBeNull();
    expect(parseConsent('yes', 1)).toBeNull();
    expect(parseConsent(JSON.stringify({ analytics: 'true', timestamp: 'x', version: 1 }), 1)).toBeNull();
    expect(parseConsent(JSON.stringify({ analytics: true, version: 1 }), 1)).toBeNull();
  });
});
