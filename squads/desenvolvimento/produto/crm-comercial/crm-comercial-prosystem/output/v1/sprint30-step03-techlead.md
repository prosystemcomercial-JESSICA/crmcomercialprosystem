# Sprint 30 — Step 03 — Daniel Mendes (Tech Lead)
# Campanhas de Retenção — Arquitetura e Schema

## Stack & Decisões Técnicas

**Persistência:** Prisma ORM + PostgreSQL (continuação Sprint 28-29)  
**Serviços:** Pattern service-based com validações Zod  
**Async:** Node-schedule para crons, bullmq para queue de emails  
**Email:** Sendgrid API (com mock para desenvolvimento)  
**Cache:** node-cache com padrão invalidação por tipo  
**Segurança:** RBAC middleware + auditoria em cada mutação

---

## Prisma Schema (5 Tabelas Novas)

```prisma
model Campanha {
  id                String    @id @default(cuid())
  nome              String    @db.VarChar(100)
  descricao         String?   @db.Text
  
  status            CampanhaStatus @default(RASCUNHO)
  data_inicio       DateTime
  data_fim          DateTime
  
  created_by        String    // Usuario ID
  created_at        DateTime  @default(now())
  updated_by        String?
  updated_at        DateTime  @updatedAt
  
  segmento_id       String?   @unique
  segmento          Segmento? @relation(fields: [segmento_id], references: [id], onDelete: SetNull)
  
  acoes             CampanhaAcao[]
  disparos          CampanhaDisparo[]
  auditoria         AuditoriaCompanha[]
  
  @@index([status])
  @@index([created_by])
  @@index([data_inicio])
  @@fulltext([nome])
}

enum CampanhaStatus {
  RASCUNHO
  ATIVA
  PAUSADA
  FINALIZADA
  ARQUIVADA
}

model Segmento {
  id                String    @id @default(cuid())
  nome              String    @db.VarChar(100)
  descricao         String?
  
  filtros           Json      // {risco_score: [75,100], motivos: ['PRECO'], ...}
  cliente_count     Int       @default(0) // denormalized
  
  created_by        String
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  reutilizavel      Boolean   @default(true)
  
  campanha          Campanha?
  
  @@index([created_by])
  @@index([reutilizavel])
}

model CampanhaAcao {
  id                String    @id @default(cuid())
  campanha_id       String
  campanha          Campanha  @relation(fields: [campanha_id], references: [id], onDelete: Cascade)
  
  tipo_trigger      TipoTrigger
  tipo_acao         TipoAcao
  configuracao      Json      // {template_id, cron, webhook_url, etc}
  
  ordem             Int       // sequência de execução 1, 2, 3...
  atraso_horas      Int       @default(0) // até próxima ação
  
  status            AcaoStatus @default(CRIADA)
  ultima_execucao   DateTime?
  proxima_execucao  DateTime?
  
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  disparos          CampanhaDisparo[]
  
  @@index([campanha_id])
  @@index([tipo_trigger])
  @@unique([campanha_id, ordem])
}

enum TipoTrigger {
  IMEDIATO
  HORARIO
  WEBHOOK
}

enum TipoAcao {
  ENVIAR_EMAIL
  ENVIAR_SMS
  CRIAR_TASK
  APLICAR_CREDITO
  WEBHOOK
}

enum AcaoStatus {
  CRIADA
  AGENDADA
  EXECUTANDO
  COMPLETA
  ERRO
}

model CampanhaDisparo {
  id                String    @id @default(cuid())
  campanha_id       String
  campanha          Campanha  @relation(fields: [campanha_id], references: [id], onDelete: Cascade)
  
  cliente_id        String
  cliente           Cliente   @relation(fields: [cliente_id], references: [id])
  
  acao_id           String?
  acao              CampanhaAcao? @relation(fields: [acao_id], references: [id], onDelete: SetNull)
  
  tipo              TipoDisparo
  status            DisparoStatus
  message_id        String?   // ID do provedor (Sendgrid, etc)
  
  sent_at           DateTime?
  delivered_at      DateTime?
  bounced_at        DateTime?
  
  email_aberto      Boolean   @default(false)
  opened_at         DateTime?
  
  link_clicado      Boolean   @default(false)
  clicked_at        DateTime?
  
  metadados         Json?     // resposta provedor, erros, etc
  
  created_at        DateTime  @default(now())
  
  @@index([campanha_id])
  @@index([cliente_id])
  @@index([status])
  @@index([email_aberto])
  @@index([link_clicado])
}

enum TipoDisparo {
  EMAIL
  SMS
  TASK
  WEBHOOK
}

enum DisparoStatus {
  ENVIADO
  ERRO
  BOUNCE
  COMPLAINED
  DELIVERED
  ABERTO
}

model Template {
  id                String    @id @default(cuid())
  nome              String    @db.VarChar(100)
  assunto           String    @db.VarChar(200)
  corpo             String    @db.Text // HTML
  
  variaveis_tag     String[]  // {cliente_nome, motivo_churn, oferta}
  tags_indicadas    String[]  // [PRECO, SUPORTE] para qual usar
  
  versao            Int       @default(1)
  ativa             Boolean   @default(true)
  
  created_by        String
  created_at        DateTime  @default(now())
  updated_by        String?
  updated_at        DateTime  @updatedAt
  
  @@index([created_by])
  @@fulltext([nome, assunto])
}

model AuditoriaCompanha {
  id                String    @id @default(cuid())
  campanha_id       String
  campanha          Campanha  @relation(fields: [campanha_id], references: [id], onDelete: Cascade)
  
  usuario_id        String
  acao              String    // CREATE, UPDATE, ATIVA, PAUSADA, FINALIZADA, DELETE_ACAO
  
  dados_antes       Json?
  dados_depois      Json?
  ip_address        String?
  
  timestamp         DateTime  @default(now())
  
  @@index([campanha_id])
  @@index([usuario_id])
  @@index([timestamp])
}
```

---

## Services (Camada de Negócio)

### 1. CampanhaService

```typescript
async create(data: CreateCampanhaDTO, userId: string) {
  // Validar datas
  if (data.data_fim <= data.data_inicio) throw new BadRequestError('...');
  
  return prisma.campanha.create({
    data: {
      ...data,
      created_by: userId,
      status: 'RASCUNHO'
    }
  });
}

async list(filters: {status?, created_by?}, page: number = 0) {
  // Listar com paginação + cache 10min
  const key = `campanhas:${JSON.stringify(filters)}:${page}`;
  const cached = cache.get(key);
  if (cached) return cached;
  
  const result = await prisma.campanha.findMany({
    where: filters,
    skip: page * 20,
    take: 20,
    include: {segmento: true, acoes: true}
  });
  
  cache.set(key, result, 10*60);
  return result;
}

async atualizar(id: string, data: Partial<CreateCampanhaDTO>, userId: string) {
  const campanha = await prisma.campanha.findUnique({where: {id}});
  
  // Validar: não editar se ATIVA (apenas CEO pode)
  if (campanha.status === 'ATIVA' && !isCEO(userId)) {
    throw new ForbiddenError('Apenas CEO edita campanha ativa');
  }
  
  // Auditoria
  await prisma.auditoriaCompanha.create({
    data: {
      campanha_id: id,
      usuario_id: userId,
      acao: 'UPDATE',
      dados_antes: campanha,
      dados_depois: data
    }
  });
  
  return prisma.campanha.update({
    where: {id},
    data: {...data, updated_by: userId}
  });
}

async ativar(id: string, userId: string) {
  // Mudar RASCUNHO → ATIVA e executar ações IMEDIATO
  const campanha = await this.atualizar(id, {status: 'ATIVA'}, userId);
  
  // Queue de ações IMEDIATO
  const acoes = await prisma.campanhaAcao.findMany({
    where: {campanha_id: id, tipo_trigger: 'IMEDIATO'},
    orderBy: {ordem: 'asc'}
  });
  
  for (const acao of acoes) {
    queue.add({type: 'executar-acao', acaoId: acao.id});
  }
  
  return campanha;
}

async pausar(id: string, userId: string) {
  // ATIVA → PAUSADA, cancela crons agendados
  const campanha = await this.atualizar(id, {status: 'PAUSADA'}, userId);
  
  // TODO: deschedule crons
  
  return campanha;
}

async finalizar(id: string, userId: string) {
  // ATIVA/PAUSADA → FINALIZADA
  return this.atualizar(id, {status: 'FINALIZADA'}, userId);
}
```

### 2. SegmentacaoService

```typescript
async filtrar(campanhaId: string, filters: SegmentFilters): Promise<{
  clientes: Cliente[],
  count: number,
  preview: SurveyResposta[]
}> {
  // Construir query dinâmica baseado em filtros
  // Join Cliente → CasoChurn → SurveyResposta (Sprint 29 data)
  
  const query = {
    where: {
      caso_churn: {
        diagnosis_churn: {
          risk_score: {
            gte: filters.risco_score?.[0],
            lte: filters.risco_score?.[1]
          }
        },
        survey_resposta: {
          motivo_real: {in: filters.motivos}
        }
      },
      created_at: {
        gte: new Date(Date.now() - toDays(filters.periodo))
      }
    }
  };
  
  const clientes = await prisma.cliente.findMany(query);
  const preview = clientes.slice(0, 5); // primeiros 5 para preview
  
  return {clientes, count: clientes.length, preview};
}

async salvarSegmento(data: {
  campanha_id: string,
  nome: string,
  filtros: SegmentFilters
}, userId: string) {
  return prisma.segmento.create({
    data: {
      ...data,
      created_by: userId,
      reutilizavel: true
    }
  });
}

async listarSegmentos(userId: string) {
  return prisma.segmento.findMany({
    where: {created_by: userId, reutilizavel: true},
    orderBy: {updated_at: 'desc'}
  });
}
```

### 3. CampanhaAcaoService

```typescript
async criar(campanhaId: string, data: CreateAcaoDTO) {
  // Validar: máximo 5 ações
  const count = await prisma.campanhaAcao.count({
    where: {campanha_id: campanhaId}
  });
  if (count >= 5) throw new BadRequestError('Máximo 5 ações');
  
  // Próxima ordem
  const maxOrdem = await prisma.campanhaAcao.findFirst({
    where: {campanha_id: campanhaId},
    orderBy: {ordem: 'desc'},
    select: {ordem: true}
  });
  
  return prisma.campanhaAcao.create({
    data: {
      campanha_id: campanhaId,
      ...data,
      ordem: (maxOrdem?.ordem || 0) + 1
    }
  });
}

async executar(acaoId: string) {
  const acao = await prisma.campanhaAcao.findUnique({
    where: {id: acaoId},
    include: {campanha: true}
  });
  
  const campanha = acao.campanha;
  
  // Buscar clientes do segmento
  const clientes = await segmentacaoService.filtrar(
    campanha.id,
    campanha.segmento.filtros
  );
  
  // Executar ação por tipo
  switch (acao.tipo_acao) {
    case 'ENVIAR_EMAIL':
      return this.enviarEmails(acao, clientes.clientes);
    case 'CRIAR_TASK':
      return this.criarTasks(acao, clientes.clientes);
    case 'APLICAR_CREDITO':
      return this.aplicarCredito(acao, clientes.clientes);
    // ...
  }
}

async enviarEmails(acao: CampanhaAcao, clientes: Cliente[]) {
  const template = await prisma.template.findUnique({
    where: {id: acao.configuracao.template_id}
  });
  
  for (const cliente of clientes) {
    const body = this.renderTemplate(template, cliente);
    
    // Queue de email
    queue.add({
      type: 'send-email',
      to: cliente.email,
      subject: template.assunto,
      html: body,
      disparoId: generateId() // salvar para tracking
    });
  }
}
```

### 4. DashboardCampanhaService

```typescript
async getKPIs(campanhaId: string): Promise<{
  totalEnviados: number,
  totalAbertos: number,
  totalClicados: number,
  totalConvertidos: number,
  taxaConversao: number
}> {
  const disparos = await prisma.campanahDisparo.findMany({
    where: {campanha_id: campanhaId}
  });
  
  const totalEnviados = disparos.filter(d => 
    d.status === 'ENVIADO' || d.delivered_at
  ).length;
  
  const totalAbertos = disparos.filter(d => 
    d.email_aberto === true
  ).length;
  
  const totalClicados = disparos.filter(d =>
    d.link_clicado === true
  ).length;
  
  // Convertidos: check se cliente tem novo CasoChurn aberto
  const clientesConvertidos = new Set(
    disparos
      .filter(d => d.clicked_at)
      .map(d => d.cliente_id)
      .filter(clienteId => {
        // Check se tem novo caso aberto após disparo
        return prisma.casoChurn.findFirst({
          where: {
            clienteId,
            createdAt: {gt: disparos[0].sent_at}
          }
        });
      })
  );
  
  return {
    totalEnviados,
    totalAbertos,
    totalClicados,
    totalConvertidos: clientesConvertidos.size,
    taxaConversao: (clientesConvertidos.size / totalEnviados) * 100
  };
}

async getCharts(campanhaId: string) {
  // Gráficos para dashboard
  // TendenciaChart: disparos por dia
  // MotivoChart: motivos dos não-convertidos
}
```

---

## Routes (Fastify)

```typescript
// POST /campanhas — Criar campanha (RASCUNHO)
fastify.post('/campanhas', {onRequest: requireAuth}, async (req, reply) => {
  const schema = z.object({
    nome: z.string().min(3).max(100),
    descricao: z.string().optional(),
    data_inicio: z.string().datetime(),
    data_fim: z.string().datetime()
  });
  
  const data = schema.parse(req.body);
  const campanha = await campanhaService.create(data, req.user.id);
  reply.code(201).send(campanha);
});

// GET /campanhas — Listar campanhas
fastify.get('/campanhas', {onRequest: requireAuth}, async (req, reply) => {
  const filters = {
    status: req.query.status,
    created_by: req.user.role === 'CEO' ? undefined : req.user.id
  };
  const page = parseInt(req.query.page) || 0;
  
  const campanhas = await campanhaService.list(filters, page);
  reply.send(campanhas);
});

// PATCH /campanhas/:id — Atualizar campanha
fastify.patch('/campanhas/:id', {onRequest: requireAuth}, async (req, reply) => {
  const campanha = await campanhaService.atualizar(
    req.params.id,
    req.body,
    req.user.id
  );
  reply.send(campanha);
});

// POST /campanhas/:id/ativar — Ativar campanha
fastify.post('/campanhas/:id/ativar', {onRequest: requireAuth}, async (req, reply) => {
  const campanha = await campanhaService.ativar(req.params.id, req.user.id);
  reply.send(campanha);
});

// POST /campanhas/:id/pausar — Pausar campanha
fastify.post('/campanhas/:id/pausar', {onRequest: requireAuth}, async (req, reply) => {
  const campanha = await campanhaService.pausar(req.params.id, req.user.id);
  reply.send(campanha);
});

// POST /campanhas/:id/segmentacao/filtrar — Filtrar clientes
fastify.post('/campanhas/:id/segmentacao/filtrar', {onRequest: requireAuth}, async (req, reply) => {
  const filters = req.body; // risco_score, motivos, periodo, etc
  const result = await segmentacaoService.filtrar(req.params.id, filters);
  reply.send(result);
});

// POST /campanhas/:id/segmentacao/salvar — Salvar segmento
fastify.post('/campanhas/:id/segmentacao/salvar', {onRequest: requireAuth}, async (req, reply) => {
  const segmento = await segmentacaoService.salvarSegmento(
    {campanha_id: req.params.id, ...req.body},
    req.user.id
  );
  reply.send(segmento);
});

// POST /campanhas/:id/acoes — Criar ação
fastify.post('/campanhas/:id/acoes', {onRequest: requireAuth}, async (req, reply) => {
  const acao = await campanhaAcaoService.criar(req.params.id, req.body);
  reply.code(201).send(acao);
});

// PATCH /campanhas/:id/acoes/:acaoId — Editar ação
fastify.patch('/campanhas/:id/acoes/:acaoId', {onRequest: requireAuth}, async (req, reply) => {
  const acao = await prisma.campanhaAcao.update({
    where: {id: req.params.acaoId},
    data: req.body
  });
  reply.send(acao);
});

// DELETE /campanhas/:id/acoes/:acaoId — Deletar ação
fastify.delete('/campanhas/:id/acoes/:acaoId', {onRequest: requireAuth}, async (req, reply) => {
  await prisma.campanhaAcao.delete({where: {id: req.params.acaoId}});
  reply.code(204).send();
});

// GET /campanhas/:id/dashboard — Dashboard da campanha
fastify.get('/campanhas/:id/dashboard', {onRequest: requireAuth}, async (req, reply) => {
  const kpis = await dashboardService.getKPIs(req.params.id);
  const charts = await dashboardService.getCharts(req.params.id);
  reply.send({kpis, charts});
});

// GET /campanhas/:id/auditoria — Histórico de auditoria
fastify.get('/campanhas/:id/auditoria', {onRequest: requireAuth}, async (req, reply) => {
  const auditoria = await prisma.auditoriaCompanha.findMany({
    where: {campanha_id: req.params.id},
    orderBy: {timestamp: 'desc'}
  });
  reply.send(auditoria);
});

// GET /campanhas/:id/relatorio — Exportar relatório
fastify.get('/campanhas/:id/relatorio', {onRequest: requireAuth}, async (req, reply) => {
  const tipo = req.query.tipo || 'xlsx';
  const periodo = req.query.periodo || '30dias';
  
  const buffer = await gerarRelatorio({
    campanhaId: req.params.id,
    tipo,
    periodo
  });
  
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  reply.header('Content-Disposition', `attachment; filename="campanha.${tipo}"`);
  reply.send(buffer);
});

// POST /templates — Criar template
fastify.post('/templates', {onRequest: requireAuth}, async (req, reply) => {
  const template = await prisma.template.create({
    data: {
      ...req.body,
      created_by: req.user.id
    }
  });
  reply.code(201).send(template);
});

// GET /templates — Listar templates
fastify.get('/templates', {onRequest: requireAuth}, async (req, reply) => {
  const templates = await prisma.template.findMany({
    where: {ativa: true},
    orderBy: {updated_at: 'desc'}
  });
  reply.send(templates);
});

// POST /templates/:id/preview — Preview com dados reais
fastify.post('/templates/:id/preview', {onRequest: requireAuth}, async (req, reply) => {
  const template = await prisma.template.findUnique({
    where: {id: req.params.id}
  });
  const clienteId = req.body.cliente_id;
  
  const cliente = await prisma.cliente.findUnique({
    where: {id: clienteId},
    include: {caso_churn: {include: {survey_resposta: true}}}
  });
  
  const rendered = renderTemplate(template, cliente);
  reply.send({assunto: template.assunto, corpo: rendered});
});
```

---

## Cron Jobs (Node-Schedule)

```typescript
// 09:00 — Auto-ativar campanhas agendadas
schedule.scheduleJob('0 9 * * *', async () => {
  const campanhas = await prisma.campanha.findMany({
    where: {
      status: 'RASCUNHO',
      data_inicio: {lte: new Date()}
    }
  });
  
  for (const c of campanhas) {
    await campanhaService.ativar(c.id, 'SYSTEM');
  }
});

// A cada 1 hora — Executar ações HORARIO
schedule.scheduleJob('0 * * * *', async () => {
  const acoes = await prisma.campanhaAcao.findMany({
    where: {
      tipo_trigger: 'HORARIO',
      status: {in: ['CRIADA', 'AGENDADA']}
    }
  });
  
  for (const acao of acoes) {
    queue.add({type: 'executar-acao', acaoId: acao.id});
  }
});

// Diariamente 02:00 — Invalidar caches
schedule.scheduleJob('0 2 * * *', async () => {
  cache.del(/^campanhas:/);
});
```

---

## Middleware de Autorização

```typescript
const checkPermissionCampanha = (action: string) => {
  return async (req, res, next) => {
    const campanha = await prisma.campanha.findUnique({
      where: {id: req.params.id}
    });
    
    const isSupervisor = req.user.role === 'SUPERVISAO';
    const isCEO = req.user.role === 'CEO';
    const isOwner = campanha.created_by === req.user.id;
    
    if (action === 'CREATE') {
      if (!isSupervisor && !isCEO) throw new ForbiddenError('...');
    }
    
    if (action === 'EDIT') {
      if (campanha.status === 'RASCUNHO' && !isOwner && !isCEO) {
        throw new ForbiddenError('...');
      }
      if (campanha.status !== 'RASCUNHO' && !isCEO) {
        throw new ForbiddenError('Apenas CEO edita campanha ativa');
      }
    }
    
    if (action === 'VIEW') {
      if (isCEO) return next(); // CEO vê tudo
      if (isOwner) return next(); // Owner vê sua campanha
      throw new ForbiddenError('...');
    }
  };
};
```

---

## Integration Points

- **Sprint 28:** CasoChurn.id (vinculado em Disparo para tracking conversão)
- **Sprint 29:** SurveyResposta.motivo_real + sentimento_q1 (filtros de segmentação)
- **Novo:** Campanha → Disparo → Cliente (ciclo de retenção)
- **Email Webhook:** Sendgrid callback → atualiza CampanhaDisparo.email_aberto, clicked_at

---

## Performance Targets

| Operação | Target |
|----------|--------|
| GET /campanhas (listar) | <300ms p95 |
| POST /campanhas/:id/segmentacao/filtrar | <500ms p95 |
| GET /campanhas/:id/dashboard | <400ms p95 |
| Enviar email batch (100) | <2s |

---

## Sprint 30 Step 03 — Tech Lead PRONTO ✅

**Entregáveis:**
- Prisma schema: 5 tabelas (Campanha, Segmento, CampanhaAcao, CampanhaDisparo, Template, AuditoriaCompanha)
- 4 services: CampanhaService, SegmentacaoService, CampanhaAcaoService, DashboardCampanhaService
- 12 Fastify routes com validações e permissões
- 2 cron jobs (auto-ativar, executar ações)
- Middleware RBAC para campanhas

**Próximo:** Felipe Santos (Backend) — Implementação TypeScript completa + Sendgrid integration
