// Proposta pelo WhatsApp (Fase 1 do assistente): resumo com botões de aceite,
// mensagem após o aceite (PIX) e régua de follow-up. Puro, sem banco nem rede.

import type { MenuWhatsapp } from '../../services/evolution.service';

export type PropostaResumo = {
  id: string; razao_social: string | null; nome_fantasia: string | null; responsavel_nome: string | null;
  plano_selecionado: string | null; mensalidade_basic?: number | null; mensalidade_pro: number | null; mensalidade_plus: number | null;
  valor_final: number | null; valor_implantacao: number | null; entrada: number | null; parcelas: number | null; valor_parcela: number | null;
  validade: Date | string | null; vendedor_nome: string | null; segmento: string | null;
};

const brl = (n: number | null | undefined) => n == null ? null : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
const primeiroNome = (s: string | null) => (s || '').trim().split(/\s+/)[0] || '';

export function linkProposta(base: string, token: string) {
  return `${base.replace(/\/$/, '')}/p/${token}?modo=cliente`;
}

/** Mensalidade do plano escolhido (ou a menor oferecida). */
export function mensalidadeDe(p: PropostaResumo): number | null {
  const plano = (p.plano_selecionado || '').toUpperCase();
  if (plano === 'BASIC' && p.mensalidade_basic) return p.mensalidade_basic;
  if (plano === 'PLUS' && p.mensalidade_plus) return p.mensalidade_plus;
  if (plano === 'PRO' && p.mensalidade_pro) return p.mensalidade_pro;
  return p.mensalidade_pro ?? p.mensalidade_plus ?? p.mensalidade_basic ?? null;
}

export function textoResumoProposta(p: PropostaResumo, link: string): string {
  const nome = primeiroNome(p.responsavel_nome);
  const inst = p.valor_final ?? p.valor_implantacao;
  const linhas = [
    `Olá${nome ? `, ${nome}` : ''}! Segue a sua proposta da *Prosystem* para *${(p.nome_fantasia || p.razao_social || 'sua empresa').trim()}*:`,
    '',
    p.plano_selecionado ? `📦 Plano: *${p.plano_selecionado}*` : null,
    mensalidadeDe(p) != null ? `💳 Mensalidade: *${brl(mensalidadeDe(p))}*` : null,
    inst != null ? `🛠️ Implantação: *${brl(inst)}*` : null,
    p.entrada ? `➡️ Entrada: ${brl(p.entrada)}${p.parcelas && p.parcelas > 1 && p.valor_parcela ? ` + ${p.parcelas - 1}x de ${brl(p.valor_parcela)}` : ''}` : null,
    p.validade ? `📅 Válida até ${dataBR(p.validade)}` : null,
    '',
    `Todos os detalhes aqui: ${link}`,
  ];
  return linhas.filter(l => l !== null).join('\n');
}

export function menuAceite(propostaId: string): MenuWhatsapp {
  return {
    modo: 'button', texto: 'Podemos seguir?', rodape: 'Prosystem Sistemas',
    opcoes: [{ id: `prop_ok_${propostaId}`, texto: 'Aceitar proposta' }, { id: `prop_duv_${propostaId}`, texto: 'Tenho dúvidas' }],
  };
}

export function lerBotaoProposta(botaoId: string | null | undefined): { acao: 'aceitar' | 'duvida'; id: string } | null {
  const m = (botaoId || '').match(/^prop_(ok|duv)_(.+)$/);
  return m ? { acao: m[1] === 'ok' ? 'aceitar' : 'duvida', id: m[2] } : null;
}

export const DOCUMENTOS_CONTRATO = 'Para o contrato, confirme por aqui:\n• Nome completo e CPF de quem vai assinar\n• E-mail para receber o link de assinatura';

export function textoPosAceite(p: PropostaResumo, pixChave: string): string {
  const base = `🎉 Proposta aceita! Muito obrigado pela confiança.\n\nJá estamos preparando o seu contrato. ${DOCUMENTOS_CONTRATO}`;
  if (!p.entrada) return `${base} Nossa equipe vai te chamar para os próximos passos.`;
  if (!pixChave.trim()) return `${base} Nosso financeiro vai te enviar a cobrança da entrada de ${brl(p.entrada)}.`;
  return `${base}\n\nPara garantir a sua data de implantação, a entrada é de *${brl(p.entrada)}* por PIX.\nChave PIX: *${pixChave.trim()}*\nDepois é só mandar o comprovante aqui. 🙏`;
}

export function textoDuvida(p: PropostaResumo): string {
  return `Claro! ${p.vendedor_nome ? `A ${primeiroNome(p.vendedor_nome)}` : 'Nossa especialista'} já vai falar com você para tirar as dúvidas. 😊`;
}

// ── Follow-up ───────────────────────────────────────────────────────────────

export const DIAS_FOLLOWUP = [2, 5, 7]; // etapa 1, 2 e 3
const ABERTAS = ['ENVIADA', 'VISUALIZADA'];

/**
 * Qual mensagem de follow-up mandar agora (1, 2 ou 3), 'parar' (o cliente
 * respondeu ou a proposta saiu de aberta) ou null (nada a fazer).
 */
export function decidirFollowup(x: {
  status: string; enviada_em: Date | null; etapa: number; ultima_entrada_em: Date | null; agora: Date;
}): 1 | 2 | 3 | 'parar' | null {
  if (!x.enviada_em || x.etapa >= DIAS_FOLLOWUP.length) return null;
  if (!ABERTAS.includes(x.status)) return 'parar';
  if (x.ultima_entrada_em && x.ultima_entrada_em.getTime() > x.enviada_em.getTime()) return 'parar';
  const dias = (x.agora.getTime() - x.enviada_em.getTime()) / 86400000;
  const proxima = (x.etapa + 1) as 1 | 2 | 3;
  return dias >= DIAS_FOLLOWUP[x.etapa] ? proxima : null;
}

const CONTEUDO_SEGMENTO: Record<string, string> = {
  farmacia: 'Um recurso que nossos clientes de farmácia mais elogiam: o sistema avisa quando o remédio de uso contínuo do cliente está acabando. A venda fica com você, e não com a concorrência. 💊',
  padaria: 'Um recurso que nossas padarias mais elogiam: a balança integrada ao caixa, que lê a etiqueta sem digitar nada, e as comandas impressas direto na cozinha. 🥖',
  outro: 'Um recurso que nossos clientes mais elogiam: os relatórios de vendas, margem e comissões chegando todo dia no WhatsApp do dono. 📊',
};

export function segmentoChave(seg: string | null): 'farmacia' | 'padaria' | 'outro' {
  const s = (seg || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/farm|drog|manip/.test(s)) return 'farmacia';
  if (/padar|panif|confeit/.test(s)) return 'padaria';
  return 'outro';
}

export function textoFollowup(etapa: 1 | 2 | 3, p: PropostaResumo, link: string): string {
  const nome = primeiroNome(p.responsavel_nome);
  const oi = `Oi${nome ? `, ${nome}` : ''}!`;
  if (etapa === 1) return `${oi} Conseguiu olhar a proposta da Prosystem? Se ficou alguma dúvida, é só me responder por aqui. 😊\n${link}`;
  if (etapa === 2) return `${oi} ${CONTEUDO_SEGMENTO[segmentoChave(p.segmento)]}\n\nSua proposta continua disponível: ${link}`;
  const val = p.validade ? ` vale até ${dataBR(p.validade)}` : ' está perto de vencer';
  return `${oi} Passando para lembrar que a sua proposta${val}. Quer garantir as condições? É só responder aqui ou aceitar pelo link: ${link}`;
}
