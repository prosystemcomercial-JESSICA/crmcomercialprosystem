import { describe, it, expect } from 'vitest';
import { custoUsd, tabelaDePrecos, estimarCustoAntigo, custoDoDia, resumoCusto, diasDoResumo } from '../src/lib/custo-ia';
import { usoAgenteVazio } from '../src/lib/uso-ia-agentes';

const tabela = tabelaDePrecos({});
const modelos = { openai: tabela['gpt-6-luna'], grok: tabela['grok-4.7'] };

describe('custoUsd', () => {
  it('preço de tabela por milhão de tokens', () => {
    expect(custoUsd(tabela, 'gpt-6-luna', 1_000_000, 1_000_000)).toBeCloseTo(0.6);
    expect(custoUsd(tabela, 'grok-4.7', 500_000, 100_000)).toBeCloseTo(1.6);
  });
  it('modelo fora da tabela: null', () => {
    expect(custoUsd(tabela, 'modelo-novo', 10, 10)).toBeNull();
  });
  it('IA_PRECOS troca e acrescenta; JSON inválido é ignorado', () => {
    const t = tabelaDePrecos({ IA_PRECOS: '{"gpt-6-luna":{"entrada":1,"saida":2},"novo":{"entrada":3,"saida":4}}' });
    expect(t['gpt-6-luna']).toEqual({ entrada: 1, saida: 2 });
    expect(t.novo).toEqual({ entrada: 3, saida: 4 });
    expect(tabelaDePrecos({ IA_PRECOS: '{x' })['grok-4.7']).toEqual(tabela['grok-4.7']);
  });
});

describe('estimativa dos dias antigos', () => {
  it('tira os tokens do Groq e divide o resto pelas chamadas', () => {
    const u = { ...usoAgenteVazio(), openai: 1, groq: 1, tokens_entrada: 2_000_000, tokens_saida: 0, groq_tokens: 1_000_000 };
    // 1 milhão de tokens de entrada sobra para a única chamada paga (OpenAI): US$ 0,10.
    expect(estimarCustoAntigo(u, modelos).openai).toBeCloseTo(0.1);
    expect(estimarCustoAntigo(u, modelos).grok).toBe(0);
  });
  it('sem chamadas pagas ou sem tokens: zero', () => {
    expect(estimarCustoAntigo({ ...usoAgenteVazio(), groq: 3, groq_tokens: 900, tokens_entrada: 900 }, modelos)).toEqual({ openai: 0, grok: 0 });
  });
});

describe('custoDoDia', () => {
  it('dia todo medido: usa o gravado', () => {
    const u = { ...usoAgenteVazio(), openai: 2, custo_gravado: 2, custo_openai_usd: 0.05, tokens_entrada: 9_000_000 };
    expect(custoDoDia(u, modelos)).toEqual({ openai: 0.05, grok: 0, estimado: false });
  });
  it('dia antigo: estimado', () => {
    const u = { ...usoAgenteVazio(), grok: 1, tokens_entrada: 1_000_000 };
    const c = custoDoDia(u, modelos);
    expect(c.estimado).toBe(true);
    expect(c.grok).toBeCloseTo(2);
  });
  it('dia da publicação: gravado + estimativa da parte sem medir', () => {
    const u = { ...usoAgenteVazio(), openai: 2, custo_gravado: 1, custo_openai_usd: 0.01, tokens_entrada: 2_000_000 };
    const c = custoDoDia(u, modelos);
    expect(c.estimado).toBe(true);
    expect(c.openai).toBeCloseTo(0.01 + 0.2 * 0.5);
  });
});

describe('resumoCusto', () => {
  // 1 chamada à OpenAI medida = US$ 1; cotação 5 → R$ 5.
  const dia = (usd: number, agente = 'caroline') => ({ [agente]: { ...usoAgenteVazio(), openai: 1, custo_gravado: 1, custo_openai_usd: usd } });
  const base = { cotacao: 5, modelos, nome: (a: string) => a.toUpperCase() };

  it('mês atual, média só dos dias medidos, projeção e mês anterior', () => {
    const dias = [
      { dia: '2026-10-30', agentes: dia(2) },
      { dia: '2026-11-01', agentes: dia(1) },
      { dia: '2026-11-02', agentes: {} },
      { dia: '2026-11-03', agentes: dia(3, 'rafael') },
    ];
    const r = resumoCusto({ ...base, dias, periodo: ['2026-11-02', '2026-11-03'], hoje: '2026-11-03' });
    expect(r.dados_desde).toBe('2026-10-30');
    expect(r.mes.brl).toBe(20);
    expect(r.mes.media_dia).toBeCloseTo(20 / 3);
    expect(r.mes.projecao_brl).toBeCloseTo(Math.round((20 / 3) * 100) / 100 * 30);
    expect(r.mes.anterior).toEqual({ mes: '2026-10', brl: 10, dias_com_dados: 1, media_dia: 10 });
    expect(r.mes.por_dia).toHaveLength(30);
    expect((r.mes.por_dia[10] as any).futuro).toBe(true);
    expect(r.periodo.brl).toBe(15);
    expect(r.periodo.top_dias.map(d => d.dia)).toEqual(['2026-11-03']);
    expect(r.periodo.por_agente).toEqual([expect.objectContaining({ agente: 'rafael', nome: 'RAFAEL', brl: 15, pct: 100, chamadas_pagas: 1, brl_por_chamada: 15 })]);
    expect(r.periodo.por_dia[1].agentes).toEqual({ rafael: 15 });
  });

  it('dias antes da primeira contagem não baixam a média', () => {
    const r = resumoCusto({ ...base, dias: [{ dia: '2026-11-03', agentes: dia(1) }], periodo: ['2026-11-01', '2026-11-02', '2026-11-03'], hoje: '2026-11-03' });
    expect(r.periodo.media_dia).toBe(5);
    expect(r.periodo.dias_medidos).toBe(1);
  });

  it('diasDoResumo junta o período, o mês até hoje e o mês anterior inteiro', () => {
    const d = diasDoResumo(['2026-09-20'], '2026-11-02');
    expect(d[0]).toBe('2026-09-20');
    expect(d).toContain('2026-10-01');
    expect(d).toContain('2026-10-31');
    expect(d[d.length - 1]).toBe('2026-11-02');
    expect(d).toHaveLength(1 + 31 + 2);
  });
});
