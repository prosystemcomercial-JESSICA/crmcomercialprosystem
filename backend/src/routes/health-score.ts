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

// Cliente em TRATAMENTO de churn (caso aberto, ainda não recuperado/perdido) ou
// marcado em risco_atencao NUNCA pode aparecer melhor que "em risco" no Health
// Score — rebaixa o nível p/ RISCO (ou mantém CRITICO se já estiver pior).
const STATUS_CHURN_EM_TRATAMENTO = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'];
function rebaixarSeEmChurn(nivel: string, opts: { temChurnAtivo?: boolean; riscoAtencao?: boolean }): string {
  if (!opts.temChurnAtivo && !opts.riscoAtencao) return nivel;
  return nivel === 'CRITICO' ? 'CRITICO' : 'RISCO';
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
    // Só clientes ATIVOS no Health Score (situação ATIVA ou null=legado sem
    // situação). Inativos/churn não devem aparecer no painel. (Prisma não aceita
    // null dentro de `in` → usar OR.)
    const where: any = { cliente: { OR: [{ situacao: 'ATIVA' }, { situacao: null }] } };
    if (nivel) where.nivel = nivel;

    const [scores, total, distribBruta] = await Promise.all([
      prisma.healthScore.findMany({
        where,
        include: { cliente: { select: { id: true, nome: true, empresa: true, email: true } } },
        orderBy: { score: 'asc' },
        skip: page * limit,
        take: limit
      }),
      prisma.healthScore.count({ where }),
      // Distribuição também restrita aos ativos (groupBy não aceita filtro por
      // relação → busca os níveis/scores dos ativos e agrega em memória).
      prisma.healthScore.findMany({ where, select: { nivel: true, score: true } }),
    ]);

    const mapaDist = new Map<string, { count: number; soma: number }>();
    for (const s of distribBruta) {
      const k = s.nivel || 'SEM_NIVEL';
      const cur = mapaDist.get(k) || { count: 0, soma: 0 };
      cur.count += 1; cur.soma += Number(s.score || 0);
      mapaDist.set(k, cur);
    }
    const distribuicao = Array.from(mapaDist.entries()).map(([nivel, v]) => ({
      nivel, _count: { id: v.count }, _avg: { score: v.count ? v.soma / v.count : 0 },
    }));

    return reply.send({ status: 'success', data: { scores, total, distribuicao } });
  });

  // Calcular/atualizar health score de um cliente
  fastify.post('/health-scores/:clienteId/calcular', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };

    const [cliente, ultimaPesquisa] = await Promise.all([
      prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          licencas: { where: { status: 'ATIVA' } },
          tickets: { where: { status: { notIn: ['FECHADO', 'RESOLVIDO'] } } },
          caso_churn: { orderBy: { created_at: 'desc' }, take: 1 }
        }
      }),
      (prisma as any).pesquisaSatisfacao.findFirst({
        where: { cliente_id: clienteId },
        orderBy: { created_at: 'desc' },
        select: { score: true, critico: true, resolucao: true, created_at: true, nota_geral: true, media: true },
      }).catch(() => null),
    ]);

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

    // 5. Score NPS da última pesquisa de satisfação (peso: ±15 pontos)
    if (ultimaPesquisa) {
      const nps = ultimaPesquisa.score > 0 ? ultimaPesquisa.score
        : ultimaPesquisa.nota_geral ? Math.round(((ultimaPesquisa.nota_geral - 1) / 4) * 100)
        : Math.round(((ultimaPesquisa.media - 1) / 4) * 100);

      fatores.nps_score = nps;
      fatores.nps_data = ultimaPesquisa.created_at;
      fatores.nps_problema_nao_resolvido = ultimaPesquisa.resolucao === 'nao_resolveu';

      // Pesquisa muito antiga (> 180 dias) tem impacto reduzido
      const diasPesquisa = Math.floor((Date.now() - new Date(ultimaPesquisa.created_at).getTime()) / 86400000);
      const pesoNps = diasPesquisa > 180 ? 0.5 : 1.0;

      if (nps >= 90)       score += Math.round(10 * pesoNps); // bônus promotor
      else if (nps >= 70)  score += 0;                         // neutro
      else if (nps >= 50)  score -= Math.round(8  * pesoNps);  // atenção
      else                 score -= Math.round(15 * pesoNps);  // detrator

      // Problema explicitamente não resolvido → penalidade adicional
      if (ultimaPesquisa.resolucao === 'nao_resolveu') score -= 10;
    } else {
      fatores.nps_score = null; // sem pesquisa respondida ainda
    }

    // Garantir 0-100
    score = Math.max(0, Math.min(100, score));
    // Cliente em tratamento de churn (caso aberto) ou marcado em risco_atencao
    // sempre aparece, no mínimo, como "em risco".
    const churnEmTratamento = tem_churn && STATUS_CHURN_EM_TRATAMENTO.includes(cliente.caso_churn[0]?.status);
    const nivel = rebaixarSeEmChurn(calcularNivel(score), {
      temChurnAtivo: churnEmTratamento, riscoAtencao: !!(cliente as any).risco_atencao,
    });

    const hs = await prisma.healthScore.upsert({
      where: { cliente_id: clienteId },
      update: { score, nivel, fatores, calculado_at: new Date() },
      create: { cliente_id: clienteId, score, nivel, fatores },
      include: { cliente: { select: { id: true, nome: true, empresa: true, mensalidade_base: true } } }
    });
    prisma.healthScoreSnapshot.create({
      data: { cliente_id: clienteId, score, nivel, mrr_momento: hs.cliente?.mensalidade_base ?? null },
    }).catch(() => {});

    return reply.send({ status: 'success', data: hs });
  });

  // Calcular health score para todos os clientes ATIVOS (ignora inativos/churn).
  fastify.post('/health-scores/calcular-todos', async (request, reply) => {
    const clientes = await prisma.cliente.findMany({
      where: { OR: [{ situacao: 'ATIVA' }, { situacao: null }] }, // null = legado sem situação = considera ativo
      select: { id: true },
    });
    let processados = 0;

    for (const cliente of clientes) {
      try {
        const [c, ultimaPesq] = await Promise.all([
          prisma.cliente.findUnique({
            where: { id: cliente.id },
            include: {
              licencas: { where: { status: 'ATIVA' } },
              tickets: { where: { status: { notIn: ['FECHADO', 'RESOLVIDO'] } } },
              caso_churn: { orderBy: { created_at: 'desc' }, take: 1 }
            }
          }),
          (prisma as any).pesquisaSatisfacao.findFirst({
            where: { cliente_id: cliente.id },
            orderBy: { created_at: 'desc' },
            select: { score: true, critico: true, resolucao: true, created_at: true, nota_geral: true, media: true },
          }).catch(() => null),
        ]);
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
        // NPS da pesquisa
        if (ultimaPesq) {
          const nps = ultimaPesq.score > 0 ? ultimaPesq.score
            : ultimaPesq.nota_geral ? Math.round(((ultimaPesq.nota_geral - 1) / 4) * 100)
            : Math.round(((ultimaPesq.media - 1) / 4) * 100);
          fatores.nps_score = nps;
          fatores.nps_data = ultimaPesq.created_at;
          const diasPesq = Math.floor((Date.now() - new Date(ultimaPesq.created_at).getTime()) / 86400000);
          const peso = diasPesq > 180 ? 0.5 : 1.0;
          if (nps >= 90) score += Math.round(10 * peso);
          else if (nps < 70 && nps >= 50) score -= Math.round(8 * peso);
          else if (nps < 50) score -= Math.round(15 * peso);
          if (ultimaPesq.resolucao === 'nao_resolveu') score -= 10;
        } else {
          fatores.nps_score = null;
        }
        score = Math.max(0, Math.min(100, score));

        // Em tratamento de churn ou risco_atencao → no mínimo "em risco".
        const churnEmTrat = c.caso_churn.length > 0 && STATUS_CHURN_EM_TRATAMENTO.includes(c.caso_churn[0]?.status);
        const nivel = rebaixarSeEmChurn(calcularNivel(score), {
          temChurnAtivo: churnEmTrat, riscoAtencao: !!(c as any).risco_atencao,
        });

        await prisma.healthScore.upsert({
          where: { cliente_id: cliente.id },
          update: { score, nivel, fatores, calculado_at: new Date() },
          create: { cliente_id: cliente.id, score, nivel, fatores }
        });
        prisma.healthScoreSnapshot.create({
          data: { cliente_id: cliente.id, score, nivel, mrr_momento: (c as any).mensalidade_base ?? null },
        }).catch(() => {});
        processados++;
      } catch (e) { /* skip */ }
    }

    return reply.send({ status: 'success', data: { processados, total: clientes.length } });
  });

  // ===== RANKING DE SAÚDE DA CARTEIRA POR TÉCNICO =====
  // Agrupa os clientes por grupo_tecnico (que já traz o nome do técnico, ex.:
  // "Grupo 5 - Wellington") e mede a saúde do atendimento de cada um:
  // ativos, em risco, em tratamento de churn, inativos (saíram) e índices.
  fastify.get('/health-scores/ranking-tecnicos', async (_request, reply) => {
    // Clientes com seus health scores e casos de churn ativos.
    const clientes = await prisma.cliente.findMany({
      where: { grupo_tecnico: { not: null } },
      select: {
        id: true, grupo_tecnico: true, situacao: true, risco_atencao: true,
        mrr_perdido: true, mensalidade_base: true,
        health_score: { select: { nivel: true } },
        caso_churn: { where: { status: { in: ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'] } }, select: { id: true } },
      },
    }).catch(() => [] as any[]);

    const mapa: Record<string, any> = {};
    for (const c of clientes) {
      const g = (c.grupo_tecnico || '').trim();
      if (!g || /comercial|inativ/i.test(g)) continue; // ignora "Grupo Comercial" e "Empresas inativas"
      if (!mapa[g]) mapa[g] = { tecnico: g, total: 0, ativos: 0, inativos: 0, em_risco: 0, em_churn: 0, saudaveis: 0, mrr_ativo: 0, mrr_perdido: 0 };
      const m = mapa[g];
      m.total += 1;
      const inativo = (c.situacao || '').toUpperCase().startsWith('INAT');
      if (inativo) { m.inativos += 1; m.mrr_perdido += Number(c.mrr_perdido || 0); return; }
      m.ativos += 1;
      m.mrr_ativo += Number(c.mensalidade_base || 0);
      const emChurn = c.caso_churn.length > 0;
      const emRisco = c.risco_atencao || ['RISCO', 'CRITICO'].includes(c.health_score?.nivel || '');
      if (emChurn) m.em_churn += 1;
      else if (emRisco) m.em_risco += 1;
      else m.saudaveis += 1;
    }

    const ranking = Object.values(mapa).map((m: any) => {
      const baseAtivos = m.ativos || 1;
      // Índice de saúde: % de clientes ativos saudáveis (0-100). Quanto maior, melhor.
      const indice_saude = Math.round((m.saudaveis / baseAtivos) * 100);
      // Taxa de churn: % de inativos sobre o total da carteira.
      const taxa_churn = m.total ? Math.round((m.inativos / m.total) * 100) : 0;
      return { ...m, indice_saude, taxa_churn };
    }).sort((a, b) => b.indice_saude - a.indice_saude); // melhores carteiras primeiro

    return reply.send({ status: 'success', data: ranking });
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
      ...pesquisas.map((p: any): Item => {
        // NPS usa a nota GERAL da Prosystem (1-5) → 0-10. Fallback p/ média (respostas antigas).
        const base = p.nota_geral && p.nota_geral > 0 ? p.nota_geral : p.media;
        return {
          score: Math.round(base * 2),                        // 1-5 → 0-10
          stars: Math.round(base),
          cliente: p.identificacao ? { nome: p.identificacao, empresa: p.identificacao } : undefined,
          q4: p.conhece_plano ? 'sim' : 'nao',
          motivo: p.recado || p.observacao || (p.critico ? 'Crítico (pesquisa)' : null),
          data: p.created_at,
        };
      }),
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
