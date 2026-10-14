import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['whatsapp-layout.spec.ts', 'whatsapp-isolation.spec.ts', 'whatsapp-kanban.spec.ts'],
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
