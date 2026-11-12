import { describe, it, expect } from 'vitest';
import { colunaAoIniciarOnboarding, COLUNAS_ANTES_DO_ONBOARDING } from '../src/lib/implantacao/portal';

// Pedido da Jessica (12/11/2026): começou o onboarding, o card passa sozinho para "Em andamento".
const nova = { modulo: 'IMPLANTACAO', tecnico_id: 't1', data_assinatura: new Date('2026-11-10T12:00:00Z'), status: 'PENDENTE' };

describe('card vai para Em andamento quando o onboarding começa', () => {
  it('sai de A fazer e de BackLog', () => {
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'A_FAZER' })).toBe('EM_ANDAMENTO');
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'BACKLOG' })).toBe('EM_ANDAMENTO');
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: null, etapa_execucao: 'DESIGNADO' })).toBe('EM_ANDAMENTO');
  });
  it('nunca puxa de volta um card que já andou', () => {
    for (const coluna of ['EM_ANDAMENTO', 'ACOMPANHAMENTO', 'CONCLUIDO', 'VALIDADO', 'FINALIZADO', 'CANCELADOS'])
      expect(colunaAoIniciarOnboarding({ ...nova, coluna })).toBeNull();
  });
  it('fica parado sem técnico, cancelado, serviço ou demanda antiga', () => {
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'A_FAZER', tecnico_id: null })).toBeNull();
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'A_FAZER', status: 'CANCELADA' })).toBeNull();
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'A_FAZER', modulo: 'SERVICO' })).toBeNull();
    expect(colunaAoIniciarOnboarding({ ...nova, coluna: 'A_FAZER', data_assinatura: new Date('2026-09-01T12:00:00Z') })).toBeNull();
  });
  it('Em andamento fica liberado no quadro antes de o onboarding terminar; o resto não', () => {
    expect(COLUNAS_ANTES_DO_ONBOARDING).toContain('EM_ANDAMENTO');
    expect(COLUNAS_ANTES_DO_ONBOARDING).not.toContain('ACOMPANHAMENTO');
    expect(COLUNAS_ANTES_DO_ONBOARDING).not.toContain('CONCLUIDO');
  });
});
