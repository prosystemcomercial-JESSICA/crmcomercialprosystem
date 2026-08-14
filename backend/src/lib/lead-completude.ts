// Indicador de completude de cadastro do lead — valor derivado, nunca persistido.
// Calculado on-the-fly a partir dos campos já carregados nas rotas de leitura de leads.
export interface LeadCompletudeInput {
  telefone?: string | null;
  responsavel_telefone?: string | null;
  email?: string | null;
  responsavel_email?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  qtd_lojas?: number | null;
  sistema_atual?: string | null;
  responsavel_nome?: string | null;
  temperatura?: string | null;
  probabilidade?: number | null;
  observacoes_comerciais?: string | null;
}

// 9 critérios, pesos iguais. "concorrente_atual" da spec original foi descartado
// em favor de reaproveitar sistema_atual (já cobre a mesma informação — ver
// docs/superpowers/specs/2026-08-14-perfil-sdr-design.md, Bloco 4).
export function calcularCompletude(lead: LeadCompletudeInput): number {
  const criterios = [
    !!(lead.telefone || lead.responsavel_telefone),
    !!(lead.email || lead.responsavel_email),
    !!lead.segmento,
    !!lead.cidade,
    !!lead.qtd_lojas,
    !!lead.sistema_atual,
    !!lead.responsavel_nome,
    !!(lead.temperatura && lead.temperatura !== 'FRIO') || !!lead.probabilidade,
    !!lead.observacoes_comerciais,
  ];
  const preenchidos = criterios.filter(Boolean).length;
  return Math.round((preenchidos / criterios.length) * 100);
}
