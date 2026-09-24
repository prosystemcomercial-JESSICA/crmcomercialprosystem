import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getUser, podeVerTudo, requireGestor } from '@/lib/scope';
import { segmentoDe, LABEL_SEGMENTO, SEGMENTOS_ORDEM, GrupoSegmento } from '@/lib/segmento';
import {
  CHAVE_TOKEN_TV, CHAVES_METAS_TV, CampoMetaTv, CARGOS_EQUIPE_TV, ETAPAS_FUNIL_PADRAO, ETAPAS_NEGOCIACAO,
  limitesPeriodo, dentro, horaLocal, contarPorMes, tokenTvValido, parseMeta, progresso,
  ehSaidaHumana, iniciadaPor, mediaPrimeiraResposta, MsgResumo, primeiroNome, montarFunil,
  soma, mediaPositivos, valorInstalacao, valorMensalidade, dataFechamento, ritmoAnual,
} from '@/lib/painel-tv';

/**
 * PAINEL DA TV — setor comercial (somente leitura).
 *
 *   GET  /painel-tv/dados?chave=…  → público com o token da TV (ou gestão logada, p/ prévia)
 *   GET  /painel-tv/config         → gestão: metas + link da TV
 *   PUT  /painel-tv/config         → gestão: salva metas
 *   POST /painel-tv/chave          → gestão: gera token novo (o link antigo para de funcionar)
 *
 * Fontes de cada métrica: ver .superpowers/painel-tv-report.md.
 */

// Mesma definição de "fechamento" de lib/meta-progress.ts (fonte única de metas/relatórios).
const STATUS_FECHADA = ['CONTRATO_ASSINADO', 'ASSINADO', 'ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];
// Propostas com o cliente, aguardando decisão.
const STATUS_PROPOSTA_ABERTA = ['ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'];
// Etapas em que o lead já não está "aberto" no funil (ganho, perdido ou pós-venda).
const ETAPAS_FORA_DO_FUNIL = ['FECHADO', 'PERDIDO', 'ACEITO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO', 'ONBOARDING', 'EXECUCAO_TECNICA'];
// Etiquetas que a triagem põe em conversas que não são comerciais.
const ETIQUETAS_NAO_COMERCIAIS = ['Suporte', 'Financeiro'];
const JANELA_SEM_RESPOSTA_DIAS = 7;
const DIAS_PROPOSTA_PARADA = 7;
const CACHE_MS = 20_000;

const LABEL_ATIVIDADE: Record<string, string> = {
  LIGACAO: 'ligação', EMAIL: 'e-mail', REUNIAO: 'reunião', WHATSAPP: 'WhatsApp', VISITA: 'visita', TAREFA: 'tarefa', OUTRO: 'atividade',
};

function nomeEmpresa(x: { nome_fantasia?: string | null; razao_social?: string | null; empresa?: string | null }): string | null {
  return (x.nome_fantasia || x.razao_social || x.empresa || '').trim() || null;
}

export async function painelTvRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  let cache: { em: number; dados: any } | null = null;

  const lerConfig = async (chaves: string[]) => {
    const rows = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: chaves } } });
    const m: Record<string, string> = {};
    rows.forEach(r => { m[r.chave] = r.valor; });
    return m;
  };

  const lerMetas = async () => {
    const cfg = await lerConfig(Object.values(CHAVES_METAS_TV));
    const out = {} as Record<CampoMetaTv, number | null>;
    (Object.keys(CHAVES_METAS_TV) as CampoMetaTv[]).forEach(k => { out[k] = parseMeta(cfg[CHAVES_METAS_TV[k]]); });
    return out;
  };

  const salvarConfig = (chave: string, valor: string, por: string) => prisma.configuracaoIntegracao.upsert({
    where: { chave },
    create: { chave, valor, updated_at: new Date(), updated_by: por },
    update: { valor, updated_at: new Date(), updated_by: por },
  });

  // ── DADOS ────────────────────────────────────────────────────────────────
  fastify.get('/painel-tv/dados', async (request, reply) => {
    const { chave } = (request.query || {}) as { chave?: unknown };
    let autorizado = podeVerTudo(getUser(request));
    if (!autorizado && chave !== undefined) {
      const cfg = await lerConfig([CHAVE_TOKEN_TV]);
      autorizado = tokenTvValido(chave, cfg[CHAVE_TOKEN_TV]);
    }
    if (!autorizado) return reply.status(401).send({ status: 'error', message: 'Link do painel inválido' });

    reply.header('Cache-Control', 'no-store');
    if (cache && Date.now() - cache.em < CACHE_MS) return reply.send({ status: 'ok', data: cache.dados });
    const dados = await montarDados();
    cache = { em: Date.now(), dados };
    return reply.send({ status: 'ok', data: dados });
  });

  async function montarDados() {
    const L = limitesPeriodo(new Date());
    const { agora, inicioHoje, fimHoje, inicioMes, fimMes, inicioAno, fimAno } = L;
    const metas = await lerMetas();
    const hoje = { gte: inicioHoje, lt: fimHoje };

    // ── Fechamentos do ano (PropostaComercial — mesma fonte das metas) ──────
    const fechamentosAno = await prisma.propostaComercial.findMany({
      where: {
        status: { in: STATUS_FECHADA }, deleted_at: null,
        OR: [
          { data_aceite: { gte: inicioAno, lt: fimAno } },
          { AND: [{ data_aceite: null }, { created_at: { gte: inicioAno, lt: fimAno } }] },
        ],
      },
      select: {
        id: true, data_aceite: true, created_at: true, valor_implantacao: true, valor_final: true,
        mensalidade_plus: true, mensalidade_pro: true, segmento: true, vendedor_id: true, created_by: true,
        nome_fantasia: true, razao_social: true,
      },
    });
    const fechMes = fechamentosAno.filter(p => dentro(dataFechamento(p), inicioMes, fimMes));
    const fechHoje = fechamentosAno.filter(p => dentro(dataFechamento(p), inicioHoje, fimHoje));
    const faturamentoMes = soma(fechMes.map(valorInstalacao));
    const instalacaoAno = soma(fechamentosAno.map(valorInstalacao));

    // ── Leads ────────────────────────────────────────────────────────────────
    const leadsNegociacao = await prisma.lead.findMany({
      where: { deleted_at: null, etapa_comercial: { in: ETAPAS_NEGOCIACAO } },
      select: { etapa_comercial: true, valor_estimado: true, valor_setup: true },
    });
    const comValor = leadsNegociacao.filter(l => (l.valor_estimado ?? l.valor_setup) != null);
    const leadsAcumulados = await prisma.lead.count({ where: { deleted_at: null, etapa_comercial: { notIn: ETAPAS_FORA_DO_FUNIL } } });
    const leadsHoje = await prisma.lead.findMany({
      where: { deleted_at: null, created_at: hoje },
      select: { id: true, origem: true, created_at: true, nome_fantasia: true, razao_social: true, empresa: true },
    });
    const porOrigem: Record<string, number> = {};
    leadsHoje.forEach(l => { const o = (l.origem || 'MANUAL').toUpperCase(); porOrigem[o] = (porOrigem[o] || 0) + 1; });

    // Qualificados hoje: só a triagem deixa rastro com data (LeadObservacao do bot).
    // Mover etapa_sdr manualmente (PATCH /leads/:id/etapa-sdr) não registra data.
    const obsTriagem = await prisma.leadObservacao.findMany({
      where: { created_at: hoje, created_by: 'bot', created_by_name: 'Triagem automática' },
      select: { lead_id: true, created_at: true, lead: { select: { nome_fantasia: true, razao_social: true, empresa: true, cidade: true, estado: true } } },
      orderBy: { created_at: 'desc' },
    });
    const qualificadosTriagem = new Set(obsTriagem.map(o => o.lead_id)).size;

    // Funil agora: só etapas que são coluna ativa do Pipeline Comercial.
    let colunas = await prisma.kanbanColuna.findMany({ where: { ativa: true, quadro_id: null }, orderBy: { ordem: 'asc' }, select: { chave: true, nome: true } }).catch(() => []);
    if (!colunas.length) colunas = ETAPAS_FUNIL_PADRAO;
    const porEtapa = await prisma.lead.groupBy({ by: ['etapa_comercial'], where: { deleted_at: null }, _count: { _all: true } });
    const funil = montarFunil(porEtapa.map(g => ({ etapa: g.etapa_comercial, total: g._count._all })), colunas)
      .map(e => e.etapa === 'FECHADO' ? { ...e, nome: 'Fechados (mês)', total: fechMes.length } : e)
      .filter(e => e.etapa !== 'PERDIDO');

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    const conversasHoje = await prisma.whatsappConversa.findMany({
      where: { created_at: hoje },
      select: {
        id: true, bot_dados: true,
        mensagens: { select: { direcao: true, enviada_por: true, created_at: true }, orderBy: { created_at: 'asc' }, take: 60 },
      },
    });
    const msgsConversasHoje = conversasHoje.map(c => c.mensagens as MsgResumo[]);
    let iniciadasCliente = 0, iniciadasEquipe = 0;
    msgsConversasHoje.forEach(m => { const q = iniciadaPor(m); if (q === 'cliente') iniciadasCliente++; else if (q === 'equipe') iniciadasEquipe++; });

    const saidasHoje = await prisma.whatsappMensagem.findMany({
      where: { direcao: 'SAIDA', created_at: hoje },
      select: { conversaId: true, enviada_por: true, direcao: true, created_at: true },
    });
    const saidasHumanas = saidasHoje.filter(m => ehSaidaHumana(m as MsgResumo));
    const respondidasHoje = new Set(saidasHumanas.map(m => m.conversaId)).size;
    const respondidasPorUsuario: Record<string, Set<string>> = {};
    saidasHumanas.forEach(m => { if (m.enviada_por) (respondidasPorUsuario[m.enviada_por] ||= new Set()).add(m.conversaId); });

    // Sem resposta: conversas comerciais recentes cuja ÚLTIMA mensagem é do cliente
    // e o robô não está conduzindo. (sla_prazo_em sozinho não serve: resposta digitada
    // no celular da empresa não limpa o prazo.)
    const desde = new Date(agora.getTime() - JANELA_SEM_RESPOSTA_DIAS * 86400000);
    const ultimas: any[] = await prisma.$queryRawUnsafe(
      `SELECT c.id, c.sla_prazo_em, m.direcao
         FROM WhatsappConversa c
         JOIN WhatsappMensagem m ON m.conversaId = c.id
        WHERE c.ultima_em >= ? AND c.bot_ativo = 0
          AND (c.etiqueta IS NULL OR c.etiqueta NOT IN (${ETIQUETAS_NAO_COMERCIAIS.map(() => '?').join(',')}))
          AND (c.tipo_contato IS NULL OR c.tipo_contato <> 'EQUIPE')
          AND m.created_at = (SELECT MAX(m2.created_at) FROM WhatsappMensagem m2 WHERE m2.conversaId = c.id)`,
      desde, ...ETIQUETAS_NAO_COMERCIAIS,
    ).catch(() => null as any);
    let semResposta: number | null = null, foraDoPrazo: number | null = null;
    if (Array.isArray(ultimas)) {
      const ultimaPorConversa = new Map<string, { direcao: string; sla: Date | null }>();
      ultimas.forEach(r => ultimaPorConversa.set(r.id, { direcao: r.direcao, sla: r.sla_prazo_em ? new Date(r.sla_prazo_em) : null }));
      const pendentes = [...ultimaPorConversa.values()].filter(v => v.direcao === 'ENTRADA');
      semResposta = pendentes.length;
      foraDoPrazo = pendentes.filter(v => v.sla && v.sla.getTime() < agora.getTime()).length;
    }

    // CNPJ não ATIVO na Receita (conversas que chegaram hoje e passaram pela triagem).
    const cnpjIrregular = conversasHoje.filter(c => {
      const sit = (c.bot_dados as any)?.receita?.situacao;
      return typeof sit === 'string' && sit.trim() !== '' && sit.toUpperCase() !== 'ATIVA';
    }).length;

    // ── Propostas ────────────────────────────────────────────────────────────
    const propostasParadas = await prisma.propostaComercial.count({
      where: { deleted_at: null, status: { in: STATUS_PROPOSTA_ABERTA }, updated_at: { lt: new Date(agora.getTime() - DIAS_PROPOSTA_PARADA * 86400000) } },
    });
    const propostasHoje = await prisma.propostaComercial.findMany({
      where: { deleted_at: null, created_at: hoje }, select: { vendedor_id: true, created_by: true },
    });
    const enviadasHoje = await prisma.propostaHistorico.findMany({
      where: { created_at: hoje, tipo: 'STATUS', valor_novo: 'ENVIADA' },
      select: { created_at: true, proposta: { select: { nome_fantasia: true, razao_social: true } } },
    });

    // Leads para distribuir — mesma regra de GET /leads/prontos-para-distribuir.
    const candidatos = await prisma.lead.findMany({ where: { etapa_sdr: 'QUALIFICADO', deleted_at: null }, select: { responsavel_id: true, created_by: true } });
    const paraDistribuir = candidatos.filter(l => !l.responsavel_id || l.responsavel_id === l.created_by).length;

    // ── Atividades de hoje ───────────────────────────────────────────────────
    const atividadesHoje = await prisma.atividade.findMany({
      where: {
        OR: [
          { data_prevista: hoje, status: { in: ['PENDENTE', 'CONFIRMADA'] } },
          { status: 'REALIZADA', data_realizada: hoje },
        ],
      },
      select: { responsavel_id: true, status: true, data_prevista: true, data_realizada: true, tipo: true },
    });
    const classifica = (a: typeof atividadesHoje[number]) =>
      a.status === 'REALIZADA' ? 'concluida' : (a.data_prevista && a.data_prevista.getTime() < agora.getTime() ? 'atrasada' : 'pendente');
    const totAtiv = { concluidas: 0, pendentes: 0, atrasadas: 0 };
    atividadesHoje.forEach(a => { const c = classifica(a); if (c === 'concluida') totAtiv.concluidas++; else if (c === 'atrasada') totAtiv.atrasadas++; else totAtiv.pendentes++; });

    // ── Equipe ───────────────────────────────────────────────────────────────
    const equipeRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE status = 'ATIVO' AND cargo IN (${CARGOS_EQUIPE_TV.map(() => '?').join(',')}) ORDER BY nome`,
      ...CARGOS_EQUIPE_TV,
    ).catch(() => []);
    const donoProposta = (p: { vendedor_id?: string | null; created_by?: string | null }) => p.vendedor_id || p.created_by;
    const equipe = equipeRows.map(u => {
      const minhas = atividadesHoje.filter(a => a.responsavel_id === u.id);
      return {
        nome: primeiroNome(u.nome),
        cargo: u.cargo === 'SDR' ? 'SDR' : u.cargo === 'SUPERVISAO_COMERCIAL' ? 'Supervisão' : 'Vendas',
        conversas_respondidas: respondidasPorUsuario[u.id]?.size || 0,
        propostas_criadas: propostasHoje.filter(p => donoProposta(p) === u.id).length,
        contratos: fechHoje.filter(p => donoProposta(p) === u.id).length,
        atividades: {
          concluidas: minhas.filter(a => classifica(a) === 'concluida').length,
          pendentes: minhas.filter(a => classifica(a) === 'pendente').length,
          atrasadas: minhas.filter(a => classifica(a) === 'atrasada').length,
        },
      };
    });
    const nomePorId = new Map<string, string>(equipeRows.map(u => [u.id, primeiroNome(u.nome)]));

    // ── Agora mesmo (eventos de hoje) ────────────────────────────────────────
    const eventos: Array<{ em: Date; tipo: string; texto: string }> = [];
    leadsHoje.forEach(l => eventos.push({ em: l.created_at, tipo: 'lead', texto: `Lead novo${nomeEmpresa(l) ? ` — ${nomeEmpresa(l)}` : ` (${(l.origem || 'manual').toLowerCase()})`}` }));
    obsTriagem.forEach(o => {
      const emp = o.lead ? nomeEmpresa(o.lead) : null;
      const local = o.lead ? [o.lead.cidade, o.lead.estado].filter(Boolean).join('/') : '';
      eventos.push({ em: o.created_at, tipo: 'triagem', texto: `${emp || 'Contato'}${local ? ` (${local})` : ''} terminou a triagem` });
    });
    enviadasHoje.forEach(h => eventos.push({ em: h.created_at, tipo: 'proposta', texto: `Proposta enviada — ${nomeEmpresa(h.proposta) || 'cliente'}` }));
    fechHoje.forEach(p => eventos.push({ em: dataFechamento(p), tipo: 'contrato', texto: `Contrato fechado — ${nomeEmpresa(p) || 'cliente'}` }));
    atividadesHoje.filter(a => a.status === 'REALIZADA' && a.data_realizada).forEach(a => {
      const quem = a.responsavel_id ? nomePorId.get(a.responsavel_id) : undefined;
      eventos.push({ em: a.data_realizada!, tipo: 'atividade', texto: `${quem || 'Equipe'} concluiu ${LABEL_ATIVIDADE[a.tipo] || 'atividade'}` });
    });
    const feed = eventos
      .filter(e => e.em.getTime() <= agora.getTime())
      .sort((a, b) => b.em.getTime() - a.em.getTime())
      .slice(0, 10)
      .map(e => ({ hora: horaLocal(e.em), tipo: e.tipo, texto: e.texto }));

    // ── Tela 2: ano ──────────────────────────────────────────────────────────
    const vendasAdicionais = await prisma.vendaAdicional.findMany({
      where: { status: 'CONFIRMADA' },
      select: { valor_venda: true, data_confirmacao: true, data_venda: true, created_at: true, cliente_id: true, parceiro: { select: { nome: true, categoria: true } } },
    });
    const vaAno = vendasAdicionais.filter(v => dentro(v.data_confirmacao || v.data_venda || v.created_at, inicioAno, fimAno));
    const crossSellAno = soma(vaAno.map(v => v.valor_venda));
    const porProduto: Record<string, { produto: string; qtd: number; valor: number }> = {};
    vaAno.forEach(v => {
      const k = v.parceiro?.nome || v.parceiro?.categoria || 'Outros';
      porProduto[k] ||= { produto: k, qtd: 0, valor: 0 };
      porProduto[k].qtd += 1; porProduto[k].valor += Number(v.valor_venda || 0);
    });

    const propostasAno = await prisma.propostaComercial.findMany({
      where: { deleted_at: null, created_at: { gte: inicioAno, lt: fimAno }, status: { not: 'RASCUNHO' } },
      select: { status: true },
    });
    const conversao = propostasAno.length
      ? Math.round((propostasAno.filter(p => STATUS_FECHADA.includes(p.status)).length / propostasAno.length) * 1000) / 10
      : null;

    const leadsFechadosAno = await prisma.lead.findMany({
      where: { deleted_at: null, fechamento_data: { gte: inicioAno, lt: fimAno } },
      select: { created_at: true, fechamento_data: true },
    });
    const ciclos = leadsFechadosAno
      .map(l => (l.fechamento_data!.getTime() - l.created_at.getTime()) / 86400000)
      .filter(dias => dias >= 0);
    const cicloMedio = ciclos.length ? Math.round(ciclos.reduce((s, n) => s + n, 0) / ciclos.length) : null;

    const porSegmento: Record<GrupoSegmento, number> = { FARMACIA: 0, MANIPULACAO: 0, PADARIA: 0, VAREJO: 0, OUTROS: 0 };
    fechamentosAno.forEach(p => { porSegmento[segmentoDe(p.segmento)] += 1; });
    const totalAno = fechamentosAno.length;

    return {
      gerado_em: agora.toISOString(),
      fuso: 'America/Sao_Paulo',
      tela1: {
        negociacoes: {
          total: leadsNegociacao.length,
          valor_potencial: comValor.length ? soma(comValor.map(l => l.valor_estimado ?? l.valor_setup)) : null,
          com_proposta_enviada: leadsNegociacao.filter(l => l.etapa_comercial === 'PROPOSTA_ENVIADA').length,
        },
        faturamento_mes: progresso(faturamentoMes, metas.meta_faturamento_mes),
        contratos: {
          hoje: fechHoje.length,
          mes: fechMes.length,
          ticket_medio_mes: mediaPositivos(fechMes.map(valorInstalacao)),
        },
        leads_acumulados: leadsAcumulados,
        leads_novos_hoje: { total: leadsHoje.length, por_origem: porOrigem },
        qualificados_hoje: { total: null, pela_triagem: qualificadosTriagem },
        conversas_iniciadas: { total: conversasHoje.length, pelo_cliente: iniciadasCliente, pela_equipe: iniciadasEquipe },
        conversas_respondidas: { total: respondidasHoje, tempo_medio_primeira_resposta_min: mediaPrimeiraResposta(msgsConversasHoje) },
        sem_resposta: { total: semResposta, fora_do_prazo: foraDoPrazo },
        funil,
        equipe,
        atividades_hoje: totAtiv,
        alertas: {
          conversas_fora_do_prazo: foraDoPrazo,
          propostas_paradas: propostasParadas,
          leads_para_distribuir: paraDistribuir,
          cnpj_irregular_hoje: cnpjIrregular,
        },
        feed,
      },
      tela2: {
        ano: L.ano,
        contratos_ano: { ...progresso(totalAno, metas.meta_contratos_ano), ...ritmoAnual(totalAno, metas.meta_contratos_ano, L.mes) },
        servicos_ano: progresso(null, metas.meta_servicos_ano),
        crosssell_ano: {
          ...progresso(crossSellAno, metas.meta_crosssell_ano),
          vendas: vaAno.length,
          clientes: new Set(vaAno.map(v => v.cliente_id)).size,
          por_produto: Object.values(porProduto).map(p => ({ ...p, valor: Math.round(p.valor * 100) / 100 })).sort((a, b) => b.valor - a.valor),
        },
        ticket_medio_instalacao: mediaPositivos(fechamentosAno.map(valorInstalacao)),
        ticket_medio_mensalidade: mediaPositivos(fechamentosAno.map(valorMensalidade)),
        mrr_novo_ano: soma(fechamentosAno.map(valorMensalidade)),
        conversao_proposta_contrato_pct: conversao,
        ciclo_medio_dias: cicloMedio,
        faturamento_ano: { total: soma([instalacaoAno, crossSellAno]), instalacao: instalacaoAno, crosssell: crossSellAno, servicos: null },
        contratos_por_segmento: SEGMENTOS_ORDEM.map(s => ({
          segmento: LABEL_SEGMENTO[s], total: porSegmento[s],
          pct: totalAno ? Math.round((porSegmento[s] / totalAno) * 100) : 0,
        })),
        contratos_por_mes: contarPorMes(fechamentosAno.map(dataFechamento), L.ano),
        mes_atual: L.mes,
      },
    };
  }

  // ── CONFIG (gestão) ──────────────────────────────────────────────────────
  fastify.get('/painel-tv/config', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const metas = await lerMetas();
    const cfg = await lerConfig([CHAVE_TOKEN_TV]);
    const chave = cfg[CHAVE_TOKEN_TV] || null;
    const base = (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || null;
    return reply.send({
      status: 'ok',
      data: { metas, tem_chave: !!chave, chave, link: chave && base ? `${base}/tv?chave=${chave}` : null },
    });
  });

  fastify.put('/painel-tv/config', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const num = z.union([z.number().nonnegative(), z.null()]).optional();
    const body = z.object({
      meta_contratos_ano: num, meta_servicos_ano: num, meta_crosssell_ano: num, meta_faturamento_mes: num,
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Metas inválidas — use números.' });
    const por = getUser(request)?.id || 'user';
    for (const k of Object.keys(CHAVES_METAS_TV) as CampoMetaTv[]) {
      const v = body.data[k];
      if (v === undefined) continue;
      await salvarConfig(CHAVES_METAS_TV[k], v == null || v === 0 ? '' : String(v), por);
    }
    cache = null;
    return reply.send({ status: 'ok', data: { metas: await lerMetas() } });
  });

  fastify.post('/painel-tv/chave', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const chave = randomBytes(24).toString('hex');
    await salvarConfig(CHAVE_TOKEN_TV, chave, getUser(request)?.id || 'user');
    const base = (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || null;
    return reply.send({ status: 'ok', data: { chave, link: base ? `${base}/tv?chave=${chave}` : null } });
  });
}
