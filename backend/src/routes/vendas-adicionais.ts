import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, podeVerTudo, requireGestor } from '@/lib/scope';
import { resolverNomesUsuarios } from '@/lib/usuarios';

const PARCEIROS_DEFAULT = [
  {
    nome: 'Pacote Fiscal',
    categoria: 'FISCAL',
    pitch: 'Alguns clientes estão optando por contratar nosso serviço de geração de arquivo fiscal para facilitar a vida com a contabilidade.',
    comissao_valor: 50,
    tabela_valores: 'R$ 100/mês',
    valor_referencia: 200,          // 5% de R$200 = R$10 de comissão para a supervisão
    comissao_supervisao_pct: 5,
  },
  {
    nome: 'TEF',
    categoria: 'TEF',
    pitch: 'Hoje vocês já usam TEF integrado com o sistema?',
    comissao_valor: 50,
    tabela_valores: 'Conforme tabela de parceiro',
    valor_referencia: 200,          // 5% de R$200 = R$10 de comissão para a supervisão
    comissao_supervisao_pct: 5,
  },
  {
    nome: 'Avant',
    categoria: 'TRIBUTARIO',
    pitch: 'Corretor tributário — revisão tributária e recuperação de créditos.',
    comissao_valor: 50,
    tabela_valores: 'Conforme tabela de parceiro',
    valor_referencia: 200,          // 5% de R$200 = R$10 de comissão para a supervisão
    comissao_supervisao_pct: 5,
  },
  {
    nome: 'Imendes',
    categoria: 'TRIBUTARIO',
    pitch: 'Corretor tributário — revisão tributária e recuperação de créditos.',
    comissao_valor: 50,
    tabela_valores: 'Conforme tabela de parceiro',
    valor_referencia: 200,
    comissao_supervisao_pct: 5,
  },
  {
    nome: 'Comunicação de Dados',
    categoria: 'COMUNICACAO',
    pitch: 'Se o cliente tiver mais de uma loja, a comunicação de dados integra todas as unidades.',
    comissao_valor: 50,
    tabela_valores: 'Conforme número de lojas',
    valor_referencia: null,
    comissao_supervisao_pct: 0,     // não listado — sem comissão da supervisão
  },
  {
    nome: 'Upgrade de Plano',
    categoria: 'UPGRADE',
    pitch: 'Basic → Pro → Plus. Cada upgrade adiciona funcionalidades que já estão disponíveis no sistema.',
    comissao_valor: 50,
    tabela_valores: 'Conforme tabela de valores dos planos',
    valor_referencia: 350,          // referência R$350 → 5% = R$17,50
    comissao_supervisao_pct: 5,
  },
];

// Parceiros com valor de referência fixo — atualizar ao fazer sync dos defaults
const PARCEIRO_DEFAULTS_BY_NAME: Record<string, { valor_referencia: number | null; comissao_supervisao_pct: number }> = {
  'Pacote Fiscal':       { valor_referencia: 200, comissao_supervisao_pct: 5 }, // R$10
  'TEF':                 { valor_referencia: 200, comissao_supervisao_pct: 5 }, // R$10
  'Avant':               { valor_referencia: 200, comissao_supervisao_pct: 5 }, // R$10
  'Imendes':             { valor_referencia: 200, comissao_supervisao_pct: 5 }, // R$10
  'Comunicação de Dados':{ valor_referencia: null, comissao_supervisao_pct: 0 },
  'Upgrade de Plano':    { valor_referencia: 350, comissao_supervisao_pct: 5 }, // R$17,50
};

function proximoMes(): string {
  const agora = new Date();
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
}

// Período (YYYY-MM) do MÊS SEGUINTE a uma data de referência. Usado p/ lançar a
// comissão no mês posterior ao 1º vencimento (comunicação) ou à confirmação
// (demais parceiros). Sem data → cai p/ o próximo mês a partir de hoje.
function mesSeguinteDe(data?: Date | string | null): string {
  const d = data ? new Date(data) : new Date();
  const base = isNaN(d.getTime()) ? new Date() : d;
  const prox = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}`;
}

function baseComissaoSupervisao(parceiro: any, valorVenda?: number | null, acrescimoMensal?: number | null): number {
  // Base do cálculo da comissão da supervisão por categoria:
  //  - COMUNICAÇÃO → SETUP da comunicação (valor_venda);
  //  - UPGRADE → SETUP do upgrade (valor_venda);
  //  - FISCAL  → ACRÉSCIMO na mensalidade (acrescimo_mensal);
  //  - demais  → valor de referência fixo do parceiro (fallback p/ valor_venda).
  if (parceiro.categoria === 'COMUNICACAO') return valorVenda ?? 0;
  if (parceiro.categoria === 'UPGRADE') return valorVenda ?? 0;
  if (parceiro.categoria === 'FISCAL') return acrescimoMensal ?? 0;
  return parceiro.valor_referencia ?? valorVenda ?? 0;
}

// Percentual da supervisão. COMUNICAÇÃO é fixo em 5% do setup (regra de negócio),
// independente do cadastro do parceiro; demais usam o pct configurado no parceiro.
function pctComissaoSupervisao(parceiro: any): number {
  if (parceiro.categoria === 'COMUNICACAO') return 5;
  return parceiro.comissao_supervisao_pct ?? 0;
}

function calcularComissaoSupervisao(parceiro: any, valorVenda?: number | null, acrescimoMensal?: number | null): number {
  const pct = pctComissaoSupervisao(parceiro);
  if (pct <= 0) return 0;
  const base = baseComissaoSupervisao(parceiro, valorVenda, acrescimoMensal);
  return parseFloat(((base * pct) / 100).toFixed(2));
}

export async function vendasAdicionaisRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== PARCEIROS =====

  fastify.get('/parceiros', async (request, reply) => {
    let parceiros = await prisma.parceiro.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    if (parceiros.length === 0) {
      // Seed inicial
      await prisma.parceiro.createMany({ data: PARCEIROS_DEFAULT });
      parceiros = await prisma.parceiro.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    } else {
      // Sync de campos novos nos parceiros padrão existentes
      for (const p of parceiros) {
        const defaults = PARCEIRO_DEFAULTS_BY_NAME[p.nome];
        if (defaults) {
          const needsUpdate =
            p.valor_referencia !== defaults.valor_referencia ||
            p.comissao_supervisao_pct !== defaults.comissao_supervisao_pct;
          if (needsUpdate) {
            await prisma.parceiro.update({
              where: { id: p.id },
              data: {
                valor_referencia: defaults.valor_referencia,
                comissao_supervisao_pct: defaults.comissao_supervisao_pct,
              },
            });
          }
        }
      }
      // Recarrega após possível sync
      parceiros = await prisma.parceiro.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    }

    return reply.send({ status: 'success', data: parceiros });
  });

  fastify.post('/parceiros', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      nome: z.string().min(1),
      categoria: z.string().default('OUTRO'),
      pitch: z.string().optional(),
      comissao_valor: z.number().default(50),
      tabela_valores: z.string().optional(),
      valor_referencia: z.number().optional(),
      comissao_supervisao_pct: z.number().default(5),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const parceiro = await prisma.parceiro.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: parceiro });
  });

  fastify.patch('/parceiros/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().optional(),
      categoria: z.string().optional(),
      pitch: z.string().optional(),
      comissao_valor: z.number().optional(),
      tabela_valores: z.string().optional(),
      valor_referencia: z.number().optional(),
      comissao_supervisao_pct: z.number().optional(),
      ativo: z.boolean().optional(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const parceiro = await prisma.parceiro.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: parceiro });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Parceiro não encontrado' });
      throw e;
    }
  });

  fastify.delete('/parceiros/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      await prisma.parceiro.update({ where: { id }, data: { ativo: false } });
      return reply.send({ status: 'success' });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Parceiro não encontrado' });
      throw e;
    }
  });

  // ===== VENDAS ADICIONAIS =====
  // Status flow: PENDENTE → CONFIRMADA → PAGA | CANCELADO

  fastify.get('/vendas-adicionais', async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      vendedor_id: z.string().optional(),
      parceiro_id: z.string().optional(),
      periodo: z.string().optional(), // YYYY-MM
    }).safeParse(request.query);

    const filters: any = {};
    if (query.data?.status) filters.status = query.data.status;
    if (query.data?.parceiro_id) filters.parceiro_id = query.data.parceiro_id;
    // Escopo: vendedor só vê as próprias vendas adicionais; gestor vê todas.
    const scopeId = scopeUserId(request);
    if (scopeId !== null) filters.vendedor_id = scopeId;
    else if (query.data?.vendedor_id) filters.vendedor_id = query.data.vendedor_id;
    if (query.data?.periodo) {
      const [year, month] = query.data.periodo.split('-').map(Number);
      filters.created_at = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    }

    const vendas = await prisma.vendaAdicional.findMany({
      where: filters,
      include: {
        cliente: { select: { id: true, nome: true, empresa: true, telefone: true } },
        parceiro: { select: { id: true, nome: true, categoria: true, comissao_valor: true, comissao_supervisao_pct: true, valor_referencia: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const total = vendas.length;
    const confirmadas = vendas.filter(v => v.status === 'CONFIRMADA').length;
    const pendentes = vendas.filter(v => v.status === 'PENDENTE').length;
    const pagas = vendas.filter(v => v.status === 'PAGA').length;

    // Comissões dos vendedores
    const comissoes_a_pagar = vendas
      .filter(v => v.status === 'CONFIRMADA' && !v.comissao_paga)
      .reduce((s, v) => s + v.comissao_valor, 0);
    const comissoes_pagas = vendas
      .filter(v => v.comissao_paga)
      .reduce((s, v) => s + v.comissao_valor, 0);

    // Comissões da supervisão
    const supervisao_a_pagar = vendas
      .filter(v => v.status === 'CONFIRMADA' && v.comissao_supervisao_valor)
      .reduce((s, v) => s + (v.comissao_supervisao_valor || 0), 0);

    return reply.send({
      status: 'success',
      data: {
        vendas,
        stats: { total, confirmadas, pendentes, pagas, comissoes_a_pagar, comissoes_pagas, supervisao_a_pagar },
      },
    });
  });

  fastify.post('/vendas-adicionais', async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({
      cliente_id: z.string().min(1),
      parceiro_id: z.string().min(1),
      vendedor_id: z.string().min(1),
      tipo_negocio: z.enum(['INDICACAO', 'REVENDA']).default('INDICACAO'),
      valor_venda: z.number().optional(),
      acrescimo_mensal: z.number().optional(), // acréscimo na mensalidade (ex.: Arquivo Fiscal)
      plano_anterior: z.string().optional(),
      plano_novo: z.string().optional(),
      comissao_valor: z.number().optional(),
      observacoes: z.string().optional(),
      // Forma de pagamento do setup do upgrade
      setup_forma: z.enum(['ENTRADA_PARCELAS', 'PARCELADO']).optional(),
      setup_entrada: z.number().optional(),
      setup_parcelas: z.number().int().min(1).max(24).optional(),
      setup_primeiro_venc: z.string().optional(), // data ISO da 1ª parcela
      // Mensalidade anterior pode vir do front; se não, usamos a do cliente.
      mensalidade_anterior: z.number().optional(),
      // ── Comunicação multi-loja + datas do ciclo ──
      lojas_ids: z.array(z.string()).optional(),        // lojas que vão se comunicar
      // Detalhe por loja: cada uma com seu acréscimo individual (0 = só associar).
      lojas_detalhe: z.array(z.object({
        cliente_id: z.string(),
        acrescimo: z.number().optional(),
      })).optional(),
      setup_loja_id: z.string().optional(),             // loja onde o setup é cobrado
      data_venda: z.string().optional(),
      data_inicio_comunicacao: z.string().optional(),
      primeiro_vencimento: z.string().optional(),       // base da comissão (mês seguinte)
      data_indicacao: z.string().optional(),            // demais parceiros
      data_fechamento: z.string().optional(),           // data do fechamento do negócio
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const parceiro = await prisma.parceiro.findUnique({ where: { id: body.data.parceiro_id } });
    if (!parceiro) return reply.status(404).send({ status: 'error', message: 'Parceiro não encontrado' });

    // Mensalidade atual do cliente (snapshot) e nova (atual + acréscimo do upgrade).
    const clienteAtual = await prisma.cliente.findUnique({
      where: { id: body.data.cliente_id }, select: { mensalidade_base: true },
    }).catch(() => null);
    const mensalidadeAnterior = body.data.mensalidade_anterior ?? Number(clienteAtual?.mensalidade_base || 0);
    const mensalidadeNova = mensalidadeAnterior + Number(body.data.acrescimo_mensal || 0);

    // Comissão do vendedor:
    //  - COMUNICAÇÃO → 15% do SETUP (valor_venda);
    //  - UPGRADE de plano → R$50 fixo (após confirmação);
    //  - INDICAÇÃO → R$50 fixo; REVENDA → valor do parceiro.
    // Um valor enviado explicitamente (comissao_valor) sempre prevalece.
    const ehComunic = parceiro.categoria === 'COMUNICACAO';
    const comissaoPadrao = ehComunic
      ? parseFloat((Number(body.data.valor_venda || 0) * 0.15).toFixed(2))
      : (parceiro.categoria === 'UPGRADE'
          ? 50
          : (body.data.tipo_negocio === 'INDICACAO' ? 50 : parceiro.comissao_valor));
    const comissaoValor = body.data.comissao_valor ?? comissaoPadrao;
    const supervisaoId = user?.id || null;

    // O vendedor que fez a venda: gestão pode escolher qualquer vendedor; um vendedor
    // logado só registra para SI MESMO (segurança). Resolve o nome para exibição.
    const ehGestor = podeVerTudo(user);
    const vendedorId = ehGestor ? body.data.vendedor_id : (user?.id || body.data.vendedor_id);
    // Resolve o nome do vendedor (UsuarioCRM ou conta de sistema, ex.: Jessica/Diretora).
    const nomes = await resolverNomesUsuarios(prisma, [vendedorId]);
    const vendedorNome = nomes[vendedorId] || user?.nome || null;

    const {
      setup_primeiro_venc, mensalidade_anterior, lojas_ids, lojas_detalhe,
      data_venda, data_inicio_comunicacao, primeiro_vencimento, data_indicacao, data_fechamento, ...rest
    } = body.data;

    const ehComunicacao = parceiro.categoria === 'COMUNICACAO';
    const dt = (s?: string) => (s ? new Date(s) : null);

    // Lista efetiva de ids: do detalhe (com acréscimo individual) ou fallback p/
    // lojas_ids (compat). Cada loja tem o SEU acréscimo (0 = só associar).
    const detalheIn = ehComunicacao && lojas_detalhe?.length ? lojas_detalhe : null;
    const idsLojas = detalheIn ? detalheIn.map(d => d.cliente_id) : (lojas_ids || []);

    // Resolve nomes/códigos (snapshot) p/ exibição/ficha e monta lojas_detalhe final.
    let lojasNomes: string[] = [];
    let lojasDetalheFinal: any[] = [];
    if (ehComunicacao && idsLojas.length > 0) {
      const lojas = await prisma.cliente.findMany({
        where: { id: { in: idsLojas } },
        select: { id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true },
      });
      const mapa = new Map(lojas.map(l => [l.id, l]));
      lojasNomes = idsLojas.map(id => (mapa.get(id) as any)?.nome_fantasia || (mapa.get(id) as any)?.razao_social || (mapa.get(id) as any)?.nome || id);
      lojasDetalheFinal = idsLojas.map(id => {
        const l: any = mapa.get(id) || {};
        const acr = detalheIn ? Number(detalheIn.find(d => d.cliente_id === id)?.acrescimo || 0) : Number(body.data.acrescimo_mensal || 0);
        return { cliente_id: id, nome: l.nome_fantasia || l.razao_social || l.nome || id, codigo: l.codigo || null, acrescimo: acr };
      });
    }

    // Acréscimo total da comunicação = SOMA dos acréscimos individuais.
    const acrescimoTotal = ehComunicacao
      ? lojasDetalheFinal.reduce((s, d) => s + Number(d.acrescimo || 0), 0)
      : Number(body.data.acrescimo_mensal || 0);
    const nLojas = ehComunicacao && idsLojas.length ? idsLojas.length : 1;

    const venda = await prisma.vendaAdicional.create({
      data: {
        ...rest,
        // Na comunicação o acrescimo_mensal gravado é o TOTAL (soma das lojas).
        acrescimo_mensal: ehComunicacao ? acrescimoTotal : rest.acrescimo_mensal,
        vendedor_id: vendedorId,
        vendedor_nome: vendedorNome,
        comissao_valor: comissaoValor,
        supervisao_id: supervisaoId,
        mensalidade_anterior: mensalidadeAnterior,
        mensalidade_nova: mensalidadeNova,
        setup_primeiro_venc: dt(setup_primeiro_venc),
        // multi-loja + datas
        lojas_ids: ehComunicacao && idsLojas.length ? (idsLojas as any) : undefined,
        lojas_nomes: ehComunicacao && lojasNomes.length ? (lojasNomes as any) : undefined,
        lojas_detalhe: ehComunicacao && lojasDetalheFinal.length ? (lojasDetalheFinal as any) : undefined,
        data_venda: dt(data_venda),
        data_inicio_comunicacao: dt(data_inicio_comunicacao),
        primeiro_vencimento: dt(primeiro_vencimento),
        data_indicacao: dt(data_indicacao),
        data_fechamento: dt(data_fechamento),
        status: 'PENDENTE',
        created_by: user?.id || 'system',
      },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        parceiro: { select: { id: true, nome: true, categoria: true } },
      },
    });

    // Período da comissão (mês POSTERIOR):
    //  - COMUNICAÇÃO → mês seguinte ao 1º vencimento;
    //  - demais      → mês seguinte (a partir de hoje; reposicionado na confirmação).
    const periodo = ehComunicacao ? mesSeguinteDe(primeiro_vencimento) : proximoMes();
    await prisma.comissao.create({
      data: {
        responsavel_id: vendedorId,
        tipo: 'VENDA_ADICIONAL',
        referencia_id: venda.id,
        descricao: `Venda Adicional: ${parceiro.nome} — ${venda.cliente.nome}`,
        // COMUNICAÇÃO: base = setup, 15%. Demais: valor fixo (base=valor, 100%).
        valor_base: ehComunic ? Number(body.data.valor_venda || 0) : comissaoValor,
        percentual: ehComunic ? 15 : 100,
        valor_comissao: comissaoValor,
        papel: 'VENDEDOR',
        periodo,
        status: 'PENDENTE',
        created_by: user?.id || 'system',
      },
    });

    // Salva a venda na FICHA de cada loja envolvida (timeline), com o acréscimo
    // INDIVIDUAL daquela loja. Senão (não-comunicação), o cliente da venda.
    const fichas = ehComunicacao && lojasDetalheFinal.length
      ? lojasDetalheFinal.map(d => ({ cid: d.cliente_id, acr: Number(d.acrescimo || 0) }))
      : [{ cid: body.data.cliente_id, acr: Number(body.data.acrescimo_mensal || 0) }];
    for (const f of fichas) {
      const titulo = ehComunicacao
        ? (f.acr > 0 ? `Comunicação — acréscimo de R$ ${f.acr.toLocaleString('pt-BR')}/mês` : 'Comunicação — loja associada (sem acréscimo)')
        : `Venda adicional: ${parceiro.nome}`;
      const ehSetupLoja = body.data.setup_loja_id === f.cid;
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: f.cid, tipo: 'OBSERVACAO', titulo,
          descricao: body.data.observacoes || undefined, referencia_id: venda.id,
          metadados: { acrescimo: f.acr, total_lojas: nLojas, total_mensal: acrescimoTotal, setup_nesta_loja: ehSetupLoja, setup_valor: ehSetupLoja ? body.data.valor_venda : undefined, primeiro_vencimento },
          feito_por: user?.id, feito_por_nome: vendedorNome,
        },
      }).catch(() => {});

      // GRUPO DE LOJAS: na comunicação, registra em cada loja que ela faz parte de
      // um grupo que se comunica, listando AS OUTRAS lojas (não mescla cadastros).
      if (ehComunicacao && lojasDetalheFinal.length > 1) {
        const nome = (l: any) => `${l.codigo ? l.codigo + ' - ' : ''}${l.nome || l.cliente_id}`;
        const outras = lojasDetalheFinal.filter(l => l.cliente_id !== f.cid).map(nome);
        await (prisma as any).eventoCliente.create({
          data: {
            cliente_id: f.cid, tipo: 'OBSERVACAO',
            titulo: `🏪 Faz parte de um grupo de ${lojasDetalheFinal.length} lojas (comunicação entre lojas)`,
            descricao: `Esta loja se comunica com: ${outras.join(' · ')}`,
            referencia_id: venda.id,
            metadados: { grupo_lojas_ids: lojasDetalheFinal.map(l => l.cliente_id), grupo_lojas_nomes: lojasDetalheFinal.map(nome) },
            feito_por: user?.id, feito_por_nome: vendedorNome,
          },
        }).catch(() => {});
      }
    }

    return reply.status(201).send({ status: 'success', data: venda });
  });

  fastify.patch('/vendas-adicionais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = z.object({
      status: z.string().optional(),
      observacoes: z.string().optional(),
      valor_venda: z.number().optional(),
      acrescimo_mensal: z.number().optional(),
      plano_anterior: z.string().optional(),
      plano_novo: z.string().optional(),
      comissao_paga: z.boolean().optional(),
      data_confirmacao: z.string().optional(), // demais parceiros: base da comissão
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const { data_confirmacao, ...campos } = body.data;
    const updateData: any = { ...campos };
    if (body.data.comissao_paga === true) {
      updateData.comissao_paga_em = new Date();
      updateData.status = 'PAGA';
    }

    try {
      // Busca venda atual para pegar parceiro e valor
      const vendaAtual = await prisma.vendaAdicional.findUnique({
        where: { id },
        include: { parceiro: true, cliente: { select: { nome: true } } },
      });
      if (!vendaAtual) return reply.status(404).send({ status: 'error', message: 'Venda não encontrada' });

      // Ao confirmar, grava a data de confirmação (informada ou hoje).
      if (body.data.status === 'CONFIRMADA') {
        updateData.data_confirmacao = data_confirmacao ? new Date(data_confirmacao) : new Date();
      }

      // Ao confirmar, calcula e salva comissão da supervisão
      if (body.data.status === 'CONFIRMADA') {
        const comissaoSupervisao = calcularComissaoSupervisao(
          vendaAtual.parceiro,
          body.data.valor_venda ?? vendaAtual.valor_venda,
          body.data.acrescimo_mensal ?? (vendaAtual as any).acrescimo_mensal,
        );
        updateData.comissao_supervisao_valor = comissaoSupervisao;
      }

      const venda = await prisma.vendaAdicional.update({
        where: { id },
        data: updateData,
        include: {
          cliente: { select: { id: true, nome: true, empresa: true } },
          parceiro: { select: { id: true, nome: true, categoria: true } },
        },
      });

      // Sincroniza comissão do vendedor
      const comissaoVendedor = await prisma.comissao.findFirst({
        where: { referencia_id: id, tipo: 'VENDA_ADICIONAL', responsavel_id: vendaAtual.vendedor_id },
      });

      if (comissaoVendedor) {
        if (body.data.status === 'CANCELADO') {
          await prisma.comissao.update({ where: { id: comissaoVendedor.id }, data: { status: 'CANCELADA' } });
        } else if (body.data.status === 'CONFIRMADA') {
          // Período da comissão (mês POSTERIOR): COMUNICAÇÃO → mês seguinte ao 1º
          // vencimento; demais parceiros → mês seguinte à confirmação.
          const ehComunic = vendaAtual.parceiro?.categoria === 'COMUNICACAO';
          const periodoConfirm = ehComunic
            ? mesSeguinteDe((vendaAtual as any).primeiro_vencimento)
            : mesSeguinteDe(updateData.data_confirmacao || new Date());
          await prisma.comissao.update({
            where: { id: comissaoVendedor.id },
            data: { status: 'APROVADA', periodo: periodoConfirm },
          });
        } else if (body.data.comissao_paga === true || body.data.status === 'PAGA') {
          await prisma.comissao.update({ where: { id: comissaoVendedor.id }, data: { status: 'PAGA' } });
        }
      }

      // Registra a confirmação na ficha das lojas/cliente envolvidos.
      if (body.data.status === 'CONFIRMADA') {
        const lojas = (vendaAtual as any).lojas_ids as string[] | null;
        const idsFicha = lojas && lojas.length ? lojas : [vendaAtual.cliente_id];
        for (const cid of idsFicha) {
          await (prisma as any).eventoCliente.create({
            data: {
              cliente_id: cid, tipo: 'OBSERVACAO',
              titulo: `Venda adicional confirmada: ${vendaAtual.parceiro?.nome || ''}`,
              referencia_id: id, feito_por: user?.id, feito_por_nome: user?.nome,
            },
          }).catch(() => {});
        }

        // PONTE → Portal de Implantação: vendas de COMUNICAÇÃO confirmadas viram
        // projeto(s) de implantação (1 por loja) com etiqueta de serviço Comunicação.
        // Não-bloqueante e condicional às envs; idempotente por contrato_crm_id (venda+loja).
        if (vendaAtual.parceiro?.categoria === 'COMUNICACAO' && process.env.PORTAL_PONTE_URL && process.env.PONTE_TOKEN) {
          const detalhe = Array.isArray((vendaAtual as any).lojas_detalhe) ? (vendaAtual as any).lojas_detalhe : [];
          const alvos = detalhe.length ? detalhe.map((d: any) => ({ id: d.cliente_id, nome: d.nome })) : idsFicha.map((c: string) => ({ id: c, nome: '' }));
          for (const loja of alvos) {
            try {
              const cli = await prisma.cliente.findUnique({ where: { id: loja.id }, select: { razao_social: true, nome_fantasia: true, cnpj: true, telefone: true, email: true } }).catch(() => null);
              fetch(`${process.env.PORTAL_PONTE_URL}/ponte/projeto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-ponte-token': process.env.PONTE_TOKEN as string },
                body: JSON.stringify({
                  cliente_nome: cli?.razao_social || cli?.nome_fantasia || loja.nome || 'Loja',
                  razao_social: cli?.razao_social, nome_fantasia: cli?.nome_fantasia, cnpj: cli?.cnpj,
                  telefone: cli?.telefone, email: cli?.email,
                  cliente_crm_id: loja.id,
                  contrato_crm_id: `comunic-${id}-${loja.id}`, // único por venda+loja (idempotente)
                  tipo_servico: 'COMUNICACAO',
                }),
              }).catch(e => console.warn('[PONTE-COMUNICACAO] falhou (não bloqueia):', e?.message));
            } catch (e: any) { console.warn('[PONTE-COMUNICACAO]', e?.message); }
          }
        }
      }

      // Cria ou atualiza comissão da supervisão ao confirmar
      if (body.data.status === 'CONFIRMADA' && vendaAtual.supervisao_id) {
        const acrescimoMensal = body.data.acrescimo_mensal ?? (vendaAtual as any).acrescimo_mensal;
        const comissaoSupervisao = calcularComissaoSupervisao(
          vendaAtual.parceiro,
          body.data.valor_venda ?? vendaAtual.valor_venda,
          acrescimoMensal,
        );

        if (comissaoSupervisao > 0) {
          const comissaoSupExistente = await prisma.comissao.findFirst({
            where: { referencia_id: id, tipo: 'SUPERVISAO_VENDA_ADICIONAL' },
          });

          if (!comissaoSupExistente) {
            await prisma.comissao.create({
              data: {
                responsavel_id: vendaAtual.supervisao_id,
                tipo: 'SUPERVISAO_VENDA_ADICIONAL',
                referencia_id: id,
                descricao: `Supervisão — ${vendaAtual.parceiro.nome}: ${vendaAtual.cliente.nome}`,
                valor_base: baseComissaoSupervisao(
                  vendaAtual.parceiro,
                  body.data.valor_venda ?? vendaAtual.valor_venda,
                  acrescimoMensal,
                ),
                percentual: pctComissaoSupervisao(vendaAtual.parceiro),
                valor_comissao: comissaoSupervisao,
                papel: 'SUPERVISAO',
                // COMUNICAÇÃO: comissão no mês seguinte ao 1º vencimento (igual vendedor).
                periodo: vendaAtual.parceiro?.categoria === 'COMUNICACAO'
                  ? mesSeguinteDe((vendaAtual as any).primeiro_vencimento)
                  : proximoMes(),
                status: 'APROVADA',
                created_by: user?.id || 'system',
              },
            });
          }
        }
      }

      // Cancela comissão da supervisão se cancelado
      if (body.data.status === 'CANCELADO') {
        const comissaoSup = await prisma.comissao.findFirst({
          where: { referencia_id: id, tipo: 'SUPERVISAO_VENDA_ADICIONAL' },
        });
        if (comissaoSup) {
          await prisma.comissao.update({ where: { id: comissaoSup.id }, data: { status: 'CANCELADA' } });
        }
      }

      return reply.send({ status: 'success', data: venda });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Venda não encontrada' });
      throw e;
    }
  });

  // Resumo da venda pronto p/ copiar e colar e enviar ao financeiro. O formato
  // muda por categoria do parceiro: COMUNICAÇÃO (lojas), UPGRADE (plano + setup)
  // e FISCAL/pacote fiscal (acréscimo na mensalidade).
  fastify.get('/vendas-adicionais/:id/resumo-financeiro', async (request, reply) => {
    const { id } = request.params as { id: string };
    const v: any = await prisma.vendaAdicional.findUnique({
      where: { id },
      include: {
        cliente: { select: { codigo: true, razao_social: true, nome_fantasia: true, nome: true, grupo_tecnico: true } },
        parceiro: { select: { categoria: true, nome: true } },
      },
    });
    if (!v) return reply.status(404).send({ status: 'error', message: 'Venda não encontrada' });

    const brl = (n?: number | null) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const dataBR = (d?: Date | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '___/___/______';
    const cli = v.cliente || {};
    const linhaCli = (c: any) => `${c.codigo ? c.codigo + '- ' : ''}${(c.razao_social || c.nome_fantasia || c.nome || '').toUpperCase()}`;

    // Bloco de condições de pagamento do setup (entrada+parcelas OU parcelado).
    const setup = Number(v.valor_venda || 0);
    const parcelas = Number(v.setup_parcelas || 0);
    const entrada = v.setup_forma === 'ENTRADA_PARCELAS' ? Number(v.setup_entrada || 0) : 0;
    const saldo = Math.max(0, setup - entrada);
    const valorParcela = parcelas > 0 ? saldo / parcelas : saldo;
    const vp = brl(valorParcela);
    const venc = v.primeiro_vencimento || v.setup_primeiro_venc;
    let condicoes: string;
    if (entrada > 0) {
      condicoes = `Primeiro vencimento para ${dataBR(venc)} no valor de ${brl(entrada)} (entrada)` + (parcelas > 0 ? ` + ${parcelas}x ${vp}` : '');
    } else if (parcelas > 1) {
      condicoes = `Primeiro vencimento para ${dataBR(venc)} no valor de ${vp} + ${parcelas - 1}x ${vp}`;
    } else {
      condicoes = `Vencimento para ${dataBR(venc)} no valor de ${vp}`;
    }
    const formaSetup = parcelas > 1 ? ` (parcelado em ${parcelas}x)` : (entrada > 0 ? ' (entrada + parcelas)' : '');
    const acrescimo = Number(v.acrescimo_mensal || 0);
    const cat = v.parceiro?.categoria;

    let texto: string;

    if (cat === 'COMUNICACAO') {
      const detalhe: any[] = Array.isArray(v.lojas_detalhe) ? v.lojas_detalhe : [];
      let lojasTxt: string; let acrescTxt: string; let plural: boolean;
      if (detalhe.length) {
        // Acréscimo INDIVIDUAL por loja.
        plural = detalhe.length > 1;
        lojasTxt = detalhe.map((d: any) => `${d.codigo ? d.codigo + '- ' : ''}${String(d.nome || '').toUpperCase()}`).join('\n');
        acrescTxt = detalhe.map((d: any) =>
          `${d.codigo ? d.codigo + '- ' : ''}${String(d.nome || '').toUpperCase()}: ${Number(d.acrescimo || 0) > 0 ? brl(d.acrescimo) : 'sem acréscimo (já comunica)'}`
        ).join('\n');
      } else {
        const ids: string[] = Array.isArray(v.lojas_ids) && v.lojas_ids.length ? v.lojas_ids : [v.cliente_id];
        const lojas = await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { codigo: true, razao_social: true, nome_fantasia: true, nome: true } });
        plural = lojas.length > 1;
        lojasTxt = lojas.map(linhaCli).join('\n');
        acrescTxt = `Acréscimo na mensalidade ${brl(acrescimo)}${plural ? ' por loja' : ''}`;
      }
      texto =
`${plural ? 'LOJAS INCLUÍDAS:' : 'LOJA INCLUÍDA:'}

${lojasTxt}

A negociação ficou definida da seguinte forma:

${brl(setup)} pela inclusão da loja${plural ? 's' : ''}${formaSetup}
${detalhe.length ? 'Acréscimo na mensalidade por loja:\n' + acrescTxt : acrescTxt}

Condições de pagamento:
${condicoes}`;
    } else if (cat === 'UPGRADE') {
      const mAnt = Number(v.mensalidade_anterior || 0);
      const mNova = Number(v.mensalidade_nova || (mAnt + acrescimo));
      texto =
`UPGRADE DE PLANO:

${linhaCli(cli)}

A negociação ficou definida da seguinte forma:
${v.plano_anterior && v.plano_novo ? `\nPlano: ${v.plano_anterior} → ${v.plano_novo}` : ''}
Mensalidade: ${brl(mAnt)} → ${brl(mNova)}
${setup > 0 ? `Setup do upgrade: ${brl(setup)}${formaSetup}` : ''}

Condições de pagamento:
${setup > 0 ? condicoes : 'Sem cobrança de setup. Nova mensalidade a partir do próximo ciclo.'}`;
    } else {
      // FISCAL / pacote fiscal e demais
      const titulo = cat === 'FISCAL' ? 'PACOTE FISCAL CONTRATADO:' : `${(v.parceiro?.nome || 'SERVIÇO ADICIONAL').toUpperCase()} CONTRATADO:`;
      const tecnicoLinha = cli.grupo_tecnico ? `\nTécnico responsável: ${cli.grupo_tecnico}` : '';
      texto =
`${titulo}

${linhaCli(cli)}${tecnicoLinha}

A negociação ficou definida da seguinte forma:

${acrescimo > 0 ? `Acréscimo na mensalidade ${brl(acrescimo)}` : ''}
${setup > 0 ? `${brl(setup)} de setup${formaSetup}` : ''}

Condições de pagamento:
${setup > 0 ? condicoes : `Acréscimo de ${brl(acrescimo)} na mensalidade a partir do próximo ciclo.`}`;
    }

    // Limpa linhas em branco duplicadas que possam ter sobrado dos condicionais.
    texto = texto.replace(/\n{3,}/g, '\n\n').trim();

    return reply.send({ status: 'success', data: { texto } });
  });

  // BACKFILL (gestão): recalcula as comissões das comunicações JÁ lançadas p/ o
  // novo critério — vendedor 15% + supervisão 5% sobre o SETUP (valor_venda).
  // NÃO mexe em comissões já PAGAS (preserva o que o financeiro quitou). Idempotente.
  fastify.post('/vendas-adicionais/backfill-comissao-comunicacao', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;

    const vendas = await prisma.vendaAdicional.findMany({
      where: { parceiro: { categoria: 'COMUNICACAO' }, status: { not: 'CANCELADO' } },
      include: { parceiro: true, cliente: { select: { nome: true } } },
    });

    let vendasAfetadas = 0, vendedorAtualizadas = 0, supervisaoCriadas = 0, supervisaoAtualizadas = 0, pagasPreservadas = 0, semSetup = 0;

    for (const v of vendas) {
      const setup = Number((v as any).valor_venda || 0);
      if (setup <= 0) { semSetup++; continue; }
      const comissaoVend = parseFloat((setup * 0.15).toFixed(2));
      const comissaoSup = parseFloat((setup * 0.05).toFixed(2));
      let tocou = false;

      // 1) Comissão do VENDEDOR (tipo VENDA_ADICIONAL, mesma referência).
      const cVend = await prisma.comissao.findFirst({
        where: { referencia_id: v.id, tipo: 'VENDA_ADICIONAL', responsavel_id: v.vendedor_id || undefined },
      });
      if (cVend) {
        if (cVend.status === 'PAGA') { pagasPreservadas++; }
        else {
          await prisma.comissao.update({
            where: { id: cVend.id },
            data: { valor_base: setup, percentual: 15, valor_comissao: comissaoVend, papel: 'VENDEDOR' },
          });
          vendedorAtualizadas++; tocou = true;
        }
      }

      // 2) Comissão da SUPERVISÃO (tipo SUPERVISAO_VENDA_ADICIONAL).
      if (v.supervisao_id) {
        const cSup = await prisma.comissao.findFirst({
          where: { referencia_id: v.id, tipo: 'SUPERVISAO_VENDA_ADICIONAL' },
        });
        const periodoSup = mesSeguinteDe((v as any).primeiro_vencimento);
        if (cSup) {
          if (cSup.status === 'PAGA') { pagasPreservadas++; }
          else {
            await prisma.comissao.update({
              where: { id: cSup.id },
              data: { valor_base: setup, percentual: 5, valor_comissao: comissaoSup, papel: 'SUPERVISAO' },
            });
            supervisaoAtualizadas++; tocou = true;
          }
        } else if (comissaoSup > 0) {
          await prisma.comissao.create({
            data: {
              responsavel_id: v.supervisao_id, tipo: 'SUPERVISAO_VENDA_ADICIONAL', referencia_id: v.id,
              descricao: `Supervisão — ${v.parceiro.nome}: ${v.cliente?.nome || ''}`,
              valor_base: setup, percentual: 5, valor_comissao: comissaoSup, papel: 'SUPERVISAO',
              periodo: periodoSup, status: 'APROVADA', created_by: user?.id || 'system',
            } as any,
          }).catch(() => {});
          supervisaoCriadas++; tocou = true;
        }
      }

      // Sincroniza o snapshot na própria venda (exibido na lista).
      if (tocou) {
        await prisma.vendaAdicional.update({
          where: { id: v.id }, data: { comissao_supervisao_valor: comissaoSup } as any,
        }).catch(() => {});
        vendasAfetadas++;
      }
    }

    return reply.send({ status: 'success', data: { total_comunicacoes: vendas.length, vendas_afetadas: vendasAfetadas, vendedor_atualizadas: vendedorAtualizadas, supervisao_criadas: supervisaoCriadas, supervisao_atualizadas: supervisaoAtualizadas, pagas_preservadas: pagasPreservadas, sem_setup: semSetup } });
  });

  fastify.delete('/vendas-adicionais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.vendaAdicional.delete({ where: { id } });
      return reply.send({ status: 'success' });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Venda não encontrada' });
      throw e;
    }
  });

  // BACKFILL (gestão): anota o "grupo de lojas" nas comunicações JÁ lançadas antes
  // da feature. Para cada venda de comunicação com 2+ lojas, grava na ficha de cada
  // loja que ela faz parte de um grupo, listando as outras. Idempotente: pula a
  // venda se já existe o evento de grupo dela (por referencia_id). Rodar 1x.
  fastify.post('/vendas-adicionais/backfill-grupo-lojas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;

    const vendas = await prisma.vendaAdicional.findMany({
      where: { parceiro: { categoria: 'COMUNICACAO' } },
      select: { id: true, lojas_detalhe: true, lojas_ids: true, responsavel_id: true },
    });

    let vendasProcessadas = 0, eventosCriados = 0, vendasPuladas = 0;
    for (const v of vendas) {
      // Reconstrói a lista de lojas {cliente_id, nome, codigo} a partir do snapshot.
      let lojas: any[] = Array.isArray(v.lojas_detalhe as any) ? (v.lojas_detalhe as any) : [];
      if (!lojas.length && Array.isArray(v.lojas_ids as any) && (v.lojas_ids as any).length) {
        const ids = (v.lojas_ids as any) as string[];
        const docs = await prisma.cliente.findMany({
          where: { id: { in: ids } },
          select: { id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true },
        });
        const m = new Map(docs.map(d => [d.id, d]));
        lojas = ids.map(id => { const l: any = m.get(id) || {}; return { cliente_id: id, nome: l.nome_fantasia || l.razao_social || l.nome || id, codigo: l.codigo || null }; });
      }
      if (lojas.length < 2) { vendasPuladas++; continue; }

      // Idempotência: se já existe um evento de grupo desta venda, não refaz.
      const jaTem = await (prisma as any).eventoCliente.count({
        where: { referencia_id: v.id, titulo: { contains: 'grupo de' } },
      }).catch(() => 0);
      if (jaTem > 0) { vendasPuladas++; continue; }

      const nome = (l: any) => `${l.codigo ? l.codigo + ' - ' : ''}${l.nome || l.cliente_id}`;
      for (const f of lojas) {
        const outras = lojas.filter(l => l.cliente_id !== f.cliente_id).map(nome);
        await (prisma as any).eventoCliente.create({
          data: {
            cliente_id: f.cliente_id, tipo: 'OBSERVACAO',
            titulo: `🏪 Faz parte de um grupo de ${lojas.length} lojas (comunicação entre lojas)`,
            descricao: `Esta loja se comunica com: ${outras.join(' · ')}`,
            referencia_id: v.id,
            metadados: { grupo_lojas_ids: lojas.map(l => l.cliente_id), grupo_lojas_nomes: lojas.map(nome), backfill: true },
            feito_por: user?.id, feito_por_nome: 'Sistema (regularização)',
          },
        }).then(() => { eventosCriados++; }).catch(() => {});
      }
      vendasProcessadas++;
    }

    return reply.send({ status: 'success', data: { total_comunicacoes: vendas.length, vendas_processadas: vendasProcessadas, vendas_puladas: vendasPuladas, eventos_criados: eventosCriados } });
  });
}
