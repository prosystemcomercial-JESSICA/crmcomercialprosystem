/**
 * O campo `segmento` (Lead/PropostaComercial) é texto livre ("Farmácia / Drogaria",
 * "Padaria", "Outro"…), então agrupamos por palavra-chave em 5 baldes fixos p/
 * relatórios e filtros. Manipulação é reconhecida ANTES do farmácia genérico
 * (senão "farm" já capturaria "Farmácia de Manipulação"). Sem match nenhum → OUTROS.
 */
export type GrupoSegmento = 'FARMACIA' | 'MANIPULACAO' | 'PADARIA' | 'VAREJO' | 'OUTROS';

export function segmentoDe(s?: string | null): GrupoSegmento {
  const t = (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase();
  if (/manipula/.test(t)) return 'MANIPULACAO';
  if (/farm|drog/.test(t)) return 'FARMACIA';
  if (/padar|confeit|pao|paes/.test(t)) return 'PADARIA';
  if (/varejo|loja|mercado|mercearia|comercio/.test(t)) return 'VAREJO';
  return 'OUTROS';
}

export const LABEL_SEGMENTO: Record<GrupoSegmento, string> = {
  FARMACIA: 'Farmácia / Drogaria',
  MANIPULACAO: 'Farmácia de Manipulação',
  PADARIA: 'Padaria',
  VAREJO: 'Varejo',
  OUTROS: 'Outros',
};

export const SEGMENTOS_ORDEM: GrupoSegmento[] = ['FARMACIA', 'MANIPULACAO', 'PADARIA', 'VAREJO', 'OUTROS'];
