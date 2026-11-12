import { describe, it, expect } from 'vitest';
import { nomeArquivoContrato, cpfValido, extrairAssinante, faltando, textoPedeFaltante, textoLinkAssinatura } from '../src/lib/assistente/contrato';

describe('contrato: dados de quem assina', () => {
  it('valida CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('529.982.247-26')).toBe(false);
  });
  it('lê nome, CPF e e-mail numa mensagem só', () => {
    expect(extrairAssinante('Maria da Silva, 529.982.247-25, Maria@Farmacia.com.br'))
      .toEqual({ nome: 'Maria Da Silva', cpf: '529.982.247-25', email: 'maria@farmacia.com.br' });
  });
  it('lê em linhas separadas e com rótulos', () => {
    const a = extrairAssinante('Nome: João Pereira\nCPF 52998224725\ne-mail: joao@x.com');
    expect(a).toEqual({ nome: 'João Pereira', cpf: '529.982.247-25', email: 'joao@x.com' });
  });
  it('ignora CPF inválido e aponta o que falta', () => {
    const a = extrairAssinante('meu cpf é 123.456.789-00');
    expect(a.cpf).toBeNull();
    expect(faltando(a)).toEqual(['nome completo', 'CPF', 'e-mail']);
    expect(textoPedeFaltante(['CPF', 'e-mail'])).toContain('CPF e e-mail');
  });
  it('mensagem do link', () => {
    expect(textoLinkAssinatura('Maria Silva', 'https://z/1')).toContain('Maria, o seu contrato');
  });
});

import { pendenciasContrato, preencherPelaReceita } from '../src/lib/assistente/contrato';

describe('contrato: conferência da Marta', () => {
  const completo = {
    razao_social: 'Farmácia Exemplo Ltda', cnpj: '11.222.333/0001-81', endereco: 'Rua A', numero_endereco: '10',
    bairro: 'Centro', cidade: 'Vitória', estado: 'ES', cep: '29000-000', plano_contratado: 'PRO', mensalidade: 350,
    dia_vencimento: 10, representante_nome: 'Maria Silva', representante_cpf: '529.982.247-25', representante_email: 'm@x.com',
  };
  it('contrato completo não tem pendência', () => {
    expect(pendenciasContrato(completo)).toEqual([]);
  });
  it('lista o que falta e recusa CNPJ e CPF inválidos', () => {
    expect(pendenciasContrato({ ...completo, cep: ' ', mensalidade: 0, cnpj: '11.222.333/0001-82', representante_cpf: '111.111.111-11' }))
      .toEqual(['CNPJ válido', 'CEP', 'mensalidade', 'CPF válido de quem assina']);
    expect(pendenciasContrato({ razao_social: 'X' })).toHaveLength(13);
  });
  it('a Receita só entra nos campos vazios', () => {
    const r: any = { razao_social: 'OUTRA', nome_fantasia: null, logradouro: 'Rua B', numero: 'S/N', bairro: 'Praia', municipio: 'Serra', uf: 'ES', cep: '29160000' };
    expect(preencherPelaReceita({ ...completo, endereco: null, cep: '', cidade: 'Vitória' }, r))
      .toEqual({ endereco: 'Rua B', cep: '29160-000' });
  });
});

describe('contrato: nome do arquivo', () => {
  it('segue o padrão Contrato_56_2026 RAZAO SOCIAL', () => {
    expect(nomeArquivoContrato({ numero_contrato: '56/2026', razao_social: 'GARCIA E PERON LTDA' })).toBe('Contrato_56_2026 GARCIA E PERON LTDA');
    expect(nomeArquivoContrato({ numero_contrato: '7/2026', razao_social: 'A/B: "LOJA"  ÁGUA' })).toBe('Contrato_7_2026 AB LOJA ÁGUA');
  });
});

describe('contrato: link enviado ao cliente', () => {
  it('aceita só https completo', async () => {
    const { linkValido } = await import('../src/lib/assistente/contrato');
    expect(linkValido('https://app.zapsign.com.br/verificar/abc123')).toBe(true);
    expect(linkValido('  https://zapsign.com.br/x  ')).toBe(true);
    expect(linkValido('http://app.zapsign.com.br/x')).toBe(false);
    expect(linkValido('app.zapsign.com.br/x')).toBe(false);
    expect(linkValido('https://localhost')).toBe(false);
    expect(linkValido('')).toBe(false);
    expect(linkValido(null)).toBe(false);
  });
});
