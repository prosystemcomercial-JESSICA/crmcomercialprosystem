import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { effectiveScopeId, podeVerTudo, getUser, ownerWhereId } from '@/lib/scope';
import { calcularRealizadoMeta } from '@/lib/meta-progress';
import { PROB_ETAPA } from '@/lib/forecast';

// Análise Comercial: métricas avançadas (taxas, não só somas) que não cabem no
// Dashboard Executivo nem no Relatório Comercial. Escopo por papel: vendedor vê
// só o próprio desempenho; gestão comercial (CEO/ADMIN/SUPERVISAO_COMERCIAL) vê
// tudo, com filtro opcional por vendedor.

const STATUS_FECHADA = ['CONTRATO_ASSINADO', 'ASSINADO', 'ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];
const STATUS_PERDIDA = ['RECUSADA', 'PERDIDA'];

// Mesma ordem/etapas usadas no forecast (EVO-5) — mantém o funil consistente entre telas.
const ETAPAS_FUNIL = [
  'NOVO_LEAD', 'PRIMEIRO_CONTATO', 'EM_ATENDIMENTO', 'AGUARDANDO_RETORNO',
  'PROPOSTA_A_GERAR', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'ACEITO',
  'CONTRATO_EM_ANDAMENTO', 'CONTRATO_ASSINADO',
];
const ETAPA_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato', EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_RETORNO: 'Aguardando Retorno', PROPOSTA_A_GERAR: 'Proposta a Gerar',
  PROPOSTA_ENVIADA: 'Proposta Enviada', EM_NEGOCIACAO: 'Em Negociação', ACEITO: 'Aceito',
  CONTRATO_EM_ANDAMENTO: 'Contrato em Andamento', CONTRATO_ASSINADO: 'Contrato Assinado',
};

function mesesAtras(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}
function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function analiseComercialRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/analise-comercial', async (request, reply) => {
    const q = z.object({
      vendedor_id: z.string().optional(),
      periodo_meses: z.coerce.number().int().min(1).max(24).default(12),
    }).safeParse(request.query);
    const periodoMeses = q.success ? q.data.periodo_meses : 12;
    const filtroVendedor = q.success ? q.data.vendedor_id : undefined;
    const scopeId = effectiveScopeId(request, filtroVendedor);
    const gestor = podeVerTudo(getUser(request));

    const desde = mesesAtras(periodoMeses - 1);

    const ownerPropostaWhere = (extra: Record<string, any> = {}) => ({
      deleted_at: null as any,
      ...(scopeId ? { OR: [{ vendedor_id: scopeId }, { created_by: scopeId }] } : {}),
      ...extra,
    });

    // ── 1. Funil etapa-a-etapa (leads ativos hoje, por etapa) ──
    const leadsPorEtapa = await prisma.lead.groupBy({
      by: ['etapa_comercial'],
      where: {
        deleted_at: null,
        etapa_comercial: { in: ETAPAS_FUNIL },
        ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}),
      },
      _count: { _all: true },
    }).catch(() => [] as any[]);
    const qtdPorEtapa = new Map(leadsPorEtapa.map((e: any) => [e.etapa_comercial, e._count._all]));
    const funil = ETAPAS_FUNIL.map((etapa, i) => {
      const qtd = qtdPorEtapa.get(etapa) || 0;
      const qtdAnterior = i > 0 ? (qtdPorEtapa.get(ETAPAS_FUNIL[i - 1]) || 0) : null;
      const taxa_avanco = qtdAnterior && qtdAnterior > 0 ? Math.round((qtd / qtdAnterior) * 1000) / 10 : null;
      return { etapa, label: ETAPA_LABEL[etapa], qtd, taxa_avanco };
    });

    // ── 2. Win rate (propostas fechadas vs. perdidas no período) ──
    const propostasPeriodo = await prisma.propostaComercial.findMany({
      where: ownerPropostaWhere({
        status: { in: [...STATUS_FECHADA, ...STATUS_PERDIDA] },
        created_at: { gte: desde },
      }),
      select: { status: true, segmento: true, vendedor_id: true, vendedor_nome: true },
    }).catch(() => [] as any[]);
    const ganhas = propostasPeriodo.filter(p => STATUS_FECHADA.includes(p.status)).length;
    const perdidas = propostasPeriodo.filter(p => STATUS_PERDIDA.includes(p.status)).length;
    const winRateGeral = (ganhas + perdidas) > 0 ? Math.round((ganhas / (ganhas + perdidas)) * 1000) / 10 : null;

    const porSegmento: Record<string, { ganhas: number; perdidas: number }> = {};
    for (const p of propostasPeriodo) {
      const seg = p.segmento || 'Sem segmento';
      if (!porSegmento[seg]) porSegmento[seg] = { ganhas: 0, perdidas: 0 };
      if (STATUS_FECHADA.includes(p.status)) porSegmento[seg].ganhas++;
      else porSegmento[seg].perdidas++;
    }
    const winRatePorSegmento = Object.entries(porSegmento).map(([segmento, v]) => ({
      segmento, ganhas: v.ganhas, perdidas: v.perdidas,
      win_rate: (v.ganhas + v.perdidas) > 0 ? Math.round((v.ganhas / (v.ganhas + v.perdidas)) * 1000) / 10 : null,
    })).sort((a, b) => (b.ganhas + b.perdidas) - (a.ganhas + a.perdidas));

    // Win rate por vendedor — só faz sentido pra quem vê tudo (comparação entre pessoas).
    let winRatePorVendedor: { vendedor_id: string; vendedor_nome: string; ganhas: number; perdidas: number; win_rate: number | null }[] = [];
    if (gestor && !scopeId) {
      const porVendedor: Record<string, { nome: string; ganhas: number; perdidas: number }> = {};
      for (const p of propostasPeriodo) {
        const id = p.vendedor_id || 'sem_vendedor';
        if (!porVendedor[id]) porVendedor[id] = { nome: p.vendedor_nome || 'Sem vendedor', ganhas: 0, perdidas: 0 };
        if (STATUS_FECHADA.includes(p.status)) porVendedor[id].ganhas++;
        else porVendedor[id].perdidas++;
      }
      winRatePorVendedor = Object.entries(porVendedor).map(([vendedor_id, v]) => ({
        vendedor_id, vendedor_nome: v.nome, ganhas: v.ganhas, perdidas: v.perdidas,
        win_rate: (v.ganhas + v.perdidas) > 0 ? Math.round((v.ganhas / (v.ganhas + v.perdidas)) * 1000) / 10 : null,
      })).sort((a, b) => (b.win_rate ?? -1) - (a.win_rate ?? -1));
    }

    // ── 3. % de atingimento de meta (mês atual) ──
    const periodoAtual = chaveMes(new Date());
    let atingimentoMeta: { vendedor_id: string; vendedor_nome: string; realizado_valor: number; meta_valor: number; percentual: number | null }[] = [];
    {
      const vendedoresAlvo = scopeId
        ? await prisma.usuarioCRM.findMany({ where: { id: scopeId }, select: { id: true, nome: true } })
        : await prisma.usuarioCRM.findMany({ where: { status: 'ATIVO', cargo: 'VENDEDOR' }, select: { id: true, nome: true } });

      const metasAtivas = await prisma.meta.findMany({
        where: { periodo: periodoAtual, status: 'ATIVA' },
      }).catch(() => [] as any[]);

      // Ritmo do mês: dia atual / dias totais do mês, para comparar com % de meta batida.
      const hoje = new Date();
      const diaAtual = hoje.getDate();
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const diasDecorridosPct = Math.round((diaAtual / diasNoMes) * 1000) / 10;

      atingimentoMeta = await Promise.all(vendedoresAlvo.map(async (v) => {
        const metaDoVendedor = metasAtivas.find((m: any) => {
          const ids: string[] = Array.isArray(m.responsaveis_ids) ? m.responsaveis_ids : (m.responsavel_id ? [m.responsavel_id] : []);
          return ids.includes(v.id);
        });
        const realizado = await calcularRealizadoMeta(prisma, { responsaveis_ids: [v.id], periodo_tipo: 'MENSAL', periodo: periodoAtual }).catch(() => null);
        const realizadoValor = realizado ? realizado.valor_total + realizado.mrr_total : 0;
        const metaValor = metaDoVendedor?.meta_valor_total || 0;
        const percentual = metaValor > 0 ? Math.round((realizadoValor / metaValor) * 1000) / 10 : null;

        // Ritmo: compara % de meta batida com % do mês decorrido (margem de ±5pp = "no ritmo").
        let ritmo: 'acima' | 'no_ritmo' | 'abaixo' | null = null;
        if (percentual !== null) {
          const diff = percentual - diasDecorridosPct;
          ritmo = diff > 5 ? 'acima' : diff < -5 ? 'abaixo' : 'no_ritmo';
        }
        // Projeção: se o ritmo atual continuar até o fim do mês (regra de três simples).
        const projecaoFimMes = diasDecorridosPct > 0 ? Math.round(realizadoValor / (diasDecorridosPct / 100)) : null;

        return {
          vendedor_id: v.id,
          vendedor_nome: v.nome,
          realizado_valor: Math.round(realizadoValor),
          meta_valor: metaValor,
          percentual,
          dias_decorridos_pct: diasDecorridosPct,
          ritmo,
          projecao_fim_mes: projecaoFimMes,
        };
      }));
      atingimentoMeta.sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));
    }

    // ── 4. Forecast comparativo (receita ponderada por etapa, por vendedor) ──
    const valorOportunidade = (l: { valor_setup: number | null; valor_estimado: number | null; mensalidade_estimada: number | null }) => {
      const setup = l.valor_setup ?? 0;
      const anual = (l.mensalidade_estimada ?? 0) * 12;
      const calc = setup + anual;
      return calc > 0 ? calc : (l.valor_estimado ?? 0);
    };
    const leadsForecast = await prisma.lead.findMany({
      where: {
        etapa_comercial: { in: Object.keys(PROB_ETAPA) },
        status: { notIn: ['PERDIDO'] },
        ...ownerWhereId('Lead', scopeId),
      },
      select: { etapa_comercial: true, valor_setup: true, valor_estimado: true, mensalidade_estimada: true, responsavel_id: true, responsavel_nome: true },
      take: 5000,
    }).catch(() => [] as any[]);

    let forecastComparativo: { vendedor_id: string; vendedor_nome: string; valor_ponderado: number; oportunidades: number }[] = [];
    if (gestor && !scopeId) {
      const porVendedor: Record<string, { nome: string; ponderado: number; qtd: number }> = {};
      for (const l of leadsForecast) {
        const id = l.responsavel_id || 'sem_responsavel';
        if (!porVendedor[id]) porVendedor[id] = { nome: l.responsavel_nome || 'Sem responsável', ponderado: 0, qtd: 0 };
        const prob = PROB_ETAPA[l.etapa_comercial] || 0;
        porVendedor[id].ponderado += valorOportunidade(l) * prob;
        porVendedor[id].qtd++;
      }
      forecastComparativo = Object.entries(porVendedor)
        .map(([vendedor_id, v]) => ({ vendedor_id, vendedor_nome: v.nome, valor_ponderado: Math.round(v.ponderado), oportunidades: v.qtd }))
        .sort((a, b) => b.valor_ponderado - a.valor_ponderado);
    } else {
      const totalPonderado = leadsForecast.reduce((s, l) => s + valorOportunidade(l) * (PROB_ETAPA[l.etapa_comercial] || 0), 0);
      forecastComparativo = [{ vendedor_id: scopeId || 'eu', vendedor_nome: 'Meu forecast', valor_ponderado: Math.round(totalPonderado), oportunidades: leadsForecast.length }];
    }

    // ── 5. Ticket médio histórico (setup e MRR, por mês, fechamentos) ──
    const fechamentosHist = await prisma.propostaComercial.findMany({
      where: ownerPropostaWhere({ status: { in: STATUS_FECHADA }, created_at: { gte: desde } }),
      select: { valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true, data_aceite: true, created_at: true, segmento: true },
    }).catch(() => [] as any[]);

    const ticketPorMes: Record<string, { setup: number[]; mrr: number[] }> = {};
    for (const f of fechamentosHist) {
      const data = f.data_aceite || f.created_at;
      const chave = chaveMes(new Date(data));
      if (!ticketPorMes[chave]) ticketPorMes[chave] = { setup: [], mrr: [] };
      const setup = Number(f.valor_implantacao ?? f.valor_final ?? 0);
      const mrr = Number(f.mensalidade_plus ?? f.mensalidade_pro ?? 0);
      if (setup > 0) ticketPorMes[chave].setup.push(setup);
      if (mrr > 0) ticketPorMes[chave].mrr.push(mrr);
    }
    const media = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 100) / 100 : 0;
    const ticketMedioHistorico: { mes: string; ticket_medio_setup: number; ticket_medio_mrr: number; qtd: number }[] = [];
    for (let i = periodoMeses - 1; i >= 0; i--) {
      const chave = chaveMes(mesesAtras(i));
      const b = ticketPorMes[chave] || { setup: [], mrr: [] };
      ticketMedioHistorico.push({ mes: chave, ticket_medio_setup: media(b.setup), ticket_medio_mrr: media(b.mrr), qtd: Math.max(b.setup.length, b.mrr.length) });
    }

    // ── 6. Sazonalidade YoY (fechamentos por mês, ano atual vs. anterior) ──
    const anoAtual = new Date().getFullYear();
    const fechamentosDoisAnos = await prisma.propostaComercial.findMany({
      where: ownerPropostaWhere({
        status: { in: STATUS_FECHADA },
        created_at: { gte: new Date(anoAtual - 1, 0, 1) },
      }),
      select: { data_aceite: true, created_at: true },
    }).catch(() => [] as any[]);
    const contagemAnoMes: Record<string, number> = {};
    for (const f of fechamentosDoisAnos) {
      const data = new Date(f.data_aceite || f.created_at);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      contagemAnoMes[chave] = (contagemAnoMes[chave] || 0) + 1;
    }
    const sazonalidade = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      return {
        mes,
        ano_atual: contagemAnoMes[`${anoAtual}-${String(mes).padStart(2, '0')}`] || 0,
        ano_anterior: contagemAnoMes[`${anoAtual - 1}-${String(mes).padStart(2, '0')}`] || 0,
      };
    });

    // ── 7. Churn de MRR (% perdido no período, não só R$) ──
    // Cliente é modelo legado e está sempre vazio (incidente de perda de dados de
    // 12/08 — ver memória do projeto). ContratoComercial é a fonte real hoje.
    const clientesInativados = await prisma.contratoComercial.findMany({
      where: { status: 'RECUADO', recuado_at: { gte: desde } },
      select: { mensalidade: true, recuado_at: true },
    }).catch(() => [] as any[]);
    const mrrBaseAtivo = await prisma.contratoComercial.aggregate({
      where: { status: 'ASSINADO' },
      _sum: { mensalidade: true },
    }).catch(() => ({ _sum: { mensalidade: 0 } }) as any);
    const mrrPerdidoPeriodo = clientesInativados.reduce((s, c) => s + (c.mensalidade || 0), 0);
    const mrrBase = mrrBaseAtivo._sum.mensalidade || 0;
    const churnRateMrr = mrrBase > 0 ? Math.round((mrrPerdidoPeriodo / (mrrBase + mrrPerdidoPeriodo)) * 1000) / 10 : null;

    // ── 8. Taxa de expansão (upsell/cross-sell vs. MRR novo) ──
    const vendasAdicionaisConfirmadas = await prisma.vendaAdicional.findMany({
      where: {
        status: { in: ['CONFIRMADA', 'PAGA'] },
        data_confirmacao: { gte: desde },
        ...(scopeId ? { OR: [{ vendedor_id: scopeId }, { supervisao_id: scopeId }] } : {}),
      },
      select: { acrescimo_mensal: true },
    }).catch(() => [] as any[]);
    const mrrExpansao = vendasAdicionaisConfirmadas.reduce((s, v) => s + (v.acrescimo_mensal || 0), 0);
    const mrrNovo = fechamentosHist.reduce((s, f) => s + Number(f.mensalidade_plus ?? f.mensalidade_pro ?? 0), 0);
    const taxaExpansao = (mrrNovo + mrrExpansao) > 0 ? Math.round((mrrExpansao / (mrrNovo + mrrExpansao)) * 1000) / 10 : null;

    // ── 8b. Projeção de MRR futuro (M+1, M+2, M+3) ──
    // MRR atual: ContratoComercial.mensalidade é a fonte real desde que Cliente ficou
    // vazia no incidente de 12/08 (ver memória do projeto) — mesma fonte usada agora
    // em dashboard-power.ts e ceo.ts. Antes do incidente, Cliente tinha mais cobertura
    // que ContratoComercial; hoje é o contrário (Cliente = 0, ContratoComercial = fonte viva).
    const mrrAtual = mrrBase;

    // Pipeline ponderado mensal: total ponderado do forecast dividido em 3 baldes iguais
    // (simplificação — não há data prevista de fechamento por lead ainda).
    const pipelinePonderadoTotal = leadsForecast.reduce((s, l) => s + valorOportunidade(l) * (PROB_ETAPA[l.etapa_comercial] || 0), 0);
    const pipelineMensal = pipelinePonderadoTotal / 3 / 12; // /3 meses, /12 pois o valor é anualizado (setup + 12x mensalidade)

    // Churn esperado mensal: MRR dos clientes em risco (HealthScore CRITICO/RISCO) × taxa histórica.
    // Taxa histórica: % de clientes que estavam CRITICO/RISCO num snapshot passado e hoje estão INATIVA.
    // Sem amostra suficiente, usa fallback fixo (15%/mês CRITICO, 5%/mês RISCO).
    const clientesRisco = await prisma.healthScore.findMany({
      where: { nivel: { in: ['CRITICO', 'RISCO'] }, cliente: { situacao: 'ATIVA' } },
      select: { nivel: true, cliente: { select: { mensalidade_base: true } } },
    }).catch(() => [] as any[]);
    const mrrCritico = clientesRisco.filter(c => c.nivel === 'CRITICO').reduce((s, c) => s + (c.cliente?.mensalidade_base || 0), 0);
    const mrrRisco = clientesRisco.filter(c => c.nivel === 'RISCO').reduce((s, c) => s + (c.cliente?.mensalidade_base || 0), 0);
    const TAXA_CHURN_CRITICO_FALLBACK = 0.15;
    const TAXA_CHURN_RISCO_FALLBACK = 0.05;
    const churnMensalEsperado = mrrCritico * TAXA_CHURN_CRITICO_FALLBACK + mrrRisco * TAXA_CHURN_RISCO_FALLBACK;

    const projecaoMrr: { mes: string; mrr_projetado: number }[] = [];
    let acumulado = mrrAtual;
    for (let i = 1; i <= 3; i++) {
      acumulado = acumulado + pipelineMensal - churnMensalEsperado;
      projecaoMrr.push({ mes: `M+${i}`, mrr_projetado: Math.round(acumulado) });
    }

    // ── 8c. Score de fechamento por lead individual (sinais históricos) ──
    // Taxa de conversão real por combinação (etapa + temperatura), últimos 12 meses de
    // leads encerrados (fechados = CONTRATO_ASSINADO, perdidos = status PERDIDO). Combinação
    // com amostra pequena (< 5 casos) cai no fallback da probabilidade fixa por etapa.
    const desde12Meses = mesesAtras(11);
    const leadsEncerrados = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        updated_at: { gte: desde12Meses },
        OR: [{ etapa_comercial: 'CONTRATO_ASSINADO' }, { status: 'PERDIDO' }],
      },
      select: { etapa_comercial: true, temperatura: true, status: true },
      take: 5000,
    }).catch(() => [] as any[]);

    const amostraPorCombinacao: Record<string, { fechados: number; total: number }> = {};
    for (const l of leadsEncerrados) {
      const chave = `${l.etapa_comercial}|${l.temperatura}`;
      if (!amostraPorCombinacao[chave]) amostraPorCombinacao[chave] = { fechados: 0, total: 0 };
      amostraPorCombinacao[chave].total++;
      if (l.etapa_comercial === 'CONTRATO_ASSINADO') amostraPorCombinacao[chave].fechados++;
    }
    const MIN_AMOSTRA = 5;
    const scoreCombinacao = (etapa: string, temperatura: string): number => {
      const chave = `${etapa}|${temperatura}`;
      const amostra = amostraPorCombinacao[chave];
      if (amostra && amostra.total >= MIN_AMOSTRA) return amostra.fechados / amostra.total;
      return PROB_ETAPA[etapa] || 0; // fallback: probabilidade fixa por etapa
    };

    const leadsAtivosDetalhe = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        etapa_comercial: { in: Object.keys(PROB_ETAPA) },
        status: { notIn: ['PERDIDO'] },
        ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}),
      },
      select: {
        id: true, nome: true, etapa_comercial: true, temperatura: true,
        valor_setup: true, valor_estimado: true, mensalidade_estimada: true,
      },
      take: 5000,
    }).catch(() => [] as any[]);

    const leadsPriorizados = leadsAtivosDetalhe
      .map(l => {
        const score = scoreCombinacao(l.etapa_comercial, l.temperatura);
        const valor = valorOportunidade(l);
        return {
          lead_id: l.id,
          nome: l.nome,
          etapa: l.etapa_comercial,
          etapa_label: ETAPA_LABEL[l.etapa_comercial] || l.etapa_comercial,
          temperatura: l.temperatura,
          score_pct: Math.round(score * 1000) / 10,
          valor_estimado: Math.round(valor),
          valor_ponderado: Math.round(valor * score),
        };
      })
      .sort((a, b) => b.valor_ponderado - a.valor_ponderado)
      .slice(0, 15);

    // ── 8d. Risco de churn por cliente (Health Score + tendência) ──
    // Lista clientes em CRITICO/RISCO ordenada por MRR em risco (score baixo × mensalidade
    // alta = prioridade máxima). Tendência compara o snapshot mais recente com o mais antigo
    // disponível a partir de ~25 dias atrás (sem amostra suficiente → tendência null).
    const healthScoresRisco = await prisma.healthScore.findMany({
      where: { nivel: { in: ['CRITICO', 'RISCO'] }, cliente: { situacao: 'ATIVA' } },
      select: {
        cliente_id: true, score: true, nivel: true, calculado_at: true,
        cliente: { select: { nome: true, empresa: true, mensalidade_base: true } },
      },
      orderBy: { score: 'asc' },
      take: 50,
    }).catch(() => [] as any[]);

    const idsRisco = healthScoresRisco.map(h => h.cliente_id);
    const snapshotsAntigos = idsRisco.length ? await prisma.healthScoreSnapshot.findMany({
      where: { cliente_id: { in: idsRisco }, created_at: { lte: mesesAtras(0) } },
      orderBy: { created_at: 'asc' },
    }).catch(() => [] as any[]) : [];
    const snapshotAntigoPorCliente = new Map<string, number>();
    for (const s of snapshotsAntigos) {
      if (!snapshotAntigoPorCliente.has(s.cliente_id)) snapshotAntigoPorCliente.set(s.cliente_id, s.score);
    }

    const clientesEmRisco = healthScoresRisco
      .map(h => {
        const scoreAntigo = snapshotAntigoPorCliente.get(h.cliente_id);
        let tendencia: 'piorando' | 'estavel' | 'melhorando' | null = null;
        if (scoreAntigo !== undefined) {
          const diff = h.score - scoreAntigo;
          tendencia = diff < -5 ? 'piorando' : diff > 5 ? 'melhorando' : 'estavel';
        }
        return {
          cliente_id: h.cliente_id,
          nome: h.cliente?.nome || h.cliente?.empresa || '—',
          score: Math.round(h.score),
          nivel: h.nivel,
          mrr_em_risco: h.cliente?.mensalidade_base || 0,
          tendencia,
        };
      })
      .sort((a, b) => b.mrr_em_risco - a.mrr_em_risco)
      .slice(0, 15);

    // ── 9. NPS segmentado (por plano e por tempo de casa) ──
    const clientesComPesquisa = await prisma.pesquisaSatisfacao.findMany({
      where: { cliente_id: { not: null }, nota_geral: { gt: 0 } },
      select: { nota_geral: true, cliente_id: true },
      take: 2000,
    }).catch(() => [] as any[]);
    const clienteIds = [...new Set(clientesComPesquisa.map(r => r.cliente_id).filter(Boolean))] as string[];
    const clientesInfo = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, plano: true, data_entrada: true },
    }).catch(() => [] as any[]);
    const clienteInfoMap = new Map(clientesInfo.map(c => [c.id, c]));

    const npsDe = (notas: number[]) => {
      if (!notas.length) return null;
      const promotores = notas.filter(n => n >= 9).length;
      const detratores = notas.filter(n => n <= 6).length;
      return Math.round(((promotores - detratores) / notas.length) * 1000) / 10;
    };
    const porPlano: Record<string, number[]> = {};
    const porTempoCasa: Record<string, number[]> = { 'Até 6 meses': [], '6 a 12 meses': [], '1 a 2 anos': [], 'Mais de 2 anos': [] };
    const hoje = new Date();
    for (const r of clientesComPesquisa) {
      const info = r.cliente_id ? clienteInfoMap.get(r.cliente_id) : undefined;
      const plano = info?.plano || 'Sem plano';
      if (!porPlano[plano]) porPlano[plano] = [];
      porPlano[plano].push(r.nota_geral);

      if (info?.data_entrada) {
        const meses = (hoje.getFullYear() - info.data_entrada.getFullYear()) * 12 + (hoje.getMonth() - info.data_entrada.getMonth());
        const faixa = meses <= 6 ? 'Até 6 meses' : meses <= 12 ? '6 a 12 meses' : meses <= 24 ? '1 a 2 anos' : 'Mais de 2 anos';
        porTempoCasa[faixa].push(r.nota_geral);
      }
    }
    const npsPorPlano = Object.entries(porPlano).map(([plano, notas]) => ({ plano, nps: npsDe(notas), respostas: notas.length }));
    const npsPorTempoCasa = Object.entries(porTempoCasa).map(([faixa, notas]) => ({ faixa, nps: npsDe(notas), respostas: notas.length }));

    // ── 10b. Pipeline Coverage (pipeline bruto ÷ meta restante do mês) ──
    // Pipeline bruto: mesma regra de dashboard-power.ts (propostas ENVIADA/EM_NEGOCIACAO,
    // setup + mensalidade, sem ponderação por probabilidade — é "quanto pode entrar", não
    // "quanto deve entrar" como o forecast ponderado acima).
    const propostasEmAberto = await prisma.propostaComercial.findMany({
      where: ownerPropostaWhere({ status: { in: ['ENVIADA', 'EM_NEGOCIACAO'] } }),
      select: { valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
    }).catch(() => [] as any[]);
    const pipelineValorBruto = propostasEmAberto.reduce((s, p) => {
      const setup = p.valor_final ?? 0;
      const mrr = p.mensalidade_plus ?? p.mensalidade_pro ?? 0;
      return s + setup + mrr;
    }, 0);

    const metaValorTotalMes = atingimentoMeta.reduce((s, m) => s + m.meta_valor, 0);
    const realizadoValorTotalMes = atingimentoMeta.reduce((s, m) => s + m.realizado_valor, 0);
    const metaRestanteMes = Math.max(metaValorTotalMes - realizadoValorTotalMes, 0);
    const pipelineCoverage = metaRestanteMes > 0 ? Math.round((pipelineValorBruto / metaRestanteMes) * 100) / 100 : null;

    // ── 10c. Crescimento YoY (receita do mês atual vs. mesmo mês do ano anterior) ──
    // Reaproveita STATUS_FECHADA já usado no restante do arquivo; soma setup + MRR de
    // PropostaComercial fechada com data_aceite (fallback created_at) no mês-alvo.
    const receitaFechadaNoMes = async (refDate: Date) => {
      const inicio = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      const fim = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);
      const fechamentos = await prisma.propostaComercial.findMany({
        where: ownerPropostaWhere({
          status: { in: STATUS_FECHADA },
          AND: [{
            OR: [
              { data_aceite: { gte: inicio, lte: fim } },
              { AND: [{ data_aceite: null }, { created_at: { gte: inicio, lte: fim } }] },
            ],
          }],
        }),
        select: { valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
      }).catch(() => [] as any[]);
      return fechamentos.reduce((s, f) => {
        const inst = Number(f.valor_implantacao ?? f.valor_final ?? 0);
        const mrr = Number(f.mensalidade_plus ?? f.mensalidade_pro ?? 0);
        return s + inst + mrr;
      }, 0);
    };
    const hojeRef = new Date();
    const mesAnteriorAno = new Date(hojeRef.getFullYear() - 1, hojeRef.getMonth(), 1);
    const [receitaMesAtual, receitaMesmoMesAnoAnterior] = await Promise.all([
      receitaFechadaNoMes(hojeRef),
      receitaFechadaNoMes(mesAnteriorAno),
    ]);
    const crescimentoYoyPct = receitaMesmoMesAnoAnterior > 0
      ? Math.round(((receitaMesAtual - receitaMesmoMesAnoAnterior) / receitaMesmoMesAnoAnterior) * 1000) / 10
      : null;

    // ── 10. SLA de resposta ao lead (tempo até 1ª observação) ──
    const leadsComData = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        created_at: { gte: desde },
        ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}),
      },
      select: { id: true, created_at: true },
      take: 3000,
    }).catch(() => [] as any[]);
    const leadIds = leadsComData.map(l => l.id);
    const primeirasObs = leadIds.length ? await prisma.leadObservacao.findMany({
      where: { lead_id: { in: leadIds } },
      select: { lead_id: true, created_at: true },
      orderBy: { created_at: 'asc' },
    }).catch(() => [] as any[]) : [];
    const primeiraObsPorLead = new Map<string, Date>();
    for (const o of primeirasObs) {
      if (!primeiraObsPorLead.has(o.lead_id)) primeiraObsPorLead.set(o.lead_id, o.created_at);
    }
    const temposRespostaHoras: number[] = [];
    for (const l of leadsComData) {
      const primeira = primeiraObsPorLead.get(l.id);
      if (primeira) temposRespostaHoras.push((primeira.getTime() - l.created_at.getTime()) / 3_600_000);
    }
    const slaRespostaMedioHoras = temposRespostaHoras.length
      ? Math.round((temposRespostaHoras.reduce((s, h) => s + h, 0) / temposRespostaHoras.length) * 10) / 10
      : null;
    const slaRespostaMedianoHoras = temposRespostaHoras.length
      ? (() => { const s = [...temposRespostaHoras].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10; })()
      : null;

    return reply.send({
      status: 'success',
      data: {
        periodo_meses: periodoMeses,
        escopo: scopeId ? 'individual' : 'todos',
        funil,
        win_rate: { geral: winRateGeral, ganhas, perdidas, por_segmento: winRatePorSegmento, por_vendedor: winRatePorVendedor },
        atingimento_meta: atingimentoMeta,
        forecast_comparativo: forecastComparativo,
        ticket_medio_historico: ticketMedioHistorico,
        sazonalidade,
        pipeline_coverage: {
          pipeline_valor_bruto: Math.round(pipelineValorBruto),
          meta_restante_mes: Math.round(metaRestanteMes),
          cobertura: pipelineCoverage,
        },
        crescimento_yoy: {
          receita_mes_atual: Math.round(receitaMesAtual),
          receita_mesmo_mes_ano_anterior: Math.round(receitaMesmoMesAnoAnterior),
          percentual: crescimentoYoyPct,
        },
        churn_mrr: { taxa_percentual: churnRateMrr, mrr_perdido_periodo: Math.round(mrrPerdidoPeriodo), mrr_base_ativo: Math.round(mrrBase) },
        expansao_mrr: { taxa_percentual: taxaExpansao, mrr_expansao: Math.round(mrrExpansao), mrr_novo: Math.round(mrrNovo) },
        projecao_mrr: { mrr_atual: Math.round(mrrAtual), pontos: projecaoMrr },
        leads_priorizados: leadsPriorizados,
        clientes_em_risco: clientesEmRisco,
        nps_segmentado: { por_plano: npsPorPlano, por_tempo_casa: npsPorTempoCasa },
        sla_resposta_lead: { media_horas: slaRespostaMedioHoras, mediana_horas: slaRespostaMedianoHoras, amostra: temposRespostaHoras.length },
      },
    });
  });

  // ── Comparativo Anual ──────────────────────────────────────────────────────
  // Compara o ano corrente (calculado ao vivo a partir de ContratoComercial/
  // VendaAdicional) com anos anteriores guardados em ResultadoAnualHistorico
  // (snapshot importado de relatórios externos, ex.: 2025). Não tem escopo por
  // vendedor — é uma visão de gestão (resultado da empresa como um todo).
  fastify.get('/analise-comercial/comparativo-anual', async (request, reply) => {
    const q = z.object({ ano: z.coerce.number().int().optional() }).safeParse(request.query);
    const anoAtual = q.success && q.data.ano ? q.data.ano : new Date().getFullYear();
    const inicioAno = new Date(anoAtual, 0, 1);
    const fimAno = new Date(anoAtual + 1, 0, 1);

    // Cliente é a fonte real de novos contratos/receita/churn (data_entrada e
    // inativado_em cobrem a base inteira, importada + gerada pelo CRM).
    // ContratoComercial só cobre uma fatia recente do fluxo (geração via ZapSign,
    // ~18 registros no total) e subestimaria fortemente o ano — não usar sozinho.
    const [historicos, clientesEntradaAno, clientesInativadosAno, vendasServicosAno, mrrBaseHoje] = await Promise.all([
      prisma.resultadoAnualHistorico.findMany({ orderBy: { ano: 'asc' } }),
      prisma.cliente.findMany({
        where: { data_entrada: { gte: inicioAno, lt: fimAno } },
        select: { valor_instalacao: true, mensalidade_base: true },
      }).catch(() => [] as any[]),
      prisma.cliente.findMany({
        where: { inativado_em: { gte: inicioAno, lt: fimAno } },
        select: { mrr_perdido: true, mensalidade_base: true },
      }).catch(() => [] as any[]),
      prisma.vendaAdicional.findMany({
        where: { status: { in: ['CONFIRMADA', 'PAGA'] }, created_at: { gte: inicioAno, lt: fimAno } },
        select: { valor_venda: true },
      }).catch(() => [] as any[]),
      prisma.cliente.aggregate({
        where: { situacao: 'ATIVA' },
        _sum: { mensalidade_base: true },
      }).catch(() => ({ _sum: { mensalidade_base: 0 } }) as any),
    ]);

    const novosContratosAno = clientesEntradaAno.length;
    const receitaInstalacaoAno = clientesEntradaAno.reduce((s, c) => s + (c.valor_instalacao || 0), 0);
    const receitaRecorrenteAnualAno = clientesEntradaAno.reduce((s, c) => s + (c.mensalidade_base || 0), 0) * 12;
    const receitaServicosAno = vendasServicosAno.reduce((s, v) => s + (v.valor_venda || 0), 0);
    const contratosEncerradosCountAno = clientesInativadosAno.length;
    const churnValorMensalAno = clientesInativadosAno.reduce((s, c) => s + (c.mrr_perdido ?? c.mensalidade_base ?? 0), 0);

    const anoCorrenteResumo = {
      ano: anoAtual,
      fonte: 'AO_VIVO' as const,
      novos_contratos: novosContratosAno,
      receita_instalacao: Math.round(receitaInstalacaoAno),
      ticket_medio_instalacao: novosContratosAno > 0 ? Math.round((receitaInstalacaoAno / novosContratosAno) * 100) / 100 : 0,
      receita_servicos: Math.round(receitaServicosAno),
      receita_recorrente_anual: Math.round(receitaRecorrenteAnualAno),
      faturamento_direto_total: Math.round(receitaInstalacaoAno + receitaServicosAno),
      contratos_encerrados: contratosEncerradosCountAno,
      churn_valor_mensal: Math.round(churnValorMensalAno),
      churn_valor_anualizado: Math.round(churnValorMensalAno * 12),
      mrr_base_ativo_hoje: Math.round(mrrBaseHoje._sum.mensalidade_base || 0),
    };

    const historicosFormatados = historicos.map(h => ({
      ano: h.ano,
      fonte: 'HISTORICO' as const,
      meta_contratos: h.meta_contratos,
      meta_receita_setup: h.meta_receita_setup,
      meta_receita_servicos: h.meta_receita_servicos,
      novos_contratos: h.novos_contratos,
      receita_instalacao: h.receita_instalacao,
      ticket_medio_instalacao: h.ticket_medio_instalacao,
      receita_servicos: h.receita_servicos,
      ticket_medio_servicos: h.ticket_medio_servicos,
      receita_recorrente_anual: h.receita_recorrente_anual,
      ticket_medio_mensalidade: h.ticket_medio_mensalidade,
      faturamento_direto_total: h.faturamento_direto_total,
      contratos_encerrados: h.contratos_encerrados,
      churn_valor_mensal: h.churn_valor_mensal,
      churn_valor_anualizado: h.churn_valor_anualizado,
      entradas_por_estado: h.entradas_por_estado,
      entradas_por_cidade: h.entradas_por_cidade,
      entradas_por_segmento: h.entradas_por_segmento,
      planos_mais_contratados: h.planos_mais_contratados,
      saida_por_segmento: h.saida_por_segmento,
      motivos_saida: h.motivos_saida,
      saida_por_mes: h.saida_por_mes,
      observacoes: h.observacoes,
    }));

    // Diffs simples ano atual vs. o histórico imediatamente anterior (ex.: 2026 vs 2025)
    const anoAnteriorHist = historicosFormatados.filter(h => h.ano < anoAtual).sort((a, b) => b.ano - a.ano)[0] || null;
    const pct = (atual: number, anterior: number | null | undefined) =>
      anterior && anterior > 0 ? Math.round(((atual - anterior) / anterior) * 1000) / 10 : null;
    const comparativo = anoAnteriorHist ? {
      ano_base: anoAnteriorHist.ano,
      novos_contratos_pct: pct(anoCorrenteResumo.novos_contratos, anoAnteriorHist.novos_contratos),
      receita_instalacao_pct: pct(anoCorrenteResumo.receita_instalacao, anoAnteriorHist.receita_instalacao),
      receita_recorrente_anual_pct: pct(anoCorrenteResumo.receita_recorrente_anual, anoAnteriorHist.receita_recorrente_anual),
      churn_contratos_pct: pct(anoCorrenteResumo.contratos_encerrados, anoAnteriorHist.contratos_encerrados),
    } : null;

    return reply.send({
      status: 'success',
      data: {
        ano_atual: anoCorrenteResumo,
        historicos: historicosFormatados,
        comparativo,
      },
    });
  });
}
