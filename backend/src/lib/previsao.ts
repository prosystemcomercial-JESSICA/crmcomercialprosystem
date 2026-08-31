// Lógica de previsão de fechamento (pipeline ponderado por probabilidade de
// etapa) — extraída de complementos.ts para ser testável isoladamente e para
// usar a MESMA fórmula de valorOportunidade() de forecast.ts/analise-comercial.ts.
// Antes desta unificação, /leads/previsao usava valor_estimado puro; as outras
// duas rotas usavam valor_setup + mensalidade_estimada×12. Números divergiam.

import { PrismaClient } from '@prisma/client';
import { probabilidadeEtapa, PROB_ETAPA } from './forecast';

export interface ResumoPrevisao {
  otimista: number;
  realista: number;
  pessimista: number;
  total_oportunidades: number;
  valor_total_pipeline: number;
}

export interface OportunidadePrevisao {
  id: string;
  nome: string;
  empresa: string | null;
  valor_estimado: number;
  probabilidade: number;
  valor_ponderado: number;
  etapa: string | null;
  status: string;
}

export interface ResultadoPrevisao {
  previsao: ResumoPrevisao;
  top_oportunidades: OportunidadePrevisao[];
  total_oportunidades: number;
  valor_total_pipeline: number;
}

// Mesma função de backend/src/routes/forecast.ts e analise-comercial.ts —
// valor anualizado da oportunidade: setup + 12 mensalidades, com fallback
// para valor_estimado quando setup+mensalidade não está preenchido.
export function valorOportunidade(l: { valor_setup: number | null; valor_estimado: number | null; mensalidade_estimada: number | null }): number {
  const setup = l.valor_setup ?? 0;
  const anual = (l.mensalidade_estimada ?? 0) * 12;
  const calc = setup + anual;
  return calc > 0 ? calc : (l.valor_estimado ?? 0);
}

export async function calcularPrevisao(
  prisma: PrismaClient,
  opts: { dias: number; ownerFilter: Record<string, any> }
): Promise<ResultadoPrevisao> {
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['PERDIDO'] },
      etapa_comercial: { in: Object.keys(PROB_ETAPA) },
      ...opts.ownerFilter,
    },
    select: {
      id: true, nome: true, empresa: true, status: true,
      etapa_comercial: true, valor_setup: true, valor_estimado: true, mensalidade_estimada: true,
    },
  });

  const previsao: ResumoPrevisao = {
    otimista: 0,
    realista: 0,
    pessimista: 0,
    total_oportunidades: leads.length,
    valor_total_pipeline: 0,
  };

  const oportunidades: OportunidadePrevisao[] = leads.map(l => {
    const valor = valorOportunidade(l);
    const prob = probabilidadeEtapa(l.etapa_comercial);
    previsao.valor_total_pipeline += valor;
    previsao.otimista += valor;
    previsao.realista += valor * prob;
    if (prob >= 0.7) previsao.pessimista += valor * prob;
    return {
      id: l.id,
      nome: l.nome,
      empresa: l.empresa,
      valor_estimado: valor,
      probabilidade: Math.round(prob * 100),
      valor_ponderado: Math.round(valor * prob),
      etapa: l.etapa_comercial,
      status: l.status,
    };
  });

  oportunidades.sort((a, b) => b.valor_ponderado - a.valor_ponderado);

  return {
    previsao: {
      otimista: Math.round(previsao.otimista),
      realista: Math.round(previsao.realista),
      pessimista: Math.round(previsao.pessimista),
      total_oportunidades: previsao.total_oportunidades,
      valor_total_pipeline: Math.round(previsao.valor_total_pipeline),
    },
    top_oportunidades: oportunidades.slice(0, 10),
    total_oportunidades: leads.length,
    valor_total_pipeline: Math.round(previsao.valor_total_pipeline),
  };
}
