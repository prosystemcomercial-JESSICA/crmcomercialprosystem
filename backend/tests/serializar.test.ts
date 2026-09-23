import { describe, it, expect } from 'vitest';
import { serializarPorChave, tamanhoFilas } from '../src/lib/serializar';

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('serializarPorChave', () => {
  it('mesma chave roda em sequência, mesmo se a primeira falhar', async () => {
    const log: string[] = [];
    const a = serializarPorChave('c1', async () => { log.push('a-ini'); await esperar(30); log.push('a-fim'); throw new Error('x'); });
    const b = serializarPorChave('c1', async () => { log.push('b-ini'); await esperar(5); log.push('b-fim'); return 2; });
    await expect(a).rejects.toThrow('x');
    await expect(b).resolves.toBe(2);
    expect(log).toEqual(['a-ini', 'a-fim', 'b-ini', 'b-fim']);
  });

  it('chaves diferentes rodam em paralelo e o Map é limpo', async () => {
    const log: string[] = [];
    const a = serializarPorChave('k1', async () => { log.push('a-ini'); await esperar(30); log.push('a-fim'); });
    const b = serializarPorChave('k2', async () => { log.push('b-ini'); await esperar(5); log.push('b-fim'); });
    await Promise.all([a, b]);
    expect(log).toEqual(['a-ini', 'b-ini', 'b-fim', 'a-fim']);
    await esperar(0);
    expect(tamanhoFilas()).toBe(0);
  });
});
