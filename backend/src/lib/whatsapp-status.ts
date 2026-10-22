// Falha da API não é celular desconectado (caso de 22/10/2026): das 10h06 às 10h17 a UAZAPI
// respondeu 401 "Invalid token" para tokens válidos, com os números conectados no painel. O CRM
// gravava DESCONECTADO, bloqueava o envio aos contatos desses números, tirava-os do rodízio e a
// vaga extra só voltava quando alguém abria Configurações.
// Agora a falha da consulta só vira DESCONECTADO depois de durar TOLERANCIA_FALHA_MS seguidos;
// antes disso, quem consulta mantém o último status conhecido.

export const TOLERANCIA_FALHA_MS = 15 * 60 * 1000;

type Falha = { desde: number; ultima: number };

/**
 * Registra uma falha de consulta do token e diz se ela ainda é tolerável (temporária).
 * Falha isolada depois de muito tempo sem falhas recomeça a contagem.
 */
export function registrarFalha(mapa: Map<string, Falha>, token: string, agora: number): boolean {
  const f = mapa.get(token);
  const desde = f && agora - f.ultima <= TOLERANCIA_FALHA_MS ? f.desde : agora;
  mapa.set(token, { desde, ultima: agora });
  return agora - desde < TOLERANCIA_FALHA_MS;
}
