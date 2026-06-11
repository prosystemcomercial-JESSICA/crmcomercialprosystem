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
  checklist_obrigatorio?: boolean; // se true, só avança com 100% do checklist concluído
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

// FUNIL 2 — CONVERSÃO E INSTALAÇÃO DE SISTEMA (TÉCNICO)
// Todas as fases bloqueiam o avanço enquanto o checklist não estiver 100%.
const IMPLANTACAO: FaseDef[] = [
  {
    codigo: 'IMP_CONVERSAO', funil: 'IMPLANTACAO', nome: 'Fase 1.1 — Conversão de Dados', ordem: 1,
    sla_condicional: { campo: 'tipo_implantacao', mapa: { BANCO_ZERADO: 3, MIGRACAO_DADOS: 30 } }, // condicional p/ sistema legado (20-30d)
    checklist_obrigatorio: true,
    checklist: [
      'Instalação do Banco de Dados',
      'Limpar tabelas para receber a nova versão',
      'Conversão dos dados do sistema anterior para Prosystem',
      'Validar Produtos (Cód_barras, Estoque, Tributação, Registro MS, Preço Custo/Venda, Lucro, Promoção)',
      'Validar Clientes (Endereço completo, RG, CPF, Crediário, Limite de Crédito)',
      'Validar Cadastro de Empresas e Prescritores',
      'Financeiro (Plano de contas, Contas a Pagar/Receber, Dados de Cartões)',
      'Movimentação (Entrada, Saída, Verificar última nota NFE/NFCE)',
      'Gerar SPED fiscal para validação de informações de valores',
      'Incluir sequência das últimas 10 NFE emitidas na NFE_NUMERACAO',
    ],
  },
  {
    codigo: 'IMP_SETUP', funil: 'IMPLANTACAO', nome: 'Fase 1.2 — Setup de Infraestrutura e Instalação', ordem: 2,
    sla_dias: 3, checklist_obrigatorio: true,
    checklist: [
      'Instalação do servidor, terminais e Caixa',
      'Configuração de Balança e Gaveta',
      'Configuração de impressora NFCE',
      'Configurar Uninfe e Certificado Digital',
      'Configurar sistema Gerencial',
      'Configurar o Copy (Backup) Interno e Externo (Nuvem)',
      'Configurar o Connect (Comunicação entre filiais)',
      'Instalar e Configurar Farmácias APP',
    ],
  },
  {
    codigo: 'IMP_GOLIVE', funil: 'IMPLANTACAO', nome: 'Fase 1.3 — Homologação e Go-Live', ordem: 3,
    sla_dias: 2, checklist_obrigatorio: true,
    checklist: [
      'Testar Cadastro de Clientes',
      'Teste de Cadastro de Produtos (verificar dados obrigatórios)',
      'Teste de Movimentação (Entrada, Emissão de nota e Cancelamento)',
      'Teste Financeiro (Movimentação)',
      'Validar se os relatórios estão 100% atualizados',
      'Emitir uma nota de saída NFCE em Operação Real (Go-Live)',
    ],
  },
];

// FUNIL 3 — ONBOARDING E TREINAMENTO DO CLIENTE (CICLO 90 DIAS)
const ONBOARDING: FaseDef[] = [
  {
    codigo: 'ONB_MES1', funil: 'ONBOARDING', nome: 'Fase 2.1 — Mês 1: Operação de Loja e PDV', ordem: 1,
    sla_dias: 30, checklist_obrigatorio: true,
    checklist: [
      'Configuração de Acesso padrão para Funcionários',
      'PDV: Pré Venda / Orçamento',
      'PDV: Emissão de Cupom Fiscal NFCE',
      'PDV: NFE de Acobertamento',
      'PDV: Devolução',
      'Fechamento de Caixa',
      'Recarga de celular (RV)',
      'Comunicação Entre Filiais',
    ],
  },
  {
    codigo: 'ONB_MES2', funil: 'ONBOARDING', nome: 'Fase 2.2 — Mês 2: Estoque, Farmácia e Compras', ordem: 2,
    sla_dias: 30, checklist_obrigatorio: true,
    checklist: [
      'Produtos: Cadastro',
      'Movimentação: Entrada / Saída de nota',
      'Controle de Estoque',
      'Controlados (Receitas) — Controle SNGPC',
      'PBM (Programa de Benefício em Medicamentos)',
      'Ofertar e configurar a integração IMendes',
    ],
  },
  {
    codigo: 'ONB_MES3', funil: 'ONBOARDING', nome: 'Fase 2.3 — Mês 3: Gestão Financeira e Estratégica', ordem: 3,
    sla_dias: 30, checklist_obrigatorio: true,
    checklist: [
      'Financeiro: Plano de Contas',
      'Crediário / Convênio',
      'Metas de Funcionários',
      'Prosystem Gerencial',
      'Sugestão de compras (CURVA ABC) — se não der p/ treinar a fundo, apresentar a ferramenta',
    ],
  },
  { codigo: 'ONB_SUCESSO', funil: 'ONBOARDING', nome: 'Treinamento Finalizado (carteira do Suporte)', ordem: 4, ganho: true },
];

export const FASES: FaseDef[] = [...COMERCIAL, ...IMPLANTACAO, ...ONBOARDING];
export const FASE_POR_CODIGO: Record<string, FaseDef> = Object.fromEntries(FASES.map(f => [f.codigo, f]));

export const FUNIS: { codigo: Funil; nome: string; fases: FaseDef[] }[] = [
  { codigo: 'COMERCIAL',   nome: 'Comercial (Pré-venda)', fases: COMERCIAL },
  { codigo: 'IMPLANTACAO', nome: 'Conversão e Instalação (Técnico)', fases: IMPLANTACAO },
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
