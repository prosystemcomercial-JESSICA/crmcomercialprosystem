import { PrismaClient } from '@prisma/client';

/**
 * ID rastreável de proposta/contrato (definido com o cliente):
 *   - 3 primeiros caracteres do ID do usuário (vendedor) + CNPJ do cliente (só dígitos).
 *   - Ex.: usuário "a3f8..." + CNPJ "12.345.678/0001-90" → "a3f-12345678000190".
 *   - O contrato HERDA o mesmo ID da proposta (rastreabilidade de comissão).
 *
 * Em caso de colisão (mesmo vendedor + mesmo CNPJ), acrescenta sufixo "-2", "-3"...
 * para manter a chave primária única sem perder a rastreabilidade.
 */

export function soDigitos(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

/** Prefixo do vendedor = 3 primeiros chars do id (minúsculo, sem separadores). */
export function prefixoVendedor(userId?: string | null): string {
  const limpo = (userId || '').replace(/[^a-zA-Z0-9]/g, '');
  return (limpo.slice(0, 3) || 'sys').toLowerCase();
}

/** Monta o ID base "<3 do user>-<CNPJ>". Sem CNPJ, usa "scnpj" + timestamp curto. */
export function montarIdProposta(userId?: string | null, cnpj?: string | null): string {
  const pref = prefixoVendedor(userId);
  const doc = soDigitos(cnpj);
  if (!doc) return `${pref}-scnpj${Date.now().toString().slice(-8)}`;
  return `${pref}-${doc}`;
}

/**
 * Gera um ID de proposta único, tratando colisão por sufixo incremental.
 * Verifica tanto PropostaComercial quanto ContratoComercial (que compartilham o id).
 */
export async function gerarIdPropostaUnico(
  prisma: PrismaClient,
  userId?: string | null,
  cnpj?: string | null
): Promise<string> {
  const base = montarIdProposta(userId, cnpj);
  let candidato = base;
  let n = 1;
  // Loop curto: na prática raramente passa de 1-2 iterações.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [pExiste, cExiste] = await Promise.all([
      prisma.propostaComercial.findUnique({ where: { id: candidato }, select: { id: true } }),
      prisma.contratoComercial.findUnique({ where: { id: candidato }, select: { id: true } }).catch(() => null),
    ]);
    if (!pExiste && !cExiste) return candidato;
    n += 1;
    candidato = `${base}-${n}`;
  }
}
