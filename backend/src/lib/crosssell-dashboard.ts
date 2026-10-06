// Dashboard de cross-sell e up-sell (vendas para a base): regra única usada pela
// aba Dashboard do módulo Cross-sell e pela página do CEO.
//
// Duas receitas, sempre separadas:
//  - Receita única: setup/serviço cobrado uma vez (VendaAdicional.valor_venda).
//  - MRR de expansão: quanto a mensalidade da base cresceu com a venda.
//      COMUNICAÇÃO → soma do acréscimo de cada loja (lojas_detalhe);
//      com acréscimo_mensal > 0 → o acréscimo;
//      sem acréscimo (upgrade lançado quando o cadastro já tinha o valor novo) →
//      mensalidade_nova − mensalidade_anterior. Troca de CNPJ e serviço: 0.

export const ROTULO_TIPO_CROSSSELL: Record<string, string> = {
  TROCA_CNPJ: 'Troca de CNPJ', UPGRADE: 'Upgrade de plano', COMUNICACAO: 'Comunicação entre lojas', FISCAL: 'Pacote fiscal',
  SERVICO: 'Serviços', TEF: 'TEF', TRIBUTARIO: 'Tributário', INTEGRADORA: 'Integradora', OUTRO: 'Outros',
};

// Up-sell = o cliente passa a usar MAIS do mesmo sistema (plano maior, mais lojas na comunicação).
// Cross-sell = compra OUTRA coisa além do sistema (pacote fiscal, TEF, tributário, troca de CNPJ, serviços).
export const ESTRATEGIA_DO_TIPO: Record<string, 'UPSELL' | 'CROSSSELL'> = { UPGRADE: 'UPSELL', COMUNICACAO: 'UPSELL' };
export const estrategiaDe = (tipo: string) => ESTRATEGIA_DO_TIPO[tipo] || 'CROSSSELL';
const ROTULO_ESTRATEGIA = { UPSELL: 'Up-sell', CROSSSELL: 'Cross-sell' } as const;
const EXPLICA_ESTRATEGIA = {
  UPSELL: 'O cliente passa a usar mais do sistema: upgrade de plano e mais lojas na comunicação.',
  CROSSSELL: 'O cliente compra outra coisa além do sistema: pacote fiscal, TEF, tributário, troca de CNPJ e serviços.',
} as const;

export type VendaDashboard = {
  id: string; categoria: string | null; parceiro_nome: string | null; cliente_codigo: string | null; cliente_nome: string | null;
  vendedor_id: string; vendedor_nome: string | null; status: string;
  valor_venda: number | null; acrescimo_mensal: number | null; mensalidade_anterior: number | null; mensalidade_nova: number | null;
  lojas_detalhe: any; descricao_servico: string | null; data: Date;
};
export type ComissaoDashboard = { referencia_id: string | null; papel: string | null; valor_comissao: number; status: string };

const num = (v: any) => Number(v || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Mês (YYYY-MM) no fuso de São Paulo. */
const mesSP = (d: Date) => new Date(d.getTime() - 3 * 36e5).toISOString().slice(0, 7);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export function mrrDaVenda(v: Pick<VendaDashboard, 'categoria' | 'acrescimo_mensal' | 'mensalidade_anterior' | 'mensalidade_nova' | 'lojas_detalhe'>): number {
  if (v.categoria === 'TROCA_CNPJ' || v.categoria === 'SERVICO') return 0;
  if (v.categoria === 'COMUNICACAO' && Array.isArray(v.lojas_detalhe) && v.lojas_detalhe.length) {
    return r2(v.lojas_detalhe.reduce((s: number, l: any) => s + num(l?.acrescimo), 0));
  }
  if (num(v.acrescimo_mensal) > 0) return r2(num(v.acrescimo_mensal));
  if (v.mensalidade_anterior != null && v.mensalidade_nova != null) return r2(Math.max(0, num(v.mensalidade_nova) - num(v.mensalidade_anterior)));
  return 0;
}

export function montarDashboardCrossSell(vendasTodas: VendaDashboard[], comissoesTodas: ComissaoDashboard[], periodo: { inicio: Date; fim: Date }) {
  const vendas = vendasTodas
    .filter(v => v.status !== 'CANCELADO' && v.data >= periodo.inicio && v.data <= periodo.fim)
    .map(v => ({ ...v, tipo: v.categoria || 'OUTRO', receita_unica: r2(num(v.valor_venda)), mrr: mrrDaVenda(v), mes: mesSP(v.data) }));
  const ids = new Set(vendas.map(v => v.id));
  const comissoes = comissoesTodas.filter(c => c.referencia_id && ids.has(c.referencia_id) && c.status !== 'CANCELADA');

  const receita = r2(vendas.reduce((s, v) => s + v.receita_unica, 0));
  const mrr = r2(vendas.reduce((s, v) => s + v.mrr, 0));
  const totais = {
    vendas: vendas.length, receita_unica: receita, mrr_expansao: mrr, arr_expansao: r2(mrr * 12),
    ticket_medio: vendas.length ? r2(receita / vendas.length) : 0,
    clientes: new Set(vendas.map(v => v.cliente_codigo || v.cliente_nome || v.id)).size,
  };

  // Mês a mês: todos os meses do período, inclusive os vazios.
  const meses: { mes: string; rotulo: string; vendas: number; receita_unica: number; mrr: number; mrr_acumulado: number; por_tipo: Record<string, number> }[] = [];
  for (let m = mesSP(periodo.inicio); m <= mesSP(periodo.fim);) {
    const doMes = vendas.filter(v => v.mes === m);
    const por_tipo: Record<string, number> = {};
    for (const v of doMes) por_tipo[v.tipo] = (por_tipo[v.tipo] || 0) + 1;
    const mrrMes = r2(doMes.reduce((s, v) => s + v.mrr, 0));
    meses.push({ mes: m, rotulo: rotuloMes(m), vendas: doMes.length, receita_unica: r2(doMes.reduce((s, v) => s + v.receita_unica, 0)), mrr: mrrMes,
      mrr_acumulado: r2((meses.at(-1)?.mrr_acumulado || 0) + mrrMes), por_tipo });
    const [a, mm] = m.split('-').map(Number);
    m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`;
  }

  // Ranking por tipo: mais vendido primeiro (empate: maior receita única).
  const tipos = new Map<string, { tipo: string; rotulo: string; vendas: number; receita_unica: number; mrr: number }>();
  for (const v of vendas) {
    const t = tipos.get(v.tipo) || { tipo: v.tipo, rotulo: ROTULO_TIPO_CROSSSELL[v.tipo] || v.parceiro_nome || v.tipo, vendas: 0, receita_unica: 0, mrr: 0 };
    t.vendas++; t.receita_unica = r2(t.receita_unica + v.receita_unica); t.mrr = r2(t.mrr + v.mrr);
    tipos.set(v.tipo, t);
  }
  const por_tipo = [...tipos.values()].sort((a, b) => b.vendas - a.vendas || b.receita_unica - a.receita_unica);

  // Trimestres e destaques.
  const tri = new Map<string, { trimestre: string; vendas: number; receita_unica: number; mrr: number }>();
  for (const m of meses) {
    const k = `${Math.ceil(Number(m.mes.slice(5, 7)) / 3)}º tri/${m.mes.slice(2, 4)}`;
    const t = tri.get(k) || { trimestre: k, vendas: 0, receita_unica: 0, mrr: 0 };
    t.vendas += m.vendas; t.receita_unica = r2(t.receita_unica + m.receita_unica); t.mrr = r2(t.mrr + m.mrr);
    tri.set(k, t);
  }
  const trimestres = [...tri.values()];
  const maior = <T,>(lista: T[], f: (x: T) => number) => lista.reduce<T | null>((best, x) => (best == null || f(x) > f(best) ? x : best), null);
  const mVendas = maior(meses.filter(m => m.vendas), m => m.vendas);
  const mReceita = maior(meses.filter(m => m.receita_unica), m => m.receita_unica);
  const mMrr = maior(meses.filter(m => m.mrr), m => m.mrr);
  const tMelhor = maior(trimestres.filter(t => t.vendas), t => t.receita_unica + t.mrr * 12);
  const destaques = {
    melhor_mes_vendas: mVendas ? { mes: mVendas.mes, vendas: mVendas.vendas } : null,
    melhor_mes_receita: mReceita ? { mes: mReceita.mes, valor: mReceita.receita_unica } : null,
    melhor_mes_mrr: mMrr ? { mes: mMrr.mes, valor: mMrr.mrr } : null,
    melhor_trimestre: tMelhor?.trimestre || null,
    tipo_mais_vendido: por_tipo[0]?.tipo || null,
    tipo_maior_receita: maior(por_tipo.filter(t => t.receita_unica), t => t.receita_unica)?.tipo || null,
    tipo_maior_mrr: maior(por_tipo.filter(t => t.mrr), t => t.mrr)?.tipo || null,
  };

  // Vendedores (comissão de VENDEDOR) e totais de comissão (vendedor + supervisão).
  const vend = new Map<string, { vendedor_id: string; vendedor: string; vendas: number; receita_unica: number; mrr: number; comissao_total: number; comissao_paga: number; comissao_a_pagar: number }>();
  const vendaPorId = new Map(vendas.map(v => [v.id, v]));
  for (const v of vendas) {
    const x = vend.get(v.vendedor_id) || { vendedor_id: v.vendedor_id, vendedor: v.vendedor_nome || '—', vendas: 0, receita_unica: 0, mrr: 0, comissao_total: 0, comissao_paga: 0, comissao_a_pagar: 0 };
    x.vendas++; x.receita_unica = r2(x.receita_unica + v.receita_unica); x.mrr = r2(x.mrr + v.mrr);
    vend.set(v.vendedor_id, x);
  }
  for (const c of comissoes.filter(c => c.papel === 'VENDEDOR')) {
    const x = vend.get(vendaPorId.get(c.referencia_id!)!.vendedor_id)!;
    x.comissao_total = r2(x.comissao_total + num(c.valor_comissao));
    if (c.status === 'PAGA') x.comissao_paga = r2(x.comissao_paga + num(c.valor_comissao));
    else x.comissao_a_pagar = r2(x.comissao_a_pagar + num(c.valor_comissao));
  }
  const vendedores = [...vend.values()].sort((a, b) => (b.receita_unica + b.mrr * 12) - (a.receita_unica + a.mrr * 12));
  const soma = (f: (c: ComissaoDashboard) => boolean) => r2(comissoes.filter(f).reduce((s, c) => s + num(c.valor_comissao), 0));
  const comissoesTotais = {
    vendedor_total: soma(c => c.papel === 'VENDEDOR'), supervisao_total: soma(c => c.papel === 'SUPERVISAO'),
    pagas: soma(c => c.status === 'PAGA'), a_pagar: soma(c => c.status !== 'PAGA'),
  };

  const lista = [...vendas].sort((a, b) => b.data.getTime() - a.data.getTime()).map(v => ({
    id: v.id, data: v.data.toISOString(), codigo: v.cliente_codigo, cliente: v.cliente_nome, tipo: v.tipo,
    rotulo: ROTULO_TIPO_CROSSSELL[v.tipo] || v.parceiro_nome || v.tipo, descricao: v.descricao_servico || v.parceiro_nome,
    estrategia: ROTULO_ESTRATEGIA[estrategiaDe(v.tipo)],
    receita_unica: v.receita_unica, mrr: v.mrr, antes: v.mensalidade_anterior, depois: v.mensalidade_nova,
    vendedor: v.vendedor_nome, status: v.status,
  }));

  // Up-sell × cross-sell: mesmos números, agrupados pela estratégia do tipo de venda.
  const estrategias = (['UPSELL', 'CROSSSELL'] as const).map(e => {
    const vs = vendas.filter(v => estrategiaDe(v.tipo) === e);
    const rec = r2(vs.reduce((s, v) => s + v.receita_unica, 0)), m = r2(vs.reduce((s, v) => s + v.mrr, 0));
    return {
      estrategia: e, rotulo: ROTULO_ESTRATEGIA[e], explicacao: EXPLICA_ESTRATEGIA[e],
      vendas: vs.length, receita_unica: rec, mrr: m, arr: r2(m * 12),
      ticket_medio: vs.length ? r2(rec / vs.length) : 0,
      clientes: new Set(vs.map(v => v.cliente_codigo || v.cliente_nome || v.id)).size,
      pct_receita: receita ? Math.round((rec / receita) * 100) : 0,
      pct_mrr: mrr ? Math.round((m / mrr) * 100) : 0,
      tipos: por_tipo.filter(t => estrategiaDe(t.tipo) === e),
      meses: meses.map(x => {
        const doMes = vs.filter(v => v.mes === x.mes);
        return { mes: x.mes, rotulo: x.rotulo, vendas: doMes.length, receita_unica: r2(doMes.reduce((s, v) => s + v.receita_unica, 0)), mrr: r2(doMes.reduce((s, v) => s + v.mrr, 0)) };
      }),
    };
  });

  return { periodo: { inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() }, totais, meses, trimestres, por_tipo, destaques, vendedores, comissoes: comissoesTotais, lista, estrategias };
}
