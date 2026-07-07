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
  numero_end: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  regiao: z.string().optional(),
  complemento: z.string().optional(),
  codigo_ibge: z.string().optional(),
  // Contato/fiscais complementares
  ddd: z.string().optional(),
  telefone1: z.string().optional(),
  telefone2: z.string().optional(),
  tel_contato: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  rg_responsavel: z.string().optional(),
  regime_tributario: z.string().optional(),
  dia_vencimento: z.coerce.number().optional(),
  valor_instalacao: z.coerce.number().optional(),
  condicao_pagamento: z.string().optional(),
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

  // Registra um evento na timeline de monitoramento do cliente. Tudo que for
  // associado ao cliente (serviço, churn, renegociação, troca de CNPJ, etc.)
  // passa por aqui p/ ficar salvo e auditável. Nunca lança (não bloqueia o fluxo).
  const registrarEvento = async (
    clienteId: string,
    tipo: string,
    titulo: string,
    extras?: { descricao?: string; referencia_id?: string; metadados?: any; user?: any },
  ) => {
    try {
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: clienteId, tipo, titulo,
          descricao: extras?.descricao,
          referencia_id: extras?.referencia_id,
          metadados: extras?.metadados ?? undefined,
          feito_por: extras?.user?.id,
          feito_por_nome: extras?.user?.nome,
        },
      });
    } catch (e: any) { console.warn('[EventoCliente] não registrado:', e?.message); }
  };

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
    // Converte texto p/ número aceitando os dois formatos das planilhas:
    //  - convertida (Excel/Pandas): ponto é decimal → "347.0"=347, "98.54"=98.54
    //  - legada (BR): vírgula é decimal e ponto é milhar → "1.200,00"=1200, "98,54"
    const num = (s?: string) => {
      if (!s) return undefined;
      let v = String(s).trim().replace(/[^0-9.,-]/g, ''); // só dígitos, . , -
      if (!v) return undefined;
      const temVirgula = v.includes(',');
      if (temVirgula) {
        // BR: ponto é milhar, vírgula é decimal → "1.200,50" → "1200.50"
        v = v.replace(/\./g, '').replace(',', '.');
      } else {
        // Só ponto presente. Se houver vários pontos, o último é decimal e os
        // demais são milhar ("1.200" sem decimal → 1200). Com 1 ponto, é decimal
        // ("347.0"→347, "98.54"→98.54).
        const partes = v.split('.');
        if (partes.length > 2) v = partes.slice(0, -1).join('') + '.' + partes[partes.length - 1];
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const inteiro = (s?: string) => { const n = num(s); return n != null ? Math.round(n) : undefined; };
    // Data no formato da planilha "20-Jul-10" / "03-Sep-26" → Date; ignora "- -".
    const MESES: Record<string, number> = { jan:0,feb:1,fev:1,mar:2,apr:3,abr:3,may:4,mai:4,jun:5,jul:6,aug:7,ago:7,sep:8,set:8,oct:9,out:9,nov:10,dec:11,dez:11 };
    const parseData = (s?: string): Date | undefined => {
      if (!s) return undefined;
      let t = s.trim();
      if (!t || t === '- -' || t === '--') return undefined;
      // Formato ISO "2010-07-20" ou "2010-07-20 00:00:00" (planilha convertida).
      const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        return isNaN(d.getTime()) ? undefined : d;
      }
      // Formato antigo "20-Jul-10" / "03-Sep-26".
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
    // Texto que pode vir como "381.0" / "29280000.0" (planilha convertida do
    // Excel/Pandas) → remove o ".0" final p/ código, CEP, telefones, etc.
    const txtId = (s?: string) => {
      let v = (s || '').trim();
      if (!v) return undefined;
      v = v.replace(/\.0+$/, ''); // "381.0" → "381"
      return v || undefined;
    };
    // Inteiro a partir de texto "15.0" / "5" → 15 / 5.
    const inteiroId = (s?: string) => {
      const v = txtId(s);
      if (!v) return undefined;
      const n = parseInt(v.replace(/[^0-9-]/g, ''), 10);
      return Number.isFinite(n) ? n : undefined;
    };

    // OTIMIZAÇÃO: carrega TODOS os clientes existentes UMA vez (mapas por chave),
    // em vez de um findFirst por linha. Corta milhares de idas ao banco → evita
    // a lentidão/timeout em planilhas grandes. Os mapas são atualizados conforme
    // criamos novos, p/ dedupe funcionar dentro do mesmo lote também.
    const existentes = await prisma.cliente.findMany({
      select: { id: true, codigo: true, email: true, cnpj: true },
    });
    const porCodigo = new Map<string, string>();
    const porEmail = new Map<string, string>();
    const porCnpj = new Map<string, string>();
    for (const e of existentes) {
      if (e.codigo) porCodigo.set(e.codigo, e.id);
      if (e.email) porEmail.set(e.email.toLowerCase(), e.id);
      if (e.cnpj) porCnpj.set(e.cnpj, e.id);
    }

    for (let i = 0; i < clientes.length; i++) {
      const c = clientes[i] as any;
      // Aliases da planilha → campos canônicos. txtId remove ".0" do Excel.
      const codigoRaw = txtId(c.codigo);
      const emailRaw = c.email || c.e_mail;
      const estadoRaw = c.estado || c.uf;
      const numeroRaw = txtId(c.numero_end) || txtId(c.numero);
      const ibgeRaw = txtId(c.codigo_ibge) || txtId(c.codigo_cidade_ibge);
      // Identificação humana p/ relatório de erro (código tem prioridade).
      const ref = codigoRaw || c.razao_social || c.empresa || c.nome || emailRaw || `linha ${i + 1}`;
      // Pula linha totalmente vazia (sem qualquer identificação).
      if (!(codigoRaw || c.nome || c.razao_social || c.empresa || emailRaw)) {
        erros.push({ linha: i + 1, ref, motivo: 'Linha vazia (sem identificação)' } as any);
        continue;
      }
      try {
        // nome é NOT NULL no schema → deriva de fantasia/razão/empresa/email.
        const nome = c.nome || c.nome_fantasia || c.razao_social || c.empresa || emailRaw || `Cliente ${codigoRaw || i + 1}`;
        // Só grava email se tiver cara de email (a base legada tem muitos truncados).
        const emailValido = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw.trim()) ? emailRaw.trim() : undefined;
        // Observações: junta complemento_obs + comunicacao se vierem.
        const obs = [txt(c.complemento_obs), c.comunicacao ? `Comunicação: ${txt(c.comunicacao)}` : undefined].filter(Boolean).join(' | ') || undefined;

        const data: any = {
          nome,
          codigo:        codigoRaw,
          email:         emailValido,
          telefone:      txtId(c.telefone) || txtId(c.telefone1) || txtId(c.tel_contato),
          empresa:       txt(c.empresa) || txt(c.nome_fantasia) || txt(c.razao_social),
          razao_social:  txt(c.razao_social),
          nome_fantasia: txt(c.nome_fantasia),
          cnpj:          txtId(c.cnpj),
          // Esta planilha contém SÓ os clientes ATIVOS → marca ATIVA (cai p/ o que vier na coluna situacao, se houver).
          situacao:      normSituacao(c.situacao) || 'ATIVA',
          segmento:      txt(c.segmento),
          grupo_tecnico: txt(c.grupo_tecnico),
          plano:         txt(c.plano),
          contato:       txt(c.contato),
          cidade:        txt(c.cidade),
          estado:        txt(estadoRaw),
          // ── Complementares ──
          cep:            txtId(c.cep),
          endereco:       txt(c.endereco),
          numero_end:     numeroRaw,
          complemento:    txt(c.complemento),
          bairro:         txt(c.bairro),
          codigo_ibge:    ibgeRaw,
          ddd:            txtId(c.ddd),
          telefone1:      txtId(c.telefone1),
          telefone2:      txtId(c.telefone2),
          tel_contato:    txtId(c.tel_contato),
          contato2:       txt(c.contato2),
          tel_contato2:   txtId(c.tel_contato2),
          contato_pesquisa: txt(c.contato_pesquisa),
          inscricao_estadual: txt(c.inscricao),
          cpf_responsavel: txtId(c.cpf),
          rg_responsavel:  txt(c.identidade),
          responsavel_nome: txt(c.responsavel),
          regime_tributario: txt(c.regime),
          dia_vencimento:  inteiroId(c.vencimento),
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

        // Chave de dedupe: código (preferido) → email → CNPJ — via mapas (sem query).
        const cnpjKey = txtId(c.cnpj);
        const existenteId = codigoRaw ? porCodigo.get(codigoRaw)
          : (emailValido ? porEmail.get(emailValido.toLowerCase())
          : (cnpjKey ? porCnpj.get(cnpjKey) : undefined));
        const temChave = !!(codigoRaw || emailValido || cnpjKey);

        // Registra um cliente recém-criado nos mapas (dedupe dentro do lote).
        const registrar = (id: string) => {
          if (codigoRaw) porCodigo.set(codigoRaw, id);
          if (emailValido) porEmail.set(emailValido.toLowerCase(), id);
          if (cnpjKey) porCnpj.set(cnpjKey, id);
        };

        if (modo === 'CRIAR' || !temChave) {
          const novo = await prisma.cliente.create({ data, select: { id: true } }); criados++; registrar(novo.id);
        } else if (modo === 'ATUALIZAR') {
          if (!existenteId) { erros.push({ linha: i + 1, ref, motivo: 'Não encontrado' } as any); continue; }
          await prisma.cliente.update({ where: { id: existenteId }, data }); atualizados++;
        } else if (modo === 'COMPLEMENTAR') {
          if (!existenteId) { const novo = await prisma.cliente.create({ data, select: { id: true } }); criados++; registrar(novo.id); continue; }
          const ex: any = await prisma.cliente.findUnique({ where: { id: existenteId } });
          const soVazios: any = {};
          for (const k of Object.keys(data)) {
            if (k === 'nome') continue;
            const atual = ex?.[k];
            if (atual === null || atual === undefined || atual === '') soVazios[k] = data[k];
          }
          if (Object.keys(soVazios).length > 0) { await prisma.cliente.update({ where: { id: existenteId }, data: soVazios }); atualizados++; }
        } else { // UPSERT
          if (existenteId) { await prisma.cliente.update({ where: { id: existenteId }, data }); atualizados++; }
          else { const novo = await prisma.cliente.create({ data, select: { id: true } }); criados++; registrar(novo.id); }
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

    const total = await prisma.cliente.count({ where });

    // Ordena por CÓDIGO NUMÉRICO (menor → maior). codigo é texto; CAST p/ UNSIGNED
    // ordena "1, 41, 381, 1787…" corretamente. Os MESMOS filtros são aplicados no
    // SQL (parâmetros escapados) p/ a paginação numérica bater com o total.
    const cond: string[] = [];
    const params: any[] = [];
    if (search) {
      cond.push('(nome LIKE ? OR nome_fantasia LIKE ? OR razao_social LIKE ? OR empresa LIKE ? OR email LIKE ? OR codigo LIKE ? OR cnpj LIKE ?)');
      const s = `%${search}%`; params.push(s, s, s, s, s, s, s);
    }
    if (grupo_tecnico) { cond.push('grupo_tecnico = ?'); params.push(grupo_tecnico); }
    if (situacao)      { cond.push('situacao = ?');      params.push(situacao); }
    if (segmento)      { cond.push('segmento = ?');      params.push(segmento); }
    if (plano)         { cond.push('plano = ?');         params.push(plano); }
    if (risco)         { cond.push('risco_atencao = 1'); }
    const whereSql = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    let clientes: any[];
    const idsRaw: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM Cliente ${whereSql}
       ORDER BY (codigo IS NULL OR codigo = '') ASC, CAST(codigo AS UNSIGNED) ASC, codigo ASC
       LIMIT ? OFFSET ?`,
      ...params, limit, page * limit,
    ).catch(() => null);
    if (idsRaw) {
      const ids = idsRaw.map(r => r.id);
      if (ids.length === 0) {
        clientes = [];
      } else {
        const lista = await prisma.cliente.findMany({ where: { id: { in: ids } }, include: { _count: { select: { caso_churn: true } } } });
        const ordem = new Map(ids.map((id, i) => [id, i] as const));
        clientes = lista.sort((a, b) => (ordem.get(a.id)! - ordem.get(b.id)!));
      }
    } else {
      // Fallback (se o raw falhar): ordena por código via Prisma.
      clientes = await prisma.cliente.findMany({ where, skip: page * limit, take: limit, orderBy: [{ codigo: 'asc' }, { razao_social: 'asc' }], include: { _count: { select: { caso_churn: true } } } });
    }

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

  // Lista LEVE dos grupos técnicos já existentes (p/ dropdowns, ex.: gerar cadastro).
  // Rota estática ANTES de /clientes/:id para não ser capturada pela dinâmica.
  fastify.get('/clientes/grupos-tecnicos', async (_request, reply) => {
    const grupos = await prisma.cliente.findMany({
      where: { grupo_tecnico: { not: null } },
      distinct: ['grupo_tecnico'],
      select: { grupo_tecnico: true },
      orderBy: { grupo_tecnico: 'asc' },
      take: 300,
    }).catch(() => [] as any[]);
    const lista = grupos.map(g => g.grupo_tecnico).filter(Boolean) as string[];
    return reply.send({ status: 'success', data: lista });
  });

  // Get cliente by id (full)
  fastify.get('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({ where: { id }, include: { _count: { select: { caso_churn: true } } } });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Load contacts and service requests via raw (tabelas podem não existir em
    // bases novas/importadas → catch p/ não quebrar a abertura da ficha).
    const contatos: any[] = await (prisma as any).contatoCliente.findMany({
      where: { cliente_id: id }, orderBy: [{ principal: 'desc' }, { created_at: 'asc' }],
    }).catch(() => []);
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

    // Renegociações (acordos por dificuldade financeira) deste cliente — exibidas
    // de forma organizada na ficha. Inclui o resumo já montado p/ o front.
    const renegociacoes = await prisma.casoChurn.findMany({
      where: { clienteId: id, reneg_ativa: true },
      orderBy: { reneg_data: 'desc' },
      select: {
        id: true, reneg_data: true, reneg_valor_devido: true, reneg_valor_entrada: true,
        reneg_parcelas: true, reneg_responsavel: true, reneg_responsavel_cpf: true,
        reneg_proximo_vencimento: true, reneg_como_mantido: true, reneg_resultado: true,
        motivo_principal: true, status: true,
      },
    }).catch(() => [] as any[]);
    const renegs = renegociacoes.map((r: any) => {
      const devido = Number(r.reneg_valor_devido || 0);
      const entrada = Number(r.reneg_valor_entrada || 0);
      const parcelas = Number(r.reneg_parcelas || 0);
      const saldo = Math.max(0, devido - entrada);
      const valor_parcela = parcelas > 0 ? Math.round((saldo / parcelas) * 100) / 100 : 0;
      return {
        ...r,
        valor_parcela,
        // Resumo pronto: como fica a mensalidade (do cadastro) + o acordo do débito.
        resumo: {
          mensalidade_atual: mensalidade.total,         // mensalidade vigente do cadastro
          valor_devido: devido,
          entrada,
          parcelas,
          valor_parcela,
          proximo_vencimento: r.reneg_proximo_vencimento,
        },
      };
    });

    // Timeline de monitoramento (tudo que foi registrado no cliente) + histórico
    // de trocas de CNPJ. Catch p/ não quebrar a ficha em bases sem as tabelas.
    const eventos = await (prisma as any).eventoCliente.findMany({
      where: { cliente_id: id }, orderBy: { created_at: 'desc' }, take: 200,
    }).catch(() => [] as any[]);
    const historico_cnpj = await (prisma as any).historicoCnpjCliente.findMany({
      where: { cliente_id: id }, orderBy: { created_at: 'desc' },
    }).catch(() => [] as any[]);

    // Saúde do cliente (estrelas) — vinda da análise do módulo Ativos (HealthScore).
    const hs = await prisma.healthScore.findUnique({ where: { cliente_id: id } }).catch(() => null);
    let saude = null as any;
    if (hs) {
      const score = Number(hs.score || 0);
      const estrelas = score >= 85 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;
      const rotulo = { EXCELENTE: 'Muito satisfeito', SAUDAVEL: 'Satisfeito', ATENCAO: 'Atenção', RISCO: 'Em risco', CRITICO: 'Crítico' }[hs.nivel as string] || hs.nivel;
      saude = { nivel: hs.nivel, score, estrelas, rotulo, atualizado_em: hs.calculado_at, fatores: hs.fatores };
    }

    return reply.send({ status: 'success', data: { ...cliente, contatos, solicitacoes, mensalidade, renegociacoes: renegs, eventos, historico_cnpj, saude } });
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
    await registrarEvento(id, 'DESATIVACAO', 'Cliente desativado (churn)', {
      descricao: body.data.motivo, metadados: { mrr_perdido: mrrPerdido }, user: (request as any).user,
    });
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
    await registrarEvento(id, 'REATIVACAO', 'Cliente reativado', { user: (request as any).user });
    return reply.send({ status: 'success', data: cliente });
  });

  // Trocar CNPJ do cliente (mantém o MESMO código). Guarda o snapshot dos dados
  // ANTIGOS no histórico de trocas e atualiza o cadastro com os novos dados.
  fastify.post('/clientes/:id/trocar-cnpj', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      cnpj_novo:          z.string().min(1, 'Informe o novo CNPJ'),
      razao_social_nova:  z.string().optional(),
      nome_fantasia_nova: z.string().optional(),
      inscricao_nova:     z.string().optional(),
      motivo:             z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o novo CNPJ.' });

    const atual = await prisma.cliente.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    const user = (request as any).user;
    const b = body.data;
    try {
      // 1) Snapshot dos dados ANTIGOS no histórico (nada se perde).
      await (prisma as any).historicoCnpjCliente.create({
        data: {
          cliente_id: id,
          cnpj_anterior:         atual.cnpj,
          razao_social_anterior: atual.razao_social,
          nome_fantasia_anterior: atual.nome_fantasia,
          inscricao_anterior:    atual.inscricao_estadual,
          cnpj_novo:         b.cnpj_novo,
          razao_social_nova: b.razao_social_nova ?? atual.razao_social,
          nome_fantasia_nova: b.nome_fantasia_nova ?? atual.nome_fantasia,
          motivo:        b.motivo,
          trocado_por:      user?.id,
          trocado_por_nome: user?.nome,
        },
      });

      // 2) Atualiza o cadastro com os novos dados (mantém o código).
      const cliente = await prisma.cliente.update({
        where: { id },
        data: {
          cnpj: b.cnpj_novo,
          ...(b.razao_social_nova ? { razao_social: b.razao_social_nova } : {}),
          ...(b.nome_fantasia_nova ? { nome_fantasia: b.nome_fantasia_nova } : {}),
          ...(b.inscricao_nova ? { inscricao_estadual: b.inscricao_nova } : {}),
        },
      });

      // 3) Evento na timeline de monitoramento.
      await registrarEvento(id, 'TROCA_CNPJ', `CNPJ alterado de ${atual.cnpj || '(vazio)'} para ${b.cnpj_novo}`, {
        descricao: b.motivo,
        metadados: { cnpj_anterior: atual.cnpj, cnpj_novo: b.cnpj_novo, razao_anterior: atual.razao_social, razao_nova: b.razao_social_nova },
        user,
      });

      return reply.send({ status: 'success', data: cliente, message: 'CNPJ trocado. Dados antigos guardados no histórico.' });
    } catch (err: any) {
      console.error('[POST /clientes/:id/trocar-cnpj]', err);
      return reply.status(500).send({ status: 'error', message: 'Erro ao trocar o CNPJ' });
    }
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
        // Endereço + complementares (existem no model Cliente)
        'cep', 'endereco', 'numero_end', 'complemento', 'bairro', 'codigo_ibge', 'regiao',
        'ddd', 'telefone1', 'telefone2', 'tel_contato', 'contato2', 'tel_contato2', 'contato_pesquisa',
        'inscricao_estadual', 'cpf_responsavel', 'rg_responsavel', 'responsavel_nome',
        'regime_tributario', 'dia_vencimento', 'valor_instalacao', 'condicao_pagamento',
        'previsao_pagamento',
      ];
      for (const k of campos) if (b[k] !== undefined && b[k] !== '') data[k] = b[k];
      // A ficha manda "numero" (UI) → grava em numero_end (coluna do banco).
      if (b.numero_end === undefined && b.numero) data.numero_end = b.numero;
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

  // ===== ZERAR BASE DE CLIENTES (apaga só os dados; estrutura/campos ficam) =====
  // Só CEO. Exige confirmação "ZERAR" no body. Apaga clientes + dependências
  // ligadas a eles, em ordem segura (FK), pra não dar erro de chave estrangeira.
  fastify.post('/clientes/zerar-base', async (request, reply) => {
    const user = (request as any).user;
    const role = (user?.role || '').toUpperCase();
    if (!user || !(role === 'CEO' || role === 'ADMIN' || role === 'DIRETOR')) {
      return reply.status(403).send({ status: 'error', message: 'Apenas o CEO pode zerar a base de clientes.' });
    }
    const body = z.object({ confirmacao: z.string() }).safeParse(request.body);
    if (!body.success || body.data.confirmacao !== 'ZERAR') {
      return reply.status(400).send({ status: 'error', message: 'Digite ZERAR para confirmar.' });
    }
    try {
      const total = await prisma.cliente.count();
      // Apaga dependências que referenciam Cliente, na ordem certa. Cada uma em
      // try próprio (tabela pode não existir em algum ambiente) p/ nunca travar.
      const limpar = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* ignora */ } };
      await limpar(() => prisma.$executeRawUnsafe(`DELETE FROM ContatoCliente`));
      await limpar(() => prisma.$executeRawUnsafe(`DELETE FROM SolicitacaoServico`));
      await limpar(() => (prisma as any).healthScore?.deleteMany?.({}));
      await limpar(() => (prisma as any).ticketSuporte?.deleteMany?.({}));
      await limpar(() => (prisma as any).licenca?.deleteMany?.({}));
      await limpar(() => (prisma as any).credito?.deleteMany?.({}));
      await limpar(() => (prisma as any).campanhaDisparo?.deleteMany?.({}));
      await limpar(() => (prisma as any).vendaAdicional?.deleteMany?.({}));
      await limpar(() => (prisma as any).surveyChurn?.deleteMany?.({}));
      await limpar(() => (prisma as any).casoChurn?.deleteMany?.({}));
      // Por fim, os clientes (o restante cai por onDelete: Cascade).
      const r = await prisma.cliente.deleteMany({});
      return reply.send({ status: 'success', data: { apagados: r.count, antes: total }, message: `Base zerada: ${r.count} clientes removidos.` });
    } catch (err: any) {
      console.error('[POST /clientes/zerar-base]', err?.message);
      return reply.status(500).send({ status: 'error', message: 'Erro ao zerar a base: ' + (err?.message || 'desconhecido') });
    }
  });

  // ===== LIMPAR CLIENTES INVÁLIDOS (lixo de importação) =====
  // Apaga os clientes cujo código NÃO é puramente numérico — ex.: códigos que
  // viraram texto de observação ("* CONTADORA...", "INSTALACAO R$ 450",
  // "MENSALIDADE: R$ 150"). Códigos válidos são só dígitos (1, 41, 381…).
  // Sem ?confirmar=1 só CONTA (pré-visualização); com confirmar=1 apaga. Só gestão.
  fastify.post('/clientes/limpar-invalidos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const confirmar = (request.query as any)?.confirmar === '1';
    try {
      // Inválido = código nulo/vazio OU contém algo que não seja dígito.
      const cond = `codigo IS NULL OR codigo = '' OR codigo REGEXP '[^0-9]'`;
      const cntRows: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM Cliente WHERE ${cond}`);
      const qtd = Number(cntRows?.[0]?.n || 0);

      // Amostra (até 20) p/ a pré-visualização.
      const amostra: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, codigo, COALESCE(razao_social, nome_fantasia, nome) AS nome, situacao FROM Cliente WHERE ${cond} LIMIT 20`
      ).catch(() => []);

      if (!confirmar) {
        return reply.send({ status: 'success', data: { invalidos: qtd, amostra }, message: `${qtd} cliente(s) com código inválido encontrados.` });
      }

      // Apaga via Prisma (cascade) os ids inválidos, em lotes.
      const ids: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM Cliente WHERE ${cond}`).catch(() => []);
      const lista = ids.map(r => r.id);
      let apagados = 0;
      for (let i = 0; i < lista.length; i += 200) {
        const lote = lista.slice(i, i + 200);
        const r = await prisma.cliente.deleteMany({ where: { id: { in: lote } } }).catch(() => ({ count: 0 }));
        apagados += r.count;
      }
      return reply.send({ status: 'success', data: { apagados }, message: `${apagados} cliente(s) inválido(s) removido(s).` });
    } catch (err: any) {
      console.error('[POST /clientes/limpar-invalidos]', err?.message);
      return reply.status(500).send({ status: 'error', message: 'Erro ao limpar: ' + (err?.message || 'desconhecido') });
    }
  });

  // ===== CONTATOS ===== (model Prisma; inclui cargo/email/origem)
  fastify.get('/clientes/:id/contatos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const contatos = await (prisma as any).contatoCliente.findMany({
      where: { cliente_id: id }, orderBy: [{ principal: 'desc' }, { created_at: 'asc' }],
    }).catch(() => []);
    return reply.send({ status: 'success', data: contatos });
  });

  fastify.post('/clientes/:id/contatos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().min(1), telefone: z.string().optional(),
      cargo: z.string().optional(), email: z.string().optional(),
      principal: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const contato = await (prisma as any).contatoCliente.create({
      data: {
        cliente_id: id, nome: body.data.nome, telefone: body.data.telefone || null,
        cargo: body.data.cargo || null, email: body.data.email || null,
        origem: 'MANUAL', principal: body.data.principal ?? false,
      },
    });
    await registrarEvento(id, 'OBSERVACAO', `Contato adicionado: ${body.data.nome}${body.data.cargo ? ' (' + body.data.cargo + ')' : ''}`, { user: (request as any).user });
    return reply.status(201).send({ status: 'success', data: contato });
  });

  // Editar contato (nome/telefone/cargo/email/principal)
  fastify.patch('/clientes/:id/contatos/:cid', async (request, reply) => {
    const { cid } = request.params as { id: string; cid: string };
    const body = z.object({
      nome: z.string().optional(), telefone: z.string().optional(),
      cargo: z.string().optional(), email: z.string().optional(), principal: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const contato = await (prisma as any).contatoCliente.update({ where: { id: cid }, data: body.data }).catch(() => null);
    if (!contato) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    return reply.send({ status: 'success', data: contato });
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

    await registrarEvento(id, 'SERVICO', `Solicitação: ${body.data.tipo_servico}${body.data.subtipo ? ' — ' + body.data.subtipo : ''}`, {
      descricao: body.data.descricao, referencia_id: newId,
      metadados: { prioridade: body.data.prioridade, status: body.data.status }, user,
    });

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

  // ===== ROTA GLOBAL DE DEMANDAS TÉCNICAS =====
  // Retorna todas as SolicitacaoServico com dados do cliente, paginadas e filtradas.
  fastify.get('/solicitacoes', async (request, reply) => {
    const q = request.query as any;
    const conditions: string[] = [];
    const vals: any[] = [];

    if (q.status)       { conditions.push('s.status = ?');       vals.push(q.status); }
    if (q.tipo_servico) { conditions.push('s.tipo_servico = ?'); vals.push(q.tipo_servico); }
    if (q.prioridade)   { conditions.push('s.prioridade = ?');   vals.push(q.prioridade); }
    if (q.responsavel)  { conditions.push('s.usuario_responsavel LIKE ?'); vals.push(`%${q.responsavel}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page  = Math.max(0, parseInt(q.page || '0'));
    const limit = Math.min(100, parseInt(q.limit || '50'));

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT s.*, c.nome AS cliente_nome, c.empresa AS cliente_empresa, c.cnpj AS cliente_cnpj
       FROM SolicitacaoServico s
       LEFT JOIN Cliente c ON c.id = s.cliente_id
       ${where}
       ORDER BY
         CASE s.prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END,
         s.data_solicitacao DESC
       LIMIT ? OFFSET ?`,
      ...vals, limit, page * limit
    ).catch(() => []) as any[];

    const countRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS total FROM SolicitacaoServico s ${where}`,
      ...vals
    ).catch(() => [{ total: 0 }]) as any[];

    const statsRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT tipo_servico, status, COUNT(*) AS total
       FROM SolicitacaoServico
       WHERE status NOT IN ('FINALIZADA','CANCELADA')
       GROUP BY tipo_servico, status`
    ).catch(() => []) as any[];

    return reply.send({
      status: 'success',
      data: {
        solicitacoes: rows,
        total: Number(countRows[0]?.total || 0),
        stats: statsRows,
      }
    });
  });
}
