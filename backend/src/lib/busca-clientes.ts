// Busca de clientes (GET /clientes?search=): quebra o termo em palavras — cada
// palavra precisa casar (E) com algum campo de texto (OU); com 8+ dígitos também
// compara o CNPJ só pelos dígitos. Puro: monta o filtro Prisma e o SQL cru com
// as mesmas regras (a listagem usa SQL p/ ordenar por código numérico e cai no
// Prisma se o SQL falhar — os dois caminhos têm de bater com o count).

export const CAMPOS_BUSCA_CLIENTE = ['nome', 'nome_fantasia', 'razao_social', 'empresa', 'email', 'codigo', 'cnpj'] as const;

/** Expressão SQL do CNPJ só com dígitos (tira . / - e espaços). */
export const SQL_CNPJ_DIGITOS = "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(cnpj,''),'.',''),'/',''),'-',''),' ','')";

export type TermoBusca = { tokens: string[]; digitosCnpj: string | null };

export function normalizarBuscaCliente(search: string | null | undefined): TermoBusca {
  const tokens = (search || '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const digitos = (search || '').replace(/\D/g, '');
  return { tokens, digitosCnpj: digitos.length >= 8 ? digitos : null };
}

/** Filtro Prisma equivalente (sem a comparação por dígitos, feita por ids pré-buscados). */
export function wherePrismaBusca(t: TermoBusca, idsPorCnpj: string[] = []): any | null {
  if (!t.tokens.length) return null;
  const porTokens = { AND: t.tokens.map(tok => ({ OR: CAMPOS_BUSCA_CLIENTE.map(c => ({ [c]: { contains: tok } })) })) };
  if (!idsPorCnpj.length) return porTokens;
  return { OR: [porTokens, { id: { in: idsPorCnpj } }] };
}

/** Condição SQL + parâmetros (mesma regra). */
export function sqlBusca(t: TermoBusca): { sql: string; params: string[] } | null {
  if (!t.tokens.length) return null;
  const params: string[] = [];
  const porToken = t.tokens.map(tok => {
    const s = `%${tok}%`;
    CAMPOS_BUSCA_CLIENTE.forEach(() => params.push(s));
    return `(${CAMPOS_BUSCA_CLIENTE.map(c => `${c} LIKE ?`).join(' OR ')})`;
  });
  let sql = `(${porToken.join(' AND ')})`;
  if (t.digitosCnpj) {
    sql = `(${sql} OR ${SQL_CNPJ_DIGITOS} LIKE ?)`;
    params.push(`%${t.digitosCnpj}%`);
  }
  return { sql, params };
}
