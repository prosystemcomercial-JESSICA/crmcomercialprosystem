import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

// Centro de Custos Comercial — lançamentos de entradas e saídas.
// Só gestão (CEO/ADMIN/Supervisão Comercial) acessa.

const CATEGORIAS_SAIDA = ['SALARIO', 'BENEFICIO', 'AJUDA_CUSTO', 'MARKETING', 'COMISSAO', 'OUTRO_CUSTO'];
const CATEGORIAS_ENTRADA = ['MENSALIDADE', 'INSTALACAO', 'SERVICO', 'VENDA', 'OUTRA_ENTRADA'];

const LancamentoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  categoria: z.string().min(1),
  descricao: z.string().optional(),
  valor: z.number().positive(),
  recorrencia: z.enum(['MENSAL', 'ANUAL', 'PONTUAL', 'EXTRAORDINARIO']).default('MENSAL'),
  competencia_ano: z.number().int().min(2000).max(2100),
  competencia_mes: z.number().int().min(1).max(12),
  data: z.string().datetime().optional(),
  observacoes: z.string().optional(),
  vendedor_id: z.string().optional(),
  cliente_id: z.string().optional(),
  // Repetir o lançamento por N meses a partir da competência (ex.: salário x 12).
  repetir_meses: z.coerce.number().int().min(1).max(24).optional(),
});

export async function financeiroRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Metadados (categorias p/ alimentar selects do front).
  fastify.get('/financeiro/categorias', async (_req, reply) => {
    return reply.send({ status: 'success', data: { entrada: CATEGORIAS_ENTRADA, saida: CATEGORIAS_SAIDA } });
  });

  // Lista lançamentos com filtros por período/tipo/categoria.
  fastify.get('/financeiro/lancamentos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      ano: z.coerce.number().optional(),
      mes: z.coerce.number().optional(),
      tipo: z.string().optional(),
      categoria: z.string().optional(),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });

    const where: any = {};
    if (q.data.ano) where.competencia_ano = q.data.ano;
    if (q.data.mes) where.competencia_mes = q.data.mes;
    if (q.data.tipo) where.tipo = q.data.tipo;
    if (q.data.categoria) where.categoria = q.data.categoria;

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where, orderBy: [{ competencia_ano: 'desc' }, { competencia_mes: 'desc' }, { created_at: 'desc' }], take: 1000,
    });
    return reply.send({ status: 'success', data: lancamentos });
  });

  // Cria lançamento.
  fastify.post('/financeiro/lancamentos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = LancamentoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });
    const user = (request as any).user;
    const d = body.data;

    // Repetir por N meses (ex.: salário 2000 x 12) → gera 1 lançamento por mês,
    // avançando a competência. Sem repetir_meses, cria 1 só.
    const repeticoes = d.repetir_meses && d.repetir_meses > 1 ? d.repetir_meses : 1;
    const dados = [];
    for (let i = 0; i < repeticoes; i++) {
      // Avança i meses a partir da competência informada (vira o ano se passar de dez).
      const idxMes0 = (d.competencia_mes - 1) + i;            // base 0
      const ano = d.competencia_ano + Math.floor(idxMes0 / 12);
      const mes = (idxMes0 % 12) + 1;                          // 1-12
      dados.push({
        tipo: d.tipo, categoria: d.categoria, descricao: d.descricao, valor: d.valor,
        recorrencia: d.recorrencia, competencia_ano: ano, competencia_mes: mes,
        data: d.data ? new Date(d.data) : new Date(), observacoes: d.observacoes,
        vendedor_id: d.vendedor_id, cliente_id: d.cliente_id, created_by: user?.id || 'system',
      });
    }
    await prisma.lancamentoFinanceiro.createMany({ data: dados });
    return reply.status(201).send({ status: 'success', data: { criados: dados.length, repeticoes } });
  });

  // Atualiza lançamento.
  fastify.patch('/financeiro/lancamentos/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = LancamentoSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const d: any = { ...body.data };
    if (d.data) d.data = new Date(d.data);
    try {
      const lanc = await prisma.lancamentoFinanceiro.update({ where: { id }, data: d });
      return reply.send({ status: 'success', data: lanc });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lançamento não encontrado' });
      throw err;
    }
  });

  // Remove lançamento.
  fastify.delete('/financeiro/lancamentos/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    await prisma.lancamentoFinanceiro.delete({ where: { id } }).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // Resumo: entradas x saídas x resultado + por categoria + médias (MRR/instalação).
  fastify.get('/financeiro/resumo', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      ano: z.coerce.number().default(new Date().getFullYear()),
      mes: z.coerce.number().optional(), // sem mês = ano inteiro
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });

    const where: any = { competencia_ano: q.data.ano };
    if (q.data.mes) where.competencia_mes = q.data.mes;

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({ where });

    let totalSaidas = 0;
    let entradasImediatas = 0;   // vendas, instalações, serviços, outras entradas (à vista)
    let mrrPeriodo = 0;          // mensalidades lançadas no período (recorrente)
    const porCategoria: Record<string, number> = {};
    const mrrValores: number[] = [];
    const instalacaoValores: number[] = [];

    for (const l of lancamentos) {
      const v = Number(l.valor);
      if (l.tipo === 'SAIDA') {
        totalSaidas += v;
      } else {
        // ENTRADA: mensalidade conta como MRR (recorrente); o resto é entrada imediata.
        if (l.categoria === 'MENSALIDADE') { mrrPeriodo += v; mrrValores.push(v); }
        else { entradasImediatas += v; }
        if (l.categoria === 'INSTALACAO') instalacaoValores.push(v);
      }
      porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + v;
    }

    // ── Entradas AUTOMÁTICAS dos fechamentos reais (mesma fonte do Relatório/Ranking) ──
    // PropostaComercial CONTRATO_ASSINADO com data_aceite no período (fallback created_at).
    // setup → entrada imediata; mensalidade → MRR. Assim a tela não depende de lançar
    // a venda manualmente: ela já entra do funil.
    const STATUS_FECHADA = ['CONTRATO_ASSINADO', 'ASSINADO', 'ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];
    const ini = new Date(q.data.ano, (q.data.mes ? q.data.mes - 1 : 0), 1);
    const fim = q.data.mes ? new Date(q.data.ano, q.data.mes, 0, 23, 59, 59) : new Date(q.data.ano, 11, 31, 23, 59, 59);
    const fechamentos = await prisma.propostaComercial.findMany({
      where: {
        status: { in: STATUS_FECHADA }, deleted_at: null as any,
        OR: [
          { data_aceite: { gte: ini, lte: fim } },
          { AND: [{ data_aceite: null }, { created_at: { gte: ini, lte: fim } }] },
        ],
      },
      select: { valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
    }).catch(() => [] as any[]);
    let setupFunil = 0, mrrFunil = 0;
    for (const f of fechamentos) {
      const setup = Number(f.valor_implantacao ?? f.valor_final ?? 0);
      const mrr = Number(f.mensalidade_plus ?? f.mensalidade_pro ?? 0);
      if (setup > 0) { entradasImediatas += setup; instalacaoValores.push(setup); setupFunil += setup; }
      if (mrr > 0) { mrrPeriodo += mrr; mrrValores.push(mrr); mrrFunil += mrr; }
    }
    if (setupFunil > 0) porCategoria['Setup (vendas do funil)'] = (porCategoria['Setup (vendas do funil)'] || 0) + setupFunil;
    if (mrrFunil > 0) porCategoria['Mensalidade (vendas do funil)'] = (porCategoria['Mensalidade (vendas do funil)'] || 0) + mrrFunil;
    // Vendas adicionais CONFIRMADAS no período: valor_venda = imediato; acrescimo = MRR.
    const vendasAdic = await prisma.vendaAdicional.findMany({
      where: { status: 'CONFIRMADA', OR: [
        { data_confirmacao: { gte: ini, lte: fim } },
        { AND: [{ data_confirmacao: null }, { data_venda: { gte: ini, lte: fim } }] },
      ] },
      select: { valor_venda: true, acrescimo_mensal: true },
    }).catch(() => [] as any[]);
    for (const v of vendasAdic) {
      const imediato = Number(v.valor_venda || 0);
      const acr = Number(v.acrescimo_mensal || 0);
      if (imediato > 0) entradasImediatas += imediato;
      if (acr > 0) { mrrPeriodo += acr; mrrValores.push(acr); }
    }

    const media = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // MRR projetado p/ os próximos 12 meses (mensalidade do período × 12).
    const mrrProjetado12m = mrrPeriodo * 12;
    // Receita total do período = entradas imediatas + MRR do período.
    const receitaPeriodo = entradasImediatas + mrrPeriodo;

    return reply.send({
      status: 'success',
      data: {
        periodo: { ano: q.data.ano, mes: q.data.mes ?? null },
        // Custos x entradas
        entradas_imediatas: round2(entradasImediatas),   // vendas/instalação/serviços (à vista)
        mrr_periodo: round2(mrrPeriodo),                  // mensalidades do período
        mrr_projetado_12m: round2(mrrProjetado12m),       // MRR × 12 (novos + acréscimos)
        receita_periodo: round2(receitaPeriodo),
        total_entradas: round2(receitaPeriodo),           // compat (entradas imediatas + MRR)
        total_saidas: round2(totalSaidas),
        // Resultado de caixa do período = entradas imediatas + MRR do mês - custos
        resultado: round2(receitaPeriodo - totalSaidas),
        // Resultado considerando o MRR projetado (visão de 12 meses)
        resultado_projetado: round2(entradasImediatas + mrrProjetado12m - totalSaidas),
        por_categoria: Object.entries(porCategoria).map(([categoria, valor]) => ({ categoria, valor: round2(valor) })),
        media_mensalidade: round2(media(mrrValores)),
        media_instalacao: round2(media(instalacaoValores)),
        qtd_lancamentos: lancamentos.length,
      },
    });
  });

  // BALANÇO GERAL — consolida AUTOMATICAMENTE toda venda comercial do período:
  // contratos ASSINADOS (setup = faturamento imediato; mensalidade = MRR) +
  // vendas adicionais à base CONFIRMADAS (valor_venda = imediato; acrescimo = MRR).
  // As DESPESAS continuam vindo dos lançamentos manuais (saídas) do período.
  fastify.get('/financeiro/balanco', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      ano: z.coerce.number().default(new Date().getFullYear()),
      mes: z.coerce.number().optional(),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });

    const ano = q.data.ano;
    const mes = q.data.mes; // sem mês = ano inteiro
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Janela de datas do período (por data do registro).
    const inicio = new Date(ano, mes ? mes - 1 : 0, 1);
    const fim = mes ? new Date(ano, mes, 1) : new Date(ano + 1, 0, 1);
    const periodoData = { gte: inicio, lt: fim };

    // 1) Contratos ASSINADOS no período (novos negócios).
    const contratos = await prisma.contratoComercial.findMany({
      where: { status: 'ASSINADO', data_contrato: periodoData },
      select: { mensalidade: true, valor_setup_total: true },
    }).catch(() => [] as any[]);

    let faturamentoImediatoContratos = 0;
    let mrrContratos = 0;
    let qtdContratos = 0;
    for (const c of contratos) {
      faturamentoImediatoContratos += Number(c.valor_setup_total || 0);
      mrrContratos += Number(c.mensalidade || 0);
      qtdContratos++;
    }

    // 2) Vendas adicionais à base CONFIRMADAS/PAGAS no período (cross-sell).
    const vendas = await prisma.vendaAdicional.findMany({
      where: { status: { in: ['CONFIRMADA', 'PAGA'] }, created_at: periodoData },
      select: { valor_venda: true, acrescimo_mensal: true },
    }).catch(() => [] as any[]);

    let faturamentoImediatoVendas = 0;
    let mrrVendas = 0;
    for (const v of vendas) {
      faturamentoImediatoVendas += Number(v.valor_venda || 0);
      mrrVendas += Number(v.acrescimo_mensal || 0);
    }

    // 3) Despesas do setor (saídas lançadas no centro de custos).
    const whereLanc: any = { tipo: 'SAIDA', competencia_ano: ano };
    if (mes) whereLanc.competencia_mes = mes;
    const saidas = await prisma.lancamentoFinanceiro.findMany({ where: whereLanc }).catch(() => [] as any[]);

    let despesaTotal = 0;
    const despesaPorCategoria: Record<string, number> = {};
    for (const s of saidas) {
      const v = Number(s.valor);
      despesaTotal += v;
      despesaPorCategoria[s.categoria] = (despesaPorCategoria[s.categoria] || 0) + v;
    }

    const faturamentoImediato = faturamentoImediatoContratos + faturamentoImediatoVendas;
    const mrrPeriodo = mrrContratos + mrrVendas;
    const mrrProjetado12m = mrrPeriodo * 12;
    // Resultado de caixa do período: imediato + 1 mês de MRR − despesa.
    const resultadoCaixa = faturamentoImediato + mrrPeriodo - despesaTotal;
    // Resultado projetado (visão 12 meses de MRR).
    const resultadoProjetado = faturamentoImediato + mrrProjetado12m - despesaTotal;

    return reply.send({
      status: 'success',
      data: {
        periodo: { ano, mes: mes ?? null },
        // Entradas (venda comercial)
        faturamento_imediato: round2(faturamentoImediato),
        faturamento_imediato_contratos: round2(faturamentoImediatoContratos),
        faturamento_imediato_vendas_base: round2(faturamentoImediatoVendas),
        mrr_periodo: round2(mrrPeriodo),
        mrr_contratos: round2(mrrContratos),
        mrr_vendas_base: round2(mrrVendas),
        mrr_projetado_12m: round2(mrrProjetado12m),
        receita_comercial_total: round2(faturamentoImediato + mrrProjetado12m),
        // Despesas
        despesa_setor: round2(despesaTotal),
        despesa_por_categoria: Object.entries(despesaPorCategoria)
          .map(([categoria, valor]) => ({ categoria, valor: round2(valor) }))
          .sort((a, b) => b.valor - a.valor),
        // Resultados
        resultado_caixa: round2(resultadoCaixa),
        resultado_projetado: round2(resultadoProjetado),
        // Contagens
        qtd_contratos_assinados: qtdContratos,
        qtd_vendas_base: vendas.length,
      },
    });
  });
}
