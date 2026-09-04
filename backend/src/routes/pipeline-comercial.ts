import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { effectiveScopeId, ownerWhereId } from '@/lib/scope';
import { PROB_ETAPA } from '@/lib/forecast';

// Pipeline Comercial (módulo 2 do Cockpit Executivo do CEO): detalhamento do
// pipeline em aberto por etapa e por vendedor, com idade das oportunidades e
// destaque das que estão paradas. Mesmas etapas/probabilidades usadas em
// analise-comercial.ts e forecast.ts — mantém o funil consistente entre telas.
const ETAPAS_FUNIL = [
  'NOVO_LEAD', 'PRIMEIRO_CONTATO', 'EM_ATENDIMENTO', 'AGUARDANDO_RETORNO',
  'PROPOSTA_A_GERAR', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'ACEITO',
  'CONTRATO_EM_ANDAMENTO',
];
const ETAPA_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato', EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_RETORNO: 'Aguardando Retorno', PROPOSTA_A_GERAR: 'Proposta a Gerar',
  PROPOSTA_ENVIADA: 'Proposta Enviada', EM_NEGOCIACAO: 'Em Negociação', ACEITO: 'Aceito',
  CONTRATO_EM_ANDAMENTO: 'Contrato em Andamento',
};

function valorOportunidade(l: { valor_setup: number | null; valor_estimado: number | null; mensalidade_estimada: number | null }): number {
  const setup = l.valor_setup ?? 0;
  const anual = (l.mensalidade_estimada ?? 0) * 12;
  const calc = setup + anual;
  return calc > 0 ? calc : (l.valor_estimado ?? 0);
}

export async function pipelineComercialRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/pipeline-comercial', async (request, reply) => {
    const scopeId = effectiveScopeId(request);

    const leads = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        etapa_comercial: { in: ETAPAS_FUNIL },
        status: { notIn: ['PERDIDO'] },
        ...ownerWhereId('Lead', scopeId),
      },
      select: {
        id: true, nome: true, etapa_comercial: true, temperatura: true,
        valor_setup: true, valor_estimado: true, mensalidade_estimada: true,
        responsavel_id: true, responsavel_nome: true, updated_at: true, created_at: true,
      },
      take: 5000,
    }).catch(() => [] as any[]);

    const agora = Date.now();
    const d30 = 30 * 24 * 60 * 60 * 1000;

    // ── Por etapa: quantidade, valor bruto, valor ponderado, idade média ──
    const porEtapa = ETAPAS_FUNIL.map(etapa => {
      const doGrupo = leads.filter(l => l.etapa_comercial === etapa);
      const valorBruto = doGrupo.reduce((s, l) => s + valorOportunidade(l), 0);
      const valorPonderado = valorBruto * (PROB_ETAPA[etapa] || 0);
      const idadeMediaDias = doGrupo.length
        ? Math.round(doGrupo.reduce((s, l) => s + (agora - new Date(l.updated_at).getTime()), 0) / doGrupo.length / 86_400_000)
        : 0;
      const paradas = doGrupo.filter(l => agora - new Date(l.updated_at).getTime() > d30).length;
      return {
        etapa, label: ETAPA_LABEL[etapa],
        qtd: doGrupo.length,
        valor_bruto: Math.round(valorBruto),
        valor_ponderado: Math.round(valorPonderado),
        idade_media_dias: idadeMediaDias,
        paradas_30_dias: paradas,
      };
    });

    // ── Por vendedor: quantidade, valor bruto, valor ponderado ──
    const porVendedorMap: Record<string, { nome: string; qtd: number; valorBruto: number; valorPonderado: number }> = {};
    for (const l of leads) {
      const id = l.responsavel_id || 'sem_responsavel';
      if (!porVendedorMap[id]) porVendedorMap[id] = { nome: l.responsavel_nome || 'Sem responsável', qtd: 0, valorBruto: 0, valorPonderado: 0 };
      const valor = valorOportunidade(l);
      porVendedorMap[id].qtd++;
      porVendedorMap[id].valorBruto += valor;
      porVendedorMap[id].valorPonderado += valor * (PROB_ETAPA[l.etapa_comercial] || 0);
    }
    const porVendedor = Object.entries(porVendedorMap)
      .map(([vendedor_id, v]) => ({
        vendedor_id, vendedor_nome: v.nome, qtd: v.qtd,
        valor_bruto: Math.round(v.valorBruto), valor_ponderado: Math.round(v.valorPonderado),
      }))
      .sort((a, b) => b.valor_bruto - a.valor_bruto);

    // ── Oportunidades paradas (30+ dias sem atualização) — lista para ação direta ──
    const oportunidadesParadas = leads
      .filter(l => agora - new Date(l.updated_at).getTime() > d30)
      .map(l => ({
        lead_id: l.id, nome: l.nome, etapa: l.etapa_comercial, etapa_label: ETAPA_LABEL[l.etapa_comercial],
        vendedor_nome: l.responsavel_nome || 'Sem responsável',
        valor_estimado: Math.round(valorOportunidade(l)),
        dias_parado: Math.round((agora - new Date(l.updated_at).getTime()) / 86_400_000),
      }))
      .sort((a, b) => b.dias_parado - a.dias_parado)
      .slice(0, 50);

    const totalBruto = leads.reduce((s, l) => s + valorOportunidade(l), 0);
    const totalPonderado = leads.reduce((s, l) => s + valorOportunidade(l) * (PROB_ETAPA[l.etapa_comercial] || 0), 0);

    return reply.send({
      status: 'success',
      data: {
        total_oportunidades: leads.length,
        pipeline_valor_bruto: Math.round(totalBruto),
        pipeline_valor_ponderado: Math.round(totalPonderado),
        por_etapa: porEtapa,
        por_vendedor: porVendedor,
        oportunidades_paradas: oportunidadesParadas,
      },
    });
  });
}
