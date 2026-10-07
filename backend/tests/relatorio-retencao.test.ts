import { describe, it, expect } from 'vitest';
import { categoriaSaida, montarRankingSaida } from '../src/lib/relatorio-retencao';

describe('categoria do motivo de saída (texto livre → categoria)', () => {
  const casos: [string | null, string][] = [
    ['Cliente fechou a loja.', 'Fechou a loja / encerrou'],
    ['Outro: Encerramento das atividades comerciais.', 'Fechou a loja / encerrou'],
    ['Cliente deu baixa no CNPJ', 'Fechou a loja / encerrou'],
    ['Loja foi vendida e novo dono aderiu a outro sistema', 'Loja vendida / nova gestão'],
    ['troca de sistema - farmácia está sob nova direção e a nova gestão optou trocou de sistema', 'Loja vendida / nova gestão'],
    ['Mudança de sistema para o Procfit (migração de toda Preço Baixo)', 'Migração de rede / grupo'],
    ['Cliente solicitou cancelamento, pois lojas desse mesmo sócio estão migrando', 'Migração de rede / grupo'],
    ['Cliente buscou sistema mais barato.', 'Preço'],
    ['Contabilidade sugeriu que trocasse de sistema devido a erros frequentes', 'Indicação da contabilidade'],
    ['Insatisfação com o suporte', 'Suporte / atendimento'],
    ['Informou que não teve o atendimento necessário para a resolução dos problemas', 'Suporte / atendimento'],
    ['Cliente insatisfeito com erro do sistema.', 'Erros / adaptação ao sistema'],
    ['Cliente não se adaptou ao sistema', 'Erros / adaptação ao sistema'],
    ['Cliente queria função que não existia no sistema.', 'Trocou de sistema (funções)'],
    ['troca de sistema - novas funções no sistema, como aplicativo Web/ IA', 'Trocou de sistema (funções)'],
    ['Cliente migrou para uma sistema especializado no ramo de roupa.', 'Trocou de sistema (funções)'],
    ['Inadimplência', 'Inadimplência'],
    ['Cliente não entrou em contato para cancelamento, apenas deixou de usar', 'Deixou de usar sem avisar'],
    ['Loja não chegou a aderir ao sistema.', 'Não chegou a usar'],
    ['Troca de cnpj, por outro que já era cliente. loja anterior fechou', 'Troca de CNPJ (continua cliente)'],
    ['Gerente não soube informar motivo do cancelamento.', 'Não informou o motivo'],
    ['Outro: Não expos o motivo', 'Não informou o motivo'],
    ['(sem motivo registrado)', 'Não informou o motivo'],
    [null, 'Não informou o motivo'],
    ['Mudanças internas da loja. nada em específico.', 'Outros'],
  ];
  for (const [texto, cat] of casos) it(`"${texto}" → ${cat}`, () => expect(categoriaSaida(texto)).toBe(cat));
});

describe('ranking dos motivos de saída', () => {
  const r = montarRankingSaida([
    { origem: 'CASO', texto: 'Inadimplência', resultado: 'PERDIDO', mrr: 300 },
    { origem: 'CASO', texto: 'Inadimplência', resultado: 'RECUPERADO', mrr: 0 },
    { origem: 'BASE', texto: 'Cliente fechou a loja.', resultado: 'PERDIDO', mrr: 250 },
    { origem: 'BASE', texto: 'Fechamento da loja', resultado: 'PERDIDO', mrr: 0 },
    { origem: 'BASE', texto: 'Fechamento da loja', resultado: 'PERDIDO', mrr: 0 },
    { origem: 'BASE', texto: 'Insatisfação com o suporte', resultado: 'PERDIDO', mrr: 200 },
  ]);

  it('ordena pelas saídas, com % do total, MRR perdido e recuperados', () => {
    expect(r.total_saidas).toBe(5);
    expect(r.ranking.map(x => [x.categoria, x.saidas, x.pct, x.mrr_perdido, x.recuperados])).toEqual([
      ['Fechou a loja / encerrou', 3, 60, 250, 0],
      ['Inadimplência', 1, 20, 300, 1],
      ['Suporte / atendimento', 1, 20, 200, 0],
    ]);
  });

  it('separa casos de churn e base histórica e traz exemplos reais sem repetir', () => {
    const fech = r.ranking[0];
    expect([fech.casos, fech.base]).toEqual([0, 3]);
    expect(fech.exemplos).toEqual(['Fechamento da loja', 'Cliente fechou a loja.']);
    expect(r.ranking[1].taxa_recuperacao).toBe(50);
  });
});

import { ltvDoCliente, faixaTempoDeCasa } from '../src/lib/relatorio-retencao';

describe('LTV de cada cliente (o que já pagou)', () => {
  const agora = new Date('2026-10-07T12:00:00-03:00');
  it('mensalidades × meses de casa + instalação + vendas adicionais (setup + acréscimo × meses desde a venda)', () => {
    const r = ltvDoCliente(
      { data_entrada: new Date('2024-10-07T12:00:00-03:00'), inativado_em: null, mensalidade_base: 300, valor_instalacao: 1000 },
      [{ valor_venda: 350, acrescimo_mensal: 50, data_venda: new Date('2026-04-07T12:00:00-03:00') }], agora);
    expect(r).toEqual({ meses_de_casa: 24, receita_mensalidades: 7200, instalacao: 1000, receita_adicionais: 650, vendas_adicionais: 1, ltv: 8850, ltv_por_mes: 368.75, sem_data_entrada: false });
  });
  it('inativo conta até a data de saída; sem data de entrada só soma o que dá e avisa', () => {
    expect(ltvDoCliente({ data_entrada: new Date('2025-01-15T12:00:00-03:00'), inativado_em: new Date('2025-07-15T12:00:00-03:00'), mensalidade_base: 200, valor_instalacao: null }, [], agora).meses_de_casa).toBe(6);
    expect(ltvDoCliente({ data_entrada: null, inativado_em: null, mensalidade_base: 200, valor_instalacao: 500 }, [], agora)).toMatchObject({ meses_de_casa: 0, ltv: 500, sem_data_entrada: true });
  });
  it('faixas de tempo de casa', () => {
    expect([3, 8, 18, 40, 90, 150].map(faixaTempoDeCasa)).toEqual(['Até 6 meses', '6 a 12 meses', '1 a 2 anos', '2 a 5 anos', '5 a 10 anos', 'Mais de 10 anos']);
  });
});

import { segmentoDoCliente } from '../src/lib/relatorio-retencao';
describe('segmento do cliente', () => {
  it('usa o cadastrado; se vazio, deduz pelo nome', () => {
    expect(segmentoDoCliente('Farmácia', 'PADARIA X')).toBe('Farmácia');
    expect(segmentoDoCliente(null, 'DROGARIA NOVA ESPERANCA')).toBe('Farmácia');
    expect(segmentoDoCliente('', 'DELICIAS DO TRIGO JARDIM CAMBURI 1')).toBe('Padaria');
    expect(segmentoDoCliente(null, 'SANTO ANTONIO F01', 'SANTO ANTONIO PANIFICADORA LTDA')).toBe('Padaria');
    expect(segmentoDoCliente(null, 'RIACHO COMESTICOS')).toBe('Outros varejos');
  });
});
