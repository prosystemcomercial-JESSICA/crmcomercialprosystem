import { describe, it, expect } from 'vitest';
import { deveAvancar } from '../src/lib/etapa-lead';

describe('etapa do lead acompanha o que acontece', () => {
  it('só avança', () => {
    expect(deveAvancar('NOVO_LEAD', 'PRIMEIRO_CONTATO')).toBe(true);
    expect(deveAvancar(null, 'EM_ATENDIMENTO')).toBe(true);
    expect(deveAvancar('PROPOSTA_ENVIADA', 'EM_ATENDIMENTO')).toBe(false);
    expect(deveAvancar('QUALIFICADO', 'PROPOSTA_ENVIADA')).toBe(true);
    expect(deveAvancar('EM_NEGOCIACAO', 'PROPOSTA_ENVIADA')).toBe(false);
  });
  it('nunca mexe em etapa final nem em coluna personalizada', () => {
    expect(deveAvancar('FECHADO', 'EM_NEGOCIACAO')).toBe(false);
    expect(deveAvancar('PERDIDO', 'PRIMEIRO_CONTATO')).toBe(false);
    expect(deveAvancar('ACEITO', 'PROPOSTA_ENVIADA')).toBe(false);
    expect(deveAvancar('Qcmtaoy_A_FAZER', 'EM_ATENDIMENTO')).toBe(false);
  });
});
