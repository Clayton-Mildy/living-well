import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', include: ['packages/shared/src/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'server', include: ['apps/server/src/**/*.test.ts'], environment: 'node', fileParallelism: false, env: { CP_DEMO_DATE: '2026-10-21', CP_SEED_SMALL: '1' } } },
      { test: { name: 'web', include: ['apps/web/src/**/*.test.{ts,tsx}'], environment: 'jsdom' } },
    ],
  },
});
