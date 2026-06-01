import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { enviarEmailProposta } from '@/services/email.service';
import { ownerWhere, scopeUserId } from '@/lib/scope';
import { gerarIdPropostaUnico } from '@/lib/ids';

const PropostaSchema = z.object({
  razao_social:         z.string().min(1),
  nome_fantasia:        z.string().optional(),
  cnpj:                 z.string().optional(),
  segmento:             z.string().optional(),
  cidade:               z.string().optional(),
  estado:               z.string().optional(),
  maquinas:             z.number().optional(),
  tipo_loja:            z.string().optional(),
  sistema_atual:        z.string().optional(),
  data_virada:          z.string().optional(),

  responsavel_nome:     z.string().optional(),
  responsavel_telefone: z.string().optional(),
  responsavel_email:    z.string().optional(),
  responsavel_cpf:      z.string().optional(),
  responsavel_cargo:    z.string().optional(),
  responsavel_horario:  z.string().optional(),

  vendedor_nome:        z.string().optional(),
  vendedor_telefone:    z.string().optional(),
  vendedor_email:       z.string().optional(),
  vendedor_id:          z.string().optional(),
  supervisor_nome:      z.string().optional(),
  supervisor_id:        z.string().optional(),
  supervisor_email:     z.string().optional(),
  campanha:             z.string().optional(),
  validade:             z.string().datetime().optional(),
  origem:               z.string().optional(),

  plano_selecionado:    z.string().optional(),
  plano_recomendado:    z.string().optional(),
  mensalidade_pro:      z.number().optional(),
  mensalidade_plus:     z.number().optional(),
  modulos_inclusos:     z.array(z.string()).optional(),
  servicos_adicionais:  z.array(z.string()).optional(),

  valor_implantacao:    z.number().optional(),
  valor_conversao:      z.number().optional(),
  desconto:             z.number().optional(),
  valor_final:          z.number().optional(),
  entrada:              z.number().optional(),
  parcelas:             z.number().optional(),
  valor_parcela:        z.number().optional(),
  data_vencimento:      z.string().optional(),
  observacao_cobranca:  z.string().optional(),
  condicao_especial:    z.string().optional(),

  titulo_proposta:      z.string().optional(),
  frase_hero:           z.string().optional(),
  texto_valor:          z.string().optional(),
  observacoes:          z.string().optional(),

  comissao_vendedor_pct:   z.number().optional(),
  comissao_supervisor_pct: z.number().optional(),

  status: z.enum([
    'RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EM_NEGOCIACAO', 'PERDIDA',
    'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO',
  ]).optional(),
});

function calcComissoes(valorFinal: number | undefined | null, vendPct: number, supPct: number) {
  const base = valorFinal ?? 0;
  return {
    comissao_vendedor_valor:   base > 0 ? parseFloat(((base * vendPct) / 100).toFixed(2)) : 0,
    comissao_supervisor_valor: base > 0 ? parseFloat(((base * supPct) / 100).toFixed(2)) : 0,
  };
}

function proximoMes(): string {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
}

export async function propostasComerciais(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== LISTAR =====
  fastify.get('/propostas-comerciais', async (request, reply) => {
    const query = z.object({
      status:   z.string().optional(),
      vendedor: z.string().optional(),
      page:     z.coerce.number().default(0),
      limit:    z.coerce.number().default(20),
    }).safeParse(request.query);

    // Escopo: vendedor só vê as próprias propostas; gestor vê todas.
    const esc = ownerWhere(request, 'PropostaComercial');
    const where: any = { ...esc };
    if (query.data?.status) where.status = query.data.status;
    if (query.data?.vendedor) where.vendedor_nome = { contains: query.data.vendedor, mode: 'insensitive' };

    const [propostas, total] = await Promise.all([
      prisma.propostaComercial.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (query.data?.page || 0) * (query.data?.limit || 20),
        take: query.data?.limit || 20,
        include: { historico: { orderBy: { created_at: 'desc' }, take: 5 } },
      }),
      prisma.propostaComercial.count({ where }),
    ]);

    const stats = {
      total:           await prisma.propostaComercial.count({ where: { ...esc } }),
      rascunho:        await prisma.propostaComercial.count({ where: { status: 'RASCUNHO', ...esc } }),
      enviada:         await prisma.propostaComercial.count({ where: { status: 'ENVIADA', ...esc } }),
      aceita:          await prisma.propostaComercial.count({ where: { status: 'ACEITA', ...esc } }),
      em_negociacao:   await prisma.propostaComercial.count({ where: { status: 'EM_NEGOCIACAO', ...esc } }),
      contrato_ativo:  await prisma.propostaComercial.count({
        where: { status: { in: ['CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'] }, ...esc }
      }),
    };

    return reply.send({ status: 'success', data: { propostas, total, stats } });
  });

  // ===== BUSCAR UMA =====
  fastify.get('/propostas-comerciais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposta = await prisma.propostaComercial.findUnique({
      where: { id },
      include: { historico: { orderBy: { created_at: 'desc' } } },
    });
    if (!proposta) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
    return reply.send({ status: 'success', data: proposta });
  });

  // ===== ACESSO PÚBLICO (por token) — sem auth =====
  fastify.get('/p/:token', { config: { skipAuth: true } }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const proposta = await prisma.propostaComercial.findUnique({ where: { public_token: token } });
    if (!proposta) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada ou expirada' });
    return reply.send({ status: 'success', data: proposta });
  });

  // ===== CRIAR =====
  fastify.post('/propostas-comerciais', async (request, reply) => {
    const user = (request as any).user;
    const body = PropostaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const data = { ...body.data };

    // Auto-fill vendedor a partir do usuário logado se não foi informado
    if (!data.vendedor_nome && user?.nome) data.vendedor_nome = user.nome;
    if (!data.vendedor_email && user?.email) data.vendedor_email = user.email;
    if (!data.vendedor_id && user?.id) data.vendedor_id = user.id;

    // Calcular valor_final se não informado
    if (!data.valor_final && data.valor_implantacao !== undefined) {
      data.valor_final = parseFloat((
        (data.valor_implantacao ?? 0) + (data.valor_conversao ?? 0) - (data.desconto ?? 0)
      ).toFixed(2));
    }

    // Calcular valor_parcela se não informado
    if (!data.valor_parcela && data.valor_final && data.entrada !== undefined && data.parcelas) {
      const saldo = (data.valor_final ?? 0) - (data.entrada ?? 0);
      data.valor_parcela = parseFloat((saldo / data.parcelas).toFixed(2));
    }

    // Calcular comissões
    const vendPct = data.comissao_vendedor_pct ?? 15;
    const supPct  = data.comissao_supervisor_pct ?? 5;
    const comissoes = calcComissoes(data.valor_final, vendPct, supPct);

    const public_token = crypto.randomBytes(12).toString('hex');

    // ID rastreável: 3 primeiros do id do vendedor + CNPJ do cliente (contrato herda).
    const propostaId = await gerarIdPropostaUnico(prisma, data.vendedor_id || user?.id, data.cnpj);

    const proposta = await prisma.propostaComercial.create({
      data: {
        id:                  propostaId,
        ...data,
        validade: data.validade ? new Date(data.validade) : undefined,
        modulos_inclusos:    data.modulos_inclusos || [],
        servicos_adicionais: data.servicos_adicionais || [],
        status:              data.status || 'RASCUNHO',
        public_token,
        created_by:          user?.id || 'system',
        created_by_name:     user?.nome || undefined,
        created_by_role:     user?.role || undefined,
        comissao_vendedor_pct:   vendPct,
        comissao_supervisor_pct: supPct,
        ...comissoes,
      },
    });

    // Histórico de criação
    await prisma.propostaHistorico.create({
      data: {
        proposta_id:    proposta.id,
        tipo:           'CRIACAO',
        valor_novo:     `Status: RASCUNHO | Setup: R$ ${data.valor_final ?? 0}`,
        feito_por_id:   user?.id,
        feito_por_nome: user?.nome,
        feito_por_role: user?.role,
      },
    });

    // Enviar e-mail ao cliente (sem bloquear a resposta)
    if (proposta.responsavel_email) {
      enviarEmailProposta({ ...proposta, responsavel_email: proposta.responsavel_email })
        .then(r => { if (!r.ok) console.warn('[PROPOSTA] E-mail não enviado:', r.error); })
        .catch(e => console.error('[PROPOSTA] Erro inesperado no e-mail:', e));
    }

    return reply.status(201).send({ status: 'success', data: proposta });
  });

  // ===== ATUALIZAR =====
  fastify.patch('/propostas-comerciais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = PropostaSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const data: any = { ...body.data };
    if (data.validade) data.validade = new Date(data.validade);

    // Buscar proposta atual para histórico
    let atual: any;
    try {
      atual = await prisma.propostaComercial.findUnique({ where: { id } });
      if (!atual) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
    } catch { /* continua */ }

    // Recalcular comissões se valor_final mudou
    if (data.valor_final !== undefined || data.desconto !== undefined || data.valor_implantacao !== undefined) {
      const vf = data.valor_final ?? atual?.valor_final ?? 0;
      const vendPct = data.comissao_vendedor_pct ?? atual?.comissao_vendedor_pct ?? 15;
      const supPct  = data.comissao_supervisor_pct ?? atual?.comissao_supervisor_pct ?? 5;
      const comissoes = calcComissoes(vf, vendPct, supPct);
      data.comissao_vendedor_valor   = comissoes.comissao_vendedor_valor;
      data.comissao_supervisor_valor = comissoes.comissao_supervisor_valor;
    }

    // Quando proposta é ACEITA: marcar data e confirmar comissão
    if (data.status === 'ACEITA' && atual?.status !== 'ACEITA') {
      data.data_aceite = new Date();
      data.comissao_confirmada = true;
      data.status = 'CONTRATO_EM_GERACAO';

      // Criar comissão do vendedor no módulo de comissões
      if (atual?.vendedor_id && data.comissao_vendedor_valor > 0) {
        const periodo = proximoMes();
        await prisma.comissao.create({
          data: {
            responsavel_id: atual.vendedor_id,
            tipo:           'PROPOSTA',
            referencia_id:  id,
            descricao:      `Comissão por fechamento — ${atual.razao_social}`,
            valor_base:     data.comissao_vendedor_valor ? (data.comissao_vendedor_valor / (data.comissao_vendedor_pct ?? 15)) * 100 : (atual.valor_final ?? 0),
            percentual:     data.comissao_vendedor_pct ?? atual?.comissao_vendedor_pct ?? 15,
            valor_comissao: data.comissao_vendedor_valor ?? atual?.comissao_vendedor_valor ?? 0,
            periodo,
            status:         'APROVADA',
            created_by:     user?.id || 'system',
          },
        }).catch(() => null);
      }

      // Criar comissão do supervisor
      if (atual?.supervisor_id && (data.comissao_supervisor_valor ?? atual?.comissao_supervisor_valor ?? 0) > 0) {
        const periodo = proximoMes();
        await prisma.comissao.create({
          data: {
            responsavel_id: atual.supervisor_id,
            tipo:           'PROPOSTA',
            referencia_id:  id,
            descricao:      `Comissão supervisão — ${atual.razao_social}`,
            valor_base:     atual.valor_final ?? 0,
            percentual:     data.comissao_supervisor_pct ?? atual?.comissao_supervisor_pct ?? 5,
            valor_comissao: data.comissao_supervisor_valor ?? atual?.comissao_supervisor_valor ?? 0,
            periodo,
            status:         'APROVADA',
            created_by:     user?.id || 'system',
          },
        }).catch(() => null);
      }
    }

    // Quando contrato assinado: marcar fechamento
    if (data.status === 'CONTRATO_ASSINADO' && atual?.status !== 'CONTRATO_ASSINADO') {
      data.data_fechamento = new Date();
    }

    // Registrar histórico
    if (data.status && data.status !== atual?.status) {
      await prisma.propostaHistorico.create({
        data: {
          proposta_id:    id,
          tipo:           'STATUS',
          campo_alterado: 'status',
          valor_anterior: atual?.status,
          valor_novo:     data.status,
          feito_por_id:   user?.id,
          feito_por_nome: user?.nome,
          feito_por_role: user?.role,
        },
      }).catch(() => null);
    }

    try {
      const proposta = await prisma.propostaComercial.update({ where: { id }, data });

      // Reenviar e-mail quando status muda para ENVIADA
      if (data.status === 'ENVIADA' && atual?.status !== 'ENVIADA' && proposta.responsavel_email) {
        enviarEmailProposta({ ...proposta, responsavel_email: proposta.responsavel_email })
          .then(r => { if (!r.ok) console.warn('[PROPOSTA] E-mail (ENVIADA) não enviado:', r.error); })
          .catch(e => console.error('[PROPOSTA] Erro inesperado no e-mail:', e));
      }

      return reply.send({ status: 'success', data: proposta });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
      throw e;
    }
  });

  // ===== RENEGOCIAR =====
  fastify.post('/propostas-comerciais/:id/renegociar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const body = z.object({
      valor_implantacao: z.number().optional(),
      valor_conversao:   z.number().optional(),
      desconto:          z.number().optional(),
      valor_final:       z.number().optional(),
      entrada:           z.number().optional(),
      parcelas:          z.number().optional(),
      valor_parcela:     z.number().optional(),
      data_vencimento:   z.string().optional(),
      mensalidade_pro:   z.number().optional(),
      mensalidade_plus:  z.number().optional(),
      plano_selecionado: z.string().optional(),
      observacoes:       z.string().optional(),
      validade:          z.string().optional(),
      motivo:            z.string().min(1),
      observacao_interna:z.string().optional(),
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const atual = await prisma.propostaComercial.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });

    const { motivo, observacao_interna, ...changes } = body.data;

    // Calcular valor_final se não informado diretamente
    const newVF = changes.valor_final ??
      parseFloat(((changes.valor_implantacao ?? atual.valor_implantacao ?? 0) +
                  (changes.valor_conversao  ?? atual.valor_conversao  ?? 0) -
                  (changes.desconto         ?? atual.desconto         ?? 0)).toFixed(2));

    // Recalcular parcela
    if (!changes.valor_parcela && changes.parcelas) {
      const entrada = changes.entrada ?? atual.entrada ?? 0;
      changes.valor_parcela = parseFloat(((newVF - entrada) / changes.parcelas).toFixed(2));
    }

    // Recalcular comissões
    const vendPct = atual.comissao_vendedor_pct ?? 15;
    const supPct  = atual.comissao_supervisor_pct ?? 5;
    const comissoes = calcComissoes(newVF, vendPct, supPct);

    // Salvar histórico com diff
    const diff: string[] = [];
    if (changes.valor_final !== undefined && changes.valor_final !== atual.valor_final) {
      diff.push(`Setup: R$ ${atual.valor_final ?? 0} → R$ ${newVF}`);
    }
    if (changes.desconto !== undefined && changes.desconto !== atual.desconto) {
      diff.push(`Desconto: R$ ${atual.desconto ?? 0} → R$ ${changes.desconto}`);
    }
    if (changes.parcelas !== undefined && changes.parcelas !== atual.parcelas) {
      diff.push(`Parcelas: ${atual.parcelas ?? 0}x → ${changes.parcelas}x`);
    }
    if (changes.plano_selecionado && changes.plano_selecionado !== atual.plano_selecionado) {
      diff.push(`Plano: ${atual.plano_selecionado} → ${changes.plano_selecionado}`);
    }

    await prisma.propostaHistorico.create({
      data: {
        proposta_id:    id,
        tipo:           'RENEGOCIACAO',
        valor_anterior: `Setup: R$ ${atual.valor_final ?? 0} | Comissão: R$ ${atual.comissao_vendedor_valor ?? 0}`,
        valor_novo:     `Setup: R$ ${newVF} | Comissão: R$ ${comissoes.comissao_vendedor_valor}`,
        motivo,
        observacao:     [diff.join(', '), observacao_interna].filter(Boolean).join(' | '),
        feito_por_id:   user?.id,
        feito_por_nome: user?.nome,
        feito_por_role: user?.role,
      },
    });

    const proposta = await prisma.propostaComercial.update({
      where: { id },
      data: {
        ...changes,
        valor_final: newVF,
        validade: changes.validade ? new Date(changes.validade) : undefined,
        status:   atual.status === 'RASCUNHO' ? 'EM_NEGOCIACAO' : atual.status,
        ...comissoes,
      },
    });

    return reply.send({ status: 'success', data: proposta });
  });

  // ===== DELETAR =====
  fastify.delete('/propostas-comerciais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.propostaComercial.delete({ where: { id } });
      return reply.send({ status: 'success' });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
      throw e;
    }
  });

  // ===== REGENERAR TOKEN PÚBLICO =====
  fastify.post('/propostas-comerciais/:id/regenerar-token', async (request, reply) => {
    const { id } = request.params as { id: string };
    const public_token = crypto.randomBytes(12).toString('hex');
    try {
      const proposta = await prisma.propostaComercial.update({ where: { id }, data: { public_token } });
      return reply.send({ status: 'success', data: { public_token, proposta } });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
      throw e;
    }
  });

  // ===== HISTÓRICO =====
  fastify.get('/propostas-comerciais/:id/historico', async (request, reply) => {
    const { id } = request.params as { id: string };
    const historico = await prisma.propostaHistorico.findMany({
      where: { proposta_id: id },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: historico });
  });

  // ===== RELATÓRIO DE COMISSÕES =====
  fastify.get('/propostas-comerciais/relatorio/comissoes', async (request, reply) => {
    const query = z.object({
      vendedor_id: z.string().optional(),
      status:      z.string().optional(),
      periodo:     z.string().optional(),
    }).safeParse(request.query);

    const where: any = {};
    if (query.data?.status) where.status = query.data.status;
    // Escopo de comissões: gestor vê de todos (ou filtra por vendedor_id na query);
    // vendedor só vê as próprias, ignorando vendedor_id de outra pessoa.
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.vendedor_id = scopeId;
    else if (query.data?.vendedor_id) where.vendedor_id = query.data.vendedor_id;

    const propostas = await prisma.propostaComercial.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true, razao_social: true, segmento: true, plano_selecionado: true,
        valor_implantacao: true, valor_final: true, mensalidade_plus: true, mensalidade_pro: true,
        status: true, data_aceite: true, data_fechamento: true, created_at: true,
        vendedor_nome: true, vendedor_id: true, supervisor_nome: true, supervisor_id: true,
        comissao_vendedor_pct: true, comissao_vendedor_valor: true,
        comissao_supervisor_pct: true, comissao_supervisor_valor: true,
        comissao_confirmada: true,
      },
    });

    return reply.send({ status: 'success', data: propostas });
  });
}
