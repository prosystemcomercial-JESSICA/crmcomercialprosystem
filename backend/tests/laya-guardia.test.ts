import { describe, it, expect } from 'vitest';
import { conferirPura, linkIncompleto, pareceCortada, cobertura, falasRepetidas, seguradasPorRepeticao, travadaPorRepeticao, MOTIVO_REPETICAO } from '../src/lib/laya-guardia';

describe('Laya guardiã: conferência pura', () => {
  it('pega link quebrado, texto cortado e repetição', () => {
    expect(linkIncompleto('Veja aqui: https://')).toBe(true);
    expect(linkIncompleto('Veja aqui: [link]')).toBe(true);
    expect(linkIncompleto('Veja aqui: https://prosystemnet.com/farmacia')).toBe(false);
    expect(pareceCortada('Boa, Enares. Sobre isso: o Prosystem já tem TEF, Pix e boleto, e o controle de')).toBe(true);
    expect(pareceCortada('Qual o melhor horário pra você')).toBe(false);
    const ultimas = ['Oi! Aqui é a Caroline, da Prosystem. Vi que você tem uma farmácia e queria entender como está o controle do caixa hoje.'];
    expect(conferirPura({ mensagens: ['Oi! Aqui é a Caroline da Prosystem. Vi que você tem uma farmácia e queria entender como está o controle do caixa hoje!'], ultimas })).toContain('repete o que o agente já disse nesta conversa');
    expect(conferirPura({ mensagens: ['Perfeito, então combinamos quinta às 10h. Até lá!'], ultimas })).toEqual([]);
    expect(conferirPura({ mensagens: ['a', 'b', 'c', 'd'], ultimas: [] })).toContain('4 mensagens de uma vez (máximo 3)');
  });

  it('cobertura: a resposta da Jessica cobre a pergunta do Rafael', () => {
    const pergunta = 'Qual é a tabela vigente de mensalidade e implantação por segmento e plano?';
    expect(cobertura(pergunta, 'Tabela de mensalidade 2025 por plano: Farma Pro R$ 350, implantação R$ 500, por segmento farmácia e padaria.')).toBeGreaterThanOrEqual(0.6);
    expect(cobertura(pergunta, 'O fluxo de produtos comprados para revenda usados na produção é lançado como consumo interno.')).toBeLessThan(0.3);
  });
});

describe('Laya guardiã · fase da conversa (11/11/2026)', () => {
  it('não pede nota da IA no primeiro contato nem quando o cliente nunca escreveu', async () => {
    const { precisaNotaIa } = await import('../src/lib/laya-guardia');
    expect(precisaNotaIa('abertura', [])).toBe(false);
    expect(precisaNotaIa('abertura', [{ direcao: 'ENTRADA' }])).toBe(false);
    expect(precisaNotaIa('retomada', [{ direcao: 'SAIDA' }, { direcao: 'SAIDA' }])).toBe(false);
    expect(precisaNotaIa('retomada', [{ direcao: 'SAIDA' }, { direcao: 'ENTRADA' }])).toBe(true);
    expect(precisaNotaIa('resposta', [{ direcao: 'ENTRADA' }])).toBe(true);
  });
  it('avisa a IA de que retomada e encerramento não esperam resposta nova do cliente', async () => {
    const { avisoDaFase } = await import('../src/lib/laya-guardia');
    expect(avisoDaFase('retomada')).toContain('retomada programada');
    expect(avisoDaFase('encerramento')).toContain('encerramento');
    expect(avisoDaFase('resposta')).toBe('');
  });
});

describe('Laya: trava do laço de repetição (23/11/2026)', () => {
  const segurada = (motivo: string, em: string) => ({ acao: JSON.stringify({ laya_motivo: motivo }), created_at: new Date(em) });
  const cliente = new Date('2026-11-18T12:00:00Z');

  it('para depois de 2 repetições seguradas desde a última fala do cliente', () => {
    const itens = [segurada(MOTIVO_REPETICAO, '2026-11-18T12:02:00Z'), segurada(MOTIVO_REPETICAO, '2026-11-18T12:04:00Z')];
    expect(seguradasPorRepeticao(itens, cliente)).toBe(2);
    expect(travadaPorRepeticao(itens, cliente)).toBe(true);
  });

  it('uma repetição só ainda deixa tentar', () => {
    expect(travadaPorRepeticao([segurada(MOTIVO_REPETICAO, '2026-11-18T12:02:00Z')], cliente)).toBe(false);
  });

  it('mensagem nova do cliente zera a contagem', () => {
    const itens = [segurada(MOTIVO_REPETICAO, '2026-11-18T12:02:00Z'), segurada(MOTIVO_REPETICAO, '2026-11-18T12:04:00Z')];
    expect(travadaPorRepeticao(itens, new Date('2026-11-18T12:10:00Z'))).toBe(false);
  });

  it('outros motivos da Laya não contam como repetição', () => {
    const itens = [segurada('texto cortado no meio', '2026-11-18T12:02:00Z'), segurada('nota 4/10 da Laya: mudou de assunto', '2026-11-18T12:04:00Z')];
    expect(travadaPorRepeticao(itens, cliente)).toBe(false);
    expect(travadaPorRepeticao([segurada(`texto cortado no meio; ${MOTIVO_REPETICAO}`, '2026-11-18T12:02:00Z'), segurada(MOTIVO_REPETICAO, '2026-11-18T12:03:00Z')], cliente)).toBe(true);
  });

  it('cliente que nunca escreveu: conta todas', () => {
    expect(travadaPorRepeticao([segurada(MOTIVO_REPETICAO, '2026-11-18T12:02:00Z'), segurada(MOTIVO_REPETICAO, '2026-11-19T12:02:00Z')], null)).toBe(true);
  });

  it('a reescrita recebe as falas que foram repetidas', () => {
    const ultimas = ['Separei uma apresentação rápida para você conhecer o sistema da farmácia', 'Qual sistema vocês usam hoje?'];
    const r = falasRepetidas(['Boa tarde! Separei uma apresentação rápida para você conhecer o sistema da farmácia'], ultimas);
    expect(r).toEqual([ultimas[0]]);
    expect(conferirPura({ mensagens: [ultimas[0]], ultimas })).toContain(MOTIVO_REPETICAO);
  });
});
