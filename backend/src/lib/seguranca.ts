import bcrypt from 'bcryptjs';

/**
 * Segurança de senha e proteção de login.
 *
 * Migração transparente: senhas antigas estão em TEXTO PURO no banco. A função
 * `conferirSenha` aceita ambos — se o armazenado for hash bcrypt ($2...), compara
 * com bcrypt; senão compara como texto puro (legado). O login deve re-hashear a
 * senha legada após autenticar com sucesso (rehashSeNecessario).
 */

const ROUNDS = 10;

export function ehHashBcrypt(valor?: string | null): boolean {
  return !!valor && /^\$2[aby]\$/.test(valor);
}

export async function hashSenha(senhaPlana: string): Promise<string> {
  return bcrypt.hash(senhaPlana, ROUNDS);
}

/** Confere a senha informada contra o valor armazenado (hash OU texto puro legado). */
export async function conferirSenha(senhaPlana: string, armazenado?: string | null): Promise<boolean> {
  if (!armazenado) return false;
  if (ehHashBcrypt(armazenado)) {
    try { return await bcrypt.compare(senhaPlana, armazenado); } catch { return false; }
  }
  // legado: comparação direta de texto puro
  return senhaPlana === armazenado;
}

/** true se o valor armazenado ainda NÃO é hash (precisa migrar para bcrypt). */
export function precisaRehash(armazenado?: string | null): boolean {
  return !ehHashBcrypt(armazenado);
}

// ── Proteção contra força bruta (bloqueio por tentativas) ──
// Em memória (simples, sem nova tabela). Reinicia a cada deploy — suficiente
// para frear adivinhação de senha sem complexidade extra.
const tentativas = new Map<string, { count: number; bloqueadoAte: number }>();
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;   // bloqueia por 15 min após estourar

export function loginBloqueado(chave: string): number {
  const reg = tentativas.get(chave.toLowerCase());
  if (reg && reg.bloqueadoAte > Date.now()) {
    return Math.ceil((reg.bloqueadoAte - Date.now()) / 60000);  // minutos restantes
  }
  return 0;
}

export function registrarFalha(chave: string) {
  const k = chave.toLowerCase();
  const reg = tentativas.get(k) || { count: 0, bloqueadoAte: 0 };
  reg.count += 1;
  if (reg.count >= MAX_TENTATIVAS) {
    reg.bloqueadoAte = Date.now() + JANELA_MS;
    reg.count = 0;  // zera contador ao bloquear
  }
  tentativas.set(k, reg);
}

export function limparTentativas(chave: string) {
  tentativas.delete(chave.toLowerCase());
}
