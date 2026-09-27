import { lazy, Suspense, useEffect } from 'react';
import { ROUTE_PATHS, useRoute, type Route } from './lib/router';
import { SITE_ORIGIN } from './site';
import { isPublicDeployment, trackPageView } from './lib/analytics';
import { ConsentBanner } from './landing/ConsentBanner';
import { UpdatePrompt } from './components/UpdatePrompt';

// P19: the wizard is lazy, so a landing visitor does not download it — the
// inverse of the parser code-splitting. (The portable build inlines dynamic
// imports, so the same code works there.)
const App = lazy(() => import('./App'));
// Guarded by the build constant so the portable build drops the landing and
// legal pages entirely — a static import would keep their CSS and side effects.
const Landing = __PORTABLE__ ? null! : lazy(() => import('./landing/Landing'));
const About = __PORTABLE__ ? null! : lazy(() => import('./landing/About'));
const LegalPage = __PORTABLE__ ? null! : lazy(() => import('./landing/LegalPage'));

const TITLES: Record<Route, string> = {
  landing: 'AnonymAIzer — anonymize text before sending it to an AI',
  app: 'AnonymAIzer',
  about: 'About — AnonymAIzer, a TICGAL Labs project',
  privacy: 'Privacy policy — AnonymAIzer',
  cookies: 'Cookie policy — AnonymAIzer',
  terms: 'Terms of use — AnonymAIzer',
};

const Loading = () => <div className="route-loading" aria-busy="true" />;

function HostedRoot() {
  const route = useRoute();
  useEffect(() => {
    document.title = TITLES[route];
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_ORIGIN}${ROUTE_PATHS[route]}`);
    // A no-op unless analytics was consented to and loaded. Path only.
    trackPageView(ROUTE_PATHS[route]);
  }, [route]);

  // P21: the banner exists only on the public deployment; anywhere else there
  // is nothing to consent to.
  const banner = isPublicDeployment() ? <ConsentBanner /> : null;

  return (
    <>
      <Suspense fallback={<Loading />}>
        {route === 'app' ? <App /> : route === 'landing' ? <Landing /> : route === 'about' ? <About /> : <LegalPage page={route} />}
      </Suspense>
      {banner}
      <UpdatePrompt />
    </>
  );
}

function PortableRoot() {
  return (
    <Suspense fallback={<Loading />}>
      <App />
    </Suspense>
  );
}

// A build-time constant, so the unused branch — the whole landing in the
// portable build — is dropped by the bundler.
export const Root = __PORTABLE__ ? PortableRoot : HostedRoot;
