import { PrismaClient } from '@prisma/client';

/**
 * Cálculo automático do REALIZADO de uma meta comercial.
 *
 * REGRA (jun/2026): a venda só é contabilizada na meta APÓS o contrato ASSINADO.
 * Logo, a fonte de verdade é o ContratoComercial com status 'ASSINADO' (signed_at no
 * período). Contratos RECUADOS/CANCELADOS não contam. Propostas apenas aceitas (sem
 * contrato assinado) e leads GANHO NÃO entram mais no realizado.
 *
 * Modo da meta:
 *   - INDIVIDUAL: realizado de cada responsável (card mostra o total dos responsáveis).
 *   - EQUIPE: soma de todos os responsáveis.
 */

export interface MetaRealizado {
  contratos: number;
  valor_total: number;     // setup (instalação) assinado
  mrr_total: number;       // mensalidade dos contratos assinados
  preco_medio_inst: number;
  preco_medio_mensal: number;
}

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

  // Contratos ASSINADOS pelos responsáveis no período (signed_at). Para casar o
  // contrato ao responsável, usamos vendedor_id; como fallback (contratos antigos
  // sem vendedor_id) usamos o created_by da proposta de origem.
  const propsDoResp = await prisma.propostaComercial.findMany({
    where: { OR: [{ vendedor_id: { in: responsaveis } }, { created_by: { in: responsaveis } }] },
    select: { id: true },
  }).catch(() => [] as any[]);
  const propIdsDoResp = propsDoResp.map((p: any) => p.id);

  const contratosAssinados = await prisma.contratoComercial.findMany({
    where: {
      status: 'ASSINADO',
      signed_at: { gte: inicio, lte: fim },
      OR: [
        { vendedor_id: { in: responsaveis } },
        ...(propIdsDoResp.length ? [{ proposta_comercial_id: { in: propIdsDoResp } }] : []),
      ],
    },
    select: { valor_setup_total: true, mensalidade: true },
  }).catch(() => [] as any[]);

  const instVals: number[] = [];
  const mensalVals: number[] = [];
  let contratos = 0, mrrTotal = 0, valorTotal = 0;

  for (const c of contratosAssinados) {
    contratos += 1;
    const inst = Number(c.valor_setup_total || 0);
    const mrr  = Number(c.mensalidade || 0);
    valorTotal += inst; mrrTotal += mrr;
    if (inst > 0) instVals.push(inst);
    if (mrr > 0) mensalVals.push(mrr);
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
