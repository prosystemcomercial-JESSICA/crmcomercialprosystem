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

export async function montarTvEscritorio(prisma: PrismaClient, agora = new Date()) {
  const { inicioHoje, fimHoje } = limitesPeriodo(agora);
  const hoje = { gte: inicioHoje, lt: fimHoje };
  const janela = new Date(agora.getTime() - DIAS_JANELA * 86400000);
  const abertas = {
    finalizada_em: null,
    estagio_funil: { not: 'FECHADO' },
    OR: [{ etiqueta: null }, { etiqueta: { notIn: ETIQUETAS_NAO_COMERCIAIS } }],
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
    AND: [{ OR: [{ nao_lidas: { gt: 0 }, ultima_em: { lt: limiteEsperando } }, { sla_prazo_em: { lt: agora }, nao_lidas: { gt: 0 } }] }],
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
    feed,
  };
}
