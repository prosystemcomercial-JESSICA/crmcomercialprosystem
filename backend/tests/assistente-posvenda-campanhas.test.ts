import { describe, it, expect } from 'vitest';
import { elegivelBoasVindas, elegivelPesquisa, lerBotaoPesquisa, menuPesquisa, textoBoasVindas } from '../src/lib/assistente/posvenda';
import { numeroWhatsapp, telefonesDoCliente, montarPublico, textoPersonalizado, ehPedidoDeSaida, RODAPE_SAIR } from '../src/lib/assistente/campanhas';

const agora = new Date('2026-09-25T12:00:00Z');
const desde = new Date('2026-09-20T00:00:00Z');
const dias = (n: number) => new Date(agora.getTime() - n * 86400000);
const p = (o: any = {}) => ({
  status: 'CONTRATO_ASSINADO', origem: 'WHATSAPP', data_aceite: dias(2), updated_at: dias(1),
  wpp_boasvindas_em: null, wpp_pesquisa_em: null, responsavel_telefone: '(27) 99999-1234', ...o,
});

describe('boas-vindas', () => {
  it('contrato assinado recente depois de ligar o pós-venda', () => expect(elegivelBoasVindas(p(), desde, agora)).toBe(true));
  it('nunca para retroativo, antes de ligar, antigo, sem celular, já enviado ou desligado', () => {
    expect(elegivelBoasVindas(p({ origem: 'RETROATIVO' }), desde, agora)).toBe(false);
    expect(elegivelBoasVindas(p({ data_aceite: dias(10) }), dias(30), agora)).toBe(false);
    expect(elegivelBoasVindas(p({ data_aceite: new Date('2026-09-19T00:00:00Z') }), desde, agora)).toBe(false);
    expect(elegivelBoasVindas(p({ responsavel_telefone: null }), desde, agora)).toBe(false);
    expect(elegivelBoasVindas(p({ wpp_boasvindas_em: dias(1) }), desde, agora)).toBe(false);
    expect(elegivelBoasVindas(p({ status: 'CONTRATO_EM_GERACAO' }), desde, agora)).toBe(false);
    expect(elegivelBoasVindas(p(), null, agora)).toBe(false);
  });
  it('texto', () => expect(textoBoasVindas('Carlos Souza', 'Pão Quente')).toContain('Olá, Carlos!'));
});

describe('pesquisa', () => {
  it('30 dias depois das boas-vindas, uma vez', () => {
    expect(elegivelPesquisa(p({ wpp_boasvindas_em: dias(31) }), agora)).toBe(true);
    expect(elegivelPesquisa(p({ wpp_boasvindas_em: dias(10) }), agora)).toBe(false);
    expect(elegivelPesquisa(p({ wpp_boasvindas_em: dias(40), wpp_pesquisa_em: dias(5) }), agora)).toBe(false);
    expect(elegivelPesquisa(p(), agora)).toBe(false);
  });
  it('botões', () => {
    expect(menuPesquisa('abc', 'X').opcoes.map(o => o.id)).toEqual(['pesq_3_abc', 'pesq_2_abc', 'pesq_1_abc']);
    expect(lerBotaoPesquisa('pesq_1_abc')).toEqual({ nota: 1, id: 'abc' });
    expect(lerBotaoPesquisa('prop_ok_abc')).toBeNull();
  });
});

describe('campanhas', () => {
  it('só celular brasileiro', () => {
    expect(numeroWhatsapp('(27) 99752-1370')).toBe('5527997521370');
    expect(numeroWhatsapp('5527997521370')).toBe('5527997521370');
    expect(numeroWhatsapp('(27) 3222-1000')).toBeNull(); // fixo
    expect(numeroWhatsapp('')).toBeNull();
  });
  it('público sem repetidos e sem quem saiu', () => {
    const r = montarPublico([
      { telefone: '27997521370', nome: 'A' }, { telefone: '(27) 99752-1370', nome: 'A de novo' },
      { telefone: '27988887777', nome: 'Saiu' }, { telefone: '2732221000', nome: 'Fixo' }, { telefone: '27911112222', nome: 'B' },
    ], ['5527988887777']);
    expect(r.map(x => x.nome)).toEqual(['A', 'B']);
  });
  it('texto com nome e opção de sair', () => {
    expect(textoPersonalizado('Olá, {nome}! Novidade.', 'Carlos Souza')).toBe(`Olá, Carlos! Novidade.${RODAPE_SAIR}`);
    expect(textoPersonalizado('Olá, {nome}! Novidade.', null)).toBe(`Olá! Novidade.${RODAPE_SAIR}`);
  });
  it('pedido de saída só com a palavra', () => {
    expect(ehPedidoDeSaida('SAIR')).toBe(true);
    expect(ehPedidoDeSaida('não quero mais')).toBe(true);
    expect(ehPedidoDeSaida('vou sair mais cedo hoje')).toBe(false);
  });
});

describe('telefonesDoCliente', () => {
  it('junta o DDD do campo separado e põe celulares primeiro', () => {
    const t = telefonesDoCliente({ ddd: '27', telefone: '35372064', tel_contato: '999969578', tel_contato2: '(28) 99919-8819' });
    expect(t).toEqual(['27999969578', '28999198819', '2735372064']);
    expect(t.map(numeroWhatsapp).filter(Boolean)).toEqual(['5527999969578', '5528999198819']);
  });
  it('sem DDD mantém como está', () => {
    expect(telefonesDoCliente({ telefone: '991764161' })).toEqual(['991764161']);
  });
});
