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
  nome_fantasia: z.string().optional(),
  fantasia: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  cnpj: z.string().optional(),
  // ── Base de clientes (gestão / edição manual) ──
  empresa: z.string().optional(),
  telefone_contato: z.string().optional(),
  contato: z.string().optional(),
  situacao: z.string().optional(),
  segmento: z.string().optional(),
  grupo_tecnico: z.string().optional(),
  plano: z.string().optional(),
  data_entrada: z.string().datetime().optional().or(z.literal('')),
  observacoes: z.string().optional(),
  // ── Campanha de ativos (perguntas/flags) ──
  apresentou_plus: z.boolean().optional(),
  conhece_dashboard: z.boolean().optional(),
  conhece_mensageria: z.boolean().optional(),
  conhece_gerencial: z.boolean().optional(),
  conhece_atencao_farma: z.boolean().optional(),
  risco_atencao: z.boolean().optional(),
  ativo_observacoes: z.string().optional(),
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
  limit: z.coerce.number().max(200).default(20),
  search: z.string().optional(),
  grupo_tecnico: z.string().optional(),
  situacao: z.string().optional(),
  segmento: z.string().optional(),
  plano: z.string().optional(),
  risco: z.coerce.boolean().optional(),
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

// Importação tolerante: TODOS os campos são string livre/opcional. Nenhum campo
// malformado (ex.: email inválido na base legada) pode derrubar a importação —
// a sanitização (validar email, derivar nome) é feita na lógica, não no schema.
const ImportClienteItemSchema = z.object({
  codigo: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().optional(),
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
  estado: z.string().optional(),
  // ── Colunas complementares (planilha legada) ──
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),        // nº do endereço
  numero_end: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  codigo_cidade_ibge: z.string().optional(),
  codigo_ibge: z.string().optional(),
  uf: z.string().optional(),            // alias de estado
  ddd: z.string().optional(),
  telefone1: z.string().optional(),
  telefone2: z.string().optional(),
  inscricao: z.string().optional(),
  e_mail: z.string().optional(),        // alias de email
  e_mail2: z.string().optional(),
  tel_contato: z.string().optional(),
  vencimento: z.string().optional(),
  mensalidade: z.string().optional(),
  cadastro: z.string().optional(),
  vencimento_licenca: z.string().optional(),
  reajuste: z.string().optional(),
  ultimo_pagto: z.string().optional(),
  previsao_pagto: z.string().optional(),
  regiao: z.string().optional(),
  instalacao: z.string().optional(),
  condicao_pagto: z.string().optional(),
  contato2: z.string().optional(),
  tel_contato2: z.string().optional(),
  contato_pesquisa: z.string().optional(),
  cpf: z.string().optional(),
  identidade: z.string().optional(),
  responsavel: z.string().optional(),
  comunicacao: z.string().optional(),
  regime: z.string().optional(),
  complemento_obs: z.string().optional(),
}).passthrough(); // ignora colunas extras em vez de rejeitar

const ImportClienteSchema = z.object({
  clientes: z.array(ImportClienteItemSchema).min(1).max(5000),
  // COMPLEMENTAR = só preenche campos vazios no cadastro (não sobrescreve o que já existe).
  modo: z.enum(['CRIAR','ATUALIZAR','UPSERT','COMPLEMENTAR']).default('UPSERT')
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
    // Texto → número (aceita "1.200", "98,54", "1200"); ignora vazio/"- -".
    const num = (s?: string) => {
      if (!s) return undefined;
      const t = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '').trim();
      if (!t) return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    const inteiro = (s?: string) => { const n = num(s); return n != null ? Math.round(n) : undefined; };
    // Data no formato da planilha "20-Jul-10" / "03-Sep-26" → Date; ignora "- -".
    const MESES: Record<string, number> = { jan:0,feb:1,fev:1,mar:2,apr:3,abr:3,may:4,mai:4,jun:5,jul:6,aug:7,ago:7,sep:8,set:8,oct:9,out:9,nov:10,dec:11,dez:11 };
    const parseData = (s?: string): Date | undefined => {
      if (!s) return undefined;
      const t = s.trim();
      if (!t || t === '- -' || t === '--') return undefined;
      const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
      if (!m) return undefined;
      const dia = parseInt(m[1], 10);
      const mes = MESES[m[2].toLowerCase()];
      if (mes === undefined) return undefined;
      let ano = parseInt(m[3], 10);
      if (ano < 100) ano += ano < 50 ? 2000 : 1900; // 26→2026, 99→1999
      const d = new Date(ano, mes, dia);
      return isNaN(d.getTime()) ? undefined : d;
    };
    const txt = (s?: string) => { const v = (s || '').trim(); return v ? v : undefined; };

    for (let i = 0; i < clientes.length; i++) {
      const c = clientes[i] as any;
      // Aliases da planilha → campos canônicos.
      const emailRaw = c.email || c.e_mail;
      const estadoRaw = c.estado || c.uf;
      const numeroRaw = c.numero_end || c.numero;
      const ibgeRaw = c.codigo_ibge || c.codigo_cidade_ibge;
      // Identificação humana p/ relatório de erro (código tem prioridade).
      const ref = c.codigo || c.razao_social || c.empresa || c.nome || emailRaw || `linha ${i + 1}`;
      // Pula linha totalmente vazia (sem qualquer identificação).
      if (!(c.codigo || c.nome || c.razao_social || c.empresa || emailRaw)) {
        erros.push({ linha: i + 1, ref, motivo: 'Linha vazia (sem identificação)' } as any);
        continue;
      }
      try {
        // nome é NOT NULL no schema → deriva de fantasia/razão/empresa/email.
        const nome = c.nome || c.nome_fantasia || c.razao_social || c.empresa || emailRaw || `Cliente ${c.codigo || i + 1}`;
        // Só grava email se tiver cara de email (a base legada tem muitos truncados).
        const emailValido = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw.trim()) ? emailRaw.trim() : undefined;
        // Observações: junta complemento_obs + comunicacao se vierem.
        const obs = [txt(c.complemento_obs), c.comunicacao ? `Comunicação: ${txt(c.comunicacao)}` : undefined].filter(Boolean).join(' | ') || undefined;

        const data: any = {
          nome,
          codigo:        txt(c.codigo),
          email:         emailValido,
          telefone:      txt(c.telefone) || txt(c.telefone1) || txt(c.tel_contato),
          empresa:       txt(c.empresa) || txt(c.nome_fantasia) || txt(c.razao_social),
          razao_social:  txt(c.razao_social),
          nome_fantasia: txt(c.nome_fantasia),
          cnpj:          txt(c.cnpj),
          situacao:      normSituacao(c.situacao),
          segmento:      txt(c.segmento),
          grupo_tecnico: txt(c.grupo_tecnico),
          plano:         txt(c.plano),
          contato:       txt(c.contato),
          cidade:        txt(c.cidade),
          estado:        txt(estadoRaw),
          // ── Complementares ──
          cep:            txt(c.cep),
          endereco:       txt(c.endereco),
          numero_end:     txt(numeroRaw),
          complemento:    txt(c.complemento),
          bairro:         txt(c.bairro),
          codigo_ibge:    txt(ibgeRaw),
          ddd:            txt(c.ddd),
          telefone1:      txt(c.telefone1),
          telefone2:      txt(c.telefone2),
          tel_contato:    txt(c.tel_contato),
          contato2:       txt(c.contato2),
          tel_contato2:   txt(c.tel_contato2),
          contato_pesquisa: txt(c.contato_pesquisa),
          inscricao_estadual: txt(c.inscricao),
          cpf_responsavel: txt(c.cpf),
          rg_responsavel:  txt(c.identidade),
          responsavel_nome: txt(c.responsavel),
          regime_tributario: txt(c.regime),
          dia_vencimento:  inteiro(c.vencimento),
          mensalidade_base: num(c.mensalidade),
          vencimento_licenca: parseData(c.vencimento_licenca),
          reajuste_em:     parseData(c.reajuste),
          ultimo_pagamento: parseData(c.ultimo_pagto),
          previsao_pagamento: txt(c.previsao_pagto),
          regiao:          txt(c.regiao),
          valor_instalacao: num(c.instalacao),
          condicao_pagamento: txt(c.condicao_pagto),
          data_cadastro:   parseData(c.cadastro),
          observacoes:     obs,
        };
        // Remove chaves undefined (não sobrescreve com vazio em nenhum modo).
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

        // Chave de dedupe: código (preferido) → email → CNPJ.
        const whereKey = c.codigo ? { codigo: c.codigo }
          : (emailValido ? { email: emailValido }
          : (txt(c.cnpj) ? { cnpj: txt(c.cnpj) } : null));
        const existente = whereKey ? await prisma.cliente.findFirst({ where: whereKey as any }) : null;

        if (modo === 'CRIAR' || !whereKey) {
          await prisma.cliente.create({ data }); criados++;
        } else if (modo === 'ATUALIZAR') {
          if (!existente) { erros.push({ linha: i + 1, ref, motivo: 'Não encontrado' } as any); continue; }
          await prisma.cliente.update({ where: { id: existente.id }, data }); atualizados++;
        } else if (modo === 'COMPLEMENTAR') {
          // Só preenche campos que estão VAZIOS no cadastro atual; nunca sobrescreve.
          if (!existente) { await prisma.cliente.create({ data }); criados++; continue; }
          const ex: any = existente;
          const soVazios: any = {};
          for (const k of Object.keys(data)) {
            if (k === 'nome') continue; // nome já existe; não troca
            const atual = ex[k];
            const vazio = atual === null || atual === undefined || atual === '';
            if (vazio) soVazios[k] = data[k];
          }
          if (Object.keys(soVazios).length > 0) {
            await prisma.cliente.update({ where: { id: existente.id }, data: soVazios }); atualizados++;
          }
        } else { // UPSERT
          if (existente) { await prisma.cliente.update({ where: { id: existente.id }, data }); atualizados++; }
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
    const { page, limit, search, grupo_tecnico, situacao, segmento, plano, risco } = query.data;

    const and: any[] = [];
    if (search) {
      and.push({
        OR: [
          { nome: { contains: search } },
          { nome_fantasia: { contains: search } },
          { razao_social: { contains: search } },
          { empresa: { contains: search } },
          { email: { contains: search } },
          { codigo: { contains: search } },
          { cnpj: { contains: search } },
        ],
      });
    }
    if (grupo_tecnico) and.push({ grupo_tecnico });
    if (situacao)      and.push({ situacao });
    if (segmento)      and.push({ segmento });
    if (plano)         and.push({ plano });
    if (risco)         and.push({ risco_atencao: true });
    const where = and.length ? { AND: and } : {};

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({ where, skip: page * limit, take: limit, orderBy: [{ situacao: 'asc' }, { razao_social: 'asc' }, { created_at: 'desc' }], include: { _count: { select: { caso_churn: true } } } }),
      prisma.cliente.count({ where })
    ]);

    // Opções de filtro (distintas) p/ alimentar os selects do front.
    const [grupos, segmentos, planos] = await Promise.all([
      prisma.cliente.findMany({ where: { grupo_tecnico: { not: null } }, distinct: ['grupo_tecnico'], select: { grupo_tecnico: true }, take: 200 }),
      prisma.cliente.findMany({ where: { segmento: { not: null } }, distinct: ['segmento'], select: { segmento: true }, take: 200 }),
      prisma.cliente.findMany({ where: { plano: { not: null } }, distinct: ['plano'], select: { plano: true }, take: 100 }),
    ]);
    const opcoes = {
      grupos_tecnicos: grupos.map(g => g.grupo_tecnico).filter(Boolean),
      segmentos: segmentos.map(s => s.segmento).filter(Boolean),
      planos: planos.map(p => p.plano).filter(Boolean),
    };

    return reply.send({ status: 'success', data: { clientes, total, page, limit, opcoes } });
  });

  // Get cliente by id (full)
  fastify.get('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({ where: { id }, include: { _count: { select: { caso_churn: true } } } });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Load contacts and service requests via raw (tabelas podem não existir em
    // bases novas/importadas → catch p/ não quebrar a abertura da ficha).
    const contatos: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM ContatoCliente WHERE cliente_id = ? ORDER BY created_at ASC`, id).catch(() => []) as any[];
    const solicitacoes: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM SolicitacaoServico WHERE cliente_id = ? ORDER BY data_solicitacao DESC`, id).catch(() => []) as any[];

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

  // Desativar cliente (churn) — registra motivo detalhado + MRR perdido.
  fastify.post('/clientes/:id/desativar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      motivo: z.string().min(3),
      mrr_perdido: z.coerce.number().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o motivo detalhado da desativação.' });

    const cli = await prisma.cliente.findUnique({ where: { id }, select: { mensalidade_base: true } });
    // MRR perdido = informado, ou a mensalidade base do cliente.
    const mrrPerdido = body.data.mrr_perdido ?? Number(cli?.mensalidade_base || 0);

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        situacao: 'INATIVA',
        motivo_inativacao: body.data.motivo,
        inativado_em: new Date(),
        mrr_perdido: mrrPerdido,
        risco_atencao: false,
      },
    }).catch(() => null);
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Lança o MRR perdido como SAÍDA recorrente (churn) no centro de custos do mês.
    if (mrrPerdido > 0) {
      const agora = new Date();
      await prisma.lancamentoFinanceiro.create({
        data: {
          tipo: 'SAIDA', categoria: 'OUTRO_CUSTO', recorrencia: 'EXTRAORDINARIO',
          descricao: `Churn — ${body.data.motivo.slice(0, 100)}`, valor: mrrPerdido,
          competencia_ano: agora.getFullYear(), competencia_mes: agora.getMonth() + 1,
          observacoes: `MRR perdido pela desativação do cliente. Motivo: ${body.data.motivo}`,
          cliente_id: id, created_by: (request as any).user?.id || 'system',
        },
      }).catch(() => {});
    }
    return reply.send({ status: 'success', data: cliente });
  });

  // Reativar cliente.
  fastify.post('/clientes/:id/reativar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.update({
      where: { id }, data: { situacao: 'ATIVA', motivo_inativacao: null, inativado_em: null, mrr_perdido: null },
    }).catch(() => null);
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
    return reply.send({ status: 'success', data: cliente });
  });

  // Update cliente
  fastify.patch('/clientes/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // vendedor não altera cadastro de cliente
    const { id } = request.params as { id: string };
    const body = ClienteSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      // Só repassa ao Prisma os campos que EXISTEM no model Cliente (evita erro
      // de coluna inexistente vindo dos campos legados do schema de validação).
      const b = body.data as any;
      const data: any = {};
      const campos = [
        'nome', 'codigo', 'email', 'telefone', 'empresa', 'razao_social', 'nome_fantasia',
        'cnpj', 'situacao', 'segmento', 'grupo_tecnico', 'plano', 'contato', 'observacoes',
        'cidade', 'estado', 'mensalidade_base', 'observacoes_fin',
        'apresentou_plus', 'conhece_dashboard', 'conhece_mensageria', 'conhece_gerencial',
        'conhece_atencao_farma', 'risco_atencao', 'ativo_observacoes',
      ];
      for (const k of campos) if (b[k] !== undefined && b[k] !== '') data[k] = b[k];
      if (b.telefone_contato && !data.telefone) data.telefone = b.telefone_contato;
      if (b.data_entrada) data.data_entrada = new Date(b.data_entrada);
      const cliente = await prisma.cliente.update({ where: { id }, data });
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
