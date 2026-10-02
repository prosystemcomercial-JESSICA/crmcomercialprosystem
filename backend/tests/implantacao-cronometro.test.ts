import { describe, it, expect } from 'vitest';
import { unirIntervalos, resumoDoDia, janelasDaJornada, fimAutomatico, temposDaDemanda, emSP } from '../src/lib/implantacao/cronometro';

const t = (hhmm: string, dia = '2026-10-01') => emSP(dia, hhmm); // quinta-feira
const H = 3600000;

describe('cronômetro do técnico', () => {
  it('duas demandas abertas na mesma hora contam uma hora', () => {
    const u = unirIntervalos([{ inicio: t('09:00'), fim: t('10:00') }, { inicio: t('09:30'), fim: t('10:00') }]);
    expect(u).toHaveLength(1);
    const r = resumoDoDia([
      { inicio: t('09:00'), fim: t('10:00'), tipo: 'DEMANDA', etapa: 'CONVERSAO', implantacao_id: 'a' },
      { inicio: t('09:30'), fim: t('10:00'), tipo: 'DEMANDA', etapa: 'INSTALACAO', implantacao_id: 'b' },
    ], '2026-10-01');
    expect(r.trabalhado_ms).toBe(H);
  });

  it('jornada normal tem 9h e dia de virada 10h', () => {
    const soma = (js: { inicio: Date; fim: Date }[]) => js.reduce((s, j) => s + j.fim.getTime() - j.inicio.getTime(), 0);
    expect(soma(janelasDaJornada('2026-10-01'))).toBe(9 * H);
    expect(soma(janelasDaJornada('2026-10-01', undefined, true))).toBe(10 * H);
    expect(janelasDaJornada('2026-10-03')).toHaveLength(0); // sábado
  });

  it('almoço e madrugada não entram no aproveitamento; madrugada vira hora extra', () => {
    const r = resumoDoDia([
      { inicio: t('11:00'), fim: t('14:00'), tipo: 'DEMANDA', etapa: 'CONVERSAO' }, // 1h de almoço no meio
      { inicio: t('02:00'), fim: t('03:30'), tipo: 'DEMANDA', etapa: 'CONVERSAO' },
    ], '2026-10-01');
    expect(r.trabalhado_ms).toBe(4.5 * H);
    expect(r.dentro_ms).toBe(2 * H);
    expect(r.extra_ms).toBe(2.5 * H);
    expect(r.aproveitamento).toBeCloseTo(2 / 9);
  });

  it('outras atividades (suporte, reunião) contam no dia e aparecem por tipo', () => {
    const r = resumoDoDia([
      { inicio: t('08:00'), fim: t('09:00'), tipo: 'SUPORTE' },
      { inicio: t('09:00'), fim: t('11:00'), tipo: 'DEMANDA', etapa: 'TREINAMENTO', implantacao_id: 'a' },
    ], '2026-10-01');
    expect(r.por_tipo).toEqual({ SUPORTE: H, DEMANDA: 2 * H });
    expect(r.por_etapa).toEqual({ TREINAMENTO: 2 * H });
    expect(r.por_demanda).toEqual({ a: 2 * H });
  });

  it('sessão aberta conta até agora e fecha sozinha às 23:59:59', () => {
    const r = resumoDoDia([{ inicio: t('08:00'), fim: null, tipo: 'DEMANDA', etapa: 'CONVERSAO' }], '2026-10-01', { agora: t('10:00') });
    expect(r.trabalhado_ms).toBe(2 * H);
    expect(fimAutomatico(t('15:00')).toISOString()).toBe('2026-10-02T02:59:59.000Z');
  });

  it('tempos da demanda separam trabalho e esperas', () => {
    const r = temposDaDemanda(
      [{ inicio: t('08:00'), fim: t('10:00'), tipo: 'DEMANDA', etapa: 'CONVERSAO' }, { inicio: t('13:00'), fim: t('14:00'), tipo: 'DEMANDA', etapa: 'INSTALACAO' }],
      [{ inicio: t('10:00'), fim: t('13:00'), tipo: 'PROGRAMACAO' }, { inicio: t('14:00'), fim: null, tipo: 'CLIENTE' }],
      { inicio: t('07:00'), agora: t('16:00') },
    );
    expect(r.trabalho_ms).toBe(3 * H);
    expect(r.por_etapa).toEqual({ CONVERSAO: 2 * H, INSTALACAO: H });
    expect(r.esperas.PROGRAMACAO).toEqual({ qtd: 1, ms: 3 * H, abertas: 0 });
    expect(r.esperas.CLIENTE).toEqual({ qtd: 1, ms: 2 * H, abertas: 1 });
    expect(r.prazo_total_ms).toBe(9 * H);
  });
});
