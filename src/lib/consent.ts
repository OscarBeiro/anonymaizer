import { CONSENT_POLICY_VERSION } from '../legal/meta';

// P21: the consent decision. localStorage, not a cookie (no cookie is set
// before consent, and this one never is). Stored with its timestamp and the
// policy version it was given under; a version bump re-asks.
export const CONSENT_KEY = 'anonymaizer.consent';

export interface ConsentDecision {
  analytics: boolean;
  timestamp: string;
  version: number;
}

// Anything malformed, or given under an older policy, is no decision at all.
export const parseConsent = (raw: string | null, version = CONSENT_POLICY_VERSION): ConsentDecision | null => {
  try {
    const d = JSON.parse(raw ?? 'null') as Partial<ConsentDecision> | null;
    if (!d || typeof d.analytics !== 'boolean' || typeof d.timestamp !== 'string' || d.version !== version) return null;
    return { analytics: d.analytics, timestamp: d.timestamp, version: d.version };
  } catch {
    return null;
  }
};

export const loadConsent = (): ConsentDecision | null => {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
};

export const saveConsent = (analytics: boolean, now = new Date()): ConsentDecision => {
  const decision = { analytics, timestamp: now.toISOString(), version: CONSENT_POLICY_VERSION };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(decision));
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  return decision;
};
