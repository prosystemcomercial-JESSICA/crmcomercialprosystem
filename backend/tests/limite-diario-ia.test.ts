import { describe, it, expect } from 'vitest';
import { lerLimiteDiario, situacaoLimiteDiario, textoBloqueioOpenAi, LIMITE_DIARIO_OPENAI_PADRAO } from '../src/lib/limite-diario-ia';

describe('limite diário da OpenAI (23/11/2026)', () => {
  it('sem valor gravado vale o padrão de R$ 15', () => {
    expect(LIMITE_DIARIO_OPENAI_PADRAO).toBe(15);
    expect(lerLimiteDiario(null)).toBe(15);
    expect(lerLimiteDiario('')).toBe(15);
    expect(lerLimiteDiario('abc')).toBe(15);
  });

  it('valor gravado no painel vence o padrão e o .env; 0 = sem limite', () => {
    expect(lerLimiteDiario('20', { IA_LIMITE_DIARIO_OPENAI_BRL: '30' })).toBe(20);
    expect(lerLimiteDiario('0')).toBe(0);
    expect(lerLimiteDiario(null, { IA_LIMITE_DIARIO_OPENAI_BRL: '30' })).toBe(30);
    expect(lerLimiteDiario('-5')).toBe(15);
  });

  it('bloqueia ao alcançar o limite; atenção a partir de 80%', () => {
    expect(situacaoLimiteDiario(10, 15)).toMatchObject({ nivel: 'ok', bloqueado: false });
    expect(situacaoLimiteDiario(12, 15)).toMatchObject({ nivel: 'atencao', bloqueado: false });
    expect(situacaoLimiteDiario(14.99, 15)).toMatchObject({ bloqueado: false });
    expect(situacaoLimiteDiario(15, 15)).toMatchObject({ nivel: 'bloqueado', bloqueado: true });
    expect(situacaoLimiteDiario(22.4, 15)).toMatchObject({ bloqueado: true, gasto: 22.4 });
  });

  it('sem limite nunca bloqueia', () => {
    expect(situacaoLimiteDiario(999, 0)).toMatchObject({ nivel: 'sem_limite', bloqueado: false });
  });

  it('a mensagem diz o valor e que volta à meia-noite', () => {
    const t = textoBloqueioOpenAi(15);
    expect(t).toMatch(/R\$\s?15,00/);
    expect(t).toMatch(/meia-noite/);
  });
});
