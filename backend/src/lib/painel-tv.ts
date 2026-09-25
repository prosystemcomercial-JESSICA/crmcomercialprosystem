import { timingSafeEqual } from 'crypto';

/**
 * Painel da TV (setor comercial) — lógica PURA: limites de data no fuso de
 * São Paulo, regras de conversa do WhatsApp e formatação das métricas.
 * Sem Prisma aqui, para ser testável (tests/painel-tv.test.ts).
 *
 * Regra geral: métrica que não dá para calcular com confiança vira `null`
 * (a TV mostra "sem dados") — nunca um 0 inventado.
 */

export const FUSO_PAINEL = 'America/Sao_Paulo';

// Chaves em ConfiguracaoIntegracao.
export const CHAVE_TOKEN_TV = 'painel_tv.chave';
export const CHAVES_METAS_TV = {
  meta_contratos_ano: 'painel_tv.meta_contratos_ano',
  meta_servicos_ano: 'painel_tv.meta_servicos_ano',
  meta_crosssell_ano: 'painel_tv.meta_crosssell_ano',
  meta_faturamento_mes: 'painel_tv.meta_faturamento_mes',
} as const;
export type CampoMetaTv = keyof typeof CHAVES_METAS_TV;

// ── Fuso ────────────────────────────────────────────────────────────────────

interface PartesData { ano: number; mes: number; dia: number; hora: number; minuto: number; }

/** Ano/mês(1-12)/dia/hora/minuto do instante `d` no fuso informado. */
export function partesNoFuso(d: Date, fuso = FUSO_PAINEL): PartesData {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour % 24, minuto: +p.minute };
}

/** Diferença (ms) entre o relógio local do fuso e o UTC no instante `d`. */
function offsetMs(d: Date, fuso: string): number {
  const p = partesNoFuso(d, fuso);
  const segundos = d.getUTCSeconds();
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, segundos);
  return comoUtc - (d.getTime() - d.getUTCMilliseconds());
}

/** Instante UTC da meia-noite local (00:00 do fuso) de ano/mês(1-12)/dia. */
export function meiaNoiteNoFuso(ano: number, mes: number, dia: number, fuso = FUSO_PAINEL): Date {
  const palpite = new Date(Date.UTC(ano, mes - 1, dia));
  const off = offsetMs(palpite, fuso);
  const d = new Date(palpite.getTime() - off);
  // Reajuste se o offset mudou entre o palpite e o resultado (troca de horário de verão).
  const off2 = offsetMs(d, fuso);
  return off2 === off ? d : new Date(palpite.getTime() - off2);
}

export interface LimitesPeriodo {
  agora: Date;
  ano: number;
  mes: number; // 1-12
  inicioHoje: Date; fimHoje: Date;   // [inicio, fim)
  inicioMes: Date; fimMes: Date;
  inicioAno: Date; fimAno: Date;
}

/** Limites de hoje/mês/ano no fuso de São Paulo, como instantes UTC (intervalos semiabertos). */
export function limitesPeriodo(agora: Date, fuso = FUSO_PAINEL): LimitesPeriodo {
  const p = partesNoFuso(agora, fuso);
  const amanha = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + 1));
  const proxMes = new Date(Date.UTC(p.ano, p.mes, 1));
  return {
    agora,
    ano: p.ano,
    mes: p.mes,
    inicioHoje: meiaNoiteNoFuso(p.ano, p.mes, p.dia, fuso),
    fimHoje: meiaNoiteNoFuso(amanha.getUTCFullYear(), amanha.getUTCMonth() + 1, amanha.getUTCDate(), fuso),
    inicioMes: meiaNoiteNoFuso(p.ano, p.mes, 1, fuso),
    fimMes: meiaNoiteNoFuso(proxMes.getUTCFullYear(), proxMes.getUTCMonth() + 1, 1, fuso),
    inicioAno: meiaNoiteNoFuso(p.ano, 1, 1, fuso),
    fimAno: meiaNoiteNoFuso(p.ano + 1, 1, 1, fuso),
  };
}

export function dentro(d: Date | null | undefined, inicio: Date, fim: Date): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= inicio.getTime() && t < fim.getTime();
}

/** "HH:MM" no fuso de São Paulo. */
export function horaLocal(d: Date, fuso = FUSO_PAINEL): string {
  const p = partesNoFuso(d, fuso);
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
}

/** Contagem por mês (índice 0-11) das datas que caem no ano informado (fuso SP). */
export function contarPorMes(datas: Array<Date | null | undefined>, ano: number, fuso = FUSO_PAINEL): number[] {
  const out = Array(12).fill(0);
  for (const d of datas) {
    if (!d) continue;
    const p = partesNoFuso(new Date(d), fuso);
    if (p.ano === ano) out[p.mes - 1] += 1;
  }
  return out;
}

// ── Token da TV ─────────────────────────────────────────────────────────────

/** Compara o token recebido com o salvo em tempo constante. Vazio/ausente → false. */
export function tokenTvValido(recebido: unknown, salvo: string | null | undefined): boolean {
  if (typeof recebido !== 'string' || !recebido || !salvo) return false;
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(salvo, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Metas ───────────────────────────────────────────────────────────────────

/** Converte o valor salvo em ConfiguracaoIntegracao para número (>0) ou null. */
export function parseMeta(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface Progresso { valor: number | null; meta: number | null; pct: number | null; }

/** Progresso contra meta. pct só existe com valor e meta definidos. */
export function progresso(valor: number | null, meta: number | null): Progresso {
  const pct = valor != null && meta != null && meta > 0 ? Math.round((valor / meta) * 1000) / 10 : null;
  return { valor, meta, pct };
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

export interface MsgResumo { direcao: string; enviada_por?: string | null; created_at: Date; }

/** Remetentes automáticos gravados em WhatsappMensagem.enviada_por (triagem e cadência). */
export const REMETENTES_AUTOMATICOS = ['bot', 'cadencia_automatica', 'assistente_ia', 'campanha'];

/**
 * SAÍDA feita por pessoa: enviada pelo CRM (enviada_por = id do usuário) ou digitada
 * no celular/WhatsApp Web da empresa (enviada_por = null). Robô e cadência não contam.
 */
export function ehSaidaHumana(m: MsgResumo): boolean {
  return m.direcao === 'SAIDA' && !REMETENTES_AUTOMATICOS.includes(m.enviada_por || '');
}

function ordenar(msgs: MsgResumo[]): MsgResumo[] {
  return [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Quem abriu a conversa: primeira mensagem ENTRADA = cliente; SAÍDA = equipe. */
export function iniciadaPor(msgs: MsgResumo[]): 'cliente' | 'equipe' | null {
  const primeira = ordenar(msgs)[0];
  if (!primeira) return null;
  return primeira.direcao === 'ENTRADA' ? 'cliente' : 'equipe';
}

/** Minutos entre a 1ª ENTRADA e a 1ª SAÍDA humana depois dela; null se não houve resposta humana. */
export function minutosPrimeiraRespostaHumana(msgs: MsgResumo[]): number | null {
  const ord = ordenar(msgs);
  const entrada = ord.find(m => m.direcao === 'ENTRADA');
  if (!entrada) return null;
  const tEntrada = new Date(entrada.created_at).getTime();
  const resposta = ord.find(m => ehSaidaHumana(m) && new Date(m.created_at).getTime() >= tEntrada);
  if (!resposta) return null;
  return (new Date(resposta.created_at).getTime() - tEntrada) / 60000;
}

/** Média (minutos, arredondada) do tempo de 1ª resposta humana; null sem amostras. */
export function mediaPrimeiraResposta(conversas: MsgResumo[][]): number | null {
  const tempos = conversas.map(minutosPrimeiraRespostaHumana).filter((t): t is number => t != null);
  if (!tempos.length) return null;
  return Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length);
}

// ── Equipe / textos ─────────────────────────────────────────────────────────

/** Só o primeiro nome (o painel fica numa TV — nada de nome completo). */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome || '').trim().split(/\s+/)[0] || '—';
}

export const CARGOS_EQUIPE_TV = ['VENDEDOR', 'SUPERVISAO_COMERCIAL', 'SDR'];

// ── Funil ───────────────────────────────────────────────────────────────────

/** Etapas do funil do vendedor (espelha DEFAULT_COLUMNS de routes/kanban-colunas.ts). */
export const ETAPAS_FUNIL_PADRAO: Array<{ chave: string; nome: string }> = [
  { chave: 'NOVO_LEAD', nome: 'Novo Lead' },
  { chave: 'PRIMEIRO_CONTATO', nome: 'Primeiro Contato' },
  { chave: 'EM_ATENDIMENTO', nome: 'Em Atendimento' },
  { chave: 'QUALIFICADO', nome: 'Qualificado' },
  { chave: 'AGUARDANDO_RETORNO', nome: 'Aguardando Retorno' },
  { chave: 'PROPOSTA_A_GERAR', nome: 'Proposta a Gerar' },
  { chave: 'PROPOSTA_ENVIADA', nome: 'Proposta Enviada' },
  { chave: 'EM_NEGOCIACAO', nome: 'Em Negociação' },
  { chave: 'FECHADO', nome: 'Fechado' },
  { chave: 'PERDIDO', nome: 'Perdido' },
];

/** Etapas de negociação em andamento (Lead.etapa_comercial). ACEITO é legado do fluxo antigo. */
export const ETAPAS_NEGOCIACAO = ['EM_ATENDIMENTO', 'AGUARDANDO_RETORNO', 'PROPOSTA_A_GERAR', 'PROPOSTA_ENVIADA', 'EM_NEGOCIACAO', 'ACEITO'];

/**
 * Monta o funil só com etapas válidas (colunas ativas do kanban), na ordem delas.
 * Nomes de etapa que não são coluna (lixo/legado) são ignorados.
 */
export function montarFunil(
  contagens: Array<{ etapa: string | null; total: number }>,
  colunas: Array<{ chave: string; nome: string }>,
): Array<{ etapa: string; nome: string; total: number }> {
  const mapa = new Map<string, number>();
  for (const c of contagens) if (c.etapa) mapa.set(c.etapa, (mapa.get(c.etapa) || 0) + Number(c.total || 0));
  return colunas.map(c => ({ etapa: c.chave, nome: c.nome, total: mapa.get(c.chave) || 0 }));
}

// ── Números ─────────────────────────────────────────────────────────────────

export function soma(ns: Array<number | null | undefined>): number {
  return Math.round(ns.reduce<number>((s, n) => s + Number(n || 0), 0) * 100) / 100;
}

/** Média dos valores > 0; null se nenhum. */
export function mediaPositivos(ns: Array<number | null | undefined>): number | null {
  const v = ns.map(n => Number(n || 0)).filter(n => n > 0);
  if (!v.length) return null;
  return Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 100) / 100;
}

/** Valor da instalação de um fechamento (mesma regra de lib/meta-progress.ts). */
export function valorInstalacao(p: { valor_implantacao?: number | null; valor_final?: number | null }): number {
  return Number(p.valor_implantacao ?? p.valor_final ?? 0);
}

/** Mensalidade de um fechamento (mesma regra de lib/meta-progress.ts). */
export function valorMensalidade(p: { mensalidade_plus?: number | null; mensalidade_pro?: number | null }): number {
  return Number(p.mensalidade_plus ?? p.mensalidade_pro ?? 0);
}

/** Data do fechamento: data_aceite, senão created_at (mesma regra de lib/meta-progress.ts). */
export function dataFechamento(p: { data_aceite?: Date | null; created_at: Date }): Date {
  return p.data_aceite ?? p.created_at;
}

/** Ritmo de contratos no ano: média/mês até agora e o necessário/mês até dezembro. */
export function ritmoAnual(realizado: number, meta: number | null, mesAtual: number): { por_mes: number; necessario_por_mes: number | null } {
  const porMes = Math.round((realizado / Math.max(1, mesAtual)) * 10) / 10;
  if (meta == null) return { por_mes: porMes, necessario_por_mes: null };
  const mesesRestantes = 12 - mesAtual + 1; // inclui o mês corrente
  const falta = Math.max(0, meta - realizado);
  return { por_mes: porMes, necessario_por_mes: Math.round((falta / mesesRestantes) * 10) / 10 };
}
