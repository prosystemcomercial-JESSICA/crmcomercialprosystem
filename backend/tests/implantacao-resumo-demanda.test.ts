import { describe, it, expect } from 'vitest';
import { resumoDaDemanda } from '../src/lib/implantacao/portal';

const servico = (tipo_servico: string) => ({ modulo: 'SERVICO', tipo_servico });

describe('resumo da demanda (Visão geral do card)', () => {
  it('implantação não tem resumo de serviço', () => {
    expect(resumoDaDemanda({ modulo: 'IMPLANTACAO' }, null, null)).toBeNull();
  });

  it('troca de CNPJ: dados antigos (evento da ficha) e novos (cadastro já trocado)', () => {
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: null }, {
      cnpj_anterior: '27829030000161', razao_social_anterior: 'FPB SAO DIOGO I COMERCIO DE MEDICAMENTOS LTDA',
      cnpj_novo: '65045303000176', razao_social_nova: 'FARMACIA NORTE SUL LTDA', inscricao_anterior: null,
    }, {
      antes: { cnpj: '27829030000161', razao_social: 'FPB SAO DIOGO I COMERCIO DE MEDICAMENTOS LTDA', inscricao_estadual: '082123456', endereco: 'Rua A', numero_end: '10', bairro: 'Centro', cidade: 'Serra', estado: 'ES' },
      cliente: { cnpj: '65045303000176', razao_social: 'FARMACIA NORTE SUL LTDA', nome_fantasia: 'Preço Baixo', inscricao_estadual: '083999888', endereco: 'Rua B', numero_end: '20', bairro: 'Jardim', cidade: 'Serra', estado: 'ES', telefone: '27999990000', email: 'loja@x.com' },
    })!;
    expect(r.acao).toBe('Realizar a troca de CNPJ de 27.829.030/0001-61 para 65.045.303/0001-76');
    expect(r.grupos).toEqual([
      { titulo: 'Dados antigos', itens: [['CNPJ', '27.829.030/0001-61'], ['Razão social', 'FPB SAO DIOGO I COMERCIO DE MEDICAMENTOS LTDA'], ['Inscrição estadual', '082123456'], ['Endereço', 'Rua A, 10, Centro, Serra/ES']] },
      { titulo: 'Dados novos (já no cadastro do CRM)', itens: [['CNPJ', '65.045.303/0001-76'], ['Razão social', 'FARMACIA NORTE SUL LTDA'], ['Nome fantasia', 'Preço Baixo'], ['Inscrição estadual', '083999888'], ['Endereço', 'Rua B, 20, Jardim, Serra/ES'], ['Telefone', '27999990000'], ['E-mail', 'loja@x.com']] },
    ]);
    expect(r.aviso).toBeNull();
  });

  it('troca de CNPJ sem histórico lê o resumo técnico salvo na venda (antigos e novos)', () => {
    const resumo_tecnico = '📋 DEMANDA — Troca de CNPJ no sistema\n▸ CLIENTE\n  CNPJ ANTIGO: 11222333000144\n  Razão Social ANTIGA: LOJA VELHA LTDA\n  Endereço ANTIGO: Rua Velha, 1\n▸ NOVOS DADOS\n  CNPJ NOVO: 55666777000188\n  Razão Social NOVA: LOJA NOVA LTDA\n  Inscrição Est. NOVA: 123\n  CEP: 29000-000\n  Telefone: 27988887777';
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: JSON.stringify({ tipo: 'TROCA_CNPJ', resumo: 'x', resumo_tecnico }) }, null)!;
    expect(r.acao).toBe('Realizar a troca de CNPJ de 11.222.333/0001-44 para 55.666.777/0001-88');
    expect(r.grupos[0].itens).toEqual([['CNPJ', '11.222.333/0001-44'], ['Razão social', 'LOJA VELHA LTDA'], ['Endereço', 'Rua Velha, 1']]);
    expect(r.grupos[1]).toEqual({ titulo: 'Dados novos', itens: [['CNPJ', '55.666.777/0001-88'], ['Razão social', 'LOJA NOVA LTDA'], ['Inscrição estadual', '123'], ['CEP', '29000-000'], ['Telefone', '27988887777']] });
  });

  it('troca de CNPJ com cadastro ainda antigo: antigos vêm do cadastro e há aviso; valores nunca aparecem', () => {
    const resumo = 'Lançar cobrança troca de CNPJ\n\n2093  - ANTIGO LAGUNAFARMA LTDA   - NOVO DROGARIA LAGUNAFARMA LTDA\nCNPJ: 65.339.577/0001-78\n\nR$ 550,00';
    const r = resumoDaDemanda(servico('TROCA_CNPJ'), { observacoes: JSON.stringify({ tipo: 'TROCA_CNPJ', resumo }) }, null,
      { cliente: { cnpj: '10364585000182', razao_social: 'LAGUNAFARMA LTDA', cidade: 'Vitória', estado: 'ES' } })!;
    expect(r.acao).toBe('Realizar a troca de CNPJ de 10.364.585/0001-82 para 65.339.577/0001-78');
    expect(r.grupos).toEqual([
      { titulo: 'Dados antigos', itens: [['CNPJ', '10.364.585/0001-82'], ['Razão social', 'LAGUNAFARMA LTDA'], ['Endereço', 'Vitória/ES']] },
      { titulo: 'Dados novos', itens: [['CNPJ', '65.339.577/0001-78'], ['Razão social', 'DROGARIA LAGUNAFARMA LTDA']] },
    ]);
    expect(r.aviso).toBe('O cadastro do CRM ainda está com os dados antigos.');
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
