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
export const TIPOS_ESPERA = ['PROGRAMACAO', 'CLIENTE', 'PROCESSAMENTO'] as const;

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
