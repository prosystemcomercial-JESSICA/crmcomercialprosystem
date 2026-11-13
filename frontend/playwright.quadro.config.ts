import { defineConfig, devices } from '@playwright/test';

// Quadro do Portal Técnico com API simulada: nenhum dado real de cliente.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['implantacao-quadro.spec.ts', 'agenda-tecnico.spec.ts', 'diretoria.spec.ts', 'carrossel-quadros.spec.ts', 'painel-leads.spec.ts', 'catalogo-oferta.spec.ts'],
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
