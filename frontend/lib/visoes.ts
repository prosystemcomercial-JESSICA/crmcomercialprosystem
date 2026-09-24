// Visões do dashboard para quem acumula papéis (ex.: Jessica = vendedora +
// supervisora comercial + administradora). A visão só muda o que é MOSTRADO /
// filtrado na tela — as permissões continuam vindo do cargo e das flags da conta,
// validadas no backend.

export type Visao = 'vendedora' | 'supervisora' | 'admin';

export interface UsuarioVisao {
  role?: string | null;
  vende?: boolean;
  admin?: boolean;
  somente_leitura?: boolean;
}

export const ROTULO_VISAO: Record<Visao, string> = {
  vendedora: 'Como vendedora',
  supervisora: 'Como supervisora',
  admin: 'Administração',
};

export function visoesDisponiveis(u?: UsuarioVisao | null): Visao[] {
  if (!u) return [];
  const role = String(u.role || '').toUpperCase();
  const v: Visao[] = [];
  if (role === 'VENDEDOR' || u.vende) v.push('vendedora');
  if (['SUPERVISAO_COMERCIAL', 'SUPERVISAO', 'ADMIN', 'DIRETOR'].includes(role)) v.push('supervisora');
  if (u.admin || role === 'ADMIN' || role === 'DIRETOR') v.push('admin');
  return v;
}

/** Visão inicial: a lembrada (se ainda válida) senão supervisora, senão a primeira. */
export function visaoInicial(disponiveis: Visao[], lembrada?: string | null): Visao | null {
  if (!disponiveis.length) return null;
  if (lembrada && (disponiveis as string[]).includes(lembrada)) return lembrada as Visao;
  return disponiveis.includes('supervisora') ? 'supervisora' : disponiveis[0];
}

export function ehSomenteLeitura(u?: UsuarioVisao | null): boolean {
  if (!u) return false;
  if (u.admin) return false;
  return !!u.somente_leitura || String(u.role || '').toUpperCase() === 'CEO';
}
