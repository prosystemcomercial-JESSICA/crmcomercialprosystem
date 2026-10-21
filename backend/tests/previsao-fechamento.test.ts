import { describe, it, expect } from 'vitest';
import { probabilidadeProposta, probabilidadeLeadAgente, resumirPrevisao, mediana, diasEntre, semHistorico, type ItemPrevisao } from '../src/lib/previsao-fechamento';

describe('Previsão de fechamento com dados concretos (21/10/2026)', () => {
  it('chance pelo status e pela idade da proposta', () => {
    expect(probabilidadeProposta('ACEITA', 3)).toBe(0.9);
    expect(probabilidadeProposta('ENVIADA', 5)).toBe(0.4);
    expect(probabilidadeProposta('ENVIADA', 30)).toBe(0.2);
    expect(probabilidadeProposta('ENVIADA', 120)).toBe(0.1);
    expect(probabilidadeProposta('EXPIRADA', 40)).toBe(0.08);
    expect(probabilidadeProposta('RASCUNHO', 1)).toBe(0.15);
    expect(probabilidadeProposta('CONTRATO_ASSINADO', 1)).toBe(0);
    expect(probabilidadeProposta('PERDIDA', 1)).toBe(0);
  });

  it('lead do agente só conta se quente ou morno', () => {
    expect(probabilidadeLeadAgente('QUENTE')).toBe(0.15);
    expect(probabilidadeLeadAgente('MORNO')).toBe(0.04);
    expect(probabilidadeLeadAgente('FRIO')).toBe(0);
  });

  it('resume em contratos e mensalidade, com cenários', () => {
    const it = (probabilidade: number, mensalidade: number): ItemPrevisao => ({ origem: 'proposta', empresa: 'x', status: 'ENVIADA', probabilidade, mensalidade, implantacao: 1000, dias: 1, vendedor: null, link: null });
    const r = resumirPrevisao([it(0.9, 400), it(0.4, 300), it(0.08, 350)]);
    expect(r.contratos).toEqual({ pessimista: 1.3, realista: 1.4, otimista: 2 });
    expect(r.mensalidade.realista).toBe(Math.round(0.9 * 400 + 0.4 * 300 + 0.08 * 350));
    expect(r.mensalidade.otimista).toBe(700);
    expect(r.implantacao_realista).toBe(1380);
  });

  it('mediana, dias e contrato sem histórico', () => {
    expect(mediana([52, 6, 12, 31, 37])).toBe(31);
    expect(mediana([1, 3])).toBe(2);
    expect(mediana([])).toBeNull();
    expect(diasEntre(new Date('2026-10-01'), new Date('2026-10-11'))).toBe(10);
    expect(diasEntre(null, new Date())).toBeNull();
    expect(semHistorico(0, 0)).toBe(true);
    expect(semHistorico(null, 0)).toBe(true);
    expect(semHistorico(null, 20)).toBe(false);
    expect(semHistorico(31, 0)).toBe(false);
  });
});
