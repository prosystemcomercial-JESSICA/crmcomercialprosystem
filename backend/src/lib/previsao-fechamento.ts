// Previsão de fechamento e ciclo de vendas sobre dados concretos (pedido da Jessica, 21/10/2026).
// Antes, a previsão somava os 2.887 leads pela etapa do kanban do vendedor (só 5 tinham valor) e o ciclo olhava os
// 1.000 leads mais novos com fechamento_data no lead. Agora a base são as propostas comerciais, os contratos do
// módulo de contratos e os leads quentes/mornos lidos pelo Analista de Resultados.

const FECHANDO = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];
export const FORA_DA_PREVISAO = ['CONTRATO_ASSINADO', 'PERDIDA', 'CANCELADA', 'RECUSADA'];

/**
 * Chance de virar contrato, pelo status da proposta e pelos dias desde o envio. Referência: das propostas de 2026,
 * pouco mais da metade das que tiveram desfecho viraram contrato, quase sempre nas primeiras semanas.
 */
export function probabilidadeProposta(status: string, diasDesdeEnvio: number | null): number {
  if (FORA_DA_PREVISAO.includes(status)) return 0;
  if (FECHANDO.includes(status)) return 0.9;
  if (status === 'RASCUNHO') return 0.15;
  if (status === 'EXPIRADA') return 0.08;
  const d = diasDesdeEnvio ?? 999;
  if (d <= 15) return 0.4;
  if (d <= 45) return 0.2;
  return 0.1;
}

/** Leads dos agentes sem proposta: só entram os quentes e os mornos do Analista. */
export function probabilidadeLeadAgente(temperatura: string): number {
  return temperatura === 'QUENTE' ? 0.15 : temperatura === 'MORNO' ? 0.04 : 0;
}

export type ItemPrevisao = { origem: 'proposta' | 'lead'; empresa: string; status: string; probabilidade: number; mensalidade: number; implantacao: number; dias: number | null; vendedor: string | null; link: string | null };

export function resumirPrevisao(itens: ItemPrevisao[]) {
  const soma = (f: (i: ItemPrevisao) => number, lista = itens) => lista.reduce((t, i) => t + f(i), 0);
  const altos = itens.filter(i => i.probabilidade >= 0.4);
  return {
    contratos: {
      pessimista: +soma(i => i.probabilidade, altos).toFixed(1),
      realista: +soma(i => i.probabilidade).toFixed(1),
      otimista: itens.filter(i => i.probabilidade >= 0.15).length,
    },
    mensalidade: {
      pessimista: Math.round(soma(i => i.probabilidade * i.mensalidade, altos)),
      realista: Math.round(soma(i => i.probabilidade * i.mensalidade)),
      otimista: Math.round(soma(i => (i.probabilidade >= 0.15 ? i.mensalidade : 0))),
    },
    implantacao_realista: Math.round(soma(i => i.probabilidade * i.implantacao)),
  };
}

export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(1);
}

export const diasEntre = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 864e5)) : null);

/** Contrato cadastrado no mesmo dia em que o lead e a proposta nasceram: venda lançada depois, sem histórico de ciclo. */
export function semHistorico(entradaAteContrato: number | null, propostaAteContrato: number | null): boolean {
  return entradaAteContrato == null ? propostaAteContrato == null || propostaAteContrato === 0 : entradaAteContrato === 0;
}
