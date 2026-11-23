// Espera depois de uma retomada que a IA não conseguiu montar (23/11/2026). Antes, o lead continuava "pronto" na
// fila de retomadas e a rodada seguinte (2 min) tentava de novo, sem fim: em 23/11 um lead do Julio e um do
// Luiz Felipe somaram centenas de tentativas no dia, gastando IA sem mandar nada. Agora cada falha seguida empurra
// a próxima tentativa: 1 h, 3 h e, da 3ª em diante, 24 h. Falhas com mais de 24 h de distância recomeçam a conta.

export type FalhaRetomada = { n: number; em: string } | null | undefined;

export function proximaFalhaRetomada(anterior: FalhaRetomada, agora: Date): { n: number; em: string; tentar_em: string } {
  const recente = !!anterior?.em && agora.getTime() - new Date(anterior.em).getTime() < 24 * 3600_000;
  const n = (recente ? anterior!.n || 0 : 0) + 1;
  const horas = n === 1 ? 1 : n === 2 ? 3 : 24;
  return { n, em: agora.toISOString(), tentar_em: new Date(agora.getTime() + horas * 3600_000).toISOString() };
}
