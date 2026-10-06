import { describe, it, expect } from 'vitest';
import { mrrDaVenda, montarDashboardCrossSell } from '../src/lib/crosssell-dashboard';

const d = (s: string) => new Date(`${s}T12:00:00-03:00`);
const venda = (o: any) => ({
  id: o.id, categoria: o.categoria, parceiro_nome: o.parceiro_nome || o.categoria, cliente_codigo: o.codigo || '1', cliente_nome: o.cliente || 'Loja',
  vendedor_id: o.vendedor_id || 'v1', vendedor_nome: o.vendedor_nome || 'Jessica Cardoso', status: o.status || 'CONFIRMADA',
  valor_venda: o.valor ?? null, acrescimo_mensal: o.acresc ?? null, mensalidade_anterior: o.ant ?? null, mensalidade_nova: o.nova ?? null,
  lojas_detalhe: o.lojas ?? null, descricao_servico: o.desc ?? null, data: d(o.data),
});

describe('MRR de expansão de cada venda', () => {
  it('comunicação soma o acréscimo de todas as lojas', () => {
    expect(mrrDaVenda(venda({ categoria: 'COMUNICACAO', acresc: 260, ant: 380, nova: 510, lojas: [{ acrescimo: 130 }, { acrescimo: 130 }], data: '2026-06-12' }))).toBe(260);
  });
  it('upgrade com acréscimo usa o acréscimo; sem acréscimo usa depois − antes', () => {
    expect(mrrDaVenda(venda({ categoria: 'UPGRADE', acresc: 35, ant: 315, nova: 350, data: '2026-09-14' }))).toBe(35);
    expect(mrrDaVenda(venda({ categoria: 'UPGRADE', acresc: 0, ant: 266, nova: 350, data: '2026-06-02' }))).toBe(84);
  });
  it('troca de CNPJ e serviço não mudam a mensalidade', () => {
    expect(mrrDaVenda(venda({ categoria: 'TROCA_CNPJ', valor: 550, ant: 300, nova: 300, data: '2026-07-03' }))).toBe(0);
    expect(mrrDaVenda(venda({ categoria: 'SERVICO', valor: 210, data: '2026-04-27' }))).toBe(0);
  });
});

describe('dashboard de cross-sell e up-sell', () => {
  const vendas = [
    venda({ id: 'a', categoria: 'TROCA_CNPJ', valor: 550, data: '2026-01-22', codigo: '803' }),
    venda({ id: 'b', categoria: 'TROCA_CNPJ', valor: 750, data: '2026-01-29', codigo: '2055' }),
    venda({ id: 'c', categoria: 'UPGRADE', valor: 350, acresc: 0, ant: 300, nova: 350, data: '2026-03-09', codigo: '1090' }),
    venda({ id: 'e', categoria: 'FISCAL', valor: null, acresc: 100, ant: 300, nova: 400, data: '2026-03-20', codigo: '2007', vendedor_id: 'v2', vendedor_nome: 'Ana' }),
    venda({ id: 'x', categoria: 'UPGRADE', valor: 999, acresc: 99, data: '2026-03-21', status: 'CANCELADO' }),
    venda({ id: 'f', categoria: 'TROCA_CNPJ', valor: 500, data: '2025-12-30' }), // fora do período
  ];
  const comissoes = [
    { referencia_id: 'a', papel: 'VENDEDOR', valor_comissao: 82.5, status: 'PAGA' },
    { referencia_id: 'b', papel: 'VENDEDOR', valor_comissao: 112.5, status: 'APROVADA' },
    { referencia_id: 'b', papel: 'SUPERVISAO', valor_comissao: 37.5, status: 'APROVADA' },
    { referencia_id: 'e', papel: 'VENDEDOR', valor_comissao: 50, status: 'APROVADA' },
    { referencia_id: 'x', papel: 'VENDEDOR', valor_comissao: 50, status: 'CANCELADA' },
  ];
  const r = montarDashboardCrossSell(vendas, comissoes, { inicio: d('2026-01-01'), fim: d('2026-03-31') });

  it('totais ignoram canceladas e o que está fora do período', () => {
    expect(r.totais).toEqual({ vendas: 4, receita_unica: 1650, mrr_expansao: 150, arr_expansao: 1800, ticket_medio: 412.5, clientes: 4 });
  });

  it('mês a mês cobre todos os meses do período, inclusive os vazios, com MRR acumulado', () => {
    expect(r.meses.map(m => [m.mes, m.vendas, m.receita_unica, m.mrr, m.mrr_acumulado])).toEqual([
      ['2026-01', 2, 1300, 0, 0], ['2026-02', 0, 0, 0, 0], ['2026-03', 2, 350, 150, 150],
    ]);
    expect(r.meses[0].por_tipo).toEqual({ TROCA_CNPJ: 2 });
  });

  it('ranking por tipo (mais vendido primeiro) e destaques', () => {
    expect(r.por_tipo.map(t => [t.tipo, t.rotulo, t.vendas, t.receita_unica, t.mrr])).toEqual([
      ['TROCA_CNPJ', 'Troca de CNPJ', 2, 1300, 0], ['UPGRADE', 'Upgrade de plano', 1, 350, 50], ['FISCAL', 'Pacote fiscal', 1, 0, 100],
    ]);
    expect(r.destaques.melhor_mes_vendas).toEqual({ mes: '2026-01', vendas: 2 });
    expect(r.destaques.melhor_mes_receita).toEqual({ mes: '2026-01', valor: 1300 });
    expect(r.destaques.tipo_maior_mrr).toBe('FISCAL');
  });

  it('vendedores com comissões pagas e a pagar; supervisão separada', () => {
    expect(r.vendedores).toEqual([
      { vendedor_id: 'v1', vendedor: 'Jessica Cardoso', vendas: 3, receita_unica: 1650, mrr: 50, comissao_total: 195, comissao_paga: 82.5, comissao_a_pagar: 112.5 },
      { vendedor_id: 'v2', vendedor: 'Ana', vendas: 1, receita_unica: 0, mrr: 100, comissao_total: 50, comissao_paga: 0, comissao_a_pagar: 50 },
    ]);
    expect(r.comissoes).toEqual({ vendedor_total: 245, supervisao_total: 37.5, pagas: 82.5, a_pagar: 200 });
  });

  it('lista vem da mais recente para a mais antiga, com antes/depois', () => {
    expect(r.lista.map(l => l.id)).toEqual(['e', 'c', 'b', 'a']);
    expect(r.lista[1]).toMatchObject({ tipo: 'UPGRADE', receita_unica: 350, mrr: 50, antes: 300, depois: 350 });
  });
});
