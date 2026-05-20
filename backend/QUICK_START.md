# Quick Start Guide - CRM Comercial ProSystem Backend

## Server Setup

### 1. Start PostgreSQL Database
```bash
# If using Docker
docker run --name prosystem-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=crm_comercial -p 5432:5432 -d postgres:14
```

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_comercial"
FASTIFY_PORT=3001
LOG_LEVEL=info
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Setup Database
```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start Server
```bash
npm run dev
```

Server available at: `http://localhost:3001`

---

## Testing the API

### Health Check
```bash
curl http://localhost:3001/health
```

### 1. Create a Customer
```bash
curl -X POST http://localhost:3001/casos-churn \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "cliente-123",
    "motivo_principal": "Preço elevado"
  }'
```

### 2. Create Diagnosis (Auto-scoring)
```bash
curl -X POST http://localhost:3001/casos/CASO_ID/diagnostico \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "dias_sem_interacao": 45,
    "valor_mensal": 2500,
    "frequencia_suporte": 8,
    "tempo_cliente": 4,
    "motivo_reportado": "Preço elevado"
  }'
```

### 3. Create Retention Plan
```bash
curl -X POST http://localhost:3001/casos/CASO_ID/planos \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Plano Premium",
    "descricao": "Desconto exclusivo + suporte dedicado"
  }'
```

### 4. Create Retention Action
```bash
curl -X POST http://localhost:3001/casos/CASO_ID/acoes \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Contato com cliente",
    "tipo": "CONTATO",
    "descricao": "Ligar para explicar benefícios",
    "data_vencimento": "2026-06-19T00:00:00Z"
  }'
```

### 5. Get Dashboard KPIs
```bash
curl http://localhost:3001/dashboard/retencao?periodo=30dias \
  -H "Authorization: Bearer test-token"
```

### 6. Get Risk Distribution Chart
```bash
curl http://localhost:3001/dashboard/retencao/chart/risco \
  -H "Authorization: Bearer test-token"
```

### 7. Get Top Clients at Risk
```bash
curl http://localhost:3001/dashboard/retencao/top-risco?limit=10 \
  -H "Authorization: Bearer test-token"
```

---

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Specific file
npm test -- retencao.test.ts

# With coverage
npm test -- --coverage
```

---

## Prisma Studio (Database GUI)

```bash
npx prisma studio
```

Opens at `http://localhost:5555`

---

## Available Endpoints Summary

### Cases
- `POST /casos-churn` - Create case
- `GET /casos-churn` - List cases
- `GET /casos-churn/:id` - Get case
- `PATCH /casos-churn/:id` - Update case
- `DELETE /casos-churn/:id` - Delete case

### Diagnosis
- `POST /casos/:casoId/diagnostico` - Create diagnosis (auto-score)
- `GET /casos/:casoId/diagnostico` - Get diagnosis with risk matrix
- `PATCH /diagnosticos/:diagnosisId` - Update diagnosis

### Retention Plans
- `POST /casos/:casoId/planos` - Create plan
- `GET /casos/:casoId/planos` - List plans
- `PATCH /planos/:planoId` - Update plan
- `POST /planos/:planoId/ativar` - Activate plan
- `POST /planos/:planoId/concluir` - Conclude plan

### Retention Actions
- `POST /casos/:casoId/acoes` - Create action
- `GET /casos/:casoId/acoes` - List actions
- `GET /casos/:casoId/timeline` - Get timeline
- `PATCH /acoes/:acaoId` - Update action
- `POST /acoes/:acaoId/progresso` - Mark in progress
- `POST /acoes/:acaoId/concluir` - Conclude action

### Dashboard
- `GET /dashboard/retencao` - KPIs
- `GET /dashboard/retencao/chart/status` - Status chart
- `GET /dashboard/retencao/chart/risco` - Risk chart
- `GET /dashboard/retencao/top-risco` - Top clients at risk
- `GET /dashboard/retencao/planos-status` - Plans summary
- `GET /dashboard/retencao/acoes-tipo` - Actions by type
- `GET /dashboard/retencao/recuperacao-motivo` - Recovery rate

---

## Key Features Implemented

✅ **Case Management**
- Create, list, filter, update, soft delete cases
- Status transition validation (NOVO → DIAGNOSTICADO → ...)
- Risk scoring integration

✅ **Risk Assessment**
- 5-dimension risk scoring algorithm (0-100)
- Auto-risk factor identification
- Risk levels: BAIXO, MÉDIO, ALTO

✅ **Retention Planning**
- Multi-step retention plans
- Plan status tracking (RASCUNHO → ATIVO → CONCLUIDO)
- Action association

✅ **Action Management**
- 5 action types (CONTATO, EMAIL, DESCONTO, PRODUTO, OUTRO)
- Status tracking (NOVA → EM_PROGRESSO → CONCLUIDA)
- Due date management
- Timeline views

✅ **Analytics Dashboard**
- 7 KPI metrics
- 6 chart types
- Status distribution
- Risk analysis
- Recovery analytics

---

## Response Format

All API responses follow this format:

### Success (2xx)
```json
{
  "status": "success",
  "data": {...}
}
```

### Error (4xx/5xx)
```json
{
  "status": "error",
  "message": "Human-readable error message",
  "errors": [...]
}
```

---

## Development Workflow

1. **Create test client:**
   ```bash
   # Use Prisma Studio to create a Cliente record
   npx prisma studio
   ```

2. **Create test caso:**
   ```bash
   curl -X POST http://localhost:3001/casos-churn \
     -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{"clienteId": "..."}' 
   ```

3. **Add diagnosis:**
   ```bash
   curl -X POST http://localhost:3001/casos/{casoId}/diagnostico \
     -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{...factors...}'
   ```

4. **Create plan and actions:**
   - Create plano
   - Create acoes
   - Update statuses

5. **View analytics:**
   ```bash
   curl http://localhost:3001/dashboard/retencao \
     -H "Authorization: Bearer test"
   ```

---

## Troubleshooting

**Database connection error:**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Run `npx prisma migrate dev`

**Port already in use:**
- Change FASTIFY_PORT in .env
- Or kill process: `lsof -i :3001` (macOS/Linux)

**Missing types:**
- Run `npx prisma generate`
- Run `npm install`

**Tests failing:**
- Database isolation: each test creates own client
- Check afterAll cleanup runs
- Verify PostgreSQL is accessible

---

## Next Steps

1. **Frontend**: Create Next.js 14 app in `/frontend`
2. **Sprint 29**: Add survey endpoints
3. **Sprint 30**: Add campaign endpoints
4. **Integration**: Connect to Sendgrid for email
5. **Deployment**: Docker + CI/CD setup

---

## Useful Commands

```bash
# Development
npm run dev                    # Start server
npm test                       # Run tests
npm run lint                   # Lint code
npm run build                  # Build TypeScript

# Database
npx prisma migrate dev         # Create migration
npx prisma studio              # Open database GUI
npx prisma seed                # Seed test data
npx prisma generate            # Generate Prisma client

# Other
npm run type-check             # Check types
npm run format                 # Format code
```
