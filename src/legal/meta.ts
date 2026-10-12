// P20: drives the "last updated" line on every legal page. Bump it with any
// change to the text. P21 stores the consent decision with CONSENT_POLICY_VERSION
// and re-asks when it changes — bump that too when the cookie/analytics terms
// change materially (not for typo fixes).
export const LEGAL_LAST_UPDATED = '2026-09-27';
export const CONSENT_POLICY_VERSION = 1;

export type LegalLang = 'es' | 'en';
export type LegalPageId = 'privacy' | 'cookies' | 'terms';

// Every placeholder the drafter must fill before launch. Mirrored in
// docs/plans/done/m5-polish-beta.md (P20). The values live in src/site.ts.
export const LEGAL_PLACEHOLDERS = [
  '{{LEGAL_NAME}}',
  '{{NIF}}',
  '{{ADDRESS}}',
  '{{CONTACT_EMAIL}}',
  '{{REGISTRY_DATA}}',
  '{{DPO_CONTACT_OR_NONE}}',
  '{{JURISDICTION}}',
  '{{GA4_MEASUREMENT_ID}}',
  '{{METRICOOL_COOKIES}}',
  '{{METRICOOL_COOKIE_DURATION}}',
  '{{METRICOOL_RETENTION}}',
  '{{CLOUDFLARE_LOG_RETENTION}}',
  '{{LICENSE}}',
  '{{TRADEMARK_STATUS}}',
] as const;
