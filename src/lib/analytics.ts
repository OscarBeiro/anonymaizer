// Only consent-gated visit schemas are allowed. Existing GA/Metricool script
// integrations were removed: no compatible audited browser-only transport has
// been selected. Events are omitted until one is reviewed; never load tags.
export interface LocationLike { protocol: string; hostname: string }
export const isPublicDeploymentAt = (loc: LocationLike, enabled: boolean, host: string): boolean =>
  enabled && host !== '' && loc.protocol === 'https:' && loc.hostname === host;
const productionHost = (): string => { try { return new URL(import.meta.env.VITE_SITE_ORIGIN).hostname; } catch { return ''; } };
export const isPublicDeployment = (): boolean => typeof __ANALYTICS_ENABLED__ !== 'undefined' && __ANALYTICS_ENABLED__ && typeof location !== 'undefined' && isPublicDeploymentAt(location, true, productionHost());
// Hard rule 2: the AI model (and its runtime, from a CDN) may be downloaded
// only on the public HTTPS deployment. A portable file, a file:// page,
// localhost or a self-hosted copy makes no network call, so the option is not
// offered there. `devOverride` is the one exception: VITE_ALLOW_MODEL_DOWNLOAD=1,
// set in .env.development for the dev server only, so the model can be worked on.
export const modelDownloadAllowedAt = (loc: LocationLike, portable: boolean, host: string, devOverride = false): boolean =>
  !portable && (devOverride || isPublicDeploymentAt(loc, true, host));
export const modelDownloadAllowed = (): boolean => typeof location !== 'undefined' &&
  modelDownloadAllowedAt(location, __PORTABLE__, productionHost(), import.meta.env.VITE_ALLOW_MODEL_DOWNLOAD === '1');
const ROUTES = ['/', '/app', '/about', '/privacy', '/cookies', '/terms'] as const;
export const visitEvent = (path: string): { version: 1; event: 'visit'; route: string } | null =>
  ROUTES.some(route => route === path) ? { version: 1, event: 'visit', route: path } : null;
let consent = false;
export const startAnalytics = (): void => { consent = isPublicDeployment(); };
export const trackPageView = (path: string): void => {
  if (!consent || !isPublicDeployment()) return;
  // Deliberately omit: existing providers require unrestricted scripts or a
  // server credential. No arbitrary endpoint or content-derived payload.
  void visitEvent(path);
};
export const stopAnalytics = (): void => { consent = false; };
