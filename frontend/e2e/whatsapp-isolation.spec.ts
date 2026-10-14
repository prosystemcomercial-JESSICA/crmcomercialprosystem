import { test, expect, type Page, type Route } from '@playwright/test';

// A interface é real; apenas a rede é controlada para reproduzir respostas fora de ordem.
const origin = process.env.WHATSAPP_TEST_ORIGIN || 'http://localhost:3100';
test.use({ baseURL: origin });
const user = { id: 'qa-layout', userId: 'qa-layout', nome: 'Operadora de teste', email: 'layout@example.invalid', role: 'SUPERVISAO_COMERCIAL', perfil_completo_em: '2026-10-14T00:00:00Z' };
const contacts = ['a', 'b'].map(id => ({ id, contato_nome: 'Contato ' + id.toUpperCase(), contato_numero: '552799999000' + (id === 'a' ? '1' : '2'), dono_id: user.id, nao_lidas: 0, ultima_mensagem: 'Prévia ' + id, tipo_contato: 'CLIENTE' }));
const message = (id: string, conteudo = 'Histórico exclusivo ' + id.toUpperCase()) => ({ id: 'm-' + id, direcao: 'ENTRADA', tipo: 'TEXTO', conteudo, created_at: '2026-10-14T13:32:00Z' });
const history = (id: string, text?: string) => ({ mensagens: [message(id, text)] });
const panel = (id: string) => ({ cliente: { id, razao_social: 'Empresa exclusiva ' + id.toUpperCase() }, proposta: null, responsavel: null, prioridade: 'NORMAL', estagio_funil: 'NOVO_CONTATO' });
const select = (page: Page, id: string) => page.getByRole('button', { name: new RegExp('Contato ' + id.toUpperCase()) }).click();
async function release(page: Page, route: Route, data: unknown, status = 200) {
  const finished = page.waitForEvent('requestfinished', req => req === route.request());
  await route.fulfill({ status, json: { success: status === 200, data } });
  await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
}
async function hold(page: Page, path: string) {
  const requests: Route[] = [];
  await page.route('**/whatsapp/conversas/' + path, route => { requests.push(route); });
  return requests;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(({ user }) => {
    localStorage.setItem('accessToken', 'test.' + btoa(JSON.stringify(user)) + '.test');
    localStorage.setItem('ps_sidebar_collapsed', '1');
    localStorage.setItem('wpp.proximaAcao.fechado', '1');
    // SSE controlado, sem abrir conexão real nem enviar credenciais de teste.
    (window as any).__streams = [];
    (window as any).EventSource = class {
      onmessage: any; onerror: any;
      constructor() { (window as any).__streams.push(this); }
      close() { this.onmessage = null; }
    };
  }, { user });
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!['fetch', 'xhr'].includes(req.resourceType())) {
      return url.origin === origin ? route.continue() : route.abort();
    }
    let data: unknown = [];
    if (url.pathname.endsWith('/usuarios/me')) data = user;
    else if (url.pathname.endsWith('/whatsapp/instancias')) data = { configurado: true, empresa: { status: 'CONECTADO', numero: '5527999990000' }, numeros: [] };
    else if (url.pathname.endsWith('/whatsapp/conversas')) data = contacts;
    else if (/\/conversas\/[ab]\/mensagens$/.test(url.pathname)) data = history(url.pathname.split('/').at(-2)!);
    else if (/\/conversas\/[ab]\/painel$/.test(url.pathname)) data = panel(url.pathname.split('/').at(-2)!);
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/whatsapp');
});

test('trocar contato remove histórico e rascunho anteriores durante carregamento', async ({ page }) => {
  await select(page, 'a');
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho apenas de A');
  const pending = await hold(page, 'b/mensagens');
  await select(page, 'b');
  await expect.poll(() => pending.length).toBe(1);
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue('');
  await expect(page.getByText('Carregando conversa…', { exact: true })).toBeVisible();
  await release(page, pending[0], history('b'));
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
});

test('resposta atrasada de outro contato não sobrescreve histórico atual', async ({ page }) => {
  const pending = await hold(page, 'a/mensagens');
  await select(page, 'a');
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
  await release(page, pending[0], history('a'));
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
});

test('painel atrasado não traz cliente da conversa anterior', async ({ page }) => {
  const pending = await hold(page, 'a/painel');
  await select(page, 'a');
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await expect(page.getByText('Empresa exclusiva B', { exact: true }).first()).toBeVisible();
  await release(page, pending[0], panel('a'));
  await expect(page.getByText('Empresa exclusiva A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Empresa exclusiva B', { exact: true }).first()).toBeVisible();
});

test('voltar ao mesmo contato ignora resposta da abertura anterior', async ({ page }) => {
  const pending = await hold(page, 'a/mensagens');
  await select(page, 'a');
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
  await select(page, 'a');
  await expect.poll(() => pending.length).toBe(2);
  await release(page, pending[1], history('a', 'Histórico atual de A'));
  await expect(page.getByText('Histórico atual de A', { exact: true })).toBeVisible();
  await release(page, pending[0], history('a', 'Histórico obsoleto de A'));
  await expect(page.getByText('Histórico obsoleto de A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Histórico atual de A', { exact: true })).toBeVisible();
});

test('envio concluído após troca não aparece nem altera rascunho de outro contato', async ({ page }) => {
  await select(page, 'a');
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toBeVisible();
  const pending = await hold(page, 'a/enviar');
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Resposta só para A');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho de B');
  await release(page, pending[0], { ...message('sent-a', 'Resposta só para A'), direcao: 'SAIDA' });
  await expect(page.locator('.ios-mensagens').getByText('Resposta só para A', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue('Rascunho de B');
});

test('sugestão atrasada não substitui texto de outro contato', async ({ page }) => {
  await select(page, 'a');
  const pending = await hold(page, 'a/ia/sugestao');
  await page.getByRole('button', { name: 'Sugerir resposta com IA', exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Rascunho de B');
  await release(page, pending[0], { texto: 'Sugestão exclusiva para A' });
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue('Rascunho de B');
});

test('falha ao carregar permite tentar de novo sem exibir conversa anterior', async ({ page }) => {
  await select(page, 'a');
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toBeVisible();
  const pending = await hold(page, 'b/mensagens');
  await select(page, 'b');
  await expect.poll(() => pending.length).toBe(1);
  await release(page, pending[0], null, 500);
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  await release(page, pending[1], history('b'));
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
});


test('polling iniciado antes da troca não substitui o histórico atual', async ({ page }) => {
  await page.clock.install();
  await select(page, 'a');
  await expect(page.getByText('Histórico exclusivo A', { exact: true })).toBeVisible();
  const pending = await hold(page, 'a/mensagens');
  await page.clock.fastForward(20_001);
  await expect.poll(() => pending.length).toBe(1);
  await select(page, 'b');
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
  await release(page, pending[0], history('a', 'Atualização tardia de A'));
  await expect(page.getByText('Atualização tardia de A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Histórico exclusivo B', { exact: true })).toBeVisible();
});
