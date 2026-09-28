// Negociação do Luiz Felipe (dias 20 ao fim do mês): a oferta de campanha/revisão da proposta
// só sai com a autorização da gestão pelo WhatsApp, com prévia da proposta e botões.
// Desconto permitido: 20% a 30% na implantação e 10% na mensalidade por 12 meses. Puro.

import type { MenuWhatsapp } from '../../services/evolution.service';

export const MENSALIDADE_PCT = 10;
export const MENSALIDADE_MESES = 12;
export const OPCOES_IMPLANTACAO_PCT = [30, 20] as const;
export const VALIDADE_CAMPANHA_DIAS = 5; // campanha vale 5 dias corridos a partir da autorização

/** Data-limite da campanha (autorização + 5 dias corridos). */
export function validadeCampanha(c: { em?: string }): Date {
  return new Date(new Date(c.em || Date.now()).getTime() + VALIDADE_CAMPANHA_DIAS * 86400000);
}
export const campanhaVigente = (c: { em?: string } | null | undefined, agora = new Date()) => !!c && validadeCampanha(c) > agora;
const ateData = (c: { em?: string }) => validadeCampanha(c).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const r2 = (n: number) => Math.round(n * 100) / 100;

export type PreviaNegociacao = {
  empresa: string; contato: string | null; plano: string | null; mensalidade: number | null;
  implantacao: number | null; link: string | null; mensagem: string; agente: string;
};

export type CondicaoAutorizada = {
  impl_pct: number; mens_pct: number; meses: number;
  impl_de: number | null; impl_por: number | null; mens_de: number | null; mens_por: number | null;
  por?: string; em?: string;
};

export function calcularCondicao(implPct: number, implantacao: number | null, mensalidade: number | null): CondicaoAutorizada {
  return {
    impl_pct: implPct, mens_pct: MENSALIDADE_PCT, meses: MENSALIDADE_MESES,
    impl_de: implantacao, impl_por: implantacao != null ? r2(implantacao * (1 - implPct / 100)) : null,
    mens_de: mensalidade, mens_por: mensalidade != null ? r2(mensalidade * (1 - MENSALIDADE_PCT / 100)) : null,
  };
}

/** Texto do pedido de autorização para a gestão: prévia da proposta + o que o agente quer mandar + opções de desconto. */
export function textoPedidoNegociacao(p: PreviaNegociacao): string {
  const opcoes = OPCOES_IMPLANTACAO_PCT.map(pct => {
    const c = calcularCondicao(pct, p.implantacao, p.mensalidade);
    return `• *${pct}%* na implantação: ${brl(c.impl_de)} → *${brl(c.impl_por)}*`;
  });
  const m = calcularCondicao(0, p.implantacao, p.mensalidade);
  return [
    `🙋 *Autorização: ${p.agente} quer oferecer campanha / revisão da proposta*`,
    '',
    `🏪 *${p.empresa}*${p.contato ? ` (${p.contato})` : ''}`,
    p.plano ? `📦 Plano: *${p.plano}*` : null,
    p.mensalidade != null ? `💳 Mensalidade: ${brl(p.mensalidade)}` : null,
    p.implantacao != null ? `🛠️ Implantação: ${brl(p.implantacao)}` : null,
    p.link ? `🔗 ${p.link}` : null,
    '',
    `💬 *Mensagem que vai para o cliente:*\n"${p.mensagem.slice(0, 500)}"`,
    '',
    `*Desconto que o Luiz poderá negociar* (campanha de ${VALIDADE_CAMPANHA_DIAS} dias corridos):`,
    ...opcoes,
    `• *${MENSALIDADE_PCT}%* na mensalidade por ${MENSALIDADE_MESES} meses: ${brl(m.mens_de)} → *${brl(m.mens_de != null ? r2(m.mens_de * 0.9) : null)}*`,
    '',
    'Toque para responder:',
  ].filter(l => l !== null).join('\n');
}

export function menuNegociacao(msgId: string, texto: string): MenuWhatsapp {
  return {
    modo: 'button', texto, rodape: 'Assistente do CRM',
    opcoes: [
      { id: `neg_30_${msgId}`, texto: '✅ Autorizar 30%' },
      { id: `neg_20_${msgId}`, texto: '✅ Autorizar 20%' },
      { id: `neg_0_${msgId}`, texto: '❌ Não autorizar' },
    ],
  };
}

export function lerBotaoNegociacao(botaoId: string | null | undefined): { pct: number; msgId: string } | null {
  const m = (botaoId || '').match(/^neg_(30|20|0)_(.+)$/);
  return m ? { pct: Number(m[1]), msgId: m[2] } : null;
}

/** Instrução para o agente quando há desconto autorizado (só percentuais na conversa, sem R$). */
export function instrucaoDescontoAutorizado(c: CondicaoAutorizada): string {
  return `DESCONTO AUTORIZADO PELA GESTÃO para este cliente: ${c.impl_pct}% de desconto na implantação e ${c.mens_pct}% na mensalidade durante ${c.meses} meses. ` +
    `Seja comercial e conduza para o fechamento: quando o cliente mostrar interesse em revisar, negociar ou hesitar pelo preço, apresente essa condição (fale em porcentagem, sem valores em R$) como condição da campanha, válida por ${VALIDADE_CAMPANHA_DIAS} dias (até ${ateData(c)}), e pergunte se pode atualizar a proposta com ela. ` +
    'Se ele disser que sim / quer fechar / quer ver a proposta nova, use acao "aceitar_condicao" (o sistema atualiza a proposta e manda com os botões de aceite). Não ofereça mais do que isso.';
}

/** Texto curto que acompanha a proposta atualizada. */
export function textoCondicaoAplicada(c: CondicaoAutorizada): string {
  return [
    '🎉 *Condição da campanha aplicada na sua proposta:*',
    c.impl_de != null ? `🛠️ Implantação: de ${brl(c.impl_de)} por *${brl(c.impl_por)}* (${c.impl_pct}% off)` : `🛠️ ${c.impl_pct}% de desconto na implantação`,
    c.mens_de != null ? `💳 Mensalidade: *${brl(c.mens_por)}* nos primeiros ${c.meses} meses (${c.mens_pct}% off), depois ${brl(c.mens_de)}` : `💳 ${c.mens_pct}% de desconto na mensalidade por ${c.meses} meses`,
    `Condição válida por ${VALIDADE_CAMPANHA_DIAS} dias, até ${ateData(c)}.`,
  ].join('\n');
}
