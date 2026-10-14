// Situação de cada indicação de cliente (painel das indicações, 14/10/2026). Puro.
// Vai da fila da Caroline ao contrato; o status gravado em Indicacao acompanha (PENDENTE | CONTATO | CONVERTIDO | PERDIDO).

export type SinaisIndicacao = {
  sdrStatus?: string | null; primeiroEnvio?: Date | string | null; respondeu?: boolean; nota?: number | null;
  temProposta?: boolean; fechou?: boolean; statusAtual?: string | null;
};

export function situacaoDaIndicacao(s: SinaisIndicacao): { fase: string; status: 'PENDENTE' | 'CONTATO' | 'CONVERTIDO' | 'PERDIDO' } {
  if (s.fechou) return { fase: 'Fechou contrato', status: 'CONVERTIDO' };
  if (s.statusAtual === 'CONVERTIDO') return { fase: 'Fechou contrato', status: 'CONVERTIDO' };
  if (s.temProposta) return { fase: 'Com proposta', status: 'CONTATO' };
  if (s.sdrStatus === 'SEM_INTERESSE' || s.sdrStatus === 'SEM_WHATSAPP' || s.statusAtual === 'PERDIDO') return { fase: s.sdrStatus === 'SEM_WHATSAPP' ? 'Número sem WhatsApp' : 'Sem interesse', status: 'PERDIDO' };
  if (s.sdrStatus === 'DEMO') return { fase: 'Demonstração marcada', status: 'CONTATO' };
  if ((s.nota ?? 0) >= 35) return { fase: 'Interessado', status: 'CONTATO' };
  if (s.respondeu) return { fase: 'Respondeu', status: 'CONTATO' };
  if (s.primeiroEnvio) return { fase: 'Caroline chamou', status: 'CONTATO' };
  return { fase: 'Na fila da Caroline', status: 'PENDENTE' };
}
