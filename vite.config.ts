import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
