import { test, expect } from '@playwright/test';

// Diretoria dos agentes (13/11/2026): painel da Vitória (CEO), desempenho dos gerentes e a sala da diretoria.
// Toda a API é simulada; nomes de pessoas e lojas são fictícios.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-gestora', userId: 'qa-gestora', nome: 'Gestora de teste', email: 'gestora@example.invalid', role: 'ADMIN', perfil_completo_em: '2026-10-14T00:00:00Z' };
const agora = new Date().toISOString();
const ag = (id: string, nome: string, funcao: string, cor: string) => ({ id, nome, funcao, cor, status: 'parado', ultima: null, numeros: [], observacao: '' });
const agentes = [
  ag('caroline', 'Caroline', 'SDR', '#be123c'), ag('julio', 'Julio', 'Follow-up', '#0d9488'), ag('heitor', 'Heitor', 'Prospecção', '#65a30d'),
  ag('mila', 'Mila', 'CS', '#0e7490'), ag('rafael', 'Rafael', 'Especialista', '#1e40af'),
  ag('vitoria', 'Vitória', 'CEO · metas, plano comercial', '#0f172a'), ag('gustavo', 'Gustavo', 'Gerente de Entrada e Vendas', '#334155'), ag('renata', 'Renata', 'Gerente de Clientes e Inteligência', '#9f1239'),
];
const setores = [
  { id: 'entrada', nome: 'Entrada de leads', agentes: ['heitor'] }, { id: 'vendas', nome: 'Vendas', agentes: ['caroline', 'julio'] },
  { id: 'inteligencia', nome: 'Inteligência e treino', agentes: ['rafael'] }, { id: 'clientes', nome: 'Clientes e gestão', agentes: ['mila'] },
  { id: 'direcao', nome: 'Diretoria', agentes: ['vitoria', 'gustavo', 'renata'] },
];
const painel = {
  setores, quadros: [], passagens: [], esperando: [],
  saude: { agentes: { total: 8, ligados: 8, com_erro: [] }, ias: { total: 0, com_falha: [], provedores: [] }, whatsapp: { total: 1, conectados: 1, desconectados: [] }, esperando: 0 },
  consumo: { mes: '2026-11', brl: 0, previsao: 0, teto: 0, usado: 0, nivel: 'sem_teto', previsao_estoura: false, por_dia: [], por_agente: {}, falhas_provedor: [], cotacao: 5 },
};
const diretoria = {
  em_andamento: [], agenda: ['Boletim do Rafael e da Laya: sexta a partir das 16h', 'Gerentes: dias úteis a partir das 18h', 'Vitória: plano toda segunda às 8h'],
  agentes: [
    { id: 'caroline', nome: 'Caroline', gerente: 'gustavo', nivel: 'critico', sinais: ['45% das mensagens com problema (5 corrigida(s), 4 descartada(s) de 20)'], tecnico: null, taxa_erro: 0.45, mensagens: 60, nota: 5, melhorar: 'oferecer a demonstração mais cedo', degrau: { nivel: 2, desde: agora, motivo: 'x' } },
    { id: 'julio', nome: 'Julio', gerente: 'gustavo', nivel: 'ok', sinais: [], tecnico: null, taxa_erro: 0.05, mensagens: 30, nota: 8, melhorar: null, degrau: null },
    { id: 'mila', nome: 'Mila', gerente: 'renata', nivel: 'atencao', sinais: ['nota 5.5/10 no boletim do Rafael e da Laya'], tecnico: '40% das chamadas de IA falharam (4 de 10)', taxa_erro: null, mensagens: 0, nota: 5.5, melhorar: null, degrau: { nivel: 1, desde: agora, motivo: 'x' } },
  ],
  boletim: { id: 'b1', criado: agora, resumo: 'Semana boa no follow-up; a Caroline precisa oferecer a demonstração mais cedo.', agentes: [{ id: 'caroline', nota: 5, motivo: '9 de 20 mensagens corrigidas ou descartadas', melhorar: 'oferecer a demonstração mais cedo' }] },
  planos: [{ id: 'p1', tipo: 'PLANO', titulo: 'Plano comercial · semana 2026-11-09', created_at: agora, conteudo: '# Plano\n\n## Diagnóstico\nO funil trava entre o primeiro contato e a demonstração.\n\n## Providências (2 aplicadas)\n- x',
    providencias: [
      { i: 0, tipo: 'regra', descricao: 'Regra nova para Caroline: ofereça a demonstração assim que o cliente contar a dor.', aplicada: true },
      { i: 1, tipo: 'meta_agente', descricao: 'Meta do mês para Heitor: 120 leads cadastrados', aplicada: true },
      { i: 2, tipo: 'treinar', descricao: 'Pediu ao Rafael um treino de Caroline', aplicada: true },
      { i: 3, tipo: 'meta_vendedora', descricao: 'Meta do mês para Ana Teste: 6 contrato(s)', aplicada: false, erro: 'a Jessica já lançou a meta desta vendedora neste mês; a Vitória não altera' },
    ] }],
  cobrancas: [{ id: 'n1', de: 'gustavo', de_nome: 'Gustavo', para_nome: 'Caroline', assunto: 'Cobrança do Gustavo', texto: 'Caroline, aqui é o Gustavo, seu gerente.', created_at: agora }],
  metas_agentes: [{ agente: 'heitor', nome: 'Heitor', rotulo: 'leads cadastrados', indicador: 'leads_cadastrados', alvo: 120, atual: 48 }],
  metas_vendedoras: [{ id: 'm1', nome: 'Ana Teste', meta_contratos: 6, meta_valor_total: 18000, valor_atual: 0, da_vitoria: false }],
};

let desfeito: string | null = null;
test.beforeEach(async ({ page }) => {
  desfeito = null;
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
    else if (url.pathname.includes('/desfazer')) { desfeito = url.pathname; message = 'Desfeito: regra da Caroline'; data = {}; }
    else if (url.pathname.endsWith('/diretoria')) data = diretoria;
    await route.fulfill({ json: { success: true, status: 'success', data, message } });
  });
});

test('painel da Vitória: plano, providências com desfazer, desempenho, metas e cobranças', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/escritorio?diretoria=1');
  await expect(page.getByRole('heading', { name: /Vitória · CEO dos agentes/ })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Regra nova para Caroline')).toBeVisible();
  await expect(page.getByText(/não aplicada: a Jessica já lançou/)).toBeVisible();
  // Treino não tem "Desfazer"; regra e meta têm.
  await expect(page.getByRole('button', { name: 'Desfazer' })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/diretoria-plano-1366.png', fullPage: true });
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(page.getByRole('status')).toHaveText('Desfeito: regra da Caroline');
  expect(desfeito).toContain('/diretoria/providencia/p1/0/desfazer');

  await page.getByRole('tab', { name: /Desempenho/ }).click();
  await expect(page.getByText('Crítico', { exact: true })).toBeVisible();
  await expect(page.getByText(/Técnico \(não é culpa do agente\)/)).toBeVisible();
  await page.screenshot({ path: 'test-results/diretoria-desempenho-1366.png', fullPage: true });
  await page.getByRole('tab', { name: /Metas do mês/ }).click();
  await expect(page.getByText('48 de 120')).toBeVisible();
  await expect(page.getByText('lançada por você (a Vitória não altera)')).toBeVisible();
  await page.getByRole('tab', { name: /Cobranças/ }).click();
  await expect(page.getByText('Gustavo → Caroline')).toBeVisible();
});

test('celular: painel cabe na tela e a sala mostra a diretoria', async ({ page }) => {
  for (const largura of [390, 360]) {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.goto('/escritorio?diretoria=1');
    await expect(page.getByRole('heading', { name: /Vitória · CEO dos agentes/ })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('tab', { name: /Desempenho/ }).click();
    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larguraDoc).toBeLessThanOrEqual(largura + 1);
    await page.screenshot({ path: `test-results/diretoria-${largura}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/escritorio');
  await expect(page.getByRole('button', { name: /Setor Diretoria · sala da Jessica/ })).toBeVisible({ timeout: 90_000 });
  await page.screenshot({ path: 'test-results/diretoria-sala-1366.png' });
});
