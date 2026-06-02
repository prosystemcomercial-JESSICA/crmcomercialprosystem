import { PrismaClient } from '@prisma/client';

/**
 * Cálculo automático do REALIZADO de uma meta comercial, a partir dos
 * fechamentos reais do(s) responsável(is) no período.
 *
 * Fontes (somadas, sem chave comum entre si → não há dupla contagem):
 *   - Lead com status GANHO (fechamento_por, fechamento_data, fechamento_mrr, fechamento_valor_inst)
 *   - PropostaComercial em status de fechada (vendedor_id/created_by, data_fechamento|data_aceite,
 *     mensalidade conforme plano, valor_implantacao)
 *
 * Modo da meta:
 *   - INDIVIDUAL: realizado de cada responsável (somado p/ exibição agregada do card,
 *     mas a base é por pessoa — o card mostra o total dos responsáveis da meta).
 *   - EQUIPE: soma de todos os responsáveis.
 * Em ambos os casos consideramos o conjunto de responsaveis_ids da meta.
 */

export interface MetaRealizado {
  contratos: number;
  valor_total: number;     // setup (instalação) fechado + (poderia incluir MRR; usamos instalação como "valor")
  mrr_total: number;
  preco_medio_inst: number;
  preco_medio_mensal: number;
}

const PROP_FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];

interface PeriodoRange { inicio: Date; fim: Date; }

/** Resolve o intervalo de datas da meta a partir de periodo_tipo + campos. */
export function resolverPeriodo(meta: any): PeriodoRange {
  const pt = meta.periodo_tipo;
  if (pt === 'PERIODO' && meta.data_inicio && meta.data_fim) {
    return { inicio: new Date(meta.data_inicio), fim: new Date(meta.data_fim) };
  }
  if (pt === 'ANUAL') {
    const ano = parseInt(String(meta.periodo || '').slice(0, 4)) || new Date().getFullYear();
    return { inicio: new Date(ano, 0, 1), fim: new Date(ano, 11, 31, 23, 59, 59) };
  }
  // MENSAL (default): periodo = "YYYY-MM"
  const m = String(meta.periodo || '').match(/^(\d{4})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1]); const mo = parseInt(m[2]) - 1;
    return { inicio: new Date(y, mo, 1), fim: new Date(y, mo + 1, 0, 23, 59, 59) };
  }
  // fallback: mês corrente
  const now = new Date();
  return { inicio: new Date(now.getFullYear(), now.getMonth(), 1), fim: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
}

export async function calcularRealizadoMeta(prisma: PrismaClient, meta: any): Promise<MetaRealizado> {
  const responsaveis: string[] = (Array.isArray(meta.responsaveis_ids) && meta.responsaveis_ids.length)
    ? meta.responsaveis_ids
    : (meta.responsavel_id ? [meta.responsavel_id] : []);
  if (!responsaveis.length) return zero();

  const { inicio, fim } = resolverPeriodo(meta);

  // 1) Leads fechados (GANHO) pelos responsáveis no período
  const leads = await prisma.lead.findMany({
    where: {
      status: 'GANHO',
      fechamento_data: { gte: inicio, lte: fim },
      OR: [
        { fechamento_por: { in: responsaveis } },
        { responsavel_id: { in: responsaveis } },
      ],
    },
    select: { fechamento_mrr: true, fechamento_valor_inst: true },
  }).catch(() => [] as any[]);

  // 2) Propostas comerciais fechadas pelos responsáveis no período
  const props = await prisma.propostaComercial.findMany({
    where: {
      status: { in: PROP_FECHADA },
      OR: [
        { vendedor_id: { in: responsaveis } },
        { created_by: { in: responsaveis } },
      ],
    },
    select: {
      valor_implantacao: true, valor_final: true,
      mensalidade_pro: true, mensalidade_plus: true, plano_selecionado: true,
      data_fechamento: true, data_aceite: true,
    },
  }).catch(() => [] as any[]);

  const propsNoPeriodo = props.filter((p: any) => {
    const d = p.data_fechamento || p.data_aceite;
    if (!d) return false;
    const dt = new Date(d);
    return dt >= inicio && dt <= fim;
  });

  const instVals: number[] = [];
  const mensalVals: number[] = [];
  let contratos = 0, mrrTotal = 0, valorTotal = 0;

  for (const l of leads) {
    contratos += 1;
    const inst = Number(l.fechamento_valor_inst || 0);
    const mrr  = Number(l.fechamento_mrr || 0);
    valorTotal += inst; mrrTotal += mrr;
    if (inst > 0) instVals.push(inst);
    if (mrr > 0) mensalVals.push(mrr);
  }
  for (const p of propsNoPeriodo) {
    contratos += 1;
    const inst = Number(p.valor_implantacao ?? p.valor_final ?? 0);
    const mensal = p.plano_selecionado === 'PRO'
      ? Number(p.mensalidade_pro || 0)
      : Number(p.mensalidade_plus || p.mensalidade_pro || 0);
    valorTotal += inst; mrrTotal += mensal;
    if (inst > 0) instVals.push(inst);
    if (mensal > 0) mensalVals.push(mensal);
  }

  const media = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 100) / 100 : 0;

  return {
    contratos,
    valor_total: Math.round(valorTotal * 100) / 100,
    mrr_total: Math.round(mrrTotal * 100) / 100,
    preco_medio_inst: media(instVals),
    preco_medio_mensal: media(mensalVals),
  };
}

function zero(): MetaRealizado {
  return { contratos: 0, valor_total: 0, mrr_total: 0, preco_medio_inst: 0, preco_medio_mensal: 0 };
}
