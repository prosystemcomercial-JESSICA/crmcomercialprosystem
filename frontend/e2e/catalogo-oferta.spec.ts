import { test, expect } from '@playwright/test';

// Catálogo do agente de oferta (13/11/2026): produto Prosystem e integração parceira,
// cada item numa linha (sem campos empilhados), e o tipo vai junto ao salvar.
// Toda a API é simulada; nomes fictícios.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-cat', userId: 'qa-cat', nome: 'Gestora de teste', email: 'catalogo@example.invalid', role: 'SUPERVISAO_TECNICA', perfil_completo_em: '2026-10-14T00:00:00Z' };
const config = {
  sla: { CONVERSAO: { virada: 30, final: 60 }, BANCO_ZERADO: { virada: 15, final: 30 }, SERVICO_DIAS_UTEIS: 5 },
  programacao: { nome: 'Dev', whatsapp: '', lembrete_horas: 4, token: 't' }, avisos_cliente: true, agente_ativo: true, ofertas_ativo: true, ofertas_dias_apos_virada: 15,
  catalogo: [{ tipo: 'PRODUTO', produto: 'Pacote fiscal', descricao: 'Cuida das obrigações.', preco: 'R$ 50/mês' }],
  modelos: [], extras_sistema: [], tarefas_cliente: [], metas: {}, sinval_recebe: false, link_programacao: '', checklist_padrao: [],
  jornada: { inicio: '08:00', fim: '18:00', almoco_inicio: '12:00', almoco_min: 60, virada_inicio: '07:00' },
};
let salvo: any = null;

test.beforeEach(async ({ page }) => {
  salvo = null;
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
    else if (url.pathname.endsWith('/implantacoes/portal/config')) {
      if (request.method() === 'PUT') salvo = request.postDataJSON();
      data = config;
    }
    else if (url.pathname.endsWith('/implantacoes/quadro')) data = { colunas: [], cards: [] };
    else if (url.pathname.endsWith('/implantacoes')) data = { implantacoes: [], resumo: null };
    else if (url.pathname.endsWith('/tickets')) data = { tickets: [], stats: [] };
    else if (url.pathname.endsWith('/solicitacoes')) data = { solicitacoes: [], stats: [] };
    await route.fulfill({ json: { success: true, status: 'success', data } });
  });
});

for (const width of [1366, 390]) {
  test('integração parceira no catálogo em ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/portal-tecnico?tab=config');
    await expect(page.getByText('Catálogo do agente de oferta')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: '+ Integração parceira' }).click();
    const linhas = page.getByTestId('item-catalogo');
    await expect(linhas).toHaveCount(2);
    const nova = linhas.nth(1);
    await expect(nova.getByLabel('Tipo do item')).toHaveValue('INTEGRACAO');
    await nova.getByPlaceholder('Empresa parceira').fill('Parceira Exemplo');
    await nova.getByPlaceholder('Integração (ex.: Delivery integrado)').fill('Delivery integrado');
    await nova.getByPlaceholder('O que é e o que resolve').fill('Pedidos caem direto no caixa.');

    // Na tela larga, cada item fica numa linha só e o botão de remover é pequeno.
    if (width >= 1200) {
      const tops = await nova.locator('input, select, button').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(12);
    }
    const x = await nova.getByRole('button', { name: 'Remover item' }).boundingBox();
    expect(x!.width).toBeLessThan(80);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/catalogo-oferta-${width}.png`, fullPage: false });

    await page.getByRole('button', { name: /Salvar configurações/ }).click();
    await expect.poll(() => salvo).not.toBeNull();
    expect(salvo.catalogo).toEqual([
      { tipo: 'PRODUTO', produto: 'Pacote fiscal', descricao: 'Cuida das obrigações.', preco: 'R$ 50/mês' },
      { tipo: 'INTEGRACAO', parceiro: 'Parceira Exemplo', produto: 'Delivery integrado', descricao: 'Pedidos caem direto no caixa.', preco: '' },
    ]);
  });
}
