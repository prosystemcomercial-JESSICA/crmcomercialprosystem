import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ownerWhere } from '@/lib/scope';

// Forecast de receita ponderado (EVO-5).
// Receita esperada = Σ (valor anualizado da oportunidade × probabilidade da etapa).
// Escopado por papel: vendedor vê o próprio funil; gestão vê tudo.

// Probabilidade de fechamento por etapa comercial (0..1).
const PROB_ETAPA: Record<string, number> = {
  NOVO_LEAD:             0.05,
  PRIMEIRO_CONTATO:      0.10,
  EM_ATENDIMENTO:        0.20,
  AGUARDANDO_RETORNO:    0.25,
  PROPOSTA_A_GERAR:      0.35,
  PROPOSTA_ENVIADA:      0.50,
  EM_NEGOCIACAO:         0.65,
  ACEITO:                0.85,
  CONTRATO_EM_ANDAMENTO: 0.95,
  CONTRATO_ASSINADO:     1.00,
  // ONBOARDING/EXECUCAO_TECNICA já são pós-venda; PERDIDO = 0.
};

const ETAPA_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato', EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_RETORNO: 'Aguardando Retorno', PROPOSTA_A_GERAR: 'Proposta a Gerar',
  PROPOSTA_ENVIADA: 'Proposta Enviada', EM_NEGOCIACAO: 'Em Negociação', ACEITO: 'Aceito',
  CONTRATO_EM_ANDAMENTO: 'Contrato em Andamento', CONTRATO_ASSINADO: 'Contrato Assinado',
};

export async function forecastRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // GET /dashboard/forecast — receita ponderada por etapa do funil.
  fastify.get('/dashboard/forecast', async (request, reply) => {
    const etapasAtivas = Object.keys(PROB_ETAPA);

    const leads = await prisma.lead.findMany({
      where: {
        etapa_comercial: { in: etapasAtivas },
        status: { notIn: ['PERDIDO'] },
        ...ownerWhere(request, 'Lead'),
      },
      select: {
        etapa_comercial: true,
        valor_setup: true,
        valor_estimado: true,
        mensalidade_estimada: true,
      },
      take: 5000,
    });

    // Valor anualizado de uma oportunidade: setup + 12 mensalidades (ou valor_estimado).
    const valorOportunidade = (l: { valor_setup: number | null; valor_estimado: number | null; mensalidade_estimada: number | null }) => {
      const setup = l.valor_setup ?? 0;
      const anual = (l.mensalidade_estimada ?? 0) * 12;
      const calc = setup + anual;
      return calc > 0 ? calc : (l.valor_estimado ?? 0);
    };

    const porEtapa: Record<string, { etapa: string; label: string; prob: number; qtd: number; valor_bruto: number; valor_ponderado: number }> = {};
    for (const e of etapasAtivas) {
      porEtapa[e] = { etapa: e, label: ETAPA_LABEL[e] || e, prob: PROB_ETAPA[e], qtd: 0, valor_bruto: 0, valor_ponderado: 0 };
    }

    let totalBruto = 0;
    let totalPonderado = 0;
    for (const l of leads) {
      const etapa = l.etapa_comercial;
      const bucket = porEtapa[etapa];
      if (!bucket) continue;
      const valor = valorOportunidade(l);
      const ponderado = valor * bucket.prob;
      bucket.qtd++;
      bucket.valor_bruto += valor;
      bucket.valor_ponderado += ponderado;
      totalBruto += valor;
      totalPonderado += ponderado;
    }

    const etapas = etapasAtivas
      .map(e => porEtapa[e])
      .filter(b => b.qtd > 0)
      .map(b => ({ ...b, valor_ponderado: Math.round(b.valor_ponderado), valor_bruto: Math.round(b.valor_bruto) }));

    return reply.send({
      status: 'success',
      data: {
        total_oportunidades: leads.length,
        valor_pipeline_bruto: Math.round(totalBruto),
        receita_esperada: Math.round(totalPonderado),
        etapas,
      },
    });
  });
}
