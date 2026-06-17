import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ownerWhere, requireGestor } from '@/lib/scope';

/**
 * Quadros comerciais (kanban). O "Pipeline Comercial" é o quadro fixo padrão
 * (colunas com quadro_id = id do pipeline). Outros quadros (ex.: Follow-up) são
 * independentes, com colunas próprias e regra de entrada automática de leads.
 *
 * No Pipeline, a posição do lead é o seu etapa_comercial (compatibilidade).
 * Nos demais quadros, a posição fica em LeadQuadroPosicao.
 */

const COLS_PIPELINE = [
  { chave: 'NOVO_LEAD',          nome: 'Novo Lead',          cor: '#6b7280', ordem: 0, fixa: true },
  { chave: 'PRIMEIRO_CONTATO',   nome: 'Primeiro Contato',   cor: '#2563eb', ordem: 1, fixa: true },
  { chave: 'EM_ATENDIMENTO',     nome: 'Em Atendimento',     cor: '#7c3aed', ordem: 2, fixa: false },
  { chave: 'AGUARDANDO_RETORNO', nome: 'Aguardando Retorno', cor: '#d97706', ordem: 3, fixa: false },
  { chave: 'PROPOSTA_A_GERAR',   nome: 'Proposta a Gerar',   cor: '#0891b2', ordem: 4, fixa: false },
  { chave: 'PROPOSTA_ENVIADA',   nome: 'Proposta Enviada',   cor: '#4B8EC8', ordem: 5, fixa: false },
  { chave: 'EM_NEGOCIACAO',      nome: 'Em Negociação',      cor: '#dc2626', ordem: 6, fixa: false },
  { chave: 'FECHADO',            nome: 'Fechado',            cor: '#15803d', ordem: 7, fixa: true },
  { chave: 'PERDIDO',            nome: 'Perdido',            cor: '#9ca3af', ordem: 8, fixa: true },
];

// Quadro de Follow-up: leads parados +40 dias sem mudar de etapa entram em "A retomar".
const COLS_FOLLOWUP = [
  { chave: 'FUP_A_RETOMAR',   nome: 'A retomar',     cor: '#6b7280', ordem: 0, fixa: true },
  { chave: 'FUP_TENT_1',      nome: '1ª tentativa',  cor: '#2563eb', ordem: 1, fixa: false },
  { chave: 'FUP_TENT_2',      nome: '2ª tentativa',  cor: '#7c3aed', ordem: 2, fixa: false },
  { chave: 'FUP_TENT_3',      nome: '3ª tentativa',  cor: '#d97706', ordem: 3, fixa: false },
  { chave: 'FUP_NUTRICAO',    nome: 'Nutrição longa',cor: '#0891b2', ordem: 4, fixa: false },
  { chave: 'FUP_RECUPERADO',  nome: 'Recuperado',    cor: '#15803d', ordem: 5, fixa: true },
  { chave: 'FUP_DESCARTADO',  nome: 'Descartado',    cor: '#9ca3af', ordem: 6, fixa: true },
];

// Status que tiram o lead do follow-up automático (já concluídos no pipeline).
const STATUS_CONCLUIDO = ['GANHO', 'PERDIDO'];

export async function quadrosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ── Seed: garante o quadro Pipeline (migra colunas existentes) e o Follow-up ──
  fastify.addHook('onReady', async () => {
    try {
      // Pipeline
      let pipeline = await prisma.quadroComercial.findFirst({ where: { tipo: 'PIPELINE' } });
      if (!pipeline) {
        pipeline = await prisma.quadroComercial.create({
          data: { nome: 'Pipeline Comercial', tipo: 'PIPELINE', cor: '#417ABC', ordem: 0, fixo: true, regra_tipo: 'NENHUMA' },
        });
      }
      // Vincula colunas sem quadro ao pipeline; cria as default se não houver nenhuma.
      const semQuadro = await prisma.kanbanColuna.count({ where: { quadro_id: null } });
      const totalCols = await prisma.kanbanColuna.count();
      if (totalCols === 0) {
        await prisma.kanbanColuna.createMany({
          data: COLS_PIPELINE.map(c => ({ ...c, quadro_id: pipeline!.id, created_by: 'system' })),
          skipDuplicates: true,
        });
      } else if (semQuadro > 0) {
        await prisma.kanbanColuna.updateMany({ where: { quadro_id: null }, data: { quadro_id: pipeline.id } });
      }

      // Follow-up
      let followup = await prisma.quadroComercial.findFirst({ where: { tipo: 'FOLLOWUP' } });
      if (!followup) {
        followup = await prisma.quadroComercial.create({
          data: {
            nome: 'Follow-up (parados +40 dias)',
            descricao: 'Leads ativos sem mudança de etapa há mais de 40 dias, para reativação ao longo de ~6 meses.',
            tipo: 'FOLLOWUP', cor: '#d97706', ordem: 1, fixo: false,
            regra_tipo: 'PARADOS_DIAS', regra_dias: 40, coluna_entrada: 'FUP_A_RETOMAR',
            colunas_finais: ['FUP_RECUPERADO', 'FUP_DESCARTADO'],
            cadencia_dias: [7, 15, 30, 45],
          },
        });
        await prisma.kanbanColuna.createMany({
          data: COLS_FOLLOWUP.map(c => ({ ...c, chave: c.chave, quadro_id: followup!.id, created_by: 'system' })),
          skipDuplicates: true,
        });
      }
    } catch (e: any) {
      fastify.log?.warn({ err: e?.message }, 'seed de quadros falhou (segue sem bloquear)');
    }
  });

  // ── LISTA de quadros ──
  fastify.get('/quadros', async (_req, reply) => {
    const quadros = await prisma.quadroComercial.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' } });
    return reply.send({ status: 'success', data: quadros });
  });

  // ── CRIAR quadro (gestor) ──
  fastify.post('/quadros', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      cor: z.string().default('#417ABC'),
      regra_tipo: z.enum(['NENHUMA', 'PARADOS_DIAS']).default('NENHUMA'),
      regra_dias: z.number().int().optional(),
      colunas: z.array(z.object({ nome: z.string(), cor: z.string().optional() })).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const user = (request as any).user;
    const d = body.data;

    const ordem = (await prisma.quadroComercial.count()) + 1;
    const quadro = await prisma.quadroComercial.create({
      data: {
        nome: d.nome, descricao: d.descricao, cor: d.cor, tipo: 'CUSTOM', ordem,
        regra_tipo: d.regra_tipo, regra_dias: d.regra_dias,
        created_by: user?.id || 'system',
      },
    });
    // Colunas (se informadas); senão cria uma coluna inicial "A fazer".
    const cols = d.colunas?.length ? d.colunas : [{ nome: 'A fazer' }];
    let ordemCol = 0;
    for (const c of cols) {
      const chave = `Q${quadro.id.slice(0, 6)}_${c.nome.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`.slice(0, 40);
      await prisma.kanbanColuna.create({
        data: { chave, nome: c.nome, cor: c.cor || '#6b7280', ordem: ordemCol++, quadro_id: quadro.id, created_by: user?.id || 'system' },
      }).catch(() => {});
    }
    if (d.regra_tipo === 'PARADOS_DIAS') {
      const primeira = await prisma.kanbanColuna.findFirst({ where: { quadro_id: quadro.id }, orderBy: { ordem: 'asc' } });
      if (primeira) await prisma.quadroComercial.update({ where: { id: quadro.id }, data: { coluna_entrada: primeira.chave } });
    }
    return reply.status(201).send({ status: 'success', data: quadro });
  });

  // ── EDITAR quadro (gestor) ──
  fastify.patch('/quadros/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().optional(), descricao: z.string().optional(), cor: z.string().optional(),
      ativo: z.boolean().optional(), regra_dias: z.number().int().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const q = await prisma.quadroComercial.update({ where: { id }, data: body.data });
    return reply.send({ status: 'success', data: q });
  });

  // ── EXCLUIR quadro (gestor) — pipeline fixo não pode ──
  fastify.delete('/quadros/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const q = await prisma.quadroComercial.findUnique({ where: { id } });
    if (!q) return reply.status(404).send({ status: 'error', message: 'Quadro não encontrado' });
    if (q.fixo) return reply.status(400).send({ status: 'error', message: 'O Pipeline Comercial não pode ser excluído' });
    await prisma.kanbanColuna.deleteMany({ where: { quadro_id: id } }).catch(() => {});
    await prisma.leadQuadroPosicao.deleteMany({ where: { quadro_id: id } }).catch(() => {});
    await prisma.quadroComercial.delete({ where: { id } });
    return reply.send({ status: 'success', message: 'Quadro removido' });
  });

  // ── KANBAN de um quadro específico ──
  // Pipeline → agrupa por etapa_comercial. Outros → aplica a regra e usa LeadQuadroPosicao.
  fastify.get('/quadros/:id/kanban', async (request, reply) => {
    const { id } = request.params as { id: string };
    const quadro = await prisma.quadroComercial.findUnique({ where: { id } });
    if (!quadro) return reply.status(404).send({ status: 'error', message: 'Quadro não encontrado' });

    const colunas = await prisma.kanbanColuna.findMany({ where: { quadro_id: id, ativa: true }, orderBy: { ordem: 'asc' } });
    const grouped: Record<string, any[]> = {};
    for (const c of colunas) grouped[c.chave] = [];

    const esc = ownerWhere(request, 'Lead'); // já exclui deleted_at

    if (quadro.tipo === 'PIPELINE') {
      // Leads que já estão ativos em OUTRO quadro (ex.: Follow-up) saem do Pipeline,
      // para não duplicar — cada quadro mostra coisas diferentes. (Finalizados no
      // outro quadro voltam a aparecer no Pipeline normalmente.)
      const emOutroQuadro = await prisma.leadQuadroPosicao.findMany({
        where: { quadro_id: { not: id }, finalizado: false },
        select: { lead_id: true },
      }).catch(() => [] as any[]);
      const escondidos = new Set(emOutroQuadro.map((p: any) => p.lead_id));

      const leads = await prisma.lead.findMany({
        where: { ...esc }, orderBy: { updated_at: 'desc' },
        include: { etiquetas_lead: { include: { etiqueta: { select: { id: true, nome: true, cor: true } } } } },
      });
      const chaves = new Set(colunas.map(c => c.chave));
      for (const l of leads) {
        if (escondidos.has(l.id)) continue; // está em outro quadro → não repete aqui
        const col = chaves.has(l.etapa_comercial) ? l.etapa_comercial
          : (l.status === 'GANHO' ? 'FECHADO' : l.status === 'PERDIDO' ? 'PERDIDO' : (colunas[0]?.chave));
        if (col) { if (!grouped[col]) grouped[col] = []; grouped[col].push(l); }
      }
      return reply.send({ status: 'success', data: { quadro, colunas, leads: grouped } });
    }

    // Quadro com regra automática (ex.: Follow-up): garante entrada dos leads que batem a regra.
    if (quadro.regra_tipo === 'PARADOS_DIAS' && quadro.regra_dias) {
      await aplicarRegraParados(prisma, quadro);
    }

    const posicoes = await prisma.leadQuadroPosicao.findMany({ where: { quadro_id: id } });
    const leadIds = posicoes.map(p => p.lead_id);
    const leads = leadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds }, ...esc },
          include: { etiquetas_lead: { include: { etiqueta: { select: { id: true, nome: true, cor: true } } } } },
        })
      : [];
    const byId: Record<string, any> = {};
    for (const l of leads) byId[l.id] = l;

    for (const pos of posicoes) {
      const lead = byId[pos.lead_id];
      if (!lead) continue; // fora do escopo do vendedor ou excluído
      const col = grouped[pos.coluna_chave] ? pos.coluna_chave : (colunas[0]?.chave);
      if (col) grouped[col].push({ ...lead, _fup: { tentativas: pos.tentativas, proxima_acao_em: pos.proxima_acao_em, entrou_em: pos.entrou_em } });
    }
    return reply.send({ status: 'success', data: { quadro, colunas, leads: grouped } });
  });

  // ── MOVER um lead dentro de um quadro não-pipeline ──
  fastify.post('/quadros/:id/mover', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ lead_id: z.string(), coluna_chave: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const quadro = await prisma.quadroComercial.findUnique({ where: { id } });
    if (!quadro) return reply.status(404).send({ status: 'error', message: 'Quadro não encontrado' });

    const finais: string[] = Array.isArray(quadro.colunas_finais) ? quadro.colunas_finais as string[] : [];
    const cadencia: number[] = Array.isArray(quadro.cadencia_dias) ? quadro.cadencia_dias as number[] : [];
    const pos = await prisma.leadQuadroPosicao.findUnique({ where: { lead_id_quadro_id: { lead_id: body.data.lead_id, quadro_id: id } } }).catch(() => null);
    const agora = new Date();
    const tentativas = (pos?.tentativas || 0) + 1;
    const ehFinal = finais.includes(body.data.coluna_chave);
    const proximoIntervalo = cadencia[Math.min(tentativas - 1, cadencia.length - 1)] || 30;
    const proxima = ehFinal ? null : new Date(agora.getTime() + proximoIntervalo * 86400000);

    await prisma.leadQuadroPosicao.upsert({
      where: { lead_id_quadro_id: { lead_id: body.data.lead_id, quadro_id: id } },
      create: {
        lead_id: body.data.lead_id, quadro_id: id, coluna_chave: body.data.coluna_chave,
        ultima_tentativa: agora, proxima_acao_em: proxima, tentativas, finalizado: ehFinal,
      },
      update: {
        coluna_chave: body.data.coluna_chave, ultima_tentativa: agora,
        proxima_acao_em: proxima, tentativas, finalizado: ehFinal,
      },
    });
    return reply.send({ status: 'success' });
  });
}

// Insere no quadro os leads ativos parados há +N dias sem mudança de etapa.
// "Parado" = updated_at < (hoje - N dias) e não concluído (GANHO/PERDIDO).
async function aplicarRegraParados(prisma: PrismaClient, quadro: any) {
  const dias = quadro.regra_dias as number;
  const limite = new Date(Date.now() - dias * 86400000);
  const colEntrada = quadro.coluna_entrada || 'FUP_A_RETOMAR';

  const candidatos = await prisma.lead.findMany({
    where: {
      deleted_at: null,
      updated_at: { lt: limite },
      status: { notIn: STATUS_CONCLUIDO },
      etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
    },
    select: { id: true },
    take: 1000,
  }).catch(() => [] as any[]);
  if (!candidatos.length) return;

  const existentes = await prisma.leadQuadroPosicao.findMany({
    where: { quadro_id: quadro.id, lead_id: { in: candidatos.map((c: any) => c.id) } },
    select: { lead_id: true },
  });
  const jaNoQuadro = new Set(existentes.map(e => e.lead_id));

  const novos = candidatos.filter((c: any) => !jaNoQuadro.has(c.id));
  for (const c of novos) {
    await prisma.leadQuadroPosicao.create({
      data: {
        lead_id: c.id, quadro_id: quadro.id, coluna_chave: colEntrada,
        entrou_em: new Date(), proxima_acao_em: new Date(),
      },
    }).catch(() => {});
  }
}
