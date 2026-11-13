import { test, expect } from '@playwright/test';

// Carrossel dos quadros da equipe no Escritório (13/11/2026): uma linha, cards da mesma altura, setas e busca.
// Toda a API é simulada; nada de dado real.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-gestora', userId: 'qa-gestora', nome: 'Gestora de teste', email: 'gestora@example.invalid', role: 'ADMIN', perfil_completo_em: '2026-10-14T00:00:00Z' };
const agora = new Date().toISOString();
const nomes: [string, string, string][] = [
  ['caroline', 'Caroline', 'SDR · primeiro contato'], ['julio', 'Julio', 'Follow-up de leads'], ['heitor', 'Heitor', 'Prospecção no Google Maps'],
  ['mila', 'Mila', 'Customer Success'], ['rafael', 'Rafael', 'Especialista em vendas'], ['laya', 'Laya', 'Cérebro da equipe'],
  ['joana', 'Joana', 'Informativo Prosystem'], ['otavio', 'Otávio', 'Implantação e serviços'], ['sofia', 'Sofia', 'Pesquisas'],
  ['luiz_felipe', 'Luiz Felipe', 'Propostas não assinadas'], ['vitoria', 'Vitória', 'CEO dos agentes'], ['gustavo', 'Gustavo', 'Gerente de Entrada e Vendas'],
];
const agentes = nomes.map(([id, nome, funcao], i) => ({ id, nome, funcao, cor: ['#be123c', '#0d9488', '#65a30d', '#0e7490', '#1e40af', '#7c3aed'][i % 6], status: i === 3 ? 'erro' : 'parado', ultima: null, numeros: [], observacao: '' }));
// Quadros com conteúdo de tamanhos bem diferentes, para conferir que todos ficam da mesma altura.
const quadros = agentes.map((a, i) => ({
  id: a.id, setor: 'vendas', erro: i === 3 ? 'Sem chave da IA' : null, precisa_de_voce: i === 1 ? 'Aprovar 3 mensagens' : null,
  mensagens: { hoje: i, d7: i * 10, d30: i * 40 },
  qualidade: i % 2 ? { sozinha: 10, aprovada: 5, editada: 2, descartada: 1, segurada_laya: 3 } : null,
  ia_mes: { chamadas: i * 7, falhas: 0, brl: i }, recebe_de: i % 3 ? ['Heitor'] : [], entrega_para: i % 4 ? ['Julio', 'Rafael'] : [],
}));
const painel = {
  setores: [{ id: 'vendas', nome: 'Vendas', agentes: agentes.map(a => a.id) }], quadros, passagens: [], esperando: [],
  saude: { agentes: { total: 12, ligados: 12, com_erro: [] }, ias: { total: 0, com_falha: [], provedores: [] }, whatsapp: { total: 1, conectados: 1, desconectados: [] }, esperando: 0 },
  consumo: { mes: '2026-11', brl: 0, previsao: 0, teto: 0, usado: 0, nivel: 'sem_teto', previsao_estoura: false, por_dia: [], por_agente: {}, falhas_provedor: [], cotacao: 5 },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('accessToken', 'test.' + btoa(JSON.stringify(user)) + '.test');
    localStorage.setItem('ps_sidebar_collapsed', '1');
  }, { user });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === 'eventsource') return route.abort();
    if (!['fetch', 'xhr'].includes(request.resourceType())) {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    }
    let data: unknown = [];
    if (url.pathname.endsWith('/usuarios/me')) data = user;
    else if (url.pathname.endsWith('/assistente/escritorio/painel')) data = painel;
    else if (url.pathname.endsWith('/assistente/escritorio')) data = { agentes, conversas: [], gerado_em: agora };
    await route.fulfill({ json: { success: true, status: 'success', data } });
  });
});

test('quadros numa linha só, mesma altura, setas e busca', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/escritorio');
  const carrossel = page.getByRole('region', { name: 'Quadros da equipe' });
  await expect(carrossel.getByLabel('Quadro de Caroline')).toBeVisible({ timeout: 90_000 });
  await expect(carrossel.locator('article.esc-quadro')).toHaveCount(12);
  await expect(carrossel.getByText('12 de 12')).toBeVisible();

  // Uma linha só e todos da mesma altura.
  const caixas = await carrossel.locator('article.esc-quadro').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; }));
  expect(new Set(caixas.map(c => c.top)).size).toBe(1);
  expect(new Set(caixas.map(c => c.h)).size).toBe(1);
  // Nada vaza para fora da página.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1367);
  await carrossel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/carrossel-1366.png' });

  // Seta para a direita gira o trilho.
  const voltar = carrossel.getByRole('button', { name: 'Ver agentes anteriores' });
  await expect(voltar).toBeDisabled();
  await carrossel.getByRole('button', { name: 'Ver mais agentes' }).click();
  await expect(voltar).toBeEnabled();
  await page.screenshot({ path: 'test-results/carrossel-girado-1366.png' });

  // Busca sem acento acha "Otávio"; busca pela função também.
  await carrossel.getByLabel('Procurar agente').fill('otavio');
  await expect(carrossel.locator('article.esc-quadro')).toHaveCount(1);
  await expect(carrossel.getByLabel('Quadro de Otávio')).toBeVisible();
  await carrossel.getByLabel('Procurar agente').fill('gerente');
  await expect(carrossel.getByLabel('Quadro de Gustavo')).toBeVisible();
  await carrossel.getByLabel('Procurar agente').fill('zzz');
  await expect(carrossel.getByText(/Nenhum agente encontrado/)).toBeVisible();
  await carrossel.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(carrossel.locator('article.esc-quadro')).toHaveCount(12);
});

test('celular: o carrossel não alarga a página', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/escritorio');
  const carrossel = page.getByRole('region', { name: 'Quadros da equipe' });
  await expect(carrossel.getByLabel('Quadro de Caroline')).toBeVisible({ timeout: 90_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await carrossel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/carrossel-390.png' });
});
