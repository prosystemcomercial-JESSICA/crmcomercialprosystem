import { describe, it, expect } from 'vitest';
import { ehSoConfirmacao, semelhanca, lerRespostaCaroline } from '../src/lib/assistente/sdr';

describe('agentes não são repetitivos', () => {
  it('reconhece confirmação que não pede resposta', () => {
    for (const t of ['👍', '🙏🏻', 'ok', 'Ok!', 'obrigado', 'Obrigada.', 'blz', 'valeu', 'combinado', 'Beleza']) expect(ehSoConfirmacao(t)).toBe(true);
    for (const t of ['ok, e quanto custa?', 'Quero ver a demonstração', 'Estou em viagem, assim q volta entro em contato', '']) expect(ehSoConfirmacao(t)).toBe(false);
  });
  it('mede mensagens parecidas (caso Gustavo)', () => {
    const a = 'Boa tarde, Gustavo! Espero que esteja tudo bem por aí. Quando voltar, pode me chamar e retomamos a proposta do Loja Plus com calma.';
    const b = 'Combinado, Gustavo. Boa viagem! Quando voltar, me chama por aqui e retomamos a proposta.';
    expect(semelhanca(a, b)).toBeGreaterThanOrEqual(0.6);
    expect(semelhanca('Qual o maior problema hoje na farmácia?', 'Posso te enviar os horários da demonstração?')).toBeLessThan(0.6);
  });
  it('lê o adiamento pedido pelo cliente', () => {
    const r = lerRespostaCaroline({ mensagens: ['Boa viagem! Te chamo na volta.'], acao: 'continuar', nota: 30, adiar_dias: 10 });
    expect(r?.adiar_dias).toBe(10);
    expect(lerRespostaCaroline({ mensagens: ['oi'], acao: 'continuar', nota: 10 })?.adiar_dias).toBeNull();
  });
});
