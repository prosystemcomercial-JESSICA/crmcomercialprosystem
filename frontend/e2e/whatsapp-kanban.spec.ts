import { test, expect } from '@playwright/test';

// Local UI contract: all API traffic is intercepted; no real customer data or messages.
test.use({ baseURL: 'http://localhost:3100' });
const conversa = { id: 'layout-test', contato_nome: 'Contato de teste com nome comprido', contato_numero: '5527999990000', dono_id: 'qa-layout', dono_nome: 'Operadora de teste', nao_lidas: 2, ultima_mensagem: 'Bom dia', ultima_em: '2026-10-14T13:32:00Z', etiqueta: 'Financeiro', tipo_contato: 'CLIENTE', prioridade: 'NORMAL', estagio_funil: 'INTERESSADO' };
const user = { id: 'qa-layout', userId: 'qa-layout', nome: 'Operadora de teste', email: 'layout@example.invalid', role: 'SUPERVISAO_COMERCIAL', perfil_completo_em: '2026-10-14T00:00:00Z' };

const chamados = [
  ...Array.from({ length: 18 }, (_, i) => ({ ...conversa, id: `fila-julio-${i}`, contato_nome: `Empresa de teste ${i + 1}`, ultima_mensagem: 'Podemos conversar sobre a proposta?', atendente_ia: 'Julio', dono_id: null, nao_lidas: 0 })),
  { ...conversa, id: 'fila-a', contato_nome: 'Contato Alfa', atendente_ia: 'Caroline', dono_id: null, nao_lidas: 3, sla_prazo_em: '2020-01-01T00:00:00Z' },
  { ...conversa, id: 'fila-b', contato_nome: 'Contato Beta', atendente_ia: 'Caroline', dono_id: null, nao_lidas: 0 },
  { ...conversa, id: 'fila-c', contato_nome: 'Contato Gama', prioridade: 'CRITICA', nao_lidas: 0 },
  { ...conversa, id: 'fila-d', contato_nome: 'Contato Delta', dono_id: null, bot_ativo: true, bot_estado: 'MENU', nao_lidas: 0 },
  { ...conversa, id: 'fila-e', contato_nome: 'Contato Épsilon', dono_id: null, nao_lidas: 0 },
];

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
    else if (url.pathname.endsWith('/whatsapp/conversas')) data = chamados;
    else if (url.pathname.endsWith('/mensagens')) data = { mensagens: [{ id: 'm1', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'Bom dia', created_at: '2026-10-14T13:32:00Z' }, { id: 'm2', direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'https://example.invalid/' + 'a'.repeat(180), created_at: '2026-10-14T13:33:00Z' }] };
    else if (url.pathname.endsWith('/painel')) data = {};
    await route.fulfill({ json: { success: true, data } });
  });
});


for (const width of [390, 1024, 1366, 1920]) {
  test('fila compacta e responsiva ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/whatsapp');
    await page.getByRole('button', { name: 'Fila de Chamados', exact: true }).click();
    const fila = page.getByRole('region', { name: 'Fila de chamados', exact: true });
    const caroline = fila.getByRole('region', { name: 'Caroline', exact: true });
    await expect(caroline.getByRole('button')).toHaveCount(2);
    await expect(caroline.getByLabel('2 conversas', { exact: true })).toBeVisible();
    await expect(fila.getByText('Normal', { exact: true })).toHaveCount(0);
    await expect(fila.getByText('Caroline atendendo', { exact: true })).toHaveCount(0);
    await expect(fila.getByText(/Vencido há/)).toBeVisible();
    await expect(caroline.getByLabel('3 mensagens não lidas')).toBeVisible();
    const colunaCheia = fila.getByRole('region', { name: 'Julio', exact: true }).locator('.wpp-coluna-lista');
    expect(await colunaCheia.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await colunaCheia.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(colunaCheia.getByRole('button', { name: /Empresa de teste 18/ })).toBeVisible();
    await colunaCheia.evaluate(el => { el.scrollTop = 0; });
    const card = caroline.getByRole('button', { name: /Contato Beta/ });
    expect((await card.boundingBox())!.height).toBeLessThan(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scroll = fila.getByLabel('Colunas da fila');
    await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(fila.getByRole('region', { name: 'Sem dono', exact: true }).getByRole('button')).toBeInViewport();
    await scroll.evaluate(el => { el.scrollLeft = 0; });
    await page.screenshot({ path: 'test-results/whatsapp-fila-' + width + '.png' });
    await page.getByRole('textbox', { name: 'Buscar na fila', exact: true }).fill('Beta');
    await expect(fila.getByRole('button', { name: /Contato Alfa/ })).toHaveCount(0);
    await expect(fila.getByRole('button', { name: /Contato Beta/ })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar na fila', exact: true }).fill('inexistente');
    await expect(fila.getByText('Nenhuma conversa encontrada.')).toBeVisible();
  });
}

test('cartão abre por teclado e fase permite movimentação sem trocar responsável', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/whatsapp');
  await page.getByRole('button', { name: 'Fila de Chamados', exact: true }).click();
  const fila = page.getByRole('region', { name: 'Fila de chamados', exact: true });
  const card = fila.getByRole('button', { name: /Contato Beta/ });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeVisible();
  await expect(page.locator('.ios-chat-cab')).toContainText('Contato Beta');
  await page.getByRole('button', { name: 'Fila de Chamados', exact: true }).click();
  await page.getByRole('button', { name: 'Por fase', exact: true }).click();
  await expect(card).toContainText('Caroline');
  await expect(card).toHaveAttribute('draggable', 'true');
  const request = page.waitForRequest(r => r.url().endsWith('/whatsapp/conversas/fila-b/estagio') && r.method() === 'PATCH');
  await card.dragTo(fila.getByRole('region', { name: 'Em Negociação', exact: true }));
  expect((await request).postDataJSON()).toEqual({ estagio_funil: 'EM_NEGOCIACAO' });
  await expect(fila.getByRole('region', { name: 'Em Negociação', exact: true }).getByRole('button', { name: /Contato Beta/ })).toBeVisible();
});
