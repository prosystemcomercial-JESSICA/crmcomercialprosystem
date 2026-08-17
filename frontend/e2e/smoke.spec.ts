import { test, expect } from '@playwright/test';

// Conta dedicada a testes automatizados (cargo CEO), criada só para E2E — não é
// pessoa real, não deve ser usada para operação. Ver observações no cadastro
// (Usuários) em produção para contexto caso alguém encontre essa conta.
const QA_EMAIL = 'teste.qa@prosystemnet.com.br';
const QA_SENHA = 'QaTeste2026!Prosystem';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.fill('input[placeholder="seu@email.com"]', QA_EMAIL);
  await page.fill('input[placeholder="••••••••"]', QA_SENHA);
  await page.click('button:has-text("Acessar CRM")');
  // CEO é redirecionado para /relatorio-comercial (não /dashboard — ver frontend/app/page.tsx)
  await page.waitForURL('**/relatorio-comercial', { timeout: 15_000 });
}

test.describe('CRM Comercial - Smoke Tests', () => {
  test('deve carregar a tela de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /acessar crm/i })).toBeVisible();
  });

  test('deve logar com sucesso e cair no Relatório Comercial (CEO)', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Relatório Comercial' })).toBeVisible();
  });

  test('deve exibir os KPIs principais do Relatório Comercial', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Leads captados', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Fechamentos', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('MRR ganho', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Clientes perdidos', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Saldo MRR', { exact: false }).first()).toBeVisible();
  });

  test('deve mostrar o menu lateral com os módulos do CEO', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('link', { name: 'Painel do CEO' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Churn — Visão CEO' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Análise Comercial' })).toBeVisible();
  });

  test('deve deslogar com sucesso', async ({ page }) => {
    await login(page);
    await page.click('text=Usuário');
    await page.click('button:has-text("Sair")');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
  });

  test('deve rejeitar credenciais inválidas', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="seu@email.com"]', 'usuario-que-nao-existe@teste.com');
    await page.fill('input[placeholder="••••••••"]', 'senhaerrada123');
    await page.click('button:has-text("Acessar CRM")');
    await expect(page.getByText(/e-?mail ou senha inv[aá]lidos?/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });
});

test.describe('API Health Checks', () => {
  test('backend deve estar acessível e saudável', async ({ request }) => {
    const response = await request.get('https://crmcomercialprosystem-production-945e.up.railway.app/health');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.prisma).toBe(true);
  });

  test('login via API deve retornar token válido', async ({ request }) => {
    const response = await request.post('https://crmcomercialprosystem-production-945e.up.railway.app/auth/login', {
      data: { email: QA_EMAIL, password: QA_SENHA },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.accessToken).toBeDefined();
    expect(data.data.user.email).toBe(QA_EMAIL);
    expect(data.data.user.role).toBe('CEO');
  });
});
