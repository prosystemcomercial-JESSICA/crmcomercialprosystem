import { describe, it, expect } from 'vitest';
import { pctDesconto, precisaAprovacao, textoPedidoAprovacao, menuAprovacao, lerBotaoDesconto } from '../src/lib/assistente/desconto';

const p = (o: any = {}) => ({ desconto: 650, valor_implantacao: 2200, valor_conversao: 380, desconto_aprov_status: null, desconto_aprov_pct: null, ...o });

describe('desconto', () => {
  it('percentual sobre implantação + conversão', () => {
    expect(pctDesconto(p())).toBe(25.2);
    expect(pctDesconto(p({ desconto: 0 }))).toBe(0);
    expect(pctDesconto(p({ valor_implantacao: null, valor_conversao: null }))).toBe(0);
  });
  it('precisa de aprovação só acima do limite e sem aprovação que cubra', () => {
    expect(precisaAprovacao(p(), 30)).toBe(false);
    expect(precisaAprovacao(p({ desconto: 1000 }), 30)).toBe(true); // 38,8%
    expect(precisaAprovacao(p({ desconto: 1000, desconto_aprov_status: 'APROVADO', desconto_aprov_pct: 38.8 }), 30)).toBe(false);
    expect(precisaAprovacao(p({ desconto: 1200, desconto_aprov_status: 'APROVADO', desconto_aprov_pct: 38.8 }), 30)).toBe(true); // aumentou depois
    expect(precisaAprovacao(p({ desconto: 1000, desconto_aprov_status: 'RECUSADO', desconto_aprov_pct: 38.8 }), 30)).toBe(true);
    expect(precisaAprovacao(p({ desconto: 1000 }), 0)).toBe(false); // desligado
  });
  it('pedido e botões', () => {
    const t = textoPedidoAprovacao({ ...p({ desconto: 1000 }), nome: 'Farmácia Vida', valor_final: 1580, plano: 'PRO' }, 'Jessica', 30);
    expect(t).toContain('*Farmácia Vida* (plano PRO)');
    expect(t).toContain('Desconto de *38,8%* (limite 30%)');
    expect(menuAprovacao('x1', t).opcoes.map(o => o.id)).toEqual(['desc_ok_x1', 'desc_no_x1']);
    expect(lerBotaoDesconto('desc_no_x1')).toEqual({ aprovado: false, id: 'x1' });
    expect(lerBotaoDesconto('ativ_ok_x')).toBeNull();
  });
});
