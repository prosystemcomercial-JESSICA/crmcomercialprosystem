import { describe, it, expect } from 'vitest';
import { calcularCondicao, lerBotaoNegociacao, menuNegociacao, textoPedidoNegociacao } from '../src/lib/assistente/negociacao';

describe('negociação (campanha com autorização)', () => {
  it('calcula desconto na implantação e 10% na mensalidade', () => {
    const c = calcularCondicao(30, 1000, 200);
    expect(c.impl_por).toBe(700);
    expect(c.mens_por).toBe(180);
    expect(c.meses).toBe(12);
  });
  it('lê os botões da gestão', () => {
    expect(lerBotaoNegociacao('neg_30_abc')).toEqual({ pct: 30, msgId: 'abc' });
    expect(lerBotaoNegociacao('neg_0_abc')).toEqual({ pct: 0, msgId: 'abc' });
    expect(lerBotaoNegociacao('desc_ok_x')).toBeNull();
  });
  it('pedido traz prévia, mensagem e 3 botões', () => {
    const t = textoPedidoNegociacao({ empresa: 'Farmácia Teste', contato: 'Ana', plano: 'Farma Pro', mensalidade: 200, implantacao: 1000, link: 'https://x/p/1', mensagem: 'Oi Ana', agente: 'Luiz Felipe' });
    expect(t).toContain('Farmácia Teste');
    expect(t).toContain('Oi Ana');
    expect(menuNegociacao('m1', t).opcoes.map(o => o.id)).toEqual(['neg_30_m1', 'neg_20_m1', 'neg_0_m1']);
  });
});

describe('registro da campanha para o Rafael (12/11/2026)', () => {
  it('autorizada, recusada ou inexistente', async () => {
    const { textoRegistroCampanha } = await import('../src/lib/assistente/negociacao');
    const em = '2026-11-10T13:00:00.000Z';
    const c = { ...calcularCondicao(20, 1000, 200), por: 'Rafael', em };
    expect(textoRegistroCampanha({ desconto_autorizado: c }, new Date('2026-11-12T12:00:00Z'))).toMatch(/AUTORIZADA por Rafael em 10\/11: 20%.*válida até 15\/11 \(vigente\)/);
    expect(textoRegistroCampanha({ desconto_autorizado: c }, new Date('2026-11-20T12:00:00Z'))).toMatch(/VENCIDA/);
    expect(textoRegistroCampanha({ campanha_recusada: true, campanha_mes: '2026-11' })).toMatch(/NÃO autorizada/);
    expect(textoRegistroCampanha(null)).toMatch(/Nenhuma campanha autorizada/);
  });
});
