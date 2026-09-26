import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Opt-in offline support once installed as a PWA. Registration itself is a
// one-time same-origin request for /sw.js — not a runtime data call — and
// everything the app does afterward stays local (Hard rule #2).
//
// Production only. sw.js is cache-first for every same-origin GET, so in dev
// it froze each source module at its first fetch: HMR'd files got new URLs,
// but a fixed src/core/ner.ts kept running stale inside the NER worker. In dev
// any worker left over from an earlier session is removed, with its caches.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {})
  }
}
