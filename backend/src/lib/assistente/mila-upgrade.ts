// Mila · oferta de upgrade para a base (11/11/2026). Puro: quem pode receber a oferta e em que ordem.
// Regras: cliente ativo, 8 meses ou mais de casa, fora do plano Plus, sem o Plus já apresentado, sem alerta
// de atenção (nota ruim na pesquisa, risco) e que não recebeu oferta nos últimos 90 dias.
// Manual da Mila, seção 12 (23/11/2026): fora quem tem caso de churn aberto ou é do mesmo grupo de quem saiu (bloqueados),
// uma oferta = um segmento só (o texto serve para todos), uma loja por CNPJ raiz e "não conhece" só vale se o cliente respondeu a pesquisa.

export const MESES_MINIMOS = 8;
export const MAX_POR_OFERTA = 30;
export const DIAS_ENTRE_OFERTAS = 90;

export type ClienteBase = {
  id: string; nome: string; nome_fantasia?: string | null; email?: string | null; segmento?: string | null; plano?: string | null;
  cnpj?: string | null; situacao?: string | null; data_entrada?: Date | null; risco_atencao?: boolean | null; apresentou_plus?: boolean | null;
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

/** Família do segmento: o mesmo e-mail só serve para lojas do mesmo tipo. */
export function familiaSegmento(c: Pick<ClienteBase, 'segmento' | 'plano'>): 'farmacia' | 'padaria' | 'varejo' {
  const t = `${c.segmento || ''} ${c.plano || ''}`;
  if (/farm|drog|manip/i.test(t)) return 'farmacia';
  if (/padar|panif/i.test(t)) return 'padaria';
  return 'varejo';
}

const raiz = (cnpj?: string | null) => { const d = (cnpj || '').replace(/\D/g, ''); return d.length === 14 ? d.slice(0, 8) : null; };

/**
 * Os mais antigos de casa primeiro; quem tem e-mail na frente (é por onde a oferta sai).
 * Só a família de segmento com mais elegíveis entra nesta oferta (as outras ficam para a próxima) e uma loja por CNPJ raiz.
 */
export function escolherParaUpgrade(cs: ClienteBase[], agora: Date, jaOfertados: Set<string>, max = MAX_POR_OFERTA, bloqueados: Set<string> = new Set()): ClienteBase[] {
  const eleg = cs.filter(c => elegivelUpgrade(c, agora, jaOfertados) && !bloqueados.has(c.id));
  const porFamilia = new Map<string, number>();
  for (const c of eleg) porFamilia.set(familiaSegmento(c), (porFamilia.get(familiaSegmento(c)) || 0) + 1);
  const familia = [...porFamilia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const vistos = new Set<string>();
  return eleg.filter(c => familiaSegmento(c) === familia)
    .sort((a, b) => Number(emailValido(b.email)) - Number(emailValido(a.email)) || +a.data_entrada! - +b.data_entrada!)
    .filter(c => { const r = raiz(c.cnpj); if (!r) return true; if (vistos.has(r)) return false; vistos.add(r); return true; })
    .slice(0, max);
}

/** Ferramentas que o cliente ainda não conhece (para a Mila escolher o que apresentar). */
export function ferramentasNovas(c: ClienteBase): string[] {
  return [
    !c.conhece_dashboard && 'Dashboard', !c.conhece_mensageria && 'Mensageria', !c.conhece_gerencial && 'Gerencial',
    !c.conhece_atencao_farma && /farm|drog/i.test(c.segmento || '') && 'Atenção Farma',
  ].filter(Boolean) as string[];
}

/** "Não conhece" só é fato quando o cliente respondeu a pesquisa (campo vazio no cadastro não prova nada). */
export function ferramentasConfirmadas(c: ClienteBase, respondeuPesquisa: boolean): string[] {
  return respondeuPesquisa ? ferramentasNovas(c) : [];
}

export function mesesDeCasa(c: ClienteBase, agora: Date): number {
  return c.data_entrada ? Math.max(0, Math.round((+agora - +c.data_entrada) / (30.44 * 864e5))) : 0;
}
