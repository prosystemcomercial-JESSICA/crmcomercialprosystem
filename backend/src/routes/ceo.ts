import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';
import { resolverNomesUsuarios } from '@/lib/usuarios';

/**
 * PAINEL EXECUTIVO DO CEO — só RESULTADO/direção (sem operacional).
 * Consolida os indicadores que o CRM já calcula (MRR ativo, novos clientes, churn,
 * ticket, pipeline, previsão, leads, leads de campanha) + os indicadores manuais
 * (CAC, caixa, NPS, marketing, despesas) preenchidos mês a mês pela Diretora.
 * Filtro por período: hoje | mês | trimestre | ano.
 */
const STATUS_FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const STATUS_DECLINADA = ['RECUSADA', 'PERDIDA', 'EXPIRADA'];

export async function ceoRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Resolve o intervalo [inicio, fim) a partir do filtro de período.
  function intervalo(periodo: string, ano: number, mes: number) {
    const hoje = new Date();
    if (periodo === 'hoje') {
      const i = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const f = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
      return { inicio: i, fim: f };
    }
    if (periodo === 'ano') return { inicio: new Date(ano, 0, 1), fim: new Date(ano + 1, 0, 1) };
    if (periodo === 'trimestre') {
      const triIni = Math.floor((mes - 1) / 3) * 3; // 0,3,6,9
      return { inicio: new Date(ano, triIni, 1), fim: new Date(ano, triIni + 3, 1) };
    }
    // mês (default)
    return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 1) };
  }

  // Lead é "de campanha" quando veio de tráfego/campanha ou tem UTM/campaign_id.
  const ehCampanhaSQL = `(origem IN ('TRAFEGO','CAMPANHA') OR campaign_id IS NOT NULL OR utm_source IS NOT NULL)`;

  // ── PAINEL: 12 indicadores executivos por período ──
  fastify.get('/ceo/painel', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      periodo: z.enum(['hoje', 'mes', 'trimestre', 'ano']).default('mes'),
      ano: z.coerce.number().default(new Date().getFullYear()),
      mes: z.coerce.number().min(1).max(12).default(new Date().getMonth() + 1),
    }).safeParse(request.query);
    const { periodo, ano, mes } = q.success ? q.data : { periodo: 'mes' as const, ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
    const { inicio, fim } = intervalo(periodo, ano, mes);
    const noPeriodo = { gte: inicio, lt: fim };

    // ── Base de clientes ATIVOS: MRR recorrente atual + ticket médio ──
    const ativos = await prisma.cliente.findMany({
      where: { OR: [{ situacao: 'ATIVA' }, { situacao: null }] },
      select: { mensalidade_base: true },
    }).catch(() => [] as any[]);
    const mrrAtual = ativos.reduce((s, c) => s + Number(c.mensalidade_base || 0), 0);
    const baseAtiva = ativos.length;
    const ticketMedio = baseAtiva ? mrrAtual / baseAtiva : 0;

    // ── Novos clientes (fechamentos) no período ──
    const fechamentos = await prisma.propostaComercial.findMany({
      where: { status: { in: STATUS_FECHADA }, data_aceite: noPeriodo, deleted_at: null as any },
      select: { valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
    }).catch(() => [] as any[]);
    const novosClientes = fechamentos.length;
    const mrrNovo = fechamentos.reduce((s, p) => s + Number(p.mensalidade_plus ?? p.mensalidade_pro ?? 0), 0);
    const setupVendido = fechamentos.reduce((s, p) => s + Number(p.valor_implantacao ?? p.valor_final ?? 0), 0);

    // ── Cancelamentos / churn no período ──
    const perdidos = await prisma.cliente.findMany({
      where: { situacao: 'INATIVA', inativado_em: noPeriodo },
      select: { mrr_perdido: true, mensalidade_base: true },
    }).catch(() => [] as any[]);
    const cancelamentos = perdidos.length;
    const mrrPerdido = perdidos.reduce((s, c) => s + Number(c.mrr_perdido ?? c.mensalidade_base ?? 0), 0);
    // Churn % = clientes perdidos / base ativa (no início aproximado)
    const churnPct = (baseAtiva + cancelamentos) ? (cancelamentos / (baseAtiva + cancelamentos)) * 100 : 0;
    const netNewMrr = mrrNovo - mrrPerdido;

    // ── Pipeline aberto (em negociação) + previsão de meta ──
    const props = await prisma.propostaComercial.findMany({
      where: { deleted_at: null as any },
      select: { status: true, mensalidade_plus: true, mensalidade_pro: true, valor_implantacao: true, valor_final: true, data_aceite: true },
    }).catch(() => [] as any[]);
    let pipelineMrr = 0, pipelineQtd = 0;
    for (const p of props) {
      if (!STATUS_FECHADA.includes(p.status) && !STATUS_DECLINADA.includes(p.status)) {
        pipelineQtd++; pipelineMrr += Number(p.mensalidade_plus ?? p.mensalidade_pro ?? 0);
      }
    }
    // Previsão do mês = fechados no mês vs meta de contratos do mês.
    const rel = await prisma.relatorioComercial.findFirst({ where: { ano, mes }, select: { meta_contratos: true } }).catch(() => null);
    const metaContratos = rel?.meta_contratos ?? 15;
    const fechadosMes = await prisma.propostaComercial.count({
      where: { status: { in: STATUS_FECHADA }, data_aceite: { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) }, deleted_at: null as any },
    }).catch(() => 0);
    const previsaoMetaPct = metaContratos ? Math.round((fechadosMes / metaContratos) * 100) : 0;

    // ── Leads no período + quantos de campanha ──
    const totalLeads = await prisma.lead.count({ where: { created_at: noPeriodo, deleted_at: null } }).catch(() => 0);
    const leadsCampanhaRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) c FROM \`Lead\` WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? AND ${ehCampanhaSQL}`,
      inicio, fim,
    ).catch(() => [{ c: 0 }]);
    const leadsCampanha = Number(leadsCampanhaRows[0]?.c || 0);

    // ── Indicadores manuais do(s) mês(es) do período (CAC, caixa, NPS, marketing, despesas) ──
    const mesesNoPeriodo: { ano: number; mes: number }[] = [];
    { const cur = new Date(inicio); while (cur < fim) { mesesNoPeriodo.push({ ano: cur.getFullYear(), mes: cur.getMonth() + 1 }); cur.setMonth(cur.getMonth() + 1); } }
    const manuais = mesesNoPeriodo.length ? await prisma.indicadorMensalCEO.findMany({
      where: { OR: mesesNoPeriodo.map(m => ({ ano: m.ano, mes: m.mes })) },
    }).catch(() => [] as any[]) : [];
    const somaMan = (campo: string) => manuais.reduce((s: number, m: any) => s + Number(m[campo] || 0), 0);
    const ultimoMan: any = manuais.sort((a: any, b: any) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes)).slice(-1)[0] || {};
    const mediaMan = (campo: string) => { const v = manuais.filter((m: any) => m[campo] != null); return v.length ? v.reduce((s: number, m: any) => s + Number(m[campo]), 0) / v.length : null; };

    // Crescimento do MRR: compara com o mês anterior (snapshot via fechamentos-perdidos é aproximado).
    const data = {
      periodo, ano, mes,
      indicadores: {
        mrr_atual: Math.round(mrrAtual),
        mrr_novo: Math.round(mrrNovo),
        net_new_mrr: Math.round(netNewMrr),
        novos_clientes: novosClientes,
        cancelamentos,
        churn_pct: Math.round(churnPct * 10) / 10,
        ticket_medio: Math.round(ticketMedio),
        pipeline_mrr: Math.round(pipelineMrr),
        pipeline_qtd: pipelineQtd,
        previsao_meta_pct: previsaoMetaPct,
        fechados_mes: fechadosMes,
        meta_contratos: metaContratos,
        setup_vendido: Math.round(setupVendido),
        mrr_perdido: Math.round(mrrPerdido),
        base_ativa: baseAtiva,
        leads: totalLeads,
        leads_campanha: leadsCampanha,
        // manuais
        caixa_disponivel: ultimoMan.caixa_disponivel ?? null,
        contas_a_receber: ultimoMan.contas_a_receber ?? null,
        inadimplencia: ultimoMan.inadimplencia ?? null,
        faturamento: somaMan('faturamento') || null,
        lucro_liquido: somaMan('lucro_liquido') || null,
        despesas_setor: somaMan('despesas_setor') || null,
        marketing_investido: somaMan('marketing_investido') || null,
        cac: mediaMan('cac'),
        cpl: mediaMan('cpl'),
        nps: mediaMan('nps'),
        // Marketing: gasto × retorno (MRR novo do período como retorno recorrente).
        roi_marketing: somaMan('marketing_investido') ? Math.round((mrrNovo / somaMan('marketing_investido')) * 100) / 100 : null,
      },
    };
    return reply.send({ status: 'success', data });
  });

  // ── Indicadores manuais: GET (de um mês) e PUT (salvar/editar) ──
  fastify.get('/ceo/indicadores', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ ano: z.coerce.number(), mes: z.coerce.number().min(1).max(12) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Informe ano e mes' });
    const ind = await prisma.indicadorMensalCEO.findFirst({ where: { ano: q.data.ano, mes: q.data.mes } }).catch(() => null);
    return reply.send({ status: 'success', data: ind });
  });

  fastify.put('/ceo/indicadores', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      ano: z.number(), mes: z.number().min(1).max(12),
      caixa_disponivel: z.number().nullable().optional(),
      contas_a_receber: z.number().nullable().optional(),
      inadimplencia: z.number().nullable().optional(),
      faturamento: z.number().nullable().optional(),
      lucro_liquido: z.number().nullable().optional(),
      despesas_setor: z.number().nullable().optional(),
      marketing_investido: z.number().nullable().optional(),
      marketing_leads: z.number().int().nullable().optional(),
      cac: z.number().nullable().optional(),
      cpl: z.number().nullable().optional(),
      nps: z.number().nullable().optional(),
      observacoes: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const { ano, mes, ...campos } = body.data;
    const ind = await prisma.indicadorMensalCEO.upsert({
      where: { uq_indicador_ceo: { ano, mes } } as any,
      update: { ...campos } as any,
      create: { ano, mes, ...campos } as any,
    });
    return reply.send({ status: 'success', data: ind });
  });

  // Meses que já têm indicadores lançados (p/ a tela de entrada).
  fastify.get('/ceo/indicadores/meses', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const lista = await prisma.indicadorMensalCEO.findMany({ orderBy: [{ ano: 'desc' }, { mes: 'desc' }], select: { ano: true, mes: true } }).catch(() => []);
    return reply.send({ status: 'success', data: lista });
  });

  // ── MÓDULO COMISSÕES & VENDAS (CEO/gestão) — resumo executivo ──
  // Comissões por estágio (a confirmar / confirmada-a pagar / paga) e por mês de
  // pagamento + vendas adicionais/indicações por vendedor e a lista.
  fastify.get('/ceo/comissoes-vendas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ mes_pagamento: z.string().optional() }).safeParse(request.query);
    const mesFiltro = q.success ? q.data.mes_pagamento : undefined;

    // ── COMISSÕES ──
    const whereC: any = { status: { not: 'CANCELADA' } };
    if (mesFiltro) whereC.mes_pagamento = mesFiltro;
    const comissoes = await prisma.comissao.findMany({ where: whereC, orderBy: { created_at: 'desc' } }).catch(() => [] as any[]);
    const idsC = [...new Set(comissoes.map((c: any) => c.responsavel_id).filter(Boolean))];
    const nomesC = await resolverNomesUsuarios(prisma, idsC).catch(() => ({} as any));

    const ehPaga = (c: any) => c.estagio === 'PAGA' || c.status === 'PAGA';
    const totaisEstagio = { a_receber: 0, a_confirmar: 0, confirmada: 0, paga: 0 };
    const porMes: Record<string, any> = {};
    const porColab: Record<string, any> = {};
    for (const c of comissoes as any[]) {
      const v = Number(c.valor_comissao || 0);
      if (c.estagio === 'A_RECEBER') totaisEstagio.a_receber += v;
      else if (c.estagio === 'A_CONFIRMAR') totaisEstagio.a_confirmar += v;
      else if (c.estagio === 'CONFIRMADA') totaisEstagio.confirmada += v;
      else if (ehPaga(c)) totaisEstagio.paga += v;
      const mes = c.mes_pagamento || 'A definir';
      porMes[mes] = porMes[mes] || { mes_pagamento: mes, total: 0, count: 0, paga: 0, a_pagar: 0 };
      porMes[mes].total += v; porMes[mes].count += 1;
      if (ehPaga(c)) porMes[mes].paga += v; else porMes[mes].a_pagar += v;
      const rid = c.responsavel_id || 'sem';
      porColab[rid] = porColab[rid] || { responsavel_id: rid, nome: nomesC[rid] || rid, papel: c.papel || '', total: 0, paga: 0, a_pagar: 0 };
      porColab[rid].total += v; if (ehPaga(c)) porColab[rid].paga += v; else porColab[rid].a_pagar += v;
    }

    // ── VENDAS ADICIONAIS / INDICAÇÕES ──
    const vendas = await prisma.vendaAdicional.findMany({
      include: { parceiro: { select: { nome: true, categoria: true } }, cliente: { select: { razao_social: true, nome_fantasia: true, nome: true } } },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);
    const idsV = [...new Set(vendas.map((v: any) => v.vendedor_id).filter(Boolean))];
    const nomesV = await resolverNomesUsuarios(prisma, idsV).catch(() => ({} as any));
    const vendaLista = (vendas as any[]).map(v => ({
      cliente: v.cliente?.razao_social || v.cliente?.nome_fantasia || v.cliente?.nome || '—',
      vendedor: nomesV[v.vendedor_id] || v.vendedor_nome || '—',
      parceiro: v.parceiro?.nome || '—', categoria: v.parceiro?.categoria || '—',
      valor: Number(v.valor_venda || 0), acrescimo: Number(v.acrescimo_mensal || 0),
      comissao: Number(v.comissao_valor || 0), status: v.status,
    }));
    const porVendedorV: Record<string, any> = {};
    for (const v of vendaLista) {
      porVendedorV[v.vendedor] = porVendedorV[v.vendedor] || { vendedor: v.vendedor, qtd: 0, valor: 0, acrescimo: 0, comissao: 0 };
      porVendedorV[v.vendedor].qtd += 1; porVendedorV[v.vendedor].valor += v.valor;
      porVendedorV[v.vendedor].acrescimo += v.acrescimo; porVendedorV[v.vendedor].comissao += v.comissao;
    }
    const porCategoriaV: Record<string, any> = {};
    for (const v of vendaLista) {
      porCategoriaV[v.categoria] = porCategoriaV[v.categoria] || { categoria: v.categoria, qtd: 0, valor: 0 };
      porCategoriaV[v.categoria].qtd += 1; porCategoriaV[v.categoria].valor += v.valor;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return reply.send({
      status: 'success',
      data: {
        comissoes: {
          totais: { a_receber: round(totaisEstagio.a_receber), a_confirmar: round(totaisEstagio.a_confirmar), confirmada: round(totaisEstagio.confirmada), paga: round(totaisEstagio.paga) },
          por_mes: Object.values(porMes).sort((a: any, b: any) => (a.mes_pagamento > b.mes_pagamento ? 1 : -1)),
          por_colaborador: Object.values(porColab).sort((a: any, b: any) => b.total - a.total),
        },
        vendas: {
          total: vendaLista.length,
          por_vendedor: Object.values(porVendedorV).sort((a: any, b: any) => b.comissao - a.comissao),
          por_categoria: Object.values(porCategoriaV).sort((a: any, b: any) => b.valor - a.valor),
          lista: vendaLista,
        },
      },
    });
  });

  // ── MÓDULO SEPARADO: Vendas Adicionais & Indicações (visão CEO) ──
  // Faturamento (valor_venda) das vendas CONFIRMADAS no ano, com meta anual de
  // R$30.000 (super R$50.000) e barra de acompanhamento.
  fastify.get('/ceo/vendas-adicionais', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ ano: z.coerce.number().default(new Date().getFullYear()) }).safeParse(request.query);
    const ano = q.success ? q.data.ano : new Date().getFullYear();
    const ini = new Date(ano, 0, 1), fim = new Date(ano, 11, 31, 23, 59, 59);

    const META_ANUAL = 30000, SUPER_META = 50000;
    const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const vendas = await prisma.vendaAdicional.findMany({
      where: { status: 'CONFIRMADA' },
      include: { parceiro: { select: { nome: true, categoria: true } }, cliente: { select: { razao_social: true, nome_fantasia: true, nome: true } } },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);

    // Data de resultado = data_confirmacao (fallback data_venda/created_at).
    const dataDe = (v: any) => v.data_confirmacao || v.data_venda || v.created_at;
    const noAno = (vendas as any[]).filter(v => { const d = dataDe(v); return d && d >= ini && d <= fim; });

    const idsV = [...new Set(noAno.map((v: any) => v.vendedor_id).filter(Boolean))];
    const nomesV = await resolverNomesUsuarios(prisma, idsV).catch(() => ({} as any));

    const lista = noAno.map((v: any) => ({
      data: dataDe(v),
      cliente: v.cliente?.razao_social || v.cliente?.nome_fantasia || v.cliente?.nome || '—',
      vendedor: nomesV[v.vendedor_id] || v.vendedor_nome || '—',
      parceiro: v.parceiro?.nome || '—', categoria: v.parceiro?.categoria || v.tipo_negocio || '—',
      tipo: v.tipo_negocio || '—',
      valor: Number(v.valor_venda || 0), acrescimo: Number(v.acrescimo_mensal || 0),
    }));
    const faturamento = lista.reduce((s, v) => s + v.valor, 0);
    const acrescimoMrr = lista.reduce((s, v) => s + v.acrescimo, 0);

    // Série mensal (faturamento por mês) p/ a evolução.
    const porMesNum: Record<number, number> = {};
    noAno.forEach((v: any) => { const d = dataDe(v); const mm = new Date(d).getMonth(); porMesNum[mm] = (porMesNum[mm] || 0) + Number(v.valor_venda || 0); });
    const serie = MES_ABREV.map((rot, i) => ({ mes: rot, valor: Math.round(porMesNum[i] || 0) }));

    // Por vendedor e por categoria (faturamento).
    const porVend: Record<string, any> = {}, porCat: Record<string, any> = {};
    lista.forEach(v => {
      porVend[v.vendedor] = porVend[v.vendedor] || { vendedor: v.vendedor, qtd: 0, valor: 0, acrescimo: 0 };
      porVend[v.vendedor].qtd++; porVend[v.vendedor].valor += v.valor; porVend[v.vendedor].acrescimo += v.acrescimo;
      porCat[v.categoria] = porCat[v.categoria] || { categoria: v.categoria, qtd: 0, valor: 0 };
      porCat[v.categoria].qtd++; porCat[v.categoria].valor += v.valor;
    });

    const round = (n: number) => Math.round(n * 100) / 100;
    return reply.send({
      status: 'success',
      data: {
        ano,
        meta_anual: META_ANUAL, super_meta: SUPER_META,
        faturamento: round(faturamento),
        acrescimo_mrr_total: round(acrescimoMrr),
        pct_meta: Math.round((faturamento / META_ANUAL) * 100),
        pct_super: Math.round((faturamento / SUPER_META) * 100),
        total: lista.length,
        serie,
        por_vendedor: Object.values(porVend).sort((a: any, b: any) => b.valor - a.valor),
        por_categoria: Object.values(porCat).sort((a: any, b: any) => b.valor - a.valor),
        lista,
      },
    });
  });

  // ── ACOMPANHAMENTO DE CASOS DE CHURN (visão CEO, só leitura) ──
  // Lista os casos com o TEMPO em aberto (da abertura até hoje, ou até a resolução),
  // agrupados por situação, + KPIs. O detalhe (observações/atualizações) vem do
  // endpoint já existente /casos-churn/:id/atualizacoes.
  fastify.get('/ceo/churn-acompanhamento', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const ABERTOS = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'];
    const casos = await prisma.casoChurn.findMany({
      include: { cliente: { select: { razao_social: true, nome_fantasia: true, nome: true, codigo: true, grupo_tecnico: true, mrr_perdido: true, mensalidade_base: true } } },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);

    const hoje = new Date();
    const dias = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
    const lista = (casos as any[]).map(k => {
      const aberto = ABERTOS.includes(k.status);
      const emTratamento = k.status === 'EXECUTANDO' || k.status === 'PLANEJADO' || k.status === 'DIAGNOSTICADO';
      // Resolução = updated_at quando o caso saiu para RECUPERADO/PERDIDO.
      const fim = (k.status === 'RECUPERADO' || k.status === 'PERDIDO') ? new Date(k.updated_at) : null;
      const diasEmAberto = dias(new Date(k.created_at), fim || hoje);
      return {
        id: k.id, status: k.status, aberto, em_tratamento: emTratamento,
        cliente: k.cliente?.razao_social || k.cliente?.nome_fantasia || k.cliente?.nome || '—',
        codigo: k.cliente?.codigo || '—', fila: k.cliente?.grupo_tecnico || '—',
        motivo: k.motivo_principal || '—', descricao: k.descricao || '',
        risco: Number(k.risk_score || 0),
        mrr_em_risco: Number(k.cliente?.mrr_perdido || k.cliente?.mensalidade_base || 0),
        aberto_em: k.created_at, resolvido_em: fim,
        dias_em_aberto: diasEmAberto, resolvido: !!fim,
      };
    });

    const abertos = lista.filter(l => l.aberto);
    const tratamento = lista.filter(l => l.em_tratamento);
    const resolvidos = lista.filter(l => l.resolvido);
    const kpis = {
      total: lista.length,
      abertos: abertos.length,
      em_tratamento: tratamento.length,
      perdidos: lista.filter(l => l.status === 'PERDIDO').length,
      recuperados: lista.filter(l => l.status === 'RECUPERADO').length,
      mrr_em_risco: Math.round(abertos.reduce((s, l) => s + l.mrr_em_risco, 0)),
      tempo_medio_aberto: abertos.length ? Math.round(abertos.reduce((s, l) => s + l.dias_em_aberto, 0) / abertos.length) : 0,
      tempo_medio_resolucao: resolvidos.length ? Math.round(resolvidos.reduce((s, l) => s + l.dias_em_aberto, 0) / resolvidos.length) : 0,
      mais_antigo: abertos.length ? Math.max(...abertos.map(l => l.dias_em_aberto)) : 0,
    };
    return reply.send({ status: 'success', data: { kpis, lista } });
  });
}
