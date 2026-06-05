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

function baseComissaoSupervisao(parceiro: any, valorVenda?: number | null, acrescimoMensal?: number | null): number {
  // Base do cálculo da comissão da supervisão por categoria:
  //  - UPGRADE → SETUP do upgrade (valor_venda);
  //  - FISCAL  → ACRÉSCIMO na mensalidade (acrescimo_mensal);
  //  - demais  → valor de referência fixo do parceiro (fallback p/ valor_venda).
  if (parceiro.categoria === 'UPGRADE') return valorVenda ?? 0;
  if (parceiro.categoria === 'FISCAL') return acrescimoMensal ?? 0;
  return parceiro.valor_referencia ?? valorVenda ?? 0;
}

function calcularComissaoSupervisao(parceiro: any, valorVenda?: number | null, acrescimoMensal?: number | null): number {
  if (parceiro.comissao_supervisao_pct <= 0) return 0;
  const base = baseComissaoSupervisao(parceiro, valorVenda, acrescimoMensal);
  return parseFloat(((base * parceiro.comissao_supervisao_pct) / 100).toFixed(2));
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
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const parceiro = await prisma.parceiro.findUnique({ where: { id: body.data.parceiro_id } });
    if (!parceiro) return reply.status(404).send({ status: 'error', message: 'Parceiro não encontrado' });

    // Comissão do vendedor:
    //  - UPGRADE de plano → R$50 fixo (após confirmação);
    //  - INDICAÇÃO → R$50 fixo; REVENDA → valor do parceiro.
    // Um valor enviado explicitamente (comissao_valor) sempre prevalece.
    const comissaoPadrao = parceiro.categoria === 'UPGRADE'
      ? 50
      : (body.data.tipo_negocio === 'INDICACAO' ? 50 : parceiro.comissao_valor);
    const comissaoValor = body.data.comissao_valor ?? comissaoPadrao;
    const supervisaoId = user?.id || null;

    // O vendedor que fez a venda: gestão pode escolher qualquer vendedor; um vendedor
    // logado só registra para SI MESMO (segurança). Resolve o nome para exibição.
    const ehGestor = podeVerTudo(user);
    const vendedorId = ehGestor ? body.data.vendedor_id : (user?.id || body.data.vendedor_id);
    // Resolve o nome do vendedor (UsuarioCRM ou conta de sistema, ex.: Jessica/Diretora).
    const nomes = await resolverNomesUsuarios(prisma, [vendedorId]);
    const vendedorNome = nomes[vendedorId] || user?.nome || null;

    const venda = await prisma.vendaAdicional.create({
      data: {
        ...body.data,
        vendedor_id: vendedorId,
        vendedor_nome: vendedorNome,
        comissao_valor: comissaoValor,
        supervisao_id: supervisaoId,
        status: 'PENDENTE',
        created_by: user?.id || 'system',
      },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        parceiro: { select: { id: true, nome: true, categoria: true } },
      },
    });

    // Comissão do vendedor criada como PENDENTE — aguarda confirmação
    const periodo = proximoMes();
    await prisma.comissao.create({
      data: {
        responsavel_id: vendedorId,
        tipo: 'VENDA_ADICIONAL',
        referencia_id: venda.id,
        descricao: `Venda Adicional: ${parceiro.nome} — ${venda.cliente.nome}`,
        valor_base: comissaoValor,
        percentual: 100,
        valor_comissao: comissaoValor,
        periodo,
        status: 'PENDENTE',
        created_by: user?.id || 'system',
      },
    });

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
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const updateData: any = { ...body.data };
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
          await prisma.comissao.update({ where: { id: comissaoVendedor.id }, data: { status: 'APROVADA' } });
        } else if (body.data.comissao_paga === true || body.data.status === 'PAGA') {
          await prisma.comissao.update({ where: { id: comissaoVendedor.id }, data: { status: 'PAGA' } });
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
                percentual: vendaAtual.parceiro.comissao_supervisao_pct,
                valor_comissao: comissaoSupervisao,
                periodo: proximoMes(),
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
}
