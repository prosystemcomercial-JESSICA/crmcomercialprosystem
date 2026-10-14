// Parte 2 do Plano de Expansão (14/10/2026): do interesse à demonstração e à proposta. Regras puras do placar.

export type MetaSemana = { primeiros_contatos: number; demonstracoes: number; propostas: number; contratos: number };

/** Metas por semana (segunda-feira da semana), do plano de fechamento até 31/10/2026. Editáveis na config. */
export const METAS_PADRAO: Record<string, MetaSemana> = {
  '2026-10-12': { primeiros_contatos: 200, demonstracoes: 4, propostas: 3, contratos: 1 }, // conta de 15 a 17/10
  '2026-10-19': { primeiros_contatos: 330, demonstracoes: 8, propostas: 7, contratos: 2 },
  '2026-10-26': { primeiros_contatos: 330, demonstracoes: 8, propostas: 7, contratos: 2 },
};

const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** Segunda-feira (AAAA-MM-DD) e início/fim da semana de trabalho em São Paulo. */
export function semanaDe(agora: Date): { chave: string; inicio: Date; fim: Date } {
  const hoje = new Date(`${diaSP(agora)}T12:00:00-03:00`);
  const dow = (hoje.getUTCDay() + 6) % 7; // segunda = 0
  const seg = new Date(hoje.getTime() - dow * 864e5);
  const chave = diaSP(seg);
  return { chave, inicio: new Date(`${chave}T00:00:00-03:00`), fim: new Date(new Date(`${chave}T00:00:00-03:00`).getTime() + 7 * 864e5) };
}

export const inicioDoDia = (agora: Date) => new Date(`${diaSP(agora)}T00:00:00-03:00`);

/** Interessado há mais de 48 h sem demonstração? Sem a data do interesse (leads antigos), conta como esquecido. */
export function esquecidoSemDemo(interessadoEm: string | Date | null | undefined, agora: Date, horas = 48): boolean {
  if (!interessadoEm) return true;
  const t = new Date(interessadoEm).getTime();
  return isNaN(t) || agora.getTime() - t >= horas * 3600e3;
}

/** Interesse pelo termômetro do agente (mesma régua do "Interessados" e da passagem para a Caroline). */
export const NOTA_INTERESSE = 35;
