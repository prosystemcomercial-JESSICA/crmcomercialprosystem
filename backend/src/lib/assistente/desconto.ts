// Aprovação de desconto pelo celular (ideia 23 do assistente): acima do limite,
// a proposta só sai pelo WhatsApp depois que a gestão aprova. Puro.

import type { MenuWhatsapp } from '../../services/evolution.service';

export const LIMITE_PADRAO_PCT = 30;

type Valores = { desconto: number | null; valor_implantacao: number | null; valor_conversao: number | null };
type Aprovacao = { desconto_aprov_status: string | null; desconto_aprov_pct: number | null };

/** Desconto em % sobre implantação + conversão (1 casa decimal). */
export function pctDesconto(p: Valores): number {
  const base = (p.valor_implantacao || 0) + (p.valor_conversao || 0);
  if (!p.desconto || base <= 0) return 0;
  return Math.round((p.desconto / base) * 1000) / 10;
}

/** Precisa de aprovação: acima do limite e sem aprovação que cubra este desconto. Limite 0 = desligado. */
export function precisaAprovacao(p: Valores & Aprovacao, limitePct: number): boolean {
  if (!limitePct) return false;
  const pct = pctDesconto(p);
  if (pct <= limitePct) return false;
  return !(p.desconto_aprov_status === 'APROVADO' && (p.desconto_aprov_pct ?? -1) >= pct);
}

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function textoPedidoAprovacao(p: Valores & { nome: string; valor_final: number | null; plano: string | null }, solicitante: string, limitePct: number): string {
  const base = (p.valor_implantacao || 0) + (p.valor_conversao || 0);
  return [
    '💸 *Pedido de aprovação de desconto*',
    `${solicitante} quer enviar a proposta de *${p.nome}*${p.plano ? ` (plano ${p.plano})` : ''}:`,
    `Implantação ${brl(base)} − desconto ${brl(p.desconto)} = *${brl(p.valor_final ?? base - (p.desconto || 0))}*`,
    `Desconto de *${pctDesconto(p).toLocaleString('pt-BR')}%* (limite ${limitePct}%)`,
  ].join('\n');
}

export function menuAprovacao(propostaId: string, texto: string): MenuWhatsapp {
  return {
    modo: 'button', texto, rodape: 'Assistente do CRM',
    opcoes: [{ id: `desc_ok_${propostaId}`, texto: 'Aprovar' }, { id: `desc_no_${propostaId}`, texto: 'Recusar' }],
  };
}

export function lerBotaoDesconto(botaoId: string | null | undefined): { aprovado: boolean; id: string } | null {
  const m = (botaoId || '').match(/^desc_(ok|no)_(.+)$/);
  return m ? { aprovado: m[1] === 'ok', id: m[2] } : null;
}
