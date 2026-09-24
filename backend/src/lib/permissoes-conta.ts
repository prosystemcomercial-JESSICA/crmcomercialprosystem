/**
 * Flags de conta por usuário (UsuarioCRM) — complementam o CARGO sem trocá-lo.
 *
 * Modelo (decisão aprovada pela Jessica, set/2026):
 *   - cargo continua sendo a fonte das permissões de dados (scope.ts / requireRole).
 *   - `vende`          → usuário de outro cargo (ex.: SUPERVISAO_COMERCIAL) que
 *                        TAMBÉM vende: pode receber comissão de VENDEDOR (15%) e ter
 *                        a visão "Como vendedora" no dashboard.
 *   - `admin_sistema`  → administração total (desenvolvedora): passa em qualquer
 *                        requireRole, como ADMIN/DIRETOR, e vê a visão "Administração".
 *   - `somente_leitura`→ conta de consulta: o backend recusa qualquer escrita (403).
 *
 * Além do flag, o cargo CEO é SEMPRE somente leitura (visão executiva).
 *
 * As três colunas são criadas de forma aditiva (ALTER TABLE ... ADD COLUMN, padrão
 * de routes/usuarios.ts) e viajam no JWT (login/refresh), por isso ficam em
 * request.user sem consulta extra ao banco.
 */

export interface FlagsConta {
  vende?: boolean;
  admin?: boolean;
  somente_leitura?: boolean;
}

export interface UsuarioComFlags extends FlagsConta {
  id?: string;
  role?: string;
}

/** Converte a linha crua do MySQL (TINYINT 0/1, null, coluna ausente) nas flags do token. */
export function flagsDaLinha(row: any): FlagsConta {
  const b = (v: any) => v === true || v === 1 || v === '1';
  return {
    vende: b(row?.vende),
    admin: b(row?.admin_sistema),
    somente_leitura: b(row?.somente_leitura),
  };
}

/** Cargos que são sempre de consulta (independente do flag). */
export const CARGOS_SOMENTE_LEITURA = ['CEO'];

export function ehSomenteLeitura(user?: UsuarioComFlags | null): boolean {
  if (!user) return false;
  if (user.admin) return false; // administração nunca fica travada
  if (user.somente_leitura) return true;
  return CARGOS_SOMENTE_LEITURA.includes(String(user.role || '').toUpperCase());
}

export function ehAdminSistema(user?: UsuarioComFlags | null): boolean {
  if (!user) return false;
  return !!user.admin || ['ADMIN', 'DIRETOR'].includes(String(user.role || '').toUpperCase());
}

/** Cargo VENDEDOR ou qualquer cargo com o flag `vende`. */
export function podeReceberComissaoVendedor(u: { cargo?: string | null; vende?: any }): boolean {
  return String(u.cargo || '').toUpperCase() === 'VENDEDOR' || flagsDaLinha(u).vende === true;
}

/**
 * Rotas de escrita liberadas mesmo para conta somente leitura — só o que é da
 * própria sessão/conta do usuário. Tudo o mais que não for GET/HEAD/OPTIONS → 403.
 */
export const ROTAS_ESCRITA_LIBERADAS_LEITURA = [
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/alterar-senha',
];

const METODOS_LEITURA = ['GET', 'HEAD', 'OPTIONS'];

/** true = a requisição deve ser barrada com 403 pela regra de somente leitura. */
export function bloquearPorSomenteLeitura(
  user: UsuarioComFlags | null | undefined,
  method: string,
  url: string
): boolean {
  if (!ehSomenteLeitura(user)) return false;
  if (METODOS_LEITURA.includes(String(method || '').toUpperCase())) return false;
  const path = String(url || '').split('?')[0].replace(/\/+$/, '');
  return !ROTAS_ESCRITA_LIBERADAS_LEITURA.includes(path);
}

/** Id da antiga conta mock (login hardcoded removido). Tokens com ele são ignorados. */
export const ID_CONTA_MOCK_REMOVIDA = 'user-jessica';

// ─── Estado atual da conta no BANCO (fonte da verdade para escrita) ───────────
// O JWT dura 7 dias: flags/cargo dentro dele podem estar velhos. O hook global
// (server.ts) carrega status + cargo + flags do UsuarioCRM (cache curto por id) e
// decide com esta função pura. Flags do JWT servem só para exibição.

export interface EstadoContaDb {
  status: string | null;
  role: string | null;
  vende?: any;
  admin_sistema?: any;
  somente_leitura?: any;
}

export type DecisaoAcesso = 'ok' | 'inativo' | 'somente_leitura';

/**
 * @param estado  linha atual do banco; `null` = conta não existe mais;
 *                `undefined` = não foi possível consultar (usa o JWT como fallback).
 */
export function decidirAcesso(
  user: UsuarioComFlags,
  estado: EstadoContaDb | null | undefined,
  method: string,
  url: string
): DecisaoAcesso {
  const path = String(url || '').split('?')[0].replace(/\/+$/, '');
  if (ROTAS_ESCRITA_LIBERADAS_LEITURA.includes(path)) return 'ok';
  if (estado === null) return 'inativo';
  let efetivo: UsuarioComFlags = user;
  if (estado) {
    if (String(estado.status || 'ATIVO').toUpperCase() !== 'ATIVO') return 'inativo';
    efetivo = { id: user.id, role: estado.role || user.role, ...flagsDaLinha(estado) };
  }
  return bloquearPorSomenteLeitura(efetivo, method, url) ? 'somente_leitura' : 'ok';
}

/** Cache em memória simples (TTL) do estado da conta, por id de usuário. */
export function criarCacheEstadoConta(
  carregar: (id: string) => Promise<EstadoContaDb | null>,
  ttlMs = 45_000,
  agora: () => number = Date.now
) {
  const mapa = new Map<string, { v: EstadoContaDb | null; ate: number }>();
  return async (id: string): Promise<EstadoContaDb | null | undefined> => {
    const hit = mapa.get(id);
    if (hit && hit.ate > agora()) return hit.v;
    try {
      const v = await carregar(id);
      if (mapa.size > 5000) mapa.clear();
      mapa.set(id, { v, ate: agora() + ttlMs });
      return v;
    } catch {
      return undefined; // banco indisponível: não derruba a requisição, usa o JWT
    }
  };
}
