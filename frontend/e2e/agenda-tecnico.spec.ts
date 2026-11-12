import { test, expect } from '@playwright/test';

// Agenda do técnico no Portal Técnico (12/11/2026): menu Agenda, formulário e o compromisso no card do quadro.
// Toda a API é simulada; os nomes são fictícios.
test.use({ baseURL: 'http://localhost:3100' });
const user = { id: 'qa-tec', userId: 'qa-tec', nome: 'Tecnico de teste', email: 'tecnico@example.invalid', role: 'TECNICO_IMPLANTACAO', perfil_completo_em: '2026-10-14T00:00:00Z' };

const daquiA = (min: number) => new Date(Date.now() + min * 60000).toISOString();
const compromissos = [
  { id: 'a1', tecnico_id: 'qa-tec', tecnico_nome: 'Técnico de teste', implantacao_id: 'c1', cliente_nome: 'FARMÁCIA EXEMPLO LTDA', tipo: 'REUNIAO', titulo: 'Alinhar a data da virada', contato_nome: 'Ana', contato_fone: '27999990000', link: 'https://meet.example.invalid/abc', descricao: null, inicio: daquiA(120), duracao_min: 60, avisar_antes_min: 15, status: 'AGENDADO', alerta_em: null, alerta_status: null, resultado: null },
  { id: 'a2', tecnico_id: 'qa-tec', tecnico_nome: 'Técnico de teste', implantacao_id: null, cliente_nome: 'PADARIA DE TESTE', tipo: 'LIGACAO', titulo: 'Retorno sobre a impressora', contato_nome: null, contato_fone: null, link: null, descricao: 'Perguntar o modelo', inicio: daquiA(60 * 26), duracao_min: 30, avisar_antes_min: 0, status: 'AGENDADO', alerta_em: null, alerta_status: null, resultado: null },
  { id: 'a3', tecnico_id: 'qa-tec', tecnico_nome: 'Técnico de teste', implantacao_id: 'c1', cliente_nome: 'FARMÁCIA EXEMPLO LTDA', tipo: 'ACESSO_REMOTO', titulo: 'Conferir o estoque importado', contato_nome: null, contato_fone: null, link: null, descricao: null, inicio: daquiA(-180), duracao_min: 60, avisar_antes_min: 0, status: 'AGENDADO', alerta_em: daquiA(-180), alerta_status: 'ENVIADO', resultado: null },
];
const card = { id: 'c1', coluna: 'EM_ANDAMENTO', modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', onboarding_ok: true, onboarding_feitos: 22, onboarding_total: 22, esperas_abertas: [], chamados_em_teste: 0, ocorrencias_abertas: 0, virada_agendada_para: null, virada_inicio_em: null, virada_fim_em: null, cobranca_lancada_em: null, saude: null, proximo_passo: null, sla: { situacao: 'NO_PRAZO', prazo: null, pct: 10 }, sla_etapa: 'virada', tecnico_nome: 'Técnico de teste', progresso: 40, cliente_razao_social: 'FARMÁCIA EXEMPLO LTDA', proximo_compromisso: { id: 'a1', tipo: 'REUNIAO', titulo: 'Alinhar a data da virada', inicio: compromissos[0].inicio } };
const colunas = [{ key: 'A_FAZER', label: 'A fazer' }, { key: 'EM_ANDAMENTO', label: 'Em andamento' }, { key: 'FINALIZADO', label: 'Finalizado' }, { key: 'CANCELADOS', label: 'Cancelados' }];

let criado: any = null;
test.beforeEach(async ({ page }) => {
  criado = null;
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
    else if (url.pathname.endsWith('/agenda-tecnico') && request.method() === 'POST') { criado = request.postDataJSON(); data = { id: 'novo', ...criado }; }
    else if (url.pathname.endsWith('/agenda-tecnico')) data = compromissos;
    else if (url.pathname.endsWith('/implantacoes/quadro')) data = { colunas, cards: [card] };
    else if (url.pathname.endsWith('/implantacoes')) data = { implantacoes: [], resumo: null };
    else if (url.pathname.endsWith('/tickets')) data = { tickets: [], stats: [] };
    else if (url.pathname.endsWith('/solicitacoes')) data = { solicitacoes: [], stats: [] };
    await route.fulfill({ json: { success: true, status: 'success', data } });
  });
});

test('menu Agenda lista os compromissos e agenda um novo', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/portal-tecnico?tab=agenda');
  await expect(page.getByText('Alinhar a data da virada')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Retorno sobre a impressora')).toBeVisible();
  await expect(page.getByText('Já passaram: marque como foi')).toBeVisible();
  await expect(page.getByText('Alerta no WhatsApp: 15 min antes')).toBeVisible();
  await page.screenshot({ path: 'test-results/agenda-1366.png', fullPage: true });

  await page.getByRole('button', { name: 'Novo compromisso' }).click();
  await page.getByRole('radio', { name: /Ligação/ }).click();
  await page.getByLabel('Cliente (card)').selectOption('c1');
  await page.getByLabel('Assunto').fill('Combinar o treinamento do caixa');
  const amanha = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  await page.getByLabel('Dia', { exact: true }).fill(amanha);
  await page.getByLabel('Hora', { exact: true }).fill('14:30');
  await page.getByLabel('Alerta no WhatsApp').selectOption('30');
  await expect(page.getByText(/Você recebe o alerta no WhatsApp em .* às 14:00/)).toBeVisible();
  await page.screenshot({ path: 'test-results/agenda-form-1366.png' });
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  await expect.poll(() => criado).not.toBeNull();
  expect(criado).toMatchObject({ tipo: 'LIGACAO', titulo: 'Combinar o treinamento do caixa', inicio: `${amanha}T14:30`, avisar_antes_min: 30, implantacao_id: 'c1' });
});

test('card do quadro mostra o próximo compromisso', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/portal-tecnico?tab=quadro');
  await expect(page.locator('.pt-card').getByText(/🗓 .*Alinhar a data da virada/)).toBeVisible({ timeout: 60_000 });
});

for (const width of [360, 390]) {
  test(`agenda no celular (${width}px) sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/portal-tecnico?tab=agenda');
    await expect(page.getByText('Alinhar a data da virada')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Novo compromisso' }).click();
    await expect(page.getByLabel('Assunto')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/agenda-form-${width}.png` });
  });
}
