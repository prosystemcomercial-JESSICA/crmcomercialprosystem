import { describe, it, expect } from 'vitest';
import { SemaforoIa } from '../src/lib/ia-semaforo';

describe('semáforo das IAs', () => {
  it('pausa 15 min após 3 falhas seguidas e volta sozinho', () => {
    let t = 0;
    const s = new SemaforoIa(() => t);
    expect(s.falha('openai', 'HTTP 500')).toBe(false);
    expect(s.falha('openai', 'HTTP 500')).toBe(false);
    expect(s.falha('openai', 'HTTP 500')).toBe(true);
    expect(s.bloqueado('openai')).toBe(true);
    expect(s.voltaEm('openai')).toBe(15);
    t = 16 * 60_000;
    expect(s.bloqueado('openai')).toBe(false);
  });

  it('chave recusada pausa na primeira falha e a pausa cresce (15, 30, 60, 60)', () => {
    let t = 0;
    const s = new SemaforoIa(() => t);
    for (const esperado of [15, 30, 60, 60]) {
      expect(s.falha('gemini', 'Gemini sem crédito (HTTP 402)')).toBe(true);
      expect(s.voltaEm('gemini')).toBe(esperado);
      t += (esperado + 1) * 60_000;
    }
  });

  it('um sucesso zera as falhas e o nível', () => {
    const s = new SemaforoIa(() => 0);
    s.falha('groq', 'x'); s.falha('groq', 'x');
    s.sucesso('groq');
    expect(s.falha('groq', 'x')).toBe(false);
    expect(s.resumo(() => true).find(r => r.provedor === 'groq')).toMatchObject({ estado: 'ok', falhas_seguidas: 1 });
    expect(s.resumo(p => p !== 'grok').find(r => r.provedor === 'grok')?.estado).toBe('sem_chave');
  });
});
