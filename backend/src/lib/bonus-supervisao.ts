/**
 * Bônus trimestral da SUPERVISÃO comercial (regra aprovada set/2026).
 *
 * Meta trimestral do setor = META_MENSAL_VENDEDOR (5) × 3 meses × N, onde N é o
 * número de usuários ATIVOS que vendem (cargo VENDEDOR ou flag `vende`), mínimo 1.
 * Faixas (pega a maior atingida, pelo total de contratos do setor no trimestre):
 *   100% = meta            → R$ 600
 *   150% = ceil(1,5×meta)  → R$ 1.100
 *   200% = 2×meta          → R$ 1.500
 * Ex.: N=1 → 15/23/30; N=2 → 30/45/60. Não há mais critério alternativo por
 * "vendedor de referência".
 */
import { podeReceberComissaoVendedor } from './permissoes-conta';

export const META_MENSAL_VENDEDOR = 5;

export interface FaixaBonus { meta: number; premio: number; rotulo: string }

export function faixasSupervisaoSetor(nVendedores: number): FaixaBonus[] {
  const n = Math.max(1, Math.floor(Number(nVendedores) || 0));
  const meta = META_MENSAL_VENDEDOR * 3 * n;
  return [
    { meta: 2 * meta, premio: 1500, rotulo: 'setor 200% da meta' },
    { meta: Math.ceil(1.5 * meta), premio: 1100, rotulo: 'setor 150% da meta' },
    { meta, premio: 600, rotulo: 'setor 100% da meta' },
  ];
}

export function calcularBonusSupervisao(totalContratosSetor: number, nVendedores: number): FaixaBonus | null {
  return faixasSupervisaoSetor(nVendedores).find(f => totalContratosSetor >= f.meta) || null;
}

/** Conta vendedores ativos (cargo VENDEDOR ou vende=1) a partir das linhas de UsuarioCRM. */
export function contarVendedoresAtivos(usuarios: Array<{ cargo?: string | null; status?: string | null; vende?: any }>): number {
  return usuarios.filter(u =>
    String(u.status || 'ATIVO').toUpperCase() === 'ATIVO' && podeReceberComissaoVendedor(u)
  ).length;
}
