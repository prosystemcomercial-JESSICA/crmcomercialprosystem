import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export async function complementosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== HISTÓRICO DO LEAD =====
  fastify.get('/leads/:id/historico', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [lead, atividades, propostas, contrato] = await Promise.all([
      prisma.lead.findUnique({ where: { id } }),
      prisma.atividade.findMany({
        where: { lead_id: id },
        orderBy: { created_at: 'desc' }
      }),
      prisma.proposta.findMany({
        where: { lead_id: id },
        orderBy: { created_at: 'desc' }
      }),
      prisma.contrato.findFirst({ where: { lead_id: id } })
    ]);

    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    // Build timeline
    const timeline: any[] = [];

    timeline.push({
      tipo: 'CRIACAO',
      titulo: 'Lead criado',
      descricao: `Origem: ${lead.origem}`,
      data: lead.created_at,
      icon: '🎯'
    });

    atividades.forEach(a => {
      timeline.push({
        tipo: 'ATIVIDADE',
        titulo: a.titulo,
        descricao: a.resultado || a.descricao,
        subtipo: a.tipo,
        status: a.status,
        data: a.data_realizada || a.data_prevista || a.created_at,
        icon: { LIGACAO: '📞', EMAIL: '📧', REUNIAO: '📅', WHATSAPP: '💬', VISITA: '🏢', TAREFA: '✅' }[a.tipo] || '📝'
      });
    });

    propostas.forEach(p => {
      timeline.push({
        tipo: 'PROPOSTA',
        titulo: `Proposta: ${p.titulo}`,
        descricao: `R$ ${p.valor.toLocaleString('pt-BR')} · ${p.status}`,
        status: p.status,
        data: p.created_at,
        icon: '📄'
      });
    });

    if (contrato) {
      timeline.push({
        tipo: 'CONTRATO',
        titulo: 'Contrato fechado',
        descricao: `R$ ${contrato.valor.toLocaleString('pt-BR')} · ${contrato.recorrencia}`,
        status: contrato.status,
        data: contrato.created_at,
        icon: '✅'
      });
    }

    timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return reply.send({ status: 'success', data: { lead, timeline } });
  });

  // ===== ALERTAS =====
  fastify.get('/alertas', async (request, reply) => {
    const now = new Date();
    const ontem = new Date(now);
    ontem.setDate(ontem.getDate() - 1);
    const seteAtras = new Date(now);
    seteAtras.setDate(seteAtras.getDate() - 7);
    const trintaAtras = new Date(now);
    trintaAtras.setDate(trintaAtras.getDate() - 30);

    const [atrasadas, vencem_hoje, sem_atividade, propostas_expiram] = await Promise.all([
      // Atividades atrasadas (vencidas e ainda pendentes)
      prisma.atividade.findMany({
        where: { status: 'PENDENTE', data_prevista: { lt: now } },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        orderBy: { data_prevista: 'asc' },
        take: 20
      }),
      // Atividades que vencem hoje
      prisma.atividade.findMany({
        where: {
          status: 'PENDENTE',
          data_prevista: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        take: 20
      }),
      // Leads sem atividade há 7+ dias
      prisma.lead.findMany({
        where: {
          status: { notIn: ['GANHO', 'PERDIDO'] },
          updated_at: { lt: seteAtras }
        },
        orderBy: { updated_at: 'asc' },
        take: 15
      }),
      // Propostas que expiram nos próximos 3 dias
      prisma.proposta.findMany({
        where: {
          status: { in: ['ENVIADA', 'VISUALIZADA'] },
          validade: { gt: now, lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) }
        },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        take: 10
      })
    ]);

    const alertas = [
      ...atrasadas.map(a => ({
        id: `at-${a.id}`,
        tipo: 'ATIVIDADE_ATRASADA',
        urgencia: 'ALTA',
        titulo: `Atividade atrasada: ${a.titulo}`,
        descricao: `${a.lead?.nome} ${a.lead?.empresa ? `· ${a.lead.empresa}` : ''} · ${a.tipo}`,
        data: a.data_prevista,
        link: `/leads?id=${a.lead_id}`
      })),
      ...vencem_hoje.map(a => ({
        id: `vh-${a.id}`,
        tipo: 'VENCE_HOJE',
        urgencia: 'MEDIA',
        titulo: `Vence hoje: ${a.titulo}`,
        descricao: `${a.lead?.nome} ${a.lead?.empresa ? `· ${a.lead.empresa}` : ''}`,
        data: a.data_prevista,
        link: `/leads?id=${a.lead_id}`
      })),
      ...sem_atividade.map(l => ({
        id: `sa-${l.id}`,
        tipo: 'SEM_ATIVIDADE',
        urgencia: 'BAIXA',
        titulo: `Lead sem atividade: ${l.nome}`,
        descricao: `${l.empresa || ''} · sem contato há ${Math.floor((now.getTime() - new Date(l.updated_at).getTime()) / 86400000)} dias`,
        data: l.updated_at,
        link: `/leads`
      })),
      ...propostas_expiram.map(p => ({
        id: `pe-${p.id}`,
        tipo: 'PROPOSTA_EXPIRANDO',
        urgencia: 'ALTA',
        titulo: `Proposta expirando: ${p.titulo}`,
        descricao: `${p.lead?.nome} · R$ ${p.valor.toLocaleString('pt-BR')}`,
        data: p.validade,
        link: `/propostas`
      }))
    ];

    return reply.send({
      status: 'success',
      data: {
        alertas: alertas.sort((a, b) => {
          const priority = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
          return priority[a.urgencia as keyof typeof priority] - priority[b.urgencia as keyof typeof priority];
        }),
        resumo: {
          total: alertas.length,
          alta: alertas.filter(a => a.urgencia === 'ALTA').length,
          media: alertas.filter(a => a.urgencia === 'MEDIA').length,
          baixa: alertas.filter(a => a.urgencia === 'BAIXA').length
        }
      }
    });
  });

  // ===== IMPORTAÇÃO DE LEADS (CSV) =====
  fastify.post('/leads/importar', async (request, reply) => {
    const body = z.object({
      leads: z.array(z.object({
        nome: z.string().min(1),
        email: z.string().optional(),
        telefone: z.string().optional(),
        empresa: z.string().optional(),
        cargo: z.string().optional(),
        origem: z.string().optional(),
        observacoes: z.string().optional()
      })).min(1).max(500)
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const created_by = user?.id || 'system';

    const results = { criados: 0, ignorados: 0, erros: [] as string[] };

    for (const lead of body.data.leads) {
      try {
        const data: any = {
          ...lead,
          origem: (lead.origem?.toUpperCase() as any) || 'MANUAL',
          created_by
        };
        if (!data.email || data.email === '') delete data.email;
        await prisma.lead.create({ data });
        results.criados++;
      } catch (e: any) {
        if (e.code === 'P2002') {
          results.ignorados++;
        } else {
          results.erros.push(`${lead.nome}: ${e.message}`);
        }
      }
    }

    return reply.send({
      status: 'success',
      data: results,
      message: `${results.criados} leads importados, ${results.ignorados} ignorados`
    });
  });

  // ===== PREVISÃO DE FECHAMENTO =====
  fastify.get('/leads/previsao', async (request, reply) => {
    const query = z.object({
      dias: z.coerce.number().default(30)
    }).safeParse(request.query);
    const { dias } = query.data || { dias: 30 };

    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['GANHO', 'PERDIDO', 'NUTRICAO'] },
        valor_estimado: { gt: 0 }
      },
      orderBy: { probabilidade: 'desc' }
    });

    const previsao = {
      otimista: 0,   // 100% das oportunidades
      realista: 0,   // ponderado pela probabilidade
      pessimista: 0, // apenas alta probabilidade (>= 70%)
      total_oportunidades: leads.length,
      valor_total_pipeline: 0
    };

    leads.forEach(l => {
      const valor = l.valor_estimado || 0;
      const prob = (l.probabilidade || 50) / 100;
      previsao.valor_total_pipeline += valor;
      previsao.otimista += valor;
      previsao.realista += valor * prob;
      if (prob >= 0.7) previsao.pessimista += valor * prob;
    });

    // Top oportunidades
    const top = leads
      .filter(l => (l.valor_estimado || 0) > 0)
      .sort((a, b) => {
        const scoreA = (a.valor_estimado || 0) * ((a.probabilidade || 50) / 100);
        const scoreB = (b.valor_estimado || 0) * ((b.probabilidade || 50) / 100);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        nome: l.nome,
        empresa: l.empresa,
        valor_estimado: l.valor_estimado,
        probabilidade: l.probabilidade || 50,
        valor_ponderado: (l.valor_estimado || 0) * ((l.probabilidade || 50) / 100),
        etapa: l.etapa_funil,
        status: l.status
      }));

    return reply.send({
      status: 'success',
      data: {
        previsao: {
          otimista: Math.round(previsao.otimista),
          realista: Math.round(previsao.realista),
          pessimista: Math.round(previsao.pessimista)
        },
        total_oportunidades: previsao.total_oportunidades,
        valor_total_pipeline: Math.round(previsao.valor_total_pipeline),
        top_oportunidades: top,
        periodo_dias: dias
      }
    });
  });

  // ===== NUTRIÇÃO — Leads para recontato =====
  fastify.get('/leads/nutricao', async (request, reply) => {
    const leads = await prisma.lead.findMany({
      where: { status: 'NUTRICAO' },
      orderBy: { updated_at: 'asc' },
      include: {
        _count: { select: { atividades: true, propostas: true } }
      }
    });

    const agora = new Date();
    const result = leads.map(l => {
      const diasSemContato = Math.floor((agora.getTime() - new Date(l.updated_at).getTime()) / 86400000);
      return { ...l, diasSemContato };
    });

    return reply.send({ status: 'success', data: result });
  });

  // Reativar lead da nutrição
  fastify.post('/leads/:id/reativar', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: { status: 'NOVO', etapa_funil: 'PROSPECCAO' }
      });
      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });
}
