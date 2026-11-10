// Escritório por setores (10/11/2026): quem é de qual setor, de quem recebe e para quem entrega, e o
// status visto pela Jessica (trabalhando, parado, desligado, com erro). Puro; o painel monta os números.

export const SETORES = [
  { id: 'entrada', nome: 'Entrada de leads', agentes: ['heitor', 'bia', 'zequinha', 'clarice'] },
  { id: 'vendas', nome: 'Vendas', agentes: ['caroline', 'julio', 'lurdinha', 'luiz_felipe'] },
  { id: 'inteligencia', nome: 'Inteligência e treino', agentes: ['rafael', 'laya', 'olivia', 'sofia', 'joana'] },
  { id: 'clientes', nome: 'Clientes e gestão', agentes: ['helena', 'mila', 'otavio', 'marta'] },
] as const;

/** Ligações entre agentes: `tipo` passa = o lead ou o material segue; orienta = ensina, confere ou devolve. */
export const LIGACOES: { de: string; para: string; tipo: 'passa' | 'orienta'; rotulo: string }[] = [
  { de: 'heitor', para: 'caroline', tipo: 'passa', rotulo: 'leads cadastrados' },
  { de: 'bia', para: 'caroline', tipo: 'passa', rotulo: 'leads da triagem' },
  { de: 'zequinha', para: 'caroline', tipo: 'passa', rotulo: 'respostas de campanha' },
  { de: 'julio', para: 'caroline', tipo: 'passa', rotulo: 'leads que voltaram a responder' },
  { de: 'caroline', para: 'lurdinha', tipo: 'passa', rotulo: 'demonstrações' },
  { de: 'luiz_felipe', para: 'julio', tipo: 'orienta', rotulo: 'propostas sem resposta' },
  { de: 'rafael', para: 'caroline', tipo: 'orienta', rotulo: 'orientações' },
  { de: 'rafael', para: 'julio', tipo: 'orienta', rotulo: 'orientações' },
  { de: 'rafael', para: 'luiz_felipe', tipo: 'orienta', rotulo: 'orientações' },
  { de: 'laya', para: 'caroline', tipo: 'orienta', rotulo: 'mensagens conferidas' },
  { de: 'olivia', para: 'rafael', tipo: 'orienta', rotulo: 'concorrência' },
  { de: 'sofia', para: 'joana', tipo: 'passa', rotulo: 'pesquisas' },
  { de: 'joana', para: 'zequinha', tipo: 'passa', rotulo: 'Informativo' },
  { de: 'helena', para: 'mila', tipo: 'passa', rotulo: 'pesquisas de satisfação' },
  { de: 'otavio', para: 'mila', tipo: 'passa', rotulo: 'implantações' },
];

export const setorDe = (id: string) => SETORES.find(s => (s.agentes as readonly string[]).includes(id))?.id || 'clientes';
export const recebeDe = (id: string) => [...new Set(LIGACOES.filter(l => l.para === id).map(l => l.de))];
export const entregaPara = (id: string) => [...new Set(LIGACOES.filter(l => l.de === id).map(l => l.para))];

/**
 * Agente com erro: pausado pelo motor depois de falhas, ou que hoje só falhou nas chamadas de IA (3 ou mais
 * falhas e nenhuma resposta). Devolve o motivo, ou null.
 */
export function motivoErro(p: { pausadaMotivo?: string | null; pausadaAte?: string | null; agora: Date; iaHoje?: { ok: number; falhas: number } | null }): string | null {
  if (p.pausadaMotivo && (!p.pausadaAte || new Date(p.pausadaAte) > p.agora)) return p.pausadaMotivo;
  if (p.iaHoje && p.iaHoje.falhas >= 3 && p.iaHoje.ok === 0) return `as chamadas de IA falharam hoje (${p.iaHoje.falhas} falhas, nenhuma resposta)`;
  return null;
}

/** Teto mensal: 0 = sem teto. Devolve a fração usada e o nível do aviso. */
export function situacaoTeto(gasto: number, previsao: number, teto: number): { usado: number; nivel: 'sem_teto' | 'ok' | 'atencao' | 'estourou'; previsao_estoura: boolean } {
  if (!(teto > 0)) return { usado: 0, nivel: 'sem_teto', previsao_estoura: false };
  const usado = gasto / teto;
  return { usado, nivel: usado >= 1 ? 'estourou' : usado >= 0.8 ? 'atencao' : 'ok', previsao_estoura: previsao > teto };
}
