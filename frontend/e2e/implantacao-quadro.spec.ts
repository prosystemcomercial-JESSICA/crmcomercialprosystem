import { test, expect } from '@playwright/test';

// Contrato visual do quadro de implantações e serviços (12/11/2026): nenhum texto
// sai do card e nenhum card sai da coluna, em qualquer largura de tela.
// Toda a API é simulada; os nomes são fictícios.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-quadro', userId: 'qa-quadro', nome: 'Gestora de teste', email: 'quadro@example.invalid', role: 'SUPERVISAO_TECNICA', perfil_completo_em: '2026-10-14T00:00:00Z' };

const base = { modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', sistema_anterior: null, onboarding_ok: false, onboarding_feitos: 0, onboarding_total: 22, esperas_abertas: [], chamados_em_teste: 0, ocorrencias_abertas: 0, virada_agendada_para: null, virada_inicio_em: null, virada_fim_em: null, cobranca_lancada_em: null, saude: null, proximo_passo: { quem: 'TECNICO', titulo: 'Primeiro contato com o cliente' }, sla: { situacao: 'AGUARDANDO_INICIO', prazo: null, pct: 0 }, sla_etapa: 'implantação', tecnico_nome: 'Lucas Diniz', progresso: 5 };
const cards = [
  { ...base, id: 'c1', coluna: 'A_FAZER', sistema_anterior: 'Evolução Sistemas', esperas_abertas: [{ tipo: 'PRE_REQUISITO' }], cliente_razao_social: 'GARCIA E PERON LTDA' },
  { ...base, id: 'c2', coluna: 'A_FAZER', tipo_base: 'BANCO_ZERADO', esperas_abertas: [{ tipo: 'PRE_REQUISITO' }], saude: { nivel: 'AMARELO', motivos: ['Parado'] }, cliente_razao_social: '64.163.743 RONAIRA DE OLIVEIRA PEREIRA BATISTA' },
  { ...base, id: 'c3', coluna: 'A_FAZER', tecnico_nome: null, sistema_anterior: 'Sistema Anterior Com Nome Muito Comprido Mesmo', esperas_abertas: [{ tipo: 'PRE_REQUISITO' }], chamados_em_teste: 3, ocorrencias_abertas: 2, virada_agendada_para: '2026-11-20T13:00:00Z', cliente_razao_social: 'DROGARIAEFARMACIADEMANIPULACAOSEMESPACOSNENHUMQUEPRECISAQUEBRARLINHAPARANAOSAIRDOCARDDROGARIAEFARMACIADEMANIPULACAO', proximo_passo: { quem: 'GESTAO', titulo: 'Conferir com o cliente todos os pré-requisitos pendentes antes de começar a conversão' } },
  { ...base, id: 'c4', coluna: 'EM_ANDAMENTO', modulo: 'SERVICO', tipo_servico_label: 'Comunicação entre filiais', onboarding_ok: true, esperas_abertas: [{ tipo: 'CLIENTE' }], saude: { nivel: 'AMARELO', motivos: [] }, sla: { situacao: 'NO_PRAZO', prazo: '2026-11-21T12:00:00Z', pct: 30 }, cliente_razao_social: 'SARA LAURIANO PERFUMARIA', proximo_passo: { quem: 'TECNICO', titulo: 'Executar o serviço' } },
  { ...base, id: 'c5', coluna: 'EM_ANDAMENTO', onboarding_ok: true, sla: { situacao: 'ESTOURADO', prazo: '2026-11-01T12:00:00Z', pct: 140 }, virada_inicio_em: '2026-11-10T12:00:00Z', tecnico_nome: null, cliente_razao_social: 'FARMÁCIA DO TESTE COM UM NOME BEM GRANDE PARA OCUPAR DUAS OU TRÊS LINHAS DO CARD LTDA ME' },
  { ...base, id: 'c6', coluna: 'VALIDACAO', onboarding_ok: true, sla: { situacao: 'CUMPRIDO_ATRASO', prazo: '2026-11-05T12:00:00Z', pct: 100 }, virada_fim_em: '2026-11-11T12:00:00Z', cliente_razao_social: 'PADARIA PÃO QUENTE' },
];
const colunas = [
  { key: 'A_FAZER', label: 'A fazer' }, { key: 'EM_ANDAMENTO', label: 'Em andamento' }, { key: 'VALIDACAO', label: 'Aguardando validação do cliente' },
  { key: 'FINALIZADO', label: 'Finalizado' }, { key: 'CANCELADOS', label: 'Cancelados' },
];

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
    else if (url.pathname.endsWith('/implantacoes/quadro')) data = { colunas, cards };
    else if (url.pathname.endsWith('/implantacoes')) data = { implantacoes: [], resumo: null };
    else if (url.pathname.endsWith('/tickets')) data = { tickets: [], stats: [] };
    else if (url.pathname.endsWith('/solicitacoes')) data = { solicitacoes: [], stats: [] };
    await route.fulfill({ json: { success: true, data } });
  });
});

for (const width of [360, 390, 768, 1024, 1280, 1366, 1440, 1920, 2560]) {
  test('nenhum texto sai do card do quadro em ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/portal-tecnico?tab=quadro');
    const quadro = page.locator('.pt-kanban');
    await expect(quadro.locator('.pt-card')).toHaveCount(cards.length, { timeout: 60_000 });
    await expect(quadro.getByText('GARCIA E PERON LTDA')).toBeVisible();

    const problemas = await page.evaluate(() => {
      const erros: string[] = [];
      document.querySelectorAll<HTMLElement>('.pt-kanban .pt-card').forEach(card => {
        const c = card.getBoundingClientRect();
        const coluna = card.parentElement!.getBoundingClientRect();
        const nome = (card.innerText.split('\n').find(l => l.trim().length > 12) || '').slice(0, 30);
        if (c.left < coluna.left - 0.5 || c.right > coluna.right + 0.5) erros.push(`card sai da coluna: ${nome}`);
        if (card.scrollWidth > card.clientWidth + 1) erros.push(`card com rolagem lateral: ${nome}`);
        card.querySelectorAll<HTMLElement>('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (!r.width) return;
          if (r.left < c.left - 0.5 || r.right > c.right + 0.5) erros.push(`"${(el.innerText || el.tagName).slice(0, 40)}" sai do card ${nome} (${Math.round(r.right - c.right)}px)`);
          if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') erros.push(`"${el.innerText.slice(0, 40)}" cortado sem reticências em ${nome}`);
        });
      });
      return erros;
    });
    expect(problemas).toEqual([]);
    // A página em si não rola de lado; só o quadro, quando as colunas não cabem.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/quadro-implantacao-${width}.png` });
  });
}

test('etiqueta cortada mostra o texto completo na dica', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/portal-tecnico?tab=quadro');
  const etq = page.locator('.pt-kanban .pt-card').first().getByText(/Aguardando pré-requisitos/);
  await expect(etq).toHaveAttribute('title', /Aguardando pré-requisitos do cliente/, { timeout: 60_000 });
});
