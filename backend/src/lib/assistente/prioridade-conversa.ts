// Prioridade de atendimento definida pela Laya (pedido da Jessica, 12/11/2026).
// Máxima (CRITICA): cliente respondeu com interesse ou passou outro contato. Alta: chegou por campanha/página de captação.
// Regras puras, sem banco: quem grava na conversa é o caroline.service.

export type PrioridadeConversa = 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
const ORDEM: PrioridadeConversa[] = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'];

/** A prioridade só sobe sozinha; baixar é decisão de uma pessoa, pelo menu da conversa. */
export function sobePrioridade(atual: string | null | undefined, nova: PrioridadeConversa): boolean {
  return ORDEM.indexOf(nova) > ORDEM.indexOf((atual || 'NORMAL') as PrioridadeConversa);
}

const semAcento = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Celular ou fixo brasileiro escrito na fala ("27 99837-2351", "(27) 3333-4444", "+55 27 9 9837 2351"). */
export function telefoneNaFala(texto: string | null | undefined): string | null {
  const m = (texto || '').match(/(?:\+?55[\s.-]?)?\(?\b\d{2}\)?[\s.-]?9?[\s.-]?\d{4}[\s.-]?\d{4}\b/);
  return m ? m[0].trim() : null;
}

const INTERESSE = /(mais informac|tenho interesse|temos interesse|me interess|quero (saber|conhecer|ver|entender)|queria (saber|conhecer|ver|entender)|gostaria|como funciona|quanto (custa|fica|e)\b|qual (o )?(valor|preco)|\bvalor(es)?\b|\bpreco|orcamento|proposta|demonstra|apresenta|comprar|contratar|me (chama|liga|manda|envia|passa)|pode (me )?(chamar|ligar|mandar|enviar|passar))/;

/** O que o cliente escreveu já pede prioridade máxima? null = a fala sozinha não diz (a nota da conversa ainda pode dizer). */
export function prioridadePelaFala(textos: (string | null | undefined)[]): { nivel: 'CRITICA'; motivo: string } | null {
  const falas = textos.map(t => t || '').filter(Boolean);
  if (falas.some(t => telefoneNaFala(t))) return { nivel: 'CRITICA', motivo: 'o cliente passou outro contato' };
  // Recusa ("não temos interesse", "sem interesse", "não quero") nunca vira prioridade.
  const recusa = (t: string) => /(\bnao (tenho|temos|tem|quero|queremos|preciso|precisamos|gostaria)\b|sem interesse|nao (me )?interessa)/.test(t);
  if (falas.some(t => { const n = semAcento(t); return INTERESSE.test(n) && !recusa(n); })) return { nivel: 'CRITICA', motivo: 'o cliente respondeu com interesse' };
  return null;
}

/**
 * Falas curtas ("Bom dia", "Sim", "Data sistema") são de gente, não do robô da loja: saudação automática é texto
 * comprido. As automáticas curtas conhecidas ("aguarde", "em instantes") já caem nas regras de ehRespostaAutomatica.
 * Caso de 12/11/2026: a Laya leu "Bom dia / Sim / Data sistema" como robô e a Caroline ficou calada.
 */
export function curtaDemaisParaRobo(textos: (string | null | undefined)[]): boolean {
  return textos.every(t => (t || '').trim().length < 40);
}
