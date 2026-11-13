import { describe, it, expect } from 'vitest';
import { contar, funil, porCanal, categoriaPerda, motivosDePerda, oQueMelhorar, porVendedora, segundaDe, etapaAlcancada, resumoParaVitoria, type LeadMedido } from '../src/lib/painel-leads';

// Painel de Leads da Laya (13/11/2026). Números parecidos com os de produção de nov/2026.
const agora = new Date('2026-11-13T15:00:00Z');
const dias = (n: number) => new Date(agora.getTime() - n * 864e5);
const lead = (p: Partial<LeadMedido>): LeadMedido => ({
  canal: 'Prospecção (Heitor)', campanha: 'x', criado: dias(10), contatado: false, respondeu: false, interessado: false, demo: false,
  proposta: false, contrato: false, valor: 0, perdido: false, agente: null, horas_ate_contato: null, temperatura: null, ...p,
});
const varios = (n: number, p: Partial<LeadMedido>) => Array.from({ length: n }, () => lead(p));

describe('funil', () => {
  it('etapa mais adiante conta nas anteriores (proposta sem demonstração conta como demonstração alcançada)', () => {
    expect(etapaAlcancada(lead({ proposta: true }))).toBe(5);
    const c = contar([lead({ proposta: true }), lead({ contatado: true })], agora);
    expect(c.chegaram).toBe(2); expect(c.contatados).toBe(2); expect(c.demonstracoes).toBe(1); expect(c.propostas).toBe(1); expect(c.contratos).toBe(0);
  });
  it('sem contato só conta quem chegou há mais de 48 horas', () => {
    const c = contar([lead({ criado: dias(1) }), lead({ criado: dias(3) })], agora);
    expect(c.sem_contato).toBe(1);
  });
  it('acha o gargalo: a pior passagem com volume', () => {
    const ls = [...varios(80, { contatado: true }), ...varios(18, { respondeu: true }), ...varios(2, { interessado: true })];
    const f = funil(contar(ls, agora));
    expect(f.etapas[0].n).toBe(100);
    expect(f.gargalo?.para).toBe('Interessados');
  });
});

describe('por canal e o que melhorar', () => {
  const heitor = [...varios(150, { contatado: true, horas_ate_contato: 5 }), ...varios(45, { respondeu: true, horas_ate_contato: 2 }), ...varios(5, { interessado: true })];
  const indic = [lead({ canal: 'Indicação', contrato: true, valor: 5000 }), lead({ canal: 'Indicação', respondeu: true, contatado: true })];
  const todos = [...heitor, ...indic];

  it('canal com mais contratos vem primeiro e tem taxa de conversão', () => {
    const cs = porCanal(todos, agora);
    expect(cs[0].canal).toBe('Indicação');
    expect(cs[0].conversao).toBe(50);
    expect(cs[1].chegaram).toBe(200);
    expect(cs[1].horas_ate_contato).toBe(5);
  });
  it('aponta canal com muito lead e nenhuma demonstração, e o canal que vende com pouco esforço', () => {
    const atual = contar(todos, agora);
    const m = oQueMelhorar({ atual, anterior: atual, canais: porCanal(todos, agora), perdas: [], dias: 30 });
    expect(m[0].nivel).toBe('alta');
    expect(m.some(x => x.titulo.includes('Prospecção (Heitor): muito lead e nenhuma demonstração'))).toBe(true);
    expect(m.some(x => x.titulo.includes('Indicação vende'))).toBe(true);
    expect(m.some(x => x.titulo.includes('interessados sem demonstração'))).toBe(true);
  });
  it('avisa queda de leads e falta de motivo de perda', () => {
    const atual = contar(varios(10, { contatado: true }), agora), anterior = contar(varios(40, { contatado: true }), agora);
    const m = oQueMelhorar({ atual, anterior, canais: [], perdas: motivosDePerda([null, null, '', 'Fechou com concorrente']), dias: 30 });
    expect(m.some(x => x.titulo.includes('menos leads'))).toBe(true);
    expect(m.some(x => x.titulo.includes('3 perdas sem motivo'))).toBe(true);
  });
  it('resumo para a Vitória traz o funil e os canais', () => {
    const atual = contar(todos, agora);
    const t = resumoParaVitoria({ dias: 30, atual, anterior: atual, canais: porCanal(todos, agora), melhorias: [], porque: null });
    expect(t).toContain('Chegaram 202');
    expect(t).toContain('- Indicação: 2 leads');
  });
});

describe('motivo de perda', () => {
  it('lê a categoria gravada pelo agente e o texto livre', () => {
    expect(categoriaPerda('JA_TEM_FORNECEDOR: Já está usando outro sistema.')).toBe('JA_TEM_FORNECEDOR');
    expect(categoriaPerda('PRECO: Seguiu com outro sistema por custo-benefício')).toBe('PRECO');
    expect(categoriaPerda('Fechou com concorrente')).toBe('JA_TEM_FORNECEDOR');
    expect(categoriaPerda('Sem resposta')).toBe('SEM_RESPOSTA');
    expect(categoriaPerda('JA_TEM_FORNECEDOR: Já trabalha com a Prosystem; respondeu como atendente.')).toBe('JA_CLIENTE');
    expect(categoriaPerda(null)).toBe('SEM_MOTIVO');
  });
  it('agrupa e ordena', () => {
    const r = motivosDePerda(['PRECO: caro', 'Fechou com concorrente', 'JA_TEM_FORNECEDOR: x']);
    expect(r[0]).toMatchObject({ id: 'JA_TEM_FORNECEDOR', n: 2 });
  });
});

describe('vendedoras e semanas', () => {
  it('conta propostas, contratos e taxa de fechamento', () => {
    const r = porVendedora([{ vendedor: 'Ana', fechada: true, valor: 1000 }, { vendedor: 'Ana', fechada: false, valor: 0 }, { vendedor: null, fechada: false, valor: 0 }]);
    expect(r[0]).toMatchObject({ vendedora: 'Ana', propostas: 2, contratos: 1, valor: 1000, fechamento: 50 });
    expect(r[1].vendedora).toBe('Sem vendedora');
  });
  it('semana começa na segunda, no fuso de São Paulo', () => {
    expect(segundaDe(new Date('2026-11-13T15:00:00Z'))).toBe('2026-11-09');
    expect(segundaDe(new Date('2026-11-16T02:00:00Z'))).toBe('2026-11-09'); // domingo 23h em SP
  });
});
