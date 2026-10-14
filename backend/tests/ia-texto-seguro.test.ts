import { describe, it, expect } from 'vitest';
import { semCaractereQuebrado, jsonParaIa } from '../src/lib/assistente/ia-texto';

// 14/10/2026: o corte das mensagens caía no meio de um emoji (👩🏻‍💻 do robô da loja) e a OpenAI recusava
// o pedido inteiro com "invalid_json" (HTTP 400). O treino do Julio falhava sempre por isso.
describe('texto seguro para a IA', () => {
  it('tira a metade de emoji que sobra de um corte', () => {
    const cortado = 'Aguarde 👩🏻‍💻'.slice(0, 9); // termina no meio do emoji
    expect(semCaractereQuebrado(cortado)).toBe('Aguarde ');
    expect(semCaractereQuebrado('\uDC00fim')).toBe('fim');
  });
  it('mantém emoji inteiro e acento', () => {
    expect(semCaractereQuebrado('Olá 😊 👍🏻 farmácia')).toBe('Olá 😊 👍🏻 farmácia');
  });
  it('o corpo do pedido sai sem caractere quebrado', () => {
    const corpo = jsonParaIa({ input: [{ text: 'oi 👩🏻‍💻'.slice(0, 4) }] });
    expect(corpo).not.toMatch(/\\ud[89ab]/i);
    expect(JSON.parse(corpo).input[0].text).toBe('oi ');
  });
});
