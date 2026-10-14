import { test, expect } from '@playwright/test';
import { activeMenuHref } from '../lib/use-menu-groups';

// Local UI contract: all API traffic is intercepted; no real customer data or messages.
test.use({ baseURL: 'http://localhost:3100' });
const conversa = { id: 'layout-test', contato_nome: 'Contato de teste com nome comprido', contato_numero: '5527999990000', dono_id: 'qa-layout', dono_nome: 'Operadora de teste', nao_lidas: 2, ultima_mensagem: 'Bom dia', ultima_em: '2026-10-14T13:32:00Z', etiqueta: 'Financeiro', tipo_contato: 'CLIENTE', prioridade: 'NORMAL', estagio_funil: 'INTERESSADO' };
const user = { id: 'qa-layout', userId: 'qa-layout', nome: 'Operadora de teste', email: 'layout@example.invalid', role: 'SUPERVISAO_COMERCIAL', perfil_completo_em: '2026-10-14T00:00:00Z' };

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  await page.addInitScript(({ user }) => {
    localStorage.setItem('accessToken', 'test.' + btoa(JSON.stringify(user)) + '.test');
    if (!localStorage.getItem('ps_sidebar_collapsed')) localStorage.setItem('ps_sidebar_collapsed', '0');
    localStorage.setItem('wpp.proximaAcao.fechado', '1');
  }, { user });
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === 'eventsource') return route.abort();
    if (!['fetch','xhr'].includes(request.resourceType())) {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    }
    if (url.pathname.endsWith('/backups')) return route.fulfill({ json: [] });
    let data: unknown = [];
    if (url.pathname.endsWith('/usuarios/me')) data = user;
    else if (url.pathname.endsWith('/whatsapp/instancias')) data = { configurado: true, empresa: { status: 'CONECTADO', numero: '5527999990000' }, numeros: [{ vaga: 'empresa', rotulo: 'Atendimento', provedor: 'UAZAPI', principal: true, numero: '5527999990000', status: 'CONECTADO', ja_conectou: true }] };
    else if (url.pathname.endsWith('/whatsapp/conversas')) data = [conversa];
    else if (url.pathname.endsWith('/mensagens')) data = { mensagens: [{ id: 'm1', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'Bom dia', created_at: '2026-10-14T13:32:00Z' }, { id: 'm2', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'https://example.invalid/' + 'a'.repeat(180), created_at: '2026-10-14T13:33:00Z' }] };
    else if (url.pathname.endsWith('/painel')) data = {};
    else if (url.pathname.endsWith('/clientes')) data = { clientes: [{ id: 'cliente-tema', nome: 'Cliente de teste', empresa: 'Empresa fictícia', email: 'teste@example.invalid', created_at: '2026-10-14T00:00:00Z' }], total: 1 };
    else if (url.pathname.endsWith('/assistente/config')) data = { avisos: [], tipos: [], telefone: null, recebe: true, pix_chave: '', ia: { laya_triagem: false, laya_confianca: .8, risco_limite: 60, risco_so_clientes: true }, ia_texto: { tira_duvidas: 'desligado', transcrever_auto: false, tem_chave: false }, posvenda: false, desconto_limite: 0 };
    else if (url.pathname.includes('/configuracoes/integracoes')) data = {};
    await route.fulfill({ json: { success: true, data } });
  });
});



test('grupos iniciam fechados mesmo após abrir grupos e recarregar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('ps_menu_closed_groups', '[]'));
  await page.goto('/whatsapp');
  const menu = page.getByRole('complementary', { name: 'Menu lateral' });
  await expect(menu).toHaveCSS('width','208px');
  await expect(menu.getByRole('link')).toHaveCount(0);
  await menu.getByRole('button', { name: 'Painéis', exact: true }).click();
  const firstLink = menu.getByRole('link', { name: 'Painel do CEO', exact: true });
  expect((await firstLink.boundingBox())!.y - (await menu.boundingBox())!.y).toBeLessThanOrEqual(34);
  const group = menu.getByRole('button', { name: 'Vendas', exact: true });
  await group.focus(); await page.keyboard.press('Enter');
  await expect(group).toHaveAttribute('aria-expanded','true');
  await page.reload();
  await expect(group).toHaveAttribute('aria-expanded','false');
  await expect(menu.getByRole('link')).toHaveCount(0);
  await menu.getByRole('button', { name: 'Recolher menu', exact: true }).click();
  await expect(menu).toHaveCSS('width','52px');
  await expect(menu.getByRole('link', { name: 'Central de Leads', exact: true })).toBeVisible();
  await page.reload();
  await expect(menu).toHaveCSS('width','52px');
  await menu.getByRole('button', { name: 'Expandir menu', exact: true }).click();
  await expect(group).toHaveAttribute('aria-expanded','false');
  await page.screenshot({ path: 'test-results/menu-fechado.png' });
});

test('expandir e recolher todos preserva links e estado ativo', async ({ page }) => {
  await page.goto('/whatsapp');
  const menu = page.getByRole('complementary', { name: 'Menu lateral' });
  await expect(menu.locator('.ps-menu-heading[data-current="true"]')).toHaveCount(1);
  await menu.getByRole('button', { name: 'Expandir todos os grupos' }).click();
  await expect(menu.getByRole('link', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
  await menu.getByRole('button', { name: 'Recolher todos os grupos' }).click();
  await expect(menu.getByRole('link')).toHaveCount(0);
});

test('menu móvel inicia fechado e pode abrir grupos durante o uso', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/whatsapp');
  const shortcut = page.getByRole('link', { name: 'Abrir WhatsApp em nova aba' });
  await expect(shortcut).toBeInViewport();
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Mais', exact: true });
  const group = sheet.getByRole('button', { name: 'Vendas', exact: true });
  await expect(group).toHaveAttribute('aria-expanded','false');
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded','true');
  expect((await group.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mais', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await expect(group).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('atalho ao lado da lua abre WhatsApp independente sem sair da tela atual', async ({ page }) => {
  await page.goto('/clientes');
  const shortcut = page.getByRole('link', { name: 'Abrir WhatsApp em nova aba' });
  await expect(shortcut).toHaveAttribute('target','_blank');
  expect(await shortcut.evaluate((el) => el.previousElementSibling?.getAttribute('title'))).toBe('Modo escuro');
  const popupPromise = page.waitForEvent('popup');
  await shortcut.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/whatsapp$/);
  await expect(popup.getByRole('heading', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/clientes$/);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await expect(popup.getByRole('complementary', { name: 'Menu lateral' }).getByRole('link')).toHaveCount(0);
  await popup.close();
});

test("rota ativa respeita limites e seleciona apenas o caminho mais específico", () => {
  const hrefs = ["/leads", "/leads-sdr", "/tv", "/tv/escritorio", "/clientes"];
  expect(activeMenuHref("/leads-sdr", hrefs)).toBe("/leads-sdr");
  expect(activeMenuHref("/tv/escritorio", hrefs)).toBe("/tv/escritorio");
  expect(activeMenuHref("/clientes/123", hrefs)).toBe("/clientes");
});
