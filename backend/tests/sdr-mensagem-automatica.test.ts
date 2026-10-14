import { describe, it, expect } from 'vitest';
import { ehRespostaAutomatica, ehEncerramentoAutomatico, soRoboDaLoja } from '../src/lib/assistente/sdr';

// Mensagens reais de robôs de farmácia (14/10/2026): boas-vindas, espera, encerramento e pesquisa de nota.
describe('mensagem automática da loja', () => {
  it('reconhece boas-vindas, espera, encerramento e pesquisa de nota', () => {
    for (const t of [
      '*Ton:* Olá, seja bem-vindo(a) à *Onfarma Alvorada*. 😊',
      '*Ton:* Aguarde, em instantes você será atendido(a) 👩🏻‍💻\nSe preferir pode nos enviar texto ou áudio com a lista de itens desejados. 👇🏻',
      '*Ton:* Seu atendimento foi finalizado! 👋\n\n_Não precisa responder essa mensagem._',
      '_Digite o *número* correspondente a sua nota_',
      'Vou encerrar seu atendimento por aqui.\nObrigado pela sua procura!\n\nA Farma Vila fica à disposição sempre que precisar, Bom dia!',
      'Atendimento finalizado ✓\nObrigado pela preferência, atenciosamente Farma Vila!\n\nBoa tarde',
    ]) expect(ehRespostaAutomatica(t), t).toBe(true);
  });

  it('não confunde a fala de uma pessoa', () => {
    for (const t of ['Então, no momento a gente não trabalha desse jeito, mas a vontade é que sim.', 'Quero ver a demonstração', 'Pode me ligar amanhã?', '']) expect(ehRespostaAutomatica(t), t).toBe(false);
  });

  it('separa o encerramento e a pesquisa de nota (não pede resposta nenhuma)', () => {
    expect(ehEncerramentoAutomatico('Atendimento finalizado ✓\nObrigado pela preferência, atenciosamente Farma Vila!')).toBe(true);
    expect(ehEncerramentoAutomatico('_Digite o *número* correspondente a sua nota_')).toBe(true);
    expect(ehEncerramentoAutomatico('*Ton:* Aguarde, em instantes você será atendido(a)')).toBe(false);
  });

  it('robô com folheto em imagem continua sendo só o robô; áudio é de uma pessoa', () => {
    const boasVindas = { tipo: 'TEXTO', conteudo: '*Ton:* Olá, seja bem-vindo(a) à *Onfarma Alvorada*. 😊' };
    expect(soRoboDaLoja([boasVindas, { tipo: 'IMAGEM', conteudo: '[imagem]' }])).toBe(true);
    expect(soRoboDaLoja([{ tipo: 'IMAGEM', conteudo: '[imagem]' }])).toBe(false);
    expect(soRoboDaLoja([boasVindas, { tipo: 'AUDIO', conteudo: '[áudio]' }])).toBe(false);
    expect(soRoboDaLoja([boasVindas, { tipo: 'TEXTO', conteudo: 'Bom dia, sou o dono, pode falar' }])).toBe(false);
  });
});
