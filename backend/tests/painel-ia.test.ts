import { describe, it, expect } from 'vitest';
import { remetenteDe, resumirMensagens, montarFunil } from '../src/lib/painel-ia';

const t = (s: string) => new Date(`${s}-03:00`);
const m = (conversaId: string, direcao: 'ENTRADA' | 'SAIDA', quando: string, enviada_por: string | null = null, status = 'ENVIADA') =>
  ({ conversaId, direcao, enviada_por, status, created_at: t(quando) });

describe('quem mandou a mensagem', () => {
  it('nomes técnicos viram o agente; pessoas da equipe e o celular viram "pessoa"', () => {
    expect(remetenteDe('bot')).toEqual({ tipo: 'agente', agente: 'bia' });
    expect(remetenteDe('assistente_ia')).toEqual({ tipo: 'agente', agente: 'clarice' });
    expect(remetenteDe('cadencia_automatica')).toEqual({ tipo: 'agente', agente: 'luiz_felipe' });
    expect(remetenteDe('julio')).toEqual({ tipo: 'agente', agente: 'julio' });
    expect(remetenteDe('d99bc07f-160a-42ad-8741-71dd57bcd36d')).toEqual({ tipo: 'pessoa' });
    expect(remetenteDe('abertura_jessica')).toEqual({ tipo: 'pessoa' });
    expect(remetenteDe(null)).toEqual({ tipo: 'pessoa' });
  });
});

describe('resumo das mensagens do período', () => {
  const msgs = [
    // c1: cliente chama segunda 09:00, Bia responde 09:02, cliente responde
    m('c1', 'ENTRADA', '2026-10-05T09:00:00'), m('c1', 'SAIDA', '2026-10-05T09:02:00', 'bot'), m('c1', 'ENTRADA', '2026-10-05T09:05:00'),
    // c2: Julio aborda, cliente não responde; uma falha
    m('c2', 'SAIDA', '2026-10-05T10:00:00', 'julio'), m('c2', 'SAIDA', '2026-10-05T10:01:00', 'julio', 'FALHA'),
    // c3: cliente chama segunda 14:10, pessoa responde 14:40
    m('c3', 'ENTRADA', '2026-10-05T14:10:00'), m('c3', 'SAIDA', '2026-10-05T14:40:00', 'd99bc07f-160a-42ad-8741-71dd57bcd36d'),
    // c4: cliente chama terça 20:00 e ninguém responde
    m('c4', 'ENTRADA', '2026-10-06T20:00:00'),
  ];
  const r = resumirMensagens(msgs);

  it('totais e automação', () => {
    expect(r.totais).toEqual({ recebidas: 4, enviadas_agentes: 3, enviadas_pessoas: 1, automacao_pct: 75, falhas: 1, conversas: 4 });
  });

  it('por agente: mensagens, conversas, conversas em que o cliente respondeu e falhas', () => {
    expect(r.por_agente.bia).toEqual({ mensagens: 1, conversas: 1, responderam: 1, falhas: 0 });
    expect(r.por_agente.julio).toEqual({ mensagens: 2, conversas: 1, responderam: 0, falhas: 1 });
  });

  it('tempo de primeira resposta (minutos) por quem respondeu e conversas sem resposta', () => {
    expect(r.primeira_resposta).toEqual({ agentes: { qtd: 1, mediana_min: 2 }, pessoas: { qtd: 1, mediana_min: 30 }, sem_resposta: 1 });
  });

  it('mapa de horários das mensagens recebidas (dia da semana 0=dom × hora, fuso de SP)', () => {
    expect(r.mapa[1][9]).toBe(2); // segunda 9h: duas entradas da c1
    expect(r.mapa[1][14]).toBe(1);
    expect(r.mapa[2][20]).toBe(1);
  });

  it('série por dia', () => {
    expect(r.por_dia).toEqual([
      { dia: '2026-10-05', recebidas: 3, agentes: 3, pessoas: 1 },
      { dia: '2026-10-06', recebidas: 1, agentes: 0, pessoas: 0 },
    ]);
  });
});

describe('funil', () => {
  it('calcula a passagem de cada etapa e a conversão desde o topo', () => {
    expect(montarFunil([['Contatos novos', 200], ['Qualificados', 50], ['Demos', 10], ['Fechados', 2]])).toEqual([
      { etapa: 'Contatos novos', valor: 200, da_anterior_pct: null, do_topo_pct: 100 },
      { etapa: 'Qualificados', valor: 50, da_anterior_pct: 25, do_topo_pct: 25 },
      { etapa: 'Demos', valor: 10, da_anterior_pct: 20, do_topo_pct: 5 },
      { etapa: 'Fechados', valor: 2, da_anterior_pct: 20, do_topo_pct: 1 },
    ]);
  });
  it('etapa maior que a anterior não mostra passagem (vem de outros canais)', () => {
    expect(montarFunil([['Demos', 3], ['Propostas', 5]])[1]).toEqual({ etapa: 'Propostas', valor: 5, da_anterior_pct: null, do_topo_pct: 167 });
  });
  it('sem topo não divide por zero', () => {
    expect(montarFunil([['A', 0], ['B', 0]])[1]).toEqual({ etapa: 'B', valor: 0, da_anterior_pct: null, do_topo_pct: null });
  });
});
