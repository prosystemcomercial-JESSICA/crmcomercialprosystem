import { describe, it, expect, vi } from 'vitest';
import {
  extrairCnpj, cnpjValido, formatarCnpj, deBrasilApi, deCnpja, consultarCnpj, situacaoAtiva, enderecoCompleto,
} from '../src/lib/cnpj';

const BRASILAPI = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE',
  descricao_situacao_cadastral: 'ATIVA', data_situacao_cadastral: '2010-05-01',
  cnae_fiscal: 1091102, cnae_fiscal_descricao: 'Fabricação de produtos de padaria e confeitaria',
  cnaes_secundarios: [{ codigo: 4721102, descricao: 'Padaria e confeitaria com predominância de revenda' }, { codigo: 0, descricao: '' }],
  porte: 'MICRO EMPRESA', natureza_juridica: 'Sociedade Empresária Limitada', data_inicio_atividade: '2010-05-01',
  capital_social: 50000, email: 'contato@paoquente.com', ddd_telefone_1: '2733334444', ddd_telefone_2: '',
  descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '100', complemento: 'LOJA 2', bairro: 'CENTRO',
  cep: '29100000', municipio: 'VILA VELHA', uf: 'ES',
  qsa: [{ nome_socio: 'MARIA DA SILVA', qualificacao_socio: 'Sócio-Administrador' }],
  opcao_pelo_simples: true, opcao_pelo_mei: false,
};

const CNPJA = {
  taxId: '11222333000181', alias: 'PAO QUENTE', founded: '2010-05-01',
  status: { id: 2, text: 'Ativa' }, statusDate: '2010-05-01',
  company: {
    name: 'PADARIA PAO QUENTE LTDA', equity: 50000, nature: { text: 'Sociedade Empresária Limitada' }, size: { text: 'Microempresa' },
    members: [{ person: { name: 'MARIA DA SILVA' }, role: { text: 'Sócio-Administrador' } }],
    simples: { optant: true }, simei: { optant: false },
  },
  address: { street: 'Rua das Flores', number: '100', details: 'Loja 2', district: 'Centro', zip: '29100000', city: 'Vila Velha', state: 'ES' },
  phones: [{ area: '27', number: '33334444' }], emails: [{ address: 'contato@paoquente.com' }],
  mainActivity: { id: 1091102, text: 'Fabricação de produtos de padaria e confeitaria' },
  sideActivities: [{ id: 4721102, text: 'Padaria e confeitaria com predominância de revenda' }],
};

function resposta(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

describe('extrairCnpj / cnpjValido / formatarCnpj', () => {
  it('extrai 14 dígitos de texto com pontuação e palavras', () => {
    expect(extrairCnpj('meu cnpj é 11.222.333/0001-81 ok')).toBe('11222333000181');
  });
  it('devolve null sem 14 dígitos', () => {
    expect(extrairCnpj('123')).toBeNull();
    expect(extrairCnpj('')).toBeNull();
  });
  it('valida dígitos verificadores', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
  });
  it('formata', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('deBrasilApi', () => {
  it('mapeia todos os campos', () => {
    const d = deBrasilApi(BRASILAPI);
    expect(d).toMatchObject({
      cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE',
      situacao: 'ATIVA', data_situacao: '2010-05-01',
      cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria e confeitaria' },
      porte: 'MICRO EMPRESA', natureza_juridica: 'Sociedade Empresária Limitada', data_abertura: '2010-05-01',
      capital_social: 50000, email: 'contato@paoquente.com', telefones: ['2733334444'],
      logradouro: 'RUA DAS FLORES', numero: '100', complemento: 'LOJA 2', bairro: 'CENTRO', cep: '29100000',
      municipio: 'VILA VELHA', uf: 'ES', simples: true, mei: false,
    });
    expect(d.cnaes_secundarios).toEqual([{ codigo: '4721102', descricao: 'Padaria e confeitaria com predominância de revenda' }]);
    expect(d.socios).toEqual([{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }]);
  });
});

describe('deCnpja', () => {
  it('mapeia para o mesmo formato, situação em maiúsculas', () => {
    const d = deCnpja(CNPJA);
    expect(d).toMatchObject({
      cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
      cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria e confeitaria' },
      porte: 'Microempresa', capital_social: 50000, telefones: ['2733334444'], municipio: 'Vila Velha', uf: 'ES',
      simples: true, mei: false,
    });
    expect(d.socios).toEqual([{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }]);
  });
});

describe('consultarCnpj', () => {
  it('usa a BrasilAPI quando responde', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, BRASILAPI));
    const r = await consultarCnpj('11222333000181', f as any);
    expect(r.status).toBe('encontrado');
    if (r.status === 'encontrado') expect(r.fonte).toBe('BrasilAPI');
    expect(f.mock.calls[0][0]).toBe('https://brasilapi.com.br/api/cnpj/v1/11222333000181');
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('cai na CNPJá se a BrasilAPI falhar', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resposta(500, {}))
      .mockResolvedValueOnce(resposta(200, CNPJA));
    const r = await consultarCnpj('11222333000181', f as any);
    expect(r.status === 'encontrado' && r.fonte).toBe('CNPJá');
    expect(f.mock.calls[1][0]).toBe('https://open.cnpja.com/office/11222333000181');
  });
  it('nao_encontrado quando as fontes respondem 404', async () => {
    const f = vi.fn().mockResolvedValue(resposta(404, {}));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('nao_encontrado');
  });
  it('indisponivel quando as duas dão erro de rede', async () => {
    const f = vi.fn().mockRejectedValue(new Error('timeout'));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('indisponivel');
  });
  it('404 numa e erro na outra conta como indisponivel (não afirma que não existe)', async () => {
    const f = vi.fn().mockResolvedValueOnce(resposta(404, {})).mockRejectedValueOnce(new Error('x'));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('indisponivel');
  });
});

describe('situacaoAtiva / enderecoCompleto', () => {
  it('ATIVA é ativa; BAIXADA não; null não', () => {
    expect(situacaoAtiva(deBrasilApi(BRASILAPI))).toBe(true);
    expect(situacaoAtiva({ ...deBrasilApi(BRASILAPI), situacao: 'BAIXADA' })).toBe(false);
    expect(situacaoAtiva(null)).toBe(false);
  });
  it('monta endereço sem partes vazias', () => {
    expect(enderecoCompleto(deBrasilApi(BRASILAPI))).toBe('RUA DAS FLORES, 100, LOJA 2 - CENTRO - VILA VELHA/ES - CEP 29100-000');
  });
});
