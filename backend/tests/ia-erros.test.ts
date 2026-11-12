import { describe, it, expect } from 'vitest';
import { classificarErroIa, anotarErro, somarErros, resumoErrosPorAgente, type ErrosDoDia } from '../src/lib/ia-erros';

describe('classificarErroIa', () => {
  it('reconhece os erros que já aconteceram em produção', () => {
    expect(classificarErroIa('A chave da IA é inválida. Confira no servidor.')).toBe('chave_invalida');
    expect(classificarErroIa('Limite de uso da IA atingido. Tente de novo em alguns minutos.')).toBe('limite');
    expect(classificarErroIa('Gemini sem crédito: a chave é de um projeto com cobrança pré-paga (HTTP 402).')).toBe('sem_credito');
    expect(classificarErroIa('Sem crédito na OpenAI (insufficient_quota, HTTP 429).')).toBe('sem_credito');
    expect(classificarErroIa('The operation was aborted due to timeout')).toBe('tempo_esgotado');
    expect(classificarErroIa('HTTP 429')).toBe('limite');
    expect(classificarErroIa('resposta vazia')).toBe('resposta_vazia');
    expect(classificarErroIa('IA indisponível (HTTP 404: model_not_found).')).toBe('modelo_indisponivel');
    expect(classificarErroIa('IA indisponível (HTTP 400: invalid_request_error).')).toBe('pedido_recusado');
    expect(classificarErroIa('IA indisponível (HTTP 503).')).toBe('fora_do_ar');
    expect(classificarErroIa('fetch failed')).toBe('fora_do_ar');
    expect(classificarErroIa('algo estranho')).toBe('outro');
  });
});

describe('anotarErro e somarErros', () => {
  it('conta por agente, IA e motivo, com primeira e última vez, hora e exemplo', () => {
    const d: ErrosDoDia = {};
    anotarErro(d, 'julio', 'openai', 'A chave da IA é inválida.', new Date('2026-11-03T12:00:00Z'), 'gpt-6-luna');
    anotarErro(d, 'julio', 'openai', 'A chave da IA é inválida!', new Date('2026-11-03T15:30:00Z'));
    anotarErro(d, 'julio', 'openrouter', 'HTTP 429', new Date('2026-11-03T13:00:00Z'));
    const r = d.julio.openai.chave_invalida!;
    expect(r.n).toBe(2);
    expect(r.primeiro).toBe('2026-11-03T12:00:00.000Z');
    expect(r.ultimo).toBe('2026-11-03T15:30:00.000Z');
    expect(r.exemplo).toBe('A chave da IA é inválida!');
    expect(r.modelo).toBe('gpt-6-luna');
    expect(r.horas).toEqual({ '09': 1, '12': 1 }); // horário de Brasília
    expect(d.julio.openrouter.limite!.n).toBe(1);
  });

  it('soma o gravado com o da memória sem mudar os originais', () => {
    const a: ErrosDoDia = {}, b: ErrosDoDia = {};
    anotarErro(a, 'sofia', 'openai', 'HTTP 401', new Date('2026-11-02T10:00:00Z'));
    anotarErro(b, 'sofia', 'openai', 'HTTP 401', new Date('2026-11-02T11:00:00Z'));
    anotarErro(b, 'rafael', 'groq', 'HTTP 429', new Date('2026-11-02T11:00:00Z'));
    const s = somarErros(a, b);
    expect(s.sofia.openai.chave_invalida!.n).toBe(2);
    expect(s.sofia.openai.chave_invalida!.horas).toEqual({ '07': 1, '08': 1 });
    expect(s.rafael.groq.limite!.n).toBe(1);
    expect(a.sofia.openai.chave_invalida!.n).toBe(1);
  });
});

describe('resumoErrosPorAgente', () => {
  it('junta os dias e ordena do motivo mais frequente', () => {
    const d1: ErrosDoDia = {}, d2: ErrosDoDia = {};
    anotarErro(d1, 'julio', 'openai', 'HTTP 401', new Date('2026-11-03T12:00:00Z'));
    anotarErro(d2, 'julio', 'openai', 'HTTP 401', new Date('2026-11-04T12:00:00Z'));
    anotarErro(d2, 'julio', 'openai', 'HTTP 401', new Date('2026-11-04T13:00:00Z'));
    anotarErro(d2, 'julio', 'openrouter', 'timeout', new Date('2026-11-04T13:00:00Z'));
    const r = resumoErrosPorAgente([d1, d2]).julio;
    expect(r[0]).toMatchObject({ provedor: 'openai', motivo: 'chave_invalida', n: 3, dias: 2, primeiro: '2026-11-03T12:00:00.000Z', ultimo: '2026-11-04T13:00:00.000Z' });
    expect(r[1]).toMatchObject({ provedor: 'openrouter', motivo: 'tempo_esgotado', n: 1 });
  });
});
