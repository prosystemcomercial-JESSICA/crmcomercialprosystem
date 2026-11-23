import { describe, it, expect } from 'vitest';
import { proximaFalhaRetomada } from '../src/lib/assistente/falha-retomada';

describe('retomada que falhou espera antes de tentar de novo (23/11/2026)', () => {
  const agora = new Date('2026-11-23T17:00:00Z');
  const h = (iso: string) => (new Date(iso).getTime() - agora.getTime()) / 3600_000;

  it('1ª falha: 1 h; 2ª: 3 h; 3ª em diante: 24 h', () => {
    const a = proximaFalhaRetomada(null, agora);
    expect(a.n).toBe(1); expect(h(a.tentar_em)).toBe(1);
    const b = proximaFalhaRetomada({ n: 1, em: '2026-11-23T16:00:00Z' }, agora);
    expect(b.n).toBe(2); expect(h(b.tentar_em)).toBe(3);
    const c = proximaFalhaRetomada({ n: 2, em: '2026-11-23T14:00:00Z' }, agora);
    expect(c.n).toBe(3); expect(h(c.tentar_em)).toBe(24);
    expect(h(proximaFalhaRetomada({ n: 7, em: '2026-11-23T10:00:00Z' }, agora).tentar_em)).toBe(24);
  });

  it('falha antiga (mais de 24 h) recomeça a conta', () => {
    const r = proximaFalhaRetomada({ n: 5, em: '2026-11-21T10:00:00Z' }, agora);
    expect(r.n).toBe(1); expect(h(r.tentar_em)).toBe(1);
  });
});
