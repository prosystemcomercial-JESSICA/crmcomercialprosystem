// Cronômetro do técnico de implantação: contas de tempo. Puro (sem banco).
// Horário de Brasília fixo (-03:00, sem horário de verão desde 2019).

export type Jornada = {
  inicio: string; // "08:00"
  fim: string; // "18:00"
  almoco_inicio: string; // "12:00"
  almoco_min: number; // 60
  virada_inicio: string; // "07:00" (dia de virada da loja)
  dias: number[]; // dias úteis, 0 = domingo
};

export const JORNADA_PADRAO: Jornada = { inicio: '08:00', fim: '18:00', almoco_inicio: '12:00', almoco_min: 60, virada_inicio: '07:00', dias: [1, 2, 3, 4, 5] };

export const ETAPAS = ['ONBOARDING', 'INSTALACAO', 'CONVERSAO', 'TREINAMENTO', 'ASSISTIDA', 'CORRECAO'] as const;
export const TIPOS_SESSAO = ['DEMANDA', 'SUPORTE', 'REUNIAO', 'INTERNO'] as const;
// Esperas (30/10/2026): PROGRAMACAO é o desenvolvimento (Sinval); N3 é o suporte nível 3; PRE_REQUISITO nasce sozinho
// dos itens do cliente que impedem começar (não se abre à mão).
export const TIPOS_ESPERA = ['PROGRAMACAO', 'N3', 'CLIENTE', 'PROCESSAMENTO'] as const;
export const NOME_ESPERA: Record<string, string> = {
  PROGRAMACAO: 'aguardando desenvolvimento (Sinval)', N3: 'aguardando N3', CLIENTE: 'aguardando cliente',
  PRE_REQUISITO: 'aguardando pré-requisitos do cliente', PROCESSAMENTO: 'processamento em andamento',
};
/** Repasse interno: a demanda saiu do técnico para outro setor e o tempo até voltar é medido. */
export const ESPERAS_INTERNAS = ['PROGRAMACAO', 'N3'];

type Intervalo = { inicio: Date; fim: Date };
export type SessaoTempo = { inicio: Date; fim: Date | null; tipo: string; etapa?: string | null; implantacao_id?: string | null };
export type EsperaTempo = { inicio: Date; fim: Date | null; tipo: string };

const H = 3600000;
export const diaSP = (d: Date) => new Date(d.getTime() - 3 * H).toISOString().slice(0, 10);
export const emSP = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);
const somaMin = (d: Date, min: number) => new Date(d.getTime() + min * 60000);
const dur = (i: Intervalo) => Math.max(0, i.fim.getTime() - i.inicio.getTime());

/** Junta intervalos que se sobrepõem: uma hora com duas sessões abertas conta uma hora. */
export function unirIntervalos(lista: Intervalo[]): Intervalo[] {
  const ord = lista.filter(i => dur(i) > 0).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const out: Intervalo[] = [];
  for (const i of ord) {
    const ult = out[out.length - 1];
    if (ult && i.inicio.getTime() <= ult.fim.getTime()) { if (i.fim > ult.fim) ult.fim = i.fim; }
    else out.push({ inicio: i.inicio, fim: i.fim });
  }
  return out;
}

/** Tempo (ms) dos intervalos que cai dentro das janelas. */
export function sobreposicao(intervalos: Intervalo[], janelas: Intervalo[]): number {
  let t = 0;
  for (const i of intervalos) for (const j of janelas) {
    const a = Math.max(i.inicio.getTime(), j.inicio.getTime()), b = Math.min(i.fim.getTime(), j.fim.getTime());
    if (b > a) t += b - a;
  }
  return t;
}

/** Janelas de trabalho do dia (antes e depois do almoço). Fim de semana/feriado: nenhuma. */
export function janelasDaJornada(dia: string, cfg: Jornada = JORNADA_PADRAO, virada = false): Intervalo[] {
  const semana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  if (!cfg.dias.includes(semana)) return [];
  const ini = emSP(dia, virada ? cfg.virada_inicio : cfg.inicio), fim = emSP(dia, cfg.fim);
  const almIni = emSP(dia, cfg.almoco_inicio), almFim = somaMin(almIni, cfg.almoco_min);
  return [{ inicio: ini, fim: almIni }, { inicio: almFim, fim }].filter(j => dur(j) > 0);
}

/** Recorta as sessões no dia (00:00 às 24:00 de Brasília); sessão aberta vai até "agora". */
function sessoesNoDia(sessoes: SessaoTempo[], dia: string, agora: Date) {
  const a = emSP(dia, '00:00'), b = new Date(a.getTime() + 24 * H);
  return sessoes.map(s => {
    const fim = s.fim || agora;
    return { s, i: { inicio: new Date(Math.max(s.inicio.getTime(), a.getTime())), fim: new Date(Math.min(fim.getTime(), b.getTime())) } };
  }).filter(x => dur(x.i) > 0);
}

export type ResumoDia = {
  dia: string; virada: boolean;
  trabalhado_ms: number; dentro_ms: number; extra_ms: number; jornada_ms: number;
  aproveitamento: number | null; // 0 a 1 (tempo dentro da jornada ÷ jornada)
  por_tipo: Record<string, number>; por_etapa: Record<string, number>; por_demanda: Record<string, number>;
};

export function resumoDoDia(sessoes: SessaoTempo[], dia: string, o: { cfg?: Jornada; virada?: boolean; agora?: Date } = {}): ResumoDia {
  const cfg = o.cfg || JORNADA_PADRAO, agora = o.agora || new Date(), virada = !!o.virada;
  const nd = sessoesNoDia(sessoes, dia, agora);
  const uniao = unirIntervalos(nd.map(x => x.i));
  const janelas = janelasDaJornada(dia, cfg, virada);
  const trabalhado = uniao.reduce((t, i) => t + dur(i), 0);
  const dentro = sobreposicao(uniao, janelas);
  const jornada = janelas.reduce((t, j) => t + dur(j), 0);
  const soma = (k: (s: SessaoTempo) => string | null | undefined) => nd.reduce((acc, x) => {
    const c = k(x.s); if (c) acc[c] = (acc[c] || 0) + dur(x.i); return acc;
  }, {} as Record<string, number>);
  return {
    dia, virada, trabalhado_ms: trabalhado, dentro_ms: dentro, extra_ms: trabalhado - dentro, jornada_ms: jornada,
    aproveitamento: jornada ? Math.min(1, dentro / jornada) : null,
    por_tipo: soma(s => s.tipo), por_etapa: soma(s => (s.tipo === 'DEMANDA' ? s.etapa || 'SEM_ETAPA' : null)), por_demanda: soma(s => s.implantacao_id || null),
  };
}

/** Sessão esquecida aberta fecha às 23:59:59 do dia em que começou. */
export const fimAutomatico = (inicio: Date) => new Date(emSP(diaSP(inicio), '23:59').getTime() + 59000);

export type TemposDemanda = {
  trabalho_ms: number; por_etapa: Record<string, number>; sessoes: number;
  esperas: Record<string, { qtd: number; ms: number; abertas: number }>;
  prazo_total_ms: number | null;
};

/** Tempos de uma demanda: trabalho efetivo por etapa, esperas por tipo e prazo total (assinatura → conclusão). */
export function temposDaDemanda(sessoes: SessaoTempo[], esperas: EsperaTempo[], o: { inicio?: Date | null; conclusao?: Date | null; agora?: Date } = {}): TemposDemanda {
  const agora = o.agora || new Date();
  const ints = sessoes.map(s => ({ s, i: { inicio: s.inicio, fim: s.fim || agora } }));
  const por_etapa: Record<string, number> = {};
  for (const x of ints) { const e = x.s.etapa || 'SEM_ETAPA'; por_etapa[e] = (por_etapa[e] || 0) + dur(x.i); }
  const esp: TemposDemanda['esperas'] = {};
  for (const e of esperas) {
    const k = (esp[e.tipo] ||= { qtd: 0, ms: 0, abertas: 0 });
    k.qtd++; k.ms += Math.max(0, (e.fim || agora).getTime() - e.inicio.getTime()); if (!e.fim) k.abertas++;
  }
  return {
    trabalho_ms: unirIntervalos(ints.map(x => x.i)).reduce((t, i) => t + dur(i), 0), por_etapa, sessoes: sessoes.length, esperas: esp,
    prazo_total_ms: o.inicio ? Math.max(0, (o.conclusao || agora).getTime() - o.inicio.getTime()) : null,
  };
}

// ─── Para onde vai o tempo (30/10/2026, pedido da Jessica) ─────────────────────
// Executando: o que o cronômetro marcou, a qualquer hora (trabalho fora do horário conta).
// Esperando: o cliente (no meio do trabalho e pré-requisitos) e os repasses internos (desenvolvimento/Sinval e N3).
// As esperas são medidas em horas úteis (jornada do portal; noite e fim de semana não contam) e em horas corridas.

/** Tempo dos intervalos dentro da jornada (dias úteis, sem almoço). */
export function msUteis(intervalos: Intervalo[], cfg: Jornada = JORNADA_PADRAO): number {
  const uniao = unirIntervalos(intervalos);
  if (!uniao.length) return 0;
  let t = 0;
  const ini = uniao[0].inicio.getTime(), fim = uniao[uniao.length - 1].fim.getTime();
  for (let d = ini - 24 * H; d <= fim + 24 * H; d += 24 * H) t += sobreposicao(uniao, janelasDaJornada(diaSP(new Date(d)), cfg));
  return t;
}

export type EsperaRelatorio = { tipo: string; inicio: Date; fim: Date | null; implantacao_id: string; id?: string; cliente?: string | null; ticket_id?: string | null };
export type SessaoRelatorio = { inicio: Date; fim: Date | null; implantacao_id: string | null; tecnico_id?: string | null; cliente?: string | null };
export type TempoPorTipo = {
  qtd: number; abertas: number; ms: number; uteis_ms: number; voltaram: number; retorno_medio_uteis_ms: number | null; retorno_medio_ms: number | null; retorno_max_uteis_ms: number | null;
  chamados: number; devolvidos: number; taxa_devolucao_pct: number | null; // chamados internos abertos no período e quantos voltaram com problema
};

/** Relatório do período: executando x esperando (por destino), tempo até voltar e o retrato de cada demanda. */
export function relatorioDeTempo(sessoes: SessaoRelatorio[], esperas: EsperaRelatorio[], de: Date, ate: Date, o: { cfg?: Jornada; agora?: Date } = {}) {
  const cfg = o.cfg || JORNADA_PADRAO, agora = o.agora || new Date();
  const corta = (i: { inicio: Date; fim: Date | null }) => ({ inicio: new Date(Math.max(i.inicio.getTime(), de.getTime())), fim: new Date(Math.min((i.fim || agora).getTime(), ate.getTime())) });
  const total = (xs: Intervalo[]) => unirIntervalos(xs).reduce((t, i) => t + dur(i), 0);
  const demandas = sessoes.filter(s => s.implantacao_id);
  // Trabalho: cada técnico conta uma vez o que fez ao mesmo tempo; dois técnicos juntos somam.
  const trabalho = (ss: SessaoRelatorio[]) => [...new Set(ss.map(s => s.tecnico_id || ''))].reduce((t, tid) => t + total(ss.filter(s => (s.tecnico_id || '') === tid).map(corta)), 0);
  const por_tipo: Record<string, TempoPorTipo> = {};
  // Chamados internos abertos no período (a primeira rodada começou nele); devolvido = teve mais de uma rodada.
  const chamadosDo = (xs: EsperaRelatorio[]) => {
    if (!ESPERAS_INTERNAS.includes(xs[0]?.tipo || '')) return { chamados: 0, devolvidos: 0, taxa_devolucao_pct: null };
    const raizes = xs.filter(e => !e.ticket_id && e.inicio >= de && e.inicio < ate);
    const devolvidos = raizes.filter(r => r.id && esperas.some(e => e.ticket_id === r.id)).length;
    return { chamados: raizes.length, devolvidos, taxa_devolucao_pct: raizes.length ? Math.round((devolvidos / raizes.length) * 100) : null };
  };
  for (const tipo of ['PRE_REQUISITO', 'CLIENTE', 'PROGRAMACAO', 'N3', 'PROCESSAMENTO']) {
    const xs = esperas.filter(e => e.tipo === tipo);
    const ints = xs.map(corta);
    // Tempo até voltar: esperas que terminaram no período, inteiras (do repasse até a volta).
    const voltaram = xs.filter(e => e.fim && e.fim >= de && e.fim < ate).map(e => ({ ms: e.fim!.getTime() - e.inicio.getTime(), uteis: msUteis([{ inicio: e.inicio, fim: e.fim! }], cfg) }));
    const media = (k: 'ms' | 'uteis') => voltaram.length ? Math.round(voltaram.reduce((t, v) => t + v[k], 0) / voltaram.length) : null;
    por_tipo[tipo] = {
      qtd: xs.length, abertas: xs.filter(e => !e.fim).length, ms: total(ints), uteis_ms: msUteis(ints, cfg),
      voltaram: voltaram.length, retorno_medio_uteis_ms: media('uteis'), retorno_medio_ms: media('ms'), retorno_max_uteis_ms: voltaram.length ? Math.max(...voltaram.map(v => v.uteis)) : null,
      ...chamadosDo(xs),
    };
  }
  const grupo = (xs: EsperaRelatorio[], tipos: string[]) => xs.filter(e => tipos.includes(e.tipo)).map(corta);
  const CLI = ['CLIENTE', 'PRE_REQUISITO'], INT = ['PROGRAMACAO', 'N3'];
  const ids = [...new Set([...demandas.map(s => s.implantacao_id!), ...esperas.map(e => e.implantacao_id)])];
  const por_demanda = ids.map(id => {
    const es = esperas.filter(e => e.implantacao_id === id);
    const ss = demandas.filter(s => s.implantacao_id === id);
    const uteis = (tipos: string[]) => msUteis(grupo(es, tipos), cfg);
    return {
      implantacao_id: id, cliente: ss[0]?.cliente || es[0]?.cliente || '—',
      executando_ms: trabalho(ss), cliente_uteis_ms: uteis(CLI), pre_requisito_uteis_ms: uteis(['PRE_REQUISITO']),
      interno_uteis_ms: uteis(INT), desenvolvimento_uteis_ms: uteis(['PROGRAMACAO']), n3_uteis_ms: uteis(['N3']), processamento_uteis_ms: uteis(['PROCESSAMENTO']),
      paradas_agora: es.filter(e => !e.fim).map(e => e.tipo),
      chamados: es.filter(e => ESPERAS_INTERNAS.includes(e.tipo) && !e.ticket_id).length, devolucoes: es.filter(e => ESPERAS_INTERNAS.includes(e.tipo) && e.ticket_id).length,
    };
  }).filter(d => d.executando_ms || d.cliente_uteis_ms || d.interno_uteis_ms || d.processamento_uteis_ms || d.paradas_agora.length)
    .sort((a, b) => (b.executando_ms + b.cliente_uteis_ms + b.interno_uteis_ms) - (a.executando_ms + a.cliente_uteis_ms + a.interno_uteis_ms));
  return {
    executando_ms: trabalho(demandas),
    cliente_uteis_ms: msUteis(grupo(esperas, CLI), cfg), interno_uteis_ms: msUteis(grupo(esperas, INT), cfg),
    por_tipo, por_demanda,
  };
}

// ─── Tickets de repasse (30/10/2026, ideia da Jessica) ─────────────────────────
// Cada repasse ao desenvolvimento (Sinval) ou ao N3 é um ticket dentro do card. Cada ida ao setor é uma rodada
// (uma ImplantacaoEspera; a primeira é a raiz, as outras têm ticket_id = raiz). O setor devolve → "voltou para teste";
// o técnico testa: resolveu → fecha (fechado_em na raiz); não resolveu → devolve, abrindo nova rodada com motivo.
export type RodadaTicket = { id: string; tipo: string; motivo: string; o_que_resolver?: string | null; responsavel_nome?: string | null; inicio: Date; fim: Date | null; resposta?: string | null; resolvida_por_nome?: string | null; ticket_id?: string | null; fechado_em?: Date | null; fechado_por?: string | null; aberta_por_nome?: string | null };
export type Ticket = {
  id: string; tipo: string; setor: string; motivo: string; o_que_resolver: string | null; aberto_por: string | null; aberto_em: Date;
  situacao: 'COM_SETOR' | 'EM_TESTE' | 'FECHADO'; rodadas: RodadaTicket[]; devolucoes: number; com_setor_ms: number; em_teste_ms: number; fechado_em: Date | null; fechado_por: string | null;
};

export function ticketsDaDemanda(esperas: RodadaTicket[], agora = new Date()): Ticket[] {
  const internas = esperas.filter(e => ESPERAS_INTERNAS.includes(e.tipo));
  return internas.filter(e => !e.ticket_id).map(raiz => {
    const rodadas = [raiz, ...internas.filter(e => e.ticket_id === raiz.id)].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    const ult = rodadas[rodadas.length - 1];
    const situacao: Ticket['situacao'] = raiz.fechado_em ? 'FECHADO' : !ult.fim ? 'COM_SETOR' : 'EM_TESTE';
    let com = 0, teste = 0;
    rodadas.forEach((r, k) => {
      const fimR = r.fim || agora;
      com += Math.max(0, fimR.getTime() - r.inicio.getTime());
      if (r.fim) { const prox = rodadas[k + 1]?.inicio || raiz.fechado_em || agora; teste += Math.max(0, prox.getTime() - r.fim.getTime()); }
    });
    return {
      id: raiz.id, tipo: raiz.tipo, setor: raiz.tipo === 'N3' ? 'N3' : 'Desenvolvimento (Sinval)', motivo: raiz.motivo, o_que_resolver: raiz.o_que_resolver || null,
      aberto_por: raiz.aberta_por_nome || null, aberto_em: raiz.inicio, situacao, rodadas, devolucoes: rodadas.length - 1, com_setor_ms: com, em_teste_ms: teste,
      fechado_em: raiz.fechado_em || null, fechado_por: raiz.fechado_por || null,
    };
  }).sort((a, b) => b.aberto_em.getTime() - a.aberto_em.getTime());
}

/** Chamados do cliente (tarefas do cliente) pedidos no período: entregues, devolvidas, tempo até entregar (horas úteis). */
export function resumoTarefasCliente(tarefas: { status: string; created_at: Date; enviada_em: Date | null; concluida_em: Date | null; devolucoes: number; bloqueia_inicio: boolean }[], cfg: Jornada = JORNADA_PADRAO) {
  const entregues = tarefas.filter(t => t.enviada_em || t.concluida_em);
  const tempos = entregues.map(t => msUteis([{ inicio: t.created_at, fim: (t.enviada_em || t.concluida_em)! }], cfg));
  const devolvidas = tarefas.filter(t => t.devolucoes > 0).length;
  return {
    pedidas: tarefas.length, entregues: entregues.length, pendentes: tarefas.filter(t => t.status === 'PENDENTE').length,
    pre_requisitos: tarefas.filter(t => t.bloqueia_inicio).length, devolvidas, taxa_devolucao_pct: entregues.length ? Math.round((devolvidas / entregues.length) * 100) : null,
    entrega_media_uteis_ms: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
  };
}
