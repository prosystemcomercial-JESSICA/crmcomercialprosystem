import { test, expect } from '@playwright/test';

// Local UI contract: all API traffic is intercepted; no real customer data or messages.
test.use({ baseURL: 'http://localhost:3100' });
const conversa = { id: 'layout-test', contato_nome: 'Contato de teste com nome comprido', contato_numero: '5527999990000', dono_id: 'qa-layout', dono_nome: 'Operadora de teste', nao_lidas: 2, ultima_mensagem: 'Bom dia', ultima_em: '2026-10-14T13:32:00Z', etiqueta: 'Financeiro', tipo_contato: 'CLIENTE', prioridade: 'NORMAL', estagio_funil: 'INTERESSADO' };
const user = { id: 'qa-layout', userId: 'qa-layout', nome: 'Operadora de teste', email: 'layout@example.invalid', role: 'SUPERVISAO_COMERCIAL', perfil_completo_em: '2026-10-14T00:00:00Z' };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('accessToken', 'test.' + btoa(JSON.stringify(user)) + '.test');
    localStorage.setItem('ps_sidebar_collapsed', '1');
    localStorage.setItem('wpp.proximaAcao.fechado', '1');
  }, { user });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === 'eventsource') return route.abort();
    if (!['fetch','xhr'].includes(request.resourceType())) {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    }
    let data: unknown = [];
    if (url.pathname.endsWith('/usuarios/me')) data = user;
    else if (url.pathname.endsWith('/whatsapp/instancias')) data = { configurado: true, empresa: { status: 'CONECTADO', numero: '5527999990000' }, numeros: [{ vaga: 'empresa', rotulo: 'Atendimento', provedor: 'UAZAPI', principal: true, numero: '5527999990000', status: 'CONECTADO', ja_conectou: true }] };
    else if (url.pathname.endsWith('/whatsapp/conversas')) data = [conversa];
    else if (url.pathname.endsWith('/mensagens')) data = { mensagens: [{ id: 'm1', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'Bom dia', created_at: '2026-10-14T13:32:00Z' }, { id: 'm2', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'https://example.invalid/' + 'a'.repeat(180), created_at: '2026-10-14T13:33:00Z' }] };
    else if (url.pathname.endsWith('/painel')) data = {};
    await route.fulfill({ json: { success: true, data } });
  });
});

for (const width of [360, 390, 768, 1024, 1366, 1920]) {
  test('WhatsApp layout ' + width, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/whatsapp');
    await page.getByRole('button', { name: /Contato de teste com nome comprido/ }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar apresentação', exact: true })).toHaveCount(1);
    await expect(page.locator('#wpp-detalhes').getByText('Apresentação', { exact: true })).toHaveCount(0);
    const geometry = await page.evaluate(() => {
      const input = document.querySelector('.ios-campo-msg')!.getBoundingClientRect();
      const messages = document.querySelector('.ios-mensagens')!;
      const details = document.querySelector('#wpp-detalhes')!;
      return { bodyOverflow: document.documentElement.scrollWidth > innerWidth, messagesOverflow: messages.scrollWidth > messages.clientWidth + 1, inputWidth: input.width, inputBottom: input.bottom, details: getComputedStyle(details).display !== 'none' };
    });
    expect(geometry.bodyOverflow).toBe(false);
    expect(geometry.messagesOverflow).toBe(false);
    expect(geometry.inputWidth).toBeGreaterThan(100);
    expect(geometry.inputBottom).toBeLessThanOrEqual(900);
    expect(geometry.details).toBe(width >= 1366);
    await page.screenshot({ path: 'test-results/whatsapp-chat-' + width + '.png' });
    await page.getByRole('button', { name: 'Enviar apresentação', exact: true }).click();
    const popup = page.getByRole('dialog', { name: 'Enviar apresentação' });
    await expect(popup).toBeVisible();
    const popupBounds = await popup.boundingBox();
    expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
    expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    if (width < 1366) await page.getByRole('button', { name: 'Detalhes do atendimento', exact: true }).click();
    await expect(page.locator('#wpp-detalhes')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar detalhes' }).click();
    await expect(page.locator('#wpp-detalhes')).toBeHidden();
    await page.getByRole('button', { name: 'Detalhes do atendimento', exact: true }).click();
    await expect(page.locator('#wpp-detalhes')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/whatsapp-' + width + '.png' });
  });
}


test('menu expandido preserva espaço da conversa no notebook', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/whatsapp');
  await page.getByRole('button', { name: /Contato de teste com nome comprido/ }).click();
  await expect(page.locator('#wpp-detalhes')).toBeVisible();
  await page.getByRole('button', { name: 'Expandir menu', exact: true }).click();
  await expect(page.locator('#wpp-detalhes')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Detalhes do atendimento', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/whatsapp-menu-expandido.png' });
});

test('celular com altura reduzida mantém escrita e apresentações acessíveis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('/whatsapp');
  await page.getByRole('button', { name: 'Nova', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Número para nova conversa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova', exact: true }).click();
  await page.getByRole('button', { name: /Contato de teste com nome comprido/ }).click();
  const input = page.getByRole('textbox', { name: 'Mensagem', exact: true });
  await input.fill('Mensagem de teste');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('Mensagem de teste\n');
  const bounds = await input.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(420);
  await page.getByRole('button', { name: 'Enviar apresentação', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Enviar apresentação' });
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Padarias', exact: true }).click();
  await expect(popup.locator('textarea')).toBeVisible();
  const box = await popup.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/whatsapp-celular-altura-reduzida.png' });
});
