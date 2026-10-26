import { describe, it, expect } from 'vitest';
import { estadoRetorno, deveAvisarRetorno, destinatariosRetorno, textoRetorno } from '../src/lib/churn-retorno';

// 26/10/2026 15h em Brasília = 18h UTC
const agora = new Date('2026-10-26T18:00:00Z');

describe('retorno do caso de churn', () => {
  it('sem data não tem estado nem aviso', () => {
    expect(estadoRetorno({}, agora)).toBeNull();
    expect(deveAvisarRetorno({}, agora)).toBe(false);
  });

  it('hora passada é VENCIDO e avisa uma vez só', () => {
    const c = { retorno_em: '2026-10-26T17:30:00Z' };
    expect(estadoRetorno(c, agora)).toBe('VENCIDO');
    expect(deveAvisarRetorno(c, agora)).toBe(true);
    expect(deveAvisarRetorno({ ...c, retorno_avisado_em: agora }, agora)).toBe(false);
  });

  it('mais tarde no mesmo dia de Brasília é HOJE; amanhã é FUTURO', () => {
    expect(estadoRetorno({ retorno_em: '2026-10-27T01:00:00Z' }, agora)).toBe('HOJE'); // 22h de 26/10 em Brasília
    expect(estadoRetorno({ retorno_em: '2026-10-27T12:00:00Z' }, agora)).toBe('FUTURO');
    expect(deveAvisarRetorno({ retorno_em: '2026-10-27T01:00:00Z' }, agora)).toBe(false);
  });

  it('avisa responsável e quem marcou, sem repetir', () => {
    expect(destinatariosRetorno({ retorno_responsavel_id: 'a', retorno_marcado_por: 'b' })).toEqual(['a', 'b']);
    expect(destinatariosRetorno({ retorno_responsavel_id: 'a', retorno_marcado_por: 'a' })).toEqual(['a']);
    expect(destinatariosRetorno({ retorno_marcado_por: 'b' })).toEqual(['b']);
  });

  it('texto do retorno em horário de Brasília', () => {
    expect(textoRetorno({ retorno_em: '2026-10-28T12:30:00Z', retorno_tipo: 'CONTATO', retorno_responsavel_nome: 'Ana', retorno_obs: 'ver proposta' }))
      .toBe('Contato marcado para 28/10 às 09:30 com Ana: ver proposta');
  });
});
