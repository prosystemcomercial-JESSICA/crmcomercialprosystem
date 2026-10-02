// Frase do dia da página Início do Portal Técnico: a mesma para todos no dia, muda à meia-noite.
// Escritas para quem implanta sistema em loja: cuidado com o detalhe, paciência com o cliente, trabalho bem feito.

export const FRASES = [
  'Uma conversão bem validada hoje evita dez chamados amanhã.',
  'O cliente não vê o banco de dados. Ele vê o caixa abrindo sem erro na segunda de manhã.',
  'Feito é melhor que perfeito, mas conferido é melhor que feito.',
  'Cada item marcado no checklist é uma loja um passo mais perto de rodar sozinha.',
  'Paciência no treinamento é o que faz o cliente não precisar ligar depois.',
  'Quem anota o que fez trabalha uma vez só.',
  'Virada tranquila se constrói nos dias antes dela.',
  'Um bom técnico resolve o problema. Um ótimo técnico deixa o cliente entendendo por que ele aconteceu.',
  'Pequenas entregas todo dia vencem a pressa de última hora.',
  'O estoque certo no sistema é a confiança do dono da farmácia no Prosystem.',
  'Pergunte antes, ajuste depois: é mais rápido do que refazer.',
  'Toda loja que vira é uma família a mais confiando no nosso trabalho.',
  'Pausa registrada é tempo bem explicado.',
  'Organização é o que transforma correria em rotina.',
  'O melhor elogio de uma implantação é o cliente esquecer que trocou de sistema.',
  'Um passo de cada vez, com o checklist na mão.',
  'Problema que aparece cedo é problema pequeno.',
  'Ensinar bem uma vez economiza explicar dez vezes.',
  'Foco no que está na sua mesa agora; o resto tem a sua hora.',
  'Cuidado com o detalhe é respeito pelo cliente.',
  'Nota fiscal saindo certa no primeiro dia vale mais que qualquer apresentação.',
  'Quem pede ajuda na hora certa entrega antes.',
  'Hoje é um bom dia para deixar uma loja funcionando melhor do que encontrou.',
  'Tranquilidade do cliente se constrói com previsibilidade: diga o que vai fazer e faça.',
  'O trabalho que ninguém vê é o que segura a loja de pé.',
  'Terminar bem é tão importante quanto começar rápido.',
  'Sistema bem configurado é venda que não para no caixa.',
  'Cada dúvida do cliente é uma chance de ele confiar mais na gente.',
  'Constância vence intensidade.',
  'Bom trabalho hoje, menos retrabalho amanhã.',
];

/** Frase do dia (pelo dia do ano, horário de Brasília). */
export function fraseDoDia(agora = new Date()): string {
  const sp = new Date(agora.getTime() - 3 * 3600000);
  const inicioAno = Date.UTC(sp.getUTCFullYear(), 0, 1);
  const dia = Math.floor((sp.getTime() - inicioAno) / 864e5);
  return FRASES[dia % FRASES.length];
}

/** Saudação pelo horário de Brasília. */
export function saudacao(agora = new Date()): string {
  const h = new Date(agora.getTime() - 3 * 3600000).getUTCHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
