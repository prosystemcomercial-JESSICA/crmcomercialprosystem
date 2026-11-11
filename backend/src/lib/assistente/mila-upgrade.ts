// Mila · oferta de upgrade para a base (11/11/2026). Puro: quem pode receber a oferta e em que ordem.
// Regras: cliente ativo, 8 meses ou mais de casa, fora do plano Plus, sem o Plus já apresentado, sem alerta
// de atenção (nota ruim na pesquisa, risco) e que não recebeu oferta nos últimos 90 dias.

export const MESES_MINIMOS = 8;
export const MAX_POR_OFERTA = 30;
export const DIAS_ENTRE_OFERTAS = 90;

export type ClienteBase = {
  id: string; nome: string; nome_fantasia?: string | null; email?: string | null; segmento?: string | null; plano?: string | null;
  situacao?: string | null; data_entrada?: Date | null; risco_atencao?: boolean | null; apresentou_plus?: boolean | null;
  conhece_dashboard?: boolean | null; conhece_mensageria?: boolean | null; conhece_gerencial?: boolean | null; conhece_atencao_farma?: boolean | null;
};

export const emailValido = (e?: string | null) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((e || '').trim());

export function elegivelUpgrade(c: ClienteBase, agora: Date, jaOfertados: Set<string>): boolean {
  if (c.situacao !== 'ATIVA' || c.risco_atencao || c.apresentou_plus || jaOfertados.has(c.id)) return false;
  if (/plus/i.test(c.plano || '')) return false;
  if (!c.data_entrada) return false; // sem data de entrada não dá para saber o tempo de casa
  const limite = new Date(agora); limite.setMonth(limite.getMonth() - MESES_MINIMOS);
  return c.data_entrada <= limite;
}

/** Os mais antigos de casa primeiro; quem tem e-mail na frente (é por onde a oferta sai). */
export function escolherParaUpgrade(cs: ClienteBase[], agora: Date, jaOfertados: Set<string>, max = MAX_POR_OFERTA): ClienteBase[] {
  return cs.filter(c => elegivelUpgrade(c, agora, jaOfertados))
    .sort((a, b) => Number(emailValido(b.email)) - Number(emailValido(a.email)) || +a.data_entrada! - +b.data_entrada!)
    .slice(0, max);
}

/** Ferramentas que o cliente ainda não conhece (para a Mila escolher o que apresentar). */
export function ferramentasNovas(c: ClienteBase): string[] {
  return [
    !c.conhece_dashboard && 'Dashboard', !c.conhece_mensageria && 'Mensageria', !c.conhece_gerencial && 'Gerencial',
    !c.conhece_atencao_farma && /farm|drog/i.test(c.segmento || '') && 'Atenção Farma',
  ].filter(Boolean) as string[];
}

export function mesesDeCasa(c: ClienteBase, agora: Date): number {
  return c.data_entrada ? Math.max(0, Math.round((+agora - +c.data_entrada) / (30.44 * 864e5))) : 0;
}
