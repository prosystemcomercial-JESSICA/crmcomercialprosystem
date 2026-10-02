import { describe, it, expect } from 'vitest';
import { colunaDe, situacaoSla, prazosPadrao, somarDiasUteis, horasUteisEntre } from '../src/lib/implantacao/portal';
import { emSP } from '../src/lib/implantacao/cronometro';

describe('portal de implantação', () => {
  it('demandas antigas caem na coluna certa pela etapa', () => {
    expect(colunaDe({ etapa_execucao: 'EM_CONVERSAO' })).toBe('EM_ANDAMENTO');
    expect(colunaDe({ etapa_execucao: 'EM_TREINAMENTO' })).toBe('ACOMPANHAMENTO');
    expect(colunaDe({ status: 'CANCELADA', etapa_execucao: 'DESIGNADO' })).toBe('CANCELADOS');
    expect(colunaDe({ coluna: 'VALIDADO', etapa_execucao: 'EM_CONVERSAO' })).toBe('VALIDADO');
    expect(colunaDe({})).toBe('A_FAZER');
  });

  it('SLA: em risco a partir de 80%, estourado depois do prazo', () => {
    const ini = emSP('2026-10-01', '08:00'), prazo = new Date(ini.getTime() + 10 * 864e5);
    expect(situacaoSla(ini, prazo, null, new Date(ini.getTime() + 5 * 864e5))?.situacao).toBe('NO_PRAZO');
    expect(situacaoSla(ini, prazo, null, new Date(ini.getTime() + 8 * 864e5))?.situacao).toBe('EM_RISCO');
    expect(situacaoSla(ini, prazo, null, new Date(ini.getTime() + 11 * 864e5))?.situacao).toBe('ESTOURADO');
    expect(situacaoSla(ini, prazo, new Date(ini.getTime() + 9 * 864e5))?.situacao).toBe('CUMPRIDO');
  });

  it('prazos padrão: conversão 15/30, banco zerado 10/25, serviço 3 dias úteis', () => {
    const ini = emSP('2026-10-02', '10:00'); // sexta
    const c = prazosPadrao({ modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', inicio: ini });
    expect((c.prazo_virada!.getTime() - ini.getTime()) / 864e5).toBe(15);
    const z = prazosPadrao({ modulo: 'IMPLANTACAO', tipo_base: 'BANCO_ZERADO', inicio: ini });
    expect((z.prazo_finalizacao!.getTime() - ini.getTime()) / 864e5).toBe(25);
    expect(somarDiasUteis(ini, 3).toISOString()).toBe(emSP('2026-10-07', '10:00').toISOString()); // pula o fim de semana
  });

  it('horas úteis ignoram noite, almoço e fim de semana', () => {
    expect(horasUteisEntre(emSP('2026-10-01', '17:00'), emSP('2026-10-02', '10:00'))).toBe(3);
    expect(horasUteisEntre(emSP('2026-10-02', '17:00'), emSP('2026-10-05', '09:00'))).toBe(2);
  });
});

import { primeiroVencimento, progresso, marcosDevidos, faseDoItemTreinamento, inferirTipoServico } from '../src/lib/implantacao/portal';
import { diaSP } from '../src/lib/implantacao/cronometro';

describe('virada, progresso e avisos', () => {
  it('1º vencimento: próximo dia da lista a partir do 30º dia', () => {
    expect(diaSP(primeiroVencimento(emSP('2026-10-13', '10:00')))).toBe('2026-11-15'); // 30º dia = 12/11 → 15
    expect(diaSP(primeiroVencimento(emSP('2026-10-26', '10:00')))).toBe('2026-11-25'); // 25/11 → 25
    expect(diaSP(primeiroVencimento(emSP('2026-10-28', '10:00')))).toBe('2026-12-01'); // 27/11 → 01/12
    expect(diaSP(primeiroVencimento(emSP('2026-11-29', '10:00')))).toBe('2027-01-01'); // 29/12 → 01/01
  });

  it('progresso conta instalação + conversão e só chega a 100% na virada', () => {
    const itens = [{ grupo: 'INSTALACAO', titulo: 'a', feito: true }, { grupo: 'CONVERSAO', titulo: 'b', feito: true }, { grupo: 'TREINAMENTO', titulo: 'c', feito: false }];
    expect(progresso({ modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO' }, itens)).toBe(99);
    expect(progresso({ modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', virada_fim_em: new Date() }, itens)).toBe(100);
    expect(progresso({ modulo: 'IMPLANTACAO', tipo_base: 'BANCO_ZERADO' }, [{ grupo: 'INSTALACAO', titulo: 'a', feito: false }, { grupo: 'INSTALACAO', titulo: 'b', feito: true }])).toBe(50);
  });

  it('avisos: um por vez, sem repetir, e a virada pula os percentuais que faltaram', () => {
    expect(marcosDevidos({ pct: 10, virada: false, fasesRealizadas: [], jaRegistrados: new Set() })).toEqual({ enviar: ['CONTRATO'], pular: [] });
    expect(marcosDevidos({ pct: 60, virada: false, fasesRealizadas: [], jaRegistrados: new Set(['CONTRATO']) })).toEqual({ enviar: ['P50'], pular: ['P30'] });
    expect(marcosDevidos({ pct: 60, virada: false, fasesRealizadas: [], jaRegistrados: new Set(['CONTRATO', 'P30', 'P50']) })).toEqual({ enviar: [], pular: [] });
    expect(marcosDevidos({ pct: 100, virada: true, fasesRealizadas: [1], jaRegistrados: new Set(['CONTRATO', 'P30']) })).toEqual({ enviar: ['VIRADA', 'TREINO_1'], pular: ['P50', 'P80'] });
  });

  it('treinamento em fases e tipo de serviço', () => {
    expect(faseDoItemTreinamento('Emissão de Cupom Fiscal NFCE')).toBe(1);
    expect(faseDoItemTreinamento('Controle de Estoque')).toBe(2);
    expect(faseDoItemTreinamento('Ofertar o Imendes')).toBe(3);
    expect(inferirTipoServico('Troca de CNPJ')).toBe('TROCA_CNPJ');
    expect(inferirTipoServico('Comunicação entre lojas')).toBe('COMUNICACAO');
  });
});

import { ehLegado } from '../src/lib/implantacao/portal';
describe('demandas anteriores ao portal', () => {
  it('não geram aviso nem mensagem ao cliente', () => {
    expect(ehLegado({ data_assinatura: new Date('2026-09-23T12:00:00Z') })).toBe(true);
    expect(ehLegado({ data_assinatura: null })).toBe(true);
    expect(ehLegado({ data_assinatura: new Date('2026-10-03T12:00:00Z') })).toBe(false);
  });
});
