// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE FUNIS, FASES, SLAs e CHECKLISTS (Parte 2 do plano)
// Fonte única da verdade do processo de implantação Prosystem. Backend e
// frontend leem daqui — não duplicar regras em outro lugar.
// ─────────────────────────────────────────────────────────────────────────────

export type Funil = 'COMERCIAL' | 'IMPLANTACAO' | 'ONBOARDING';

export interface FaseDef {
  codigo: string;        // ex.: 'IMP_SANEAMENTO_FISCAL'
  funil: Funil;
  nome: string;          // rótulo exibido
  ordem: number;
  sla_dias?: number;     // tempo limite na fase (dias)
  sla_condicional?: { campo: 'tipo_implantacao'; mapa: Record<string, number> }; // SLA que depende de um campo
  checklist?: string[];  // itens obrigatórios criados ao entrar na fase
  exige_campos?: string[]; // campos obrigatórios p/ AVANÇAR desta fase
  ganho?: boolean;       // fase final de ganho
}

// FUNIL 1 — COMERCIAL (pré-venda)
const COMERCIAL: FaseDef[] = [
  { codigo: 'COM_PROSPECCAO',   funil: 'COMERCIAL', nome: 'Prospecção / Lead Novo', ordem: 1 },
  { codigo: 'COM_QUALIFICACAO', funil: 'COMERCIAL', nome: 'Qualificação & Diagnóstico', ordem: 2, exige_campos: ['segmento_atuacao', 'volumetria_pdvs'] },
  { codigo: 'COM_DEMO',         funil: 'COMERCIAL', nome: 'Demonstração Realizada', ordem: 3 },
  { codigo: 'COM_PROPOSTA',     funil: 'COMERCIAL', nome: 'Proposta Enviada', ordem: 4 },
  { codigo: 'COM_FECHADO',      funil: 'COMERCIAL', nome: 'Negócio Fechado / Won', ordem: 5, exige_campos: ['tipo_implantacao'] },
];

// FUNIL 2 — IMPLANTAÇÃO E SETUP TÉCNICO
const IMPLANTACAO: FaseDef[] = [
  { codigo: 'IMP_KICKOFF',  funil: 'IMPLANTACAO', nome: 'Kick-off e Validação de Hardware', ordem: 1, sla_dias: 2,
    checklist: ['Alinhamento realizado', 'Hardware validado', 'Internet validada'] },
  { codigo: 'IMP_FISCAL',   funil: 'IMPLANTACAO', nome: 'Saneamento Fiscal e Contábil', ordem: 2, sla_dias: 3,
    checklist: ['Certificado testado', 'CSC SEFAZ gerado', 'Tributação CFOP/CSOSN definida'] },
  { codigo: 'IMP_BANCO',    funil: 'IMPLANTACAO', nome: 'Preparação de Banco de Dados', ordem: 3,
    sla_condicional: { campo: 'tipo_implantacao', mapa: { BANCO_ZERADO: 2, MIGRACAO_DADOS: 20 } },
    checklist: ['Banco instalado', 'Homologação validada', 'Dados saneados'] },
  { codigo: 'IMP_INSTALACAO', funil: 'IMPLANTACAO', nome: 'Instalação e Homologação', ordem: 4, sla_dias: 2,
    checklist: ['PDV instalado nas máquinas', 'Teste NFC-e Homologação', 'Teste Contingência Offline'] },
  { codigo: 'IMP_GOLIVE',   funil: 'IMPLANTACAO', nome: 'Go-Live / Virada de Chave', ordem: 5,
    checklist: ['1º cupom fiscal em Produção emitido sob acompanhamento'] },
];

// FUNIL 3 — ONBOARDING E TREINAMENTO (90 dias)
const ONBOARDING: FaseDef[] = [
  { codigo: 'ONB_MES1', funil: 'ONBOARDING', nome: 'Mês 1 — Operação de PDV e Fiscal (D1-30)',   ordem: 1, sla_dias: 30 },
  { codigo: 'ONB_MES2', funil: 'ONBOARDING', nome: 'Mês 2 — Compras, Estoque e Fórmulas (D31-60)', ordem: 2, sla_dias: 30 },
  { codigo: 'ONB_MES3', funil: 'ONBOARDING', nome: 'Mês 3 — Financeiro e Gerencial (D61-90)',     ordem: 3, sla_dias: 30 },
  { codigo: 'ONB_SUCESSO', funil: 'ONBOARDING', nome: 'Cliente de Sucesso', ordem: 4, ganho: true },
];

export const FASES: FaseDef[] = [...COMERCIAL, ...IMPLANTACAO, ...ONBOARDING];
export const FASE_POR_CODIGO: Record<string, FaseDef> = Object.fromEntries(FASES.map(f => [f.codigo, f]));

export const FUNIS: { codigo: Funil; nome: string; fases: FaseDef[] }[] = [
  { codigo: 'COMERCIAL',   nome: 'Comercial (Pré-venda)', fases: COMERCIAL },
  { codigo: 'IMPLANTACAO', nome: 'Implantação e Setup Técnico', fases: IMPLANTACAO },
  { codigo: 'ONBOARDING',  nome: 'Onboarding e Treinamento (90 dias)', fases: ONBOARDING },
];

// ── Opções dos campos personalizados (Parte 1) — dropdowns ──
export const OPCOES = {
  segmento_atuacao: [
    { v: 'FARMACIA_DROGARIA', l: 'Farmácia/Drogaria' },
    { v: 'PADARIA_PERECIVEIS', l: 'Padaria/Perecíveis' },
    { v: 'VESTUARIO_CALCADOS', l: 'Vestuário/Calçados' },
    { v: 'VAREJO_GERAL', l: 'Varejo Geral' },
    { v: 'FOOD_SERVICE', l: 'Food Service' },
  ],
  regime_tributario: [
    { v: 'SIMPLES_NACIONAL', l: 'Simples Nacional' },
    { v: 'LUCRO_PRESUMIDO', l: 'Lucro Presumido' },
    { v: 'LUCRO_REAL', l: 'Lucro Real' },
  ],
  tipo_implantacao: [
    { v: 'BANCO_ZERADO', l: 'Banco Zerado (SLA 7 dias)' },
    { v: 'MIGRACAO_DADOS', l: 'Migração de Dados (SLA 30 dias)' },
  ],
  tipo_certificado: [
    { v: 'A1', l: 'A1 (Arquivo)' },
    { v: 'A3', l: 'A3 (Cartão/Token)' },
    { v: 'NAO_POSSUI', l: 'Não Possui' },
  ],
};

/** SLA efetivo (dias) de uma fase, considerando SLA condicional pelo tipo de implantação. */
export function slaDaFase(fase: FaseDef, tipoImplantacao?: string | null): number | undefined {
  if (fase.sla_condicional && tipoImplantacao) {
    return fase.sla_condicional.mapa[tipoImplantacao];
  }
  return fase.sla_dias;
}
