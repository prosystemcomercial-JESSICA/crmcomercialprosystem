import { describe, it, expect } from 'vitest';
import { situacaoExclusao, lerRegistro, textoAvisoCeo, chaveExclusao, STATUS_PODE_ENVIAR, podeSelecionarExclusao } from '../src/lib/churn-exclusao';

const base = { enviado_em: '2026-10-15T13:00:00.000Z', enviado_por: 'u1', enviado_por_nome: 'Jessica Cardoso' };

describe('envio de churn ao CEO: situação do pedido', () => {
  it('sem registro = não enviado; enviado sem as duas confirmações = enviado', () => {
    expect(situacaoExclusao(null)).toBe('NAO_ENVIADO');
    expect(situacaoExclusao(base)).toBe('ENVIADO');
    expect(situacaoExclusao({ ...base, suporte_em: '2026-10-16T10:00:00.000Z' })).toBe('ENVIADO');
    expect(situacaoExclusao({ ...base, cobranca_em: '2026-10-16T10:00:00.000Z' })).toBe('ENVIADO');
  });
  it('retirado do suporte e cobrança suspensa = concluído', () => {
    expect(situacaoExclusao({ ...base, suporte_em: '2026-10-16T10:00:00.000Z', cobranca_em: '2026-10-16T11:00:00.000Z' })).toBe('CONCLUIDO');
  });
  it('lê o registro guardado e ignora valor inválido', () => {
    expect(lerRegistro(JSON.stringify(base))?.enviado_por_nome).toBe('Jessica Cardoso');
    expect(lerRegistro('não é json')).toBeNull();
    expect(lerRegistro('{}')).toBeNull();
    expect(lerRegistro(null)).toBeNull();
    expect(chaveExclusao('abc')).toBe('churn.exclusao.abc');
  });
  it('só casos perdidos podem ir ao CEO', () => {
    expect(STATUS_PODE_ENVIAR).toEqual(['PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO']);
    expect(STATUS_PODE_ENVIAR).not.toContain('EXECUTANDO');
  });
});

describe('mensagem para o CEO', () => {
  it('lista código, nome, CNPJ, mensalidade, valor devido, motivo, observação e o link', () => {
    const t = textoAvisoCeo([
      { codigo: '1197', nome: 'RENOVE UTILIDADES', cnpj: '31650425000170', mensalidade: 226, valor_devido: 452.5, motivo: 'Fechou a loja' },
      { codigo: '1953', nome: 'POP FARMA', cnpj: null, mensalidade: 302 },
    ], 'Jessica Cardoso', 'Conferir boleto de outubro', 'https://crm/casos?aba=exclusao');
    expect(t).toContain('2 clientes para retirar do suporte e suspender as cobranças');
    expect(t).toContain('Enviado por Jessica Cardoso');
    expect(t).toContain('Mensalidades somadas: R$ 528,00');
    expect(t).toContain('• 1197 · RENOVE UTILIDADES · CNPJ 31.650.425/0001-70 · R$ 226,00/mês · deve R$ 452,50');
    expect(t).toContain('Motivo: Fechou a loja');
    expect(t).toContain('• 1953 · POP FARMA · R$ 302,00/mês');
    expect(t).toContain('Observação: Conferir boleto de outubro');
    expect(t).toContain('https://crm/casos?aba=exclusao');
  });
  it('um cliente no singular; lote grande mostra 25 e avisa o resto', () => {
    expect(textoAvisoCeo([{ nome: 'X' }], 'J', null, 'L')).toContain('1 cliente para retirar');
    const muitos = Array.from({ length: 30 }, (_, i) => ({ nome: `C${i}` }));
    const t = textoAvisoCeo(muitos, 'J', null, 'L');
    expect(t).toContain('• C24');
    expect(t).not.toContain('• C25');
    expect(t).toContain('…e mais 5 no CRM.');
  });
});

describe('quem pode selecionar e enviar ao CEO', () => {
  it('gestão sempre pode', () => {
    expect(podeSelecionarExclusao('CEO', null)).toBe(true);
    expect(podeSelecionarExclusao('supervisao_comercial', null)).toBe(true);
  });
  it('outro cargo só com "administrar" no módulo Cancelamentos / Churn (ex.: Ana Clara, SDR)', () => {
    const ana = { 'Cancelamentos / Churn': { ver: true, administrar: true } };
    expect(podeSelecionarExclusao('SDR', ana)).toBe(true);
    expect(podeSelecionarExclusao('SDR', JSON.stringify(ana))).toBe(true);
    expect(podeSelecionarExclusao('SDR', { 'Cancelamentos / Churn': { ver: true, administrar: false } })).toBe(false);
    expect(podeSelecionarExclusao('TECNICO_IMPLANTACAO', null)).toBe(false);
    expect(podeSelecionarExclusao('SDR', 'não é json')).toBe(false);
  });
});
