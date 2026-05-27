import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function dashboardComercialRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  fastify.get('/dashboard/comercial', async (_req, reply) => {
    const now   = new Date();
    const h24   = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d3    = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000);
    const d7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Radar ─────────────────────────────────────────────────────────────────

    // 1. Leads novos sem contato real (> 24h, sem obs de contato)
    const sem_contato: any[] = await prisma.$queryRawUnsafe(`
      SELECT l.id, l.nome, l.nome_fantasia, l.segmento, l.temperatura,
             l.etapa_comercial, l.vendedor_nome, l.created_at,
             TIMESTAMPDIFF(SECOND, l.created_at, NOW())/3600 AS horas_sem_contato
      FROM Lead l
      WHERE l.etapa_comercial NOT IN ('FECHADO','PERDIDO')
        AND l.created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM LeadObservacao lo
          WHERE lo.lead_id = l.id
            AND lo.tipo IN ('LIGACAO','WHATSAPP','EMAIL','REUNIAO')
        )
      ORDER BY l.created_at ASC
      LIMIT 30
    `, h24).catch(() => []);

    // 2. Retornos vencidos (proximo_contato passou)
    const retorno_vencido = await prisma.lead.findMany({
      where: {
        etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
        proximo_contato: { lt: now, not: null },
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
      FROM Lead l
      WHERE l.temperatura IN ('QUENTE','MUITO_QUENTE')
        AND l.etapa_comercial NOT IN ('FECHADO','PERDIDO')
        AND NOT EXISTS (
          SELECT 1 FROM PropostaComercial pc WHERE pc.lead_id = l.id
        )
      ORDER BY l.temperatura DESC, l.updated_at ASC
      LIMIT 30
    `).catch(() => []);

    // 4. Leads parados > 7 dias sem atualização
    const leads_parados = await prisma.lead.findMany({
      where: {
        etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] },
        updated_at: { lt: d7 },
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
      FROM Lead l
      WHERE l.etapa_comercial = 'PROPOSTA_ENVIADA'
        AND (l.ultima_obs_at IS NULL OR l.ultima_obs_at < ?)
      ORDER BY l.ultima_obs_at ASC
      LIMIT 30
    `, d3).catch(() => []);

    // 6. Leads de campanha sem vendedor responsável
    const campanha_sem_vendedor = await prisma.lead.findMany({
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
        l.vendedor_nome,
        COUNT(*)                                                              AS total_leads,
        COUNT(CASE WHEN l.etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN l.etapa_comercial = 'FECHADO'  THEN 1 END)           AS fechados,
        COUNT(CASE WHEN l.etapa_comercial = 'PERDIDO'  THEN 1 END)           AS perdidos,
        COUNT(CASE WHEN l.temperatura = 'MUITO_QUENTE' THEN 1 END)           AS muito_quente,
        COUNT(CASE WHEN l.temperatura = 'QUENTE'       THEN 1 END)           AS quente,
        COUNT(CASE WHEN l.temperatura = 'MORNO'        THEN 1 END)           AS morno,
        COUNT(CASE WHEN l.temperatura = 'FRIO'         THEN 1 END)           AS frio,
        COUNT(CASE WHEN l.created_at >= ?              THEN 1 END)           AS leads_mes
      FROM Lead l
      WHERE l.vendedor_nome IS NOT NULL
      GROUP BY l.vendedor_nome
      ORDER BY total_leads DESC
    `, inicioMes).catch(() => []);

    const obs_vendedor_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        lo.created_by_name,
        lo.tipo,
        COUNT(*) AS total
      FROM LeadObservacao lo
      WHERE lo.tipo NOT IN ('SISTEMA','COLUNA_ALTERADA','TEMPERATURA_ALTERADA')
        AND lo.created_by_name IS NOT NULL
      GROUP BY lo.created_by_name, lo.tipo
    `).catch(() => []);

    const propostas_vendedor_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        l.vendedor_nome,
        COUNT(pc.id) AS propostas_geradas,
        COUNT(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO') THEN 1 END) AS aceitas,
        COALESCE(SUM(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO')
            THEN COALESCE(pc.valor_final, 0) END), 0) AS setup_fechado,
        COALESCE(SUM(CASE WHEN pc.status IN ('ACEITA','CONTRATO_EM_GERACAO','CONTRATO_ENVIADO','CONTRATO_ASSINADO')
            THEN CASE WHEN pc.plano_selecionado = 'PLUS' THEN COALESCE(pc.mensalidade_plus,0)
                      WHEN pc.plano_selecionado = 'PRO'  THEN COALESCE(pc.mensalidade_pro,0)
                      ELSE COALESCE(pc.mensalidade_plus, COALESCE(pc.mensalidade_pro,0)) END
            END), 0) AS mrr_fechado
      FROM Lead l
      LEFT JOIN PropostaComercial pc ON pc.lead_id = l.id
      WHERE l.vendedor_nome IS NOT NULL
      GROUP BY l.vendedor_nome
    `).catch(() => []);

    const vendedores = vendedores_raw.map(v => {
      const obs_rows = obs_vendedor_raw.filter(o => o.created_by_name === v.vendedor_nome);
      const pr       = propostas_vendedor_raw.find(p => p.vendedor_nome === v.vendedor_nome);
      const obs_by_tipo: Record<string, number> = {};
      obs_rows.forEach(o => { obs_by_tipo[o.tipo] = o.total; });
      const total_contatos = obs_rows.reduce((s, o) => s + o.total, 0);
      const taxa_conversao = v.total_leads > 0
        ? Math.round((v.fechados / v.total_leads) * 100) : 0;
      return {
        nome:              v.vendedor_nome,
        total_leads:       v.total_leads,
        leads_mes:         v.leads_mes,
        ativos:            v.ativos,
        fechados:          v.fechados,
        perdidos:          v.perdidos,
        muito_quente:      v.muito_quente,
        quente:            v.quente,
        morno:             v.morno,
        frio:              v.frio,
        taxa_conversao,
        total_contatos,
        obs_by_tipo,
        propostas_geradas: pr?.propostas_geradas || 0,
        propostas_aceitas: pr?.aceitas           || 0,
        mrr_fechado:       Math.round(pr?.mrr_fechado   || 0),
        setup_fechado:     Math.round(pr?.setup_fechado || 0),
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
      FROM Lead
      GROUP BY origem
      ORDER BY total DESC
    `).catch(() => []);

    // ── Métricas por campanha UTM ─────────────────────────────────────────────

    const campanhas: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(NULLIF(campanha_nome,''), NULLIF(utm_campaign,''), 'Sem nome')  AS campanha,
        COALESCE(NULLIF(plataforma,''), NULLIF(utm_source,''), 'Desconhecido')   AS plataforma,
        COUNT(*)                                                              AS total,
        COUNT(CASE WHEN etapa_comercial = 'FECHADO'            THEN 1 END)   AS fechados,
        COUNT(CASE WHEN etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN temperatura IN ('QUENTE','MUITO_QUENTE') THEN 1 END) AS quentes
      FROM Lead
      WHERE utm_source IS NOT NULL OR campanha_nome IS NOT NULL
      GROUP BY campanha, plataforma
      ORDER BY total DESC
      LIMIT 25
    `).catch(() => []);

    // ── Distribuição por temperatura ──────────────────────────────────────────

    const temperaturas: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        temperatura,
        COUNT(*)                                                              AS total,
        COUNT(CASE WHEN etapa_comercial NOT IN ('FECHADO','PERDIDO') THEN 1 END) AS ativos,
        COUNT(CASE WHEN etapa_comercial = 'FECHADO'                  THEN 1 END) AS fechados
      FROM Lead
      GROUP BY temperatura
    `).catch(() => []);

    // ── Resumo de atividades por tipo ─────────────────────────────────────────

    const atividades_tipo: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        tipo,
        COUNT(*) AS total
      FROM LeadObservacao
      WHERE tipo NOT IN ('SISTEMA','COLUNA_ALTERADA','TEMPERATURA_ALTERADA')
      GROUP BY tipo
      ORDER BY total DESC
    `).catch(() => []);

    // ── Totais globais de leads ───────────────────────────────────────────────
    const [total_leads, ativos_total, fechados_total, perdidos_total] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { etapa_comercial: { notIn: ['FECHADO', 'PERDIDO'] } } }),
      prisma.lead.count({ where: { etapa_comercial: 'FECHADO' } }),
      prisma.lead.count({ where: { etapa_comercial: 'PERDIDO' } }),
    ]);

    const taxa_global = total_leads > 0
      ? Math.round((fechados_total / total_leads) * 100) : 0;

    return reply.send({
      status: 'success',
      data: {
        resumo: { total_leads, ativos_total, fechados_total, perdidos_total, taxa_global },
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
        origens,
        campanhas,
        temperaturas,
        atividades_tipo,
      },
    });
  });
}
