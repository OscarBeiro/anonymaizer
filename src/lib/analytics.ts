// Only consent-gated visit schemas are allowed. Existing GA/Metricool script
// integrations were removed: no compatible audited browser-only transport has
// been selected. Events are omitted until one is reviewed; never load tags.
export interface LocationLike { protocol: string; hostname: string }
export const isPublicDeploymentAt = (loc: LocationLike, enabled: boolean, host: string): boolean =>
  enabled && host !== '' && loc.protocol === 'https:' && loc.hostname === host;
const productionHost = (): string => { try { return new URL(import.meta.env.VITE_SITE_ORIGIN).hostname; } catch { return ''; } };
export const isPublicDeployment = (): boolean => typeof __ANALYTICS_ENABLED__ !== 'undefined' && __ANALYTICS_ENABLED__ && typeof location !== 'undefined' && isPublicDeploymentAt(location, true, productionHost());
export const modelDownloadAllowed = (): boolean => !__PORTABLE__ && typeof location !== 'undefined' && isPublicDeploymentAt(location, true, productionHost());
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
