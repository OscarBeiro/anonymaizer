/// <reference types="vite/client" />

declare const __APP_VERSION__: string
// True in `npm run build:portable` (file://, no router, no landing).
declare const __PORTABLE__: boolean

interface ImportMetaEnv {
  readonly VITE_SITE_ORIGIN: string
}

interface ImportMetaEnv {
  // P21: set only by the production deploy workflow.
  readonly VITE_GA4_ID?: string
  readonly VITE_METRICOOL_HASH?: string
}

// P21: build-time analytics gate. False in the portable build and in any
// build the deploy workflow did not flag. See src/lib/analytics.ts.
declare const __ANALYTICS_ENABLED__: boolean
