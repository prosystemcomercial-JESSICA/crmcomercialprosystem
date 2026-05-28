import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const ETAPAS_COMERCIAIS = [
  'NOVO_LEAD','PRIMEIRO_CONTATO','EM_ATENDIMENTO','AGUARDANDO_RETORNO',
  'PROPOSTA_A_GERAR','PROPOSTA_ENVIADA','EM_NEGOCIACAO','ACEITO',
  'CONTRATO_EM_ANDAMENTO','CONTRATO_ASSINADO','ONBOARDING','EXECUCAO_TECNICA','PERDIDO',
] as const;

const LeadSchema = z.object({
  nome:               z.string().min(1),
  razao_social:       z.string().optional(),
  nome_fantasia:      z.string().optional(),
  cnpj:               z.string().optional(),
  empresa:            z.string().optional(),
  segmento:           z.string().optional(),
  cidade:             z.string().optional(),
  estado:             z.string().optional(),
  endereco:           z.string().optional(),
  tipo_negocio:       z.string().optional(),
  qtd_lojas:          z.number().int().optional(),
  qtd_caixas:         z.number().int().optional(),
  sistema_atual:      z.string().optional(),
  tipo_oportunidade:  z.string().optional(),

  responsavel_nome:    z.string().optional(),
  responsavel_cargo:   z.string().optional(),
  cargo:               z.string().optional(),
  responsavel_telefone:z.string().optional(),
  responsavel_email:   z.string().email().optional().or(z.literal('')),
  email:               z.string().email().optional().or(z.literal('')),
  telefone:            z.string().optional(),
  responsavel_cpf:     z.string().optional(),
  responsavel_horario: z.string().optional(),

  vendedor_nome:       z.string().optional(),
  vendedor_telefone:   z.string().optional(),
  supervisor_nome:     z.string().optional(),
  campanha:            z.string().optional(),
  plano_indicado:      z.string().optional(),
  plano_interesse:     z.string().optional(),
  valor_setup:         z.number().optional(),
  valor_conversao:     z.number().optional(),
  mensalidade_estimada:z.number().optional(),
  entrada:             z.number().optional(),
  parcelamento:        z.number().int().optional(),
  validade_proposta:   z.string().datetime().optional(),
  observacoes_comerciais: z.string().optional(),
  condicao_especial:   z.string().optional(),

  frase_hero:          z.string().optional(),
  texto_valor:         z.string().optional(),
  segmento_proposta:   z.string().optional(),
  plano_recomendado:   z.string().optional(),
  modulos_inclusos:    z.array(z.string()).optional(),
  servicos_adicionais: z.array(z.string()).optional(),

  etapa_comercial: z.enum(ETAPAS_COMERCIAIS).optional(),
  origem:          z.string().default('MANUAL'),
  status:          z.string().optional(),
  etapa_funil:     z.string().optional(),
  temperatura:     z.enum(['FRIO','MORNO','QUENTE','MUITO_QUENTE']).optional(),
  valor_estimado:  z.number().optional(),
  probabilidade:   z.number().min(0).max(100).optional(),
  motivo_perda:    z.string().optional(),
  status_atendimento: z.string().optional(),
  responsavel_id:  z.string().optional(),
  proximo_contato: z.string().datetime().optional(),
  observacoes:     z.string().optional(),

  // UTM / campanha
  utm_source:    z.string().optional(),
  utm_medium:    z.string().optional(),
  utm_campaign:  z.string().optional(),
  utm_content:   z.string().optional(),
  utm_term:      z.string().optional(),
  fbclid:        z.string().optional(),
  gclid:         z.string().optional(),
  campaign_id:   z.string().optional(),
  adset_id:      z.string().optional(),
  ad_id:         z.string().optional(),
  campanha_nome: z.string().optional(),
  conjunto_nome: z.string().optional(),
  anuncio_nome:  z.string().optional(),
  plataforma:    z.string().optional(),
  link_origem:   z.string().optional(),
});

const UpdateLeadSchema = LeadSchema.partial();

const ListLeadSchema = z.object({
  page:            z.coerce.number().default(0),
  limit:           z.coerce.number().default(50),
  status:          z.string().optional(),
  etapa_comercial: z.string().optional(),
  etapa_funil:     z.string().optional(),
  temperatura:     z.string().optional(),
  search:          z.string().optional(),
  responsavel_id:  z.string().optional(),
});

const ObservacaoSchema = z.object({
  tipo:                 z.string().min(1),
  descricao:            z.string().min(1),
  proxima_acao:         z.string().optional(),
  data_proximo_retorno: z.string().datetime().optional(),
  status_apos:          z.string().optional(),
  created_by_name:      z.string().optional(),
});

const OnboardingSchema = z.object({
  data_prevista_implantacao:   z.string().datetime().optional(),
  data_virada:                 z.string().optional(),
  sistema_anterior:            z.string().optional(),
  necessita_conversao:         z.boolean().optional(),
  responsavel_interno_nome:    z.string().optional(),
  responsavel_interno_telefone:z.string().optional(),
  horario_contato:             z.string().optional(),
  qtd_maquinas:                z.number().int().optional(),
  qtd_usuarios:                z.number().int().optional(),
  tem_certificado:             z.boolean().optional(),
  tem_contador:                z.boolean().optional(),
  nome_contador:               z.string().optional(),
  contato_contador:            z.string().optional(),
  usa_fiscal:                  z.boolean().optional(),
  usa_tef:                     z.boolean().optional(),
  usa_balanca:                 z.boolean().optional(),
  usa_etiqueta:                z.boolean().optional(),
  usa_convenio:                z.boolean().optional(),
  observacoes_tecnicas:        z.string().optional(),
  status:                      z.string().optional(),
});

const ExecucaoSchema = z.object({
  tecnico_nome:              z.string().optional(),
  tecnico_id:                z.string().optional(),
  supervisora_nome:          z.string().optional(),
  data_prevista_inicio:      z.string().datetime().optional(),
  data_prevista_conclusao:   z.string().datetime().optional(),
  prioridade:                z.enum(['BAIXA','NORMAL','ALTA','URGENTE']).optional(),
  tipo_execucao:             z.string().optional(),
  status:                    z.string().optional(),
  observacoes_supervisao:    z.string().optional(),
  checklist:                 z.any().optional(),
});

async function registrarObsSistema(
  prisma: PrismaClient,
  leadId: string,
  tipo: string,
  descricao: string,
  userId = 'system',
) {
  await prisma.leadObservacao.create({
    data: { lead_id: leadId, tipo, descricao, created_by: userId, created_by_name: 'Sistema' },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { ultima_obs_at: new Date() } });
}

export async function leadsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ── List leads ────────────────────────────────────────────────────────────
  fastify.get('/leads', async (request, reply) => {
    const q = ListLeadSchema.safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const { page, limit, status, etapa_comercial, etapa_funil, temperatura, search, responsavel_id } = q.data;

    const where: any = {};
    if (status) where.status = status;
    if (etapa_comercial) where.etapa_comercial = etapa_comercial;
    if (etapa_funil) where.etapa_funil = etapa_funil;
    if (temperatura) where.temperatura = temperatura;
    if (responsavel_id) where.responsavel_id = responsavel_id;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { razao_social: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
        { responsavel_email: { contains: search, mode: 'insensitive' } },
        { responsavel_telefone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where, skip: page * limit, take: limit,
        orderBy: { updated_at: 'desc' },
        include: { _count: { select: { atividades: true, propostas: true, observacoes_lead: true } } },
      }),
      prisma.lead.count({ where }),
    ]);

    return reply.send({ status: 'success', data: { leads, total, page, limit } });
  });

  // ── Kanban — all leads grouped by etapa_comercial ─────────────────────────
  fastify.get('/leads/kanban', async (request, reply) => {
    const leads = await prisma.lead.findMany({
      orderBy: { updated_at: 'desc' },
      include: {
        _count: { select: { atividades: true, propostas: true, observacoes_lead: true } },
        execucao: { select: { status: true, tecnico_nome: true } },
        etiquetas_lead: {
          include: { etiqueta: { select: { id: true, nome: true, cor: true } } },
        },
      },
    });

    // Fetch all active columns from DB (user-configured)
    const colunas = await prisma.kanbanColuna.findMany({
      where: { ativa: true }, orderBy: { ordem: 'asc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const col of colunas) grouped[col.chave] = [];

    for (const lead of leads) {
      if (!grouped[lead.etapa_comercial]) grouped[lead.etapa_comercial] = [];
      grouped[lead.etapa_comercial].push(lead);
    }

    return reply.send({ status: 'success', data: { leads: grouped, colunas } });
  });

  // ── Lead detail ───────────────────────────────────────────────────────────
  fastify.get('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        atividades:    { orderBy: { created_at: 'desc' } },
        propostas:     { orderBy: { created_at: 'desc' } },
        contrato:      true,
        onboarding:    true,
        execucao:      true,
        observacoes_lead: { orderBy: { created_at: 'desc' } },
        etiquetas_lead: { include: { etiqueta: true } },
        _count: { select: { atividades: true, propostas: true, observacoes_lead: true } },
      },
    });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    return reply.send({ status: 'success', data: lead });
  });

  // ── Create lead ───────────────────────────────────────────────────────────
  fastify.post('/leads', async (request, reply) => {
    const body = LeadSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.email === '') delete data.email;
    if (data.responsavel_email === '') delete data.responsavel_email;
    // Campos Json obrigatórios no schema — default vazio
    if (data.modulos_inclusos === undefined) data.modulos_inclusos = {};
    if (data.servicos_adicionais === undefined) data.servicos_adicionais = {};

    const lead = await prisma.lead.create({ data });

    await registrarObsSistema(prisma, lead.id, 'SISTEMA', 'Lead cadastrado no CRM.', user?.id);

    return reply.status(201).send({ status: 'success', data: lead });
  });

  // ── Update lead ───────────────────────────────────────────────────────────
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateLeadSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    try {
      const data: any = { ...body.data };
      if (data.email === '') delete data.email;
      if (data.responsavel_email === '') delete data.responsavel_email;

      const before = await prisma.lead.findUnique({
        where: { id },
        select: { etapa_comercial: true, status: true, temperatura: true },
      });
      const lead = await prisma.lead.update({ where: { id }, data });

      // Auto-register column change
      if (before && data.etapa_comercial && data.etapa_comercial !== before.etapa_comercial) {
        await prisma.leadObservacao.create({
          data: {
            lead_id: id, tipo: 'SISTEMA',
            descricao: `Coluna alterada: ${before.etapa_comercial} → ${data.etapa_comercial}`,
            coluna_anterior: before.etapa_comercial,
            coluna_nova: data.etapa_comercial,
            created_by: user?.id || 'system', created_by_name: 'Sistema',
          },
        });
        await prisma.lead.update({ where: { id }, data: { ultima_obs_at: new Date() } });
      }

      // Auto-register temperature change
      if (before && data.temperatura && data.temperatura !== before.temperatura) {
        await prisma.leadObservacao.create({
          data: {
            lead_id: id, tipo: 'SISTEMA',
            descricao: `Temperatura alterada: ${before.temperatura} → ${data.temperatura}`,
            temperatura_anterior: before.temperatura,
            temperatura_nova: data.temperatura,
            created_by: user?.id || 'system', created_by_name: 'Sistema',
          },
        });
        await prisma.lead.update({ where: { id }, data: { ultima_obs_at: new Date() } });
      }

      // Auto update status_atendimento when moving to PERDIDO
      if (data.etapa_comercial === 'PERDIDO' && !data.status_atendimento) {
        await prisma.lead.update({ where: { id }, data: { status_atendimento: 'PERDIDO' } });
      }

      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // ── Delete lead ───────────────────────────────────────────────────────────
  fastify.delete('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.lead.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Lead removido' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // ── Observações (timeline) ────────────────────────────────────────────────
  fastify.get('/leads/:id/observacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const obs = await prisma.leadObservacao.findMany({
      where: { lead_id: id },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: obs });
  });

  fastify.post('/leads/:id/observacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ObservacaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const obs = await prisma.leadObservacao.create({
      data: {
        lead_id: id,
        ...body.data,
        created_by: user?.id || 'system',
        created_by_name: body.data.created_by_name || user?.nome || 'Usuário',
      },
    });

    const update: any = { ultima_obs_at: new Date() };
    if (body.data.data_proximo_retorno) update.proximo_contato = new Date(body.data.data_proximo_retorno);
    if (body.data.status_apos) {
      const etapaMap: Record<string, string> = {
        'EM_NEGOCIACAO': 'EM_NEGOCIACAO', 'ACEITO': 'ACEITO',
        'PROPOSTA_ENVIADA': 'PROPOSTA_ENVIADA', 'PERDIDO': 'PERDIDO',
      };
      if (etapaMap[body.data.status_apos]) update.etapa_comercial = etapaMap[body.data.status_apos];
    }
    await prisma.lead.update({ where: { id }, data: update });

    return reply.status(201).send({ status: 'success', data: obs });
  });

  // ── Onboarding ────────────────────────────────────────────────────────────
  fastify.get('/leads/:id/onboarding', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ob = await prisma.leadOnboarding.findUnique({ where: { lead_id: id } });
    return reply.send({ status: 'success', data: ob });
  });

  fastify.put('/leads/:id/onboarding', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = OnboardingSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const data: any = { ...body.data };
    if (data.data_prevista_implantacao) data.data_prevista_implantacao = new Date(data.data_prevista_implantacao);

    const ob = await prisma.leadOnboarding.upsert({
      where:  { lead_id: id },
      create: { lead_id: id, ...data, created_by: user?.id || 'system' },
      update: data,
    });

    if (data.status === 'CONCLUIDO') {
      await registrarObsSistema(prisma, id, 'SISTEMA', 'Onboarding concluído.', user?.id);
    }

    return reply.send({ status: 'success', data: ob });
  });

  // ── Enviar para execução técnica ──────────────────────────────────────────
  fastify.post('/leads/:id/enviar-execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.execucaoTecnica.findUnique({ where: { lead_id: id } });
    if (!existing) {
      await prisma.execucaoTecnica.create({
        data: { lead_id: id, status: 'AGUARDANDO_DESIGNACAO', created_by: user?.id || 'system' },
      });
    }
    await prisma.lead.update({ where: { id }, data: { etapa_comercial: 'EXECUCAO_TECNICA' } });
    await registrarObsSistema(prisma, id, 'SISTEMA', 'Card enviado para Execução Técnica.', user?.id);

    return reply.send({ status: 'success', message: 'Enviado para execução' });
  });

  // ── Execução técnica ──────────────────────────────────────────────────────
  fastify.get('/leads/:id/execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ex = await prisma.execucaoTecnica.findUnique({ where: { lead_id: id } });
    return reply.send({ status: 'success', data: ex });
  });

  fastify.put('/leads/:id/execucao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ExecucaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const data: any = { ...body.data };
    if (data.data_prevista_inicio)    data.data_prevista_inicio    = new Date(data.data_prevista_inicio);
    if (data.data_prevista_conclusao) data.data_prevista_conclusao = new Date(data.data_prevista_conclusao);

    const ex = await prisma.execucaoTecnica.upsert({
      where:  { lead_id: id },
      create: { lead_id: id, ...data, created_by: user?.id || 'system' },
      update: data,
    });

    if (data.tecnico_nome) {
      await registrarObsSistema(prisma, id, 'SISTEMA', `Técnico designado: ${data.tecnico_nome}.`, user?.id);
    }
    if (data.status === 'FINALIZADO') {
      await registrarObsSistema(prisma, id, 'SISTEMA', 'Execução técnica finalizada.', user?.id);
    }

    return reply.send({ status: 'success', data: ex });
  });

  // ── Gerar proposta a partir do lead ──────────────────────────────────────
  fastify.post('/leads/:id/gerar-proposta', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    const crypto = await import('crypto');
    const token = crypto.default.randomBytes(20).toString('hex');

    const proposta = await prisma.propostaComercial.create({
      data: {
        razao_social:      lead.razao_social || lead.empresa || lead.nome,
        nome_fantasia:     lead.nome_fantasia || undefined,
        cnpj:              lead.cnpj || undefined,
        segmento:          lead.segmento || undefined,
        cidade:            lead.cidade || undefined,
        estado:            lead.estado || undefined,
        maquinas:          lead.qtd_caixas || undefined,
        tipo_loja:         lead.tipo_oportunidade || undefined,
        sistema_atual:     lead.sistema_atual || undefined,
        responsavel_nome:  lead.responsavel_nome || lead.nome,
        responsavel_telefone: lead.responsavel_telefone || lead.telefone || undefined,
        responsavel_email: lead.responsavel_email || lead.email || undefined,
        responsavel_cargo: lead.responsavel_cargo || lead.cargo || undefined,
        responsavel_horario: lead.responsavel_horario || undefined,
        vendedor_nome:     lead.vendedor_nome || undefined,
        vendedor_telefone: lead.vendedor_telefone || undefined,
        supervisor_nome:   lead.supervisor_nome || undefined,
        campanha:          lead.campanha || undefined,
        validade:          lead.validade_proposta || undefined,
        origem:            lead.origem || undefined,
        plano_selecionado: lead.plano_indicado || undefined,
        plano_recomendado: lead.plano_recomendado || undefined,
        mensalidade_plus:  lead.mensalidade_estimada || undefined,
        modulos_inclusos:  lead.modulos_inclusos,
        servicos_adicionais: lead.servicos_adicionais,
        valor_implantacao: lead.valor_setup || undefined,
        valor_conversao:   lead.valor_conversao || undefined,
        entrada:           lead.entrada || undefined,
        parcelas:          lead.parcelamento || undefined,
        condicao_especial: lead.condicao_especial || undefined,
        observacoes_comerciais: lead.observacoes_comerciais || undefined,
        frase_hero:        lead.frase_hero || undefined,
        texto_valor:       lead.texto_valor || undefined,
        public_token:      token,
        status:            'RASCUNHO',
        created_by:        user?.id || 'system',
        created_by_name:   user?.nome || undefined,
      },
    });

    await prisma.lead.update({ where: { id }, data: { etapa_comercial: 'PROPOSTA_A_GERAR' } });
    await registrarObsSistema(prisma, id, 'SISTEMA', `Proposta gerada automaticamente (ID: ${proposta.id}).`, user?.id);

    return reply.status(201).send({ status: 'success', data: proposta });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  fastify.get('/leads/stats/resumo', async (request, reply) => {
    const [total, novos, qualificados, ganhos, perdidos, emContato] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { etapa_comercial: 'NOVO_LEAD' } }),
      prisma.lead.count({ where: { status: 'QUALIFICADO' } }),
      prisma.lead.count({ where: { status: 'GANHO' } }),
      prisma.lead.count({ where: { etapa_comercial: 'PERDIDO' } }),
      prisma.lead.count({ where: { etapa_comercial: 'EM_ATENDIMENTO' } }),
    ]);

    const [valorPipeline, valorGanho] = await Promise.all([
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: { notIn: ['GANHO','PERDIDO'] } } }),
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: 'GANHO' } }),
    ]);

    return reply.send({
      status: 'success',
      data: {
        total, novos, qualificados, ganhos, perdidos, emContato,
        valor_pipeline: valorPipeline._sum.valor_estimado || 0,
        valor_ganho:    valorGanho._sum.valor_estimado || 0,
        taxa_conversao: total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0',
      },
    });
  });

  // ── Funil (legado) ────────────────────────────────────────────────────────
  fastify.get('/leads/funil', async (request, reply) => {
    const etapas = ['PROSPECCAO','QUALIFICACAO','APRESENTACAO','PROPOSTA','NEGOCIACAO','FECHAMENTO'];
    const funil = await Promise.all(etapas.map(async (etapa) => {
      const leads = await prisma.lead.findMany({
        where: { etapa_funil: etapa, status: { notIn: ['GANHO','PERDIDO'] } },
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { atividades: true, propostas: true } } },
      });
      return { etapa, leads, total: leads.length, valor_total: leads.reduce((s, l) => s + (l.valor_estimado || 0), 0) };
    }));
    return reply.send({ status: 'success', data: funil });
  });
}
