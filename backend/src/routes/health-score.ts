import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

function calcularNivel(score: number): string {
  if (score >= 85) return 'EXCELENTE';
  if (score >= 70) return 'SAUDAVEL';
  if (score >= 50) return 'ATENCAO';
  if (score >= 30) return 'RISCO';
  return 'CRITICO';
}

export async function healthScoreRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Listar health scores
  fastify.get('/health-scores', async (request, reply) => {
    const query = z.object({
      nivel: z.string().optional(),
      page: z.coerce.number().default(0),
      limit: z.coerce.number().default(20)
    }).safeParse(request.query);

    const { nivel, page, limit } = query.data || { page: 0, limit: 20 };
    const where: any = {};
    if (nivel) where.nivel = nivel;

    const [scores, total] = await Promise.all([
      prisma.healthScore.findMany({
        where,
        include: { cliente: { select: { id: true, nome: true, empresa: true, email: true } } },
        orderBy: { score: 'asc' },
        skip: page * limit,
        take: limit
      }),
      prisma.healthScore.count({ where })
    ]);

    const distribuicao = await prisma.healthScore.groupBy({
      by: ['nivel'],
      _count: { id: true },
      _avg: { score: true }
    });

    return reply.send({ status: 'success', data: { scores, total, distribuicao } });
  });

  // Calcular/atualizar health score de um cliente
  fastify.post('/health-scores/:clienteId/calcular', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        licencas: { where: { status: 'ATIVA' } },
        tickets: { where: { status: { notIn: ['FECHADO', 'RESOLVIDO'] } } },
        caso_churn: { orderBy: { created_at: 'desc' }, take: 1 }
      }
    });

    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Critérios de pontuação
    let score = 100;
    const fatores: any = {};

    // 1. Licenças ativas (penalidade se não tiver)
    const licencas_ativas = cliente.licencas.length;
    fatores.licencas_ativas = licencas_ativas;
    if (licencas_ativas === 0) score -= 30;

    // 2. Tickets abertos em excesso
    const tickets_abertos = cliente.tickets.length;
    fatores.tickets_abertos = tickets_abertos;
    if (tickets_abertos >= 3) score -= 20;
    else if (tickets_abertos >= 1) score -= 8;

    // 3. Caso churn existente
    const tem_churn = cliente.caso_churn.length > 0;
    fatores.tem_caso_churn = tem_churn;
    if (tem_churn) {
      const ultimo = cliente.caso_churn[0];
      if (ultimo.status === 'NOVO' || ultimo.status === 'DIAGNOSTICADO') score -= 25;
      else if (ultimo.status === 'PLANEJADO' || ultimo.status === 'EXECUTANDO') score -= 15;
    }

    // 4. Dias sem atualização no cliente
    const diasSemUpdate = Math.floor((Date.now() - new Date(cliente.updated_at).getTime()) / 86400000);
    fatores.dias_sem_interacao = diasSemUpdate;
    if (diasSemUpdate >= 90) score -= 15;
    else if (diasSemUpdate >= 30) score -= 7;

    // Garantir 0-100
    score = Math.max(0, Math.min(100, score));
    const nivel = calcularNivel(score);

    const hs = await prisma.healthScore.upsert({
      where: { cliente_id: clienteId },
      update: { score, nivel, fatores, calculado_at: new Date() },
      create: { cliente_id: clienteId, score, nivel, fatores },
      include: { cliente: { select: { id: true, nome: true, empresa: true } } }
    });

    return reply.send({ status: 'success', data: hs });
  });

  // Calcular health score para TODOS os clientes
  fastify.post('/health-scores/calcular-todos', async (request, reply) => {
    const clientes = await prisma.cliente.findMany({ select: { id: true } });
    let processados = 0;

    for (const cliente of clientes) {
      try {
        const c = await prisma.cliente.findUnique({
          where: { id: cliente.id },
          include: {
            licencas: { where: { status: 'ATIVA' } },
            tickets: { where: { status: { notIn: ['FECHADO', 'RESOLVIDO'] } } },
            caso_churn: { orderBy: { created_at: 'desc' }, take: 1 }
          }
        });
        if (!c) continue;

        let score = 100;
        const fatores: any = {};
        fatores.licencas_ativas = c.licencas.length;
        if (c.licencas.length === 0) score -= 30;
        fatores.tickets_abertos = c.tickets.length;
        if (c.tickets.length >= 3) score -= 20;
        else if (c.tickets.length >= 1) score -= 8;
        fatores.tem_caso_churn = c.caso_churn.length > 0;
        if (c.caso_churn.length > 0) {
          const s = c.caso_churn[0].status;
          if (s === 'NOVO' || s === 'DIAGNOSTICADO') score -= 25;
          else if (s === 'PLANEJADO' || s === 'EXECUTANDO') score -= 15;
        }
        const diasSemUpdate = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
        fatores.dias_sem_interacao = diasSemUpdate;
        if (diasSemUpdate >= 90) score -= 15;
        else if (diasSemUpdate >= 30) score -= 7;
        score = Math.max(0, Math.min(100, score));

        await prisma.healthScore.upsert({
          where: { cliente_id: cliente.id },
          update: { score, nivel: calcularNivel(score), fatores, calculado_at: new Date() },
          create: { cliente_id: cliente.id, score, nivel: calcularNivel(score), fatores }
        });
        processados++;
      } catch (e) { /* skip */ }
    }

    return reply.send({ status: 'success', data: { processados, total: clientes.length } });
  });

  // ===== NPS DASHBOARD (unificado) =====
  // Mescla duas fontes: SurveyResposta (pesquisas de churn, score 1-10) e
  // PesquisaSatisfacao (LP pública, notas 1-5 → convertidas p/ 0-10 = media*2).
  fastify.get('/nps/dashboard', async (request, reply) => {
    const [surveys, pesquisas] = await Promise.all([
      prisma.surveyResposta.findMany({
        include: { survey_churn: { include: { cliente: { select: { id: true, nome: true, empresa: true } } } } },
        orderBy: { responded_at: 'desc' },
      }),
      prisma.pesquisaSatisfacao.findMany({ orderBy: { created_at: 'desc' }, take: 1000 }).catch(() => [] as any[]),
    ]);

    // Normaliza ambas as fontes para um formato comum.
    type Item = { score: number; stars: number; cliente: any; q4: string; motivo: string | null; data: Date };
    const itens: Item[] = [
      ...surveys.map((s): Item => ({
        score: s.q3_score, stars: s.q5_stars, cliente: s.survey_churn?.cliente,
        q4: s.q4_opcao, motivo: s.motivo_real, data: s.responded_at,
      })),
      ...pesquisas.map((p: any): Item => ({
        score: Math.round(p.media * 2),                       // 1-5 → 0-10
        stars: Math.round(p.media),
        cliente: p.identificacao ? { nome: p.identificacao, empresa: p.identificacao } : undefined,
        q4: p.conhece_plano ? 'sim' : 'nao',
        motivo: p.observacao || (p.critico ? 'Crítico (pesquisa)' : null),
        data: p.created_at,
      })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const total = itens.length;
    if (total === 0) {
      return reply.send({ status: 'success', data: { nps_score: 0, total: 0, promoters: 0, neutrals: 0, detractors: 0, avg_stars: 0, distribuicao: [], recentes: [] } });
    }

    const promoters = itens.filter(s => s.score >= 9).length;
    const neutrals = itens.filter(s => s.score >= 7 && s.score <= 8).length;
    const detractors = itens.filter(s => s.score <= 6).length;
    const nps_score = Math.round(((promoters - detractors) / total) * 100);
    const avg_stars = itens.reduce((s, r) => s + r.stars, 0) / total;
    const dist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ score: n, count: itens.filter(s => s.score === n).length }));
    const recentes = itens.slice(0, 10).map(s => ({ cliente: s.cliente, score: s.score, stars: s.stars, q4: s.q4, motivo: s.motivo, data: s.data }));

    return reply.send({
      status: 'success',
      data: { nps_score, total, promoters, neutrals, detractors, avg_stars: Math.round(avg_stars * 10) / 10, distribuicao: dist, recentes },
    });
  });
}
