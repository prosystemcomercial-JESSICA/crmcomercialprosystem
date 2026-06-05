import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor, podeVerTudo } from '@/lib/scope';
import { confirmarImplantacao } from '@/lib/comissao-fluxo';

/**
 * Acompanhamento e EXECUÇÃO da implantação. Cada implantação nasce de um contrato
 * ASSINADO. A supervisão informa instalação + 1º vencimento (define o mês de
 * pagamento da comissão) e DESIGNA um técnico de implantação. O técnico executa:
 * atividades (timeline), testes de conversão, arquivos (anexo/link), checklist,
 * e move a etapa de execução. Trilha de tempo por fase: negociação→assinatura,
 * implantação (assinatura→instalado), treinamento (início→fim), tempo total.
 *
 * Escopo: gestão vê tudo; técnico vê só as implantações designadas a ele.
 */

const ETAPAS_EXEC = ['AGUARDANDO_DESIGNACAO', 'DESIGNADO', 'EM_ANALISE', 'EM_CONVERSAO', 'EM_CONFIGURACAO', 'EM_TREINAMENTO', 'FINALIZADO'];
const TESTES_PADRAO = ['Produtos', 'Clientes', 'Fornecedores', 'Estoque', 'Financeiro (a pagar/receber)', 'Fiscal / NF-e', 'Vendas / Histórico'];

// Trilha real de implantação (Trello) — 3 grupos com os itens do técnico.
const CHECKLIST_GRUPOS: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'INSTALACAO',
    itens: [
      'Instalação do servidor, terminais e Caixa',
      'Configuração de Balança, gaveta',
      'Configuração de impressora NFCE',
      'Configurar Uninfe e Certificado',
      'Configurar Gerencial',
      'Configurar o Copy (backup) Interno e Externo (Nuvem)',
      'Configurar o Connect (Comunicação entre filiais)',
      'Testar Cadastro de Clientes',
      'Teste de Cadastro de Produtos, verificar dados obrigatórios',
      'Teste de Movimentação - Entrada, Emissão de nota e Cancelamento',
      'Teste Financeiro - movimentação',
      'Validar relatórios 100% atualizados',
      'Instalar e Configurar Farmácias APP',
      'Emitir uma nota de saída NFCE em Operação',
    ],
  },
  {
    grupo: 'CONVERSAO',
    itens: [
      'Instalação do Banco de Dados',
      'Limpar tabelas para receber a nova versão',
      'Conversão dos dados do sistema X para Prosystem',
      'Validar Produtos (cód. barras, estoque, tributação, registro MS, custo, venda, lucro, promoção...)',
      'Validar Clientes (endereço completo, RG, CPF, crediário, limite de crédito)',
      'Validar Cadastro de Empresas e Prescritores',
      'Financeiro (plano de contas, contas a pagar/receber, dados de cartões)',
      'Movimentação (entrada, saída, verificar última nota NFE/NFCE)',
      'Gerar SPED Fiscal para validação de valores',
      'Incluir sequência das últimas 10 NFE emitidas na NFE_NUMERACAO',
    ],
  },
  {
    grupo: 'TREINAMENTO',
    itens: [
      'Configuração de Acesso padrão para Funcionários',
      'Movimentação - Entrada / Saída de nota',
      'Produtos - Cadastro',
      'Financeiro - Plano de Contas',
      'PDV - Pré-Venda / Orçamento',
      'Emissão de Cupom Fiscal NFCE',
      'PDV - Devolução',
      'PDV - NFE Acobertamento',
      'Fechamento de caixa',
      'Crediário / Convênio',
      'Sugestão de compras (Curva ABC) — ou apresentar a ferramenta',
      'Controlados / Receitas - Controle SNGPC',
      'Comunicação entre Filiais',
      'Controle de Estoque',
      'Metas de Funcionários',
      'PBM',
      'Recarga de celular - RV',
      'Prosystem Gerencial',
      'Ofertar o Imendes',
    ],
  },
];

function dias(a?: Date | string | null, b?: Date | string | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return d >= 0 ? d : null;
}

export async function implantacoesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Filtro de escopo: técnico de implantação só vê as designadas a ele.
  const escopoTecnico = (request: any): Record<string, any> => {
    const user = request.user;
    if (podeVerTudo(user)) return {};
    if ((user?.role || '').toUpperCase() === 'TECNICO_IMPLANTACAO') return { tecnico_id: user.id };
    return {}; // demais papéis (comercial) seguem regra da rota
  };

  // ── LISTA
  fastify.get('/implantacoes', async (request, reply) => {
    const q = (request.query as any) || {};
    const where: any = { ...escopoTecnico(request) };
    if (q.status) where.status = q.status;
    if (q.etapa_execucao) where.etapa_execucao = q.etapa_execucao;
    const implantacoes = await prisma.implantacao.findMany({
      where, orderBy: [{ status: 'asc' }, { data_assinatura: 'desc' }],
    });
    const resumo = {
      aguardando: implantacoes.filter(i => i.status === 'AGUARDANDO_INSTALACAO').length,
      agendada:   implantacoes.filter(i => i.status === 'AGENDADA').length,
      instalado:  implantacoes.filter(i => i.status === 'INSTALADO').length,
      em_execucao: implantacoes.filter(i => !['AGUARDANDO_DESIGNACAO', 'FINALIZADO'].includes(i.etapa_execucao)).length,
      total:      implantacoes.length,
    };
    return reply.send({ status: 'success', data: { implantacoes, resumo } });
  });

  // ── DETALHE (com atividades, testes, arquivos, checklist e trilha de tempo)
  fastify.get('/implantacoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const imp = await prisma.implantacao.findUnique({
      where: { id },
      include: {
        atividades: { orderBy: { created_at: 'desc' } },
        testes: { orderBy: { created_at: 'asc' } },
        arquivos: { orderBy: { created_at: 'desc' } },
        checklist: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Implantação não encontrada' });

    const trilha = {
      negociacao_dias: dias(imp.data_entrada_lead, imp.data_assinatura),
      implantacao_dias: dias(imp.data_assinatura, imp.data_instalacao),
      treinamento_dias: dias(imp.treinamento_inicio, imp.treinamento_fim),
      total_dias: dias(imp.data_entrada_lead || imp.data_assinatura, imp.data_conclusao || new Date()),
    };

    // Progresso por grupo da trilha (Instalação / Conversão / Treinamento).
    const ordemGrupos = ['INSTALACAO', 'CONVERSAO', 'TREINAMENTO'];
    const grupos = ordemGrupos.map(g => {
      const itens = (imp.checklist || []).filter((c: any) => (c.grupo || 'INSTALACAO') === g);
      const feitos = itens.filter((c: any) => c.feito).length;
      return {
        grupo: g,
        itens,
        total: itens.length,
        feitos,
        progresso: itens.length ? Math.round((feitos / itens.length) * 100) : 0,
      };
    }).filter(g => g.total > 0);

    const totalItens = (imp.checklist || []).length;
    const totalFeitos = (imp.checklist || []).filter((c: any) => c.feito).length;
    const progresso_geral = totalItens ? Math.round((totalFeitos / totalItens) * 100) : 0;

    return reply.send({ status: 'success', data: { ...imp, trilha, grupos, progresso_geral } });
  });

  // ── INFORMAR datas comerciais (instalação + 1º vencimento) — gestão
  fastify.patch('/implantacoes/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      data_instalacao: z.string().optional(),
      data_primeiro_vencimento: z.string().optional(),
      data_agendada: z.string().optional(),
      data_entrada_lead: z.string().optional(),
      status: z.enum(['AGUARDANDO_INSTALACAO', 'AGENDADA', 'INSTALADO', 'CANCELADA']).optional(),
      tipo_base: z.enum(['BANCO_ZERADO', 'CONVERSAO']).optional(),
      sistema_anterior: z.string().optional(),
      observacoes: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const d = body.data;
    const atualizada = await confirmarImplantacao(prisma, id, {
      data_instalacao: d.data_instalacao ? new Date(d.data_instalacao) : undefined,
      data_primeiro_vencimento: d.data_primeiro_vencimento ? new Date(d.data_primeiro_vencimento) : undefined,
      data_agendada: d.data_agendada ? new Date(d.data_agendada) : undefined,
      status: d.status,
      observacoes: d.observacoes,
    });
    if (!atualizada) return reply.status(404).send({ status: 'error', message: 'Implantação não encontrada' });
    const extra: any = {};
    if (d.data_entrada_lead) extra.data_entrada_lead = new Date(d.data_entrada_lead);
    if (d.tipo_base) extra.tipo_base = d.tipo_base;
    if (d.sistema_anterior !== undefined) extra.sistema_anterior = d.sistema_anterior;
    if (Object.keys(extra).length) {
      await prisma.implantacao.update({ where: { id }, data: extra }).catch(() => {});
    }
    return reply.send({ status: 'success', data: { ...atualizada, ...extra } });
  });

  // ── DESIGNAR técnico (gestão) — cria checklist/testes padrão na primeira vez
  fastify.post('/implantacoes/:id/designar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ tecnico_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o técnico' });

    const tec: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE id = ? LIMIT 1`, body.data.tecnico_id
    ).catch(() => []);
    if (!tec.length) return reply.status(404).send({ status: 'error', message: 'Técnico não encontrado' });
    const tecnico = tec[0];
    const ator = (request as any).user;

    const imp = await prisma.implantacao.update({
      where: { id },
      data: {
        tecnico_id: tecnico.id, tecnico_nome: tecnico.nome, designado_em: new Date(),
        etapa_execucao: 'DESIGNADO',
      },
    });

    // Semeia testes e checklist padrão (uma vez).
    const temTeste = await prisma.implantacaoTeste.count({ where: { implantacao_id: id } });
    if (temTeste === 0) {
      await prisma.implantacaoTeste.createMany({ data: TESTES_PADRAO.map(item => ({ implantacao_id: id, item })) }).catch(() => {});
    }
    const temChk = await prisma.implantacaoChecklistItem.count({ where: { implantacao_id: id } });
    if (temChk === 0) {
      // Semeia a trilha completa (3 grupos: Instalação, Conversão, Treinamento).
      const itens: any[] = [];
      CHECKLIST_GRUPOS.forEach(g => g.itens.forEach((titulo, i) => itens.push({ implantacao_id: id, grupo: g.grupo, titulo, ordem: i })));
      await prisma.implantacaoChecklistItem.createMany({ data: itens }).catch(() => {});
    }
    await registrarAtividade(prisma, id, 'DESIGNACAO', `Designado ao técnico ${tecnico.nome}`, ator, null, 'DESIGNADO');
    return reply.send({ status: 'success', data: imp });
  });

  // ── MOVER etapa de execução (técnico ou gestão)
  fastify.post('/implantacoes/:id/etapa', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ etapa: z.enum(ETAPAS_EXEC as any) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Etapa inválida' });
    const imp = await prisma.implantacao.findUnique({ where: { id } });
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Não encontrada' });
    const ator = (request as any).user;

    const data: any = { etapa_execucao: body.data.etapa };
    if (body.data.etapa === 'FINALIZADO' && !imp.data_conclusao) data.data_conclusao = new Date();
    const atualizada = await prisma.implantacao.update({ where: { id }, data });
    await registrarAtividade(prisma, id, 'MUDANCA_ETAPA', `Etapa alterada para ${body.data.etapa}`, ator, imp.etapa_execucao, body.data.etapa);
    return reply.send({ status: 'success', data: atualizada });
  });

  // ── TREINAMENTO: iniciar / encerrar (cronometra)
  fastify.post('/implantacoes/:id/treinamento', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ acao: z.enum(['INICIAR', 'ENCERRAR']) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Ação inválida' });
    const imp = await prisma.implantacao.findUnique({ where: { id } });
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Não encontrada' });
    const ator = (request as any).user;
    const agora = new Date();

    if (body.data.acao === 'INICIAR') {
      await prisma.implantacao.update({ where: { id }, data: { treinamento_inicio: agora, etapa_execucao: 'EM_TREINAMENTO' } });
      await registrarAtividade(prisma, id, 'TREINAMENTO', 'Treinamento iniciado', ator);
    } else {
      await prisma.implantacao.update({ where: { id }, data: { treinamento_fim: agora } });
      const d = dias(imp.treinamento_inicio, agora);
      await registrarAtividade(prisma, id, 'TREINAMENTO', `Treinamento encerrado${d != null ? ` (${d} dia(s))` : ''}`, ator);
    }
    const atual = await prisma.implantacao.findUnique({ where: { id } });
    return reply.send({ status: 'success', data: atual });
  });

  // ── ATIVIDADES (timeline / notas)
  fastify.post('/implantacoes/:id/atividades', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ descricao: z.string().min(1), tipo: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Descrição obrigatória' });
    const ator = (request as any).user;
    const atv = await registrarAtividade(prisma, id, body.data.tipo || 'NOTA', body.data.descricao, ator);
    return reply.status(201).send({ status: 'success', data: atv });
  });

  // ── TESTES de conversão (criar avulso, atualizar resultado)
  fastify.post('/implantacoes/:id/testes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ item: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Item obrigatório' });
    const t = await prisma.implantacaoTeste.create({ data: { implantacao_id: id, item: body.data.item } });
    return reply.status(201).send({ status: 'success', data: t });
  });

  fastify.patch('/implantacoes/testes/:testeId', async (request, reply) => {
    const { testeId } = request.params as { testeId: string };
    const body = z.object({
      resultado: z.enum(['PENDENTE', 'OK', 'DIVERGENTE', 'NAO_APLICA']).optional(),
      observacao: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const ator = (request as any).user;
    const t = await prisma.implantacaoTeste.update({
      where: { id: testeId },
      data: { ...body.data, testado_por: ator?.nome || ator?.id, testado_em: new Date() },
    });
    return reply.send({ status: 'success', data: t });
  });

  // ── ARQUIVOS (anexo base64 ou link)
  fastify.post('/implantacoes/:id/arquivos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().min(1), tipo: z.enum(['LINK', 'ANEXO']).default('LINK'),
      url: z.string().min(1), descricao: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const ator = (request as any).user;
    const arq = await prisma.implantacaoArquivo.create({
      data: { implantacao_id: id, ...body.data, enviado_por: ator?.nome || ator?.id },
    });
    await registrarAtividade(prisma, id, 'ARQUIVO', `Arquivo "${body.data.nome}" adicionado`, ator);
    return reply.status(201).send({ status: 'success', data: arq });
  });

  fastify.delete('/implantacoes/arquivos/:arquivoId', async (request, reply) => {
    const { arquivoId } = request.params as { arquivoId: string };
    await prisma.implantacaoArquivo.delete({ where: { id: arquivoId } }).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // ── CHECKLIST (marcar item, adicionar)
  fastify.post('/implantacoes/:id/checklist', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      titulo: z.string().min(1),
      grupo: z.enum(['INSTALACAO', 'CONVERSAO', 'TREINAMENTO']).default('INSTALACAO'),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Título obrigatório' });
    const ordem = await prisma.implantacaoChecklistItem.count({ where: { implantacao_id: id, grupo: body.data.grupo } });
    const item = await prisma.implantacaoChecklistItem.create({
      data: { implantacao_id: id, grupo: body.data.grupo, titulo: body.data.titulo, ordem },
    });
    return reply.status(201).send({ status: 'success', data: item });
  });

  fastify.patch('/implantacoes/checklist/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const body = z.object({ feito: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const ator = (request as any).user;
    const item = await prisma.implantacaoChecklistItem.update({
      where: { id: itemId },
      data: { feito: body.data.feito, feito_por: body.data.feito ? (ator?.nome || ator?.id) : null, feito_em: body.data.feito ? new Date() : null },
    });
    return reply.send({ status: 'success', data: item });
  });

  // ── TÉCNICOS disponíveis para designar
  fastify.get('/implantacoes/tecnicos', async (_request, reply) => {
    const tecnicos: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE cargo IN ('TECNICO_IMPLANTACAO','TECNICO_SUPORTE','SUPERVISAO_TECNICA') AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    return reply.send({ status: 'success', data: tecnicos });
  });
}

async function registrarAtividade(
  prisma: PrismaClient, implantacaoId: string, tipo: string, descricao: string,
  ator?: { id?: string; nome?: string }, etapaDe?: string | null, etapaPara?: string | null,
) {
  return prisma.implantacaoAtividade.create({
    data: {
      implantacao_id: implantacaoId, tipo, descricao,
      etapa_de: etapaDe || undefined, etapa_para: etapaPara || undefined,
      autor_id: ator?.id, autor_nome: ator?.nome || 'Sistema',
    },
  }).catch(() => null);
}
