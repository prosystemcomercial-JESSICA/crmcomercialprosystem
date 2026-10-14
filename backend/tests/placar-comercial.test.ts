import { describe, it, expect } from 'vitest';
import { semanaDe, esquecidoSemDemo, METAS_PADRAO } from '../src/lib/placar-comercial';

// Parte 2 do Plano de Expansão (14/10/2026): placar contra a meta da semana e interessado esquecido.
describe('placar comercial', () => {
  it('a semana começa na segunda e casa com as metas do plano', () => {
    expect(semanaDe(new Date('2026-10-15T15:00:00-03:00')).chave).toBe('2026-10-12');
    expect(semanaDe(new Date('2026-10-19T08:00:00-03:00')).chave).toBe('2026-10-19');
    expect(semanaDe(new Date('2026-10-25T23:30:00-03:00')).chave).toBe('2026-10-19'); // domingo
    expect(METAS_PADRAO['2026-10-26'].contratos).toBe(2);
  });

  it('interessado esquecido: 48 h sem demonstração (sem data = antigo, conta)', () => {
    const agora = new Date('2026-10-16T10:00:00-03:00');
    expect(esquecidoSemDemo('2026-10-14T09:00:00-03:00', agora)).toBe(true);
    expect(esquecidoSemDemo('2026-10-15T09:00:00-03:00', agora)).toBe(false);
    expect(esquecidoSemDemo(null, agora)).toBe(true);
  });
});
