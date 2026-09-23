import { describe, it, expect } from 'vitest';
import { efeitosDesfecho, avisoCnpj } from '../src/lib/triagem/desfecho';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: '2010-05-01', cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria' },
  cnaes_secundarios: [{ codigo: '4721102', descricao: 'Padaria e confeitaria' }], porte: 'MICRO EMPRESA',
  natureza_juridica: 'Sociedade Empresária Limitada', data_abertura: '2010-05-01', capital_social: 50000,
  email: 'contato@paoquente.com', telefones: ['2733334444'], logradouro: 'RUA DAS FLORES', numero: '100',
  complemento: null, bairro: 'CENTRO', cep: '29100000', municipio: 'VILA VELHA', uf: 'ES',
  socios: [{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }], simples: true, mei: false,
};

describe('efeitosDesfecho — qualificado', () => {
  const dados = { fluxo: 'conhecer' as const, segmento: 'Padaria' as const, relacao: 'nao_conhece' as const, nome: 'Maria', cidade: 'Vila Velha', cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' };

  it('preenche o lead com a Receita sem sobrescrever o que já existe', () => {
    const e = efeitosDesfecho('qualificado', dados, { telefone: '5527988887777', responsavel_email: 'ja@tem.com' });
    expect(e.lead).toEqual({
      cnpj: '11.222.333/0001-81', razao_social: 'PADARIA PAO QUENTE LTDA', empresa: 'PADARIA PAO QUENTE LTDA',
      nome_fantasia: 'PAO QUENTE', nome: 'PAO QUENTE', segmento: 'Padaria', cidade: 'VILA VELHA', estado: 'ES',
      endereco: 'RUA DAS FLORES, 100 - CENTRO - VILA VELHA/ES - CEP 29100-000', responsavel_nome: 'Maria',
    });
  });

  it('observação traz sócios, CNAE, porte, situação, relação e fonte', () => {
    const e = efeitosDesfecho('qualificado', dados, null);
    const o = e.observacao || '';
    for (const trecho of ['Dados da Receita', 'MARIA DA SILVA', 'Sócio-Administrador', '1091102', 'MICRO EMPRESA', 'ATIVA', 'Não conhece a Prosystem', 'BrasilAPI', 'Vila Velha', 'contato@paoquente.com', '2733334444', 'Simples: sim']) {
      expect(o).toContain(trecho);
    }
  });

  it('conversa: etiqueta do segmento, prioridade crítica com CNPJ ativo, nome do contato', () => {
    const e = efeitosDesfecho('qualificado', dados, null);
    expect(e.conversa).toEqual({ etiqueta: 'Padaria', etiqueta_cor: '#d97706', prioridade: 'CRITICA', contato_nome: 'Maria', desvincularLead: false });
    expect(e.notificacao).toEqual({ titulo: 'Novo lead qualificado', detalhe: 'PAO QUENTE — VILA VELHA/ES', alerta: null });
  });

  it('CNPJ baixado: prioridade normal e alerta vermelho', () => {
    const e = efeitosDesfecho('qualificado', { ...dados, receita: { ...RECEITA, situacao: 'BAIXADA' } }, null);
    expect(e.conversa.prioridade).toBe('NORMAL');
    expect(e.notificacao?.alerta).toBe('CNPJ BAIXADA na Receita');
    expect(e.observacao).toContain('⚠️ CNPJ BAIXADA');
  });

  it('Receita indisponível: usa cidade digitada e marca como não consultado', () => {
    const e = efeitosDesfecho('qualificado', { fluxo: 'conhecer', segmento: 'Farmácia', nome: 'Ana', cidade: 'Serra', cnpj: '11222333000181', receita: null, receita_fonte: null }, null);
    expect(e.lead).toMatchObject({ cnpj: '11.222.333/0001-81', segmento: 'Farmácia', cidade: 'Serra', responsavel_nome: 'Ana' });
    expect(e.conversa.etiqueta).toBe('Farmácia');
    expect(e.conversa.prioridade).toBe('NORMAL');
    expect(e.observacao).toContain('não consultado na Receita');
  });
});

describe('efeitosDesfecho — outros', () => {
  it('serviços: etiqueta Serviços, pedido na observação, notifica', () => {
    const e = efeitosDesfecho('servicos', { fluxo: 'servicos', servico: 'Treinamento' }, null);
    expect(e.conversa).toMatchObject({ etiqueta: 'Serviços', desvincularLead: false });
    expect(e.observacao).toContain('Treinamento');
    expect(e.notificacao?.titulo).toBe('Pedido de serviço');
    expect(e.lead).toBeNull();
  });
  it('suporte e financeiro: desvinculam o lead e não notificam', () => {
    for (const d of ['suporte', 'financeiro'] as const) {
      const e = efeitosDesfecho(d, { fluxo: d }, null);
      expect(e.conversa.desvincularLead).toBe(true);
      expect(e.conversa.etiqueta).toBe(d === 'suporte' ? 'Suporte' : 'Financeiro');
      expect(e.notificacao).toBeNull();
    }
  });
});

describe('avisoCnpj', () => {
  it('só avisa com Receita consultada e situação não ativa', () => {
    expect(avisoCnpj({ receita: { ...RECEITA, situacao: 'INAPTA' } })).toBe('CNPJ INAPTA na Receita');
    expect(avisoCnpj({ receita: RECEITA })).toBeNull();
    expect(avisoCnpj({ receita: null })).toBeNull();
    expect(avisoCnpj(null)).toBeNull();
  });
});
