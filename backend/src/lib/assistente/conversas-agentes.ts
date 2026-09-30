// Conversas entre os agentes do escritório: nascem de eventos reais da operação
// (Julio passa um lead para a Caroline, Rafael orienta alguém, Olívia entrega a
// concorrência...). Aparecem na sala em balões redondos. Registro em memória
// (reinicia com o servidor) — a memória de longo prazo fica em "memoriaDoAgente".

export type FalaAgente = { quem: string; texto: string };
export type ConversaAgentes = { id: string; de: string; para: string; tema: string; falas: FalaAgente[]; em: string };

const MAX = 40;
const lista: ConversaAgentes[] = [];

export function registrarConversaAgentes(de: string, para: string, tema: string, falas: FalaAgente[]) {
  const limpas = falas.filter(f => f.texto?.trim()).map(f => ({ quem: f.quem, texto: f.texto.replace(/\s+/g, ' ').trim().slice(0, 160) }));
  if (!limpas.length) return;
  lista.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, de, para, tema: tema.slice(0, 80), falas: limpas.slice(0, 6), em: new Date().toISOString() });
  lista.length = Math.min(lista.length, MAX);
  // O que se aprende numa conversa vira memória de quem participou (sem aprovação: só conhecimento da operação).
  for (const quem of [de, para]) lembrar(quem, `${tema}: ${limpas.map(f => f.texto).join(' / ').slice(0, 220)}`);
}

/** Conversas das últimas horas (mais recente primeiro). */
export function conversasRecentes(horas = 6): ConversaAgentes[] {
  const limite = Date.now() - horas * 3600_000;
  return lista.filter(c => new Date(c.em).getTime() >= limite);
}

// ── Memória curta de cada agente (o que viveu e aprendeu com os colegas) ──
const memoria = new Map<string, { texto: string; em: string }[]>();
export function lembrar(agente: string, texto: string) {
  const m = memoria.get(agente) || [];
  m.unshift({ texto: texto.slice(0, 240), em: new Date().toISOString() });
  memoria.set(agente, m.slice(0, 20));
}
export const memoriaDoAgente = (agente: string) => memoria.get(agente) || [];
