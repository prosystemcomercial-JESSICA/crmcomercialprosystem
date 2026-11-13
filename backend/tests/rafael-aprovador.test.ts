import { describe, it, expect } from 'vitest';
import { decisaoNoPrazo, lerDecisaoRafael, rafaelRevisa, urgente, PRAZO_RAFAEL_MS, lerDecisaoCampanha, CAMPANHA_NO_PRAZO, resumirDecisaoRafael } from '../src/lib/assistente/rafael-aprovador';

describe('Rafael aprova no lugar da Jessica (12/11/2026)', () => {
  it('prazo de 2 minutos', () => {
    expect(PRAZO_RAFAEL_MS).toBe(120_000);
  });

  it('o Rafael decide também a autorização da campanha (desde 12/11/2026)', () => {
    expect(rafaelRevisa({ negociacao: true })).toBe(true);
    expect(rafaelRevisa({ negociacao: false })).toBe(true);
    expect(rafaelRevisa({})).toBe(true);
    expect(rafaelRevisa(null)).toBe(true);
  });

  it('campanha: só 30%, 20% ou sem campanha; prazo vencido = 20%', () => {
    expect(lerDecisaoCampanha({ pct: 30, motivo: 'ok' })).toEqual({ pct: 30, motivo: 'ok' });
    expect(lerDecisaoCampanha({ pct: '20%' })?.pct).toBe(20);
    expect(lerDecisaoCampanha({ pct: 0 })?.pct).toBe(0);
    expect(lerDecisaoCampanha({ pct: 50 })).toBeNull();
    expect(lerDecisaoCampanha({ pct: 25 })).toBeNull();
    expect(lerDecisaoCampanha({ pct: '' })).toBeNull();
    expect(lerDecisaoCampanha({})).toBeNull();
    expect(lerDecisaoCampanha(null)).toBeNull();
    expect(CAMPANHA_NO_PRAZO).toBe(20);
  });

  it('lê a decisão da IA', () => {
    const orig = 'Oi, Ana! Tudo bem?';
    expect(lerDecisaoRafael({ decisao: 'aprovar', motivo: 'ok' }, orig)).toEqual({ decisao: 'aprovar', texto: null, motivo: 'ok' });
    expect(lerDecisaoRafael({ decisao: 'Descartar' }, orig)?.decisao).toBe('descartar');
    expect(lerDecisaoRafael({ decisao: 'editar', texto: 'Oi, Ana!\n\nComo está o caixa hoje?' }, orig)).toEqual({ decisao: 'editar', texto: 'Oi, Ana!\n\nComo está o caixa hoje?', motivo: '' });
    // Edição igual ao original = aprovar; edição vazia ou decisão desconhecida = inválida.
    expect(lerDecisaoRafael({ decisao: 'editar', texto: ` ${orig} ` }, orig)?.decisao).toBe('aprovar');
    expect(lerDecisaoRafael({ decisao: 'editar', texto: '' }, orig)).toBeNull();
    expect(lerDecisaoRafael({ decisao: 'talvez' }, orig)).toBeNull();
    expect(lerDecisaoRafael(null, orig)).toBeNull();
    // Nunca mais de 3 mensagens.
    expect(lerDecisaoRafael({ decisao: 'editar', texto: 'a\n\nb\n\nc\n\nd' }, orig)?.texto).toBe('a\n\nb\n\nc');
  });

  it('prazo vencido sem IA: defeito vai para reescrita, o resto sai', () => {
    expect(decisaoNoPrazo({ defeitoObjetivo: true }).decisao).toBe('descartar');
    expect(decisaoNoPrazo({ defeitoObjetivo: false }).decisao).toBe('aprovar');
  });

  it('resposta a quem escreveu é urgente', () => {
    expect(urgente({ fase: 'resposta' })).toBe(true);
    expect(urgente({ fase: 'abertura' })).toBe(false);
    expect(urgente({})).toBe(false);
  });
});

describe('resumirDecisaoRafael (aba Decisões do painel do Rafael)', () => {
  it('aprovada sem mudança = Aprovou', () => {
    expect(resumirDecisaoRafael({ status: 'APROVADA', texto_final: 'oi', negociacao: false })).toMatchObject({ tipo: 'aprovou', enviada: true });
  });
  it('editada = Corrigiu e enviou', () => {
    expect(resumirDecisaoRafael({ status: 'EDITADA', texto_final: 'oi!', negociacao: false })).toMatchObject({ tipo: 'corrigiu', rotulo: 'Corrigiu e enviou' });
  });
  it('descartada guarda o motivo sem o prefixo "Rafael:"', () => {
    expect(resumirDecisaoRafael({ status: 'DESCARTADA', texto_final: 'Rafael: link cortado', negociacao: false })).toEqual({ tipo: 'refazer', rotulo: 'Pediu outra versão', motivo: 'link cortado', enviada: false });
  });
  it('campanha aprovada mostra o percentual; editada = sem campanha', () => {
    expect(resumirDecisaoRafael({ status: 'APROVADA', texto_final: null, negociacao: true, pctAutorizado: 30 }).rotulo).toBe('Autorizou 30%');
    expect(resumirDecisaoRafael({ status: 'EDITADA', texto_final: 'x', negociacao: true }).tipo).toBe('sem_campanha');
  });
});
