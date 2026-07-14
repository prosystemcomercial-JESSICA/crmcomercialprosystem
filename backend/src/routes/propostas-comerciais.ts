import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { enviarEmailProposta } from '@/services/email.service';
import * as evo from '@/services/evolution.service';
import { ownerWhere, scopeUserId, requireGestor } from '@/lib/scope';
import { gerarIdPropostaUnico } from '@/lib/ids';

// ── Métricas do gerador ────────────────────────────────────────────────────
// "Fechada" inclui os estados de contrato: o aceite do cliente já move a proposta
// para CONTRATO_EM_GERACAO automaticamente, então parar em ACEITA subestimaria.
const FECHADAS = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const PERDIDAS = ['RECUSADA', 'PERDIDA'];

/**
 * O campo `segmento` é texto livre ("Farmácia / Drogaria", "Padaria", "Outro"…),
 * então agrupamos por palavra-chave. Sem match → VAREJO (balde padrão).
 */
function segmentoDe(s?: string | null): 'FARMACIA' | 'PADARIA' | 'VAREJO' {
  const t = (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase();
  if (/farm|drog/.test(t)) return 'FARMACIA';
  if (/padar|confeit|pao|paes/.test(t)) return 'PADARIA';
  return 'VAREJO';
}

const soma  = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const media = (ns: number[]) => (ns.length ? Math.round((soma(ns) / ns.length) * 10) / 10 : 0);
const pct   = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 1000) / 10 : 0);

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
  validade:             z.string().datetime().optional().or(z.literal('')),
  origem:               z.string().optional(),

  plano_selecionado:    z.string().optional(),
  plano_recomendado:    z.string().optional(),
  mensalidade_basic:    z.number().optional(),
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

  lojas_projeto: z.array(z.any()).optional(),

  comissao_vendedor_pct:   z.number().optional(),
  comissao_supervisor_pct: z.number().optional(),

  status: z.enum([
    'RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EM_NEGOCIACAO', 'PERDIDA',
    'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO',
  ]).optional(),
});

// Campos numéricos da proposta — qualquer NaN/Infinity aqui derruba o Prisma.
const CAMPOS_NUM_PROPOSTA = new Set([
  'maquinas', 'mensalidade_basic', 'mensalidade_pro', 'mensalidade_plus', 'valor_implantacao',
  'valor_conversao', 'desconto', 'valor_final', 'entrada', 'parcelas',
  'valor_parcela', 'comissao_vendedor_pct', 'comissao_supervisor_pct',
]);
// Datas que o front pode mandar como "YYYY-MM-DD" (sem hora) → normaliza p/ ISO.
function normalizarValidade(v: any): string | undefined {
  if (v === null || v === undefined || `${v}`.trim() === '') return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
/** Limpa o body da proposta: remove null/'', troca NaN por ausência, normaliza validade. */
function sanitizarBodyProposta(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'lead_id') continue; // não é coluna da proposta
    if (v === null || v === undefined || v === '') continue;
    if (k === 'validade') { const iso = normalizarValidade(v); if (iso) out[k] = iso; continue; }
    if (k === 'modulos_inclusos' || k === 'servicos_adicionais') { out[k] = Array.isArray(v) ? v : []; continue; }
    if (CAMPOS_NUM_PROPOSTA.has(k)) {
      const n = typeof v === 'number' ? v : parseFloat(`${v}`.replace(/[^\d.,-]/g, '').replace(/\./g, m => m).replace(',', '.'));
      if (Number.isFinite(n)) out[k] = n; // descarta NaN/Infinity
      continue;
    }
    out[k] = v;
  }
  return out;
}

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

  // Soft-delete + multi-loja: garante colunas em bases existentes (não-bloqueante)
  Promise.all([
    prisma.$executeRawUnsafe(`ALTER TABLE PropostaComercial ADD COLUMN deleted_at DATETIME NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE PropostaComercial ADD COLUMN deleted_by VARCHAR(255) NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE PropostaComercial ADD COLUMN motivo_exclusao TEXT NULL`).catch(() => {}),
    prisma.$executeRawUnsafe(`ALTER TABLE PropostaComercial ADD COLUMN lojas_projeto JSON NULL`).catch(() => {}),
  ]).catch(() => {});

  // ===== LISTAR =====
  fastify.get('/propostas-comerciais', async (request, reply) => {
    const query = z.object({
      status:   z.string().optional(),
      vendedor: z.string().optional(),
      page:     z.coerce.number().default(0),
      limit:    z.coerce.number().default(20),
    }).safeParse(request.query);

    // Escopo: vendedor só vê as próprias propostas; gestor vê todas.
    // Excluídas (soft-delete) NÃO aparecem na lista nem nos números.
    const esc = { ...ownerWhere(request, 'PropostaComercial'), deleted_at: null as any };
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

  // ===== MÉTRICAS DO GERADOR (respeita os MESMOS filtros da tela) =====
  // Produção, fechamento, quebra por segmento e TEMPOS (SLA por etapa + tempo até
  // a decisão). Os tempos são reconstruídos do PropostaHistorico (tipo STATUS), que
  // já grava cada mudança de status com valor_anterior/valor_novo/created_at.
  fastify.get('/propostas-comerciais/metricas', async (request, reply) => {
    const q = z.object({
      mes:      z.string().optional(),  // 'YYYY-MM' — período analisado
      de:       z.string().optional(),  // alternativa: intervalo livre
      ate:      z.string().optional(),
      status:   z.string().optional(),
      segmento: z.string().optional(),  // FARMACIA | PADARIA | VAREJO
      vendedor: z.string().optional(),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Filtros inválidos' });

    // Janela de tempo: por mês (padrão) ou intervalo livre.
    let inicio: Date | undefined, fim: Date | undefined;
    if (q.data.mes && /^\d{4}-\d{2}$/.test(q.data.mes)) {
      const [a, m] = q.data.mes.split('-').map(Number);
      inicio = new Date(a, m - 1, 1);
      fim    = new Date(a, m, 1); // exclusivo
    } else if (q.data.de || q.data.ate) {
      if (q.data.de)  inicio = new Date(q.data.de);
      if (q.data.ate) { fim = new Date(q.data.ate); fim.setDate(fim.getDate() + 1); }
    }

    // Mesmo escopo da listagem: vendedor só vê as próprias; excluídas ficam fora.
    const where: any = { ...ownerWhere(request, 'PropostaComercial'), deleted_at: null };
    if (inicio || fim) where.created_at = { ...(inicio && { gte: inicio }), ...(fim && { lt: fim }) };
    if (q.data.status)   where.status = q.data.status;
    if (q.data.vendedor) where.vendedor_nome = { contains: q.data.vendedor, mode: 'insensitive' };

    const propostas = await prisma.propostaComercial.findMany({
      where,
      select: {
        id: true, razao_social: true, segmento: true, status: true, valor_final: true,
        created_at: true, data_aceite: true, data_fechamento: true,
        historico: {
          where: { tipo: 'STATUS' },
          orderBy: { created_at: 'asc' },
          select: { valor_anterior: true, valor_novo: true, created_at: true },
        },
      },
    });

    // Filtro por segmento roda em memória: o campo é texto livre e precisa ser
    // normalizado antes de comparar (ver segmentoDe).
    const alvo = (q.data.segmento || '').toUpperCase();
    const lista = alvo ? propostas.filter(p => segmentoDe(p.segmento) === alvo) : propostas;

    const total    = lista.length;
    const fechadas = lista.filter(p => FECHADAS.includes(p.status));
    const perdidas = lista.filter(p => PERDIDAS.includes(p.status));
    const abertas  = total - fechadas.length - perdidas.length;

    // Quebra por segmento (Farmácia | Padaria | Varejo)
    const porSegmento = ['FARMACIA', 'PADARIA', 'VAREJO'].map(seg => {
      const doSeg = lista.filter(p => segmentoDe(p.segmento) === seg);
      const fech  = doSeg.filter(p => FECHADAS.includes(p.status));
      return {
        segmento: seg,
        total: doSeg.length,
        fechadas: fech.length,
        valor_fechado: soma(fech.map(p => p.valor_final || 0)),
        taxa_pct: pct(fech.length, doSeg.length),
      };
    });

    // ── TEMPOS ──
    // 1) Quanto tempo a proposta passou em cada etapa (média em dias).
    // 2) Quanto tempo entre ENVIADA e a decisão (fechamento ou declínio).
    const temposPorEtapa: Record<string, number[]> = {};
    const ateDecisao: number[] = [];
    const ateFechamento: number[] = [];
    const ateDeclinio: number[] = [];

    for (const p of lista) {
      // Linha do tempo: nasce em RASCUNHO no created_at, depois cada mudança de status.
      const eventos = [
        { status: 'RASCUNHO', em: p.created_at },
        ...p.historico.map(h => ({ status: h.valor_novo || '', em: h.created_at })),
      ].filter(e => e.status);

      // Tempo em cada etapa = intervalo até o próximo evento (a última etapa segue
      // aberta, então conta até agora só se a proposta não foi decidida).
      const decidida = FECHADAS.includes(p.status) || PERDIDAS.includes(p.status);
      for (let i = 0; i < eventos.length; i++) {
        const ini = eventos[i].em;
        const proximo = eventos[i + 1]?.em ?? (decidida ? null : new Date());
        if (!proximo) continue;
        const dias = (new Date(proximo).getTime() - new Date(ini).getTime()) / 86400000;
        if (dias >= 0) (temposPorEtapa[eventos[i].status] ||= []).push(dias);
      }

      // Da ENVIADA até a decisão. Sem registro de envio, cai no created_at.
      const envio = eventos.find(e => e.status === 'ENVIADA')?.em ?? p.created_at;
      const decisao = eventos.find(e => FECHADAS.includes(e.status) || PERDIDAS.includes(e.status))?.em
                   ?? p.data_fechamento ?? p.data_aceite;
      if (decisao) {
        const dias = (new Date(decisao).getTime() - new Date(envio).getTime()) / 86400000;
        if (dias >= 0) {
          ateDecisao.push(dias);
          (FECHADAS.includes(p.status) ? ateFechamento : ateDeclinio).push(dias);
        }
      }
    }

    const etapas = Object.entries(temposPorEtapa).map(([etapa, ds]) => ({
      etapa,
      media_dias: media(ds),
      maior_dias: Math.round(Math.max(...ds) * 10) / 10,
      qtd: ds.length,
    })).sort((a, b) => b.media_dias - a.media_dias);

    return reply.send({
      status: 'success',
      data: {
        periodo: { mes: q.data.mes || null, de: inicio || null, ate: fim || null },
        producao: {
          total,
          fechadas: fechadas.length,
          perdidas: perdidas.length,
          em_aberto: abertas,
          valor_fechado: soma(fechadas.map(p => p.valor_final || 0)),
          ticket_medio: fechadas.length ? Math.round(soma(fechadas.map(p => p.valor_final || 0)) / fechadas.length) : 0,
          // % de fechamento sobre o total produzido no período.
          taxa_fechamento_pct: pct(fechadas.length, total),
        },
        por_segmento: porSegmento,
        tempos: {
          // SLA: quanto tempo, em média, a proposta fica parada em cada etapa.
          por_etapa: etapas,
          // Da proposta enviada até a decisão do cliente.
          ate_decisao_dias:   media(ateDecisao),
          ate_fechamento_dias: media(ateFechamento),
          ate_declinio_dias:   media(ateDeclinio),
        },
      },
    });
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

  // ===== ACEITE PÚBLICO (cliente clica em "Aceitar") — sem auth =====
  // Move o status p/ ACEITA → CONTRATO_EM_GERACAO, registra histórico, e casa/cria
  // o lead no funil em FECHAMENTO (GANHO) com os dados de fechamento, de modo que
  // Dashboard, Ciclo de Vendas e Metas passem a contabilizar automaticamente.
  fastify.post('/p/:token/aceitar', { config: { skipAuth: true } }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const p = await prisma.propostaComercial.findUnique({ where: { public_token: token } });
    if (!p) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada ou expirada' });

    // Plano escolhido pelo cliente no aceite (quando a proposta oferece Pro e Plus).
    const planoEscolhido = String((request.body as any)?.plano_selecionado || '').toUpperCase();
    const planoFinal = ['BASIC', 'PRO', 'PLUS'].includes(planoEscolhido) ? planoEscolhido : p.plano_selecionado;

    const jaAceita = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'].includes(p.status);

    // valores p/ fechamento (usam o plano FINAL escolhido)
    const mrr = planoFinal === 'BASIC'
      ? Number((p as any).mensalidade_basic || 0)
      : planoFinal === 'PRO'
        ? Number(p.mensalidade_pro || 0)
        : Number(p.mensalidade_plus || p.mensalidade_pro || 0);
    // Setup/instalação do contrato = VALOR FINAL negociado (implantação + conversão − desconto),
    // que é o "valor especial negociado" mostrado na proposta. Fallback p/ valor_implantacao.
    const inst = Number(p.valor_final ?? p.valor_implantacao ?? 0);
    const agora = new Date();

    if (!jaAceita) {
      // 1) Proposta → ACEITA e já marcada para geração de contrato (grava o plano escolhido)
      await prisma.propostaComercial.update({
        where: { id: p.id },
        data: {
          status: 'CONTRATO_EM_GERACAO',
          plano_selecionado: planoFinal || undefined,
          data_aceite: agora,
          data_contrato_gerado: agora,
        },
      });
      // 2) Histórico da proposta
      await prisma.propostaHistorico.create({
        data: {
          proposta_id: p.id,
          tipo: 'ACEITE_CLIENTE',
          valor_novo: 'Cliente aceitou a proposta pelo link · enviada para geração de contrato',
          feito_por_nome: p.razao_social || 'Cliente',
          feito_por_role: 'CLIENTE',
        },
      }).catch(() => {});

      // 2.1) Gera automaticamente o ContratoComercial (status A_GERAR), herdando o ID
      // da proposta. Fica pronto para a gestão conferir e enviar à assinatura com 1 clique.
      try {
        const jaTemContrato = await prisma.contratoComercial.findFirst({
          where: { OR: [{ id: p.id }, { proposta_comercial_id: p.id }] },
          select: { id: true },
        });
        if (!jaTemContrato) {
          // sequência anual do contrato
          const anoC = agora.getFullYear();
          const seqRow = await prisma.contratoSequencia.upsert({
            where: { ano: anoC },
            create: { ano: anoC, ultima_seq: 27, updated_at: agora },
            update: {},
          });
          const novaSeq = await prisma.contratoSequencia.update({
            where: { ano: anoC },
            data: { ultima_seq: { increment: 1 }, updated_at: agora },
          });
          const seq = novaSeq.ultima_seq;

          // dia de vencimento a partir de data_vencimento (texto livre)
          let diaVenc: number | undefined;
          const rawVenc = String(p.data_vencimento || '').trim();
          const mBr = rawVenc.match(/^(\d{1,2})[\/\-]/) || rawVenc.match(/^\d{4}-\d{2}-(\d{2})/) || rawVenc.match(/(\d{1,2})/);
          if (mBr) { const d = Number(mBr[1]); if (d >= 1 && d <= 31) diaVenc = d; }

          const setupAVista = !p.parcelas || p.parcelas <= 1;

          await prisma.contratoComercial.create({
            data: {
              id: p.id, // herda o ID da proposta (rastreabilidade)
              numero_contrato: `${seq}/${anoC}`,
              sequencia: seq,
              ano: anoC,
              status: 'A_GERAR',
              proposta_comercial_id: p.id,
              razao_social: p.razao_social,
              nome_fantasia: p.nome_fantasia || undefined,
              cnpj: p.cnpj || undefined,
              cidade: p.cidade || undefined,
              estado: p.estado || undefined,
              representante_nome: p.responsavel_nome || undefined,
              representante_cpf: p.responsavel_cpf || undefined,
              representante_email: p.responsavel_email || undefined,
              representante_telefone: p.responsavel_telefone || undefined,
              representante_cargo: p.responsavel_cargo || undefined,
              plano_contratado: planoFinal || undefined,
              software_nome: 'SOLUTION – FRENTE DE LOJA',
              software_versao: planoFinal || undefined,
              mensalidade: mrr || undefined,
              dia_vencimento: diaVenc,
              valor_setup_total: inst || undefined,
              valor_setup_entrada: p.entrada || undefined,
              setup_parcelas: p.parcelas || undefined,
              valor_setup_parcela: p.valor_parcela || undefined,
              setup_a_vista: setupAVista,
              vendedor_id: p.vendedor_id || p.created_by || undefined,
              vendedor_nome: p.vendedor_nome || undefined,
              supervisor_nome: p.supervisor_nome || undefined,
              campanha: p.campanha || undefined,
              condicao_especial: p.condicao_especial || undefined,
              modelo_contrato: planoFinal || undefined,
              created_by: p.created_by || 'system',
            },
          });
        }
      } catch (e) {
        request.log?.warn({ err: e }, 'aceite: falha ao gerar contrato automático (proposta segue aceita)');
      }
    }

    // 3) Casa/cria o lead pelo CNPJ e move para FECHAMENTO (GANHO) — alimenta dashboard/metas
    try {
      const cnpjDigits = (p.cnpj || '').replace(/\D/g, '');
      let lead = null as any;
      if (cnpjDigits) {
        // Casa por CNPJ tolerando formatação: busca os leads cujo CNPJ tenha os
        // mesmos dígitos (comparação feita em JS para evitar SQL cru frágil).
        const candidatos = await prisma.lead.findMany({
          where: { cnpj: { not: null } },
          select: { id: true, cnpj: true },
          take: 2000,
        }).catch(() => [] as any[]);
        lead = candidatos.find(c => (c.cnpj || '').replace(/\D/g, '') === cnpjDigits) || null;
      }
      // Aceite move a negociação para FECHAMENTO (contrato em geração) — porém NÃO marca
      // GANHO ainda: a venda só é "ganha"/contabilizada na meta quando o contrato for
      // ASSINADO (ver aplicarAssinatura em contratos-comerciais.ts).
      const fechamentoData = {
        // EM_NEGOCIACAO é uma coluna válida do quadro (aceito, aguardando assinatura).
        etapa_funil: 'FECHAMENTO', etapa_comercial: 'EM_NEGOCIACAO', status: 'EM_NEGOCIACAO',
        status_atendimento: 'EM_ANDAMENTO',
        fechamento_mrr: mrr, fechamento_valor_inst: inst,
        fechamento_plano: planoFinal || null,
        fechamento_por: p.vendedor_id || p.created_by,
      };
      if (lead) {
        await prisma.lead.update({ where: { id: lead.id }, data: fechamentoData as any });
      } else {
        // cria o lead na fase de fechamento (aparece no funil) — ainda não GANHO
        await prisma.lead.create({
          data: {
            nome: p.razao_social, razao_social: p.razao_social, nome_fantasia: p.nome_fantasia || undefined,
            cnpj: p.cnpj || undefined, segmento: p.segmento || undefined,
            cidade: p.cidade || undefined, estado: p.estado || undefined,
            vendedor_nome: p.vendedor_nome || undefined,
            responsavel_id: p.vendedor_id || undefined,
            origem: 'PROPOSTA', temperatura: 'MUITO_QUENTE',
            created_by: p.vendedor_id || p.created_by,
            modulos_inclusos: {}, servicos_adicionais: {},
            ...fechamentoData,
          } as any,
        });
      }
    } catch (e) {
      request.log?.warn({ err: e }, 'aceite: falha ao casar/criar lead (proposta segue aceita)');
    }

    return reply.send({ status: 'success', data: { aceita: true, ja_estava: jaAceita } });
  });

  // ===== CRIAR =====
  fastify.post('/propostas-comerciais', async (request, reply) => {
    const user = (request as any).user;
    // Blindagem: o front pode mandar NaN num campo numérico (parseFloat de texto),
    // null, ou validade fora do ISO. Limpamos ANTES do parse p/ não dar 400/500.
    const limpo = sanitizarBodyProposta(request.body);
    const body = PropostaSchema.safeParse(limpo);
    if (!body.success) {
      const issues = body.error.issues.map(i => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
      console.warn('[POST /propostas-comerciais] validação falhou:', issues.join(' | '));
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors, detalhes: issues });
    }

    const data = { ...body.data };

    // Auto-fill vendedor a partir do CADASTRO do vendedor (nome, telefone, email).
    // O contato do vendedor na proposta SEMPRE vem do cadastro dele (UsuarioCRM) —
    // o telefone/WhatsApp informado no cadastro do usuário. Gestor pode gerar p/
    // outro vendedor (vendedor_id), então buscamos pelo vendedor_id; senão pelo
    // usuário logado. O telefone do cadastro PREVALECE (sobrescreve string vazia
    // ou telefone do cliente que o front possa ter enviado por engano).
    // Jessica Diretora (conta de sistema) vendendo no próprio perfil conta para a
    // VENDEDORA Jessica Cardoso — exceto quando designou outro vendedor (vendedor_id
    // explícito de outra pessoa, que já cai no else por ser diferente de user-jessica).
    const JESSICA_DIRETORA = 'user-jessica', JESSICA_VENDEDORA = 'c8170a2f-f931-4f1b-b820-8b23baf2a5d8';
    if (!data.vendedor_id && user?.id === JESSICA_DIRETORA) {
      data.vendedor_id = JESSICA_VENDEDORA; data.vendedor_nome = data.vendedor_nome || 'Jessica Cardoso';
    } else if (data.vendedor_id === JESSICA_DIRETORA) {
      data.vendedor_id = JESSICA_VENDEDORA; data.vendedor_nome = 'Jessica Cardoso';
    }

    const alvoVendedorId = data.vendedor_id || user?.id;
    if (alvoVendedorId) {
      const perfilRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT nome, email, telefone FROM UsuarioCRM WHERE id = ? LIMIT 1`, alvoVendedorId
      ).catch(() => []);
      const perfil = perfilRows[0] || {};
      const ehLogado = alvoVendedorId === user?.id;
      // Telefone do cadastro do vendedor sempre prevalece (se existir).
      if (perfil.telefone) data.vendedor_telefone = perfil.telefone;
      if (!data.vendedor_nome)  data.vendedor_nome  = perfil.nome  || (ehLogado ? user?.nome : undefined) || undefined;
      if (!data.vendedor_email) data.vendedor_email = perfil.email || (ehLogado ? user?.email : undefined) || undefined;
      if (!data.vendedor_id)    data.vendedor_id = user?.id;
    }

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
    const limpo = sanitizarBodyProposta(request.body);
    const body = PropostaSchema.partial().safeParse(limpo);
    if (!body.success) {
      const issues = body.error.issues.map(i => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
      console.warn('[PATCH /propostas-comerciais] validação falhou:', issues.join(' | '));
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', detalhes: issues });
    }

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

      // PONTE → Portal de Implantação: cria o projeto de onboarding automaticamente.
      // Não-bloqueante e condicional (só dispara se as envs existirem); o portal
      // é idempotente por contrato_crm_id, então reenvio não duplica.
      if (process.env.PORTAL_PONTE_URL && process.env.PONTE_TOKEN) {
        fetch(`${process.env.PORTAL_PONTE_URL}/ponte/projeto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ponte-token': process.env.PONTE_TOKEN },
          body: JSON.stringify({
            cliente_nome: atual?.razao_social || atual?.nome_fantasia || 'Cliente',
            razao_social: atual?.razao_social, nome_fantasia: atual?.nome_fantasia, cnpj: atual?.cnpj,
            telefone: atual?.responsavel_telefone, email: atual?.responsavel_email,
            contrato_crm_id: id, segmento_atuacao: undefined,
            volumetria_pdvs: atual?.maquinas ?? undefined,
          }),
        }).then(r => r.ok || console.warn('[PONTE-PORTAL] resposta', r.status))
          .catch(e => console.warn('[PONTE-PORTAL] falhou (não bloqueia):', e?.message));
      }

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

      // D1: ao mudar para ENVIADA, dispara o resumo + link no WhatsApp do cliente
      // (pela instância do vendedor dono da proposta). Não bloqueia a resposta.
      if (data.status === 'ENVIADA' && atual?.status !== 'ENVIADA' && proposta.responsavel_telefone) {
        enviarResumoWhatsApp(prisma, proposta).catch(e => console.error('[PROPOSTA] WhatsApp:', e?.message));
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
  // ===== EXCLUIR (soft-delete) — só gestão; sai dos RESULTADOS, fica na AUDITORIA =====
  fastify.delete('/propostas-comerciais/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // só gestão exclui
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const motivo = (request.body as any)?.motivo || (request.query as any)?.motivo || null;

    const p = await prisma.propostaComercial.findUnique({ where: { id } });
    if (!p) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
    if ((p as any).deleted_at) return reply.send({ status: 'success', message: 'Proposta já estava excluída' });

    // 1) Soft-delete: marca como excluída (não some — fica para auditoria)
    await prisma.propostaComercial.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by: user?.id || 'system', motivo_exclusao: motivo, status: 'EXCLUIDA' } as any,
    });

    // 2) Trilha de auditoria
    await prisma.propostaHistorico.create({
      data: {
        proposta_id: id,
        tipo: 'EXCLUSAO',
        valor_anterior: `Status: ${p.status} | Setup: R$ ${p.valor_final ?? 0}`,
        valor_novo: 'EXCLUÍDA (removida dos resultados; mantida em auditoria)',
        motivo: motivo || undefined,
        feito_por_id: user?.id, feito_por_nome: user?.nome, feito_por_role: user?.role,
      },
    }).catch(() => {});

    // 3) Reverte o lead que esta proposta havia fechado (números fiéis no dashboard/metas)
    try {
      const cnpjDigits = (p.cnpj || '').replace(/\D/g, '');
      if (cnpjDigits) {
        const candidatos = await prisma.lead.findMany({
          where: { cnpj: { not: null }, status: 'GANHO' },
          select: { id: true, cnpj: true, fechamento_data: true },
          take: 2000,
        }).catch(() => [] as any[]);
        const lead = candidatos.find(c => (c.cnpj || '').replace(/\D/g, '') === cnpjDigits);
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              etapa_funil: 'NEGOCIACAO', etapa_comercial: 'EM_NEGOCIACAO', status: 'EM_CONTATO',
              status_atendimento: 'EM_CONVERSA',
              fechamento_data: null, fechamento_mrr: null, fechamento_valor_inst: null, fechamento_plano: null,
            } as any,
          });
        }
      }
    } catch (e) {
      request.log?.warn({ err: e }, 'exclusão: falha ao reverter lead (proposta segue excluída)');
    }

    return reply.send({ status: 'success' });
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

    const where: any = { deleted_at: null };  // comissões de propostas excluídas não contam
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

// ── D1: envia o resumo + link da proposta no WhatsApp do cliente ──────────────
// Usa a instância do vendedor dono. Registra a mensagem no Inbox do CRM.
async function enviarResumoWhatsApp(prisma: PrismaClient, p: any) {
  if (!evo.evolutionConfigurada() || !p.responsavel_telefone) return;
  // Instância do vendedor (cada usuário conecta a sua: crm-<userId>).
  const donoId = p.vendedor_id;
  if (!donoId) return;
  const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: `crm-${donoId}` } });
  if (!inst || inst.status !== 'CONECTADO') return; // sem WhatsApp conectado, sai

  const brl = (v?: number | null) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null;
  const nome = p.responsavel_nome ? p.responsavel_nome.split(' ')[0] : '';
  const mensalidade = (p.mensalidade_plus && p.mensalidade_plus > 0) ? p.mensalidade_plus : (p.mensalidade_pro || null);
  const validade = p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : null;
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'https://frontend-production-3a79.up.railway.app';
  const slug = (p.razao_social || p.nome_fantasia || 'cliente').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const link = p.public_token ? `${baseUrl}/p/${p.public_token}/${slug}?modo=cliente` : null;

  const linhas = [
    nome ? `Olá, ${nome}! Tudo bem?` : 'Olá! Tudo bem?',
    '',
    `Segue o resumo da proposta da *Prosystem* para *${p.razao_social}*:`,
    '',
    p.plano_selecionado ? `*Plano:* ${p.plano_selecionado}` : null,
    mensalidade ? `*Mensalidade:* ${brl(mensalidade)}/mês` : null,
    p.valor_final != null ? `*Implantação:* ${brl(p.valor_final)}` : null,
    (p.parcelas && p.valor_parcela) ? `*Parcelamento:* ${p.parcelas}x de ${brl(p.valor_parcela)}` : (p.entrada ? `*Entrada:* ${brl(p.entrada)}` : null),
    validade ? `*Validade:* ${validade}` : null,
    '',
    link ? 'Acesse a proposta completa pelo link:' : null,
    link,
    '',
    'Qualquer dúvida, estou à disposição!',
    p.vendedor_nome || null,
  ].filter(l => l !== null).join('\n');

  try {
    const r = await evo.enviarTexto(inst.instancia_nome, p.responsavel_telefone, linhas);
    // Registra no Inbox (cria/abre a conversa do cliente).
    const numero = evo.normalizarNumero(p.responsavel_telefone);
    const conversa = await prisma.whatsappConversa.upsert({
      where: { uq_conversa: { instanciaId: inst.id, contato_numero: numero } },
      create: { instanciaId: inst.id, dono_id: inst.dono_id, contato_numero: numero, contato_nome: p.razao_social, lead_id: p.lead_id || undefined, ultima_mensagem: 'Proposta enviada', ultima_em: new Date() },
      update: { ultima_mensagem: 'Proposta enviada', ultima_em: new Date() },
    });
    await prisma.whatsappMensagem.create({
      data: { conversaId: conversa.id, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: linhas, status: 'ENVIADA', enviada_por: donoId },
    }).catch(() => {});
    console.log(`[PROPOSTA] Resumo enviado por WhatsApp p/ ${numero}`);
  } catch (e: any) {
    console.error('[PROPOSTA] Falha WhatsApp:', e?.message);
  }
}
