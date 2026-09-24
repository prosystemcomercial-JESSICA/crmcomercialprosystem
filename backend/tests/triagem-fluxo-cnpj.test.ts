import { describe, it, expect, vi } from 'vitest';
import { avancarTriagem, DepsTriagem } from '../src/lib/triagem/fluxo';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: null, cnae_principal: null, cnaes_secundarios: [], porte: null, natureza_juridica: null,
  data_abertura: null, capital_social: null, email: null, telefones: [], logradouro: null, numero: null,
  complemento: null, bairro: null, cep: null, municipio: 'VILA VELHA', uf: 'ES', socios: [], simples: null, mei: null,
};

function deps(): DepsTriagem {
  return { consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: RECEITA, fonte: 'BrasilAPI' }), temMaterial: () => false };
}
const textos = (acoes: any[]) => acoes.map(a => (a.tipo === 'texto' ? a.texto : a.tipo === 'menu' ? a.menu.texto : `material:${a.segmento}`)).join('\n');

describe('CNPJ mandado fora de hora', () => {
  const estados = [
    ['MENU', {}], ['MENU_CLIENTE', {}], ['SEGMENTO', { fluxo: 'conhecer' }], ['RELACAO', { segmento: 'Padaria' }],
    ['CNPJ_CONFIRMA', { cnpj: '11222333000181', receita: RECEITA }],
  ] as const;
  for (const [estado, dados] of estados) {
    it(`${estado}: não repete o menu nem reclama`, async () => {
      const r = await avancarTriagem(estado, dados as any, { texto: '11.222.333/0001-81' }, deps());
      expect(r.estado).toBe(estado);
      expect(r.acoes).toEqual([]);
      expect(r.desfecho).toBeUndefined();
    });
  }
  it('texto que não é CNPJ continua pedindo para escolher', async () => {
    const r = await avancarTriagem('MENU', {}, { texto: 'blabla' }, deps());
    expect(textos(r.acoes)).toContain('escolha uma das opções');
  });
  it('CNPJ inválido no menu continua pedindo para escolher', async () => {
    const r = await avancarTriagem('SEGMENTO', {}, { texto: '11.222.333/0001-00' }, deps());
    expect(textos(r.acoes)).toContain('escolha uma das opções');
  });
});

describe('CNPJ diferente na confirmação', () => {
  const B: DadosReceita = { ...RECEITA, cnpj: '11444777000161', nome_fantasia: 'FARMA B', municipio: 'SERRA' };
  const dadosA = { segmento: 'Padaria' as const, cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' };
  it('consulta o novo e pergunta pela empresa certa', async () => {
    const d: DepsTriagem = { consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: B, fonte: 'CNPJá' }), temMaterial: () => false };
    const r = await avancarTriagem('CNPJ_CONFIRMA', dadosA, { texto: '11.444.777/0001-61' }, d);
    expect(d.consultarCnpj).toHaveBeenCalledWith('11444777000161');
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    expect(textos(r.acoes)).toBe('É a *FARMA B*, de *SERRA/ES*?');
    expect(r.dados).toMatchObject({ segmento: 'Padaria', cnpj: '11444777000161', receita: B, receita_fonte: 'CNPJá' });
  });
  it('não encontrado: avisa e volta a pedir o CNPJ', async () => {
    const d: DepsTriagem = { consultarCnpj: vi.fn().mockResolvedValue({ status: 'nao_encontrado' }), temMaterial: () => false };
    const r = await avancarTriagem('CNPJ_CONFIRMA', dadosA, { texto: '11444777000161' }, d);
    expect(r.estado).toBe('CNPJ');
    expect(textos(r.acoes)).toContain('Não encontramos');
    expect(r.dados.cnpj).toBeUndefined();
  });
  it('indisponível: encerra como qualificado com o novo CNPJ', async () => {
    const d: DepsTriagem = { consultarCnpj: vi.fn().mockResolvedValue({ status: 'indisponivel' }), temMaterial: () => false };
    const r = await avancarTriagem('CNPJ_CONFIRMA', dadosA, { texto: '11444777000161' }, d);
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados).toMatchObject({ cnpj: '11444777000161', receita: null });
  });
  it('mesmo CNPJ: fica em silêncio', async () => {
    const d = deps();
    const r = await avancarTriagem('CNPJ_CONFIRMA', dadosA, { texto: '11222333000181' }, d);
    expect(r.acoes).toEqual([]);
    expect(d.consultarCnpj).not.toHaveBeenCalled();
  });
});

describe('CNPJ já recebido antes da pergunta', () => {
  const base = { fluxo: 'conhecer' as const, segmento: 'Padaria' as const, relacao: 'nao_conhece' as const, nome: 'Maria' };
  it('com dados da Receita: pula direto para a confirmação da empresa', async () => {
    const d = deps();
    const r = await avancarTriagem('CIDADE', { ...base, cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' }, { texto: 'Vila Velha' }, d);
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    expect(textos(r.acoes)).toBe('É a *PAO QUENTE*, de *VILA VELHA/ES*?');
    expect(r.dados.cidade).toBe('Vila Velha');
    expect(d.consultarCnpj).not.toHaveBeenCalled();
  });
  it('sem dados da Receita: encerra como qualificado', async () => {
    const r = await avancarTriagem('CIDADE', { ...base, cnpj: '11222333000181', receita: null }, { texto: 'Serra' }, deps());
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados.cnpj).toBe('11222333000181');
  });
  it('sem CNPJ: pergunta normalmente', async () => {
    const r = await avancarTriagem('CIDADE', base, { texto: 'Serra' }, deps());
    expect(r.estado).toBe('CNPJ');
  });
});
