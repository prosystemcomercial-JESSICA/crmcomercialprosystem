import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

/**
 * LANÇAMENTOS RETROATIVOS (gestão)
 * ---------------------------------
 * Permite preencher o histórico do ano com dados que ficaram fora do CRM:
 *  - Venda/Contrato fechado  → PropostaComercial CONTRATO_ASSINADO com data_aceite no mês real;
 *                              opcionalmente gera a comissão do vendedor (15% do setup).
 *  - Comissão avulsa         → Comissao (paga ou a pagar) no período informado.
 *  - Saída / churn           → Cliente INATIVA com inativado_em no mês real + mrr_perdido.
 *
 * Tudo é datado com a DATA RETROATIVA informada, então os mesmos filtros do
 * relatório mensal/metas/entrada×saída (data_aceite / inativado_em / periodo)
 * passam a enxergar o histórico. Marcado com `origem='RETROATIVO'` p/ auditoria.
 */
export async function lancamentosRetroativosRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient },
) {
  const { prisma } = options;

  // "YYYY-MM" a partir de uma data.
  const periodoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Converte "YYYY-MM-DD" (ou ISO) numa Date ao meio-dia local (evita virar o mês
  // por fuso ao salvar como UTC). Lança se a data for inválida.
  function parseDataRetroativa(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : new Date(s);
    if (isNaN(d.getTime())) throw new Error('Data inválida');
    return d;
  }

  // ── 1) VENDA / CONTRATO FECHADO retroativo ─────────────────────────────────
  fastify.post('/retroativos/venda', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;

    const body = z.object({
      razao_social: z.string().min(1, 'Informe o cliente'),
      nome_fantasia: z.string().optional(),
      cnpj: z.string().optional(),
      segmento: z.string().optional(),
      data: z.string().min(8, 'Informe a data'), // data do fechamento (YYYY-MM-DD)
      setup: z.number().nonnegative().default(0), // valor_implantacao
      mensalidade: z.number().nonnegative().default(0), // MRR
      plano: z.string().optional(), // PRO | PLUS | ...
      vendedor_id: z.string().optional(),
      vendedor_nome: z.string().optional(),
      gerar_comissao: z.boolean().default(true),
      comissao_paga: z.boolean().default(false), // já paga? senão, a pagar
      mes_pagamento_comissao: z.string().optional(), // "YYYY-MM" — mês em que a comissão é/será paga
      observacoes: z.string().optional(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });
    }

    let data: Date;
    try { data = parseDataRetroativa(body.data.data); }
    catch { return reply.status(400).send({ status: 'error', message: 'Data inválida' }); }

    // Mês de pagamento da comissão: informado pela gestão; senão, o mês da venda.
    const mesPagto = (body.data.mes_pagamento_comissao && /^\d{4}-\d{2}$/.test(body.data.mes_pagamento_comissao))
      ? body.data.mes_pagamento_comissao
      : periodoDe(data);

    const plano = (body.data.plano || '').toUpperCase();
    const ehPlus = plano === 'PLUS';

    const proposta = await prisma.propostaComercial.create({
      data: {
        razao_social: body.data.razao_social,
        nome_fantasia: body.data.nome_fantasia || undefined,
        cnpj: body.data.cnpj || undefined,
        segmento: body.data.segmento || undefined,
        plano_selecionado: plano || undefined,
        valor_implantacao: body.data.setup,
        valor_final: body.data.setup,
        // MRR vai no campo do plano selecionado (o relatório lê plus ?? pro).
        mensalidade_plus: ehPlus ? body.data.mensalidade : undefined,
        mensalidade_pro: ehPlus ? undefined : body.data.mensalidade,
        vendedor_id: body.data.vendedor_id || undefined,
        vendedor_nome: body.data.vendedor_nome || undefined,
        status: 'CONTRATO_ASSINADO',
        data_aceite: data,
        data_fechamento: data,
        origem: 'RETROATIVO',
        observacoes: body.data.observacoes || undefined,
        modulos_inclusos: [] as any,
        servicos_adicionais: [] as any,
        created_by: user?.id || 'system',
        created_by_name: 'Lançamento retroativo',
        created_at: data, // mantém o registro no mês real também por created_at
      } as any,
    });

    // Comissão do vendedor (15% do setup) — opcional.
    let comissao: any = null;
    if (body.data.gerar_comissao && body.data.setup > 0 && body.data.vendedor_id) {
      const valor = Math.round(body.data.setup * 0.15 * 100) / 100;
      comissao = await prisma.comissao.create({
        data: {
          responsavel_id: body.data.vendedor_id,
          tipo: 'CONTRATO',
          referencia_id: proposta.id,
          descricao: `Comissão (retroativo): ${body.data.razao_social}`,
          valor_base: body.data.setup,
          percentual: 15,
          valor_comissao: valor,
          periodo: periodoDe(data),
          papel: 'VENDEDOR',
          // Retroativo: SEMPRE grava o mês de pagamento (informado ou o da venda).
          // Não paga → estágio CONFIRMADA (entra na aba "A Pagar" daquele mês);
          // paga → PAGA no mesmo mês.
          status: body.data.comissao_paga ? 'PAGA' : 'PENDENTE',
          estagio: body.data.comissao_paga ? 'PAGA' : 'CONFIRMADA',
          mes_pagamento: mesPagto,
          paga_em: body.data.comissao_paga ? data : undefined,
          created_by: user?.id || 'system',
          created_at: data,
        } as any,
      }).catch(() => null);
    }

    return reply.status(201).send({ status: 'success', data: { proposta, comissao } });
  });

  // ── 2) COMISSÃO avulsa retroativa ──────────────────────────────────────────
  fastify.post('/retroativos/comissao', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;

    const body = z.object({
      vendedor_id: z.string().min(1, 'Informe o vendedor'),
      descricao: z.string().optional(),
      valor: z.number().positive('Informe o valor da comissão'),
      data: z.string().min(8, 'Informe a data'), // competência (YYYY-MM-DD)
      paga: z.boolean().default(false),
      mes_pagamento_comissao: z.string().optional(), // "YYYY-MM"
      tipo: z.string().default('VENDA_ADICIONAL'),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });
    }

    let data: Date;
    try { data = parseDataRetroativa(body.data.data); }
    catch { return reply.status(400).send({ status: 'error', message: 'Data inválida' }); }

    const mesPagto = (body.data.mes_pagamento_comissao && /^\d{4}-\d{2}$/.test(body.data.mes_pagamento_comissao))
      ? body.data.mes_pagamento_comissao
      : periodoDe(data);

    const comissao = await prisma.comissao.create({
      data: {
        responsavel_id: body.data.vendedor_id,
        tipo: body.data.tipo,
        descricao: body.data.descricao || `Comissão retroativa`,
        valor_base: body.data.valor,
        percentual: 100,
        valor_comissao: body.data.valor,
        periodo: periodoDe(data),
        papel: 'VENDEDOR',
        // Sempre grava o mês de pagamento; não paga → CONFIRMADA (aba "A Pagar").
        status: body.data.paga ? 'PAGA' : 'PENDENTE',
        estagio: body.data.paga ? 'PAGA' : 'CONFIRMADA',
        mes_pagamento: mesPagto,
        paga_em: body.data.paga ? data : undefined,
        created_by: user?.id || 'system',
        created_at: data,
      } as any,
    });

    return reply.status(201).send({ status: 'success', data: comissao });
  });

  // ── 3) SAÍDA / CHURN retroativo ────────────────────────────────────────────
  // Marca um cliente EXISTENTE como inativo no mês informado, ou cria um registro
  // mínimo INATIVA (só p/ alimentar o "perdidos" do relatório) quando o cliente
  // não está na base.
  fastify.post('/retroativos/saida', async (request, reply) => {
    if (!requireGestor(request, reply)) return;

    const body = z.object({
      cliente_id: z.string().optional(), // se já existe na base
      nome: z.string().optional(), // se for criar registro mínimo
      razao_social: z.string().optional(),
      data: z.string().min(8, 'Informe a data'), // inativado_em (YYYY-MM-DD)
      mrr_perdido: z.number().nonnegative().default(0),
      motivo: z.string().optional(),
      grupo_tecnico: z.string().optional(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });
    }

    let data: Date;
    try { data = parseDataRetroativa(body.data.data); }
    catch { return reply.status(400).send({ status: 'error', message: 'Data inválida' }); }

    const dadosSaida = {
      situacao: 'INATIVA',
      inativado_em: data,
      mrr_perdido: body.data.mrr_perdido,
      motivo_inativacao: body.data.motivo || 'Saída retroativa',
      grupo_tecnico: body.data.grupo_tecnico || undefined,
    } as any;

    let cliente: any;
    if (body.data.cliente_id) {
      cliente = await prisma.cliente.update({
        where: { id: body.data.cliente_id },
        data: dadosSaida,
      }).catch(() => null);
      if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
    } else {
      if (!body.data.nome && !body.data.razao_social) {
        return reply.status(400).send({ status: 'error', message: 'Selecione um cliente da base ou informe o nome' });
      }
      cliente = await prisma.cliente.create({
        data: {
          nome: body.data.nome || body.data.razao_social || 'Cliente',
          razao_social: body.data.razao_social || undefined,
          ...dadosSaida,
        } as any,
      });
    }

    return reply.status(201).send({ status: 'success', data: cliente });
  });
}
