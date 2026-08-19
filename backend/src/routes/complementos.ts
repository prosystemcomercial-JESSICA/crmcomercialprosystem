import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ownerWhere, getUser, podeVerTudo } from '@/lib/scope';
import { probabilidadeEtapa } from '@/lib/forecast';

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
    const seteAtras = new Date(now);
    seteAtras.setDate(seteAtras.getDate() - 7);
    const tresDiasAtras = new Date(now);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    const user = getUser(request);
    const role = (user?.role || '').toUpperCase();
    const isCEO = role === 'CEO';
    const isAdmin = role === 'ADMIN';
    const isGestorComercial = isCEO || isAdmin || role === 'SUPERVISAO_COMERCIAL' || role === 'SUPERVISAO';

    // Cada alerta é escopado ao dono: vendedor vê só os seus; gestor vê todos.
    const escAtiv = ownerWhere(request, 'Atividade');
    const escLead = ownerWhere(request, 'Lead');
    const escProp = ownerWhere(request, 'Proposta');

    // CEO e ADMIN não precisam de alertas de leads sem atividade nem proposta expirando.
    // CEO não precisa de alertas de atividades (foco em novas vendas).
    // ADMIN foca em compromissos (atividades) + novas vendas.
    const [atrasadas, vencem_hoje, sem_atividade, propostas_expiram] = await Promise.all([
      // Atividades atrasadas — CEO não vê (não gerencia atividades de vendedores no sino)
      isCEO ? Promise.resolve([]) : prisma.atividade.findMany({
        where: { status: 'PENDENTE', data_prevista: { lt: now }, ...escAtiv },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        orderBy: { data_prevista: 'asc' },
        take: 20
      }),
      // Atividades que vencem hoje — CEO não vê
      isCEO ? Promise.resolve([]) : prisma.atividade.findMany({
        where: {
          status: 'PENDENTE',
          data_prevista: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          },
          ...escAtiv
        },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        take: 20
      }),
      // Leads sem atividade — só vendedores e supervisão comercial (não CEO/ADMIN)
      (isCEO || isAdmin) ? Promise.resolve([]) : prisma.lead.findMany({
        where: {
          status: { notIn: ['GANHO', 'PERDIDO'] },
          updated_at: { lt: seteAtras },
          ...escLead
        },
        orderBy: { updated_at: 'asc' },
        take: 15
      }),
      // Propostas expirando — só vendedores e supervisão (não CEO/ADMIN)
      (isCEO || isAdmin) ? Promise.resolve([]) : prisma.proposta.findMany({
        where: {
          status: { in: ['ENVIADA', 'VISUALIZADA'] },
          validade: { gt: now, lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
          ...escProp
        },
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
        take: 10
      })
    ]);

    // Novos leads atribuídos pela supervisão (ainda não vistos pelo vendedor)
    const escNovo = ownerWhere(request, 'Lead');
    let novos_atribuidos: any[] = [];
    if (!isCEO && !isAdmin && (escNovo.OR || escNovo.responsavel_id)) {
      const uid = user?.id || '__no_user__';
      novos_atribuidos = await prisma.$queryRawUnsafe(
        `SELECT id, nome, empresa, atribuido_em FROM \`Lead\`
         WHERE atribuicao_vista = 0 AND atribuido_em IS NOT NULL
           AND (responsavel_id = ? OR created_by = ?)
         ORDER BY atribuido_em DESC LIMIT 20`, uid, uid
      ).catch(() => []);
    }

    // Follow-up: leads cuja PRÓXIMA AÇÃO de cadência já venceu (CEO não vê)
    let followup_pendente: any[] = [];
    if (!isCEO) {
      const uid = user?.id || '__no_user__';
      const verTudo = podeVerTudo(user);
      followup_pendente = await prisma.$queryRawUnsafe(
        `SELECT p.lead_id AS id, p.coluna_chave, p.tentativas, p.proxima_acao_em, l.nome, l.empresa
           FROM LeadQuadroPosicao p
           JOIN \`Lead\` l ON l.id = p.lead_id
          WHERE p.finalizado = 0 AND p.proxima_acao_em IS NOT NULL AND p.proxima_acao_em <= NOW()
            AND l.deleted_at IS NULL
            ${verTudo ? '' : 'AND (l.responsavel_id = ? OR l.created_by = ?)'}
          ORDER BY p.proxima_acao_em ASC LIMIT 30`,
        ...(verTudo ? [] : [uid, uid])
      ).catch(() => []);
    }

    // Implantações com prazo perto ou estourado (técnico + gestão, não CEO)
    let implantacoes_prazo: any[] = [];
    if (!isCEO) {
      const uid = user?.id || '__no_user__';
      const verTudo = podeVerTudo(user);
      implantacoes_prazo = await prisma.$queryRawUnsafe(
        `SELECT id, cliente_razao_social, tecnico_id, tecnico_nome, prazo_virada, prazo_finalizacao,
                data_instalacao, data_conclusao, status
           FROM Implantacao
          WHERE status NOT IN ('CANCELADA')
            AND (
              (data_instalacao IS NULL AND prazo_virada IS NOT NULL AND prazo_virada <= DATE_ADD(NOW(), INTERVAL 3 DAY))
              OR (data_conclusao IS NULL AND prazo_finalizacao IS NOT NULL AND prazo_finalizacao <= DATE_ADD(NOW(), INTERVAL 3 DAY))
            )
            ${verTudo ? '' : 'AND tecnico_id = ?'}
          ORDER BY prazo_virada ASC LIMIT 30`,
        ...(verTudo ? [] : [uid])
      ).catch(() => []);
    }

    // ── Novas vendas adicionais/indicações (últimos 3 dias, qualquer vendedor)
    // CEO e ADMIN veem todas; outros não veem este bloco.
    let novas_vendas: any[] = [];
    if (isCEO || isAdmin) {
      novas_vendas = await (prisma as any).vendaAdicional.findMany({
        where: { created_at: { gte: tresDiasAtras } },
        include: {
          cliente: { select: { razao_social: true, nome_fantasia: true, nome: true } },
          parceiro: { select: { nome: true, categoria: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 30,
      }).catch(() => []);
    }

    // ── Novos contratos comerciais (últimos 3 dias, qualquer vendedor) — CEO e ADMIN
    let novos_contratos: any[] = [];
    if (isCEO || isAdmin) {
      novos_contratos = await (prisma as any).contratoComercial.findMany({
        where: { created_at: { gte: tresDiasAtras } },
        select: {
          id: true, created_at: true,
          razao_social: true, nome_fantasia: true,
          plano_contratado: true, tipo_servico: true,
          vendedor_nome: true,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }).catch(() => []);
    }

    const CATEGORIA_LABEL: Record<string, string> = {
      FISCAL: 'Pacote Fiscal', TEF: 'TEF', TRIBUTARIO: 'Tributário',
      COMUNICACAO: 'Comunicação', UPGRADE: 'Upgrade', TROCA_CNPJ: 'Troca CNPJ', OUTRO: 'Outro',
    };

    const alertas = [
      // Novas vendas adicionais/indicações (CEO e ADMIN)
      ...novas_vendas.map((v: any) => {
        const nomeCliente = v.cliente?.razao_social || v.cliente?.nome_fantasia || v.cliente?.nome || 'Cliente';
        const cat = CATEGORIA_LABEL[v.parceiro?.categoria] || v.parceiro?.categoria || '';
        const dias = Math.floor((now.getTime() - new Date(v.created_at).getTime()) / 86_400_000);
        return {
          id: `nv-${v.id}`,
          tipo: 'NOVA_VENDA_ADICIONAL',
          urgencia: 'ALTA' as const,
          titulo: `Nova venda: ${v.parceiro?.nome || cat}`,
          descricao: `${nomeCliente} · ${cat}${dias === 0 ? ' · hoje' : ` · há ${dias} dia(s)`}`,
          data: v.created_at,
          link: `/indicacoes`,
        };
      }),
      // Novos contratos (CEO e ADMIN)
      ...novos_contratos.map((c: any) => {
        const nomeCliente = c.razao_social || c.nome_fantasia || 'Cliente';
        const dias = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86_400_000);
        const tipo = c.tipo_servico === 'TROCA_CNPJ' ? 'Troca de CNPJ' : 'Novo contrato';
        const plano = c.plano_contratado ? ` · ${c.plano_contratado}` : '';
        const vendedor = c.vendedor_nome ? ` · ${c.vendedor_nome}` : '';
        return {
          id: `nc-${c.id}`,
          tipo: 'NOVO_CONTRATO',
          urgencia: 'ALTA' as const,
          titulo: `${tipo}: ${nomeCliente}`,
          descricao: `${plano}${vendedor}${dias === 0 ? ' · hoje' : ` · há ${dias} dia(s)`}`.replace(/^\s*·\s*/, '').trim(),
          data: c.created_at,
          link: `/contratos-comerciais`,
        };
      }),
      ...implantacoes_prazo.map((i: any) => {
        const venceVirada = !i.data_instalacao && i.prazo_virada;
        const alvo = venceVirada ? i.prazo_virada : i.prazo_finalizacao;
        const dr = Math.ceil((new Date(alvo).getTime() - Date.now()) / 86400000);
        const oque = venceVirada ? 'virada/instalação' : 'finalização';
        return {
          id: `imp-${i.id}`,
          tipo: 'IMPLANTACAO_PRAZO',
          urgencia: dr < 0 ? 'ALTA' : 'MEDIA',
          titulo: dr < 0 ? `Implantação ATRASADA: ${i.cliente_razao_social}` : `Prazo de ${oque} próximo: ${i.cliente_razao_social}`,
          descricao: dr < 0 ? `${oque} atrasada em ${Math.abs(dr)} dia(s)` : `faltam ${dr} dia(s) para a ${oque}`,
          data: alvo,
          link: `/implantacoes`,
        };
      }),
      ...novos_atribuidos.map((l: any) => ({
        id: `nl-${l.id}`,
        tipo: 'NOVO_LEAD_RECEBIDO',
        urgencia: 'ALTA',
        titulo: `Novo lead recebido: ${l.nome}`,
        descricao: `${l.empresa || ''} · atribuído a você — faça o primeiro contato`,
        data: l.atribuido_em,
        link: `/leads?id=${l.id}`
      })),
      ...followup_pendente.map((l: any) => ({
        id: `fup-${l.id}`,
        tipo: 'FOLLOWUP_PENDENTE',
        urgencia: 'MEDIA',
        titulo: `Follow-up: hora de retomar ${l.nome}`,
        descricao: `${l.empresa || ''} · ${l.tentativas || 0} tentativa(s) — próximo toque pendente`,
        data: l.proxima_acao_em,
        link: `/leads?id=${l.id}`
      })),
      ...atrasadas.map((a: any) => ({
        id: `at-${a.id}`,
        tipo: 'ATIVIDADE_ATRASADA',
        urgencia: 'ALTA',
        titulo: `Atividade atrasada: ${a.titulo}`,
        descricao: `${a.lead?.nome} ${a.lead?.empresa ? `· ${a.lead.empresa}` : ''} · ${a.tipo}`,
        data: a.data_prevista,
        link: `/leads?id=${a.lead_id}`
      })),
      ...vencem_hoje.map((a: any) => ({
        id: `vh-${a.id}`,
        tipo: 'VENCE_HOJE',
        urgencia: 'MEDIA',
        titulo: `Vence hoje: ${a.titulo}`,
        descricao: `${a.lead?.nome} ${a.lead?.empresa ? `· ${a.lead.empresa}` : ''}`,
        data: a.data_prevista,
        link: `/leads?id=${a.lead_id}`
      })),
      ...sem_atividade.map((l: any) => ({
        id: `sa-${l.id}`,
        tipo: 'SEM_ATIVIDADE',
        urgencia: 'BAIXA',
        titulo: `Lead sem atividade: ${l.nome}`,
        descricao: `${l.empresa || ''} · sem contato há ${Math.floor((now.getTime() - new Date(l.updated_at).getTime()) / 86400000)} dias`,
        data: l.updated_at,
        link: `/leads`
      })),
      ...propostas_expiram.map((p: any) => ({
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
        valor_estimado: { gt: 0 },
        // Previsão é sobre a meta/pipeline do PRÓPRIO vendedor; gestor vê tudo.
        ...ownerWhere(request, 'Lead')
      },
    });

    // Probabilidade por etapa do funil comercial (PROB_ETAPA) — não pelo campo
    // Lead.probabilidade, que está sempre vazio na prática (ninguém o preenche
    // manualmente) e antes caía num fallback fixo de 50% para todo lead, igualando
    // um "Novo Lead" a um "Em Negociação".
    const leadsOrdenados = [...leads].sort(
      (a, b) => probabilidadeEtapa(b.etapa_comercial) - probabilidadeEtapa(a.etapa_comercial)
    );

    const previsao = {
      otimista: 0,   // 100% das oportunidades
      realista: 0,   // ponderado pela probabilidade
      pessimista: 0, // apenas alta probabilidade (>= 70%)
      total_oportunidades: leads.length,
      valor_total_pipeline: 0
    };

    leads.forEach(l => {
      const valor = l.valor_estimado || 0;
      const prob = probabilidadeEtapa(l.etapa_comercial);
      previsao.valor_total_pipeline += valor;
      previsao.otimista += valor;
      previsao.realista += valor * prob;
      if (prob >= 0.7) previsao.pessimista += valor * prob;
    });

    // Top oportunidades
    const top = leadsOrdenados
      .filter(l => (l.valor_estimado || 0) > 0)
      .sort((a, b) => {
        const scoreA = (a.valor_estimado || 0) * probabilidadeEtapa(a.etapa_comercial);
        const scoreB = (b.valor_estimado || 0) * probabilidadeEtapa(b.etapa_comercial);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        nome: l.nome,
        empresa: l.empresa,
        valor_estimado: l.valor_estimado,
        probabilidade: Math.round(probabilidadeEtapa(l.etapa_comercial) * 100),
        valor_ponderado: (l.valor_estimado || 0) * probabilidadeEtapa(l.etapa_comercial),
        etapa: l.etapa_funil,
        status: l.status
      }));

    // Meta do próprio vendedor (definida pela supervisão) — período atual
    const agora = new Date();
    const periodoAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const metasReceita = await prisma.meta.findMany({
      where: { tipo: 'RECEITA', periodo: periodoAtual, ...ownerWhere(request, 'Meta') },
    });
    const metaValor  = metasReceita.reduce((s, m) => s + (m.valor_alvo || 0), 0);
    const metaAtual  = metasReceita.reduce((s, m) => s + (m.valor_atual || 0), 0);
    const metaPctEvolucao = metaValor > 0 ? Math.round((metaAtual / metaValor) * 100) : 0;

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
        periodo_dias: dias,
        // Meta do vendedor + evolução (para a previsão focar na meta própria)
        meta: {
          periodo: periodoAtual,
          valor_alvo: Math.round(metaValor),
          valor_atual: Math.round(metaAtual),
          pct_evolucao: metaPctEvolucao,
          falta_para_meta: Math.max(0, Math.round(metaValor - metaAtual)),
        }
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
