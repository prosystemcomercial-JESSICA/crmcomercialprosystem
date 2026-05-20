# Sprint 28 — Step 03 — Daniel Mendes (Tech Lead)
# Churn e Retenção — Arquitetura e Schema

## Visão Geral Técnica

**Stack:** Next.js 14 App Router + Fastify + PostgreSQL + Prisma ORM + Node-Cache + TypeScript  
**Padrão:** Services (business logic) + Controllers (API endpoints) + Middleware (auth + validation)  
**Caching:** node-cache com TTL variável (2min ações, 5min casos, 10min dashboard)  
**Eventos:** HistoricoLead hooks silenciosos (`.catch(() => {})`)  
**Crons:** 6 jobs em horários específicos + offsets para distribuição

---

## Schema Prisma (Novas Tabelas)

### 1. CasoChurn (Caso de Churn Principal)

```prisma
model CasoChurn {
  id              String    @id @default(cuid())
  clienteId       String
  clienteBaseId   String    // FK Contrato (MRR + dados do cliente)
  
  motivo          CasoChurnMotivo
  sentimento      Sentimento
  descricao       String?   @db.Text
  
  atribuidoParaId String    // FK User (CS_RETENCAO ou SUPERVISAO_CS)
  criadoPorId     String    // FK User
  
  riskScore       Float     @default(0)  // Calculado automaticamente
  status          CasoChurnStatus @default(ATIVO)
  
  dataAlertaGerado DateTime  @default(now())
  dataAgendadoContato DateTime?  // Próximo contato planejado
  novoContratoId  String?   // FK Contrato (se REATIVADO)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  cliente         Cliente   @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  clienteBase     Contrato  @relation("contrato_origem", fields: [clienteBaseId], references: [id], onDelete: Restrict)
  novoContrato    Contrato? @relation("contrato_reativacao", fields: [novoContratoId], references: [id], onDelete: SetNull)
  atribuidoPara   User      @relation("caso_atribuido", fields: [atribuidoParaId], references: [id])
  criadoPor       User      @relation("caso_criado", fields: [criadoPorId], references: [id])
  
  diagnosis       CasoChurnDiagnosis?
  planos          PlanoRetencao[]
  acoes           CasoChurnAcao[]
  riskCache       RiskMatrixCache[]
  
  @@index([clienteId])
  @@index([status])
  @@index([riskScore])
  @@index([atribuidoParaId])
  @@index([createdAt])
}

enum CasoChurnMotivo {
  INSATISFACAO_SERVICO
  MAL_USO_PRODUTO
  MIGRACAO_CONCORRENCIA
  PRECO
  FALTA_SUPORTE
  INTEGRACAO_PROBLEMAS
  VOLUME_BAIXO
  PERSONALIZACAO_INSUFICIENTE
  PERFORMANCE_LENTA
  OUTROS
}

enum CasoChurnStatus {
  ATIVO
  REMARCADO
  NEGOCIANDO
  CANCELADO
  REATIVADO
  FECHADO
}

enum Sentimento {
  MUITO_NEGATIVO
  NEGATIVO
  NEUTRO
  POSITIVO
}
```

### 2. CasoChurnDiagnosis (Diagnóstico Preenchido)

```prisma
model CasoChurnDiagnosis {
  id              String    @id @default(cuid())
  casoChurnId     String    @unique
  
  motivo          CasoChurnMotivo
  detalheMotivo   String    @db.Text
  sentimento      Sentimento
  
  avaliacaoSuporte Int      // 1-5
  grauInsatisfacao Int      // 1-10
  chanceRecuperacao ChanceRecuperacao
  
  riskScoreCalculado Float
  
  preenchedoEm    DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  
  @@index([casoChurnId])
}

enum ChanceRecuperacao {
  MUITO_BAIXA     // 0-20%
  BAIXA           // 20-40%
  MEDIA           // 40-60%
  ALTA            // 60-80%
  MUITO_ALTA      // 80-100%
}
```

### 3. PlanoRetencao (Plano de Retenção)

```prisma
model PlanoRetencao {
  id              String    @id @default(cuid())
  casoChurnId     String
  
  estrategia      Estrategia
  descricaoEstrategia String @db.Text
  setoresEnvolvidos String[]  // JSON array: ["CS", "TECH", "FINANCEIRO"]
  
  status          PlanoStatus @default(ATIVO)
  
  dataLancamento  DateTime
  dataMetaProposta DateTime?
  
  criadoPorId     String
  criadoEm        DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  criadoPor       User      @relation(fields: [criadoPorId], references: [id])
  acoes           CasoChurnAcao[]
  
  @@index([casoChurnId])
  @@index([status])
}

enum Estrategia {
  DESCONTO_PRECO
  FEATURE_CUSTOMIZADA
  SUPORTE_DEDICADO
  TREINAMENTO_INTENSIVO
  UPGRADE_PLANO
  REVISAR_INTEGRACAO
  EXECUTIVO_BUSINESS_REVIEW
  DESCONTO_TEMPORAL_PROMOTION
}

enum PlanoStatus {
  ATIVO
  PAUSADO
  EXECUTANDO
  SUCESSO
  FALHOU
}
```

### 4. CasoChurnAcao (Ação de Retenção Registrada)

```prisma
model CasoChurnAcao {
  id              String    @id @default(cuid())
  casoChurnId     String
  planoRetencaoId String?
  
  tipoAcao        TipoAcao
  descricao       String    @db.Text
  resultado       Resultado enum
  resultadoDetalhado String? @db.Text
  
  dataAcao        DateTime  @default(now())
  proximosPassos  String?   @db.Text
  
  registradoPorId String
  registradoEm    DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  plano           PlanoRetencao? @relation(fields: [planoRetencaoId], references: [id], onDelete: SetNull)
  registradoPor   User      @relation(fields: [registradoPorId], references: [id])
  
  @@index([casoChurnId])
  @@index([tipoAcao])
  @@index([dataAcao])
}

enum TipoAcao {
  CONTATO_TELEFONICO
  REUNIAO_EXECUTIVO
  ENVIO_PROPOSTA
  DESCONTO_OFERECIDO
  FEATURE_CUSTOMIZADA_DESENVOLVIDA
  TREINAMENTO_REALIZADO
  REVISAO_INTEGRACAO
  ESCALACAO_DIRETORIA
}

enum Resultado {
  POSITIVO
  NEGATIVO
  INDETERMINADO
}
```

### 5. RiskMatrixCache (Cache do Risk Score)

```prisma
model RiskMatrixCache {
  id              String    @id @default(cuid())
  casoChurnId     String
  
  d1_diagnosis    Float     // Weight 40%
  d2_revenue      Float     // Weight 25%
  d3_maturity     Float     // Weight 15%
  d4_usage        Float     // Weight 15%
  d5_support      Float     // Weight 5%
  
  riskScoreTotal  Float
  calculadoEm     DateTime  @default(now())
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  
  @@index([casoChurnId])
  @@index([calculadoEm])
}
```

### 6. ClienteChurnRecuperacao (Rastreamento de Clientes Perdidos)

```prisma
model ClienteChurnRecuperacao {
  id              String    @id @default(cuid())
  clienteId       String
  casoChurnIdOriginal String  // Referência ao caso que gerou o churn
  
  motivo          CasoChurnMotivo
  churnDate       DateTime
  diasDesdeChurn  Int       // Calculado: today() - churnDate
  ultimoMRR       Float
  
  melhorHorarioContato String?  // "manha", "tarde", "noite"
  ultimoContato   DateTime?
  statusRecuperacao String @default("pendente")  // pendente | contatado | reativado | descartado
  
  criadoEm        DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  cliente         Cliente   @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  
  @@index([clienteId])
  @@index([churnDate])
  @@index([statusRecuperacao])
}
```

---

## Migrations SQL (Manuals)

### M1. Criar tabelas principais
```sql
-- CasoChurn table (automático via Prisma)
-- Índices já na schema

-- Índice parcial: casos ATIVO apenas
CREATE INDEX idx_caso_churn_ativo ON "CasoChurn"(status) 
WHERE status = 'ATIVO';

-- Índice composto: lista filtrada por status + risk + data
CREATE INDEX idx_caso_churn_list ON "CasoChurn"(status, "riskScore" DESC, "createdAt" DESC);
```

### M2. Foreign keys + cascades
```sql
-- Já definido em schema Prisma com onDelete/onUpdate rules
-- Fastify validates via middleware antes de DELETE
```

### M3. Enum types PostgreSQL
```sql
-- Prisma auto-cria enums, mas pode-se verificar:
-- \dT+ -- lista todos tipos customizados
```

---

## Services (6 principais)

### 1. CasoChurnService

**Location:** `src/services/caso-churn.service.ts`

```typescript
export class CasoChurnService {
  // CREATE
  async create(data: CreateCasoChurnDTO): Promise<CasoChurn> {
    // Validar: cliente não tem caso ATIVO já
    const existing = await prisma.casoChurn.findFirst({
      where: {
        clienteId: data.clienteId,
        status: 'ATIVO'
      }
    });
    if (existing) throw new ConflictError('Cliente já tem caso aberto');
    
    // Criar caso
    const caso = await prisma.casoChurn.create({
      data: {
        clienteId: data.clienteId,
        clienteBaseId: data.clienteBaseId,
        motivo: data.motivo,
        sentimento: data.sentimento,
        atribuidoParaId: data.atribuidoParaId,
        criadoPorId: data.criadoPorId,
        descricao: data.descricao,
        dataAlertaGerado: new Date(),
        riskScore: 0  // Será calculado ao preencher diagnosis
      }
    });
    
    // Hook: HistoricoLead
    await historico.create({
      leadId: data.clienteId,
      tipo: 'caso_churn_aberto',
      detalhes: { motivoChurn: data.motivo }
    }).catch(() => {}); // Silent fail
    
    return caso;
  }
  
  // READ
  async getById(id: string): Promise<CasoChurn | null> {
    return await prisma.casoChurn.findUnique({ where: { id } });
  }
  
  async list(filters: CasoChurnFilters, skip: number, take: number) {
    // Filters: status, riskScore range, motivo, sentimento, atribuidoParaId, dateRange
    const where = this.buildWhereClause(filters);
    
    // Cache hit check
    const cacheKey = `casos:${JSON.stringify({filters, skip, take})}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const [casos, total] = await Promise.all([
      prisma.casoChurn.findMany({
        where,
        skip,
        take,
        orderBy: [
          { riskScore: 'desc' },
          { createdAt: 'asc' }
        ]
      }),
      prisma.casoChurn.count({ where })
    ]);
    
    const result = { casos, total };
    cache.set(cacheKey, result, 300); // 5min
    return result;
  }
  
  // UPDATE
  async update(id: string, data: UpdateCasoChurnDTO): Promise<CasoChurn> {
    const caso = await prisma.casoChurn.update({
      where: { id },
      data: {
        motivo: data.motivo,
        sentimento: data.sentimento,
        descricao: data.descricao,
        atribuidoParaId: data.atribuidoParaId,
        dataAgendadoContato: data.dataAgendadoContato
      }
    });
    
    // Invalidate cache
    cache.del(/^casos:/);
    
    return caso;
  }
  
  // STATUS TRANSITIONS
  async transitionStatus(
    id: string, 
    newStatus: CasoChurnStatus, 
    metadata: Record<string, any>
  ): Promise<CasoChurn> {
    const caso = await this.getById(id);
    if (!caso) throw new NotFoundError('Caso não encontrado');
    
    // Validar transição
    const validTransitions: Record<CasoChurnStatus, CasoChurnStatus[]> = {
      ATIVO: ['REMARCADO', 'NEGOCIANDO', 'CANCELADO', 'REATIVADO'],
      REMARCADO: ['ATIVO', 'NEGOCIANDO', 'CANCELADO', 'REATIVADO'],
      NEGOCIANDO: ['REMARCADO', 'CANCELADO', 'REATIVADO', 'FECHADO'],
      CANCELADO: ['REATIVADO', 'FECHADO'],  // recovery path
      REATIVADO: ['FECHADO'],
      FECHADO: []
    };
    
    if (!validTransitions[caso.status]?.includes(newStatus)) {
      throw new BadRequestError(`Transição inválida: ${caso.status} → ${newStatus}`);
    }
    
    // Handle metadata por novo status
    let updateData = { status: newStatus };
    
    if (newStatus === 'REMARCADO') {
      updateData.dataAgendadoContato = metadata.dataContato;
    } else if (newStatus === 'REATIVADO') {
      updateData.novoContratoId = metadata.novoContratoId;
    }
    // ... mais lógica por status
    
    const updated = await prisma.casoChurn.update({
      where: { id },
      data: updateData
    });
    
    // HistoricoLead com tipo específico
    await historico.create({
      leadId: caso.clienteId,
      tipo: `caso_status_mudou_${caso.status}_para_${newStatus}`,
      detalhes: metadata
    }).catch(() => {});
    
    cache.del(/^casos:/);
    return updated;
  }
}
```

### 2. DiagnosisService

```typescript
export class DiagnosisService {
  async fillDiagnosis(casoChurnId: string, data: DiagnosisDTO): Promise<{diagnosis, riskScore}> {
    // Criar ou atualizar diagnosis
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
        riskScoreCalculado: 0  // Will be calculated below
      }
    });
    
    // Calculate riskScore = (11 - sentimento) × 10 + (grauInsatisfacao × 2) - (avaliacaoSuporte × 8)
    const sentimentoMap = { MUITO_NEGATIVO: 1, NEGATIVO: 2, NEUTRO: 3, POSITIVO: 4 };
    const sentimentoValue = sentimentoMap[data.sentimento];
    
    const riskScore = Math.max(0, Math.min(100,
      ((11 - sentimentoValue) * 10) +
      (data.grauInsatisfacao * 2) -
      (data.avaliacaoSuporte * 8)
    ));
    
    // Update diagnosis + caso with riskScore
    await prisma.casoChurnDiagnosis.update({
      where: { casoChurnId },
      data: { riskScoreCalculado: riskScore }
    });
    
    await prisma.casoChurn.update({
      where: { id: casoChurnId },
      data: { riskScore }
    });
    
    // HistoricoLead
    await historico.create({
      leadId: (await prisma.casoChurn.findUnique({where: {id: casoChurnId}})).clienteId,
      tipo: 'diagnosis_preenchido',
      detalhes: { riskScore }
    }).catch(() => {});
    
    cache.del(/^dashboard:dia:/);  // Invalidate dashboard
    
    return { diagnosis, riskScore };
  }
  
  async get(casoChurnId: string) {
    return await prisma.casoChurnDiagnosis.findUnique({
      where: { casoChurnId }
    });
  }
}
```

### 3. RiskMatrixService

```typescript
export class RiskMatrixService {
  // Cron-triggered ou on-demand recalculation
  async recalculateForCaso(casoChurnId: string): Promise<RiskMatrixCache> {
    const caso = await prisma.casoChurn.findUnique({
      where: { id: casoChurnId },
      include: { clienteBase: true, cliente: true }
    });
    
    // D1: Diagnosis riskScore (40%)
    const diagnosis = await prisma.casoChurnDiagnosis.findUnique({
      where: { casoChurnId }
    });
    const d1 = diagnosis?.riskScoreCalculado ?? 0;
    
    // D2: Revenue Health (25%)
    const mrr = caso.clienteBase?.mrr ?? 0;
    const d2 = mrr >= 100000 ? 10 : mrr >= 50000 ? 25 : mrr >= 10000 ? 40 : 60;
    
    // D3: Contract Maturity (15%) — dias desde first_contrato
    const diasSinceContract = Math.floor(
      (Date.now() - caso.clienteBase.createdAt.getTime()) / (1000 * 86400)
    );
    const d3 = diasSinceContract < 90 ? 60 : diasSinceContract < 365 ? 40 : diasSinceContract < 730 ? 25 : 10;
    
    // D4: Usage Health (15%) — logins últimos 30d (requer tabela de login_audit)
    // Placeholder: TODO integrar com sistema de audit
    const d4 = 40; // Default moderate risk
    
    // D5: Support Load (5%) — tickets suporte últimos 90d
    const ticketsRecentes = 0; // TODO: query support system
    const d5 = ticketsRecentes >= 10 ? 70 : ticketsRecentes >= 5 ? 40 : ticketsRecentes >= 1 ? 20 : 5;
    
    // Weighted sum
    const riskScoreTotal = (
      (d1 * 0.4) +
      (d2 * 0.25) +
      (d3 * 0.15) +
      (d4 * 0.15) +
      (d5 * 0.05)
    );
    
    // Store in cache table
    const cache = await prisma.riskMatrixCache.create({
      data: {
        casoChurnId,
        d1_diagnosis: d1,
        d2_revenue: d2,
        d3_maturity: d3,
        d4_usage: d4,
        d5_support: d5,
        riskScoreTotal: Math.min(100, riskScoreTotal)
      }
    });
    
    // Update CasoChurn.riskScore
    await prisma.casoChurn.update({
      where: { id: casoChurnId },
      data: { riskScore: cache.riskScoreTotal }
    });
    
    // Se riskScore subiu 20+, emit alert
    const previousCache = await prisma.riskMatrixCache.findFirst({
      where: { casoChurnId },
      orderBy: { calculadoEm: 'desc' },
      skip: 1  // Skip the one we just created
    });
    
    if (previousCache && (cache.riskScoreTotal - previousCache.riskScoreTotal >= 20)) {
      // Emit WebSocket alert
      websocket.to(`user:${caso.atribuidoParaId}`).emit('retencao:risk-mudou', {
        casoChurnId,
        riskScorePrevio: previousCache.riskScoreTotal,
        riskScoreNovo: cache.riskScoreTotal,
        motivo: `Risk aumentou ${cache.riskScoreTotal - previousCache.riskScoreTotal}%`
      });
    }
    
    return cache;
  }
  
  async getHistorico(casoChurnId: string, ultimos: number = 7) {
    return await prisma.riskMatrixCache.findMany({
      where: { casoChurnId },
      orderBy: { calculadoEm: 'desc' },
      take: ultimos
    });
  }
}
```

### 4. PlanoRetencaoService

```typescript
export class PlanoRetencaoService {
  async create(casoChurnId: string, data: CreatePlanoDTO, userId: string) {
    // Validar: pode ter só 1 plano ATIVO por caso
    const activeCount = await prisma.planoRetencao.count({
      where: { casoChurnId, status: 'ATIVO' }
    });
    if (activeCount > 0) {
      throw new ConflictError('Caso já tem plano ativo');
    }
    
    const plano = await prisma.planoRetencao.create({
      data: {
        casoChurnId,
        estrategia: data.estrategia,
        descricaoEstrategia: data.descricaoEstrategia,
        setoresEnvolvidos: data.setoresEnvolvidos,
        dataLancamento: data.dataLancamento,
        dataMetaProposta: data.dataMetaProposta,
        criadoPorId: userId,
        status: 'ATIVO'
      }
    });
    
    // HistoricoLead
    const caso = await prisma.casoChurn.findUnique({where: {id: casoChurnId}});
    await historico.create({
      leadId: caso.clienteId,
      tipo: 'plano_retencao_criado',
      detalhes: { estrategia: data.estrategia }
    }).catch(() => {});
    
    return plano;
  }
  
  async transitionStatus(planoId: string, newStatus: PlanoStatus, metadata?: Record<string, any>) {
    // Similar validation as CasoChurn
    const plano = await prisma.planoRetencao.findUnique({where: {id: planoId}});
    
    let updateData = { status: newStatus };
    // Handle metadata per status...
    
    return await prisma.planoRetencao.update({
      where: { id: planoId },
      data: updateData
    });
  }
  
  async list(casoChurnId: string) {
    return await prisma.planoRetencao.findMany({
      where: { casoChurnId },
      include: { acoes: true },
      orderBy: { criadoEm: 'desc' }
    });
  }
}
```

### 5. AcaoRetencaoService

```typescript
export class AcaoRetencaoService {
  async create(casoChurnId: string, data: CreateAcaoDTO, userId: string) {
    const acao = await prisma.casoChurnAcao.create({
      data: {
        casoChurnId,
        planoRetencaoId: data.planoRetencaoId,
        tipoAcao: data.tipoAcao,
        descricao: data.descricao,
        resultado: data.resultado,
        resultadoDetalhado: data.resultadoDetalhado,
        dataAcao: data.dataAcao || new Date(),
        proximosPassos: data.proximosPassos,
        registradoPorId: userId
      }
    });
    
    // HistoricoLead
    const caso = await prisma.casoChurn.findUnique({where: {id: casoChurnId}});
    await historico.create({
      leadId: caso.clienteId,
      tipo: 'acao_retencao_registrada',
      detalhes: { tipoAcao: data.tipoAcao, resultado: data.resultado }
    }).catch(() => {});
    
    cache.del(/^casos:/);
    return acao;
  }
  
  async list(casoChurnId: string, limit: number = 50) {
    const cacheKey = `acoes:${casoChurnId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const acoes = await prisma.casoChurnAcao.findMany({
      where: { casoChurnId },
      orderBy: { dataAcao: 'desc' },
      take: limit
    });
    
    cache.set(cacheKey, acoes, 120); // 2min
    return acoes;
  }
  
  async bulkCreate(casoChurnIds: string[], data: CreateAcaoDTO, userId: string) {
    // Parallel create for multiple cases
    const acoes = await Promise.all(
      casoChurnIds.map(casoId => this.create(casoId, data, userId))
    );
    return { criadas: acoes.length };
  }
}
```

### 6. DashboardRetencaoService

```typescript
export class DashboardRetencaoService {
  async getDashboard(userId: string, supervisorId?: string, filters?: DashboardFilters) {
    // Determine scope based on role
    const role = await this.getUserRole(userId);
    const casoFilter = this.getAccessFilter(role, userId, supervisorId);
    
    // Cache key
    const cacheKey = `dashboard:retencao:${userId}:${supervisorId}:${JSON.stringify(filters)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    // KPIs (calculated, not stored)
    const [
      clientesEmRisco,
      clientesRecuperados,
      clientesPerdidos,
      casosAtivoTotal
    ] = await Promise.all([
      prisma.casoChurn.count({
        where: {
          ...casoFilter,
          status: 'ATIVO',
          dataFinal: { gt: new Date() }
        }
      }),
      prisma.casoChurn.count({
        where: {
          ...casoFilter,
          status: 'REATIVADO',
          createdAt: { gte: this.startOfMonth() }
        }
      }),
      prisma.casoChurn.count({
        where: {
          ...casoFilter,
          status: { in: ['CANCELADO', 'CHURNED'] },
          createdAt: { gte: this.lastDays(30) }
        }
      }),
      prisma.casoChurn.count({where: casoFilter})
    ]);
    
    const taxaSucessoRetenção = casosAtivoTotal > 0 
      ? ((clientesRecuperados / casosAtivoTotal) * 100).toFixed(1)
      : 0;
    
    // Revenue at risk
    const revenueEmRisco = await prisma.clienteBaseContrato.aggregate({
      where: { cliente: { casoChurn: {...casoFilter, status: 'ATIVO'} } },
      _sum: { mrr: true }
    });
    
    // 4 gráficos: LineChart, BarChart, PieChart, BarChartHorizontal
    const [
      taxaSucessoTrend,  // Last 90 days daily
      motivosTopo5,      // Top 5 motivos
      statusDist,        // Status distribution
      topClientesRisk    // Top 10 by revenue
    ] = await Promise.all([
      this.getTaxaSuccessTrend(casoFilter, 90),
      this.getMotivosTopo(casoFilter, 5),
      this.getStatusDistribution(casoFilter),
      this.getTopClientesByRisk(casoFilter, 10)
    ]);
    
    const result = {
      kpis: {
        clientesEmRisco,
        clientesRecuperados,
        clientesPerdidos,
        taxaSucessoRetenção,
        revenueEmRisco: revenueEmRisco._sum.mrr ?? 0
      },
      graficos: {
        taxaSucessoTrend,
        motivosTopo5,
        statusDist,
        topClientesRisk
      }
    };
    
    cache.set(cacheKey, result, 600); // 10min
    return result;
  }
  
  private getAccessFilter(role: string, userId: string, supervisorId?: string) {
    if (role === 'CEO' || role === 'ADMIN') return {};
    if (role === 'SUPERVISAO_CS') {
      // See all CS under supervisor
      return { atribuidoPara: { supervisorId: supervisorId || userId } };
    }
    // CS_RETENCAO: see only own cases
    return { atribuidoParaId: userId };
  }
  
  // ... helper methods for trends, graphs, etc.
}
```

---

## API Routes (20+ Fastify)

| Método | Rota | Service | Cache | Middleware |
|--------|------|---------|-------|-----------|
| POST | /casos-churn | CasoChurnService.create | ❌ | auth, validateDTO |
| GET | /casos-churn | CasoChurnService.list | ✅ 5min | auth, parseFilters |
| GET | /casos-churn/:id | CasoChurnService.getById | ✅ 5min | auth, checkOwnership |
| PATCH | /casos-churn/:id | CasoChurnService.update | ❌ | auth, checkOwnership |
| PATCH | /casos-churn/:id/status | CasoChurnService.transitionStatus | ❌ | auth, validateStatus |
| PATCH | /casos-churn/:id/diagnosis | DiagnosisService.fillDiagnosis | ❌ | auth |
| GET | /casos-churn/:id/diagnosis | DiagnosisService.get | ✅ 5min | auth |
| GET | /casos-churn/:id/risk-matrix | RiskMatrixService.getHistorico | ✅ 10min | auth |
| POST | /planos-retencao | PlanoRetencaoService.create | ❌ | auth, validateDTO |
| GET | /planos-retencao | PlanoRetencaoService.list | ✅ 5min | auth, parseFilters |
| PATCH | /planos-retencao/:id | PlanoRetencaoService.update | ❌ | auth, checkOwnership |
| PATCH | /planos-retencao/:id/status | PlanoRetencaoService.transitionStatus | ❌ | auth |
| POST | /casos-churn/:id/acoes | AcaoRetencaoService.create | ❌ | auth |
| GET | /casos-churn/:id/acoes | AcaoRetencaoService.list | ✅ 2min | auth |
| PATCH | /casos-churn/:id/acoes/:acaoId | AcaoRetencaoService.update | ❌ | auth |
| PATCH | /casos-churn/bulk-acoes | AcaoRetencaoService.bulkCreate | ❌ | auth, requireRole |
| GET | /dashboard/retencao | DashboardRetencaoService.getDashboard | ✅ 10min | auth, parseFilters |
| GET | /relatorios/churn | RelatorioService.generate | ✅ 30min | auth, requireRole |
| POST | /clientes-churned/:clienteId/reativar | CasoChurnService.reativar | ❌ | auth |
| GET | /clientes-churned | ClienteChurnService.list | ✅ 10min | auth |

---

## Cron Jobs (6 total)

### Cron 1: 06:30 — Alerta Casos Críticos
```typescript
schedule.scheduleJob('30 6 * * *', async () => {
  const casosCriticos = await prisma.casoChurn.findMany({
    where: {
      status: 'ATIVO',
      riskScore: { gte: 80 }
    },
    include: { atribuidoPara: true }
  });
  
  for (const caso of casosCriticos) {
    // Send toast + email to CS
    websocket.to(`user:${caso.atribuidoParaId}`).emit('retencao:alerta', {
      tipo: 'caso_critico',
      message: `Cliente ${caso.clienteId} em RISCO CRÍTICO (${caso.riskScore})`
    });
    
    // Send email
    mailer.send({
      to: caso.atribuidoPara.email,
      subject: `[URGENTE] Cliente em Risco Crítico`,
      text: `Risk Score: ${caso.riskScore}/100`
    });
  }
});
```

### Cron 2: 08:00 — Case Vencido
```typescript
schedule.scheduleJob('0 8 * * *', async () => {
  const vencidos = await prisma.casoChurn.findMany({
    where: {
      status: 'ATIVO',
      dataAgendadoContato: { lt: new Date() }  // Past date
    }
  });
  
  // Alert CS: reschedule or escalate
  for (const caso of vencidos) {
    websocket.to(`user:${caso.atribuidoParaId}`).emit('retencao:alerta', {
      tipo: 'contato_vencido',
      casoId: caso.id
    });
  }
});
```

### Cron 3: 12:00 — Ação Pendente (3+ dias)
```typescript
schedule.scheduleJob('0 12 * * *', async () => {
  const comAtraso = await prisma.casoChurn.findMany({
    where: {
      status: { in: ['ATIVO', 'NEGOCIANDO'] },
      acoes: {
        none: {
          registradoEm: { gte: this.daysAgo(3) }
        }
      }
    }
  });
  
  for (const caso of comAtraso) {
    // Email: "Ação pendente há 3+ dias"
  }
});
```

### Cron 4: 18:00 — Meta Plano Vencida
```typescript
schedule.scheduleJob('0 18 * * *', async () => {
  const planoVencido = await prisma.planoRetencao.findMany({
    where: {
      dataMetaProposta: { lt: new Date() },
      status: { notIn: ['SUCESSO', 'FALHOU'] }
    }
  });
  
  // Supervisor alert
});
```

### Cron 5: 22:00 — Recalc Risk Score
```typescript
schedule.scheduleJob('0 22 * * *', async () => {
  const casosPraRecalc = await prisma.casoChurn.findMany({
    where: { status: 'ATIVO' }
  });
  
  for (const caso of casosPraRecalc) {
    await riskMatrixService.recalculateForCaso(caso.id);
  }
});
```

### Cron 6: 04:00 — Cleanup + Recovery Tracking
```typescript
schedule.scheduleJob('0 4 * * *', async () => {
  // Move CANCELADO cases older than 90d to ClienteChurnRecuperacao
  const canceladosAntigos = await prisma.casoChurn.findMany({
    where: {
      status: 'CANCELADO',
      createdAt: { lt: this.daysAgo(90) }
    }
  });
  
  for (const caso of canceladosAntigos) {
    await prisma.clienteChurnRecuperacao.create({
      data: {
        clienteId: caso.clienteId,
        casoChurnIdOriginal: caso.id,
        motivo: caso.motivo,
        churnDate: caso.updatedAt,
        ultimoMRR: 0  // Fetch from contrato
      }
    });
  }
});
```

---

## Middleware & Authorization

### 1. Require Role Middleware
```typescript
export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!roles.includes(user.role)) {
      reply.status(403).send({ error: 'Forbidden' });
    }
  };
};
```

### 2. Caso Ownership Middleware
```typescript
export const checkCasoOwnership = async (request, reply) => {
  const casoId = request.params.id;
  const caso = await prisma.casoChurn.findUnique({where: {id: casoId}});
  
  if (!caso) {
    reply.status(404).send({error: 'Não encontrado'});
    return;
  }
  
  const user = request.user;
  const canAccess = user.role === 'CEO' ||
                   user.role === 'ADMIN' ||
                   (user.role === 'SUPERVISAO_CS' && caso.atribuidoPara.supervisorId === user.id) ||
                   (user.id === caso.atribuidoParaId);
  
  if (!canAccess) {
    reply.status(403).send({error: 'Acesso negado'});
  }
};
```

### 3. DTO Validation
```typescript
export const validateCreateCaso = (schema) => {
  return async (request, reply) => {
    try {
      request.body = await schema.validate(request.body);
    } catch (err) {
      reply.status(400).send({errors: err.errors});
    }
  };
};
```

---

## Error Handling Patterns

```typescript
// Base errors
class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, msg);
  }
}

class NotFoundError extends AppError {
  constructor(msg: string) {
    super(404, msg);
  }
}

// Error handler in Fastify
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({error: error.message});
  } else {
    logger.error(error);
    reply.status(500).send({error: 'Internal Server Error'});
  }
});
```

---

## Cache Strategy

**node-cache config:**
```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 600,  // 10min default
  checkperiod: 60,  // cleanup every 60s
  useClones: false
});

// Pattern-based invalidation helper
cache.del = (pattern) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      cache.del(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      cache.del(key);
    }
  });
};
```

**Cache Invalidation on Mutations:**
- POST /casos-churn → `cache.del(/^casos:/)` + `cache.del(/^dashboard:/)`
- PATCH /casos-churn/:id → `cache.del(/^casos:/)` + `cache.del(/^dashboard:/)`
- POST /planos-retencao → `cache.del(/^planos:/)` + `cache.del(/^dashboard:/)`
- POST /acoes → `cache.del(/^acoes:/)` + `cache.del(/^casos:/)`

---

## WebSocket Events

```typescript
// Server-side emits
websocket.to(`user:${userId}`).emit('retencao:alerta', {
  tipo: 'caso_critico' | 'contato_vencido' | 'risk_mudou',
  casoId: string,
  message: string,
  actionLink?: string
});

websocket.to(`user:${userId}`).emit('retencao:caso-criado', {
  casoId: string,
  clienteNome: string,
  riskScore: number
});
```

---

## Testing & Integration Points

**Dependencies:**
- Prisma ORM (Cliente, Contrato, User, HistoricoLead já existem)
- HistoricoLead hooks (já funcionam em outros módulos)
- Google Calendar (opcional em US-2805 Plano pode ter event relacionado)
- Support system (para D5 risk score — TODO integração)

**Known TODOs:**
- Integrar com sistema de login audit para D4 (usage health)
- Integrar com sistema de suporte para D5 (ticket count)
- Implementar endpoint de recuperação (reativar cliente)
- Webhook externo para Slack/Teams

---

## Sprint 28 — Tech Lead PRONTO ✅

Next: Felipe Santos (Backend) — implementação de services + rotas Fastify
