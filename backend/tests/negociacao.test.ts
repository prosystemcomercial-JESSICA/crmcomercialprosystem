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
