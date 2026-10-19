import { describe, it, expect } from 'vitest';
import { fichaDoLead, lerRespostaCaroline, promptCaroline } from '../src/lib/assistente/sdr';

// Contexto obrigatório e foco em quem decide (pedido da Jessica, 14/10/2026).
describe('ficha do lead', () => {
  it('traz o que já sabemos, com o ramo real da conversa acima do cadastro', () => {
    const f = fichaDoLead({ segmento: 'Padaria', campanha: 'Prospecção Heitor', dados: { segmento_real: 'material de construção', motivo_busca: 'estoque não bate', interlocutor: 'atendente', pediu_decisor_em: '2026-10-14T13:00:00Z' } })!;
    expect(f).toContain('material de construção');
    expect(f).toContain('vale a conversa');
    expect(f).toContain('estoque não bate');
    expect(f).toContain('ainda não chegamos a quem decide');
    expect(f).toContain('Já pedimos o contato de quem decide');
  });
  it('sem nada registrado não inventa', () => {
    expect(fichaDoLead({ dados: {} })).toBeNull();
  });
});

describe('resposta da IA', () => {
  it('lê quem está falando, o ramo real e os porquês', () => {
    const r = lerRespostaCaroline({ mensagens: ['Oi! Quem cuida do sistema aí?'], acao: 'continuar', nota: 10, dados: { interlocutor: 'atendente', segmento_real: 'material de construção', motivo_busca: 'caixa não fecha', motivo_inscricao: 'quer ver estoque' } })!;
    expect(r.dados.interlocutor).toBe('atendente');
    expect(r.dados.segmento_real).toBe('material de construção');
    expect(r.dados.motivo_busca).toBe('caixa não fecha');
    expect(r.dados.motivo_inscricao).toBe('quer ver estoque');
  });
  it('interlocutor fora da lista vira null', () => {
    expect(lerRespostaCaroline({ mensagens: ['oi'], acao: 'continuar', dados: { interlocutor: 'chefe' } })!.dados.interlocutor).toBeNull();
  });
});

describe('roteiro do agente', () => {
  it('pede contexto, quem decide e mostra a ficha', () => {
    const p = promptCaroline({ guia: 'g', instrucoes: '', exemplos: [], historico: 'Cliente: oi', fase: 'resposta', saudacao: 'Bom dia', perfil: 'caroline',
      lead: { nome: 'Ana', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: false, tentativa: 1, ficha: '- Dor principal: fila no caixa' } } as any);
    const tudo = p.sistema + p.usuario;
    expect(tudo).toContain('CONTEXTO OBRIGATÓRIO');
    expect(tudo).toContain('QUEM ESTÁ FALANDO');
    expect(tudo).toContain('farmacêutico responsável');
    expect(tudo).toContain('- Dor principal: fila no caixa');
  });

  // 19/10/2026: lead que chamou a Prosystem respondeu "Ainda na procura" e o Julio repetiu
  // "Você é quem decide?" em vez de avançar; a conversa morreu.
  const base = { guia: 'g', instrucoes: '', exemplos: [], historico: 'Cliente: Ainda na procura', fase: 'resposta', saudacao: 'Boa tarde' };
  const lead = { nome: null, empresa: 'Loja', segmento: null, campanha: null, abertura_jessica: false, tentativa: 1 };

  it('lead que procurou a Prosystem: não pergunta se é quem decide e avança', () => {
    const p = promptCaroline({ ...base, perfil: 'julio', lead } as any);
    expect(p.sistema).toContain('procurou a Prosystem por conta própria');
    expect(p.sistema).toContain('NÃO pergunte se ele é quem decide');
    expect(p.sistema).not.toContain('obrigatório já na PRIMEIRA resposta');
    expect(p.sistema).toContain('JÁ é interesse');
    expect(p.sistema).toContain('Nunca repita uma pergunta');
  });

  it('prospecção ativa (número da loja): continua descobrindo quem decide', () => {
    const p = promptCaroline({ ...base, perfil: 'caroline', lead: { ...lead, prospeccao: { cidade: 'Vitória', bairro: null } } } as any);
    expect(p.sistema).toContain('obrigatório já na PRIMEIRA resposta');
    expect(p.sistema).not.toContain('procurou a Prosystem por conta própria');
  });
});
