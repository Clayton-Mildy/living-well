// E2E: every role × screen at phone / tablet / laptop. Point E2E_BASE_URL at a running web server (pnpm e2e:env).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'artifacts/playwright-report' }]],
  outputDir: 'artifacts/test-results',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'phone360', use: { browserName: 'chromium', viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'laptop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});
