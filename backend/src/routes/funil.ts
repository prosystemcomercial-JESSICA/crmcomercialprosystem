import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const GESTORES = ['CEO', 'DIRETOR', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN'];
const SUPERVISAO = [...GESTORES, 'SUPERVISAO_TECNICA'];

// ─── Tipos de etapa ──────────────────────────────────────────
// ANDAMENTO  — entra no pipeline
// FECHAMENTO — venda fechada / ganho
// PERDIDA    — venda perdida (exige motivo)
// SEM_PERFIL — não computar como perdido nem ativo
// REATIVACAO — leads para retomar depois
type TipoEtapa = 'ANDAMENTO' | 'FECHAMENTO' | 'PERDIDA' | 'SEM_PERFIL' | 'REATIVACAO';

// ─── Etapas padrão (seed inicial) ────────────────────────────
// fixo=true → não pode ser excluída nem ter o tipo alterado
const ETAPAS_PADRAO = [
  { codigo: 'PROSPECCAO',   nome: 'Prospecção',        cor: '#6b7280', ordem: 1, tipo: 'ANDAMENTO',  conta_pipeline: true,  fixo: true  },
  { codigo: 'QUALIFICACAO', nome: 'Qualificação',      cor: '#3b82f6', ordem: 2, tipo: 'ANDAMENTO',  conta_pipeline: true,  fixo: true  },
  { codigo: 'APRESENTACAO', nome: 'Apresentação',      cor: '#8b5cf6', ordem: 3, tipo: 'ANDAMENTO',  conta_pipeline: true,  fixo: true  },
  { codigo: 'PROPOSTA',     nome: 'Proposta',          cor: '#eab308', ordem: 4, tipo: 'ANDAMENTO',  conta_pipeline: true,  fixo: true  },
  { codigo: 'NEGOCIACAO',   nome: 'Negociação',        cor: '#f97316', ordem: 5, tipo: 'ANDAMENTO',  conta_pipeline: true,  fixo: true  },
  { codigo: 'FECHAMENTO',   nome: 'Fechamento',        cor: '#22c55e', ordem: 6, tipo: 'FECHAMENTO', conta_pipeline: false, fixo: true  },
  { codigo: 'PERDIDO',      nome: 'Negócio Perdido',   cor: '#ef4444', ordem: 7, tipo: 'PERDIDA',    conta_pipeline: false, fixo: true  },
  { codigo: 'SEM_PERFIL',   nome: 'Sem perfil',        cor: '#6b7280', ordem: 8, tipo: 'SEM_PERFIL', conta_pipeline: false, fixo: false },
  { codigo: 'REATIVACAO',   nome: 'Reativação futura', cor: '#0ea5e9', ordem: 9, tipo: 'REATIVACAO', conta_pipeline: false, fixo: false },
];

const MOTIVOS_PERDA_PADRAO = [
  'Preço','Cliente sem orçamento','Cliente não respondeu','Fechou com concorrente',
  'Não era o momento','Sem perfil para o produto','Dados incorretos','Desistiu da contratação',
  'Problema operacional','Atendimento demorou','Produto/plano não atendia','Outro'
];

// ─── Schemas ─────────────────────────────────────────────────
const EtapaSchema = z.object({
  codigo: z.string().min(2).regex(/^[A-Z0-9_]+$/, 'Use somente letras maiúsculas, números e _'),
  nome: z.string().min(1),
  cor: z.string().default('#6b7280'),
  ordem: z.number().int().default(99),
  tipo: z.enum(['ANDAMENTO','FECHAMENTO','PERDIDA','SEM_PERFIL','REATIVACAO']).default('ANDAMENTO'),
  conta_pipeline: z.boolean().default(true),
  visivel_vendedor: z.boolean().default(true),
});

const PerdaSchema = z.object({
  motivo: z.string().min(1),
  motivo_outro: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const MoverSchema = z.object({
  etapa_funil: z.string(),
  perda: PerdaSchema.optional()
});

export async function funilRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ─── Tabelas primeiro, depois seed (não bloqueante) ─────────────────────────
  Promise.all([
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS FunilEtapa (
        id CHAR(36) NOT NULL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nome VARCHAR(100) NOT NULL,
        cor VARCHAR(20) DEFAULT '#6b7280',
        ordem INTEGER DEFAULT 99,
        tipo VARCHAR(20) DEFAULT 'ANDAMENTO',
        conta_pipeline BOOLEAN DEFAULT TRUE,
        visivel_vendedor BOOLEAN DEFAULT TRUE,
        ativa BOOLEAN DEFAULT TRUE,
        fixo BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS LeadPerda (
        id CHAR(36) NOT NULL PRIMARY KEY,
        lead_id VARCHAR(255) NOT NULL,
        lead_nome VARCHAR(255),
        etapa_anterior VARCHAR(50),
        etapa_destino VARCHAR(50),
        motivo VARCHAR(100),
        motivo_outro TEXT,
        observacoes TEXT,
        valor_oportunidade DECIMAL(12,2),
        vendedor_id VARCHAR(255),
        vendedor_nome VARCHAR(255),
        created_at DATETIME DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS LeadHistorico (
        id CHAR(36) NOT NULL PRIMARY KEY,
        lead_id VARCHAR(255) NOT NULL,
        lead_nome VARCHAR(255),
        acao VARCHAR(100),
        etapa_anterior VARCHAR(50),
        etapa_destino VARCHAR(50),
        ator_id VARCHAR(255),
        ator_nome VARCHAR(255),
        detalhes JSON,
        created_at DATETIME DEFAULT NOW()
      )
    `),
    prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS MetaVendedor (
        id CHAR(36) NOT NULL PRIMARY KEY,
        vendedor_id VARCHAR(255) NOT NULL,
        vendedor_nome VARCHAR(255),
        ano INTEGER NOT NULL,
        mes INTEGER,
        trimestre INTEGER,
        meta_valor DECIMAL(12,2) NOT NULL,
        bonus_valor DECIMAL(12,2),
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_meta (vendedor_id, ano, mes, trimestre)
      )
    `),
  ]).then(() =>
    // Seed após criação garantida das tabelas
    Promise.all(ETAPAS_PADRAO.map(e =>
      prisma.$executeRawUnsafe(
        `INSERT INTO FunilEtapa (id, codigo, nome, cor, ordem, tipo, conta_pipeline, fixo)
         VALUES (UUID(),?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE fixo=VALUES(fixo), nome=VALUES(nome)`,
        e.codigo, e.nome, e.cor, e.ordem, e.tipo, e.conta_pipeline, e.fixo
      )
    ))
  ).catch(e => console.warn('[funil.ts] Aviso ao inicializar:', e.message));

  // ─── Helpers ─────────────────────────────────────────────────
  const getEtapas = async (): Promise<any[]> =>
    prisma.$queryRawUnsafe(`SELECT * FROM FunilEtapa WHERE ativa = TRUE ORDER BY ordem ASC`);

  const audit = async (lead_id: string, lead_nome: string, acao: string, etapa_ant: string|null, etapa_dest: string|null, ator: any, detalhes?: any) => {
    try {
      const histId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes) VALUES (?,?,?,?,?,?,?,?,?)`,
        histId, lead_id, lead_nome, acao, etapa_ant, etapa_dest, ator?.id||'sistema', ator?.nome||'sistema',
        detalhes ? JSON.stringify(detalhes) : null
      );
    } catch { }
  };

  const checkGestor = (request: any): boolean => {
    const user = (request as any).user;
    return !!(user && GESTORES.some(r => user.role?.includes(r)));
  };

  const isVendedor = (request: any): boolean => {
    const user = (request as any).user;
    return user?.role === 'VENDEDOR';
  };

  // ═══════════════════════════════════════════════════════════
  // ETAPAS — CRUD
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/etapas', async (_request, reply) => {
    const etapas = await getEtapas();
    return reply.send({ status: 'success', data: { etapas, motivos_perda: MOTIVOS_PERDA_PADRAO } });
  });

  fastify.post('/funil/etapas', async (request, reply) => {
    if (!checkGestor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const body = EtapaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    const d = body.data;
    try {
      const novoId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO FunilEtapa (id, codigo, nome, cor, ordem, tipo, conta_pipeline, visivel_vendedor) VALUES (?,?,?,?,?,?,?,?)`,
        novoId, d.codigo, d.nome, d.cor, d.ordem, d.tipo, d.conta_pipeline, d.visivel_vendedor
      );
      const rows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM FunilEtapa WHERE id = ?', novoId);
      return reply.status(201).send({ status: 'success', data: rows[0] });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate entry')) return reply.status(409).send({ status: 'error', message: 'Código já existe' });
      throw err;
    }
  });

  fastify.patch('/funil/etapas/:id', async (request, reply) => {
    if (!checkGestor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const { id } = request.params as { id: string };
    const body = EtapaSchema.partial().omit({ codigo: true }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    // Etapas fixas não podem ter o tipo alterado
    if (body.data.tipo !== undefined) {
      const atual: any[] = await prisma.$queryRawUnsafe(`SELECT fixo FROM FunilEtapa WHERE id = ?`, id);
      if (atual.length && atual[0].fixo) {
        return reply.status(400).send({ status: 'error', message: 'Etapas fixas não podem ter o tipo alterado' });
      }
    }

    const sets: string[] = []; const vals: any[] = [];
    for (const [k, v] of Object.entries(body.data)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
    if (!sets.length) return reply.status(400).send({ status: 'error', message: 'Nada para atualizar' });
    sets.push(`updated_at = NOW()`); vals.push(id);
    await prisma.$executeRawUnsafe(`UPDATE FunilEtapa SET ${sets.join(', ')} WHERE id = ?`, ...vals);
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM FunilEtapa WHERE id = ?`, id);
    if (!rows.length) return reply.status(404).send({ status: 'error', message: 'Etapa não encontrada' });
    return reply.send({ status: 'success', data: rows[0] });
  });

  fastify.delete('/funil/etapas/:id', async (request, reply) => {
    if (!checkGestor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const { id } = request.params as { id: string };

    // Impede exclusão de etapas fixas
    const etapa: any[] = await prisma.$queryRawUnsafe(`SELECT fixo, nome FROM FunilEtapa WHERE id = ?`, id);
    if (!etapa.length) return reply.status(404).send({ status: 'error', message: 'Etapa não encontrada' });
    if (etapa[0].fixo) {
      return reply.status(400).send({ status: 'error', message: `A etapa "${etapa[0].nome}" é fixa e não pode ser removida` });
    }

    // Soft delete — marca como inativa para preservar histórico
    await prisma.$executeRawUnsafe(`UPDATE FunilEtapa SET ativa = FALSE WHERE id = ?`, id);
    return reply.send({ status: 'success', message: 'Etapa removida' });
  });

  fastify.put('/funil/etapas/ordem', async (request, reply) => {
    if (!checkGestor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const body = z.object({ ordem: z.array(z.object({ id: z.string(), ordem: z.number() })) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    for (const item of body.data.ordem) {
      await prisma.$executeRawUnsafe(`UPDATE FunilEtapa SET ordem = ? WHERE id = ?`, item.ordem, item.id);
    }
    return reply.send({ status: 'success' });
  });

  // ═══════════════════════════════════════════════════════════
  // BOARD — kanban data com filtro por papel
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/board', async (request, reply) => {
    const user = (request as any).user;
    const vendedor = isVendedor(request);

    const etapas = await getEtapas();

    // Lead filter: vendedor vê só os próprios; supervisão e CEO veem tudo
    const where: any = {};
    if (vendedor && user?.id) where.responsavel_id = user.id;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { atividades: true, propostas: true } } }
    });

    // Agrupar por etapa
    const board = etapas.map((e: any) => {
      const leadsEtapa = leads.filter(l => l.etapa_funil === e.codigo);
      const valor_total = leadsEtapa.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      return { ...e, leads: leadsEtapa, total: leadsEtapa.length, valor_total };
    });

    return reply.send({ status: 'success', data: { etapas: board, total_leads: leads.length } });
  });

  // ═══════════════════════════════════════════════════════════
  // MOVER LEAD — com tratamento de perda
  // ═══════════════════════════════════════════════════════════
  fastify.post('/leads/:id/mover', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = MoverSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const { etapa_funil, perda } = body.data;
    const ator = (request as any).user;

    // Buscar lead
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    // Buscar etapa destino
    const etapas: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM FunilEtapa WHERE codigo = ? LIMIT 1`, etapa_funil);
    if (!etapas.length) return reply.status(400).send({ status: 'error', message: 'Etapa de destino inválida' });
    const etapa = etapas[0];

    // Se for etapa de PERDIDA, exige motivo
    if (etapa.tipo === 'PERDIDA') {
      if (!perda || !perda.motivo) {
        return reply.status(400).send({ status: 'error', message: 'É obrigatório informar o motivo da perda', codigo: 'MOTIVO_OBRIGATORIO' });
      }
      if (perda.motivo === 'Outro' && !perda.motivo_outro?.trim()) {
        return reply.status(400).send({ status: 'error', message: 'Descreva o motivo' });
      }
      // Registrar perda
      await prisma.$executeRawUnsafe(
        `INSERT INTO LeadPerda (id, lead_id, lead_nome, etapa_anterior, etapa_destino, motivo, motivo_outro, observacoes, valor_oportunidade, vendedor_id, vendedor_nome) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        randomUUID(), id, lead.nome, lead.etapa_funil, etapa_funil, perda.motivo, perda.motivo_outro || null,
        perda.observacoes || null, lead.valor_estimado || 0, lead.responsavel_id || null, ator?.nome || null
      );
    }

    // Determinar novo status com base no tipo da etapa
    let novoStatus = lead.status;
    if (etapa.tipo === 'FECHAMENTO') novoStatus = 'GANHO';
    else if (etapa.tipo === 'PERDIDA') novoStatus = 'PERDIDO';
    else if (etapa.tipo === 'ANDAMENTO' && ['GANHO','PERDIDO'].includes(novoStatus)) novoStatus = 'EM_CONTATO';

    const updated = await prisma.lead.update({
      where: { id },
      data: { etapa_funil, status: novoStatus as any }
    });

    // Histórico
    await audit(id, lead.nome, etapa.tipo === 'PERDIDA' ? 'MARCOU_PERDIDO' : etapa.tipo === 'FECHAMENTO' ? 'FECHOU_VENDA' : 'MOVEU_ETAPA',
      lead.etapa_funil, etapa_funil, ator,
      etapa.tipo === 'PERDIDA' ? { motivo: perda?.motivo, motivo_outro: perda?.motivo_outro, observacoes: perda?.observacoes, valor: lead.valor_estimado } : null
    );

    return reply.send({ status: 'success', data: updated });
  });

  // ═══════════════════════════════════════════════════════════
  // HISTÓRICO DE UM LEAD
  // ═══════════════════════════════════════════════════════════
  fastify.get('/leads/:id/historico-funil', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM LeadHistorico WHERE lead_id = ? ORDER BY created_at DESC LIMIT 100`, id
    );
    return reply.send({ status: 'success', data: rows });
  });

  // ═══════════════════════════════════════════════════════════
  // PERDAS — listagem e relatórios
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/perdas', async (request, reply) => {
    const user = (request as any).user;
    const vendedor = isVendedor(request);

    const where = vendedor && user?.id ? `WHERE vendedor_id = '${user.id.replace(/'/g, "''")}'` : '';
    const perdas: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM LeadPerda ${where} ORDER BY created_at DESC LIMIT 500`);

    // Agregações
    const total = perdas.length;
    const valor_total = perdas.reduce((s, p) => s + Number(p.valor_oportunidade || 0), 0);
    const por_motivo: Record<string, { count: number; valor: number }> = {};
    for (const p of perdas) {
      const m = p.motivo || 'Sem motivo';
      if (!por_motivo[m]) por_motivo[m] = { count: 0, valor: 0 };
      por_motivo[m].count++;
      por_motivo[m].valor += Number(p.valor_oportunidade || 0);
    }
    return reply.send({ status: 'success', data: { perdas, total, valor_total, por_motivo } });
  });

  // ═══════════════════════════════════════════════════════════
  // MÉTRICAS — cards de resumo do funil (por papel)
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/metricas', async (request, reply) => {
    const user = (request as any).user;
    const vendedor = isVendedor(request);
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseFilter: any = {};
    if (vendedor && user?.id) baseFilter.responsavel_id = user.id;

    // Pipeline ativo: etapas ANDAMENTO
    const etapasAndamento: any[] = await prisma.$queryRawUnsafe(
      `SELECT codigo FROM FunilEtapa WHERE tipo = 'ANDAMENTO' AND ativa = TRUE`
    );
    const codigosAndamento = etapasAndamento.map(e => e.codigo);

    const [leadsAtivos, pipeline, ganhos, perdidos] = await Promise.all([
      prisma.lead.count({ where: { ...baseFilter, etapa_funil: { in: codigosAndamento } } }),
      prisma.lead.aggregate({ where: { ...baseFilter, etapa_funil: { in: codigosAndamento } }, _sum: { valor_estimado: true } }),
      prisma.lead.aggregate({
        where: { ...baseFilter, status: 'GANHO', updated_at: { gte: inicioMes } },
        _sum: { valor_estimado: true }, _count: true
      }),
      prisma.lead.count({ where: { ...baseFilter, status: 'PERDIDO', updated_at: { gte: inicioMes } } })
    ]);

    // Meta do vendedor (se houver)
    let meta_valor = 0, meta_trim_valor = 0, bonus_valor = 0;
    if (vendedor && user?.id) {
      const trimestre = Math.floor(now.getMonth() / 3) + 1;
      const metas: any[] = await prisma.$queryRawUnsafe(
        `SELECT meta_valor, mes, trimestre, bonus_valor FROM MetaVendedor WHERE vendedor_id = ? AND ano = ?`,
        user.id, now.getFullYear()
      );
      const metaMes = metas.find(m => m.mes === now.getMonth() + 1);
      const metaTrim = metas.find(m => m.trimestre === trimestre && !m.mes);
      if (metaMes) meta_valor = Number(metaMes.meta_valor);
      if (metaTrim) { meta_trim_valor = Number(metaTrim.meta_valor); bonus_valor = Number(metaTrim.bonus_valor || 0); }
    }

    const vendidoMes = Number(ganhos._sum.valor_estimado || 0);
    const pctMeta = meta_valor > 0 ? (vendidoMes / meta_valor) * 100 : 0;
    const totalLeads = leadsAtivos + (ganhos._count as any) + perdidos;
    const taxaConversao = totalLeads > 0 ? ((ganhos._count as any) / totalLeads) * 100 : 0;

    // Vendido no trimestre
    const inicioTrim = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
    const ganhoTrim = await prisma.lead.aggregate({
      where: { ...baseFilter, status: 'GANHO', updated_at: { gte: inicioTrim } },
      _sum: { valor_estimado: true }
    });
    const vendidoTrim = Number(ganhoTrim._sum.valor_estimado || 0);
    const pctBonus = meta_trim_valor > 0 ? (vendidoTrim / meta_trim_valor) * 100 : 0;

    return reply.send({
      status: 'success',
      data: {
        leads_ativos: leadsAtivos,
        pipeline_total: Number(pipeline._sum.valor_estimado || 0),
        vendido_mes: vendidoMes,
        fechados_mes: ganhos._count,
        perdidos_mes: perdidos,
        meta_valor,
        meta_falta: Math.max(0, meta_valor - vendidoMes),
        meta_pct: Math.round(pctMeta * 10) / 10,
        meta_trim_valor,
        vendido_trim: vendidoTrim,
        bonus_valor,
        bonus_pct: Math.round(pctBonus * 10) / 10,
        bonus_falta: Math.max(0, meta_trim_valor - vendidoTrim),
        taxa_conversao: Math.round(taxaConversao * 10) / 10,
        meu_papel: user?.role || 'DESCONHECIDO',
        eh_vendedor: vendedor,
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // METAS — CRUD
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/metas', async (request, reply) => {
    if (!checkGestor(request) && !isVendedor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const user = (request as any).user;
    const where = isVendedor(request) ? `WHERE vendedor_id = '${user.id.replace(/'/g, "''")}'` : '';
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM MetaVendedor ${where} ORDER BY ano DESC, mes DESC, trimestre DESC`);
    return reply.send({ status: 'success', data: rows });
  });

  fastify.post('/funil/metas', async (request, reply) => {
    if (!checkGestor(request)) return reply.status(403).send({ status: 'error', message: 'Sem permissão' });
    const body = z.object({
      vendedor_id: z.string(),
      vendedor_nome: z.string().optional(),
      ano: z.number().int(),
      mes: z.number().int().min(1).max(12).optional().nullable(),
      trimestre: z.number().int().min(1).max(4).optional().nullable(),
      meta_valor: z.number(),
      bonus_valor: z.number().optional().nullable()
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const d = body.data;
    const metaId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO MetaVendedor (id, vendedor_id, vendedor_nome, ano, mes, trimestre, meta_valor, bonus_valor)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE meta_valor=VALUES(meta_valor), bonus_valor=VALUES(bonus_valor)`,
      metaId, d.vendedor_id, d.vendedor_nome || null, d.ano, d.mes || null, d.trimestre || null, d.meta_valor, d.bonus_valor || null
    );
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM MetaVendedor WHERE vendedor_id = ? AND ano = ? AND mes <=> ? AND trimestre <=> ? LIMIT 1`,
      d.vendedor_id, d.ano, d.mes || null, d.trimestre || null
    );
    return reply.send({ status: 'success', data: rows[0] });
  });

  // ═══════════════════════════════════════════════════════════
  // CONTROLE TOTAL — CEO/Supervisão
  // ═══════════════════════════════════════════════════════════
  fastify.get('/funil/controle-total', async (request, reply) => {
    const user = (request as any).user;
    if (!user || ![...SUPERVISAO].some(r => user.role?.includes(r))) {
      return reply.status(403).send({ status: 'error', message: 'Apenas CEO e Supervisão' });
    }
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Por vendedor
    const leads = await prisma.lead.findMany({
      where: { responsavel_id: { not: null } },
      select: { id: true, responsavel_id: true, status: true, etapa_funil: true, valor_estimado: true, updated_at: true }
    });

    const etapasAndamento: any[] = await prisma.$queryRawUnsafe(`SELECT codigo FROM FunilEtapa WHERE tipo = 'ANDAMENTO'`);
    const codigosAndamento = new Set(etapasAndamento.map(e => e.codigo));

    const porVendedor: Record<string, any> = {};
    for (const l of leads) {
      const v = l.responsavel_id || 'sem_responsavel';
      if (!porVendedor[v]) porVendedor[v] = { vendedor_id: v, leads_ativos: 0, pipeline: 0, vendido_mes: 0, fechados_mes: 0, perdidos_mes: 0 };
      if (codigosAndamento.has(l.etapa_funil)) {
        porVendedor[v].leads_ativos++;
        porVendedor[v].pipeline += l.valor_estimado || 0;
      }
      if (l.status === 'GANHO' && l.updated_at >= inicioMes) {
        porVendedor[v].vendido_mes += l.valor_estimado || 0;
        porVendedor[v].fechados_mes++;
      }
      if (l.status === 'PERDIDO' && l.updated_at >= inicioMes) {
        porVendedor[v].perdidos_mes++;
      }
    }

    const ranking = Object.values(porVendedor).sort((a: any, b: any) => b.vendido_mes - a.vendido_mes);

    return reply.send({ status: 'success', data: { por_vendedor: ranking } });
  });
}
