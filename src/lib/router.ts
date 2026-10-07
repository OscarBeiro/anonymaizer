import { useSyncExternalStore } from 'react';

// P19: four routes do not need react-router. The History API plus one
// subscription covers it. Hosted build only; the portable build renders the
// wizard directly (file:// has no server to rewrite paths — see main.tsx).

export type Route = 'landing' | 'app' | 'privacy' | 'cookies' | 'terms';

export const ROUTE_PATHS: Record<Route, string> = {
  landing: '/',
  app: '/app',
  privacy: '/privacy',
  cookies: '/cookies',
  terms: '/terms',
};

// Unknown paths fall back to the landing rather than a 404 page. A trailing
// slash and /index.html are tolerated, since a CDN may hand out either.
export const matchRoute = (pathname: string): Route => {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/(.)\/+$/, '$1');
  const hit = (Object.entries(ROUTE_PATHS) as [Route, string][]).find(([, p]) => p === path);
  return hit ? hit[0] : 'landing';
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener('popstate', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('popstate', fn);
  };
};

export const navigate = (path: string): void => {
  const [pathname, hash] = path.split('#');
  if (pathname !== window.location.pathname) window.history.pushState(null, '', path);
  listeners.forEach((fn) => fn());
  if (hash) document.getElementById(hash)?.scrollIntoView();
  else window.scrollTo(0, 0);
};

export const useRoute = (): Route => useSyncExternalStore(subscribe, () => matchRoute(window.location.pathname));

// An <a> that navigates in-app on a plain left click and behaves like a
// normal link otherwise (new tab, copy link).
export const linkProps = (path: string) => ({
  href: path,
  onClick: (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void }) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  },
});
