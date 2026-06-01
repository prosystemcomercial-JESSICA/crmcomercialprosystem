import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ownerWhere, scopeUserId } from '@/lib/scope';

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
    // Escopo: vendedor só vê os próprios leads; gestor vê todos.
    // (usa AND para não conflitar com o OR da busca textual)
    const escopo = ownerWhere(request, 'Lead');
    if (escopo.OR || escopo.responsavel_id || escopo.created_by) {
      where.AND = [...(where.AND || []), escopo];
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
      where: { ...ownerWhere(request, 'Lead') },  // vendedor: só o próprio funil
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
    // Vendedor: estatísticas só dos próprios leads; gestor: de todos.
    const esc = ownerWhere(request, 'Lead');
    const [total, novos, qualificados, ganhos, perdidos, emContato] = await Promise.all([
      prisma.lead.count({ where: { ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'NOVO_LEAD', ...esc } }),
      prisma.lead.count({ where: { status: 'QUALIFICADO', ...esc } }),
      prisma.lead.count({ where: { status: 'GANHO', ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'PERDIDO', ...esc } }),
      prisma.lead.count({ where: { etapa_comercial: 'EM_ATENDIMENTO', ...esc } }),
    ]);

    const [valorPipeline, valorGanho] = await Promise.all([
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: { notIn: ['GANHO','PERDIDO'] }, ...esc } }),
      prisma.lead.aggregate({ _sum: { valor_estimado: true }, where: { status: 'GANHO', ...esc } }),
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

  // ── Fechar venda (marcar lead como ACEITO/GANHO) ──────────────────────────
  const FechamentoSchema = z.object({
    plano: z.enum(['BASIC', 'MEI', 'PRO', 'PLUS']),
    valor_instalacao: z.number().min(0),
    mrr: z.number().min(0),
    valor_entrada: z.number().min(0),
    forma_entrada: z.enum(['PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA']),
    parcelas_instalacao: z.number().int().min(1).max(36).default(1),
    data_1cob: z.string().datetime().optional(),
    observacoes: z.string().optional()
  });

  fastify.post('/leads/:id/fechar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = FechamentoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: {
          status: 'GANHO',
          etapa_funil: 'FECHAMENTO',
          etapa_comercial: 'ACEITO',
          status_atendimento: 'ACEITO',
          fechamento_plano: body.data.plano,
          fechamento_valor_inst: body.data.valor_instalacao,
          fechamento_mrr: body.data.mrr,
          fechamento_valor_entrada: body.data.valor_entrada,
          fechamento_forma_entrada: body.data.forma_entrada,
          fechamento_parcelas_inst: body.data.parcelas_instalacao,
          fechamento_data_1cob: body.data.data_1cob ? new Date(body.data.data_1cob) : null,
          fechamento_obs: body.data.observacoes || null,
          fechamento_data: new Date(),
          fechamento_por: user?.id || 'system'
        }
      });
      await registrarObsSistema(prisma, id, 'FECHAMENTO',
        `Lead fechado — Plano ${body.data.plano} | Instalação R$ ${body.data.valor_instalacao.toFixed(2)} | MRR R$ ${body.data.mrr.toFixed(2)}`,
        user?.id);
      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // ── Métricas comerciais (MRR, instalação, médias, ranking) ────────────────
  fastify.get('/leads/metricas-comerciais', async (request, reply) => {
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const where: any = { status: 'GANHO', fechamento_data: { not: null } };
    if (q.data_inicio || q.data_fim) {
      where.fechamento_data = { not: null };
      if (q.data_inicio) where.fechamento_data.gte = new Date(q.data_inicio);
      if (q.data_fim) where.fechamento_data.lte = new Date(q.data_fim);
    }
    // Escopo: gestor vê o ranking de todos; vendedor só os próprios fechamentos.
    // fail-closed: anônimo cai em '__no_user__' (não vaza nada).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.fechamento_por = scopeId;

    const ganhos = await prisma.lead.findMany({
      where,
      select: {
        id: true, nome: true, razao_social: true,
        fechamento_plano: true, fechamento_valor_inst: true, fechamento_mrr: true,
        fechamento_valor_entrada: true, fechamento_forma_entrada: true,
        fechamento_parcelas_inst: true, fechamento_data: true, fechamento_por: true
      }
    });

    // Mapa de usuários
    const usuariosRaw: any[] = await prisma.$queryRawUnsafe(`SELECT id, nome, email, cargo FROM UsuarioCRM`);
    const userMap: Record<string, any> = {};
    for (const u of usuariosRaw) userMap[u.id] = u;
    userMap['user-jessica'] = { id: 'user-jessica', nome: 'Jessica', email: 'jessica@prosystemnet.com.br', cargo: 'CEO' };

    // Totais
    let totalInstalacao = 0, totalMRR = 0, totalEntrada = 0;
    const porPlano: Record<string, { count: number; mrr: number; inst: number }> = {};
    const porVendedor: Record<string, any> = {};
    const porForma: Record<string, number> = {};

    for (const g of ganhos) {
      const inst = Number(g.fechamento_valor_inst || 0);
      const mrr = Number(g.fechamento_mrr || 0);
      const ent = Number(g.fechamento_valor_entrada || 0);
      totalInstalacao += inst;
      totalMRR += mrr;
      totalEntrada += ent;

      const plano = g.fechamento_plano || 'OUTRO';
      if (!porPlano[plano]) porPlano[plano] = { count: 0, mrr: 0, inst: 0 };
      porPlano[plano].count += 1;
      porPlano[plano].mrr += mrr;
      porPlano[plano].inst += inst;

      const forma = g.fechamento_forma_entrada || 'OUTRO';
      porForma[forma] = (porForma[forma] || 0) + 1;

      const vid = g.fechamento_por || 'sem-vendedor';
      if (!porVendedor[vid]) {
        const u = userMap[vid] || {};
        porVendedor[vid] = {
          id: vid,
          nome: u.nome ? u.nome.split(' ')[0] : 'Vendedor',
          cargo: u.cargo || '',
          fechamentos: 0, mrr_total: 0, inst_total: 0
        };
      }
      porVendedor[vid].fechamentos += 1;
      porVendedor[vid].mrr_total += mrr;
      porVendedor[vid].inst_total += inst;
    }

    const total = ganhos.length;
    const ranking = Object.values(porVendedor).sort((a: any, b: any) => b.mrr_total - a.mrr_total);

    return reply.send({
      status: 'success',
      data: {
        total_fechamentos: total,
        total_instalacao: Math.round(totalInstalacao * 100) / 100,
        total_mrr: Math.round(totalMRR * 100) / 100,
        total_entrada: Math.round(totalEntrada * 100) / 100,
        media_instalacao: total > 0 ? Math.round((totalInstalacao / total) * 100) / 100 : 0,
        media_mrr: total > 0 ? Math.round((totalMRR / total) * 100) / 100 : 0,
        media_entrada: total > 0 ? Math.round((totalEntrada / total) * 100) / 100 : 0,
        por_plano: porPlano,
        por_forma_entrada: porForma,
        ranking_vendedores: ranking
      }
    });
  });

  // ── ZapSign: enviar contrato para assinatura ──────────────────────────────
  fastify.post('/leads/:id/enviar-contrato', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    if (!lead.fechamento_plano) {
      return reply.status(400).send({ status: 'error', message: 'Lead precisa estar fechado (status ACEITO) para enviar contrato' });
    }

    try {
      const { getTemplateIdParaPlano, criarDocPorTemplate, formatBRL, formatDate } = await import('../services/zapsign.service.js');

      const templateId = getTemplateIdParaPlano(lead.fechamento_plano);
      if (!templateId) {
        return reply.status(400).send({
          status: 'error',
          message: `Template ZapSign do plano ${lead.fechamento_plano} ainda não foi configurado. Suba o modelo no painel ZapSign e configure ZAPSIGN_TPL_${lead.fechamento_plano} no Railway.`
        });
      }

      // Busca nome do vendedor
      let vendedorNome = 'Equipe ProSystem';
      if (lead.fechamento_por) {
        const rows: any[] = await prisma.$queryRawUnsafe(`SELECT nome FROM UsuarioCRM WHERE id = ? LIMIT 1`, lead.fechamento_por);
        if (rows.length) vendedorNome = rows[0].nome;
        else if (lead.fechamento_por === 'user-jessica') vendedorNome = 'Jessica';
      }

      const data: Record<string, string> = {
        cliente_nome: lead.responsavel_nome || lead.nome || '',
        cliente_razao_social: lead.razao_social || lead.empresa || lead.nome || '',
        cliente_cnpj: lead.cnpj || '',
        cliente_endereco: lead.endereco || '',
        cliente_cidade_uf: `${lead.cidade || ''}${lead.estado ? ' / ' + lead.estado : ''}`,
        cliente_email: lead.responsavel_email || lead.email || '',
        cliente_telefone: lead.responsavel_telefone || lead.telefone || '',
        plano: lead.fechamento_plano,
        valor_instalacao: formatBRL(lead.fechamento_valor_inst || 0),
        valor_mensal_mrr: formatBRL(lead.fechamento_mrr || 0),
        valor_entrada: formatBRL(lead.fechamento_valor_entrada || 0),
        forma_pagamento_entrada: lead.fechamento_forma_entrada || '',
        parcelas_instalacao: `${lead.fechamento_parcelas_inst || 1}x`,
        data_1_cobranca: formatDate(lead.fechamento_data_1cob),
        data_assinatura: formatDate(new Date()),
        vendedor_nome: vendedorNome,
      };

      // Limpa telefone do cliente (apenas dígitos para ZapSign)
      const rawPhone = (lead.responsavel_telefone || lead.telefone || '').replace(/\D/g, '');
      const phoneCountry = rawPhone.startsWith('55') ? '55' : '55';
      const phoneNumber = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;

      const result = await criarDocPorTemplate({
        template_id: templateId,
        signer: {
          name: lead.responsavel_nome || lead.nome || 'Cliente',
          email: lead.responsavel_email || lead.email || undefined,
          phone_country: phoneCountry,
          phone_number: phoneNumber || undefined,
          auth_mode: 'assinaturaTela',
          send_via_email: !!(lead.responsavel_email || lead.email),
          send_via_whatsapp: !!phoneNumber,
        },
        data,
        doc_name: `Contrato ProSystem - ${lead.razao_social || lead.nome} - ${lead.fechamento_plano}`,
        external_id: lead.id,
      });

      // Salva referência do contrato no lead
      const updated = await prisma.lead.update({
        where: { id },
        data: {
          zapsign_doc_token: result.token || result.open_id || null,
          zapsign_doc_status: 'pending',
          zapsign_signed_url: result.signers?.[0]?.sign_url || null,
          zapsign_enviado_em: new Date(),
        }
      });

      await registrarObsSistema(prisma, id, 'CONTRATO',
        `Contrato ${lead.fechamento_plano} enviado via ZapSign para ${lead.responsavel_nome || lead.nome}.`,
        user?.id);

      return reply.send({
        status: 'success',
        data: {
          lead: updated,
          zapsign: result,
          sign_url: result.signers?.[0]?.sign_url || null
        }
      });
    } catch (err: any) {
      fastify.log.error('[ZapSign] erro: ' + (err?.message || err));
      return reply.status(500).send({ status: 'error', message: err?.message || 'Erro ao enviar contrato' });
    }
  });

  // Status do contrato (consulta direta no ZapSign)
  fastify.get('/leads/:id/contrato-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    if (!lead.zapsign_doc_token) return reply.send({ status: 'success', data: { status: 'not_sent' } });

    try {
      const { obterDoc } = await import('../services/zapsign.service.js');
      const doc = await obterDoc(lead.zapsign_doc_token);
      const novoStatus = doc.status || 'pending';

      // Atualiza status local se mudou
      if (novoStatus !== lead.zapsign_doc_status || doc.signed_file_url) {
        await prisma.lead.update({
          where: { id },
          data: {
            zapsign_doc_status: novoStatus,
            zapsign_signed_file_url: doc.signed_file_url || lead.zapsign_signed_file_url
          }
        });
      }
      return reply.send({ status: 'success', data: doc });
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err?.message });
    }
  });

  // Listar templates configurados (admin)
  fastify.get('/zapsign/templates', async (request, reply) => {
    const user = (request as any).user;
    const ADMIN = ['CEO','ADMIN','SUPERVISAO','SUPERVISAO_COMERCIAL','SUPERVISAO_TECNICA','GERENTE','DIRETOR'];
    if (!user || !ADMIN.includes((user.role || '').toUpperCase())) {
      return reply.status(403).send({ status: 'error', message: 'Apenas administradores' });
    }
    try {
      const { listarTemplates } = await import('../services/zapsign.service.js');
      const data = await listarTemplates();
      return reply.send({ status: 'success', data });
    } catch (err: any) {
      return reply.status(500).send({ status: 'error', message: err?.message });
    }
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
