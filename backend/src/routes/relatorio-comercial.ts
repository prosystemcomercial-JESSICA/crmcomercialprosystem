import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';
import { resolverNomesUsuarios } from '@/lib/usuarios';
import { sincronizarLancamentosDeComissao } from '@/lib/comissao-fluxo';
import { calcularDesempenhoSdr } from '@/lib/sdr-desempenho';

// Relatório Comercial mensal (o que vai para o CEO).
// GET calcula o pipeline automaticamente das PropostasComerciais e mescla com o
// que foi salvo (marketing, churn, ligações). PUT salva/edita. Só gestão.

const STATUS_FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const STATUS_NEGOCIACAO = ['ENVIADA', 'EM_NEGOCIACAO', 'RASCUNHO'];
const STATUS_DECLINADA = ['RECUSADA', 'PERDIDA', 'EXPIRADA', 'DECLINADA'];

export async function relatorioComercialRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Seed: Março/2026 com os números reais que a Jessica passou (1x, idempotente).
  fastify.addHook('onReady', async () => {
    try {
      const existe = await prisma.relatorioComercial.findUnique({ where: { uq_relatorio_mes: { ano: 2026, mes: 3 } } });
      if (existe) return;
      await prisma.relatorioComercial.create({
        data: {
          ano: 2026, mes: 3, supervisor: 'Jessica Cardoso', fechado: true,
          contratos_fechados: 7, meta_contratos: 15, instalacao_total: 9400, mrr_total: 2350,
          cancelamentos: 4, mrr_perdido: 1153,
          propostas_total: 58, propostas_negociacao: 43, propostas_fechadas: 10, propostas_declinadas: 5,
          setup_potencial: 41450, mrr_potencial: 13510,
          por_vendedor: [
            { nome: 'Jessica Cardoso', propostas: 31, setup_potencial: 18150, mrr_potencial: 6700, em_negociacao: 22, fechadas: 9, participacao: 53 },
            { nome: 'Sarah', propostas: 16, setup_potencial: 11450, mrr_potencial: 3230, em_negociacao: 10, fechadas: 1, participacao: 28 },
            { nome: 'Kaio', propostas: 11, setup_potencial: 11850, mrr_potencial: 3580, em_negociacao: 11, fechadas: 0, participacao: 19 },
          ],
          por_segmento: [
            { segmento: 'Farmácia', propostas: 32, setup_total: 44700, mrr_total: 11330, ticket_mrr: 354, participacao: 77 },
            { segmento: 'Padaria', propostas: 20, setup_total: 12200, mrr_total: 5540, ticket_mrr: 277, participacao: 18 },
            { segmento: 'Varejo', propostas: 6, setup_total: 3800, mrr_total: 1710, ticket_mrr: 285, participacao: 5 },
          ],
          contratos_lista: [
            { empresa: 'Farmácia Preço Baixo de Muqui', segmento: 'Farmácia', instalacao: 1650, mrr: 350, origem: 'Lista Inativos' },
            { empresa: 'Farmácia do Trabalhador Mimoso do Sul', segmento: 'Farmácia', instalacao: 1450, mrr: 350, origem: 'Lista Inativos' },
            { empresa: 'Rangel Farmácia e Drogaria', segmento: 'Farmácia', instalacao: 950, mrr: 330, origem: 'Ebook' },
            { empresa: 'Perfumaria Riviera', segmento: 'Varejo', instalacao: 750, mrr: 280, origem: 'Cliente Base' },
            { empresa: 'FPB Porangatu', segmento: 'Farmácia', instalacao: 1800, mrr: 380, origem: 'Lista Inativos' },
          ],
          atividade: [
            { vendedor: 'Kaio', ligacoes: 1297, qualificadas: 19, tempo: '23h19min', conversao: '1,5%' },
            { vendedor: 'Sarah', ligacoes: 627, qualificadas: 27, tempo: '9h49min', conversao: null },
          ],
          marketing: { investido: 1104, resultados: 65, impressoes: 42220, roi: 6.6, campanhas: [
            { nome: 'SHE Leads', leads: 29, cpl: 29.65, investimento: 859.77 },
            { nome: 'Campanha Isca', assinaturas: 36, custo: 6.79, investimento: 244.60 },
          ] },
          cancelamentos_lista: [
            { motivo: 'Troca de sistema', qtd: 2 },
            { motivo: 'Falta de suporte / atendimento', qtd: 2 },
          ],
          resumo_executivo: [
            '✅ 7 contratos fechados',
            '✅ Pipeline robusto (58 propostas)',
            '✅ Farmácia continua sendo o principal motor comercial',
            '✅ Lista de inativos gerou o maior número de fechamentos',
            '⚠️ Cancelamentos ligados a suporte precisam de atenção',
            '⚠️ Alto volume comercial ainda pode converter mais contratos',
            '⚠️ Meta mensal atingida: apenas 47%',
          ],
        },
      });
      console.log('[RELATORIO] Março/2026 seedado.');
    } catch (e: any) { console.error('[RELATORIO] seed:', e?.message); }

    // Garante que toda comissão ativa tenha seu lançamento de despesa correspondente
    // no Centro de Custos (cobre também o backfill de maio/junho/2026 na primeira execução).
    try {
      const r = await sincronizarLancamentosDeComissao(prisma);
      console.log(`[RELATORIO] Sincronização comissão→despesa: ${r.criados} criados, ${r.jaExistiam} já existiam, ${r.removidos} removidos.`);
    } catch (e: any) { console.error('[RELATORIO] sincronizarLancamentosDeComissao:', e?.message); }
  });

  // true se [inicio,fimExclusiva) corresponde EXATAMENTE a um mês-calendário
  // (dia 1 ao 1º do mês seguinte) — usado para decidir se o "fechado" manual
  // da supervisão (RelatorioComercial) se aplica ao período selecionado.
  function ehMesCalendarioExato(inicio: Date, fimExclusiva: Date): { ano: number; mes: number } | null {
    const y = inicio.getFullYear(), m = inicio.getMonth();
    const inicioEsperado = new Date(y, m, 1);
    const fimEsperado = new Date(y, m + 1, 1);
    if (inicio.getTime() === inicioEsperado.getTime() && fimExclusiva.getTime() === fimEsperado.getTime()) {
      return { ano: y, mes: m + 1 };
    }
    return null;
  }

  // true se [inicio,fimExclusiva) corresponde EXATAMENTE a um ano-calendário.
  function ehAnoCalendarioExato(inicio: Date, fimExclusiva: Date): { ano: number } | null {
    const y = inicio.getFullYear();
    const inicioEsperado = new Date(y, 0, 1);
    const fimEsperado = new Date(y + 1, 0, 1);
    if (inicio.getTime() === inicioEsperado.getTime() && fimExclusiva.getTime() === fimEsperado.getTime()) {
      return { ano: y };
    }
    return null;
  }

  // Parseia "YYYY-MM-DD" como data LOCAL (meia-noite no fuso do servidor),
  // não UTC — `new Date("YYYY-MM-DD")` interpreta como UTC e desloca o dia
  // em fusos negativos (ex.: 2026-08-01 UTC vira 31/07 21h em GMT-03:00).
  function parseDataLocal(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  // Lista de "YYYY-MM" tocados pelo intervalo [inicio, fimExclusiva) — usada
  // pelas consultas de comissão, que só têm granularidade mensal (ver
  // metricasReaisPeriodo, seção 4b/4c: aproximação documentada).
  function mesesEntre(inicio: Date, fimExclusiva: Date): string[] {
    const out: string[] = [];
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const fimInclusivo = new Date(fimExclusiva.getTime() - 1);
    while (cursor <= fimInclusivo) {
      out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }

  // Calcula o pipeline de um PERÍODO (range de datas) a partir das propostas comerciais.
  async function calcularPipelinePeriodo(inicio: Date, fim: Date) {
    const props = await prisma.propostaComercial.findMany({
      // Excluídos NÃO contam nos resultados (deduzidos do cálculo).
      where: { created_at: { gte: inicio, lt: fim }, deleted_at: null as any },
      select: { status: true, segmento: true, vendedor_nome: true, valor_implantacao: true, mensalidade_plus: true, mensalidade_pro: true, valor_final: true },
    });

    const mrrDe = (p: any) => p.mensalidade_plus ?? p.mensalidade_pro ?? 0;
    const setupDe = (p: any) => p.valor_implantacao ?? p.valor_final ?? 0;

    let negociacao = 0, fechadas = 0, declinadas = 0, setupPot = 0, mrrPot = 0;
    const vend: Record<string, any> = {};
    const seg: Record<string, any> = {};

    for (const p of props) {
      const st = p.status;
      if (STATUS_FECHADA.includes(st)) fechadas++;
      else if (STATUS_DECLINADA.includes(st)) declinadas++;
      else negociacao++;
      setupPot += setupDe(p);
      mrrPot += mrrDe(p);

      const vn = p.vendedor_nome || 'Sem vendedor';
      vend[vn] = vend[vn] || { nome: vn, propostas: 0, setup_potencial: 0, mrr_potencial: 0, em_negociacao: 0, fechadas: 0 };
      vend[vn].propostas++; vend[vn].setup_potencial += setupDe(p); vend[vn].mrr_potencial += mrrDe(p);
      if (STATUS_FECHADA.includes(st)) vend[vn].fechadas++; else if (!STATUS_DECLINADA.includes(st)) vend[vn].em_negociacao++;

      const sg = p.segmento || 'Outros';
      seg[sg] = seg[sg] || { segmento: sg, propostas: 0, setup_total: 0, mrr_total: 0 };
      seg[sg].propostas++; seg[sg].setup_total += setupDe(p); seg[sg].mrr_total += mrrDe(p);
    }

    const totalMrr = mrrPot || 1;
    const por_vendedor = Object.values(vend).map((v: any) => ({ ...v, participacao: Math.round((v.mrr_potencial / totalMrr) * 100) }));
    const por_segmento = Object.values(seg).map((s: any) => ({ ...s, ticket_mrr: s.propostas ? Math.round(s.mrr_total / s.propostas) : 0, participacao: Math.round((s.mrr_total / totalMrr) * 100) }));

    return {
      propostas_total: props.length, propostas_negociacao: negociacao, propostas_fechadas: fechadas,
      propostas_declinadas: declinadas, setup_potencial: Math.round(setupPot), mrr_potencial: Math.round(mrrPot),
      por_vendedor, por_segmento, contratos_fechados: fechadas,
    };
  }

  // Métricas REAIS de um PERÍODO com LISTAS DE NOMES (p/ o relatório completo do comercial).
  // Todas as sub-consultas usam campos de data reais, EXCETO comissões
  // (mes_pagamento/periodo são strings "YYYY-MM" — ver mesesEntre acima).
  async function metricasReaisPeriodo(inicio: Date, fim: Date) {
    const noMes = { gte: inicio, lt: fim };

    // 1) Leads gerados no mês (criados no período).
    const totalLeads = await prisma.lead.count({ where: { created_at: noMes, deleted_at: null } }).catch(() => 0);

    // 2) Fechamentos do mês = propostas que ficaram ASSINADAS/fechadas (data_aceite no mês).
    const fechamentos = await prisma.propostaComercial.findMany({
      where: { status: { in: STATUS_FECHADA }, data_aceite: noMes, deleted_at: null as any },
      select: { id: true, razao_social: true, nome_fantasia: true, vendedor_nome: true, valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true, data_aceite: true },
      orderBy: { data_aceite: 'desc' },
    }).catch(() => [] as any[]);
    // O CONTRATO (quando existe) é a fonte de verdade do valor final — a proposta pode ter
    // sido revisada depois (forma de pagamento, desconto) sem que valor_implantacao/mensalidade
    // da proposta original fossem atualizados. Busca os contratos vinculados p/ sobrescrever.
    const contratosVinculados = fechamentos.length ? await prisma.contratoComercial.findMany({
      where: { proposta_comercial_id: { in: fechamentos.map((p: any) => p.id) } },
      select: { proposta_comercial_id: true, valor_setup_total: true, mensalidade: true },
    }).catch(() => [] as any[]) : [];
    const contratoPorProposta = new Map(contratosVinculados.map((c: any) => [c.proposta_comercial_id, c]));

    const setupDe = (p: any) => {
      const contrato = contratoPorProposta.get(p.id);
      if (contrato?.valor_setup_total != null) return Number(contrato.valor_setup_total);
      return Number(p.valor_implantacao ?? p.valor_final ?? 0);
    };
    const mrrDe = (p: any) => {
      const contrato = contratoPorProposta.get(p.id);
      if (contrato?.mensalidade != null) return Number(contrato.mensalidade);
      return Number(p.mensalidade_plus ?? p.mensalidade_pro ?? 0);
    };
    const fechamentos_lista = fechamentos.map((p: any) => ({
      cliente: p.razao_social || p.nome_fantasia || '—', vendedor: p.vendedor_nome || '—',
      setup: setupDe(p), mrr: mrrDe(p), data: p.data_aceite,
    }));
    const totalFechamentos = fechamentos.length;
    const setupTotal = fechamentos_lista.reduce((s, f) => s + f.setup, 0);
    const mrrGanhoTotal = fechamentos_lista.reduce((s, f) => s + f.mrr, 0);
    const setupMedio = totalFechamentos ? Math.round(setupTotal / totalFechamentos) : 0;
    const mrrMedio = totalFechamentos ? Math.round(mrrGanhoTotal / totalFechamentos) : 0;

    // 3) Clientes perdidos no mês (desativados) + mensalidade perdida — com nomes.
    const perdidos = await prisma.cliente.findMany({
      where: { situacao: 'INATIVA', inativado_em: noMes },
      select: { id: true, razao_social: true, nome_fantasia: true, nome: true, mrr_perdido: true, mensalidade_base: true, valor_devido_inativacao: true, motivo_inativacao: true, observacoes: true, grupo_tecnico: true, inativado_em: true },
      orderBy: { inativado_em: 'desc' },
    }).catch(() => [] as any[]);

    // Caso de churn de cada perdido → resumo do que foi relatado + valor devedor.
    const perdidoIds = perdidos.map((c: any) => c.id);
    const casos = perdidoIds.length ? await prisma.casoChurn.findMany({
      where: { clienteId: { in: perdidoIds } },
      select: { clienteId: true, motivo_principal: true, descricao: true, fin_situacao: true, fin_valor_atraso: true, fin_dias_atraso: true, created_at: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]) : [];
    const casoDe: Record<string, any> = {};
    for (const k of casos) { if (!casoDe[k.clienteId]) casoDe[k.clienteId] = k; } // o mais recente

    const perdidos_lista = perdidos.map((c: any) => {
      const k = casoDe[c.id] || {};
      return {
        cliente: c.razao_social || c.nome_fantasia || c.nome || '—',
        mrr_perdido: Number(c.mrr_perdido ?? c.mensalidade_base ?? 0),
        motivo: k.motivo_principal || c.motivo_inativacao || '—',
        // Breve resumo do que foi relatado (descrição do caso de churn ou observações).
        resumo: k.descricao || c.observacoes || '',
        valor_devedor: Number(k.fin_valor_atraso ?? c.valor_devido_inativacao ?? 0),
        fin_situacao: k.fin_situacao || '',
        dias_atraso: k.fin_dias_atraso ?? null,
        tecnico: c.grupo_tecnico || '—', data: c.inativado_em,
      };
    });
    const totalPerdidos = perdidos.length;
    const mrrPerdidoTotal = perdidos_lista.reduce((s, c) => s + c.mrr_perdido, 0);

    // 4) Vendas adicionais / indicações do mês.
    // Resultado conta pelas CONFIRMADAS (data_confirmacao no mês; fallback data_venda/created_at).
    // Mostra o SETUP que está entrando (valor_venda) e o aumento de MENSALIDADE (acrescimo_mensal).
    const vendasTodas = await prisma.vendaAdicional.findMany({
      select: { vendedor_nome: true, status: true, tipo_negocio: true, acrescimo_mensal: true, valor_venda: true, data_confirmacao: true, data_venda: true, created_at: true, parceiro: { select: { nome: true, categoria: true } }, cliente: { select: { razao_social: true, nome_fantasia: true, nome: true } } },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);
    const dataResultado = (v: any) => v.data_confirmacao || v.data_venda || v.created_at;
    const noMesVenda = (v: any) => { const d = dataResultado(v); return d && d >= inicio && d < fim; };
    // Confirmadas no mês = o que de fato entrou de resultado.
    const vendasConfirmadas = vendasTodas.filter((v: any) => v.status === 'CONFIRMADA' && noMesVenda(v));
    const va_lista = vendasConfirmadas.map((v: any) => ({
      cliente: v.cliente?.razao_social || v.cliente?.nome_fantasia || v.cliente?.nome || '—',
      parceiro: v.parceiro?.nome || '—', categoria: v.parceiro?.categoria || '—',
      tipo: v.tipo_negocio || '—', vendedor: v.vendedor_nome || '—', status: v.status,
      setup: Number(v.valor_venda || 0), acrescimo: Number(v.acrescimo_mensal || 0),
    }));
    const vaSetupTotal = va_lista.reduce((s, v) => s + v.setup, 0);          // setup entrando
    const vaAcrescimoTotal = va_lista.reduce((s, v) => s + v.acrescimo, 0);  // aumento de MRR
    const vaComAcrescimo = va_lista.filter(v => v.acrescimo > 0).length;
    const vaComSetup = va_lista.filter(v => v.setup > 0).length;
    const vendas_adicionais = {
      total: va_lista.length,
      setup_total: Math.round(vaSetupTotal),
      setup_medio: vaComSetup ? Math.round(vaSetupTotal / vaComSetup) : 0,
      acrescimo_mrr_total: Math.round(vaAcrescimoTotal),      // quanto a mensalidade aumentou no mês
      acrescimo_medio: vaComAcrescimo ? Math.round(vaAcrescimoTotal / vaComAcrescimo) : 0, // valor médio do aumento
      por_tipo: ['INDICACAO', 'REVENDA', 'COMUNICACAO', 'TROCA_CNPJ'].map(t => {
        const itens = va_lista.filter(v => v.tipo === t);
        return { tipo: t, qtd: itens.length, setup: Math.round(itens.reduce((s, v) => s + v.setup, 0)), acrescimo: Math.round(itens.reduce((s, v) => s + v.acrescimo, 0)) };
      }).filter(t => t.qtd > 0),
      lista: va_lista,
    };
    // Mantém o campo "indicacoes" por compatibilidade (telas antigas).
    const indicacoes_lista = va_lista.map((v: any) => ({
      cliente: v.cliente, parceiro: v.parceiro, categoria: v.categoria,
      vendedor: v.vendedor, status: v.status, acrescimo: v.acrescimo,
    }));

    // 4b) Comissões cujo MÊS DE PAGAMENTO cai no período (pagas + a pagar) — com nomes.
    // SEM granularidade diária: expande o range para os meses "YYYY-MM" tocados e
    // soma os meses INTEIROS (aproximação — pode incluir comissões pagas em dias
    // fora do range exato quando o período não é um mês/ano-calendário completo).
    const mesesTocados = mesesEntre(inicio, fim);
    const comissoesMes = await prisma.comissao.findMany({
      where: { mes_pagamento: { in: mesesTocados }, status: { not: 'CANCELADA' } },
      select: { responsavel_id: true, descricao: true, valor_comissao: true, estagio: true, status: true, papel: true, tipo: true },
      orderBy: { valor_comissao: 'desc' },
    }).catch(() => [] as any[]);
    const nomesResp = await resolverNomesUsuarios(prisma, [...new Set(comissoesMes.map((c: any) => c.responsavel_id).filter(Boolean))]).catch(() => ({} as any));
    const ehPaga = (c: any) => c.estagio === 'PAGA' || c.status === 'PAGA';
    const comissoes_lista = comissoesMes.map((c: any) => ({
      responsavel: nomesResp[c.responsavel_id] || '—',
      descricao: c.descricao || (c.tipo || 'Comissão'),
      papel: c.papel || 'VENDEDOR',
      valor: Number(c.valor_comissao || 0),
      paga: ehPaga(c),
    }));
    const comissoes = {
      total: comissoesMes.length,
      total_valor: Math.round(comissoes_lista.reduce((s, c) => s + c.valor, 0)),
      pagas_valor: Math.round(comissoes_lista.filter(c => c.paga).reduce((s, c) => s + c.valor, 0)),
      a_pagar_valor: Math.round(comissoes_lista.filter(c => !c.paga).reduce((s, c) => s + c.valor, 0)),
      lista: comissoes_lista,
    };

    // 4c) Comissão GERADA no período (competência = mês da venda, campo `periodo`),
    // independente do mês em que o financeiro vai pagar. Isso alimenta o card
    // "Comissão gerada a pagar" do relatório — soma contratos novos + vendas adicionais.
    // Mesma aproximação por mês-calendário tocado descrita acima.
    const comissoesGeradasMes = await prisma.comissao.findMany({
      where: { periodo: { in: mesesTocados }, status: { not: 'CANCELADA' } },
      select: { papel: true, tipo: true, valor_comissao: true },
    }).catch(() => [] as any[]);
    const vendasAdicionaisTipos = ['VENDA_ADICIONAL', 'SUPERVISAO_VENDA_ADICIONAL'];
    const comissao_gerada = {
      total_geral: Math.round(comissoesGeradasMes.reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_vendedor: Math.round(comissoesGeradasMes.filter((c: any) => c.papel === 'VENDEDOR').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_supervisao: Math.round(comissoesGeradasMes.filter((c: any) => c.papel === 'SUPERVISAO').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_contratos_novos: Math.round(comissoesGeradasMes.filter((c: any) => c.tipo === 'CONTRATO').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_vendas_adicionais: Math.round(comissoesGeradasMes.filter((c: any) => vendasAdicionaisTipos.includes(c.tipo)).reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
    };

    // 5) Entrada × Saída (MRR): ganho (fechamentos) vs perdido (churn) no mês.
    const entrada_x_saida = {
      mrr_entrada: Math.round(mrrGanhoTotal),
      mrr_saida: Math.round(mrrPerdidoTotal),
      saldo_mrr: Math.round(mrrGanhoTotal - mrrPerdidoTotal),
      clientes_entrada: totalFechamentos,
      clientes_saida: totalPerdidos,
      saldo_clientes: totalFechamentos - totalPerdidos,
    };

    return {
      total_leads: totalLeads,
      fechamentos: { total: totalFechamentos, setup_total: Math.round(setupTotal), setup_medio: setupMedio, mrr_total: Math.round(mrrGanhoTotal), mrr_medio: mrrMedio, lista: fechamentos_lista },
      perdidos: { total: totalPerdidos, mrr_perdido_total: Math.round(mrrPerdidoTotal), lista: perdidos_lista },
      indicacoes: { total: indicacoes_lista.length, lista: indicacoes_lista },
      vendas_adicionais,
      comissoes,
      comissao_gerada,
      entrada_x_saida,
      _comissoes_aproximadas: !ehMesCalendarioExato(inicio, fim) && !ehAnoCalendarioExato(inicio, fim),
    };
  }

  // Wrapper fino por mês-calendário — mantido porque /serie-anual (e os
  // consumidores dela: painel-ceo e o card MRR do dashboard) dependem desse
  // contrato mês a mês e não devem mudar de comportamento.
  async function metricasReaisDoMes(ano: number, mes: number) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);
    return metricasReaisPeriodo(inicio, fim);
  }

  // GET — relatório do período (auto-pipeline mesclado com o salvo, quando aplicável).
  fastify.get('/relatorio-comercial', async (request, reply) => {
    if (!requireGestor(request, reply)) return;

    const q = z.object({
      data_inicio: z.string().optional(),
      data_fim: z.string().optional(),
      // Compat: se data_inicio/data_fim não vierem, cai no comportamento antigo por ano/mês.
      ano: z.coerce.number().default(new Date().getFullYear()),
      mes: z.coerce.number().min(0).max(12).default(new Date().getMonth() + 1),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const { data_inicio, data_fim, ano, mes } = q.data;

    let inicio: Date, fimExclusiva: Date;
    if (data_inicio && data_fim) {
      inicio = parseDataLocal(data_inicio);
      // data_fim vem como "dia final incluído" (ex.: 2026-08-20) — fim exclusivo é o dia seguinte 00:00.
      const df = parseDataLocal(data_fim);
      fimExclusiva = new Date(df.getFullYear(), df.getMonth(), df.getDate() + 1);
    } else if (mes === 0) {
      inicio = new Date(ano, 0, 1);
      fimExclusiva = new Date(ano + 1, 0, 1);
    } else {
      inicio = new Date(ano, mes - 1, 1);
      fimExclusiva = new Date(ano, mes, 1);
    }

    const metricas = await metricasReaisPeriodo(inicio, fimExclusiva);
    const pipeline = await calcularPipelinePeriodo(inicio, fimExclusiva).catch(() => null);

    // Só respeita o "fechado" manual quando o range bate EXATAMENTE com um mês-calendário.
    const mesExato = ehMesCalendarioExato(inicio, fimExclusiva);
    const anoExato = !mesExato ? ehAnoCalendarioExato(inicio, fimExclusiva) : null;

    let base: any = { ...(pipeline || {}) };
    if (mesExato) {
      const salvo = await prisma.relatorioComercial.findUnique({ where: { uq_relatorio_mes: { ano: mesExato.ano, mes: mesExato.mes } } });
      base = salvo?.fechado ? salvo : { ...(salvo || {}), ...pipeline, ano: mesExato.ano, mes: mesExato.mes };
    }

    return reply.send({
      status: 'success',
      data: {
        ...base,
        periodo: { data_inicio: inicio.toISOString(), data_fim: fimExclusiva.toISOString() },
        periodo_mes_exato: mesExato,
        periodo_ano_exato: anoExato,
        _pipeline_auto: pipeline,
        metricas,
      },
    });
  });

  // Série ANUAL (evolução mês a mês) — p/ os gráficos de tendência do relatório.
  // Calcula os números reais de cada mês do ano (jan→dez) reusando metricasReaisDoMes.
  fastify.get('/relatorio-comercial/serie-anual', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ ano: z.coerce.number().default(new Date().getFullYear()) }).safeParse(request.query);
    const ano = q.success ? q.data.ano : new Date().getFullYear();
    const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const serie: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const mt = await metricasReaisDoMes(ano, m).catch(() => null as any);
      serie.push({
        mes: MES_ABREV[m - 1],
        leads: mt?.total_leads ?? 0,
        fechamentos: mt?.fechamentos?.total ?? 0,
        mrr_ganho: mt?.fechamentos?.mrr_total ?? 0,
        mrr_perdido: mt?.perdidos?.mrr_perdido_total ?? 0,
        saldo_mrr: mt?.entrada_x_saida?.saldo_mrr ?? 0,
        perdidos: mt?.perdidos?.total ?? 0,
        indicacoes: mt?.indicacoes?.total ?? 0,
        setup_total: mt?.fechamentos?.setup_total ?? 0,
      });
    }
    return reply.send({ status: 'success', data: { ano, serie } });
  });

  // Lista de meses disponíveis (p/ o seletor).
  fastify.get('/relatorio-comercial/meses', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const lista = await prisma.relatorioComercial.findMany({ orderBy: [{ ano: 'desc' }, { mes: 'desc' }], select: { ano: true, mes: true, fechado: true } });
    return reply.send({ status: 'success', data: lista });
  });

  // PUT — salva/edita o relatório do mês (campos externos + consolida).
  fastify.put('/relatorio-comercial', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      ano: z.number(), mes: z.number().min(1).max(12),
      supervisor: z.string().optional(),
      meta_contratos: z.number().optional(),
      instalacao_total: z.number().optional(), mrr_total: z.number().optional(),
      cancelamentos: z.number().optional(), mrr_perdido: z.number().optional(),
      contratos_fechados: z.number().optional(),
      por_vendedor: z.any().optional(), por_segmento: z.any().optional(),
      contratos_lista: z.any().optional(), atividade: z.any().optional(),
      marketing: z.any().optional(), cancelamentos_lista: z.any().optional(),
      resumo_executivo: z.any().optional(), observacoes: z.string().optional(),
      fechado: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });
    const { ano, mes, ...resto } = body.data;

    const rel = await prisma.relatorioComercial.upsert({
      where: { uq_relatorio_mes: { ano, mes } },
      create: { ano, mes, ...resto } as any,
      update: resto as any,
    });
    return reply.send({ status: 'success', data: rel });
  });

  // Sensor de Mercado (Task 8): motivos de perda de leads + concorrentes mencionados,
  // agregados no período. Lead.motivo_perda vem de uma taxonomia fixa (Task 5) — valores
  // são a CHAVE da taxonomia (ex.: "JA_TEM_FORNECEDOR") OU "OUTRO: <detalhe>"; agrupamos
  // pela parte antes de ":" para que todo "OUTRO: ..." caia no mesmo bucket "OUTRO", em
  // vez de virar texto único cada vez. MOTIVOS_LABEL traduz a chave para o rótulo em
  // português exibido no relatório (espelha MOTIVOS_PERDA do frontend/app/leads/page.tsx).
  const MOTIVOS_LABEL: Record<string, string> = {
    PRECO: 'Preço',
    JA_TEM_FORNECEDOR: 'Já tem fornecedor',
    SEM_ORCAMENTO: 'Sem orçamento',
    TIMING: 'Timing não é agora',
    SEM_INTERESSE: 'Sem interesse',
    FUNCIONALIDADE_AUSENTE: 'Funcionalidade ausente',
    OUTRO: 'Outro',
  };

  fastify.get('/relatorio-comercial/sensor-mercado', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const perdidos = await prisma.lead.findMany({
      where: { etapa_comercial: 'PERDIDO', updated_at: { gte: dataInicio, lte: dataFim }, deleted_at: null },
      select: { motivo_perda: true, sistema_atual: true },
    });

    const objecoes: Record<string, number> = {};
    const concorrentes: Record<string, number> = {};
    for (const l of perdidos) {
      const chave = (l.motivo_perda || 'NAO_INFORMADO').split(':')[0].trim();
      const motivo = MOTIVOS_LABEL[chave] || (l.motivo_perda ? chave : 'Não informado');
      objecoes[motivo] = (objecoes[motivo] || 0) + 1;
      // Concorrentes mencionados só fazem sentido quando o motivo da perda foi
      // especificamente "já tem fornecedor" — sistema_atual pode estar preenchido
      // em leads perdidos por outros motivos (preço, timing etc.) e contá-los aqui
      // infla o sensor de concorrência com ruído que não reflete concorrência real.
      if (chave === 'JA_TEM_FORNECEDOR' && l.sistema_atual) {
        concorrentes[l.sistema_atual] = (concorrentes[l.sistema_atual] || 0) + 1;
      }
    }

    return reply.send({
      status: 'success',
      data: {
        periodo: { data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() },
        objecoes: Object.entries(objecoes).sort((a, b) => b[1] - a[1]).map(([motivo, total]) => ({ motivo, total })),
        concorrentes: Object.entries(concorrentes).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
      },
    });
  });

  // Desempenho comparativo por SDR (Task 8): todos os SDRs ativos, reaproveitando o
  // mesmo cálculo de funil da Task 7 (GET /sdr/desempenho), sem duplicar a lógica.
  fastify.get('/relatorio-comercial/sdrs', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const sdrs: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo = 'SDR' AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);

    const resultado = [];
    for (const s of sdrs) {
      const desempenho = await calcularDesempenhoSdr(prisma, s.id, dataInicio, dataFim);
      resultado.push({ sdr_id: s.id, sdr_nome: s.nome, ...desempenho });
    }

    return reply.send({ status: 'success', data: resultado });
  });

  // Sincroniza manualmente as comissões → despesas do Centro de Custos.
  // Opcional periodoDe/periodoAte ("YYYY-MM") para rodar só um recorte (ex.: backfill).
  fastify.post('/relatorio-comercial/sincronizar-comissoes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ periodoDe: z.string().optional(), periodoAte: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const resultado = await sincronizarLancamentosDeComissao(prisma, {
      periodoDe: q.data.periodoDe, periodoAte: q.data.periodoAte,
    });
    return reply.send({ status: 'success', data: resultado });
  });
}
