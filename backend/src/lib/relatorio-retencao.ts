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
