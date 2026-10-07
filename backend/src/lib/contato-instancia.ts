// Contato preso ao número (regra da Jessica, 07/10/2026): "se o número foi chamado em uma
// instância, toda a conversa deve permanecer lá; não deve ser chamado nunca nem respondido
// por outra". Regras puras; o banco fica em services/whatsapp-roteador.service.ts.

export type InstanciaResumo = { id: string; instancia_nome: string; apelido: string | null; instance_token: string | null; status: string };

/**
 * Chave do contato que ignora o 9 extra e o 55: DDD + 8 últimos dígitos para celular/fixo
 * brasileiro; os dígitos inteiros para os demais. "5527999990000" e "552799990000" → "2799990000".
 */
export function chaveContato(numero: string): string {
  const n = (numero || '').replace(/\D/g, '');
  const br = n.match(/^55(\d{2})\d{8,9}$/);
  return br ? `${br[1]}${n.slice(-8)}` : n;
}

export type DecisaoEnvio = { token: string; desviou: boolean } | { bloquear: string };

/**
 * Por qual número enviar. `pedida` = instância que o chamador usou (null se o token não está
 * no cadastro); `dona` = instância da primeira conversa com mensagens deste contato.
 *   - sem dona → envia pela pedida (este envio passa a fixar o contato nela);
 *   - dona = pedida → envia;
 *   - dona diferente e utilizável → envia pela dona (desviou);
 *   - dona desconectada/sem token → bloqueia. Nunca cai para outro número.
 */
export function decidirInstanciaEnvio(tokenPedido: string, pedida: InstanciaResumo | null, dona: InstanciaResumo | null): DecisaoEnvio {
  if (!dona) return { token: tokenPedido, desviou: false };
  if (pedida && pedida.id === dona.id) return { token: tokenPedido, desviou: false };
  if (!dona.instance_token || dona.status === 'DESCONECTADO') return { bloquear: dona.apelido || dona.instancia_nome };
  return { token: dona.instance_token, desviou: true };
}
