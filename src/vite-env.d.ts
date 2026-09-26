/// <reference types="vite/client" />

declare const __APP_VERSION__: string
// True in `npm run build:portable` (file://, no router, no landing).
declare const __PORTABLE__: boolean

interface ImportMetaEnv {
  readonly VITE_SITE_ORIGIN: string
}
