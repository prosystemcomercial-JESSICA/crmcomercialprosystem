// Relatório de Retenção: ranking dos motivos de saída e LTV por cliente.
// Os motivos chegam em texto livre (casos de churn e "motivo de inativação" do cliente);
// categoriaSaida agrupa as variações ("Fechamento da loja", "Cliente fechou a loja.") numa categoria.

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ordem importa: a primeira regra que casar decide (ex.: contabilidade antes de "erros"; preço antes de "trocou de sistema"). */
const REGRAS: [RegExp, string][] = [
  [/troca de cnpj/, 'Troca de CNPJ (continua cliente)'],
  [/nao chegou a aderir|nao chegou a usar|nunca usou/, 'Não chegou a usar'],
  [/contabil/, 'Indicação da contabilidade'],
  [/inadimpl|nao pag|debito|divida/, 'Inadimplência'],
  [/deixou de usar|nao entrou em contato/, 'Deixou de usar sem avisar'],
  [/vendid|novo dono|nova dire|nova gest|mudou de dono/, 'Loja vendida / nova gestão'],
  [/rede|procfit|preco baixo|hiper ?farma|mesmo socio|grupo|franquia/, 'Migração de rede / grupo'],
  [/fech|encerr|baixa no cnpj|faliu|falencia/, 'Fechou a loja / encerrou'],
  [/barat|caro\b|preco|valor da mensal|custo/, 'Preço'],
  [/suporte|atendimento/, 'Suporte / atendimento'],
  [/erro|adapt|dificuldade|bug|lent/, 'Erros / adaptação ao sistema'],
  [/troca de sistema|outro sistema|novo sistema|func|especializad|ramo|voltado|melhoria|aplicativo|inovafarma|concorr|migr/, 'Trocou de sistema (funções)'],
  [/nao (expos|informou|soube|quis)|sem motivo|nao disse|^\(.*\)$|^$/, 'Não informou o motivo'],
];

export function categoriaSaida(texto: string | null | undefined): string {
  const t = sem((texto || '').trim()).replace(/^outro:\s*/, '');
  if (!t) return 'Não informou o motivo';
  for (const [re, cat] of REGRAS) if (re.test(t)) return cat;
  return 'Outros';
}

export type Saida = { origem: 'CASO' | 'BASE'; texto: string | null; resultado: 'PERDIDO' | 'RECUPERADO'; mrr: number };

/** Ranking por categoria: saídas (perdidos), % do total, MRR perdido, recuperados (casos), origem e exemplos reais. */
export function montarRankingSaida(linhas: Saida[]) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const cats = new Map<string, { categoria: string; saidas: number; recuperados: number; mrr_perdido: number; casos: number; base: number; textos: Map<string, number> }>();
  for (const l of linhas) {
    const c = categoriaSaida(l.texto);
    const x = cats.get(c) || { categoria: c, saidas: 0, recuperados: 0, mrr_perdido: 0, casos: 0, base: 0, textos: new Map() };
    if (l.resultado === 'RECUPERADO') x.recuperados++;
    else {
      x.saidas++; x.mrr_perdido = r2(x.mrr_perdido + (Number(l.mrr) || 0));
      if (l.origem === 'CASO') x.casos++; else x.base++;
      const txt = (l.texto || '').trim().replace(/^Outro:\s*/i, '');
      if (txt && !/^\(.*\)$/.test(txt)) x.textos.set(txt, (x.textos.get(txt) || 0) + 1);
    }
    cats.set(c, x);
  }
  const total = [...cats.values()].reduce((s, x) => s + x.saidas, 0);
  const ranking = [...cats.values()].filter(x => x.saidas || x.recuperados)
    .sort((a, b) => b.saidas - a.saidas || b.mrr_perdido - a.mrr_perdido)
    .map(({ textos, ...x }) => ({
      ...x,
      pct: total ? Math.round((x.saidas / total) * 100) : 0,
      taxa_recuperacao: x.saidas + x.recuperados ? Math.round((x.recuperados / (x.saidas + x.recuperados)) * 100) : null,
      exemplos: [...textos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t.slice(0, 160)),
    }));
  return { total_saidas: total, mrr_perdido_total: r2(ranking.reduce((s, x) => s + x.mrr_perdido, 0)), ranking };
}

// ─── LTV por cliente (realizado: o que o cliente já pagou) ─────────────────────
// Mesma fórmula da tela LTV: mensalidade_base × meses de casa + instalação
// + vendas adicionais confirmadas (setup + acréscimo × meses desde a venda). Inativo conta até a saída.
const mesesEntre = (inicio: Date, fim: Date) => Math.max(0, (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()));

export function ltvDoCliente(
  c: { data_entrada: Date | null; inativado_em: Date | null; mensalidade_base: number | null; valor_instalacao: number | null },
  vendas: { valor_venda: number | null; acrescimo_mensal: number | null; data_venda: Date | null }[],
  agora = new Date(),
) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const fim = c.inativado_em ? new Date(c.inativado_em) : agora;
  const meses = c.data_entrada ? mesesEntre(new Date(c.data_entrada), fim) : 0;
  const mensalidades = r2((c.mensalidade_base || 0) * meses);
  const instalacao = r2(c.valor_instalacao || 0);
  const adicionais = r2(vendas.reduce((s, v) => s + (v.valor_venda || 0) + (v.acrescimo_mensal || 0) * (v.data_venda ? mesesEntre(new Date(v.data_venda), fim) : 0), 0));
  const ltv = r2(mensalidades + instalacao + adicionais);
  return { meses_de_casa: meses, receita_mensalidades: mensalidades, instalacao, receita_adicionais: adicionais, vendas_adicionais: vendas.length, ltv, ltv_por_mes: meses ? r2(ltv / meses) : null, sem_data_entrada: !c.data_entrada };
}

export const FAIXAS_TEMPO = ['Até 6 meses', '6 a 12 meses', '1 a 2 anos', '2 a 5 anos', '5 a 10 anos', 'Mais de 10 anos'] as const;
export function faixaTempoDeCasa(meses: number): string {
  return meses < 6 ? FAIXAS_TEMPO[0] : meses < 12 ? FAIXAS_TEMPO[1] : meses < 24 ? FAIXAS_TEMPO[2] : meses < 60 ? FAIXAS_TEMPO[3] : meses < 120 ? FAIXAS_TEMPO[4] : FAIXAS_TEMPO[5];
}

/** Segmento do cliente: o cadastrado; se vazio, deduzido do nome (farmácia/drogaria, padaria/panificadora). */
export function segmentoDoCliente(segmento: string | null | undefined, ...nomes: (string | null | undefined)[]): string {
  if (segmento && segmento.trim()) return segmento.trim();
  const t = sem(nomes.filter(Boolean).join(' '));
  if (/farm|drog|manipul|botica/.test(t)) return 'Farmácia';
  if (/padar|panific|confeit|pao|paes|trigo|bakery/.test(t)) return 'Padaria';
  return 'Outros varejos';
}

// ─── Quem saiu, ano a ano (painel de LTV) ──────────────────────────────────────
// Ano com saídas datadas no CRM: cliente a cliente (tempo ativo, LTV, motivos, mês).
// Ano sem saídas datadas mas com balanço importado (ResultadoAnualHistorico): só os totais.
type InativoLtv = { id: string; codigo: string | null; nome: string; segmento: string; data_entrada: Date | null; inativado_em: Date | null; mensalidade: number; mrr_perdido: number | null; motivo: string | null; ltv: number };
type Balanco = { ano: number; contratos_encerrados: number | null; churn_valor_mensal: number | null; motivos_saida: any; saida_por_segmento: any };

export function montarSaidasPorAno(inativos: InativoLtv[], historico: Balanco[], agora = new Date()) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const anoSP = (d: Date) => Number(new Date(d.getTime() - 3 * 36e5).toISOString().slice(0, 4));
  const mesSP = (d: Date) => Number(new Date(d.getTime() - 3 * 36e5).toISOString().slice(5, 7)) - 1;
  const conta = (xs: string[]) => [...xs.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const datados = inativos.filter(c => c.inativado_em);
  const clientes = datados.map(c => ({
    ...c, ano_saida: anoSP(c.inativado_em!), mes_saida: mesSP(c.inativado_em!),
    tempo_ativo_meses: c.data_entrada ? mesesEntre(new Date(c.data_entrada), new Date(c.inativado_em!)) : null,
    mrr: Number(c.mrr_perdido || c.mensalidade || 0), motivo_categoria: categoriaSaida(c.motivo),
  })).sort((a, b) => b.inativado_em!.getTime() - a.inativado_em!.getTime());

  const anosCrm = new Set(clientes.map(c => c.ano_saida));
  const anosBal = historico.filter(h => !anosCrm.has(h.ano)).map(h => h.ano);
  const anos = [...anosCrm, ...anosBal].sort((a, b) => b - a).map(ano => {
    if (anosCrm.has(ano)) {
      const xs = clientes.filter(c => c.ano_saida === ano);
      const comTempo = xs.filter(c => c.tempo_ativo_meses != null);
      const meses = Array(12).fill(0) as number[];
      for (const c of xs) meses[c.mes_saida]++;
      return {
        ano, fonte: 'CRM' as const, saidas: xs.length, mrr_perdido: r2(xs.reduce((s, c) => s + c.mrr, 0)),
        tempo_medio_meses: comTempo.length ? Math.round((comTempo.reduce((s, c) => s + c.tempo_ativo_meses!, 0) / comTempo.length) * 10) / 10 : null,
        ltv_medio: xs.length ? r2(xs.reduce((s, c) => s + c.ltv, 0) / xs.length) : null, ltv_total: r2(xs.reduce((s, c) => s + c.ltv, 0)),
        motivos: conta(xs.map(c => c.motivo_categoria)).map(([motivo, qtd]) => ({ motivo, qtd })),
        por_segmento: conta(xs.map(c => c.segmento)).map(([segmento, qtd]) => ({ segmento, qtd })),
        meses, observacao: null as string | null,
      };
    }
    const h = historico.find(x => x.ano === ano)!;
    const lista = (v: any, k: string) => (Array.isArray(v) ? v : []).map((x: any) => ({ [k]: String(x[k] ?? x.motivo ?? x.segmento ?? ''), qtd: Number(x.quantidade || 0) }));
    return {
      ano, fonte: 'BALANCO' as const, saidas: Number(h.contratos_encerrados || 0), mrr_perdido: r2(Number(h.churn_valor_mensal || 0)),
      tempo_medio_meses: null, ltv_medio: null, ltv_total: null,
      motivos: lista(h.motivos_saida, 'motivo') as { motivo: string; qtd: number }[], por_segmento: lista(h.saida_por_segmento, 'segmento') as { segmento: string; qtd: number }[],
      meses: null, observacao: 'Só os totais do balanço anual importado; o CRM não tem a lista de clientes que saíram neste ano.',
    };
  });

  const anoAtual = anoSP(agora);
  const atual = anos.find(a => a.ano === anoAtual), anterior = anos.find(a => a.ano === anoAtual - 1);
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const comparativo = atual && anterior ? {
    atual: atual.ano, anterior: anterior.ano, saidas: [atual.saidas, anterior.saidas], var_saidas_pct: pct(atual.saidas, anterior.saidas),
    mrr: [atual.mrr_perdido, anterior.mrr_perdido], var_mrr_pct: pct(atual.mrr_perdido, anterior.mrr_perdido), parcial_atual: true,
  } : null;
  return { anos, comparativo, clientes, sem_data: inativos.length - datados.length };
}
