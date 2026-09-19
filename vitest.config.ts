import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: vitest ships its own nested
// copy of Vite, and merging its `test` key into the rolldown-based Vite 8
// config makes `tsc -b` fail on incompatible Plugin types.
//
// src/core/ is pure TypeScript with no DOM, so the node environment is enough.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
