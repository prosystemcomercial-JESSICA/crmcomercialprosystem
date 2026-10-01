import { PrismaClient } from '@prisma/client';
import { AGENTES } from '@/lib/assistente/escritorio';
import { limitesPeriodo, CARGOS_EQUIPE_TV } from '@/lib/painel-tv';
import { montarEscritorio, historicoAgente } from './escritorio.service';

/**
 * TV DO ESCRITÓRIO — quem está trabalhando e o que precisa de ação agora.
 * Somente leitura; reaproveita o estado do escritório virtual.
 *
 *  - esperando: o cliente escreveu e ninguém respondeu (ou o SLA venceu)
 *  - sumiram:   a última mensagem foi nossa e o cliente não responde há 24h+
 *  - qualificados: leads qualificados pela triagem ou com demo marcada hoje (a TV apita)
 */

const MIN_ESPERANDO = 10;          // cliente sem resposta há mais que isso entra no alerta
const HORAS_SUMIU = 24;            // nossa mensagem sem retorno há mais que isso
const DIAS_JANELA = 7;             // conversas mais antigas que isso não entram nos alertas
const MIN_ONLINE = 15;             // pessoa mandou mensagem nesse intervalo = online
const ETIQUETAS_NAO_COMERCIAIS = ['Suporte', 'Financeiro'];

const nomeContato = (c: { contato_nome: string | null; contato_numero: string }) => c.contato_nome || c.contato_numero;

// Comemoração de teste (POST /painel-tv/escritorio/teste-comemoracao): aparece na TV por 3 minutos.
const comemoracoesTeste: any[] = [];
export function dispararComemoracaoTeste() {
  const em = new Date().toISOString();
  comemoracoesTeste.splice(0, comemoracoesTeste.length, { id: `teste-${Date.now()}`, tipo: 'aceita', status: 'ACEITA', em, cliente: 'Farmácia Teste', plano: 'PLUS', por: 'Teste', mensalidade: 400, implantacao: 2500, teste: true });
}

export async function montarTvEscritorio(prisma: PrismaClient, agora = new Date()) {
  const { inicioHoje, fimHoje } = limitesPeriodo(agora);
  const hoje = { gte: inicioHoje, lt: fimHoje };
  const janela = new Date(agora.getTime() - DIAS_JANELA * 86400000);
  const abertas = {
    finalizada_em: null,
    estagio_funil: { not: 'FECHADO' },
    OR: [{ etiqueta: null }, { etiqueta: { notIn: ETIQUETAS_NAO_COMERCIAIS } }],
    AND: [{ OR: [{ tipo_contato: null }, { tipo_contato: { not: 'EQUIPE' } }] }], // conversa da equipe não entra no painel
  };

  const agentes = await montarEscritorio(prisma, agora);

  // ── Equipe (pessoas) ─────────────────────────────────────────────────────
  const usuarios = await prisma.usuarioCRM.findMany({
    where: { status: 'ATIVO', OR: [{ cargo: { in: CARGOS_EQUIPE_TV } }, { vende: true }] },
    select: { id: true, nome: true, cargo: true },
  });
  const nomeUsuario = new Map(usuarios.map(u => [u.id, u.nome.split(' ')[0]]));
  const equipe = await Promise.all(usuarios.map(async u => {
    const [ultima, enviadasHoje, esperando] = await Promise.all([
      prisma.whatsappMensagem.findFirst({ where: { direcao: 'SAIDA', enviada_por: u.id }, orderBy: { created_at: 'desc' }, select: { created_at: true, conversa: { select: { contato_nome: true, contato_numero: true } } } }),
      prisma.whatsappMensagem.count({ where: { direcao: 'SAIDA', enviada_por: u.id, created_at: hoje } }),
      prisma.whatsappConversa.count({ where: { ...abertas, dono_id: u.id, nao_lidas: { gt: 0 }, ultima_em: { gte: janela } } }),
    ]);
    const online = !!ultima && agora.getTime() - ultima.created_at.getTime() <= MIN_ONLINE * 60000;
    return {
      id: u.id, nome: u.nome.split(' ')[0], cargo: u.cargo, online,
      ultima: ultima ? { texto: `respondeu ${nomeContato(ultima.conversa)}`, em: ultima.created_at.toISOString() } : null,
      enviadas_hoje: enviadasHoje, esperando,
    };
  }));

  // ── Cliente esperando resposta ───────────────────────────────────────────
  const limiteEsperando = new Date(agora.getTime() - MIN_ESPERANDO * 60000);
  const esperandoWhere = {
    ...abertas,
    ultima_em: { gte: janela },
    AND: [...abertas.AND, { OR: [{ nao_lidas: { gt: 0 }, ultima_em: { lt: limiteEsperando } }, { sla_prazo_em: { lt: agora }, nao_lidas: { gt: 0 } }] }],
  };
  const [esperandoTotal, esperandoLista] = await Promise.all([
    prisma.whatsappConversa.count({ where: esperandoWhere }),
    prisma.whatsappConversa.findMany({
      where: esperandoWhere, orderBy: { ultima_em: 'asc' }, take: 12,
      select: { id: true, contato_nome: true, contato_numero: true, ultima_em: true, nao_lidas: true, dono_id: true, ultima_mensagem: true },
    }),
  ]);
  const esperando = esperandoLista.map(c => ({
    id: c.id, contato: nomeContato(c), desde: c.ultima_em!.toISOString(), nao_lidas: c.nao_lidas,
    responsavel: (c.dono_id && nomeUsuario.get(c.dono_id)) || 'sem dono', trecho: (c.ultima_mensagem || '').slice(0, 70),
  }));

  // ── Leads que pararam de responder ───────────────────────────────────────
  const limiteSumiu = new Date(agora.getTime() - HORAS_SUMIU * 3600000);
  const candidatas = await prisma.whatsappConversa.findMany({
    where: { ...abertas, nao_lidas: 0, bot_ativo: false, ultima_em: { gte: janela, lt: limiteSumiu } },
    orderBy: { ultima_em: 'desc' }, take: 80,
    select: { id: true, contato_nome: true, contato_numero: true, ultima_em: true, dono_id: true, estagio_funil: true },
  });
  const ultimas = await Promise.all(candidatas.map(c => prisma.whatsappMensagem.findFirst({
    where: { conversaId: c.id }, orderBy: { created_at: 'desc' }, select: { direcao: true },
  })));
  const sumiramWpp = candidatas.filter((_, i) => ultimas[i]?.direcao === 'SAIDA').map(c => ({
    id: c.id, contato: nomeContato(c), desde: c.ultima_em!.toISOString(),
    responsavel: (c.dono_id && nomeUsuario.get(c.dono_id)) || 'sem dono', origem: 'whatsapp' as const,
  }));
  const sdrParados = await prisma.sdrLead.findMany({
    where: { status: 'AGUARDANDO', updated_at: { gte: janela } }, orderBy: { updated_at: 'desc' }, take: 40,
    select: { id: true, nome: true, empresa: true, numero: true, agente: true, tentativas: true, dados: true, updated_at: true },
  });
  const sumiramSdr = sdrParados.filter(s => (s.dados as any)?.parou_em).map(s => ({
    id: `sdr-${s.id}`, contato: s.empresa || s.nome || s.numero, desde: String((s.dados as any).parou_em),
    responsavel: AGENTES.find(a => a.id === s.agente)?.nome || s.agente, origem: 'agente' as const, tentativas: s.tentativas,
  }));
  const sumiram = [...sumiramWpp, ...sumiramSdr].sort((a, b) => b.desde.localeCompare(a.desde));

  // ── Qualificados hoje (disparam o apito) ─────────────────────────────────
  const [obsTriagem, demosSdr] = await Promise.all([
    prisma.leadObservacao.findMany({
      where: { created_at: hoje, created_by: 'bot', created_by_name: 'Triagem automática' }, orderBy: { created_at: 'desc' }, take: 20,
      select: { id: true, created_at: true, lead: { select: { nome: true, nome_fantasia: true } } },
    }),
    prisma.sdrLead.findMany({
      where: { status: 'DEMO', updated_at: hoje }, orderBy: { updated_at: 'desc' }, take: 20,
      select: { id: true, nome: true, empresa: true, numero: true, agente: true, updated_at: true },
    }),
  ]);
  const qualificados = [
    ...obsTriagem.map(o => ({ id: `obs-${o.id}`, contato: o.lead.nome_fantasia || o.lead.nome, por: 'Bia (triagem)', em: o.created_at.toISOString() })),
    ...demosSdr.map(s => ({ id: `demo-${s.id}`, contato: s.empresa || s.nome || s.numero, por: `${AGENTES.find(a => a.id === s.agente)?.nome || s.agente} · demo marcada`, em: s.updated_at.toISOString() })),
  ].sort((a, b) => b.em.localeCompare(a.em));

  // ── Aprovações pendentes ─────────────────────────────────────────────────
  const [msgsParaAprovar, docsParaAprovar] = await Promise.all([
    prisma.sdrMensagem.count({ where: { status: 'PENDENTE' } }),
    prisma.especialistaDoc.count({ where: { status: 'PROPOSTO' } }).catch(() => 0),
  ]);

  // ── Movimentos do WhatsApp (últimas mensagens, quem falou com quem) ──────
  const REMETENTE: Record<string, string> = {
    bot: 'Bia', assistente_ia: 'Clarice', cadencia_automatica: 'Luiz Felipe', luiz_felipe: 'Luiz Felipe',
    caroline: 'Caroline', julio: 'Julio', campanha: 'Zequinha',
  };
  const msgs = await prisma.whatsappMensagem.findMany({
    where: { created_at: { gte: new Date(agora.getTime() - 12 * 3600000) }, conversa: { OR: [{ tipo_contato: null }, { tipo_contato: { not: 'EQUIPE' } }] } },
    orderBy: { created_at: 'desc' }, take: 40,
    select: { id: true, direcao: true, tipo: true, conteudo: true, enviada_por: true, created_at: true, conversa: { select: { contato_nome: true, contato_numero: true } } },
  });
  // ── Propostas: abertas por telefone (bolinha nas mensagens), números e acontecimentos ──
  const ABERTAS = ['ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'];
  const u8 = (t: string | null | undefined) => (t || '').replace(/\D/g, '').slice(-8);
  const propsAbertas = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, status: { in: ABERTAS } } as any,
    select: { id: true, status: true, responsavel_telefone: true, nome_fantasia: true, razao_social: true },
  }).catch(() => []);
  const vistasRecentes = await prisma.propostaHistorico.findMany({
    where: { valor_novo: 'VISUALIZADA', created_at: { gte: new Date(agora.getTime() - 2 * 3600_000) } }, select: { proposta_id: true },
  }).catch(() => []);
  const vistaAgora = new Set(vistasRecentes.map(v => v.proposta_id));
  const propostaPorFone = new Map<string, { status: string; abriu_agora: boolean }>();
  // Decididas nos últimos 30 dias (aceitas/recusadas) também marcam a conversa.
  const decididas = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, status: { in: ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO', 'RECUSADA', 'PERDIDA'] }, updated_at: { gte: new Date(agora.getTime() - 30 * 864e5) } } as any,
    select: { status: true, responsavel_telefone: true },
  }).catch(() => []);
  for (const pr of decididas) {
    const k = u8(pr.responsavel_telefone);
    if (k.length === 8) propostaPorFone.set(k, { status: pr.status, abriu_agora: false });
  }
  for (const pr of propsAbertas) {
    const k = u8(pr.responsavel_telefone);
    if (k.length === 8) propostaPorFone.set(k, { status: pr.status, abriu_agora: vistaAgora.has(pr.id) });
  }
  const STATUS_EVENTO: Record<string, string> = { ENVIADA: 'enviada', VISUALIZADA: 'cliente abriu', EM_NEGOCIACAO: 'em negociação', ACEITA: 'aceita', CONTRATO_EM_GERACAO: 'aceita', RECUSADA: 'recusada', PERDIDA: 'perdida' };
  const hist = await prisma.propostaHistorico.findMany({
    where: { tipo: 'STATUS', valor_novo: { in: Object.keys(STATUS_EVENTO) }, created_at: { gte: new Date(agora.getTime() - 48 * 3600_000) } },
    orderBy: { created_at: 'desc' }, take: 12,
    select: { id: true, valor_novo: true, created_at: true, feito_por_nome: true, proposta: { select: { nome_fantasia: true, razao_social: true, plano_selecionado: true, vendedor_nome: true, mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, valor_final: true, valor_implantacao: true } } },
  }).catch(() => []);
  const [enviadasHoje, abertasHoje, aceitasMes, recusadasMes] = await Promise.all([
    prisma.propostaHistorico.count({ where: { valor_novo: 'ENVIADA', created_at: hoje } }).catch(() => 0),
    prisma.propostaHistorico.count({ where: { valor_novo: 'VISUALIZADA', created_at: hoje } }).catch(() => 0),
    prisma.propostaComercial.count({ where: { deleted_at: null, data_aceite: { gte: limitesPeriodo(agora).inicioMes } } as any }).catch(() => 0),
    prisma.propostaHistorico.count({ where: { valor_novo: { in: ['RECUSADA', 'PERDIDA'] }, created_at: { gte: limitesPeriodo(agora).inicioMes } } }).catch(() => 0),
  ]);
  const propostas = {
    enviadas_hoje: enviadasHoje, abertas_hoje: abertasHoje, em_aberto: propsAbertas.length, aceitas_mes: aceitasMes, recusadas_mes: recusadasMes,
    abriram_agora: vistasRecentes.length,
    eventos: [...hist.map(h => ({
      id: h.id, tipo: STATUS_EVENTO[h.valor_novo || ''] || h.valor_novo, status: h.valor_novo, em: h.created_at.toISOString(),
      cliente: (h.proposta?.nome_fantasia || h.proposta?.razao_social || 'Cliente').trim(), plano: h.proposta?.plano_selecionado || null,
      por: h.valor_novo === 'VISUALIZADA' ? 'cliente' : (h.proposta?.vendedor_nome || h.feito_por_nome || '').split(' ')[0] || null,
      mensalidade: (() => { const x: any = h.proposta || {}; const pl = String(x.plano_selecionado || '').toUpperCase(); return (pl === 'BASIC' ? x.mensalidade_basic : pl === 'PRO' ? x.mensalidade_pro : pl === 'PLUS' ? x.mensalidade_plus : null) || null; })(),
      implantacao: h.proposta?.valor_final || h.proposta?.valor_implantacao || null,
    })), ...comemoracoesTeste.filter(c => agora.getTime() - new Date(c.em).getTime() < 3 * 60_000)],
  };

  const movimentos = msgs.map(m => {
    const quem = m.direcao === 'ENTRADA' ? null
      : REMETENTE[m.enviada_por || ''] || (m.enviada_por && nomeUsuario.get(m.enviada_por)) || 'Equipe (celular)';
    const texto = (m.conteudo || '').replace(/\s+/g, ' ').trim();
    return {
      id: m.id, direcao: m.direcao, quem, agente: !!REMETENTE[m.enviada_por || ''], contato: nomeContato(m.conversa),
      proposta: propostaPorFone.get(u8(m.conversa.contato_numero)) || null,
      texto: texto ? texto.slice(0, 120) : m.tipo !== 'TEXTO' ? `[${String(m.tipo).toLowerCase()}]` : '', em: m.created_at.toISOString(),
    };
  });

  // Conversas em andamento com os agentes SDR
  const conversandoSdr = await prisma.sdrLead.findMany({
    where: { status: 'CONVERSANDO' }, orderBy: { updated_at: 'desc' }, take: 12,
    select: { id: true, agente: true, nome: true, empresa: true, numero: true, temperatura: true, nota: true, ultima_lead_em: true, updated_at: true },
  });
  const conversando = conversandoSdr.map(s => ({
    id: s.id, agente: AGENTES.find(a => a.id === s.agente)?.nome || s.agente, contato: s.empresa || s.nome || s.numero,
    temperatura: s.temperatura, nota: s.nota, em: (s.ultima_lead_em || s.updated_at).toISOString(),
  }));

  // ── Feed do dia ─────────────────────────────────────────────────────────
  const historicos = await Promise.all(AGENTES.map(a => historicoAgente(prisma, a.id).then(h => h.map(x => ({ ...x, agente: a.nome }))).catch(() => [])));
  const feed = historicos.flat()
    .filter(x => new Date(x.em) >= inicioHoje)
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, 30);

  return {
    gerado_em: agora.toISOString(),
    agentes, equipe,
    esperando: { total: esperandoTotal, lista: esperando },
    sumiram: { total: sumiram.length, lista: sumiram.slice(0, 12) },
    qualificados,
    aprovacoes: { mensagens: msgsParaAprovar, documentos: docsParaAprovar },
    feed, movimentos, conversando, propostas,
    laya: await import('./laya-caderno.service').then(async m => { const r = await m.resumoCaderno(prisma); return { tarefas: r.tarefas, total: r.total, cerebro: r.cerebro }; }).catch(() => null),
    captacao: await import('./tv-captacao.service').then(m => m.montarCaptacao(prisma, agora)).catch((e: any) => { console.warn('[TV] captação:', e?.message); return null; }),
  };
}
