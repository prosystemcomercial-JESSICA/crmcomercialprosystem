// SLA de resposta do funil comercial de WhatsApp — horas por prioridade.
// Regra de negócio ainda não fechada; ajuste aqui sem tocar nas rotas.
export const SLA_HORAS: Record<string, number> = {
  CRITICA: 4,
  NORMAL: 24,
  BAIXA: 48,
};

export function calcularSlaPrazo(prioridade: string, apartirDe: Date = new Date()): Date {
  const horas = SLA_HORAS[prioridade] ?? SLA_HORAS.NORMAL;
  return new Date(apartirDe.getTime() + horas * 60 * 60 * 1000);
}
