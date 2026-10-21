// Ordem da fila de retomadas dos agentes (correção de 21/10/2026). Antes, a rodada pegava só 50 leads em
// AGUARDANDO sem ordem: sempre os mesmos, e os outros (eram 248) nunca tinham o retorno combinado cumprido.
// Agora todos entram, na ordem de quem está mais atrasado, e cada rodada fala com no máximo MAX_RETOMADAS_RODADA.

export const MAX_RETOMADAS_RODADA = 6;

type ItemFila = { dados: unknown; ultima_caroline_em: Date | null };

function data(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 0 = retorno combinado vencido · 1 = ciclo longo vencido · 2 = demais · 3 = combinado/ciclo ainda no futuro. */
export function prioridadeRetomada(s: ItemFila, agora: Date): { grupo: number; desde: number } {
  const d = (s.dados || {}) as Record<string, unknown>;
  const combinado = data(d.retomar_em);
  if (combinado) return combinado <= agora ? { grupo: 0, desde: combinado.getTime() } : { grupo: 3, desde: combinado.getTime() };
  const ciclo = data(d.ciclo_em);
  if (ciclo) return ciclo <= agora ? { grupo: 1, desde: ciclo.getTime() } : { grupo: 3, desde: ciclo.getTime() };
  return { grupo: 2, desde: s.ultima_caroline_em ? s.ultima_caroline_em.getTime() : 0 };
}

/** Mais atrasado primeiro: combinados vencidos (o mais antigo antes), ciclos vencidos, quem está há mais tempo sem mensagem. */
export function ordenarParaRetomada<T extends ItemFila>(lista: T[], agora: Date): T[] {
  return lista
    .map(s => ({ s, p: prioridadeRetomada(s, agora) }))
    .sort((a, b) => a.p.grupo - b.p.grupo || a.p.desde - b.p.desde)
    .map(x => x.s);
}
