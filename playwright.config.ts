import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } } }
  ],
  webServer: {
    command: 'npx tsx e2e/server.ts',
    url: 'http://127.0.0.1:4173/items',
    reuseExistingServer: false,
    timeout: 120000
  }
});
