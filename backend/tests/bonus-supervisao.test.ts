import { describe, it, expect } from 'vitest';
import { faixasSupervisaoSetor, calcularBonusSupervisao, contarVendedoresAtivos } from '@/lib/bonus-supervisao';

describe('bônus trimestral da supervisão', () => {
  it('N=1 → metas 15/23/30 e prêmios 600/1100/1500', () => {
    expect(faixasSupervisaoSetor(1).map(f => [f.meta, f.premio])).toEqual([[30, 1500], [23, 1100], [15, 600]]);
  });
  it('N=2 → metas 30/45/60', () => {
    expect(faixasSupervisaoSetor(2).map(f => f.meta)).toEqual([60, 45, 30]);
  });
  it('N=0 conta como 1', () => {
    expect(faixasSupervisaoSetor(0).map(f => f.meta)).toEqual([30, 23, 15]);
  });
  it('22 contratos com N=1 → R$600; 23 → R$1.100; 30 → R$1.500; 14 → nada', () => {
    expect(calcularBonusSupervisao(22, 1)!.premio).toBe(600);
    expect(calcularBonusSupervisao(23, 1)!.premio).toBe(1100);
    expect(calcularBonusSupervisao(30, 1)!.premio).toBe(1500);
    expect(calcularBonusSupervisao(14, 1)).toBeNull();
  });
  it('conta só ATIVOS que vendem (cargo VENDEDOR ou vende=1)', () => {
    expect(contarVendedoresAtivos([
      { cargo: 'VENDEDOR', status: 'ATIVO' },
      { cargo: 'VENDEDOR', status: 'INATIVO' },
      { cargo: 'SUPERVISAO_COMERCIAL', status: 'ATIVO', vende: 1 },
      { cargo: 'SDR', status: 'ATIVO' },
    ])).toBe(2);
  });
});
