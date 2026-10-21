import { describe, it, expect } from 'vitest';
import { ordenarParaRetomada, prioridadeRetomada, MAX_RETOMADAS_RODADA } from '../src/lib/assistente/fila-retomadas';

const agora = new Date('2026-10-21T13:00:00Z');
const item = (id: string, dados: Record<string, unknown>, ultima: string | null) => ({ id, dados, ultima_caroline_em: ultima ? new Date(ultima) : null });

describe('Fila de retomadas (21/10/2026)', () => {
  it('combinado vencido vem antes de tudo, o mais antigo primeiro', () => {
    const lista = [
      item('frio-antigo', {}, '2026-10-01T12:00:00Z'),
      item('combinado-ontem', { retomar_em: '2026-10-20T12:30:00Z' }, '2026-10-18T12:00:00Z'),
      item('combinado-futuro', { retomar_em: '2026-10-28T12:30:00Z' }, '2026-10-15T12:00:00Z'),
      item('combinado-semana-passada', { retomar_em: '2026-10-15T12:30:00Z' }, '2026-10-14T12:00:00Z'),
      item('ciclo-vencido', { ciclo_em: '2026-10-19T12:30:00Z' }, '2026-10-10T12:00:00Z'),
      item('frio-recente', {}, '2026-10-20T12:00:00Z'),
    ];
    expect(ordenarParaRetomada(lista, agora).map(x => x.id)).toEqual([
      'combinado-semana-passada', 'combinado-ontem', 'ciclo-vencido', 'frio-antigo', 'frio-recente', 'combinado-futuro',
    ]);
  });

  it('lead que nunca recebeu mensagem entra entre os primeiros do grupo comum', () => {
    expect(prioridadeRetomada(item('x', {}, null), agora)).toEqual({ grupo: 2, desde: 0 });
  });

  it('data inválida não quebra a fila', () => {
    expect(prioridadeRetomada(item('x', { retomar_em: 'lixo' }, '2026-10-20T12:00:00Z'), agora).grupo).toBe(2);
  });

  it('teto por rodada protege o número', () => {
    expect(MAX_RETOMADAS_RODADA).toBeLessThanOrEqual(10);
  });
});
