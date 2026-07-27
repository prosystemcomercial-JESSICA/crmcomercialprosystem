import { z } from 'zod';

// Casos de Churn DTOs
export const CreateCasoChurnSchema = z.object({
  clienteId: z.string().min(1, 'Cliente ID é obrigatório'),
  motivo_principal: z.string().optional(),
  descricao: z.string().optional(),
  // Caso retroativo: quando o problema começou antes do cadastro no CRM.
  retroativo: z.boolean().optional(),
  data_abertura_real: z.string().datetime().optional(),
});

export const UpdateCasoChurnSchema = z.object({
  status: z.enum(['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO']).optional(),
  risk_score: z.number().min(0).max(100).optional(),
  motivo_principal: z.string().optional(),
  descricao: z.string().optional(),
  // Situação financeira
  fin_situacao: z.enum(['EM_DIA', 'EM_ATRASO', 'NEGOCIANDO', 'INADIMPLENTE']).optional().or(z.literal('')),
  fin_valor_atraso: z.coerce.number().optional(),
  fin_dias_atraso: z.coerce.number().int().optional(),
  fin_observacao: z.string().optional(),
});

export const ListCasoChurnSchema = z.object({
  status: z.string().optional(),
  risco_min: z.coerce.number().optional(),
  risco_max: z.coerce.number().optional(),
  busca: z.string().optional(), // por razão social, fantasia, nome, código, CNPJ
  data_inicio: z.string().optional(), // filtro mensal (1º dia do mês)
  data_fim: z.string().optional(),    // filtro mensal (último dia do mês)
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20)
});

export type CreateCasoChurnDTO = z.infer<typeof CreateCasoChurnSchema>;
export type UpdateCasoChurnDTO = z.infer<typeof UpdateCasoChurnSchema>;
export type ListCasoChurnDTO = z.infer<typeof ListCasoChurnSchema>;

// Diagnosis DTOs
export const CreateDiagnosisSchema = z.object({
  dias_sem_interacao: z.number().optional(),
  valor_mensal: z.number().optional(),
  frequencia_suporte: z.number().optional(),
  tempo_cliente: z.number().optional(),
  motivo_reportado: z.string().optional()
});

export const UpdateDiagnosisSchema = z.object({
  dias_sem_interacao: z.number().optional(),
  valor_mensal: z.number().optional(),
  frequencia_suporte: z.number().optional(),
  tempo_cliente: z.number().optional(),
  motivo_reportado: z.string().optional()
});

export type CreateDiagnosisDTO = z.infer<typeof CreateDiagnosisSchema>;
export type UpdateDiagnosisDTO = z.infer<typeof UpdateDiagnosisSchema>;

// Plano Retenção DTOs
export const CreatePlanoRetencaoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional()
});

export const UpdatePlanoRetencaoSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  status: z.enum(['RASCUNHO', 'ATIVO', 'CONCLUIDO']).optional()
});

export type CreatePlanoRetencaoDTO = z.infer<typeof CreatePlanoRetencaoSchema>;
export type UpdatePlanoRetencaoDTO = z.infer<typeof UpdatePlanoRetencaoSchema>;

// Ação Retenção DTOs
export const CreateAcaoRetencaoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  tipo: z.enum(['CONTATO', 'EMAIL', 'DESCONTO', 'PRODUTO', 'OUTRO']),
  responsavel_id: z.string().optional(),
  data_vencimento: z.string().datetime().optional(),
  plano_id: z.string().optional()
});

export const UpdateAcaoRetencaoSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  status: z.enum(['NOVA', 'EM_PROGRESSO', 'CONCLUIDA', 'CANCELADA']).optional(),
  responsavel_id: z.string().optional(),
  data_vencimento: z.string().datetime().optional()
});

export type CreateAcaoRetencaoDTO = z.infer<typeof CreateAcaoRetencaoSchema>;
export type UpdateAcaoRetencaoDTO = z.infer<typeof UpdateAcaoRetencaoSchema>;

// Dashboard DTOs
export const DashboardFiltersSchema = z.object({
  periodo: z.enum(['7dias', '30dias', '90dias', '6meses']).default('30dias'),
  status: z.string().optional()
});

export type DashboardFiltersDTO = z.infer<typeof DashboardFiltersSchema>;

// Authentication DTOs
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório')
});

export type LoginDTO = z.infer<typeof LoginSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;

export interface TokenResponseDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
  };
}
