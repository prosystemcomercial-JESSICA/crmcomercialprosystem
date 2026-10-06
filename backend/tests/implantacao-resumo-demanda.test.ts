import { describe, it, expect } from 'vitest';
import { resumoDaDemanda } from '../src/lib/implantacao/portal';

const servico = (tipo_servico: string) => ({ modulo: 'SERVICO', tipo_servico });

describe('resumo da demanda (Visão geral do card)', () => {
  it('implantação não tem resumo de serviço', () => {
    expect(resumoDaDemanda({ modulo: 'IMPLANTACAO' }, null, null)).toBeNull();
  });

  it('troca de CNPJ usa o histórico: de X para Y, com as razões sociais', () => {
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: null }, {
      cnpj_anterior: '27829030000161', razao_social_anterior: 'FPB SAO DIOGO I COMERCIO DE MEDICAMENTOS LTDA',
      cnpj_novo: '65045303000176', razao_social_nova: 'FARMACIA NORTE SUL LTDA', inscricao_anterior: null,
    })!;
    expect(r.acao).toBe('Realizar a troca de CNPJ de 27.829.030/0001-61 para 65.045.303/0001-76');
    expect(r.detalhes).toEqual([
      ['CNPJ antigo', '27.829.030/0001-61 · FPB SAO DIOGO I COMERCIO DE MEDICAMENTOS LTDA'],
      ['CNPJ novo', '65.045.303/0001-76 · FARMACIA NORTE SUL LTDA'],
    ]);
  });

  it('troca de CNPJ sem histórico lê o resumo técnico salvo na venda', () => {
    const resumo_tecnico = '📋 DEMANDA — Troca de CNPJ no sistema\n▸ CLIENTE\n  CNPJ ANTIGO: 11222333000144\n  Razão Social ANTIGA: LOJA VELHA LTDA\n▸ NOVOS DADOS\n  CNPJ NOVO: 55666777000188\n  Razão Social NOVA: LOJA NOVA LTDA';
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: JSON.stringify({ tipo: 'TROCA_CNPJ', resumo: 'x', resumo_tecnico }) }, null)!;
    expect(r.acao).toBe('Realizar a troca de CNPJ de 11.222.333/0001-44 para 55.666.777/0001-88');
    expect(r.detalhes[1]).toEqual(['CNPJ novo', '55.666.777/0001-88 · LOJA NOVA LTDA']);
  });

  it('troca de CNPJ lançada só com o texto da vendedora (ANTIGO … - NOVO … / CNPJ:)', () => {
    const resumo = 'Lançar cobrança troca de CNPJ\n\n2093  - ANTIGO LAGUNAFARMA LTDA   - NOVO DROGARIA LAGUNAFARMA LTDA\nCNPJ: 65.339.577/0001-78\n\nR$ 550,00';
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: JSON.stringify({ tipo: 'TROCA_CNPJ', resumo }) }, null)!;
    expect(r.acao).toBe('Realizar a troca de CNPJ para 65.339.577/0001-78');
    expect(r.detalhes).toEqual([
      ['Razão social antiga', 'LAGUNAFARMA LTDA'],
      ['CNPJ novo', '65.339.577/0001-78 · DROGARIA LAGUNAFARMA LTDA'],
    ]);
    // o texto financeiro (valores) nunca vai para o técnico
    expect(r.observacao).toBeNull();
  });

  it('comunicação lista as lojas', () => {
    const r = resumoDaDemanda(servico('COMUNICACAO'), {
      lojas_detalhe: [{ codigo: '2002', nome: 'DROGARIA COUTINHO NOVO PARQUE' }, { codigo: '1701', nome: 'DROGARIA NOVO PARQUE' }],
      observacoes: 'Cobrança no CNPJ da 1701.\n[06/10/2026] Lançamento retroativo (venda de 12/06/2026).',
    }, null)!;
    expect(r.acao).toBe('Configurar a comunicação entre 2 lojas');
    expect(r.detalhes).toEqual([['Loja 1', '2002 - DROGARIA COUTINHO NOVO PARQUE'], ['Loja 2', '1701 - DROGARIA NOVO PARQUE']]);
    expect(r.observacao).toBe('Cobrança no CNPJ da 1701.');
  });

  it('outros serviços usam a descrição vendida e o autorizador', () => {
    const r = resumoDaDemanda(servico('OUTRO'), { descricao_servico: 'Importação de dados em planilhas', autorizador_nome: 'Maria Souza', parceiro: { nome: 'Serviço Prosystem' } }, null)!;
    expect(r.acao).toBe('Executar: Importação de dados em planilhas');
    expect(r.autorizador).toBe('Maria Souza');
  });

  it('sem venda ligada, cai no tipo do serviço', () => {
    expect(resumoDaDemanda(servico('IMPRESSORA'), null, null)!.acao).toBe('Executar: Impressora');
  });
});
