import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Auditoria do lead — trilha completa (quem mudou o quê, quando) gravada em
 * LeadHistorico, e cálculo de tempo por etapa do funil (entrada → assinatura).
 */

// Campos auditáveis do lead (rótulos amigáveis). Mudança em qualquer um vira trilha.
export const CAMPOS_AUDITAVEIS: Record<string, string> = {
  nome: 'Nome', razao_social: 'Razão social', nome_fantasia: 'Nome fantasia',
  cnpj: 'CNPJ', segmento: 'Segmento', cidade: 'Cidade', estado: 'Estado',
  responsavel_id: 'Responsável (vendedor)', vendedor_nome: 'Vendedor',
  temperatura: 'Temperatura', etapa_comercial: 'Etapa comercial', etapa_funil: 'Etapa do funil',
  status: 'Status', status_atendimento: 'Status de atendimento',
  valor_estimado: 'Valor estimado', probabilidade: 'Probabilidade',
  plano_indicado: 'Plano indicado', plano_recomendado: 'Plano recomendado',
  proximo_contato: 'Próximo contato', motivo_perda: 'Motivo da perda',
  fechamento_plano: 'Plano fechado', fechamento_mrr: 'MRR fechado',
  fechamento_valor_inst: 'Valor instalação', fechamento_data: 'Data de fechamento',
};

const fmt = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

/**
 * Grava na trilha (LeadHistorico) cada campo alterado entre `antes` e `depois`.
 * Uma linha de auditoria por campo, com valor anterior/novo, ator e timestamp.
 */
export async function auditarAlteracoesLead(
  prisma: PrismaClient,
  leadId: string,
  leadNome: string | null,
  antes: Record<string, any>,
  depois: Record<string, any>,
  ator?: { id?: string; nome?: string },
) {
  const mudancas: { campo: string; label: string; de: string; para: string }[] = [];
  for (const campo of Object.keys(CAMPOS_AUDITAVEIS)) {
    if (!(campo in depois)) continue;
    const de = antes?.[campo];
    const para = depois?.[campo];
    if (fmt(de) === fmt(para)) continue;
    mudancas.push({ campo, label: CAMPOS_AUDITAVEIS[campo], de: fmt(de), para: fmt(para) });
  }
  if (!mudancas.length) return;

  // Uma entrada de trilha consolidando as mudanças do PATCH (com detalhes por campo).
  await prisma.$executeRawUnsafe(
    `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    randomUUID(), leadId, leadNome || null, 'ALTEROU_DADOS',
    fmt(antes?.etapa_funil), fmt(depois?.etapa_funil ?? antes?.etapa_funil),
    ator?.id || null, ator?.nome || 'Sistema',
    JSON.stringify({ mudancas }),
  ).catch(() => {});
}

/**
 * Lê a trilha de etapas do lead (LeadHistorico) e calcula o tempo em cada etapa.
 * Retorna: timeline de transições, dias por etapa, ciclo total (entrada → última etapa
 * ou assinatura) em dias corridos.
 */
export interface EtapaTempo { etapa: string; entrou_em: string; saiu_em: string | null; dias: number; horas: number; }
export interface CicloLead {
  lead_id: string;
  criado_em: string | null;
  assinado_em: string | null;
  ciclo_dias: number | null;       // entrada → assinatura (ou hoje, se em aberto)
  em_aberto: boolean;
  etapas: EtapaTempo[];
  transicoes: { de: string | null; para: string | null; em: string; ator: string | null; acao: string | null }[];
}

const DIA_MS = 86400000;

export async function calcularCicloLead(prisma: PrismaClient, leadId: string): Promise<CicloLead | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, created_at: true, etapa_funil: true, status: true, fechamento_data: true },
  });
  if (!lead) return null;

  // Trilha de movimentações de etapa, em ordem cronológica
  const hist: any[] = await prisma.$queryRawUnsafe(
    `SELECT etapa_anterior, etapa_destino, ator_nome, acao, created_at
     FROM LeadHistorico
     WHERE lead_id = ? AND etapa_destino IS NOT NULL
     ORDER BY created_at ASC`, leadId
  ).catch(() => []);

  const transicoes = hist
    .filter(h => (h.acao || '').match(/MOVEU_ETAPA|FECHOU_VENDA|MARCOU_PERDIDO/) || h.etapa_anterior !== h.etapa_destino)
    .map(h => ({ de: h.etapa_anterior || null, para: h.etapa_destino || null, em: new Date(h.created_at).toISOString(), ator: h.ator_nome || null, acao: h.acao || null }));

  // Constrói os intervalos por etapa: começa na criação, fecha a cada transição.
  const etapas: EtapaTempo[] = [];
  let etapaAtual = transicoes.length ? (transicoes[0].de || 'PROSPECCAO') : (lead.etapa_funil || 'PROSPECCAO');
  let entrouEm = lead.created_at ? new Date(lead.created_at) : new Date();

  for (const t of transicoes) {
    const saiu = new Date(t.em);
    const ms = Math.max(0, saiu.getTime() - entrouEm.getTime());
    etapas.push({ etapa: etapaAtual, entrou_em: entrouEm.toISOString(), saiu_em: saiu.toISOString(), dias: +(ms / DIA_MS).toFixed(2), horas: +(ms / 3600000).toFixed(1) });
    etapaAtual = t.para || etapaAtual;
    entrouEm = saiu;
  }
  // Etapa atual (ainda em aberto)
  const assinado = lead.fechamento_data ? new Date(lead.fechamento_data) : null;
  const fim = assinado || new Date();
  const msAtual = Math.max(0, fim.getTime() - entrouEm.getTime());
  etapas.push({ etapa: etapaAtual, entrou_em: entrouEm.toISOString(), saiu_em: assinado ? assinado.toISOString() : null, dias: +(msAtual / DIA_MS).toFixed(2), horas: +(msAtual / 3600000).toFixed(1) });

  const criado = lead.created_at ? new Date(lead.created_at) : null;
  const cicloMs = criado ? (fim.getTime() - criado.getTime()) : null;

  return {
    lead_id: lead.id,
    criado_em: criado ? criado.toISOString() : null,
    assinado_em: assinado ? assinado.toISOString() : null,
    ciclo_dias: cicloMs != null ? +(cicloMs / DIA_MS).toFixed(2) : null,
    em_aberto: !assinado && lead.status !== 'PERDIDO',
    etapas,
    transicoes,
  };
}
