import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, requireGestor } from '@/lib/scope';
import { calcularRealizadoMeta } from '@/lib/meta-progress';
import { resolverNomesUsuarios, CONTAS_SISTEMA } from '@/lib/usuarios';

const CreateMetaSchema = z.object({
  titulo: z.string().min(1),
  responsaveis_ids: z.array(z.string().min(1)).min(1),   // 1 ou mais usuários selecionados
  modo: z.enum(['INDIVIDUAL', 'EQUIPE']).default('INDIVIDUAL'),
  periodo_tipo: z.enum(['MENSAL', 'ANUAL', 'PERIODO']).default('MENSAL'),
  periodo: z.string().min(1),                            // rótulo legível do período
  data_inicio: z.string().datetime().optional(),
  data_fim: z.string().datetime().optional(),
  // alvos comerciais
  meta_contratos: z.number().int().min(0).optional(),
  meta_preco_inst: z.number().min(0).optional(),
  meta_preco_mensal: z.number().min(0).optional(),
  meta_valor_total: z.number().min(0).optional(),
});

const UpdateMetaSchema = z.object({
  titulo: z.string().optional(),
  valor_atual: z.number().optional(),
  status: z.enum(['ATIVA', 'CONCLUIDA', 'CANCELADA']).optional(),
  meta_contratos: z.number().int().min(0).optional(),
  meta_preco_inst: z.number().min(0).optional(),
  meta_preco_mensal: z.number().min(0).optional(),
  meta_valor_total: z.number().min(0).optional(),
});

export async function metasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Garante as colunas novas em bases já existentes (não-bloqueante).
  Promise.all([
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN responsaveis_ids JSON NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN modo VARCHAR(20) NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN periodo_tipo VARCHAR(20) NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN data_inicio DATETIME NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN data_fim DATETIME NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN meta_contratos INT NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN meta_preco_inst DOUBLE NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN meta_preco_mensal DOUBLE NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE Meta ADD COLUMN meta_valor_total DOUBLE NULL`).catch(() => {}),
  ]).catch(() => {});

  fastify.get('/metas', async (request, reply) => {
    const query = z.object({
      periodo: z.string().optional(),
      responsavel_id: z.string().optional(),
    }).safeParse(request.query);
    const periodo = query.data?.periodo;
    const responsavel_id = query.data?.responsavel_id;

    const where: any = {};
    if (periodo) where.periodo = periodo;
    // Escopo de VISIBILIDADE: a meta só aparece para os usuários selecionados (+ gestão).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) {
      // vendedor: meta onde ele é o responsável principal OU está na lista de selecionados
      where.OR = [
        { responsavel_id: scopeId },
        { responsaveis_ids: { array_contains: scopeId } as any },
      ];
    } else if (responsavel_id) {
      where.OR = [
        { responsavel_id },
        { responsaveis_ids: { array_contains: responsavel_id } as any },
      ];
    }

    const metas = await prisma.meta.findMany({
      where,
      orderBy: [{ created_at: 'desc' }]
    });

    // Calcula o REALIZADO automático de cada meta (fechamentos reais no período)
    const comRealizado = await Promise.all(metas.map(async (m) => {
      const realizado = await calcularRealizadoMeta(prisma, m).catch(() => null);
      return { ...m, realizado };
    }));

    return reply.send({ status: 'success', data: comRealizado });
  });

  fastify.post('/metas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // só a supervisão cria metas
    const body = CreateMetaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    const d = body.data;
    const user = (request as any).user;

    // valor_alvo legado = total em valores (mantém compatibilidade com telas/relatórios antigos)
    const meta = await prisma.meta.create({
      data: {
        titulo: d.titulo,
        responsavel_id: d.responsaveis_ids[0],
        responsaveis_ids: d.responsaveis_ids,
        tipo: 'CONTRATOS',
        valor_alvo: d.meta_valor_total ?? 0,
        periodo: d.periodo,
        modo: d.modo,
        periodo_tipo: d.periodo_tipo,
        data_inicio: d.data_inicio ? new Date(d.data_inicio) : null,
        data_fim: d.data_fim ? new Date(d.data_fim) : null,
        meta_contratos: d.meta_contratos ?? null,
        meta_preco_inst: d.meta_preco_inst ?? null,
        meta_preco_mensal: d.meta_preco_mensal ?? null,
        meta_valor_total: d.meta_valor_total ?? null,
        created_by: user?.id || 'system',
      } as any,
    });
    return reply.status(201).send({ status: 'success', data: meta });
  });

  fastify.patch('/metas/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // só a supervisão edita/ajusta metas
    const { id } = request.params as { id: string };
    const body = UpdateMetaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const meta = await prisma.meta.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: meta });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Meta não encontrada' });
      throw err;
    }
  });

  fastify.delete('/metas/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // só a supervisão exclui metas
    const { id } = request.params as { id: string };
    try {
      await prisma.meta.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Meta removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Meta não encontrada' });
      throw err;
    }
  });

  // Ranking — vendedores com mais contratos/leads ganhos no período
  fastify.get('/metas/ranking', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // ranking só p/ supervisão
    const query = z.object({
      periodo: z.string().optional()
    }).safeParse(request.query);
    const periodo = query.data?.periodo;

    const where: any = {};
    if (periodo) {
      const [year, month] = periodo.split('-');
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.created_at = { gte: start, lte: end };
    }

    // Fechamentos REAIS vêm de PropostaComercial (o model antigo Proposta está vazio).
    // No período: status fechado e data_aceite dentro do mês (ou created_at se s/ aceite).
    const STATUS_FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
    const wherePC: any = { status: { in: STATUS_FECHADA }, deleted_at: null };
    if (periodo) {
      const [yy, mm] = periodo.split('-').map(Number);
      const ini = new Date(yy, mm - 1, 1), fim = new Date(yy, mm, 1);
      wherePC.OR = [
        { data_aceite: { gte: ini, lt: fim } },
        { AND: [{ data_aceite: null }, { created_at: { gte: ini, lt: fim } }] },
      ];
    }
    const [leadsGanhos, fechadasPC] = await Promise.all([
      prisma.lead.groupBy({
        by: ['responsavel_id'],
        where: { ...where, status: 'GANHO', responsavel_id: { not: null } },
        _count: { _all: true },
        _sum: { valor_estimado: true },
      }),
      prisma.propostaComercial.findMany({
        where: wherePC,
        select: { vendedor_id: true, vendedor_nome: true, valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
      }),
    ]);

    // Merge by responsavel_id/created_by
    const rankingMap: Record<string, any> = {};

    // Começa com TODOS os vendedores ATIVOS (aparecem mesmo com resultado zero).
    const vendedores: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo = 'VENDEDOR' AND status = 'ATIVO'`
    ).catch(() => []);
    for (const v of vendedores) {
      rankingMap[v.id] = { responsavel_id: v.id, responsavel_nome: v.nome, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0, setup_total: 0, mrr_total: 0 };
    }

    leadsGanhos.forEach(l => {
      const id = l.responsavel_id!;
      if (!rankingMap[id]) rankingMap[id] = { responsavel_id: id, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0, setup_total: 0, mrr_total: 0 };
      rankingMap[id].leads_ganhos = l._count._all;
    });

    // Fechamentos por vendedor: conta propostas aceitas + contratos e soma valor (setup + MRR).
    for (const p of fechadasPC as any[]) {
      const id = p.vendedor_id || 'sem-vendedor';
      if (!rankingMap[id]) rankingMap[id] = { responsavel_id: id, responsavel_nome: p.vendedor_nome || undefined, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0, setup_total: 0, mrr_total: 0 };
      const setup = Number(p.valor_implantacao ?? p.valor_final ?? 0);
      const mrr = Number(p.mensalidade_plus ?? p.mensalidade_pro ?? 0);
      rankingMap[id].propostas_aceitas += 1;
      rankingMap[id].contratos += 1;
      rankingMap[id].setup_total += setup;
      rankingMap[id].mrr_total += mrr;
      rankingMap[id].valor_total += setup + mrr;
    }

    // Resolve o NOME de cada responsável (UsuarioCRM + contas de sistema) — antes
    // a tela mostrava o id cru. Quem não tiver nome cadastrado fica com o id.
    const ids = Object.keys(rankingMap).filter(Boolean);
    const nomes = await resolverNomesUsuarios(prisma, ids).catch(() => ({} as any));
    for (const id of ids) {
      if (!rankingMap[id].responsavel_nome) rankingMap[id].responsavel_nome = nomes[id] || CONTAS_SISTEMA[id]?.nome || id;
    }

    const ranking = Object.values(rankingMap)
      .sort((a, b) => b.valor_total - a.valor_total || b.leads_ganhos - a.leads_ganhos)
      .map((r, i) => ({
        ...r,
        posicao: i + 1,
        // Médias por contrato fechado (0 se não fechou nada no período).
        media_setup: r.contratos ? Math.round(r.setup_total / r.contratos) : 0,
        media_mrr: r.contratos ? Math.round(r.mrr_total / r.contratos) : 0,
      }));

    return reply.send({ status: 'success', data: ranking });
  });
}
