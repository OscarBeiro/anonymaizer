// P19/P20: facts about the operator and the deployment, in one place.
// Every double-brace placeholder must be replaced before the public launch — the
// legal pages (src/legal/) interpolate these, and docs/plans/done/m5-polish-beta.md
// (P20) lists them. SITE_ORIGIN comes from .env (VITE_SITE_ORIGIN) so that
// index.html, robots.txt and sitemap.xml share it.
export const SITE_ORIGIN: string = import.meta.env.VITE_SITE_ORIGIN;
export const REPO_URL = 'https://github.com/OscarBeiro/anonymaizer';
// S5: the copyright line shown in every footer and in Settings → About.
export const COPYRIGHT = { label: '© TICGAL 2026', url: 'https://tic.gal' } as const;
// The Labs programme AnonymAIzer belongs to (landing, About page).
export const LABS_URL = 'https://tic.gal/labs/';
export const PORTABLE_DOWNLOAD_URL = `${REPO_URL}/releases/latest`;

export const OPERATOR = {
  legalName: '{{LEGAL_NAME}}',
  nif: '{{NIF}}',
  address: '{{ADDRESS}}',
  contactEmail: '{{CONTACT_EMAIL}}',
  registry: '{{REGISTRY_DATA}}',
  dpo: '{{DPO_CONTACT_OR_NONE}}',
  jurisdiction: '{{JURISDICTION}}',
} as const;
