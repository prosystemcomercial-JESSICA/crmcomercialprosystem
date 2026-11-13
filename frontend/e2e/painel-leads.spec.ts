import { test, expect } from '@playwright/test';

// Painel de Leads da Laya (13/11/2026). Toda a API é simulada; números parecidos com os de produção, sem nomes reais.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-gestora', userId: 'qa-gestora', nome: 'Gestora de teste', email: 'gestora@example.invalid', role: 'ADMIN', perfil_completo_em: '2026-10-14T00:00:00Z' };
const agora = new Date().toISOString();
const ag = (id: string, nome: string, cor: string) => ({ id, nome, funcao: 'teste', cor, status: 'parado', ultima: null, numeros: [], observacao: '' });
const agentes = [ag('laya', 'Laya', '#db2777'), ag('rafael', 'Rafael', '#1e40af'), ag('caroline', 'Caroline', '#be123c')];
const painel = {
  setores: [{ id: 'inteligencia', nome: 'Inteligência e treino', agentes: ['laya', 'rafael'] }, { id: 'vendas', nome: 'Vendas', agentes: ['caroline'] }],
  quadros: [], passagens: [], esperando: [],
  saude: { agentes: { total: 3, ligados: 3, com_erro: [] }, ias: { total: 0, com_falha: [], provedores: [] }, whatsapp: { total: 1, conectados: 1, desconectados: [] }, esperando: 0 },
  consumo: { mes: '2026-11', brl: 0, previsao: 0, teto: 0, usado: 0, nivel: 'sem_teto', previsao_estoura: false, por_dia: [], por_agente: {}, falhas_provedor: [], cotacao: 5 },
};
const cont = (o: Record<string, number>) => ({ chegaram: 0, contatados: 0, responderam: 0, interessados: 0, demonstracoes: 0, propostas: 0, contratos: 0, valor: 0, perdidos: 0, sem_contato: 0, ...o });
const etapas: [string, string, number][] = [['chegaram', 'Chegaram', 340], ['contatados', 'Receberam contato', 300], ['responderam', 'Responderam', 80], ['interessados', 'Interessados', 12], ['demonstracoes', 'Demonstração', 4], ['propostas', 'Proposta', 4], ['contratos', 'Contrato', 2]];
const dados: any = {
  dias: 30, gerado_em: agora,
  atual: cont({ chegaram: 340, contatados: 300, responderam: 80, interessados: 12, demonstracoes: 4, propostas: 4, contratos: 2, valor: 9800, perdidos: 9, sem_contato: 25 }),
  anterior: cont({ chegaram: 300, contratos: 1, demonstracoes: 3, valor: 4000 }),
  taxas: { resposta: 26.7, conversao: 0.6, conversao_anterior: 0.3, interesse_para_demo: 33.3, proposta_para_contrato: 50, horas_ate_contato: 6 },
  funil: {
    etapas: etapas.map(([k, rotulo, n], i) => ({ k, rotulo, n, do_total: Math.round((n / 340) * 1000) / 10, da_anterior: i ? Math.round((n / etapas[i - 1][2]) * 1000) / 10 : null })),
    gargalo: { de: 'Responderam', para: 'Interessados', taxa: 15, perdidos: 68 },
  },
  canais: [
    { ...cont({ chegaram: 6, contatados: 6, responderam: 4, interessados: 3, demonstracoes: 2, propostas: 2, contratos: 2, valor: 9800 }), canal: 'Indicação', parte: 1.8, resposta: 66.7, conversao: 33.3, ate_demo: 33.3, horas_ate_contato: 1, campanhas: [{ campanha: 'Indicação de cliente', chegaram: 6, responderam: 4, demonstracoes: 2, contratos: 2 }] },
    { ...cont({ chegaram: 300, contatados: 280, responderam: 70, interessados: 6 }), canal: 'Prospecção (Heitor)', parte: 88.2, resposta: 25, conversao: 0, ate_demo: 0, horas_ate_contato: 8, campanhas: [{ campanha: 'Prospecção Heitor', chegaram: 300, responderam: 70, demonstracoes: 0, contratos: 0 }] },
  ],
  agentes: [{ agente: 'caroline', leads: 300, contatados: 280, responderam: 70, interessados: 6, demonstracoes: 1, contratos: 0, resposta: 25, ate_demo: 1.4 }],
  vendedoras: [{ vendedora: 'Ana Teste', propostas: 4, contratos: 2, valor: 9800, fechamento: 50 }],
  semanas: [
    { semana: '2026-10-19', chegaram: 80, responderam: 20, demonstracoes: 1, contratos: 0 }, { semana: '2026-10-26', chegaram: 90, responderam: 22, demonstracoes: 1, contratos: 1 },
    { semana: '2026-11-02', chegaram: 100, responderam: 25, demonstracoes: 2, contratos: 1 }, { semana: '2026-11-09', chegaram: 70, responderam: 13, demonstracoes: 0, contratos: 0 },
  ],
  perdas: [{ id: 'JA_TEM_FORNECEDOR', rotulo: 'Já tem sistema / fechou com outro', n: 6, parte: 66.7 }, { id: 'PRECO', rotulo: 'Preço', n: 2, parte: 22.2 }, { id: 'SEM_MOTIVO', rotulo: 'Sem motivo anotado', n: 1, parte: 11.1 }],
  temperatura: [{ temperatura: 'MUITO_QUENTE', n: 2 }, { temperatura: 'QUENTE', n: 8 }, { temperatura: 'MORNO', n: 30 }, { temperatura: 'FRIO', n: 290 }],
  melhorias: [
    { nivel: 'alta', titulo: 'Prospecção (Heitor): muito lead e nenhuma demonstração', detalhe: '300 leads em 30 dias, 70 responderam e nenhum chegou à demonstração.', quem: 'Heitor, Caroline e Rafael' },
    { nivel: 'media', titulo: 'Indicação vende e recebe pouco esforço', detalhe: 'Converte 33,3%, mas é só 1,8% dos leads.', quem: 'Vitória' },
  ],
  porque: null,
};
let pediuRafael = false;

test.beforeEach(async ({ page }) => {
  pediuRafael = false;
  dados.porque = null;
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
    let message: string | undefined;
    if (url.pathname.endsWith('/usuarios/me')) data = user;
    else if (url.pathname.endsWith('/assistente/escritorio/painel')) data = painel;
    else if (url.pathname.endsWith('/assistente/escritorio')) data = { agentes, conversas: [], gerado_em: agora };
    else if (url.pathname.endsWith('/comercial/painel-leads/porque')) {
      pediuRafael = true;
      message = 'O Rafael leu 8 conversas.';
      dados.porque = {
        em: agora, canal: 'Prospecção (Heitor)', etapa: 'Respondeu → Demonstração', conversas_lidas: 8,
        resumo: 'Os leads respondem por educação, mas ninguém pergunta qual é a dor antes de falar do sistema.',
        causas: ['A abertura fala do produto antes de ouvir o cliente.'], acoes: [{ quem: 'Caroline', o_que: 'Perguntar como é o fechamento do caixa hoje.' }],
      };
      data = dados.porque;
    } else if (url.pathname.endsWith('/comercial/painel-leads')) data = dados;
    else if (url.pathname.endsWith('/ia/laya/niveis')) data = { total: 10, hoje: 1, pendentes: 0, tarefas: [] };
    await route.fulfill({ json: { success: true, status: 'success', data, message } });
  });
});

test('Painel de Leads: números, o que melhorar, funil, canais e o porquê do Rafael', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/escritorio?leads=1');
  await expect(page.getByRole('heading', { name: /Laya · Painel de Leads/ })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('tab', { name: /Painel de Leads/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/Urgente: Prospecção \(Heitor\): muito lead e nenhuma demonstração/)).toBeVisible();
  await expect(page.getByText(/Maior perda: de/)).toBeVisible();
  await expect(page.getByText('Já tem sistema / fechou com outro').first()).toBeVisible();
  await page.getByRole('button', { name: /Indicação$/ }).click();
  await expect(page.getByText('Indicação de cliente')).toBeVisible();
  await page.screenshot({ path: 'test-results/painel-leads-1366.png', fullPage: true });
  await page.getByRole('button', { name: 'Pedir ao Rafael agora' }).click();
  await expect(page.getByText('O Rafael leu 8 conversas.')).toBeVisible();
  await expect(page.getByText(/ninguém pergunta qual é a dor/)).toBeVisible();
  expect(pediuRafael).toBe(true);
  await page.getByRole('tab', { name: /Caderno da Laya/ }).click();
  await expect(page.getByRole('tab', { name: /Caderno da Laya/ })).toHaveAttribute('aria-selected', 'true');
});

test('celular: o painel cabe na tela', async ({ page }) => {
  for (const largura of [390, 360]) {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.goto('/escritorio?leads=1');
    await expect(page.getByText(/Medido pela Laya/)).toBeVisible({ timeout: 90_000 });
    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraDoc).toBeLessThanOrEqual(largura + 1);
    await page.screenshot({ path: `test-results/painel-leads-${largura}.png`, fullPage: true });
  }
});
