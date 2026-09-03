import { FastifyReply } from 'fastify';

// Event bus em memória para SSE (Server-Sent Events) do WhatsApp — substitui o
// polling do frontend por push em tempo real. Cada conexão SSE fica escutando
// eventos filtrados pelo escopo do usuário (dono_id/gestão), igual ao REST hoje.
// Simples de propósito: 1 processo Node (PM2 fork, sem cluster), não precisa
// de Redis/pub-sub externo.

type ClienteSSE = { reply: FastifyReply; userId: string; podeVerTudo: boolean };

const clientes = new Set<ClienteSSE>();

export function registrarClienteSSE(reply: FastifyReply, userId: string, podeVerTudo: boolean) {
  const cliente: ClienteSSE = { reply, userId, podeVerTudo };
  clientes.add(cliente);
  return () => clientes.delete(cliente);
}

/**
 * Notifica clientes conectados sobre uma mudança na conversa (nova mensagem,
 * mudança de status/instância). `donoId` é o dono_id da conversa — só quem
 * pode ver essa conversa (o próprio dono, ou gestão) recebe o evento.
 */
export function emitirEventoConversa(donoId: string, tipo: 'mensagem' | 'conversa_atualizada', payload: any) {
  const data = JSON.stringify({ tipo, ...payload });
  for (const c of clientes) {
    if (c.userId === donoId || c.podeVerTudo) {
      try {
        c.reply.raw.write(`data: ${data}\n\n`);
      } catch { /* conexão morta — será limpa no 'close' do request */ }
    }
  }
}

/** Heartbeat periódico p/ manter a conexão viva atrás de proxies (evita timeout). */
export function iniciarHeartbeatSSE() {
  setInterval(() => {
    for (const c of clientes) {
      try { c.reply.raw.write(': ping\n\n'); } catch { /* limpo no close */ }
    }
  }, 25_000);
}
