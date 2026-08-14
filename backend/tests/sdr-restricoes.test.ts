import { describe, it, expect } from 'vitest';
import { bloqueadoParaFecharSeSDR, ETAPAS_BLOQUEADAS_PARA_SDR } from '@/lib/sdr-restricoes';

describe('bloqueadoParaFecharSeSDR', () => {
  it('bloqueia SDR tentando mover lead para etapa de fechamento (ACEITO)', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', 'ACEITO')).toBe(true);
  });

  it('bloqueia SDR tentando mover lead para etapa de fechamento (FECHADO)', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', 'FECHADO')).toBe(true);
  });

  it('bloqueia SDR tentando mover lead para CONTRATO_ASSINADO', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', 'CONTRATO_ASSINADO')).toBe(true);
  });

  it('bloqueia SDR tentando mover lead para CONTRATO_EM_ANDAMENTO', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', 'CONTRATO_EM_ANDAMENTO')).toBe(true);
  });

  it('permite SDR mover lead para QUALIFICADO (etapa não bloqueada)', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', 'QUALIFICADO')).toBe(false);
  });

  it('é case-insensitive no papel (sdr minúsculo também bloqueia)', () => {
    expect(bloqueadoParaFecharSeSDR('sdr', 'ACEITO')).toBe(true);
  });

  it('não bloqueia VENDEDOR indo para ACEITO', () => {
    expect(bloqueadoParaFecharSeSDR('VENDEDOR', 'ACEITO')).toBe(false);
  });

  it('não bloqueia SUPERVISAO_COMERCIAL indo para FECHADO', () => {
    expect(bloqueadoParaFecharSeSDR('SUPERVISAO_COMERCIAL', 'FECHADO')).toBe(false);
  });

  it('não bloqueia quando role é undefined', () => {
    expect(bloqueadoParaFecharSeSDR(undefined, 'ACEITO')).toBe(false);
  });

  it('não bloqueia quando etapaAlvo é undefined (ex.: PATCH que não mexe na etapa)', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', undefined)).toBe(false);
  });

  it('não bloqueia quando etapaAlvo é null', () => {
    expect(bloqueadoParaFecharSeSDR('SDR', null)).toBe(false);
  });

  it('a lista de etapas bloqueadas contém exatamente os 4 estágios de fechamento', () => {
    expect(ETAPAS_BLOQUEADAS_PARA_SDR).toEqual(['ACEITO', 'FECHADO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO']);
  });
});
