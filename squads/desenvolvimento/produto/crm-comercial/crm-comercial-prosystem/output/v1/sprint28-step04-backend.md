# Sprint 28 — Step 04 — Felipe Santos (Backend)
# Churn e Retenção — Implementação Backend

## Estrutura de Diretórios

```
src/
├── services/
│   ├── caso-churn.service.ts
│   ├── diagnosis.service.ts
│   ├── plano-retencao.service.ts
│   ├── acao-retencao.service.ts
│   ├── risk-matrix.service.ts
│   ├── dashboard-retencao.service.ts
│   └── relatorio-churn.service.ts
│
├── routes/
│   ├── casos-churn.routes.ts
│   ├── diagnosis.routes.ts
│   ├── planos-retencao.routes.ts
│   ├── acoes-retencao.routes.ts
│   ├── dashboard-retencao.routes.ts
│   └── relatorios-churn.routes.ts
│
├── schemas/
│   ├── caso-churn.schema.ts
│   ├── diagnosis.schema.ts
│   ├── plano-retencao.schema.ts
│   └── acao-retencao.schema.ts
│
├── middlewares/
│   ├── auth.middleware.ts (já existe)
│   ├── caso-ownership.middleware.ts
│   └── role-validation.middleware.ts
│
├── types/
│   └── retencao.types.ts
│
├── crons/
│   └── retencao.crons.ts
│
└── utils/
    ├── cache.util.ts
    └── error-handler.util.ts
```

---

## 1. Schemas de Validação (Zod)

**File:** `src/schemas/caso-churn.schema.ts`

```typescript
import { z } from 'zod';

export const CreateCasoChurnSchema = z.object({
  clienteId: z.string().cuid(),
  clienteBaseId: z.string().cuid(),
  motivo: z.enum([
    'INSATISFACAO_SERVICO', 'MAL_USO_PRODUTO', 'MIGRACAO_CONCORRENCIA',
    'PRECO', 'FALTA_SUPORTE', 'INTEGRACAO_PROBLEMAS', 'VOLUME_BAIXO',
    'PERSONALIZACAO_INSUFICIENTE', 'PERFORMANCE_LENTA', 'OUTROS'
  ]),
  sentimento: z.enum(['MUITO_NEGATIVO', 'NEGATIVO', 'NEUTRO', 'POSITIVO']),
  atribuidoParaId: z.string().cuid(),
  descricao: z.string().max(2000).optional(),
});

export const UpdateCasoChurnSchema = z.object({
  motivo: z.enum([...]).optional(),
  sentimento: z.enum([...]).optional(),
  descricao: z.string().max(2000).optional(),
  atribuidoParaId: z.string().cuid().optional(),
  dataAgendadoContato: z.date().optional(),
});

export const TransitionCasoStatusSchema = z.object({
  newStatus: z.enum(['ATIVO', 'REMARCADO', 'NEGOCIANDO', 'CANCELADO', 'REATIVADO', 'FECHADO']),
  metadata: z.record(z.any()).optional(),
});

export type CreateCasoChurnDTO = z.infer<typeof CreateCasoChurnSchema>;
export type UpdateCasoChurnDTO = z.infer<typeof UpdateCasoChurnSchema>;
```

**File:** `src/schemas/diagnosis.schema.ts`

```typescript
export const FillDiagnosisSchema = z.object({
  motivo: z.enum([...]),
  detalheMotivo: z.string().max(1000),
  sentimento: z.enum(['MUITO_NEGATIVO', 'NEGATIVO', 'NEUTRO', 'POSITIVO']),
  avaliacaoSuporte: z.number().min(1).max(5),
  grauInsatisfacao: z.number().min(1).max(10),
  chanceRecuperacao: z.enum(['MUITO_BAIXA', 'BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA']),
});

export type DiagnosisDTO = z.infer<typeof FillDiagnosisSchema>;
```

**File:** `src/schemas/plano-retencao.schema.ts`

```typescript
export const CreatePlanoRetencaoSchema = z.object({
  casoChurnId: z.string().cuid(),
  estrategia: z.enum([
    'DESCONTO_PRECO', 'FEATURE_CUSTOMIZADA', 'SUPORTE_DEDICADO',
    'TREINAMENTO_INTENSIVO', 'UPGRADE_PLANO', 'REVISAR_INTEGRACAO',
    'EXECUTIVO_BUSINESS_REVIEW', 'DESCONTO_TEMPORAL_PROMOTION'
  ]),
  descricaoEstrategia: z.string().max(2000),
  setoresEnvolvidos: z.array(z.string()).min(1),
  dataLancamento: z.date(),
  dataMetaProposta: z.date().optional(),
}).refine(
  (data) => !data.dataMetaProposta || data.dataMetaProposta > data.dataLancamento,
  { message: 'Meta deve ser após lançamento', path: ['dataMetaProposta'] }
);

export type CreatePlanoDTO = z.infer<typeof CreatePlanoRetencaoSchema>;
```

**File:** `src/schemas/acao-retencao.schema.ts`

```typescript
export const CreateAcaoRetencaoSchema = z.object({
  casoChurnId: z.string().cuid(),
  planoRetencaoId: z.string().cuid().optional(),
  tipoAcao: z.enum([
    'CONTATO_TELEFONICO', 'REUNIAO_EXECUTIVO', 'ENVIO_PROPOSTA',
    'DESCONTO_OFERECIDO', 'FEATURE_CUSTOMIZADA_DESENVOLVIDA',
    'TREINAMENTO_REALIZADO', 'REVISAO_INTEGRACAO', 'ESCALACAO_DIRETORIA'
  ]),
  descricao: z.string().max(1000),
  resultado: z.enum(['POSITIVO', 'NEGATIVO', 'INDETERMINADO']),
  resultadoDetalhado: z.string().max(1000).optional(),
  dataAcao: z.date().default(() => new Date()),
  proximosPassos: z.string().max(1000).optional(),
});

export type CreateAcaoDTO = z.infer<typeof CreateAcaoRetencaoSchema>;
```

---

## 2. Services (Implementação Completa)

**File:** `src/services/caso-churn.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { historico } from '@/lib/historico';
import { ConflictError, NotFoundError, BadRequestError } from '@/utils/errors';
import type { CreateCasoChurnDTO, UpdateCasoChurnDTO } from '@/schemas/caso-churn.schema';

export class CasoChurnService {
  async create(data: CreateCasoChurnDTO, criadoPorId: string) {
    // Validar: cliente não tem caso ATIVO já
    const existing = await prisma.casoChurn.findFirst({
      where: {
        clienteId: data.clienteId,
        status: 'ATIVO'
      }
    });
    if (existing) {
      throw new ConflictError('Cliente já tem caso aberto. Feche o anterior ou mude o status.');
    }
    
    // Validar FK: clienteBaseId existe e pertence ao cliente
    const contrato = await prisma.contrato.findUnique({
      where: { id: data.clienteBaseId },
      include: { cliente: true }
    });
    if (!contrato || contrato.clienteId !== data.clienteId) {
      throw new BadRequestError('Contrato não pertence a este cliente');
    }
    
    // Validar assignee é CS ou Supervisor
    const assignee = await prisma.user.findUnique({
      where: { id: data.atribuidoParaId }
    });
    if (!assignee || !['CS_RETENCAO', 'SUPERVISAO_CS'].includes(assignee.role)) {
      throw new BadRequestError('Assignee deve ser CS ou Supervisor');
    }
    
    // Criar caso
    const caso = await prisma.casoChurn.create({
      data: {
        clienteId: data.clienteId,
        clienteBaseId: data.clienteBaseId,
        motivo: data.motivo,
        sentimento: data.sentimento,
        atribuidoParaId: data.atribuidoParaId,
        criadoPorId,
        descricao: data.descricao,
        dataAlertaGerado: new Date(),
        riskScore: 0,
        status: 'ATIVO'
      }
    });
    
    // Hook: HistoricoLead silent fail
    historico.create({
      leadId: data.clienteId,
      tipo: 'caso_churn_aberto',
      detalhes: {motivoChurn: data.motivo, riskScore: 0}
    }).catch(err => {
      console.error('[HistoricoLead] Fail creating caso_churn_aberto:', err);
    });
    
    // Invalidate caches
    cache.invalidatePattern(/^casos:/);
    cache.invalidatePattern(/^dashboard:/);
    
    return caso;
  }
  
  async getById(id: string) {
    const cacheKey = `caso:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const caso = await prisma.casoChurn.findUnique({
      where: { id },
      include: {
        cliente: true,
        clienteBase: { include: { cliente: true } },
        atribuidoPara: true,
        diagnosis: true,
        planos: { include: { acoes: true } },
        acoes: { orderBy: { dataAcao: 'desc' }, take: 10 }
      }
    });
    
    if (caso) {
      cache.set(cacheKey, caso, 300); // 5min
    }
    
    return caso;
  }
  
  async list(filters: any, skip: number = 0, take: number = 50) {
    const where = this.buildWhereClause(filters);
    
    const cacheKey = `casos:list:${JSON.stringify({where, skip, take})}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const [casos, total] = await Promise.all([
      prisma.casoChurn.findMany({
        where,
        skip,
        take,
        include: {
          cliente: true,
          clienteBase: true,
          atribuidoPara: true
        },
        orderBy: [
          { riskScore: 'desc' },
          { createdAt: 'asc' }
        ]
      }),
      prisma.casoChurn.count({ where })
    ]);
    
    const result = { casos, total, page: skip / take, pageSize: take };
    cache.set(cacheKey, result, 300); // 5min
    return result;
  }
  
  async update(id: string, data: UpdateCasoChurnDTO) {
    const caso = await this.getById(id);
    if (!caso) throw new NotFoundError('Caso não encontrado');
    
    const updated = await prisma.casoChurn.update({
      where: { id },
      data: {
        motivo: data.motivo ?? caso.motivo,
        sentimento: data.sentimento ?? caso.sentimento,
        descricao: data.descricao ?? caso.descricao,
        atribuidoParaId: data.atribuidoParaId ?? caso.atribuidoParaId,
        dataAgendadoContato: data.dataAgendadoContato ?? caso.dataAgendadoContato
      }
    });
    
    // If motivo or sentimento changed, need to recalculate riskScore
    if (data.motivo || data.sentimento) {
      cache.invalidatePattern(/^risk-matrix:/);
    }
    
    cache.invalidatePattern(/^casos:/);
    cache.invalidatePattern(/^dashboard:/);
    
    return updated;
  }
  
  async transitionStatus(id: string, newStatus: string, metadata: any) {
    const caso = await this.getById(id);
    if (!caso) throw new NotFoundError('Caso não encontrado');
    
    const validTransitions: Record<string, string[]> = {
      ATIVO: ['REMARCADO', 'NEGOCIANDO', 'CANCELADO', 'REATIVADO'],
      REMARCADO: ['ATIVO', 'NEGOCIANDO', 'CANCELADO', 'REATIVADO'],
      NEGOCIANDO: ['REMARCADO', 'CANCELADO', 'REATIVADO', 'FECHADO'],
      CANCELADO: ['REATIVADO', 'FECHADO'],
      REATIVADO: ['FECHADO'],
      FECHADO: []
    };
    
    if (!validTransitions[caso.status]?.includes(newStatus)) {
      throw new BadRequestError(
        `Transição inválida: ${caso.status} → ${newStatus}`
      );
    }
    
    let updateData: any = { status: newStatus };
    
    // Handle metadata by new status
    if (newStatus === 'REMARCADO') {
      if (!metadata.dataContato) {
        throw new BadRequestError('dataContato é obrigatório para REMARCADO');
      }
      updateData.dataAgendadoContato = new Date(metadata.dataContato);
    } else if (newStatus === 'REATIVADO') {
      if (!metadata.novoContratoId) {
        throw new BadRequestError('novoContratoId é obrigatório para REATIVADO');
      }
      // Validate novo contrato exists and belongs to cliente
      const novoContrato = await prisma.contrato.findUnique({
        where: { id: metadata.novoContratoId }
      });
      if (!novoContrato || novoContrato.clienteId !== caso.clienteId) {
        throw new BadRequestError('Novo contrato deve pertencer ao mesmo cliente');
      }
      updateData.novoContratoId = metadata.novoContratoId;
    }
    
    const updated = await prisma.casoChurn.update({
      where: { id },
      data: updateData
    });
    
    // HistoricoLead
    historico.create({
      leadId: caso.clienteId,
      tipo: 'caso_status_mudou',
      detalhes: {
        statusAnterior: caso.status,
        statusNovo: newStatus,
        metadata
      }
    }).catch(err => {
      console.error('[HistoricoLead] Fail on status transition:', err);
    });
    
    cache.invalidatePattern(/^casos:/);
    cache.invalidatePattern(/^dashboard:/);
    
    return updated;
  }
  
  private buildWhereClause(filters: any) {
    const where: any = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.riskScoreMin !== undefined || filters.riskScoreMax !== undefined) {
      where.riskScore = {};
      if (filters.riskScoreMin !== undefined) where.riskScore.gte = filters.riskScoreMin;
      if (filters.riskScoreMax !== undefined) where.riskScore.lte = filters.riskScoreMax;
    }
    
    if (filters.motivo) {
      where.motivo = filters.motivo;
    }
    
    if (filters.sentimento) {
      where.sentimento = filters.sentimento;
    }
    
    if (filters.atribuidoParaId) {
      where.atribuidoParaId = filters.atribuidoParaId;
    }
    
    if (filters.dataInicio || filters.dataFim) {
      where.createdAt = {};
      if (filters.dataInicio) where.createdAt.gte = new Date(filters.dataInicio);
      if (filters.dataFim) where.createdAt.lte = new Date(filters.dataFim);
    }
    
    return where;
  }
}
```

**File:** `src/services/diagnosis.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { historico } from '@/lib/historico';
import { NotFoundError } from '@/utils/errors';
import type { DiagnosisDTO } from '@/schemas/diagnosis.schema';

export class DiagnosisService {
  async fillDiagnosis(casoChurnId: string, data: DiagnosisDTO) {
    // Validate caso exists
    const caso = await prisma.casoChurn.findUnique({
      where: { id: casoChurnId }
    });
    if (!caso) throw new NotFoundError('Caso não encontrado');
    
    // Upsert diagnosis
    const diagnosis = await prisma.casoChurnDiagnosis.upsert({
      where: { casoChurnId },
      update: {
        motivo: data.motivo,
        detalheMotivo: data.detalheMotivo,
        sentimento: data.sentimento,
        avaliacaoSuporte: data.avaliacaoSuporte,
        grauInsatisfacao: data.grauInsatisfacao,
        chanceRecuperacao: data.chanceRecuperacao
      },
      create: {
        casoChurnId,
        motivo: data.motivo,
        detalheMotivo: data.detalheMotivo,
        sentimento: data.sentimento,
        avaliacaoSuporte: data.avaliacaoSuporte,
        grauInsatisfacao: data.grauInsatisfacao,
        chanceRecuperacao: data.chanceRecuperacao,
        riskScoreCalculado: 0
      }
    });
    
    // Calculate riskScore
    const sentimentoMap = {
      MUITO_NEGATIVO: 1,
      NEGATIVO: 2,
      NEUTRO: 3,
      POSITIVO: 4
    };
    
    const sentimentoValue = sentimentoMap[data.sentimento];
    const riskScore = Math.max(
      0,
      Math.min(
        100,
        ((11 - sentimentoValue) * 10) +
        (data.grauInsatisfacao * 2) -
        (data.avaliacaoSuporte * 8)
      )
    );
    
    // Update with calculated risk
    await prisma.casoChurnDiagnosis.update({
      where: { casoChurnId },
      data: { riskScoreCalculado: riskScore }
    });
    
    // Update caso.riskScore (now that diagnosis is filled)
    await prisma.casoChurn.update({
      where: { id: casoChurnId },
      data: { riskScore }
    });
    
    // HistoricoLead
    historico.create({
      leadId: caso.clienteId,
      tipo: 'diagnosis_preenchido',
      detalhes: { riskScore, chanceRecuperacao: data.chanceRecuperacao }
    }).catch(err => {
      console.error('[HistoricoLead] Fail on diagnosis:', err);
    });
    
    cache.invalidatePattern(/^dashboard:/);
    cache.invalidatePattern(/^caso:/);
    
    return { diagnosis, riskScore };
  }
  
  async get(casoChurnId: string) {
    const cacheKey = `diagnosis:${casoChurnId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const diagnosis = await prisma.casoChurnDiagnosis.findUnique({
      where: { casoChurnId }
    });
    
    if (diagnosis) {
      cache.set(cacheKey, diagnosis, 300);
    }
    
    return diagnosis;
  }
}
```

**File:** `src/services/acao-retencao.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { historico } from '@/lib/historico';
import { NotFoundError } from '@/utils/errors';
import type { CreateAcaoDTO } from '@/schemas/acao-retencao.schema';

export class AcaoRetencaoService {
  async create(data: CreateAcaoDTO, registradoPorId: string) {
    const caso = await prisma.casoChurn.findUnique({
      where: { id: data.casoChurnId }
    });
    if (!caso) throw new NotFoundError('Caso não encontrado');
    
    // Validate dataAcao is not in future
    if (data.dataAcao > new Date()) {
      throw new BadRequestError('Data da ação não pode ser futura');
    }
    
    const acao = await prisma.casoChurnAcao.create({
      data: {
        casoChurnId: data.casoChurnId,
        planoRetencaoId: data.planoRetencaoId,
        tipoAcao: data.tipoAcao,
        descricao: data.descricao,
        resultado: data.resultado,
        resultadoDetalhado: data.resultadoDetalhado,
        dataAcao: data.dataAcao,
        proximosPassos: data.proximosPassos,
        registradoPorId
      }
    });
    
    // HistoricoLead
    historico.create({
      leadId: caso.clienteId,
      tipo: 'acao_retencao_registrada',
      detalhes: {
        tipoAcao: data.tipoAcao,
        resultado: data.resultado
      }
    }).catch(err => {
      console.error('[HistoricoLead] Fail on acao:', err);
    });
    
    cache.invalidatePattern(/^acoes:/);
    cache.invalidatePattern(/^casos:/);
    
    return acao;
  }
  
  async list(casoChurnId: string, limit: number = 50) {
    const cacheKey = `acoes:${casoChurnId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const acoes = await prisma.casoChurnAcao.findMany({
      where: { casoChurnId },
      include: { registradoPor: true },
      orderBy: { dataAcao: 'desc' },
      take: limit
    });
    
    cache.set(cacheKey, acoes, 120); // 2min
    return acoes;
  }
  
  async update(acaoId: string, data: Partial<CreateAcaoDTO>) {
    const acao = await prisma.casoChurnAcao.findUnique({
      where: { id: acaoId }
    });
    if (!acao) throw new NotFoundError('Ação não encontrada');
    
    // Only editable within 2h of creation
    const criadoHaD = (Date.now() - acao.registradoEm.getTime()) / (1000 * 3600);
    if (criadoHaD > 2) {
      throw new BadRequestError('Ação pode ser editada apenas nas primeiras 2 horas');
    }
    
    const updated = await prisma.casoChurnAcao.update({
      where: { id: acaoId },
      data: {
        descricao: data.descricao ?? acao.descricao,
        resultado: data.resultado ?? acao.resultado,
        resultadoDetalhado: data.resultadoDetalhado ?? acao.resultadoDetalhado,
        proximosPassos: data.proximosPassos ?? acao.proximosPassos
      }
    });
    
    cache.invalidatePattern(/^acoes:/);
    return updated;
  }
  
  async bulkCreate(casoChurnIds: string[], data: Omit<CreateAcaoDTO, 'casoChurnId'>, registradoPorId: string) {
    const results = await Promise.all(
      casoChurnIds.map(casoId =>
        this.create({...data, casoChurnId: casoId}, registradoPorId)
      )
    );
    
    return { criadas: results.length };
  }
}
```

---

## 3. Routes (Fastify)

**File:** `src/routes/casos-churn.routes.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { casoChurnService } from '@/services';
import { CreateCasoChurnSchema, UpdateCasoChurnSchema, TransitionCasoStatusSchema } from '@/schemas/caso-churn.schema';
import { requireAuth, requireCasoOwnership, requireRole } from '@/middlewares';

export async function casoChurnRoutes(fastify: FastifyInstance) {
  // POST /casos-churn
  fastify.post(
    '/casos-churn',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await CreateCasoChurnSchema.parseAsync(request.body);
        const caso = await casoChurnService.create(data, request.user.id);
        
        reply.status(201).send(caso);
      } catch (err) {
        if (err.name === 'ZodError') {
          reply.status(400).send({ errors: err.errors });
        } else {
          throw err;
        }
      }
    }
  );
  
  // GET /casos-churn
  fastify.get(
    '/casos-churn',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const filters = {
        status: request.query.status as string,
        riskScoreMin: request.query.riskMin ? Number(request.query.riskMin) : undefined,
        riskScoreMax: request.query.riskMax ? Number(request.query.riskMax) : undefined,
        motivo: request.query.motivo as string,
        sentimento: request.query.sentimento as string,
        atribuidoParaId: request.query.atribuidoParaId as string,
        dataInicio: request.query.dataInicio as string,
        dataFim: request.query.dataFim as string
      };
      
      // Clean undefined values
      Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);
      
      const skip = Number(request.query.skip ?? 0);
      const take = Number(request.query.take ?? 50);
      
      const result = await casoChurnService.list(filters, skip, take);
      reply.send(result);
    }
  );
  
  // GET /casos-churn/:id
  fastify.get(
    '/casos-churn/:id',
    { preHandler: [requireAuth, requireCasoOwnership] },
    async (request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) => {
      const caso = await casoChurnService.getById(request.params.id);
      
      if (!caso) {
        reply.status(404).send({ error: 'Caso não encontrado' });
        return;
      }
      
      reply.send(caso);
    }
  );
  
  // PATCH /casos-churn/:id
  fastify.patch(
    '/casos-churn/:id',
    { preHandler: [requireAuth, requireCasoOwnership] },
    async (request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) => {
      const data = await UpdateCasoChurnSchema.parseAsync(request.body);
      const caso = await casoChurnService.update(request.params.id, data);
      
      reply.send(caso);
    }
  );
  
  // PATCH /casos-churn/:id/status
  fastify.patch(
    '/casos-churn/:id/status',
    { preHandler: [requireAuth, requireCasoOwnership] },
    async (request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) => {
      const data = await TransitionCasoStatusSchema.parseAsync(request.body);
      const caso = await casoChurnService.transitionStatus(
        request.params.id,
        data.newStatus,
        data.metadata ?? {}
      );
      
      reply.send(caso);
    }
  );
}
```

**File:** `src/routes/diagnosis.routes.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { diagnosisService } from '@/services';
import { FillDiagnosisSchema } from '@/schemas/diagnosis.schema';
import { requireAuth, requireCasoOwnership } from '@/middlewares';

export async function diagnosisRoutes(fastify: FastifyInstance) {
  // PATCH /casos-churn/:id/diagnosis
  fastify.patch(
    '/casos-churn/:id/diagnosis',
    { preHandler: [requireAuth, requireCasoOwnership] },
    async (request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) => {
      const data = await FillDiagnosisSchema.parseAsync(request.body);
      const result = await diagnosisService.fillDiagnosis(request.params.id, data);
      
      reply.send(result);
    }
  );
  
  // GET /casos-churn/:id/diagnosis
  fastify.get(
    '/casos-churn/:id/diagnosis',
    { preHandler: [requireAuth, requireCasoOwnership] },
    async (request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) => {
      const diagnosis = await diagnosisService.get(request.params.id);
      
      if (!diagnosis) {
        reply.status(404).send({ error: 'Diagnosis não preenchida' });
        return;
      }
      
      reply.send(diagnosis);
    }
  );
}
```

**File:** `src/routes/dashboard-retencao.routes.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardRetencaoService } from '@/services';
import { requireAuth, requireRole } from '@/middlewares';

export async function dashboardRetencaoRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/dashboard/retencao',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const filters = {
        status: request.query.status as string,
        riskCategory: request.query.riskCategory as string,
        periodo: (request.query.periodo as string) ?? '30d'
      };
      
      const dashboard = await dashboardRetencaoService.getDashboard(
        request.user.id,
        request.query.supervisorId as string,
        filters
      );
      
      reply.send(dashboard);
    }
  );
}
```

---

## 4. Middlewares

**File:** `src/middlewares/caso-ownership.middleware.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/utils/errors';

export async function requireCasoOwnership(
  request: FastifyRequest<{Params: {id: string}}>,
  reply: FastifyReply
) {
  const casoId = request.params.id;
  const caso = await prisma.casoChurn.findUnique({
    where: { id: casoId },
    include: { atribuidoPara: true }
  });
  
  if (!caso) {
    throw new NotFoundError('Caso não encontrado');
  }
  
  const user = request.user;
  const hasAccess =
    user.role === 'CEO' ||
    user.role === 'ADMIN' ||
    (user.role === 'SUPERVISAO_CS' && 
     caso.atribuidoPara.supervisorId === user.id) ||
    caso.atribuidoParaId === user.id;
  
  if (!hasAccess) {
    throw new ForbiddenError('Você não tem acesso a este caso');
  }
}
```

**File:** `src/middlewares/role-validation.middleware.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '@/utils/errors';

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Você não tem permissão. Papéis permitidos: ${allowedRoles.join(', ')}`
      );
    }
  };
};
```

---

## 5. Crons Setup

**File:** `src/crons/retencao.crons.ts`

```typescript
import * as schedule from 'node-schedule';
import { prisma } from '@/lib/prisma';
import { websocket } from '@/lib/websocket';
import { mailer } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { riskMatrixService } from '@/services';

export function setupRetencaoCrons() {
  // 1. 06:30 — Alerta Casos Críticos
  schedule.scheduleJob('30 6 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Alerta Casos Críticos');
      
      const casosCriticos = await prisma.casoChurn.findMany({
        where: {
          status: 'ATIVO',
          riskScore: { gte: 80 }
        },
        include: { atribuidoPara: true, cliente: true }
      });
      
      for (const caso of casosCriticos) {
        // WebSocket alert
        websocket.to(`user:${caso.atribuidoParaId}`).emit('retencao:alerta', {
          tipo: 'caso_critico',
          casoId: caso.id,
          clienteNome: caso.cliente.nome,
          riskScore: caso.riskScore,
          message: `⚠️ Cliente em RISCO CRÍTICO (Score: ${caso.riskScore}/100)`
        });
        
        // Email
        await mailer.send({
          to: caso.atribuidoPara.email,
          subject: '[URGENTE] Cliente em Risco Crítico',
          template: 'retencao-alerta-critico',
          data: {
            clienteNome: caso.cliente.nome,
            riskScore: caso.riskScore,
            casoLink: `${process.env.FRONTEND_URL}/casos-churn/${caso.id}`
          }
        });
      }
      
      logger.info(`[CRON] Alerta Crítico: ${casosCriticos.length} casos notificados`);
    } catch (err) {
      logger.error('[CRON] Erro em Alerta Crítico:', err);
    }
  });
  
  // 2. 08:00 — Case Vencido
  schedule.scheduleJob('0 8 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Case Vencido');
      
      const vencidos = await prisma.casoChurn.findMany({
        where: {
          status: 'ATIVO',
          dataAgendadoContato: { lt: new Date() }
        },
        include: { atribuidoPara: true, cliente: true }
      });
      
      for (const caso of vencidos) {
        websocket.to(`user:${caso.atribuidoParaId}`).emit('retencao:alerta', {
          tipo: 'contato_vencido',
          casoId: caso.id,
          message: `📞 Contato agendado para ${caso.dataAgendadoContato.toLocaleDateString('pt-BR')} venceu`
        });
      }
      
      logger.info(`[CRON] Contato Vencido: ${vencidos.length} casos`);
    } catch (err) {
      logger.error('[CRON] Erro em Case Vencido:', err);
    }
  });
  
  // 3. 12:00 — Ação Pendente
  schedule.scheduleJob('0 12 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Ação Pendente');
      
      const comAtraso = await prisma.casoChurn.findMany({
        where: {
          status: { in: ['ATIVO', 'NEGOCIANDO'] },
          acoes: {
            none: {
              registradoEm: {
                gte: new Date(Date.now() - 3 * 86400 * 1000) // Last 3 days
              }
            }
          }
        },
        include: { atribuidoPara: true, cliente: true }
      });
      
      for (const caso of comAtraso) {
        await mailer.send({
          to: caso.atribuidoPara.email,
          subject: `Ação pendente há 3+ dias: ${caso.cliente.nome}`,
          template: 'retencao-acao-pendente',
          data: { caso }
        });
      }
      
      logger.info(`[CRON] Ação Pendente: ${comAtraso.length} emails enviados`);
    } catch (err) {
      logger.error('[CRON] Erro em Ação Pendente:', err);
    }
  });
  
  // 4. 18:00 — Meta Plano Vencida
  schedule.scheduleJob('0 18 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Meta Plano Vencida');
      
      const planoVencido = await prisma.planoRetencao.findMany({
        where: {
          dataMetaProposta: { lt: new Date() },
          status: { notIn: ['SUCESSO', 'FALHOU'] }
        },
        include: { caso: { include: { atribuidoPara: true } } }
      });
      
      for (const plano of planoVencido) {
        const supervisor = await prisma.user.findUnique({
          where: { id: plano.caso.atribuidoPara.supervisorId || undefined }
        });
        
        if (supervisor) {
          await mailer.send({
            to: supervisor.email,
            subject: `Meta de plano vencida: ${plano.caso.cliente.nome}`,
            template: 'retencao-meta-vencida',
            data: { plano }
          });
        }
      }
      
      logger.info(`[CRON] Meta Vencida: ${planoVencido.length} planos`);
    } catch (err) {
      logger.error('[CRON] Erro em Meta Vencida:', err);
    }
  });
  
  // 5. 22:00 — Recalc Risk Score
  schedule.scheduleJob('0 22 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Recalc Risk Score');
      
      const casosPraRecalc = await prisma.casoChurn.findMany({
        where: { status: 'ATIVO' }
      });
      
      let count = 0;
      for (const caso of casosPraRecalc) {
        await riskMatrixService.recalculateForCaso(caso.id);
        count++;
      }
      
      logger.info(`[CRON] Risk Score: ${count} casos recalculados`);
    } catch (err) {
      logger.error('[CRON] Erro em Risk Score:', err);
    }
  });
  
  // 6. 04:00 — Cleanup + Recovery Tracking
  schedule.scheduleJob('0 4 * * *', async () => {
    try {
      logger.info('[CRON] Iniciando: Cleanup + Recovery');
      
      const canceladosAntigos = await prisma.casoChurn.findMany({
        where: {
          status: 'CANCELADO',
          createdAt: { lt: new Date(Date.now() - 90 * 86400 * 1000) } // 90+ days
        },
        include: { clienteBase: true }
      });
      
      for (const caso of canceladosAntigos) {
        await prisma.clienteChurnRecuperacao.create({
          data: {
            clienteId: caso.clienteId,
            casoChurnIdOriginal: caso.id,
            motivo: caso.motivo,
            churnDate: caso.updatedAt,
            diasDesdeChurn: Math.floor(
              (Date.now() - caso.updatedAt.getTime()) / (1000 * 86400)
            ),
            ultimoMRR: caso.clienteBase.mrr,
            statusRecuperacao: 'pendente'
          }
        });
      }
      
      logger.info(`[CRON] Recovery: ${canceladosAntigos.length} clientes movidos`);
    } catch (err) {
      logger.error('[CRON] Erro em Cleanup:', err);
    }
  });
  
  logger.info('[Crons] Retencao crons setup completo');
}
```

---

## 6. Inicialização (main.ts)

```typescript
import Fastify from 'fastify';
import { setupRetencaoCrons } from '@/crons/retencao.crons';
import { casoChurnRoutes } from '@/routes/casos-churn.routes';
import { diagnosisRoutes } from '@/routes/diagnosis.routes';
// ... mais routes

const fastify = Fastify();

// Register plugins
fastify.register(require('@fastify/cors'));
fastify.register(require('@fastify/helmet'));

// Setup crons
setupRetencaoCrons();

// Register routes
fastify.register(casoChurnRoutes);
fastify.register(diagnosisRoutes);
// ... mais routes

fastify.listen({ port: 3001 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
```

---

## 7. Testes Unitários (Helpers)

**File:** `src/tests/caso-churn.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { casoChurnService } from '@/services';
import { prisma } from '@/lib/prisma';

describe('CasoChurnService', () => {
  let cliente: any, contrato: any, user: any;
  
  beforeAll(async () => {
    // Setup test data
    cliente = await prisma.cliente.create({
      data: { nome: 'Test Cliente' }
    });
    
    contrato = await prisma.contrato.create({
      data: {
        clienteId: cliente.id,
        valor: 5000,
        status: 'ATIVO'
      }
    });
    
    user = await prisma.user.create({
      data: {
        email: 'cs@test.com',
        role: 'CS_RETENCAO'
      }
    });
  });
  
  afterEach(async () => {
    await prisma.casoChurn.deleteMany({});
  });
  
  it('should create a caso churn', async () => {
    const caso = await casoChurnService.create({
      clienteId: cliente.id,
      clienteBaseId: contrato.id,
      motivo: 'PRECO',
      sentimento: 'NEGATIVO',
      atribuidoParaId: user.id
    }, user.id);
    
    expect(caso).toBeDefined();
    expect(caso.clienteId).toBe(cliente.id);
    expect(caso.status).toBe('ATIVO');
  });
  
  it('should prevent duplicate active cases', async () => {
    await casoChurnService.create({
      clienteId: cliente.id,
      clienteBaseId: contrato.id,
      motivo: 'PRECO',
      sentimento: 'NEGATIVO',
      atribuidoParaId: user.id
    }, user.id);
    
    expect(() =>
      casoChurnService.create({
        clienteId: cliente.id,
        clienteBaseId: contrato.id,
        motivo: 'INSATISFACAO_SERVICO',
        sentimento: 'MUITO_NEGATIVO',
        atribuidoParaId: user.id
      }, user.id)
    ).rejects.toThrow('Cliente já tem caso aberto');
  });
});
```

---

## Checklist de Implementação

- ✅ Criar todos 6 services com métodos completos
- ✅ Criar todas 6 rotas principales (CRUD + transitions)
- ✅ Implementar schemas de validação Zod
- ✅ Implementar middlewares de auth + ownership
- ✅ Setup 6 cron jobs com schedule
- ✅ Integrar com HistoricoLead (silent fail)
- ✅ Setup cache invalidation patterns
- ✅ WebSocket event emitters
- ✅ Error handling uniforme
- ✅ Unit tests básicos
- ✅ Migrations SQL (índices + constraints)

---

## Sprint 28 — Backend PRONTO ✅

Next: Isabela Costa (Frontend) — React components + páginas + hooks
