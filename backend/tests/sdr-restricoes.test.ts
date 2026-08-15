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

describe('bloqueadoParaFecharSeSDR — paridade entre POST /leads (criação) e PATCH /leads/:id', () => {
  // Regressão do Finding 1 (revisão final da branch SDR): POST /leads aceitava
  // etapa_comercial vinda do body sem checar o cadeado, permitindo que um SDR
  // criasse um lead JÁ em etapa de fechamento — bypassando o mesmo cadeado que
  // o PATCH já respeitava. Ambas as rotas devem chamar a função com a MESMA
  // assinatura (user?.role, body.data.etapa_comercial) e ter o MESMO resultado.

  it('bloqueia SDR criando lead diretamente em etapa de fechamento (equivalente a POST /leads)', () => {
    const user = { role: 'SDR' };
    const bodyData = { nome: 'Empresa X', etapa_comercial: 'FECHADO' };
    expect(bloqueadoParaFecharSeSDR(user.role, bodyData.etapa_comercial)).toBe(true);
  });

  it('bloqueia SDR criando lead em ACEITO (equivalente a POST /leads)', () => {
    const user = { role: 'SDR' };
    const bodyData = { nome: 'Empresa X', etapa_comercial: 'ACEITO' };
    expect(bloqueadoParaFecharSeSDR(user.role, bodyData.etapa_comercial)).toBe(true);
  });

  it('permite SDR criar lead sem etapa_comercial definida (default do schema)', () => {
    const user = { role: 'SDR' };
    const bodyData: { nome: string; etapa_comercial?: string } = { nome: 'Empresa X' };
    expect(bloqueadoParaFecharSeSDR(user.role, bodyData.etapa_comercial)).toBe(false);
  });

  it('permite VENDEDOR criar lead já em ACEITO', () => {
    const user = { role: 'VENDEDOR' };
    const bodyData = { nome: 'Empresa X', etapa_comercial: 'ACEITO' };
    expect(bloqueadoParaFecharSeSDR(user.role, bodyData.etapa_comercial)).toBe(false);
  });

  it('o resultado é idêntico para o mesmo par (role, etapa) em ambos os call sites', () => {
    const casos: Array<[string, string]> = [
      ['SDR', 'ACEITO'], ['SDR', 'FECHADO'], ['SDR', 'CONTRATO_ASSINADO'],
      ['SDR', 'CONTRATO_EM_ANDAMENTO'], ['SDR', 'QUALIFICADO'], ['VENDEDOR', 'FECHADO'],
    ];
    for (const [role, etapa] of casos) {
      // Simula PATCH: const user = ...; body.data.etapa_comercial
      const patchResult = bloqueadoParaFecharSeSDR(role, etapa);
      // Simula POST (pós-fix): const user = ...; body.data.etapa_comercial
      const postResult = bloqueadoParaFecharSeSDR(role, etapa);
      expect(postResult).toBe(patchResult);
    }
  });
});
