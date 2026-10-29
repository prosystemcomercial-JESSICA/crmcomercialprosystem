import { describe, it, expect } from 'vitest';
import { duracaoMs, lerCotaGroq, cabeNoGroq, cotaGroqVazia, tokensEstimados } from '../src/lib/ia-groq';
import { somarPorAgente, usoAgenteVazio } from '../src/lib/uso-ia-agentes';

const cab = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null });
const AGORA = 1_800_000_000_000;

describe('duracaoMs', () => {
  it('lê os formatos do Groq', () => {
    expect(duracaoMs('1m26.4s')).toBe(86_400);
    expect(duracaoMs('3.03s')).toBe(3030);
    expect(duracaoMs('120ms')).toBe(120);
    expect(duracaoMs('7')).toBe(7000);
    expect(duracaoMs('')).toBe(0);
    expect(duracaoMs('lixo')).toBe(0);
  });
});

describe('lerCotaGroq', () => {
  it('guarda a cota da resposta (cabeçalhos reais de 29/10/2026)', () => {
    const c = lerCotaGroq(cotaGroqVazia(), cab({ 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-requests': '999', 'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-tokens': '7596' }), 200, AGORA);
    expect(c).toEqual({ limite_dia: 1000, restante_dia: 999, limite_tokens_min: 8000, restante_tokens_min: 7596, bloqueado_ate: 0, atualizado_em: AGORA });
  });
  it('429 bloqueia pelo retry-after; sem ele, 1 minuto', () => {
    expect(lerCotaGroq(cotaGroqVazia(), cab({ 'retry-after': '30' }), 429, AGORA).bloqueado_ate).toBe(AGORA + 30_000);
    expect(lerCotaGroq(cotaGroqVazia(), cab({}), 429, AGORA).bloqueado_ate).toBe(AGORA + 60_000);
  });
  it('cota do dia zerada bloqueia até renovar', () => {
    const c = lerCotaGroq(cotaGroqVazia(), cab({ 'x-ratelimit-remaining-requests': '0', 'x-ratelimit-reset-requests': '2m0s' }), 200, AGORA);
    expect(c.bloqueado_ate).toBe(AGORA + 120_000);
  });
  it('erro sem cabeçalho mantém a cota anterior', () => {
    const antes = { ...cotaGroqVazia(), limite_dia: 1000, restante_dia: 500 };
    expect(lerCotaGroq(antes, cab({}), 500, AGORA).restante_dia).toBe(500);
  });
});

describe('cabeNoGroq', () => {
  const livre = cotaGroqVazia();
  it('pedido normal cabe', () => {
    expect(cabeNoGroq(livre, 'x'.repeat(3000), { maxEntrada: 5000 }, AGORA)).toBe(true);
  });
  it('pedido grande demais vai direto para a paga', () => {
    expect(tokensEstimados('x'.repeat(15_003))).toBe(5001);
    expect(cabeNoGroq(livre, 'x'.repeat(15_003), { maxEntrada: 5000 }, AGORA)).toBe(false);
  });
  it('bloqueado não tenta; depois do bloqueio volta', () => {
    const c = { ...livre, bloqueado_ate: AGORA + 1000 };
    expect(cabeNoGroq(c, 'oi', { maxEntrada: 5000 }, AGORA)).toBe(false);
    expect(cabeNoGroq(c, 'oi', { maxEntrada: 5000 }, AGORA + 1001)).toBe(true);
  });
  it('sem tokens no minuto: espera; depois de 1 minuto a cota já renovou', () => {
    const c = { ...livre, restante_tokens_min: 1000, atualizado_em: AGORA };
    expect(cabeNoGroq(c, 'x'.repeat(300), { maxEntrada: 5000 }, AGORA + 5000)).toBe(false);
    expect(cabeNoGroq(c, 'x'.repeat(300), { maxEntrada: 5000 }, AGORA + 61_000)).toBe(true);
  });
});

describe('uso do Groq por assistente', () => {
  it('soma respondidas, idas para a paga e tokens; registro antigo sem Groq não quebra', () => {
    const dia = somarPorAgente({ heitor: { openai: 2 } }, { heitor: { ...usoAgenteVazio(), groq: 3, groq_reserva: 1, groq_tokens: 900 } });
    expect(dia.heitor).toEqual({ ...usoAgenteVazio(), openai: 2, groq: 3, groq_reserva: 1, groq_tokens: 900 });
  });
});
