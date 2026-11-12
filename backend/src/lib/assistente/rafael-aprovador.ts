// Rafael aprova no lugar da Jessica (12/11/2026, pedido dela: "não deixe mais a Caroline esperando minhas
// aprovações, peça para o Rafael fazer isso, em no máximo 2 minutos por conversa").
// Regras puras da decisão; quem chama é services/rafael-aprovador.service (motor dos SDRs).

/** Prazo máximo que uma mensagem fica esperando aprovação. */
export const PRAZO_RAFAEL_MS = 2 * 60_000;
/** Reescritas pedidas pelo Rafael na mesma conversa em 6 h antes de ele ter de corrigir ou aprovar. */
export const REESCRITAS_MAX = 2;

export type DecisaoRafael = { decisao: 'aprovar' | 'editar' | 'descartar'; texto: string | null; motivo: string };

/** Só a autorização de campanha/revisão de proposta (preço) continua com a Jessica. */
export function rafaelRevisa(meta: { negociacao?: boolean } | null | undefined): boolean {
  return !meta?.negociacao;
}

/** Lê a resposta da IA do Rafael. Inválida = null (o motor tenta de novo ou usa a regra do prazo). */
export function lerDecisaoRafael(r: any, original: string): DecisaoRafael | null {
  if (!r || typeof r !== 'object') return null;
  const d = String(r.decisao || '').toLowerCase().trim();
  const motivo = String(r.motivo || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (d === 'aprovar') return { decisao: 'aprovar', texto: null, motivo };
  if (d === 'descartar') return { decisao: 'descartar', texto: null, motivo: motivo || 'o Rafael pediu outra versão' };
  if (d === 'editar') {
    const texto = String(r.texto || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 3).join('\n\n');
    if (!texto) return null;
    if (texto === original.trim()) return { decisao: 'aprovar', texto: null, motivo };
    return { decisao: 'editar', texto, motivo };
  }
  return null;
}

/** Venceu o prazo e a IA do Rafael não decidiu: defeito objetivo vai para reescrita; o resto sai como está. */
export function decisaoNoPrazo(p: { defeitoObjetivo: boolean }): DecisaoRafael {
  return p.defeitoObjetivo
    ? { decisao: 'descartar', texto: null, motivo: 'prazo de 2 minutos: a mensagem tinha defeito e foi reescrita' }
    : { decisao: 'aprovar', texto: null, motivo: 'prazo de 2 minutos: aprovada pela regra (a revisão por IA não respondeu)' };
}

/** Resposta a quem escreveu passa na frente; primeiro contato e retomada respeitam 1 envio por minuto. */
export function urgente(meta: { fase?: string } | null | undefined): boolean {
  return meta?.fase === 'resposta';
}
