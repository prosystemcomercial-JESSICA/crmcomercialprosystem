import { PrismaClient } from '@prisma/client';

/**
 * Cálculo automático do REALIZADO de uma meta comercial.
 *
 * FONTE ÚNICA (unificada com Relatório CEO / Ranking): PropostaComercial com status
 * CONTRATO_ASSINADO e data_aceite no período (fallback created_at quando sem aceite).
 * É a MESMA fonte usada no resto do sistema — assim a meta bate com o relatório e o
 * ranking. (Antes a meta lia ContratoComercial.signed_at, que só existe p/ contratos
 * gerados pelo painel ZapSign; os fechamentos/retroativos lançados como proposta não
 * geram ContratoComercial e por isso a meta ficava zerada.)
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

  // `todos: true` → total da EQUIPE: conta TODO fechamento do período, não importa
  // quem lançou (vendedor, supervisão ou diretoria). Sem isso o total da equipe era
  // a soma de uma lista de ids filtrada por cargo=VENDEDOR, e os fechamentos lançados
  // pela supervisão sumiam do gráfico (era o caso de julho/2026).
  const todos = meta.todos === true;
  if (!todos && !responsaveis.length) return zero();

  const { inicio, fim } = resolverPeriodo(meta);

  // Fechamentos = PropostaComercial CONTRATO_ASSINADO com data_aceite no período
  // (fallback created_at quando sem aceite). Casa o fechamento ao responsável por
  // vendedor_id OU created_by (lançamentos pela conta da Diretora também contam).
  const STATUS_FECHADA = ['CONTRATO_ASSINADO', 'ASSINADO', 'ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];
  const fechamentos = await prisma.propostaComercial.findMany({
    where: {
      status: { in: STATUS_FECHADA },
      deleted_at: null as any,
      ...(todos ? {} : {
        OR: [
          { vendedor_id: { in: responsaveis } },
          { created_by: { in: responsaveis } },
        ],
      }),
      AND: [{
        OR: [
          { data_aceite: { gte: inicio, lte: fim } },
          { AND: [{ data_aceite: null }, { created_at: { gte: inicio, lte: fim } }] },
        ],
      }],
    },
    select: { valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
  }).catch(() => [] as any[]);

  const instVals: number[] = [];
  const mensalVals: number[] = [];
  let contratos = 0, mrrTotal = 0, valorTotal = 0;

  for (const c of fechamentos) {
    contratos += 1;
    const inst = Number(c.valor_implantacao ?? c.valor_final ?? 0);
    const mrr  = Number(c.mensalidade_plus ?? c.mensalidade_pro ?? 0);
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
