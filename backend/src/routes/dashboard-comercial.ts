import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ownerWhereId, ownerSqlId, effectiveScopeId } from '@/lib/scope';

export async function dashboardComercialRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  const withReconnect = async <T>(fn: () => Promise<T>): Promise<T> => {
    try { return await fn(); }
    catch (err: any) {
      if (/server has closed the connection|ECONNRESET|ETIMEDOUT|connection lost/i.test(err?.message || '')) {
        try { await prisma.$disconnect(); } catch {}
        await new Promise(r => setTimeout(r, 500));
        await prisma.$connect();
        return await fn();
      }
      throw err;
    }
  };

  fastify.get('/dashboard/comercial', async (request, reply) => {
    // ── Escopo de dados ──
    // Vendedor: sempre o próprio. Gestor: vê tudo, OU filtra por um vendedor
    // específico via ?vendedor_id (filtro do dashboard/radar).
    const filtroVendedor = (request.query as any)?.vendedor_id as string | undefined;
    const scopeId = effectiveScopeId(request, filtroVendedor);  // null = sem filtro (todos)
    const sc  = ownerSqlId('Lead', scopeId, 'l');   // ' AND (l.responsavel_id = ? OR l.created_by = ?)' ou ''
    const sc0 = ownerSqlId('Lead', scopeId);         // mesma cláusula sem alias (FROM Lead direto)
    const restrito = scopeId !== null;               // true = visão de UM vendedor (próprio ou filtrado)
    const now   = new Date();
    const h24   = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d3    = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000);
    const d7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Radar ─────────────────────────────────────────────────────────────────

    // 1. Leads novos sem contato real (> 24h, sem obs de contato)
    // withReconnect na primeira query: se MySQL fechou a conexão idle, reconecta antes de continuar.
    const sem_contato: any[] = await withReconnect(() => prisma.$queryRawUnsafe(`
      SELECT l.id, l.nome, l.nome_fantasia, l.segmento, l.temperatura,
             l.etapa_comercial, l.vendedor_nome, l.created_at,
             TIMESTAMPDIFF(SECOND, l.created_at, NOW())/3600 AS horas_sem_contato
      FROM \`Lead\` l
      WHERE l.deleted_at IS NULL AND l.etapa_comercial NOT IN ('FECHADO','PERDIDO')
        AND l.created_at < ?${sc.clause}
        AND NOT EXISTS (
          SELECT 1 FROM LeadObservacao lo
          WHERE lo.lead_id = l.id
            AND lo.tipo IN ('LIGACAO','WHATSAPP','EMAIL','REUNIAO')
        )
      ORDER BY l.created_at ASC
      LIMIT 30
    `, h24, ...sc.params)).catch(() => []);

    // 2. Retornos vencidos (proximo_contato passou)
    const retorno_vencido = await prisma.lead.findMany({
      where: {
        etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
        proximo_contato: { lt: now, not: null },
        ...ownerWhereId('Lead', scopeId),
      },
      select: {
        id: true, nome: true, nome_fantasia: true, temperatura: true,
        etapa_comercial: true, vendedor_nome: true, proximo_contato: true, segmento: true,
      },
      orderBy: { proximo_contato: 'asc' },
      take: 30,
    });

    // 3. Leads QUENTE / MUITO_QUENTE sem proposta gerada
    const quentes_sem_proposta: any[] = await prisma.$queryRawUnsafe(`
      SELECT l.id, l.nome, l.nome_fantasia, l.temperatura, l.etapa_comercial,
             l.vendedor_nome, l.segmento, l.updated_at,
             TIMESTAMPDIFF(SECOND, l.updated_at, NOW())/86400 AS dias_parado
      FROM \`Lead\` l
      WHERE l.deleted_at IS NULL AND l.temperatura IN ('QUENTE','MUITO_QUENTE')
        AND l.etapa_comercial NOT IN ('FECHADO','PERDIDO')${sc.clause}
        AND NOT EXISTS (
          SELECT 1 FROM PropostaComercial pc WHERE pc.lead_id = l.id
        )
      ORDER BY l.temperatura DESC, l.updated_at ASC
      LIMIT 30
    `, ...sc.params).catch(() => []);

    // 4. Leads parados > 7 dias sem atualização
    const leads_parados = await prisma.lead.findMany({
      where: {
        etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
        updated_at: { lt: d7 },
        ...ownerWhereId('Lead', scopeId),
      },
      select: {
        id: true, nome: true, nome_fantasia: true, temperatura: true,
        etapa_comercial: true, vendedor_nome: true, updated_at: true, segmento: true,
      },
      orderBy: { updated_at: 'asc' },
      take: 30,
    });

    // 5. Proposta enviada sem follow-up > 3 dias
    const proposta_sem_followup: any[] = await prisma.$queryRawUnsafe(`
      SELECT l.id, l.nome, l.nome_fantasia, l.temperatura, l.etapa_comercial,
             l.vendedor_nome, l.ultima_obs_at, l.segmento,
             TIMESTAMPDIFF(SECOND, COALESCE(l.ultima_obs_at, l.updated_at), NOW())/86400 AS dias_sem_followup
      FROM \`Lead\` l
      WHERE l.deleted_at IS NULL AND l.etapa_comercial = 'PROPOSTA_ENVIADA'
        AND (l.ultima_obs_at IS NULL OR l.ultima_obs_at < ?)${sc.clause}
      ORDER BY l.ultima_obs_at ASC
      LIMIT 30
    `, d3, ...sc.params).catch(() => []);

    // 6. Leads de campanha sem vendedor responsável
    //    É um item de gestão (distribuir leads órfãos) — o vendedor não vê.
    const campanha_sem_vendedor = restrito ? [] : await prisma.lead.findMany({
      where: {
        etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
        OR: [{ utm_source: { not: null } }, { campanha_nome: { not: null } }],
        vendedor_nome: null,
      },
      select: {
        id: true, nome: true, nome_fantasia: true, origem: true,
        utm_source: true, campanha_nome: true, plataforma: true, created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    // ── Métricas por vendedor ─────────────────────────────────────────────────

    const vendedores_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        TRIM(l.vendedor_nome)                                                 AS vendedor_nome,
        COUNT(*)                                                              AS total_leads,
        COUNT(CASE WHEN l.etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN l.etapa_comercial = 'FECHADO'  THEN 1 END)           AS fechados,
        COUNT(CASE WHEN l.etapa_comercial = 'PERDIDO'  THEN 1 END)           AS perdidos,
        COUNT(CASE WHEN l.temperatura = 'MUITO_QUENTE' THEN 1 END)           AS muito_quente,
        COUNT(CASE WHEN l.temperatura = 'QUENTE'       THEN 1 END)           AS quente,
        COUNT(CASE WHEN l.temperatura = 'MORNO'        THEN 1 END)           AS morno,
        COUNT(CASE WHEN l.temperatura = 'FRIO'         THEN 1 END)           AS frio,
        COUNT(CASE WHEN l.created_at >= ?              THEN 1 END)           AS leads_mes
      FROM \`Lead\` l
      WHERE l.deleted_at IS NULL AND TRIM(COALESCE(l.vendedor_nome,'')) <> ''${sc.clause}
      GROUP BY TRIM(l.vendedor_nome)
      ORDER BY total_leads DESC
    `, inicioMes, ...sc.params).catch(() => []);

    const obs_vendedor_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        lo.created_by_name,
        lo.tipo,
        COUNT(*) AS total
      FROM LeadObservacao lo
      WHERE lo.tipo NOT IN ('SISTEMA','COLUNA_ALTERADA','TEMPERATURA_ALTERADA')
        AND lo.created_by_name IS NOT NULL${restrito ? ' AND lo.created_by = ?' : ''}
      GROUP BY lo.created_by_name, lo.tipo
    `, ...(restrito ? [scopeId!] : [])).catch(() => []);

    const propostas_vendedor_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        TRIM(l.vendedor_nome) AS vendedor_nome,
        COUNT(pc.id) AS propostas_geradas,
        COUNT(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO') THEN 1 END) AS aceitas,
        COALESCE(SUM(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO')
            THEN COALESCE(pc.valor_final, 0) END), 0) AS setup_fechado,
        COALESCE(SUM(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO')
            THEN CASE WHEN pc.plano_selecionado = 'PLUS' THEN COALESCE(pc.mensalidade_plus,0)
                      WHEN pc.plano_selecionado = 'PRO'  THEN COALESCE(pc.mensalidade_pro,0)
                      ELSE COALESCE(pc.mensalidade_plus, COALESCE(pc.mensalidade_pro,0)) END
            END), 0) AS mrr_fechado
      FROM \`Lead\` l
      LEFT JOIN PropostaComercial pc ON pc.lead_id = l.id AND pc.deleted_at IS NULL
      WHERE l.deleted_at IS NULL AND TRIM(COALESCE(l.vendedor_nome,'')) <> ''${sc.clause}
      GROUP BY TRIM(l.vendedor_nome)
    `, ...sc.params).catch(() => []);

    const vendedores = vendedores_raw.map(v => {
      // COUNT(*) do MySQL vem como BigInt — converter tudo p/ Number (senão dá
      // "Cannot mix BigInt and other types" e o radar inteiro quebra).
      const totalLeads = Number(v.total_leads || 0);
      const fechados   = Number(v.fechados || 0);
      const nomeV = (v.vendedor_nome || '').trim();
      const obs_rows = obs_vendedor_raw.filter(o => (o.created_by_name || '').trim() === nomeV);
      const pr       = propostas_vendedor_raw.find(p => (p.vendedor_nome || '').trim() === nomeV);
      const obs_by_tipo: Record<string, number> = {};
      obs_rows.forEach(o => { obs_by_tipo[o.tipo] = Number(o.total || 0); });
      const total_contatos = obs_rows.reduce((s, o) => s + Number(o.total || 0), 0);
      const taxa_conversao = totalLeads > 0 ? Math.round((fechados / totalLeads) * 100) : 0;
      return {
        nome:              v.vendedor_nome,
        total_leads:       totalLeads,
        leads_mes:         Number(v.leads_mes || 0),
        ativos:            Number(v.ativos || 0),
        fechados,
        perdidos:          Number(v.perdidos || 0),
        muito_quente:      Number(v.muito_quente || 0),
        quente:            Number(v.quente || 0),
        morno:             Number(v.morno || 0),
        frio:              Number(v.frio || 0),
        taxa_conversao,
        total_contatos,
        obs_by_tipo,
        propostas_geradas: Number(pr?.propostas_geradas || 0),
        propostas_aceitas: Number(pr?.aceitas           || 0),
        mrr_fechado:       Math.round(Number(pr?.mrr_fechado   || 0)),
        setup_fechado:     Math.round(Number(pr?.setup_fechado || 0)),
      };
    });

    // ── Métricas por origem ───────────────────────────────────────────────────

    const origens: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        origem,
        COUNT(*)                                                              AS total,
        COUNT(CASE WHEN etapa_comercial = 'FECHADO'            THEN 1 END)   AS fechados,
        COUNT(CASE WHEN etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN temperatura IN ('QUENTE','MUITO_QUENTE') THEN 1 END) AS quentes
      FROM \`Lead\`
      WHERE deleted_at IS NULL${sc0.clause}
      GROUP BY origem
      ORDER BY total DESC
    `, ...sc0.params).catch(() => []);

    // ── Métricas por campanha UTM ─────────────────────────────────────────────

    const campanhas: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(NULLIF(campanha_nome,''), NULLIF(utm_campaign,''), 'Sem nome')  AS campanha,
        COALESCE(NULLIF(plataforma,''), NULLIF(utm_source,''), 'Desconhecido')   AS plataforma,
        COUNT(*)                                                              AS total,
        COUNT(CASE WHEN etapa_comercial = 'FECHADO'            THEN 1 END)   AS fechados,
        COUNT(CASE WHEN etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN temperatura IN ('QUENTE','MUITO_QUENTE') THEN 1 END) AS quentes
      FROM \`Lead\`
      WHERE deleted_at IS NULL AND (utm_source IS NOT NULL OR campanha_nome IS NOT NULL)${sc0.clause}
      GROUP BY campanha, plataforma
      ORDER BY total DESC
      LIMIT 25
    `, ...sc0.params).catch(() => []);

    // ── Distribuição por temperatura ──────────────────────────────────────────

    const temperaturas: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        temperatura,
        COUNT(*)                                                              AS total,
        COUNT(CASE WHEN etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN etapa_comercial = 'FECHADO'                  THEN 1 END) AS fechados
      FROM \`Lead\`
      WHERE deleted_at IS NULL${sc0.clause}
      GROUP BY temperatura
    `, ...sc0.params).catch(() => []);

    // ── Resumo de atividades por tipo ─────────────────────────────────────────

    const atividades_tipo: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        tipo,
        COUNT(*) AS total
      FROM LeadObservacao
      WHERE tipo NOT IN ('SISTEMA','COLUNA_ALTERADA','TEMPERATURA_ALTERADA')${restrito ? ' AND created_by = ?' : ''}
      GROUP BY tipo
      ORDER BY total DESC
    `, ...(restrito ? [scopeId!] : [])).catch(() => []);

    // ── Totais globais de leads ───────────────────────────────────────────────
    const escopoLead = ownerWhereId('Lead', scopeId);  // {} p/ visão geral, filtro p/ vendedor
    const [total_leads, ativos_total, fechados_total, perdidos_total] = await Promise.all([
      prisma.lead.count({ where: { ...escopoLead } }),
      prisma.lead.count({ where: { etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] }, ...escopoLead } }),
      prisma.lead.count({ where: { etapa_comercial: 'FECHADO', ...escopoLead } }),
      prisma.lead.count({ where: { etapa_comercial: 'PERDIDO', ...escopoLead } }),
    ]);

    const taxa_global = total_leads > 0
      ? Math.round((fechados_total / total_leads) * 100) : 0;

    // COUNT(*) do MySQL vem como BigInt (não serializa em JSON e quebra cálculos).
    // Converte os contadores das agregações cruas para Number.
    const num = (v: any) => Number(v || 0);
    const origensN     = origens.map(o => ({ ...o, total: num(o.total), fechados: num(o.fechados), ativos: num(o.ativos), quentes: num(o.quentes) }));
    const campanhasN   = campanhas.map(c => ({ ...c, total: num(c.total), fechados: num(c.fechados), ativos: num(c.ativos), quentes: num(c.quentes) }));
    const temperaturasN = temperaturas.map(t => ({ ...t, total: num(t.total), ativos: num(t.ativos), fechados: num(t.fechados) }));
    const atividadesN  = atividades_tipo.map(a => ({ ...a, total: num(a.total) }));

    // ── Indicadores de serviços complementares (vendas adicionais do mês) ──
    // Conta por categoria do parceiro: UPGRADE, COMUNICACAO, PAC, TEF, FISCAL
    // (Auditoria). Considera vendas CONFIRMADA/PAGA criadas no mês corrente.
    const vendasMes = await prisma.vendaAdicional.findMany({
      where: {
        status: { in: ['CONFIRMADA', 'PAGA'] },
        created_at: { gte: inicioMes },
        ...(restrito && scopeId ? { vendedor_id: scopeId } : {}),
      },
      select: { parceiro: { select: { categoria: true } }, lojas_ids: true },
    }).catch(() => [] as any[]);
    const servicos = { upgrades: 0, comunicacao: 0, pac: 0, tef: 0, auditoria: 0, total: 0 };
    for (const v of vendasMes) {
      const cat = (v.parceiro?.categoria || '').toUpperCase();
      servicos.total += 1;
      if (cat === 'UPGRADE') servicos.upgrades += 1;
      else if (cat === 'COMUNICACAO') servicos.comunicacao += (Array.isArray(v.lojas_ids) && v.lojas_ids.length ? v.lojas_ids.length : 1);
      else if (cat === 'PAC') servicos.pac += 1;
      else if (cat === 'TEF') servicos.tef += 1;
      else if (cat === 'FISCAL') servicos.auditoria += 1;
    }

    return reply.send({
      status: 'success',
      data: {
        resumo: { total_leads, ativos_total, fechados_total, perdidos_total, taxa_global },
        servicos,
        radar: {
          totals: {
            sem_contato:          sem_contato.length,
            retorno_vencido:      retorno_vencido.length,
            quentes_sem_proposta: quentes_sem_proposta.length,
            leads_parados:        leads_parados.length,
            proposta_sem_followup:proposta_sem_followup.length,
            campanha_sem_vendedor:campanha_sem_vendedor.length,
          },
          sem_contato,
          retorno_vencido,
          quentes_sem_proposta,
          leads_parados,
          proposta_sem_followup,
          campanha_sem_vendedor,
        },
        vendedores,
        origens: origensN,
        campanhas: campanhasN,
        temperaturas: temperaturasN,
        atividades_tipo: atividadesN,
      },
    });
  });
}
