// Conversas entre os agentes do escritório: nascem de eventos reais da operação
// (Julio passa um lead para a Caroline, Rafael orienta alguém, Olívia entrega a
// concorrência...). Aparecem na sala em balões redondos.
// Desde 06/10/2026 nada disso se perde quando o servidor reinicia: cada conversa vai para o mural da equipe
// (AgenteNota) pelo gancho de persistência, e a memória é recarregada do banco ao subir (equipe.service).

export type FalaAgente = { quem: string; texto: string };
export type ConversaAgentes = { id: string; de: string; para: string; tema: string; falas: FalaAgente[]; em: string };

const MAX = 40;
const lista: ConversaAgentes[] = [];

type Persistir = (c: ConversaAgentes) => void;
let persistir: Persistir | null = null;
/** Ligado no boot (equipe.service): grava cada conversa no banco. */
export function ligarPersistencia(f: Persistir) { persistir = f; }

export function registrarConversaAgentes(de: string, para: string, tema: string, falas: FalaAgente[]) {
  const limpas = falas.filter(f => f.texto?.trim()).map(f => ({ quem: f.quem, texto: f.texto.replace(/\s+/g, ' ').trim().slice(0, 160) }));
  if (!limpas.length) return;
  const c = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, de, para, tema: tema.slice(0, 80), falas: limpas.slice(0, 6), em: new Date().toISOString() };
  lista.unshift(c);
  lista.length = Math.min(lista.length, MAX);
  // O que se aprende numa conversa vira memória de quem participou (sem aprovação: só conhecimento da operação).
  for (const quem of [de, para]) lembrar(quem, `${tema}: ${limpas.map(f => f.texto).join(' / ').slice(0, 220)}`);
  try { persistir?.(c); } catch { /* o mural não pode derrubar a operação */ }
}

/** Recarrega do banco (boot): conversas recentes e a memória de cada agente. */
export function recarregar(conversas: ConversaAgentes[], memorias: { agente: string; texto: string; em: string }[]) {
  lista.length = 0;
  lista.push(...conversas.slice(0, MAX));
  memoria.clear();
  for (const m of [...memorias].sort((a, b) => (a.em < b.em ? -1 : 1))) lembrar(m.agente, m.texto, m.em);
}

/** Conversas das últimas horas (mais recente primeiro). */
export function conversasRecentes(horas = 6): ConversaAgentes[] {
  const limite = Date.now() - horas * 3600_000;
  return lista.filter(c => new Date(c.em).getTime() >= limite);
}

// ── Memória curta de cada agente (o que viveu e aprendeu com os colegas) ──
const memoria = new Map<string, { texto: string; em: string }[]>();
export function lembrar(agente: string, texto: string, em = new Date().toISOString()) {
  const m = memoria.get(agente) || [];
  m.unshift({ texto: texto.slice(0, 240), em });
  memoria.set(agente, m.slice(0, 20));
}
export const memoriaDoAgente = (agente: string) => memoria.get(agente) || [];
