import { describe, it, expect } from 'vitest';
import { etapaOnboarding, ITEM_APROVACAO } from '@/lib/implantacao/portal';

const item = (titulo: string, feito: boolean) => ({ grupo: 'ONBOARDING', titulo, feito });
const roteiro = (feitos: number, aprovado = false) => [item('A', feitos > 0), item('B', feitos > 1), item('C', feitos > 2), item(ITEM_APROVACAO, aprovado)];
const agora = new Date('2026-11-13T15:00:00Z');

describe('etapaOnboarding (barra do onboarding no card do Quadro)', () => {
  it('sem técnico designado', () => {
    const r = etapaOnboarding({ tecnico_id: null }, roteiro(0), agora);
    expect(r).toMatchObject({ etapa: 'SEM_TECNICO', feitos: 0, total: 4, prazo: null, atrasado: false });
  });
  it('primeiro contato e atrasado depois de 2 dias úteis', () => {
    const r = etapaOnboarding({ tecnico_id: 't', designado_em: new Date('2026-11-09T12:00:00Z') }, roteiro(0), agora);
    expect(r.etapa).toBe('PRIMEIRO_CONTATO');
    expect(r.atrasado).toBe(true);
  });
  it('diagnóstico, depois aprovação do cliente quando só falta ela', () => {
    expect(etapaOnboarding({ tecnico_id: 't' }, roteiro(1), agora).etapa).toBe('DIAGNOSTICO');
    expect(etapaOnboarding({ tecnico_id: 't' }, roteiro(3), agora).etapa).toBe('APROVACAO');
  });
  it('concluído nunca fica atrasado e ignora outros grupos', () => {
    const r = etapaOnboarding({ tecnico_id: 't', designado_em: new Date('2026-10-01'), onboarding_concluido_em: new Date('2026-10-02') }, [...roteiro(4, true), { grupo: 'INSTALACAO', titulo: 'x', feito: false }], agora);
    expect(r).toMatchObject({ etapa: 'CONCLUIDO', feitos: 4, total: 4, atrasado: false });
  });
});
