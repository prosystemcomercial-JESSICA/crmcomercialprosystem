import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireGestor } from '@/lib/scope';

const FERRAMENTAS_LISTA = [
  'API Domínios','Backup Mega - Externo - Terminal','CoteFácil','D-Pharma',
  'Dashboard - Painel de Aferição de Indicadores','E-Diretor','Ello Mais','EntregaFarma',
  'Farmácia Popular Prosystem','Farmácias App','Fidelimax','Figura Fiscal Avanti',
  'Gerencial','Ifood','Imendes','Melhor Compra','Monnera','MultiFarma','MyPharma',
  'Napp Esphera','Napp Solution Google','PAC Arquivos Fiscais','Pgfarma',
  'Plano Basic','Plano Plus','Plano Pro','Prosystem MEI','QMoleza','Rede Soma',
  'Rise','SmartPed','Tray','WebDecisor','Woo Commerce'
];

const TIPOS_SERVICO: Record<string, string[]> = {
  'Suporte técnico': ['Sistema não abre','Erro de acesso','Lentidão','Falha no PDV','Problema com impressora','Problema de caixa','Problema de usuário/senha'],
  'Fiscal': ['Erro NFE','Erro NFC-e','Certificado digital','Rejeição fiscal','Tributação','SAT/ECF/NFE','Farmácia Popular'],
  'Financeiro': ['Boleto','Segunda via','Cobrança','Negociação','Mensalidade','Inadimplência','Cancelamento financeiro'],
  'Comercial': ['Upgrade Plano Plus','Plano Pro','Novo módulo','Proposta enviada','Negociação em andamento','Cliente interessado em ferramenta'],
  'Implantação': ['Conversão de dados','Virada de sistema','Configuração inicial','Treinamento inicial','Migração'],
  'Treinamento': ['Dúvida de uso','Orientação de módulo','Reforço operacional'],
  'Cadastro': ['Alteração razão social','Alteração CNPJ','Atualização contatos','Alteração endereço','Alteração responsável'],
  'Integrações': ['Ifood','Imendes','PBM','Farmácia Popular','APIs','E-commerce'],
  'Cancelamento': ['Pedido cancelamento','Risco churn','Tentativa retenção'],
  'Ferramentas': ['Dashboard','Plano Pro','Plano Plus','Gerencial','Aplicativos adicionais']
};

const ClienteSchema = z.object({
  codigo: z.string().optional(),
  suporte: z.string().optional(),
  nome: z.string().min(1),
  razao_social: z.string().optional(),
  fantasia: z.string().optional(),
  email: z.string().email(),
  cnpj: z.string().optional(),
  grupo: z.string().optional(),
  ibge: z.string().optional(),
  inscricao: z.string().optional(),
  redes: z.array(z.string()).optional(),
  nfe: z.boolean().optional(),
  ecf: z.boolean().optional(),
  atencao_especial: z.boolean().optional(),
  matriz: z.boolean().optional(),
  observacao: z.string().optional(),
  observacao_grupo: z.string().optional(),
  ferramentas: z.array(z.string()).optional(),
  // Endereço
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  regiao: z.string().optional(),
  complemento: z.string().optional(),
  // Informações adicionais
  responsavel_nome: z.string().optional(),
  responsavel_celular: z.string().optional(),
  contador_nome: z.string().optional(),
  contador_celular: z.string().optional(),
  contador_telefone: z.string().optional(),
  contador_email: z.string().optional(),
  // Financeiro: mensalidade base + observações (acréscimos vêm das vendas adicionais)
  mensalidade_base: z.number().optional(),
  observacoes_fin: z.string().optional(),
  // Legados
  telefone: z.string().optional()
});

const ListClienteSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  search: z.string().optional()
});

const SolicitacaoSchema = z.object({
  contato_solicitante: z.string().optional(),
  contato_telefone: z.string().optional(),
  usuario_responsavel: z.string().optional(),
  tipo_servico: z.string().min(1),
  subtipo: z.string().optional(),
  prioridade: z.enum(['BAIXA','MEDIA','ALTA','URGENTE']).default('MEDIA'),
  status: z.enum(['ABERTA','EM_ATENDIMENTO','AGUARDANDO_CLIENTE','AGUARDANDO_SUPORTE_INTERNO','AGUARDANDO_FINANCEIRO','AGUARDANDO_COMERCIAL','FINALIZADA','CANCELADA','REABERTA']).default('ABERTA'),
  descricao: z.string().optional(),
  observacao_interna: z.string().optional(),
  data_finalizacao: z.string().datetime().optional()
});

const ImportClienteItemSchema = z.object({
  codigo: z.string().optional(),
  nome: z.string().optional(),          // se faltar, cai p/ razao_social/empresa
  email: z.string().email().optional().or(z.literal('')), // opcional: base nem sempre tem
  telefone: z.string().optional(),
  empresa: z.string().optional(),
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  situacao: z.string().optional(),
  segmento: z.string().optional(),
  grupo_tecnico: z.string().optional(),
  plano: z.string().optional(),
  contato: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional()
}).refine(
  (c) => !!(c.codigo || c.nome || c.razao_social || c.empresa || c.email),
  { message: 'Linha sem identificação (precisa de código, nome, razão social, empresa ou email)' }
);

const ImportClienteSchema = z.object({
  clientes: z.array(ImportClienteItemSchema).min(1).max(5000),
  modo: z.enum(['CRIAR','ATUALIZAR','UPSERT']).default('UPSERT')
});

export async function clientesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Metadados (ferramentas + tipos de serviço)
  fastify.get('/clientes/meta', async (request, reply) => {
    return reply.send({ status: 'success', data: { ferramentas: FERRAMENTAS_LISTA, tipos_servico: TIPOS_SERVICO } });
  });

  // Template CSV
  fastify.get('/clientes/template-csv', async (request, reply) => {
    const csv = 'codigo,nome,email,telefone,empresa,cidade,estado\n001,João Silva,joao@empresa.com,(11) 99999-9999,Empresa ABC,São Paulo,SP\n';
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="template_importacao_clientes.csv"');
    return reply.send('﻿' + csv);
  });

  // Importação em massa
  fastify.post('/clientes/importar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // importação só p/ Supervisão
    const body = ImportClienteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });

    const { clientes, modo } = body.data;
    let criados = 0, atualizados = 0;
    const erros: { linha: number; ref: string; motivo: string }[] = [];

    // Normaliza "situacao" textual da base (Ativa/Inativa) para o enum interno.
    const normSituacao = (s?: string) => {
      const v = (s || '').trim().toUpperCase();
      if (v.startsWith('INAT')) return 'INATIVA';
      if (v.startsWith('AT')) return 'ATIVA';
      return undefined;
    };

    for (let i = 0; i < clientes.length; i++) {
      const c = clientes[i];
      // Identificação humana p/ relatório de erro (código tem prioridade).
      const ref = c.codigo || c.razao_social || c.empresa || c.nome || c.email || `linha ${i + 1}`;
      try {
        // nome é NOT NULL no schema → deriva de fantasia/razão/empresa/email.
        const nome = c.nome || c.nome_fantasia || c.razao_social || c.empresa || c.email || `Cliente ${c.codigo || i + 1}`;
        const data: any = {
          nome,
          codigo:        c.codigo || undefined,
          email:         c.email || undefined,            // pode ficar nulo
          telefone:      c.telefone || undefined,
          empresa:       c.empresa || c.nome_fantasia || c.razao_social || undefined,
          razao_social:  c.razao_social || undefined,
          nome_fantasia: c.nome_fantasia || undefined,
          cnpj:          c.cnpj || undefined,
          situacao:      normSituacao(c.situacao),
          segmento:      c.segmento || undefined,
          grupo_tecnico: c.grupo_tecnico || undefined,
          plano:         c.plano || undefined,
          contato:       c.contato || undefined,
          cidade:        c.cidade || undefined,
          estado:        c.estado || undefined,
        };

        // Chave de upsert: código (preferido) → email (fallback). Sem nenhum dos
        // dois, só dá pra CRIAR (não há como casar duplicata).
        const whereKey = c.codigo ? { codigo: c.codigo } : (c.email ? { email: c.email } : null);

        if (modo === 'CRIAR' || !whereKey) {
          await prisma.cliente.create({ data }); criados++;
        } else if (modo === 'ATUALIZAR') {
          const ex = await prisma.cliente.findUnique({ where: whereKey as any });
          if (!ex) { erros.push({ linha: i + 1, ref, motivo: 'Não encontrado' } as any); continue; }
          await prisma.cliente.update({ where: whereKey as any, data }); atualizados++;
        } else {
          const ex = await prisma.cliente.findUnique({ where: whereKey as any });
          if (ex) { await prisma.cliente.update({ where: whereKey as any, data }); atualizados++; }
          else { await prisma.cliente.create({ data }); criados++; }
        }
      } catch (err: any) {
        erros.push({ linha: i + 1, ref, motivo: err.code === 'P2002' ? 'Duplicado (código/email já existe)' : err.message } as any);
      }
    }

    return reply.send({ status: 'success', data: { total: clientes.length, criados, atualizados, erros_total: erros.length, erros: erros.slice(0, 50) } });
  });

  // List clientes
  fastify.get('/clientes', async (request, reply) => {
    const query = ListClienteSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const { page, limit, search } = query.data;

    const where = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { fantasia: { contains: search, mode: 'insensitive' as const } },
        { razao_social: { contains: search, mode: 'insensitive' as const } },
        { empresa: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { codigo: { contains: search, mode: 'insensitive' as const } },
        { suporte: { contains: search, mode: 'insensitive' as const } },
        { cnpj: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({ where, skip: page * limit, take: limit, orderBy: { created_at: 'desc' }, include: { _count: { select: { caso_churn: true } } } }),
      prisma.cliente.count({ where })
    ]);

    return reply.send({ status: 'success', data: { clientes, total, page, limit } });
  });

  // Get cliente by id (full)
  fastify.get('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({ where: { id }, include: { _count: { select: { caso_churn: true } } } });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Load contacts and service requests via raw
    const contatos: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ContatoCliente WHERE cliente_id = ? ORDER BY created_at ASC`, id);
    const solicitacoes: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM SolicitacaoServico WHERE cliente_id = ? ORDER BY data_solicitacao DESC`, id);

    // Acréscimos na mensalidade vindos de vendas adicionais CONFIRMADAS (ex.: Arquivo Fiscal).
    const acrescimos = await prisma.vendaAdicional.findMany({
      where: { cliente_id: id, status: { in: ['CONFIRMADA', 'PAGA'] }, acrescimo_mensal: { gt: 0 } },
      select: {
        id: true, acrescimo_mensal: true, status: true, created_at: true,
        parceiro: { select: { nome: true, categoria: true } },
      },
      orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);

    const base = Number((cliente as any).mensalidade_base || 0);
    const totalAcrescimos = acrescimos.reduce((s: number, a: any) => s + Number(a.acrescimo_mensal || 0), 0);
    const mensalidade = {
      base,
      acrescimos: acrescimos.map((a: any) => ({
        id: a.id, valor: Number(a.acrescimo_mensal || 0),
        origem: a.parceiro?.nome || 'Serviço', categoria: a.parceiro?.categoria || '',
        status: a.status, data: a.created_at,
      })),
      total_acrescimos: Math.round(totalAcrescimos * 100) / 100,
      total: Math.round((base + totalAcrescimos) * 100) / 100,
    };

    return reply.send({ status: 'success', data: { ...cliente, contatos, solicitacoes, mensalidade } });
  });

  // Create cliente
  fastify.post('/clientes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // vendedor não cadastra cliente
    const body = ClienteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    try {
      const cliente = await prisma.cliente.create({ data: body.data as any });
      return reply.status(201).send({ status: 'success', data: cliente });
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ status: 'error', message: 'Email ou código já cadastrado' });
      throw err;
    }
  });

  // Update cliente
  fastify.patch('/clientes/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // vendedor não altera cadastro de cliente
    const { id } = request.params as { id: string };
    const body = ClienteSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const cliente = await prisma.cliente.update({ where: { id }, data: body.data as any });
      return reply.send({ status: 'success', data: cliente });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
      throw err;
    }
  });

  // Delete cliente
  fastify.delete('/clientes/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // vendedor não exclui cliente
    const { id } = request.params as { id: string };
    try {
      await prisma.cliente.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Cliente removido' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
      throw err;
    }
  });

  // ===== CONTATOS =====
  fastify.get('/clientes/:id/contatos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const contatos: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ContatoCliente WHERE cliente_id = ? ORDER BY created_at ASC`, id);
    return reply.send({ status: 'success', data: contatos });
  });

  fastify.post('/clientes/:id/contatos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ nome: z.string().min(1), telefone: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const newId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO ContatoCliente (id, cliente_id, nome, telefone) VALUES (?, ?, ?, ?)`,
      newId, id, body.data.nome, body.data.telefone || null
    );
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ContatoCliente WHERE id = ?`, newId);
    return reply.status(201).send({ status: 'success', data: rows[0] });
  });

  fastify.delete('/clientes/:id/contatos/:cid', async (request, reply) => {
    const { cid } = request.params as { id: string; cid: string };
    await prisma.$executeRawUnsafe(`DELETE FROM ContatoCliente WHERE id = ?`, cid);
    return reply.send({ status: 'success', message: 'Contato removido' });
  });

  // ===== SOLICITAÇÕES DE SERVIÇO =====
  fastify.get('/clientes/:id/solicitacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM SolicitacaoServico WHERE cliente_id = ? ORDER BY data_solicitacao DESC`, id);
    return reply.send({ status: 'success', data: rows });
  });

  fastify.post('/clientes/:id/solicitacoes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = SolicitacaoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });

    // Pega grupo e ferramentas do cliente
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    const user = (request as any).user;
    const grupoAtendimento = body.data.usuario_responsavel ? undefined : (cliente as any).grupo;
    const planoAtual = ((cliente as any).ferramentas || []).filter((f: string) => f.startsWith('Plano')).join(', ') || null;

    const newId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO SolicitacaoServico (
        id, cliente_id, contato_solicitante, contato_telefone, usuario_responsavel,
        grupo_atendimento, tipo_servico, subtipo, prioridade, status,
        descricao, observacao_interna, plano_atual, data_finalizacao, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      newId,
      id,
      body.data.contato_solicitante || null,
      body.data.contato_telefone || null,
      body.data.usuario_responsavel || user?.nome || null,
      (cliente as any).grupo || null,
      body.data.tipo_servico,
      body.data.subtipo || null,
      body.data.prioridade,
      body.data.status,
      body.data.descricao || null,
      body.data.observacao_interna || null,
      planoAtual,
      body.data.data_finalizacao ? new Date(body.data.data_finalizacao) : null,
      user?.nome || user?.id || 'sistema'
    );
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM SolicitacaoServico WHERE id = ?`, newId);

    return reply.status(201).send({ status: 'success', data: rows[0] });
  });

  fastify.patch('/clientes/:id/solicitacoes/:sid', async (request, reply) => {
    const { sid } = request.params as { id: string; sid: string };
    const body = SolicitacaoSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const updates: string[] = ['updated_at = NOW()'];
    const vals: any[] = [];

    const fields: (keyof typeof body.data)[] = ['contato_solicitante','contato_telefone','usuario_responsavel','tipo_servico','subtipo','prioridade','status','descricao','observacao_interna'];
    for (const f of fields) {
      if (body.data[f] !== undefined) { updates.push(`${f} = ?`); vals.push(body.data[f]); }
    }
    if (body.data.data_finalizacao !== undefined) { updates.push(`data_finalizacao = ?`); vals.push(new Date(body.data.data_finalizacao)); }
    if (body.data.status === 'FINALIZADA' && !body.data.data_finalizacao) { updates.push(`data_finalizacao = NOW()`); }

    vals.push(sid);
    await prisma.$executeRawUnsafe(`UPDATE SolicitacaoServico SET ${updates.join(', ')} WHERE id = ?`, ...vals);

    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM SolicitacaoServico WHERE id = ?`, sid);
    return reply.send({ status: 'success', data: rows[0] });
  });

  fastify.delete('/clientes/:id/solicitacoes/:sid', async (request, reply) => {
    const { sid } = request.params as { id: string; sid: string };
    await prisma.$executeRawUnsafe(`DELETE FROM SolicitacaoServico WHERE id = ?`, sid);
    return reply.send({ status: 'success', message: 'Solicitação removida' });
  });
}
