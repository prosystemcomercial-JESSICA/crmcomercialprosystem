import { describe, it, expect } from 'vitest';
import { fraseDoDia, saudacao, FRASES } from '../src/lib/implantacao/frases';

describe('início do portal técnico', () => {
  it('a frase é a mesma o dia todo e muda no dia seguinte', () => {
    const manha = new Date('2026-10-05T11:00:00Z'), noite = new Date('2026-10-05T23:00:00Z'), amanha = new Date('2026-10-06T11:00:00Z');
    expect(fraseDoDia(manha)).toBe(fraseDoDia(noite));
    expect(fraseDoDia(amanha)).not.toBe(fraseDoDia(manha));
    expect(FRASES.length).toBeGreaterThanOrEqual(30);
  });
  it('saudação pelo horário de Brasília', () => {
    expect(saudacao(new Date('2026-10-05T11:00:00Z'))).toBe('Bom dia'); // 8h
    expect(saudacao(new Date('2026-10-05T17:00:00Z'))).toBe('Boa tarde'); // 14h
    expect(saudacao(new Date('2026-10-05T23:00:00Z'))).toBe('Boa noite'); // 20h
  });
});
