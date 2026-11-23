// Limite diário de gasto na chave da OpenAI (pedido da Jessica, 23/11/2026: "no máximo R$ 15,00 por dia").
// Ao chegar no limite, a OpenAI fica fora até a meia-noite (horário de Brasília) e os agentes seguem pelas
// outras IAs. Regras puras aqui; o estado (gasto do dia, valor configurado) fica em services/uso-ia.service.ts.

export const CHAVE_LIMITE_DIARIO_OPENAI = 'ia.limite_diario_openai_brl';
/** Padrão quando nada foi configurado no painel. IA_LIMITE_DIARIO_OPENAI_BRL no .env troca o padrão. */
export const LIMITE_DIARIO_OPENAI_PADRAO = 15;

/** Valor gravado no painel (texto) → limite em reais. Sem valor gravado vale o padrão; 0 = sem limite. */
export function lerLimiteDiario(gravado: string | null | undefined, env: Record<string, string | undefined> = {}): number {
  const n = Number(gravado);
  if (gravado != null && gravado !== '' && Number.isFinite(n) && n >= 0) return n;
  const txt = (env.IA_LIMITE_DIARIO_OPENAI_BRL || '').trim();
  const e = Number(txt);
  return txt && Number.isFinite(e) && e >= 0 ? e : LIMITE_DIARIO_OPENAI_PADRAO;
}

export type SituacaoLimiteDiario = { limite: number; gasto: number; usado: number; nivel: 'sem_limite' | 'ok' | 'atencao' | 'bloqueado'; bloqueado: boolean };

/** Gasto de hoje (R$) contra o limite (R$). Bloqueia ao alcançar o limite; atenção a partir de 80%. */
export function situacaoLimiteDiario(gastoBrl: number, limite: number): SituacaoLimiteDiario {
  const gasto = Math.round((gastoBrl || 0) * 100) / 100;
  if (!(limite > 0)) return { limite: 0, gasto, usado: 0, nivel: 'sem_limite', bloqueado: false };
  const usado = (gastoBrl || 0) / limite;
  const bloqueado = usado >= 1;
  return { limite, gasto, usado, nivel: bloqueado ? 'bloqueado' : usado >= 0.8 ? 'atencao' : 'ok', bloqueado };
}

/** Mensagem do erro quando a OpenAI está bloqueada pelo limite do dia. */
export function textoBloqueioOpenAi(limite: number): string {
  const reais = limite.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `Limite diário da OpenAI atingido (${reais}). Ela volta à meia-noite; até lá os agentes usam as outras IAs. O valor muda no Escritório › Consumo de IA.`;
}
