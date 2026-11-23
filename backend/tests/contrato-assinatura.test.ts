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

import { vi } from 'vitest';

describe('contrato: link colado vai direto ao cliente (23/11/2026)', () => {
  it('mensagem traz o link e o passo a passo', () => {
    const t = textoLinkAssinatura('Maria Silva', 'https://app.zapsign.com.br/verificar/abc');
    expect(t).toContain('https://app.zapsign.com.br/verificar/abc');
    expect(t).toContain('Como assinar');
    expect(t).toContain('1. Toque no link');
  });

  it('envia uma vez por link; o mesmo link não repete e um link trocado vai', async () => {
    vi.resetModules();
    const enviados: string[] = [];
    vi.doMock('../src/services/evolution.service', () => ({
      enviarTexto: async (_t: string, _n: string, texto: string) => { enviados.push(texto); return { externo_id: 'x' + enviados.length }; },
    }));
    vi.doMock('../src/lib/whatsapp-empresa', () => ({ obterInstanciaEmpresa: async () => ({ instance_token: 'tk' }) }));
    vi.doMock('../src/lib/assistente/escritorio', () => ({ registrarAcaoAgente: () => {} }));
    vi.doMock('../src/services/whatsapp-eventos.service', () => ({ emitirEventoConversa: () => {} }));
    const marcas = new Map<string, string>();
    let link = 'https://z/1';
    const prisma: any = {
      contratoComercial: { findUnique: async () => ({ id: 'c1', numero_contrato: '1/2026', proposta_comercial_id: 'p1', representante_nome: 'Ana', representante_telefone: null, zapsign_signing_url: link }) },
      propostaComercial: { findUnique: async () => ({ wpp_conversa_id: 'w1' }) },
      whatsappConversa: { findUnique: async () => ({ id: 'w1', contato_numero: '5527999990000' }), update: async () => ({}) },
      whatsappMensagem: { create: async () => ({}) },
      configuracaoIntegracao: {
        findUnique: async ({ where }: any) => (marcas.has(where.chave) ? { chave: where.chave, valor: marcas.get(where.chave) } : null),
        create: async ({ data }: any) => { marcas.set(data.chave, data.valor); return data; },
        updateMany: async () => ({ count: 0 }),
      },
    };
    const { enviarLinkAssinatura } = await import('../src/services/contrato-assinatura.service');
    expect(await enviarLinkAssinatura(prisma, 'c1')).toBe(true);
    expect(await enviarLinkAssinatura(prisma, 'c1')).toBe(false);
    link = 'https://z/2';
    expect(await enviarLinkAssinatura(prisma, 'c1')).toBe(true);
    expect(enviados).toHaveLength(2);
    expect(enviados[1]).toContain('https://z/2');
  });
});
