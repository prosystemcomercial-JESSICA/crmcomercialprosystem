import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { enviarEmailConfirmacaoAgendamento } from '../services/email.service';
import { ownerWhere } from '@/lib/scope';

const STATUS = ['PENDENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REMARCADA', 'CLIENTE_NAO_COMPARECEU', 'AGUARDANDO_RETORNO'] as const;
const TIPOS = ['LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA', 'OUTRO'] as const;
const VINCULO_TIPOS = ['LEAD', 'PARCEIRO', 'INTERNO', 'MARKETING', 'EXTERNO', 'NENHUM'] as const;

const CreateAtividadeSchema = z.object({
  // lead_id é opcional: compromisso pode ser com parceiro/interno/marketing ou sem vínculo
  lead_id: z.string().optional().nullable(),
  vinculo_tipo: z.enum(VINCULO_TIPOS).optional(),
  vinculo_nome: z.string().optional(),
  link_externo: z.string().optional(),
  tipo: z.enum(TIPOS),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  resumo_reuniao: z.string().optional(),
  responsavel_id: z.string().optional(),
  data_prevista: z.string().datetime().optional(),
  google_meet_link: z.string().optional(),
  convidados_ids: z.array(z.string()).optional()
}).refine(
  // Se for LEAD, exige lead_id; senão exige um nome do vínculo (exceto NENHUM).
  (d) => {
    const t = d.vinculo_tipo || (d.lead_id ? 'LEAD' : 'NENHUM');
    if (t === 'LEAD') return !!d.lead_id;
    if (t === 'NENHUM') return true;
    return !!(d.vinculo_nome && d.vinculo_nome.trim());
  },
  { message: 'Informe o lead ou o nome do vínculo do compromisso' }
);

const UpdateAtividadeSchema = z.object({
  titulo: z.string().optional(),
  vinculo_tipo: z.enum(VINCULO_TIPOS).optional(),
  vinculo_nome: z.string().optional(),
  link_externo: z.string().optional(),
  descricao: z.string().optional(),
  resumo_reuniao: z.string().optional(),
  status: z.enum(STATUS).optional(),
  resultado: z.string().optional(),
  data_prevista: z.string().datetime().optional(),
  data_realizada: z.string().datetime().optional(),
  responsavel_id: z.string().optional(),
  google_meet_link: z.string().optional(),
  transcricao: z.string().optional(),
  transcricao_origem: z.enum(['AUTOMATICA', 'MANUAL']).optional(),
  convidados_ids: z.array(z.string()).optional()
});

const ReagendarSchema2 = z.object({
  data_prevista: z.string().datetime()
});

const ListAtividadeSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(50),
  status: z.string().optional(),
  tipo: z.string().optional(),
  responsavel_id: z.string().optional(),
  lead_id: z.string().optional()
});

const PERCEPCAO_TAGS = [
  'PRODUTIVA', 'POUCO_COMUNICATIVA', 'CLIENTE_NAO_ANIMADO', 'COM_OBJECOES',
  'CLIENTE_INTERESSADO', 'TECNICA_DEMO', 'AVANCOU_FUNIL', 'SEM_DECISAO'
] as const;

const ConcluirSchema = z.object({
  resultado: z.string().min(1),
  duracao_minutos: z.number().optional(),
  data_realizada: z.string().datetime().optional(),
  percepcao_tags: z.array(z.enum(PERCEPCAO_TAGS)).optional(),
  percepcao_nota: z.number().int().min(1).max(5).optional(),
  percepcao_observ: z.string().optional()
});

const CancelarSchema = z.object({
  motivo_cancelamento: z.string().min(1)
});

const ReagendarSchema = z.object({
  nova_data_remarcada: z.string().datetime(),
  motivo: z.string().optional()
});

const RelatorioSchema = z.object({
  data_inicio: z.string().datetime().optional(),
  data_fim: z.string().datetime().optional(),
  responsavel_id: z.string().optional(),
  status: z.string().optional(),
  tipo: z.string().optional(),
  lead_id: z.string().optional()
});

export async function atividadesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Gestores enxergam a agenda de todos; demais (vendedor/técnico N1) só a própria.
  // IMPORTANTE: fail-closed — sem usuário autenticado NÃO é admin (não vaza tudo).
  const ADMIN_ROLES = ['CEO', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'GERENTE', 'DIRETOR'];
  const isAdmin = (user: any) => !!user && ADMIN_ROLES.includes((user?.role || '').toUpperCase());

  // List all atividades
  fastify.get('/atividades', async (request, reply) => {
    const query = ListAtividadeSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, tipo, responsavel_id, lead_id } = query.data;
    const user = (request as any).user;

    const where: any = {};
    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (tipo) {
      const tipos = tipo.split(',').map((t: string) => t.trim()).filter(Boolean);
      where.tipo = tipos.length === 1 ? tipos[0] : { in: tipos };
    }
    if (lead_id) where.lead_id = lead_id;

    // Monta o filtro "minhas atividades" (responsável OU criador). O filtro de
    // convidado (JSON array) é aplicado DEPOIS, em memória, porque string_contains/
    // array_contains em coluna JSON varia entre versões do MySQL e pode derrubar a
    // query inteira — o que deixava a agenda VAZIA para todos que não são admin.
    let filtrarConvidadoPara: string | null = null;
    if (!isAdmin(user)) {
      const userId = user?.id;
      // fail-closed: sem usuário autenticado não vê nada (não vaza tudo).
      if (!userId) return reply.send({ status: 'success', data: { atividades: [], total: 0, page, limit } });
      if (responsavel_id && responsavel_id !== userId) {
        return reply.send({ status: 'success', data: { atividades: [], total: 0, page, limit } });
      }
      where.OR = [{ responsavel_id: userId }, { created_by: userId }];
      filtrarConvidadoPara = userId;
    } else if (responsavel_id) {
      where.OR = [{ responsavel_id }, { created_by: responsavel_id }];
      filtrarConvidadoPara = responsavel_id;
    }

    try {
      // Quando há filtro por convidado, busca um conjunto maior e filtra em memória
      // (próprias OU convidado). Sem filtro de escopo (admin), pagina normalmente.
      const semEscopo = !where.OR;
      const take = semEscopo ? limit : Math.max(limit, 500);
      const skip = semEscopo ? page * limit : 0;

      const baseWhere = { ...where };
      if (filtrarConvidadoPara) delete baseWhere.OR; // reabre o escopo p/ incluir convidado

      const todas = await prisma.atividade.findMany({
        where: semEscopo ? where : baseWhere,
        skip,
        take,
        orderBy: [{ data_prevista: 'asc' }, { created_at: 'desc' }],
        include: { lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } } },
      });

      let lista = todas;
      if (filtrarConvidadoPara) {
        const uid = filtrarConvidadoPara;
        lista = todas.filter((a: any) => {
          if (a.responsavel_id === uid || a.created_by === uid) return true;
          const conv = Array.isArray(a.convidados_ids) ? a.convidados_ids : [];
          return conv.includes(uid);
        });
      }

      const total = lista.length;
      const pageItems = filtrarConvidadoPara ? lista.slice(page * limit, page * limit + limit) : lista;
      return reply.send({ status: 'success', data: { atividades: pageItems, total, page, limit } });
    } catch (err: any) {
      console.error('[GET /atividades]', err?.message);
      return reply.status(500).send({ status: 'error', message: 'Erro ao listar atividades' });
    }
  });

  // Get single atividade
  fastify.get('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const atividade = await prisma.atividade.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
      }
    });
    if (!atividade) return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
    return reply.send({ status: 'success', data: atividade });
  });

  // Create atividade
  fastify.post('/atividades', async (request, reply) => {
    const body = CreateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const userId = user?.id || 'system';
    const data: any = {
      ...body.data,
      created_by: userId,
      responsavel_id: body.data.responsavel_id || userId
    };
    // Normaliza vínculo: sem lead_id → não é LEAD; string vazia vira null.
    if (!data.lead_id) data.lead_id = null;
    if (!data.vinculo_tipo) data.vinculo_tipo = data.lead_id ? 'LEAD' : 'NENHUM';
    if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);
    if (data.convidados_ids !== undefined) data.convidados_ids = data.convidados_ids;

    const atividade = await prisma.atividade.create({
      data,
      include: { lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } } }
    });

    // Envia e-mail de confirmação imediato para reuniões com e-mail do lead
    if (atividade.tipo === 'REUNIAO' && atividade.lead?.email && atividade.data_prevista) {
      const responsavel = user?.nome || user?.name || user?.email || undefined;
      enviarEmailConfirmacaoAgendamento({
        cliente_nome: atividade.lead.nome,
        cliente_email: atividade.lead.email,
        cliente_empresa: atividade.lead.empresa || undefined,
        responsavel_nome: responsavel,
        titulo: atividade.titulo,
        data_prevista: atividade.data_prevista,
        duracao_minutos: atividade.duracao_minutos || undefined,
        meet_link: atividade.google_meet_link || undefined,
        descricao: atividade.descricao || undefined,
      }).then(() => {
        prisma.atividade.update({
          where: { id: atividade.id },
          data: { email_confirmacao_em: new Date() }
        }).catch(() => {});
      }).catch((err: any) => fastify.log.warn('Email confirmação falhou: ' + err?.message));
    }

    return reply.status(201).send({ status: 'success', data: atividade });
  });

  // Update atividade
  fastify.patch('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);
      if (data.data_realizada) data.data_realizada = new Date(data.data_realizada);
      const atividade = await prisma.atividade.update({ where: { id }, data });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Métricas de atividades (agendadas/realizadas/canceladas/no-show)
  fastify.get('/atividades/metricas', async (request, reply) => {
    const query = request.query as { data_inicio?: string; data_fim?: string; tipo?: string };
    const user = (request as any).user;

    const where: any = {};
    if (query.tipo) where.tipo = query.tipo;
    if (query.data_inicio || query.data_fim) {
      where.data_prevista = {};
      if (query.data_inicio) where.data_prevista.gte = new Date(query.data_inicio);
      if (query.data_fim) where.data_prevista.lte = new Date(query.data_fim);
    }
    if (!isAdmin(user)) {
      const uid = user?.id;
      where.OR = [{ responsavel_id: uid }, { created_by: uid }];
    }

    const grouped = await prisma.atividade.groupBy({
      by: ['status', 'tipo'],
      where,
      _count: { _all: true }
    });

    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const byStatus: Record<string, number> = {};
    const byTipo: Record<string, Record<string, number>> = {};

    for (const g of grouped) {
      byStatus[g.status] = (byStatus[g.status] || 0) + g._count._all;
      if (!byTipo[g.tipo]) byTipo[g.tipo] = {};
      byTipo[g.tipo][g.status] = g._count._all;
    }

    const agendadas = (byStatus.PENDENTE || 0) + (byStatus.CONFIRMADA || 0);
    const realizadas = byStatus.REALIZADA || 0;
    const canceladas = byStatus.CANCELADA || 0;
    const naoCompareceu = byStatus.CLIENTE_NAO_COMPARECEU || 0;
    const remarcadas = byStatus.REMARCADA || 0;

    const concluidas = realizadas + canceladas + naoCompareceu;
    const taxaSucesso = concluidas > 0 ? Math.round((realizadas / concluidas) * 100) : 0;
    const taxaNoShow = concluidas > 0 ? Math.round((naoCompareceu / concluidas) * 100) : 0;
    const taxaCancelamento = concluidas > 0 ? Math.round((canceladas / concluidas) * 100) : 0;

    return reply.send({
      status: 'success',
      data: {
        total,
        agendadas,
        realizadas,
        canceladas,
        nao_compareceu: naoCompareceu,
        remarcadas,
        taxa_sucesso: taxaSucesso,
        taxa_no_show: taxaNoShow,
        taxa_cancelamento: taxaCancelamento,
        by_status: byStatus,
        by_tipo: byTipo
      }
    });
  });

  // Dashboard de produtividade por usuário (admin only)
  fastify.get('/atividades/dashboard-produtividade', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdmin(user)) {
      return reply.status(403).send({ status: 'error', message: 'Apenas administradores' });
    }

    const query = request.query as { data_inicio?: string; data_fim?: string; responsavel_id?: string };
    const where: any = {};
    if (query.data_inicio || query.data_fim) {
      where.data_prevista = {};
      if (query.data_inicio) where.data_prevista.gte = new Date(query.data_inicio);
      if (query.data_fim) where.data_prevista.lte = new Date(query.data_fim);
    }
    if (query.responsavel_id) {
      where.OR = [
        { responsavel_id: query.responsavel_id },
        { created_by: query.responsavel_id }
      ];
    }

    // Busca todas as atividades via Prisma (evita problema de collation no JOIN)
    const atividades = await prisma.atividade.findMany({
      where,
      select: {
        responsavel_id: true, created_by: true, status: true, tipo: true,
        percepcao_nota: true, percepcao_tags: true
      }
    });

    // Busca todos os usuários numa query separada (escapa do collation issue)
    const usuariosRaw: any[] = await prisma.$queryRawUnsafe(`SELECT id, nome, email, cargo FROM UsuarioCRM`);
    const usuariosMap: Record<string, any> = {};
    for (const u of usuariosRaw) usuariosMap[u.id] = u;
    // Inclui Jessica (mock) também
    usuariosMap['user-jessica'] = { id: 'user-jessica', nome: 'Jessica', email: 'jessica@prosystemnet.com.br', cargo: 'CEO' };

    // Agrupa em memória — confiável e sem dependência de collation
    const porUsuario: Record<string, any> = {};
    for (const a of atividades) {
      // Atribui ao responsável; se não houver, ao criador
      const uid = a.responsavel_id || a.created_by || 'sem-responsavel';
      const userInfo = usuariosMap[uid] || { nome: 'Sem responsável', email: '', cargo: '' };
      if (!porUsuario[uid]) {
        porUsuario[uid] = {
          id: uid,
          nome: userInfo.nome,
          email: userInfo.email,
          cargo: userInfo.cargo,
          total: 0, agendadas: 0, realizadas: 0, canceladas: 0,
          nao_compareceu: 0, remarcadas: 0,
          reunioes: 0, ligacoes: 0, visitas: 0, tarefas: 0,
          nota_media: null, notas_count: 0, notas_sum: 0
        };
      }
      const u = porUsuario[uid];
      u.total += 1;
      if (a.status === 'PENDENTE' || a.status === 'CONFIRMADA') u.agendadas += 1;
      if (a.status === 'REALIZADA') u.realizadas += 1;
      if (a.status === 'CANCELADA') u.canceladas += 1;
      if (a.status === 'CLIENTE_NAO_COMPARECEU') u.nao_compareceu += 1;
      if (a.status === 'REMARCADA') u.remarcadas += 1;
      if (a.tipo === 'REUNIAO') u.reunioes += 1;
      if (a.tipo === 'LIGACAO') u.ligacoes += 1;
      if (a.tipo === 'VISITA') u.visitas += 1;
      if (a.tipo === 'TAREFA') u.tarefas += 1;
      if (a.percepcao_nota != null) {
        u.notas_sum += Number(a.percepcao_nota);
        u.notas_count += 1;
      }
    }

    // Calcula taxa de sucesso e nota média
    const ranking = Object.values(porUsuario).map((u: any) => {
      const concluidas = u.realizadas + u.canceladas + u.nao_compareceu;
      u.taxa_sucesso = concluidas > 0 ? Math.round((u.realizadas / concluidas) * 100) : 0;
      u.taxa_no_show = concluidas > 0 ? Math.round((u.nao_compareceu / concluidas) * 100) : 0;
      u.nota_media = u.notas_count > 0 ? Math.round((u.notas_sum / u.notas_count) * 10) / 10 : null;
      delete u.notas_sum; delete u.notas_count;
      return u;
    }).sort((a: any, b: any) => b.realizadas - a.realizadas);

    // Distribuição de percepções (consolidado) — só onde tags foi preenchido
    const reunioesRealizadas = await prisma.atividade.findMany({
      where: { ...where, status: 'REALIZADA', tipo: 'REUNIAO' },
      select: { percepcao_tags: true, percepcao_nota: true }
    });

    const tagsCount: Record<string, number> = {};
    let notasSum = 0; let notasN = 0;
    for (const r of reunioesRealizadas) {
      const tags = (r.percepcao_tags as string[] | null) || [];
      for (const t of tags) tagsCount[t] = (tagsCount[t] || 0) + 1;
      if (r.percepcao_nota) { notasSum += r.percepcao_nota; notasN++; }
    }

    return reply.send({
      status: 'success',
      data: {
        ranking,
        total_usuarios: ranking.length,
        percepcoes: { tags: tagsCount, nota_media_geral: notasN > 0 ? Math.round((notasSum / notasN) * 10) / 10 : null }
      }
    });
  });

  // Reagendar atividade (um clique — copia para nova data)
  fastify.post('/atividades/:id/reagendar-rapido', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReagendarSchema2.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Data inválida' });

    try {
      const original = await prisma.atividade.findUnique({ where: { id } });
      if (!original) return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });

      const user = (request as any).user;
      const nova = await prisma.atividade.create({
        data: {
          lead_id: original.lead_id,
          tipo: original.tipo,
          titulo: original.titulo,
          descricao: original.descricao,
          duracao_minutos: original.duracao_minutos,
          responsavel_id: original.responsavel_id,
          data_prevista: new Date(body.data.data_prevista),
          status: 'PENDENTE',
          created_by: user?.id || 'system'
        }
      });

      // Preserva o status original.
      // - Se for CANCELADA ou CLIENTE_NAO_COMPARECEU → mantém o status (NÃO sobrescreve)
      //   apenas registra a nova_data_remarcada para rastreamento
      // - Se for PENDENTE/CONFIRMADA → marca como REMARCADA (reagendamento voluntário)
      const statusPreserva = ['CANCELADA', 'CLIENTE_NAO_COMPARECEU', 'REALIZADA'];
      const novoStatusOriginal = statusPreserva.includes(original.status) ? original.status : 'REMARCADA';

      await prisma.atividade.update({
        where: { id },
        data: {
          status: novoStatusOriginal,
          nova_data_remarcada: new Date(body.data.data_prevista)
        }
      });

      return reply.status(201).send({ status: 'success', data: nova });
    } catch (err: any) {
      throw err;
    }
  });

  // Delete atividade
  fastify.delete('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.atividade.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Atividade removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // ── Status Transitions ────────────────────────────────

  // Concluir atividade
  fastify.post('/atividades/:id/concluir', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ConcluirSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const data: any = {
        status: 'REALIZADA',
        resultado: body.data.resultado,
        data_realizada: body.data.data_realizada ? new Date(body.data.data_realizada) : new Date()
      };
      if (body.data.duracao_minutos !== undefined) data.duracao_minutos = body.data.duracao_minutos;
      if (body.data.percepcao_tags !== undefined) data.percepcao_tags = body.data.percepcao_tags;
      if (body.data.percepcao_nota !== undefined) data.percepcao_nota = body.data.percepcao_nota;
      if (body.data.percepcao_observ !== undefined) data.percepcao_observ = body.data.percepcao_observ;

      const atividade = await prisma.atividade.update({ where: { id }, data });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Cancelar atividade
  fastify.post('/atividades/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CancelarSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Motivo obrigatório' });

    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: { status: 'CANCELADA', motivo_cancelamento: body.data.motivo_cancelamento }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Remarcar atividade
  fastify.post('/atividades/:id/remarcar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReagendarSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Nova data obrigatória' });

    try {
      const novaData = new Date(body.data.nova_data_remarcada);
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'REMARCADA',
          nova_data_remarcada: novaData,
          data_prevista: novaData,
          resultado: body.data.motivo ? `Remarcado: ${body.data.motivo}` : undefined
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Confirmar reunião
  fastify.post('/atividades/:id/confirmar', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: { status: 'CONFIRMADA' }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // ── Relatório ─────────────────────────────────────────

  fastify.get('/atividades/relatorio', async (request, reply) => {
    const query = RelatorioSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Parâmetros inválidos' });

    const where: any = {};
    if (query.data.data_inicio || query.data.data_fim) {
      where.data_prevista = {};
      if (query.data.data_inicio) where.data_prevista.gte = new Date(query.data.data_inicio);
      if (query.data.data_fim) where.data_prevista.lte = new Date(query.data.data_fim);
    }
    if (query.data.responsavel_id) where.responsavel_id = query.data.responsavel_id;
    if (query.data.status) where.status = query.data.status;
    if (query.data.tipo) where.tipo = query.data.tipo;
    if (query.data.lead_id) where.lead_id = query.data.lead_id;
    // Vendedor só vê o próprio relatório; gestor vê tudo.
    Object.assign(where, ownerWhere(request, 'Atividade'));

    const [atividades, totalPorStatus, totalPorTipo] = await Promise.all([
      prisma.atividade.findMany({
        where,
        orderBy: { data_prevista: 'desc' },
        include: {
          lead: { select: { id: true, nome: true, empresa: true } }
        }
      }),
      prisma.atividade.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.atividade.groupBy({ by: ['tipo'], where, _count: { id: true } })
    ]);

    const reunioes = atividades.filter(a => a.tipo === 'REUNIAO');
    const totalDuracaoMin = reunioes.reduce((acc, r) => acc + (r.duracao_minutos || 0), 0);

    return reply.send({
      status: 'success',
      data: {
        atividades,
        total: atividades.length,
        por_status: totalPorStatus.reduce((acc: any, s) => { acc[s.status] = s._count.id; return acc; }, {}),
        por_tipo: totalPorTipo.reduce((acc: any, t) => { acc[t.tipo] = t._count.id; return acc; }, {}),
        reunioes_total: reunioes.length,
        reunioes_realizadas: reunioes.filter(r => r.status === 'REALIZADA').length,
        reunioes_canceladas: reunioes.filter(r => r.status === 'CANCELADA').length,
        reunioes_remarcadas: reunioes.filter(r => r.status === 'REMARCADA').length,
        duracao_total_horas: Math.round(totalDuracaoMin / 60 * 10) / 10
      }
    });
  });

  // ── Agenda semanal ────────────────────────────────────

  fastify.get('/atividades/agenda', async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const atividades = await prisma.atividade.findMany({
      where: {
        status: { in: ['PENDENTE', 'CONFIRMADA'] },
        data_prevista: { gte: today, lte: nextWeek },
        // "Lidar apenas com a própria agenda": vendedor vê só a sua; gestor, todas.
        ...ownerWhere(request, 'Atividade')
      },
      orderBy: { data_prevista: 'asc' },
      include: {
        lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
      }
    });

    return reply.send({ status: 'success', data: atividades });
  });

  // ── Google Calendar helpers ───────────────────────────

  async function getValidToken(_userId?: string): Promise<{ access_token: string } | null> {
    // Sempre usa o token único do sistema — um único Google Calendar para toda a empresa
    let token = await prisma.calendarToken.findUnique({ where: { user_id: 'system' } });
    if (!token) token = await prisma.calendarToken.findUnique({ where: { user_id: 'default' } });
    if (!token) return null;

    const isExpired = Number(token.expiry_date) < Date.now() + 60_000;
    if (!isExpired) return token;

    if (!token.refresh_token) return null;

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token'
        }).toString()
      });

      const data = await res.json() as any;
      if (!data.access_token) return null;

      const updated = await prisma.calendarToken.update({
        where: { user_id: token.user_id },
        data: {
          access_token: data.access_token,
          expiry_date: BigInt(Date.now() + (data.expires_in || 3600) * 1000)
        }
      });
      return updated;
    } catch {
      return null;
    }
  }

  // ── Google Calendar OAuth — conta única do sistema ────
  // Apenas admin conecta; todos os Meet links usam esse token.

  fastify.get('/agenda/google/auth', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdmin(user)) {
      return reply.status(403).send({ status: 'error', message: 'Apenas administradores podem conectar o Google Calendar' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/agenda/google/callback';

    if (!clientId) {
      return reply.status(503).send({
        status: 'error',
        message: 'Google Calendar não configurado. Adicione GOOGLE_CLIENT_ID no Railway'
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&prompt=consent&` +
      `state=system`;

    return reply.send({ status: 'success', data: { auth_url: authUrl } });
  });

  fastify.get('/agenda/google/callback', async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string; state?: string };
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

    if (error || !code) {
      return reply.redirect(`${frontendUrl}/agenda?google_error=acesso_negado`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/agenda/google/callback';

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json() as any;

      if (!tokenData.access_token) {
        fastify.log.error('Google token error: ' + JSON.stringify(tokenData));
        return reply.redirect(`${frontendUrl}/agenda?google_error=token_invalido`);
      }

      // Salva sempre como 'system' — token único compartilhado
      await prisma.calendarToken.upsert({
        where: { user_id: 'system' },
        create: {
          user_id: 'system',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          expiry_date: BigInt(Date.now() + (tokenData.expires_in || 3600) * 1000)
        },
        update: {
          access_token: tokenData.access_token,
          ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
          expiry_date: BigInt(Date.now() + (tokenData.expires_in || 3600) * 1000)
        }
      });

      fastify.log.info('Google Calendar system token saved');
      return reply.redirect(`${frontendUrl}/agenda?google_connected=1`);
    } catch (err) {
      fastify.log.error(err);
      return reply.redirect(`${frontendUrl}/agenda?google_error=erro_interno`);
    }
  });

  fastify.get('/agenda/google/status', async (request, reply) => {
    const token = await getValidToken();
    return reply.send({ status: 'success', data: { connected: !!token } });
  });

  // Cliente não compareceu
  fastify.post('/atividades/:id/nao-compareceu', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ observacao: z.string().optional() }).safeParse(request.body);
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'CLIENTE_NAO_COMPARECEU',
          resultado: (body.success && body.data.observacao) ? body.data.observacao : 'Cliente não compareceu à reunião.',
          data_realizada: new Date()
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Aguardar retorno
  fastify.post('/atividades/:id/aguardar-retorno', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ observacao: z.string().optional() }).safeParse(request.body);
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'AGUARDANDO_RETORNO',
          resultado: (body.success && body.data.observacao) ? body.data.observacao : 'Aguardando retorno do cliente.'
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Create Google Meet link for an existing atividade
  fastify.post('/atividades/:id/criar-meet', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const userId = user?.id || 'default';

    const atividade = await prisma.atividade.findUnique({
      where: { id },
      include: { lead: { select: { nome: true, email: true } } }
    });

    if (!atividade) return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
    if (atividade.tipo !== 'REUNIAO') return reply.status(400).send({ status: 'error', message: 'Apenas reuniões podem ter link Meet' });

    const startTime = atividade.data_prevista || new Date();
    const endTime = new Date(startTime.getTime() + (atividade.duracao_minutos || 60) * 60 * 1000);

    // 1) Tentar N8N primeiro
    let meetLink = await callN8nMeet({
      titulo: atividade.titulo,
      data_prevista: startTime.toISOString(),
      fim: endTime.toISOString(),
      lead_email: atividade.lead?.email || undefined
    });

    let eventId = '';

    // 2) Fallback: Google Calendar direto
    if (!meetLink) {
      const calToken = await getValidToken(userId);
      if (!calToken) {
        return reply.status(403).send({ status: 'error', message: 'Google Calendar não conectado e N8N não disponível.', need_auth: true });
      }
      try {
        const result = await callGoogleMeetDirect({
          titulo: atividade.titulo,
          startTime, endTime,
          lead_email: atividade.lead?.email || undefined,
          token: calToken.access_token
        });
        if (result.error) {
          return reply.status(502).send({ status: 'error', message: 'Erro ao criar evento no Google Calendar', details: result.error });
        }
        meetLink = result.meetLink;
        eventId = result.eventId;
      } catch (err) {
        fastify.log.error(err);
        throw err;
      }
    }

    const updated = await prisma.atividade.update({
      where: { id },
      data: { google_meet_link: meetLink, ...(eventId ? { google_event_id: eventId } : {}) }
    });

    return reply.send({ status: 'success', data: { atividade: updated, meet_link: meetLink, event_id: eventId } });
  });

  // ── N8N helper — tenta gerar Meet via webhook N8N ────────
  async function callN8nMeet(params: {
    titulo: string;
    data_prevista: string;
    fim: string;
    lead_email?: string;
  }): Promise<string | null> {
    const n8nUrl = process.env.N8N_CRIAR_MEET_WEBHOOK;
    if (!n8nUrl) return null;

    try {
      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_WEBHOOK_SECRET ? { 'x-webhook-token': process.env.N8N_WEBHOOK_SECRET } : {})
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(20000)
      });

      if (!res.ok) {
        fastify.log.warn(`N8N webhook responded ${res.status}`);
        return null;
      }

      const data = await res.json() as any;
      const link = data.meet_link || data.data?.meet_link || '';
      fastify.log.info(`N8N Meet link: ${link}`);
      return link || null;
    } catch (err) {
      fastify.log.warn('N8N webhook call failed: ' + err);
      return null;
    }
  }

  // ── Helper — gera Meet via Google Calendar direto (fallback) ─
  async function callGoogleMeetDirect(params: {
    titulo: string;
    startTime: Date;
    endTime: Date;
    lead_email?: string;
    token: string;
  }): Promise<{ meetLink: string; eventId: string; error?: string }> {
    const reqId = `crm-${Date.now()}`;

    const buildPayload = (confType: string) => ({
      summary: params.titulo || 'Reunião ProSystem',
      start: { dateTime: params.startTime.toISOString(), timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: params.endTime.toISOString(),   timeZone: 'America/Sao_Paulo' },
      conferenceData: {
        createRequest: { requestId: reqId, conferenceSolutionKey: { type: confType } }
      },
      ...(params.lead_email ? { attendees: [{ email: params.lead_email }] } : {})
    });

    const postEv = (pl: any) =>
      fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${params.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pl)
      });

    let res = await postEv(buildPayload('hangoutsMeet'));
    let eventData = await res.json() as any;

    if (!res.ok) {
      fastify.log.warn('hangoutsMeet failed: ' + JSON.stringify(eventData?.error));
      res = await postEv(buildPayload('eventHangout'));
      eventData = await res.json() as any;
    }

    if (!res.ok) {
      return { meetLink: '', eventId: '', error: eventData?.error?.message || JSON.stringify(eventData?.error) };
    }

    const meetLink =
      eventData.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      eventData.hangoutLink || '';

    return { meetLink, eventId: eventData.id || '' };
  }

  // Generate Meet link from form data (before saving atividade)
  fastify.post('/agenda/criar-meet-temp', async (request, reply) => {
    const body = z.object({
      titulo: z.string().min(1),
      data_prevista: z.string().datetime().optional(),
      duracao_minutos: z.number().optional(),
      lead_email: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const startTime = body.data.data_prevista ? new Date(body.data.data_prevista) : new Date();
    const durMin = body.data.duracao_minutos || 60;
    const endTime = new Date(startTime.getTime() + durMin * 60 * 1000);

    // 1) Tentar N8N primeiro
    const n8nLink = await callN8nMeet({
      titulo: body.data.titulo,
      data_prevista: startTime.toISOString(),
      fim: endTime.toISOString(),
      lead_email: body.data.lead_email
    });

    if (n8nLink) {
      return reply.send({ status: 'success', data: { meet_link: n8nLink, via: 'n8n' } });
    }

    // 2) Fallback: Google Calendar direto (requer token salvo no CRM)
    const user = (request as any).user;
    const userId = user?.id || 'default';
    const calToken = await getValidToken(userId);

    if (!calToken) {
      return reply.status(503).send({
        status: 'error',
        message: process.env.N8N_CRIAR_MEET_WEBHOOK
          ? 'N8N não respondeu e o Google Calendar não está conectado no CRM. Verifique o fluxo N8N ou clique em "Conectar Google".'
          : 'Configure N8N_CRIAR_MEET_WEBHOOK no .env ou conecte o Google Calendar.',
        need_auth: true
      });
    }

    try {
      const { meetLink, eventId, error } = await callGoogleMeetDirect({
        titulo: body.data.titulo,
        startTime, endTime,
        lead_email: body.data.lead_email,
        token: calToken.access_token
      });

      if (error) {
        return reply.status(502).send({ status: 'error', message: 'Erro ao criar evento no Google Calendar', details: error });
      }

      return reply.send({ status: 'success', data: { meet_link: meetLink, eventId, via: 'google_direct' } });
    } catch (err) {
      fastify.log.error(err);
      throw err;
    }
  });
}
