import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Inlines the JS/CSS bundle into index.html so the production build is one
  // self-contained, portable HTML file (§6 "Ship M1" / mobile insurance —
  // works from file://, no server required). manifest.webmanifest and sw.js
  // stay as separate static files (see public/) for PWA install/offline when
  // served over http; that's orthogonal to bundle inlining.
  plugins: [react(), viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Bind to all interfaces so the dev server is reachable from outside the
    // Podman container (see ~/containers/anonymaizer/).
    host: true,
    port: 5173,
    watch: {
      // Bind-mounted source: inotify events don't cross the mount reliably.
      usePolling: true,
    },
  },
})
