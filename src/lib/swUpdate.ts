// P21b: service-worker registration and the "new version available" signal.
// A new worker installs in the background and waits; the UI offers a reload,
// and only then is it told to take over. Reloading loses no work — the
// session lives in localStorage.

type Listener = (available: boolean) => void;
const listeners = new Set<Listener>();
let waiting: ServiceWorker | null = null;

const announce = (worker: ServiceWorker) => {
  waiting = worker;
  listeners.forEach((fn) => fn(true));
};

export const onUpdateAvailable = (fn: Listener): (() => void) => {
  listeners.add(fn);
  if (waiting) fn(true);
  return () => listeners.delete(fn);
};

export const applyUpdate = (): void => {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage('SKIP_WAITING');
};

export const registerServiceWorker = async (): Promise<void> => {
  const registration = await navigator.serviceWorker.register('/sw.js');
  // Only an update matters; the very first install has no controller to replace.
  const hasController = () => navigator.serviceWorker.controller !== null;

  if (registration.waiting && hasController()) announce(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && hasController()) announce(installing);
    });
  });

  // Long-lived tabs: look for a new release whenever the tab comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update().catch(() => {});
  });
};
