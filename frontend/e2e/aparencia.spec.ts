import { test, expect } from '@playwright/test';

// Local UI contract: all API traffic is intercepted; no real customer data or messages.
test.use({ baseURL: 'http://localhost:3100' });
const conversa = { id: 'layout-test', contato_nome: 'Contato de teste com nome comprido', contato_numero: '5527999990000', dono_id: 'qa-layout', dono_nome: 'Operadora de teste', nao_lidas: 2, ultima_mensagem: 'Bom dia', ultima_em: '2026-10-14T13:32:00Z', etiqueta: 'Financeiro', tipo_contato: 'CLIENTE', prioridade: 'NORMAL', estagio_funil: 'INTERESSADO' };
const user = { id: 'qa-layout', userId: 'qa-layout', nome: 'Operadora de teste', email: 'layout@example.invalid', role: 'SUPERVISAO_COMERCIAL', perfil_completo_em: '2026-10-14T00:00:00Z' };

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  await page.addInitScript(({ user }) => {
    localStorage.setItem('accessToken', 'test.' + btoa(JSON.stringify(user)) + '.test');
    localStorage.setItem('ps_sidebar_collapsed', '0');
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


const palettes = ['champagne','gelo','azul','laranja','verde'];
function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}

test('cinco paletas mudam superfícies com contraste legível nos dois modos', async ({ page }) => {
  await page.goto('/configuracoes');
  const section = page.getByRole('region', { name: 'Aparência', exact: true });
  await expect(section).toBeVisible();
  const names = ['Champagne','Branco gelo','Azul Prosystem','Laranja','Verde'];
  const backgrounds = new Set<string>();
  for (const mode of ['Claro','Escuro']) {
    await section.getByRole('button', { name: mode, exact: true }).click();
    for (const [i,palette] of palettes.entries()) {
      await section.getByRole('button', { name: names[i], exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', palette);
      await page.waitForTimeout(250); // transição de paleta
      const colors = await page.evaluate(() => {
        const probe = document.createElement('span'); probe.style.setProperty('transition','none','important'); document.body.append(probe);
        const read = (token: string) => { probe.style.color = 'var(' + token + ')'; return getComputedStyle(probe).color; };
        const result = Object.fromEntries(['--t-content-bg','--t-card-bg','--t-text-primary','--t-text-secondary','--t-text-muted','--t-primary','--t-text-inverse','--t-link','--t-primary-light','--t-sidebar-bg','--t-error','--t-error-bg','--card','--popover'].map(t => [t, read(t)]));
        probe.remove(); return result;
      });
      backgrounds.add(colors['--t-content-bg']);
      for (const text of ['--t-text-primary','--t-text-secondary','--t-text-muted','--t-link']) {
        for (const surface of ['--t-content-bg','--t-card-bg','--t-sidebar-bg','--t-primary-light']) expect(contrast(colors[text],colors[surface]), palette + mode + text + surface).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colors['--t-primary'],colors['--t-text-inverse'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors['--t-error'],colors['--t-error-bg'])).toBeGreaterThanOrEqual(4.5);
      expect(colors['--card']).toBe(colors['--t-card-bg']);
      expect(colors['--popover']).toBe(colors['--t-card-bg']);
      await expect(page.locator('.ps-sidebar')).toHaveCSS('background-image','none');
      const preview = section.getByRole('button', { name: names[i], exact: true }).locator('.aparencia-previa');
      await expect(preview).toHaveCSS('background-color',colors['--t-content-bg']);
      if (i < 2) await section.screenshot({ path: 'test-results/aparencia-' + palette + '-' + mode + '.png' });
    }
  }
  expect(backgrounds.size).toBe(10);
});

test('preferência persiste após recarregar e opções são acessíveis por teclado', async ({ page }) => {
  await page.goto('/configuracoes');
  const section = page.getByRole('region', { name: 'Aparência', exact: true });
  await section.getByRole('button', { name: 'Champagne', exact: true }).focus();
  await page.keyboard.press('Enter');
  await section.getByRole('button', { name: 'Escuro', exact: true }).click();
  await page.reload();
  await expect(section.getByRole('button', { name: 'Champagne', exact: true })).toHaveAttribute('aria-pressed','true');
  await expect(section.getByRole('button', { name: 'Escuro', exact: true })).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(() => localStorage.getItem('ps-theme-color'))).toBe('champagne');
});

for (const palette of ['champagne','gelo']) for (const mode of ['claro','escuro']) {
  test('WhatsApp integra tema ' + palette + ' ' + mode, async ({ page }) => {
    await page.addInitScript(({ palette, mode }) => { localStorage.setItem('ps-theme-color',palette); localStorage.setItem('ps-theme-mode',mode); }, { palette, mode });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/whatsapp');
    await page.getByRole('button', { name: /Contato de teste com nome comprido/ }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme',palette);
    await page.screenshot({ path: 'test-results/tema-whatsapp-' + palette + '-' + mode + '.png' });
    await page.getByRole('button', { name: 'Detalhes do atendimento', exact: true }).click();
    await expect(page.locator('#wpp-detalhes')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Fechar detalhes' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cell = await page.locator('.ios-lista').evaluate(el => getComputedStyle(el).backgroundColor);
    const card = await page.evaluate(() => { const el=document.createElement('div'); el.style.background='var(--t-card-bg)'; document.body.append(el); const c=getComputedStyle(el).backgroundColor; el.remove(); return c; });
    expect(cell).toBe(card);
    await page.screenshot({ path: 'test-results/tema-whatsapp-mobile-' + palette + '-' + mode + '.png' });
  });
}

test('seletor cabe no celular e preferência inválida usa padrão válido', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('ps-theme-color','invalido'); localStorage.setItem('ps-theme-mode','invalido'); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/configuracoes');
  const section = page.getByRole('region', { name: 'Aparência', exact: true });
  await expect(section.getByRole('button', { name: 'Azul Prosystem', exact: true })).toHaveAttribute('aria-pressed','true');
  await expect(section.getByRole('button', { name: 'Claro', exact: true })).toHaveAttribute('aria-pressed','true');
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const palette of ['champagne','gelo']) for (const mode of ['claro','escuro']) {
  test('tabela e formulário de clientes ' + palette + ' ' + mode, async ({ page }) => {
    await page.addInitScript(({ palette, mode }) => { localStorage.setItem('ps-theme-color',palette); localStorage.setItem('ps-theme-mode',mode); }, { palette, mode });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/clientes');
    await expect(page.getByRole('table')).toContainText('Cliente de teste');
    await page.getByRole('button', { name: '+ Novo Cliente', exact: true }).click();
    const field = page.getByPlaceholder('Nome completo', { exact: true });
    await field.fill('Somente prévia');
    const colors = await field.evaluate(el => {const s=getComputedStyle(el); return [s.color,s.backgroundColor];});
    expect(contrast(colors[0],colors[1])).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: 'test-results/tema-clientes-' + palette + '-' + mode + '.png' });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(field).toBeHidden();
  });
}
