// Relatório de Retenção (Supervisão Comercial e CEO): ranking dos motivos de saída
// (casos de churn + motivo de inativação da base) e LTV completo de cada cliente.
import { PrismaClient } from '@prisma/client';
import { categoriaSaida, faixaTempoDeCasa, FAIXAS_TEMPO, ltvDoCliente, montarRankingSaida, segmentoDoCliente, type Saida } from '@/lib/relatorio-retencao';

const PERDA = ['PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO'];
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function montarRelatorioRetencao(prisma: PrismaClient, agora = new Date()) {
  const [clientes, vendas, casos] = await Promise.all([
    prisma.cliente.findMany({
      select: {
        id: true, codigo: true, nome: true, razao_social: true, nome_fantasia: true, segmento: true, cidade: true, estado: true, plano: true,
        situacao: true, data_entrada: true, inativado_em: true, mensalidade_base: true, valor_instalacao: true, mrr_perdido: true, motivo_inativacao: true,
      },
    }),
    prisma.vendaAdicional.findMany({ where: { status: { in: ['CONFIRMADA', 'PAGA'] } }, select: { cliente_id: true, valor_venda: true, acrescimo_mensal: true, data_venda: true, created_at: true } }),
    prisma.casoChurn.findMany({ select: { clienteId: true, status: true, motivo_principal: true } }),
  ]);
  const porId = new Map(clientes.map(c => [c.id, c]));
  const mrrDe = (c: any) => Number(c?.mrr_perdido || c?.mensalidade_base || 0);

  // ── Motivos de saída ──
  const comCasoPerdido = new Set(casos.filter(c => PERDA.includes(c.status)).map(c => c.clienteId));
  const saidas: Saida[] = [];
  for (const c of casos) {
    if (PERDA.includes(c.status)) saidas.push({ origem: 'CASO', texto: c.motivo_principal, resultado: 'PERDIDO', mrr: mrrDe(porId.get(c.clienteId)) });
    else if (c.status === 'RECUPERADO') saidas.push({ origem: 'CASO', texto: c.motivo_principal, resultado: 'RECUPERADO', mrr: 0 });
  }
  // Base histórica: cliente inativo sem caso de churn perdido (para não contar duas vezes).
  for (const c of clientes) if (c.situacao === 'INATIVA' && !comCasoPerdido.has(c.id)) saidas.push({ origem: 'BASE', texto: c.motivo_inativacao, resultado: 'PERDIDO', mrr: mrrDe(c) });
  const ranking = {
    todos: montarRankingSaida(saidas),
    casos: montarRankingSaida(saidas.filter(s => s.origem === 'CASO')),
    base: montarRankingSaida(saidas.filter(s => s.origem === 'BASE')),
  };

  // ── LTV por cliente ──
  const vendasPor = new Map<string, { valor_venda: number | null; acrescimo_mensal: number | null; data_venda: Date | null }[]>();
  for (const v of vendas) {
    const l = vendasPor.get(v.cliente_id) || [];
    l.push({ valor_venda: v.valor_venda, acrescimo_mensal: v.acrescimo_mensal, data_venda: v.data_venda || v.created_at });
    vendasPor.set(v.cliente_id, l);
  }
  const linhas = clientes.map(c => {
    const l = ltvDoCliente(c, vendasPor.get(c.id) || [], agora);
    return {
      id: c.id, codigo: c.codigo, nome: (c.nome_fantasia || c.razao_social || c.nome || '').trim(), razao_social: c.razao_social,
      segmento: segmentoDoCliente(c.segmento, c.nome_fantasia, c.razao_social, c.nome), cidade: [c.cidade, c.estado].filter(Boolean).join('/') || null, plano: c.plano, situacao: c.situacao,
      data_entrada: c.data_entrada, inativado_em: c.inativado_em, mensalidade: Number(c.mensalidade_base || 0), ...l,
      motivo_saida: c.situacao === 'INATIVA' ? categoriaSaida(c.motivo_inativacao) : null,
      motivo_texto: c.situacao === 'INATIVA' ? (c.motivo_inativacao || null) : null,
    };
  }).sort((a, b) => b.ltv - a.ltv);

  // Resumo: ativos (sem o código 1, a própria Prosystem) e o que falta de dado.
  const ativos = linhas.filter(c => c.situacao === 'ATIVA' && c.codigo !== '1');
  const ativosComData = ativos.filter(c => !c.sem_data_entrada);
  const inativos = linhas.filter(c => c.situacao === 'INATIVA');
  const soma = (xs: typeof linhas, f: (x: (typeof linhas)[number]) => number) => r2(xs.reduce((s, x) => s + f(x), 0));
  const resumo = {
    ativos: ativos.length,
    ltv_total_ativos: soma(ativos, x => x.ltv),
    ltv_medio_ativos: ativos.length ? r2(soma(ativos, x => x.ltv) / ativos.length) : 0,
    mrr_ativos: soma(ativos, x => x.mensalidade),
    ticket_medio: ativos.length ? r2(soma(ativos, x => x.mensalidade) / ativos.length) : 0,
    tempo_medio_meses: ativosComData.length ? Math.round((ativosComData.reduce((s, x) => s + x.meses_de_casa, 0) / ativosComData.length) * 10) / 10 : 0,
    receita_adicionais_total: soma(linhas, x => x.receita_adicionais),
    inativos: inativos.length,
    inativos_sem_data: inativos.filter(c => c.sem_data_entrada || !c.inativado_em).length,
    ativos_sem_data: ativos.length - ativosComData.length,
  };
  const faixas = FAIXAS_TEMPO.map(f => {
    const xs = ativosComData.filter(c => faixaTempoDeCasa(c.meses_de_casa) === f);
    return { faixa: f, clientes: xs.length, ltv_medio: xs.length ? r2(soma(xs, x => x.ltv) / xs.length) : 0, mensalidade_media: xs.length ? r2(soma(xs, x => x.mensalidade) / xs.length) : 0 };
  });
  const segs = new Map<string, { segmento: string; ativos: number; ltv_total: number; mrr: number }>();
  for (const c of ativos) {
    const k = c.segmento || 'Sem segmento';
    const x = segs.get(k) || { segmento: k, ativos: 0, ltv_total: 0, mrr: 0 };
    x.ativos++; x.ltv_total = r2(x.ltv_total + c.ltv); x.mrr = r2(x.mrr + c.mensalidade);
    segs.set(k, x);
  }
  const por_segmento = [...segs.values()].map(s => ({ ...s, ltv_medio: s.ativos ? r2(s.ltv_total / s.ativos) : 0 })).sort((a, b) => b.ltv_total - a.ltv_total);

  return { gerado_em: agora.toISOString(), ranking, ltv: { resumo, faixas, por_segmento, clientes: linhas } };
}
