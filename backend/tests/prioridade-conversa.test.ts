import { describe, it, expect } from 'vitest';
import { prioridadePelaFala, telefoneNaFala, sobePrioridade, curtaDemaisParaRobo } from '../src/lib/assistente/prioridade-conversa';

describe('prioridade da conversa (Laya)', () => {
  it('cliente que passa outro número é prioridade máxima (caso Amor e Açúcar)', () => {
    expect(prioridadePelaFala(['boa tarde', 'me chama no outro nupero por favor', '27 99837-2351'])).toEqual({ nivel: 'CRITICA', motivo: 'o cliente passou outro contato' });
    expect(telefoneNaFala('27 99837-2351')).toBe('27 99837-2351');
    expect(telefoneNaFala('(27) 3333-4444')).toBeTruthy();
    expect(telefoneNaFala('+55 27 99837 2351')).toBeTruthy();
  });

  it('cliente que responde com interesse é prioridade máxima', () => {
    for (const t of ['gostaria sim de mais informações', 'Quanto custa?', 'quero conhecer o sistema', 'pode me mandar a proposta', 'como funciona?'])
      expect(prioridadePelaFala([t])?.nivel, t).toBe('CRITICA');
  });

  it('fala neutra não define prioridade sozinha', () => {
    for (const t of ['Bom dia', 'Sim', 'Data sistema', 'não temos interesse no momento não', 'ok', 'em 2026 abrimos 12 lojas'])
      expect(prioridadePelaFala([t]), t).toBeNull();
    expect(telefoneNaFala('CNPJ 12.345.678/0001-90')).toBeNull();
  });

  it('a prioridade só sobe', () => {
    expect(sobePrioridade('NORMAL', 'CRITICA')).toBe(true);
    expect(sobePrioridade(null, 'ALTA')).toBe(true);
    expect(sobePrioridade('ALTA', 'CRITICA')).toBe(true);
    expect(sobePrioridade('CRITICA', 'ALTA')).toBe(false);
    expect(sobePrioridade('CRITICA', 'CRITICA')).toBe(false);
  });

  it('falas curtas não são robô de loja (caso Marcilene)', () => {
    expect(curtaDemaisParaRobo(['Bom dia', 'Sim', 'Data sistema'])).toBe(true);
    expect(curtaDemaisParaRobo(['Olá! Seja bem-vindo à Padaria Pão Quente, em que podemos ajudar hoje?'])).toBe(false);
  });
});
