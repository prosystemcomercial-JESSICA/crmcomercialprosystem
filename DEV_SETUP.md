# CRM Comercial ProSystem — Dev Setup Guide

**Status:** Pronto para implementação  
**Data:** 2026-05-20  
**Time:** Full-stack (Node.js + Next.js + Fastify + PostgreSQL)

---

## 1️⃣ Pré-Requisitos

### Sistema
- Node.js 18+
- PostgreSQL 14+
- Docker (opcional, recomendado)
- Git

### Ferramentas
```bash
# Instalar globalmente
npm install -g pnpm  # Package manager (melhor que npm)
npm install -g ts-node  # TypeScript runner
```

---

## 2️⃣ Criar Estrutura do Projeto

### Repositório Git
```bash
cd c:\Users\prosy\Documents\CRM\ COMERCIAL\ PROSYSTEM
git init crm-comercial-api
cd crm-comercial-api

git config user.name "Jessica"
git config user.email "alcancelegal.mkt@gmail.com"
```

### Estrutura de Pastas
```bash
mkdir -p {apps/{backend,frontend},packages/{shared,types,ui}}
mkdir -p backend/{src/{services,routes,middleware,utils},prisma,tests}
mkdir -p frontend/{app,components,hooks,lib,public}

# Criar .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
.next/
EOF

git add .gitignore
git commit -m "chore: initial project structure"
```

---

## 3️⃣ Setup Backend (Fastify + TypeScript)

### 3.1 Inicializar Projeto
```bash
cd backend
pnpm init
```

### 3.2 Instalar Dependências Principais

```bash
pnpm add fastify \
  @prisma/client \
  zod \
  dotenv \
  typescript \
  node-schedule \
  node-cache \
  @sendgrid/mail \
  cors \
  helmet \
  pino pino-pretty

pnpm add -D @types/node \
  @types/node-schedule \
  ts-node \
  tsup \
  vitest \
  supertest \
  @types/supertest
```

### 3.3 Configurar TypeScript

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3.4 package.json Scripts

```json
{
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsup src/server.ts --format esm,cjs --dts",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:cov": "vitest --coverage",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

### 3.5 Setup Prisma

```bash
pnpm add -D prisma

npx prisma init

# Criar .env
cat > .env << 'EOF'
DATABASE_URL="postgresql://user:password@localhost:5432/crm_comercial"
NODE_ENV=development
FASTIFY_PORT=3001
SENDGRID_API_KEY=your_key_here
SENDGRID_FROM_EMAIL=noreply@crm.com
TRACKING_URL=http://localhost:3001
EOF
```

**prisma/schema.prisma** (começar com tabelas de Sprint 28):
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Usuario {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  role      String   // VENDEDOR|SUPERVISAO|CEO|ADMIN
  ativo     Boolean  @default(true)
  created_at DateTime @default(now())
  
  @@index([role])
}

model CasoChurn {
  id              String    @id @default(cuid())
  clienteId       String
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  
  status          String    @default("NOVO") // NOVO|DIAGNOSTICADO|PLANEJADO|EXECUTANDO|RECUPERADO|PERDIDO
  risk_score      Float     @default(0)
  
  created_by      String
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  
  @@index([status])
  @@index([clienteId])
}

model Cliente {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  telefone  String?
  empresa   String?
  created_at DateTime @default(now())
  
  caso_churn CasoChurn[]
  
  @@index([email])
}

model DiagnosisChurn {
  id              String    @id @default(cuid())
  caso_churn_id   String    @unique
  
  motivo_principal String
  risco_score     Float
  
  created_at      DateTime  @default(now())
}

model Template {
  id                String    @id @default(cuid())
  nome              String
  assunto           String
  corpo             String    @db.Text
  variaveis_tag     String[]
  
  created_by        String
  created_at        DateTime  @default(now())
  @@index([created_by])
}
```

### 3.6 Criar Server Fastify Básico

**src/server.ts:**
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';

const fastify = Fastify({logger: true});
export const prisma = new PrismaClient();

// Plugins
fastify.register(cors, {origin: process.env.FRONTEND_URL || 'http://localhost:3000'});
fastify.register(helmet);

// Health check
fastify.get('/health', async () => ({status: 'ok'}));

// Routes (importar depois)
// fastify.register(require('./routes/...'));

// Start
const start = async () => {
  try {
    await fastify.listen({port: parseInt(process.env.FASTIFY_PORT || '3001'), host: '0.0.0.0'});
    console.log('🚀 Server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

---

## 4️⃣ Setup Frontend (Next.js 14)

### 4.1 Criar Projeto Next.js

```bash
cd ../frontend

pnpm create next-app@latest . --typescript --tailwind --app --eslint --no-git

# Se já tiver pasta, fazer manual:
pnpm init
pnpm add next@latest react react-dom
pnpm add -D typescript @types/node @types/react @types/react-dom
```

### 4.2 Instalar Dependências Frontend

```bash
pnpm add \
  @tanstack/react-query \
  react-hook-form \
  zod \
  @hookform/resolvers \
  recharts \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  date-fns \
  axios

pnpm add -D @testing-library/react @testing-library/jest-dom jest
```

### 4.3 Estrutura de Pastas Next.js

```bash
mkdir -p {app,components,hooks,lib,public}

# App Router structure
mkdir -p app/{dashboard,auth,_auth}

# Components
mkdir -p components/{campanhas,pesquisa,retencao,shared}

# Lib
mkdir -p lib/{api,db,utils}

# Hooks
mkdir -p hooks
```

### 4.4 .env.local Frontend

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=CRM Comercial ProSystem
EOF
```

---

## 5️⃣ Setup Database (PostgreSQL + Docker)

### 5.1 Docker Compose (Opcional)

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: crm_db
    environment:
      POSTGRES_USER: crm_user
      POSTGRES_PASSWORD: crm_pass_secure
      POSTGRES_DB: crm_comercial
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  adminer:
    image: adminer:latest
    ports:
      - "8080:8080"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### 5.2 Iniciar Database

```bash
# Com Docker
docker-compose up -d

# Sem Docker (instalar PostgreSQL localmente)
# Windows: https://www.postgresql.org/download/windows/
# macOS: brew install postgresql

# Criar database
psql -U postgres
CREATE DATABASE crm_comercial;
CREATE USER crm_user WITH PASSWORD 'crm_pass_secure';
GRANT ALL PRIVILEGES ON DATABASE crm_comercial TO crm_user;
\q
```

### 5.3 Executar Migrations

```bash
cd backend
pnpm db:generate
pnpm db:push  # ou db:migrate
```

---

## 6️⃣ Setup Monorepo (Opcional)

Se quiser estrutura monorepo com `pnpm workspaces`:

**root pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/backend'
  - 'apps/frontend'
  - 'packages/*'
```

**root package.json:**
```json
{
  "name": "crm-comercial-prosystem",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test"
  }
}
```

---

## 7️⃣ Iniciar Desenvolvimento

### Terminal 1 — Backend
```bash
cd backend
pnpm dev
# Output: 🚀 Server running on http://localhost:3001
```

### Terminal 2 — Frontend
```bash
cd frontend
pnpm dev
# Output: ▲ Next.js on http://localhost:3000
```

### Terminal 3 — Database (se Docker)
```bash
docker-compose up
# Adminer: http://localhost:8080
```

---

## 8️⃣ Verificação de Saúde

### Checklist
- [ ] Backend respondendo: `curl http://localhost:3001/health`
- [ ] Frontend carregando: http://localhost:3000
- [ ] Database conectado: `pnpm db:push` sem erros
- [ ] Prisma Studio: `pnpm exec prisma studio`

### Troubleshooting

**"Error: Cannot find module 'ts-node'"**
```bash
pnpm add -D ts-node
```

**"ECONNREFUSED" (Database não conecta)**
```bash
# Verificar PostgreSQL rodando
psql -U crm_user -d crm_comercial -c "SELECT 1;"

# Resetar database
dropdb -U crm_user crm_comercial
createdb -U crm_user crm_comercial
```

**Port 3001/3000 já em uso**
```bash
# Matar processo
# Windows: netstat -ano | findstr :3001
# macOS/Linux: lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

---

## 9️⃣ Próximas Etapas

### Fase 1 — Setup (Hoje)
- [x] Git + Estrutura pastas
- [x] Backend: Fastify + Prisma + TS
- [x] Frontend: Next.js 14 + React Query
- [ ] Database: PostgreSQL local ou Docker
- [ ] Health checks passando

### Fase 2 — Implementação Sprint 28 (1-2 semanas)
- [ ] Criar rotas básicas CRUD CasoChurn
- [ ] Implementar services (CasoChurnService, DiagnosisService)
- [ ] Componentes React: DashboardRetencao, ListaCasos
- [ ] Testes unitários + E2E

### Fase 3 — Sprint 29 + 30
- [ ] NLP service (sentimento + categorização)
- [ ] Integração Sendgrid
- [ ] Cron jobs
- [ ] Testes de integração

---

## 📚 Referências

- [Fastify Docs](https://www.fastify.io/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Next.js Docs](https://nextjs.org/docs)
- [React Query](https://tanstack.com/query/latest)
- [Zod Validation](https://zod.dev/)

---

## 🚀 Git Workflow

```bash
# Criar branch para cada sprint
git checkout -b feature/sprint-28-churn

# Fazer commits por US
git commit -m "feat(churn): implement CasoChurnService [US01]"
git commit -m "feat(churn): add Dashboard component [US02]"

# PR ao main
git push origin feature/sprint-28-churn
# Criar PR no GitHub
```

---

Pronto para começar? Execute estes comandos em sequência:

```bash
# 1. Setup Backend
cd backend && pnpm install && pnpm db:push && pnpm dev

# 2. Em novo terminal, Setup Frontend
cd frontend && pnpm install && pnpm dev

# 3. Database (em novo terminal, se usando Docker)
docker-compose up
```

Quando tudo estiver rodando, avise para começarmos com **Sprint 28 — Primeira Rota API**.

