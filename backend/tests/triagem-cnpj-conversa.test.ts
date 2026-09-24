import { describe, it, expect } from 'vitest';
import { cnpjNovoNaMensagem, dadosComCnpj, efeitosCnpjNoLead } from '../src/lib/triagem/cnpj-conversa';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: null, cnae_principal: null, cnaes_secundarios: [], porte: 'ME', natureza_juridica: null,
  data_abertura: null, capital_social: null, email: 'a@b.com', telefones: ['2733334444'], logradouro: 'RUA A', numero: '10',
  complemento: null, bairro: 'CENTRO', cep: null, municipio: 'VILA VELHA', uf: 'ES', socios: [], simples: null, mei: null,
};

describe('cnpjNovoNaMensagem', () => {
  it('acha CNPJ válido no meio do texto', () => {
    expect(cnpjNovoNaMensagem(null, 'meu cnpj é 11.222.333/0001-81 ok')).toBe('11222333000181');
  });
  it('ignora CNPJ inválido e texto sem CNPJ', () => {
    expect(cnpjNovoNaMensagem({}, '11.222.333/0001-00')).toBeNull();
    expect(cnpjNovoNaMensagem({}, 'bom dia')).toBeNull();
    expect(cnpjNovoNaMensagem({}, '')).toBeNull();
  });
  it('ignora o mesmo CNPJ já salvo', () => {
    expect(cnpjNovoNaMensagem({ cnpj: '11222333000181' }, '11222333000181')).toBeNull();
  });
  it('aceita CNPJ diferente do salvo', () => {
    expect(cnpjNovoNaMensagem({ cnpj: '11444777000161' }, '11222333000181')).toBe('11222333000181');
  });
});

describe('dadosComCnpj', () => {
  const antes = { segmento: 'Padaria' as const, nome: 'Maria' };
  it('encontrado: grava receita e preserva o resto', () => {
    expect(dadosComCnpj(antes, '11222333000181', { status: 'encontrado', dados: RECEITA, fonte: 'BrasilAPI' }))
      .toEqual({ ...antes, cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' });
  });
  it('indisponível: grava só o CNPJ', () => {
    expect(dadosComCnpj(antes, '11222333000181', { status: 'indisponivel' }))
      .toEqual({ ...antes, cnpj: '11222333000181', receita: null, receita_fonte: null });
  });
  it('não encontrado: não mexe', () => {
    expect(dadosComCnpj(antes, '11222333000181', { status: 'nao_encontrado' })).toBeNull();
  });
});

describe('efeitosCnpjNoLead', () => {
  it('preenche o lead sem etapa_sdr e gera observação da Receita', () => {
    const e = efeitosCnpjNoLead({ cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' }, { telefone: '27999' });
    expect(e.lead.etapa_sdr).toBeUndefined();
    expect(e.lead.cnpj).toBe('11.222.333/0001-81');
    expect(e.lead.nome).toBe('PAO QUENTE');
    expect(e.lead.cidade).toBe('VILA VELHA');
    expect(e.lead.telefone).toBeUndefined(); // não sobrescreve telefone já preenchido
    expect(e.lead.responsavel_email).toBe('a@b.com');
    expect(e.observacao).toContain('Dados da Receita');
    expect(e.observacao).toContain('Razão social: PADARIA PAO QUENTE LTDA');
  });
});
