import { describe, it, expect } from 'vitest';
import {
  limitesPeriodo, meiaNoiteNoFuso, horaLocal, contarPorMes, dentro,
  tokenTvValido, parseMeta, progresso,
  ehSaidaHumana, iniciadaPor, minutosPrimeiraRespostaHumana, mediaPrimeiraResposta,
  primeiroNome, montarFunil, mediaPositivos, soma, ritmoAnual, valorInstalacao, valorMensalidade, dataFechamento,
} from '../src/lib/painel-tv';

const d = (s: string) => new Date(s);

describe('limites de data em São Paulo', () => {
  it('meia-noite de SP é 03:00 UTC', () => {
    expect(meiaNoiteNoFuso(2026, 9, 24).toISOString()).toBe('2026-09-24T03:00:00.000Z');
  });

  it('hoje/mês/ano a partir de um instante UTC no meio do dia', () => {
    const l = limitesPeriodo(d('2026-09-24T17:32:00Z'));
    expect(l.ano).toBe(2026);
    expect(l.mes).toBe(9);
    expect(l.inicioHoje.toISOString()).toBe('2026-09-24T03:00:00.000Z');
    expect(l.fimHoje.toISOString()).toBe('2026-09-25T03:00:00.000Z');
    expect(l.inicioMes.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(l.fimMes.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(l.inicioAno.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(l.fimAno.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('01:00 UTC ainda é o dia anterior em SP (22:00)', () => {
    const l = limitesPeriodo(d('2026-10-01T01:00:00Z'));
    expect(l.mes).toBe(9);
    expect(l.inicioHoje.toISOString()).toBe('2026-09-30T03:00:00.000Z');
    expect(l.inicioMes.toISOString()).toBe('2026-09-01T03:00:00.000Z');
  });

  it('virada de ano: 31/12 23h em SP', () => {
    const l = limitesPeriodo(d('2027-01-01T02:30:00Z'));
    expect(l.ano).toBe(2026);
    expect(l.mes).toBe(12);
    expect(l.fimMes.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('dentro() é semiaberto', () => {
    const l = limitesPeriodo(d('2026-09-24T17:32:00Z'));
    expect(dentro(d('2026-09-24T03:00:00Z'), l.inicioHoje, l.fimHoje)).toBe(true);
    expect(dentro(d('2026-09-25T03:00:00Z'), l.inicioHoje, l.fimHoje)).toBe(false);
    expect(dentro(null, l.inicioHoje, l.fimHoje)).toBe(false);
  });

  it('hora local e contagem por mês no fuso', () => {
    expect(horaLocal(d('2026-09-24T17:05:00Z'))).toBe('14:05');
    const meses = contarPorMes([d('2026-01-01T02:00:00Z'), d('2026-01-01T03:00:00Z'), d('2026-09-10T12:00:00Z'), null], 2026);
    expect(meses[0]).toBe(1); // 01/01 02:00Z ainda é 2025 em SP
    expect(meses[8]).toBe(1);
    expect(meses.reduce((s, n) => s + n, 0)).toBe(2);
  });
});

describe('token da TV', () => {
  it('aceita só o token exato', () => {
    expect(tokenTvValido('abc123', 'abc123')).toBe(true);
    expect(tokenTvValido('abc124', 'abc123')).toBe(false);
    expect(tokenTvValido('abc', 'abc123')).toBe(false);
  });
  it('sem token salvo ou sem token recebido → inválido', () => {
    expect(tokenTvValido('abc', null)).toBe(false);
    expect(tokenTvValido('', '')).toBe(false);
    expect(tokenTvValido(undefined, 'abc')).toBe(false);
    expect(tokenTvValido(['abc'], 'abc')).toBe(false);
  });
});

describe('metas', () => {
  it('parseMeta', () => {
    expect(parseMeta('120')).toBe(120);
    expect(parseMeta('25000,5')).toBe(25000.5);
    expect(parseMeta('')).toBeNull();
    expect(parseMeta('0')).toBeNull();
    expect(parseMeta('abc')).toBeNull();
    expect(parseMeta(null)).toBeNull();
  });
  it('progresso sem meta não tem pct', () => {
    expect(progresso(10, null)).toEqual({ valor: 10, meta: null, pct: null });
    expect(progresso(null, 100)).toEqual({ valor: null, meta: 100, pct: null });
    expect(progresso(86, 120).pct).toBe(71.7);
  });
  it('ritmo anual', () => {
    expect(ritmoAnual(86, 120, 9)).toEqual({ por_mes: 9.6, necessario_por_mes: 8.5 });
    expect(ritmoAnual(10, null, 9).necessario_por_mes).toBeNull();
  });
});

describe('conversas do WhatsApp', () => {
  const E = (min: number) => ({ direcao: 'ENTRADA', enviada_por: null, created_at: new Date(Date.UTC(2026, 8, 24, 12, min)) });
  const S = (min: number, por: string | null) => ({ direcao: 'SAIDA', enviada_por: por, created_at: new Date(Date.UTC(2026, 8, 24, 12, min)) });

  it('robô e cadência não são resposta humana; celular (null) e usuário são', () => {
    expect(ehSaidaHumana(S(0, 'bot'))).toBe(false);
    expect(ehSaidaHumana(S(0, 'cadencia_automatica'))).toBe(false);
    expect(ehSaidaHumana(S(0, null))).toBe(true);
    expect(ehSaidaHumana(S(0, 'user-1'))).toBe(true);
    expect(ehSaidaHumana(E(0))).toBe(false);
  });

  it('quem iniciou', () => {
    expect(iniciadaPor([S(5, 'u'), E(1)])).toBe('cliente');
    expect(iniciadaPor([S(1, 'u'), E(5)])).toBe('equipe');
    expect(iniciadaPor([])).toBeNull();
  });

  it('primeira resposta humana ignora o robô', () => {
    expect(minutosPrimeiraRespostaHumana([E(0), S(1, 'bot'), S(7, 'u1')])).toBe(7);
    expect(minutosPrimeiraRespostaHumana([E(0), S(1, 'bot')])).toBeNull();
    expect(minutosPrimeiraRespostaHumana([S(0, 'u1')])).toBeNull();
  });

  it('média só com conversas respondidas', () => {
    expect(mediaPrimeiraResposta([[E(0), S(4, 'u')], [E(0), S(8, null)], [E(0)]])).toBe(6);
    expect(mediaPrimeiraResposta([[E(0)]])).toBeNull();
  });
});

describe('formatação', () => {
  it('primeiro nome', () => {
    expect(primeiroNome('Jessica Souza Lima')).toBe('Jessica');
    expect(primeiroNome('  Ana ')).toBe('Ana');
    expect(primeiroNome(null)).toBe('—');
  });

  it('funil ignora etapas inválidas e segue a ordem das colunas', () => {
    const f = montarFunil(
      [{ etapa: 'EM_NEGOCIACAO', total: 3 }, { etapa: 'LIXO', total: 99 }, { etapa: 'NOVO_LEAD', total: 10 }, { etapa: null, total: 5 }],
      [{ chave: 'NOVO_LEAD', nome: 'Novo Lead' }, { chave: 'EM_NEGOCIACAO', nome: 'Em Negociação' }, { chave: 'FECHADO', nome: 'Fechado' }],
    );
    expect(f).toEqual([
      { etapa: 'NOVO_LEAD', nome: 'Novo Lead', total: 10 },
      { etapa: 'EM_NEGOCIACAO', nome: 'Em Negociação', total: 3 },
      { etapa: 'FECHADO', nome: 'Fechado', total: 0 },
    ]);
  });

  it('médias e somas', () => {
    expect(mediaPositivos([0, null, 100, 200])).toBe(150);
    expect(mediaPositivos([0, null])).toBeNull();
    expect(soma([1.005, 2, null])).toBe(3.01);
  });

  it('valores de fechamento seguem meta-progress', () => {
    expect(valorInstalacao({ valor_implantacao: null, valor_final: 900 })).toBe(900);
    expect(valorMensalidade({ mensalidade_plus: null, mensalidade_pro: 289 })).toBe(289);
    const c = d('2026-01-01T00:00:00Z');
    expect(dataFechamento({ data_aceite: null, created_at: c })).toBe(c);
  });
});
