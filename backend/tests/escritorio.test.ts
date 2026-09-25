import { describe, it, expect } from 'vitest';
import { AGENTES, statusAgente, maisRecente, registrarAcaoAgente, acaoRegistrada } from '../src/lib/assistente/escritorio';

const agora = new Date('2026-09-25T15:00:00Z');

describe('escritório virtual', () => {
  it('equipe: 9 agentes, só Luiz Felipe e Zequinha homens', () => {
    expect(AGENTES).toHaveLength(9);
    expect(AGENTES.map(a => a.nome)).toContain('Luiz Felipe');
    expect(AGENTES.map(a => a.nome)).toContain('Zequinha');
  });
  it('status', () => {
    expect(statusAgente(false, agora, agora)).toBe('desligado');
    expect(statusAgente(true, new Date(agora.getTime() - 5 * 60000), agora)).toBe('trabalhando');
    expect(statusAgente(true, new Date(agora.getTime() - 60 * 60000), agora)).toBe('parado');
    expect(statusAgente(true, null, agora)).toBe('parado');
  });
  it('mais recente e registro', () => {
    const a = { texto: 'a', em: new Date(1) }, b = { texto: 'b', em: new Date(2) };
    expect(maisRecente(a, b)).toBe(b);
    expect(maisRecente(null, a)).toBe(a);
    registrarAcaoAgente('marta', 'respondeu "hoje"', agora);
    expect(acaoRegistrada('marta')).toEqual({ texto: 'respondeu "hoje"', em: agora });
  });
});
