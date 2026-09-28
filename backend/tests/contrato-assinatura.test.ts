import { describe, it, expect } from 'vitest';
import { cpfValido, extrairAssinante, faltando, textoPedeFaltante, textoLinkAssinatura } from '../src/lib/assistente/contrato';

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
