import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function npsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== DASHBOARD NPS =====
  // Agrega as respostas das pesquisas de churn (SurveyResposta) em métricas NPS.
  // NPS clássico: score 9-10 = promotor, 7-8 = neutro, 0-6 = detrator.
  // NPS = %promotores - %detratores (faixa -100 a +100).
  fastify.get('/nps/dashboard', async (request, reply) => {
    const respostas = await prisma.surveyResposta.findMany({
      orderBy: { responded_at: 'desc' },
      include: {
        survey_churn: {
          include: {
            cliente: { select: { nome: true, empresa: true } },
          },
        },
      },
    });

    const total = respostas.length;

    if (total === 0) {
      return reply.send({
        status: 'success',
        data: {
          nps_score: 0,
          total: 0,
          promoters: 0,
          neutrals: 0,
          detractors: 0,
          avg_stars: 0,
          distribuicao: Array.from({ length: 11 }, (_, score) => ({ score, count: 0 })),
          recentes: [],
        },
      });
    }

    let promoters = 0;
    let neutrals = 0;
    let detractors = 0;
    let somaStars = 0;
    const contagemPorScore = new Array(11).fill(0); // índices 0..10

    for (const r of respostas) {
      const score = Math.max(0, Math.min(10, r.q3_score ?? 0));
      contagemPorScore[score]++;

      if (score >= 9) promoters++;
      else if (score >= 7) neutrals++;
      else detractors++;

      somaStars += r.q5_stars ?? 0;
    }

    const nps_score = Math.round(((promoters - detractors) / total) * 100);
    const avg_stars = Math.round((somaStars / total) * 10) / 10;

    const distribuicao = contagemPorScore.map((count, score) => ({ score, count }));

    const recentes = respostas.slice(0, 10).map((r) => ({
      cliente: r.survey_churn?.cliente
        ? { nome: r.survey_churn.cliente.nome, empresa: r.survey_churn.cliente.empresa ?? undefined }
        : undefined,
      score: r.q3_score,
      stars: r.q5_stars,
      q4: r.q4_opcao,
      motivo: r.motivo_real ?? undefined,
      data: r.responded_at,
    }));

    return reply.send({
      status: 'success',
      data: {
        nps_score,
        total,
        promoters,
        neutrals,
        detractors,
        avg_stars,
        distribuicao,
        recentes,
      },
    });
  });
}
