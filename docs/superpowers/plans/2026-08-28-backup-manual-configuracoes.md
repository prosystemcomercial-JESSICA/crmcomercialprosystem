# Backup Manual Sob Demanda + Lista dos Últimos 5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Fazer backup agora" e uma lista dos 5 backups mais recentes na tela `/configuracoes`, disparando um export completo do banco de produção que roda no backend Railway.

**Architecture:** Novo endpoint `backend/src/routes/backups.ts` reaproveita a lógica de `backend/scripts/backup-diario.cjs` (descobrir tabelas via `information_schema`, exportar cada uma via Prisma `$queryRawUnsafe`, serializar `BigInt`), salvando em um Railway Volume montado no backend (`BACKUP_VOLUME_PATH`, ex. `/data`). Mantém só as 5 pastas mais recentes. Novo card "Backup" em `frontend/app/configuracoes/page.tsx` chama `POST /backups` e `GET /backups` via `apiClient`. O job local (Task Scheduler + MEGA) não é alterado — é uma segunda trilha independente.

**Tech Stack:** Fastify + Prisma (backend), Next.js + axios (frontend), Railway Volume (infra).

## Global Constraints

- `POST /backups` e `GET /backups` **sem** restrição de role — qualquer usuário autenticado pode acessar (decidido no design, diferente do padrão `requireGestor` usado em `auditoria.ts`).
- Retenção fixa em 5 backups no volume (apaga os mais antigos automaticamente a cada novo backup).
- Execução do export é síncrona (a requisição `POST /backups` só responde depois do export terminar).
- Formato de cada backup idêntico ao gerado por `backup-diario.cjs`: uma pasta por timestamp, um `.json` por tabela, mais um `_resumo.json` com `{ data, tabelas: { nome: contagem }, erros: [{ tabela, erro }] }`.
- Erro em uma tabela não aborta o backup inteiro — registra em `erros` e continua.
- Variável de ambiente `BACKUP_VOLUME_PATH` define onde os backups são salvos (permite rodar local apontando pra qualquer pasta, e em produção apontando pro volume Railway).

---

## Task 1: Módulo de export de backup (lógica pura, testável sem servidor)

**Files:**
- Create: `backend/src/lib/backup.ts`
- Test: `backend/src/lib/backup.test.ts`

**Interfaces:**
- Produces:
  - `export interface ResumoBackup { timestamp: string; data: string; tabelas: Record<string, number>; erros: Array<{ tabela: string; erro: string }>; }`
  - `export async function executarBackup(prisma: PrismaClient, volumePath: string): Promise<ResumoBackup>` — roda o export completo, grava os arquivos, aplica retenção de 5, retorna o resumo.
  - `export async function listarBackups(volumePath: string): Promise<ResumoBackup[]>` — lê as pastas existentes em `volumePath/backups`, ordenadas por timestamp decrescente, no máximo 5, cada uma parseada do seu `_resumo.json`.

Este projeto usa Jest? Verificar antes de escrever o teste — checar `backend/package.json` por `"test"` script e dependência de teste instalada.

- [ ] **Step 1: Verificar runner de testes do backend**

Rodar:
```bash
cd backend && cat package.json | grep -A2 '"scripts"' && cat package.json | grep -iE "jest|vitest|mocha"
```

Se não houver nenhum runner configurado, usar Node `assert` puro com um script `.mjs` executável via `node`, seguindo o padrão dos demais scripts `.cjs`/`.ts` do projeto (não introduzir um framework de testes novo para esta task). Adaptar os passos seguintes de acordo com o que for encontrado — se for Jest/Vitest, usar `describe/it/expect` normalmente; se não houver nada, escrever `backend/src/lib/backup.test.ts` como um script que roda com `npx tsx backend/src/lib/backup.test.ts` e lança (`throw`) em caso de falha, imprimindo `OK` no final.

- [ ] **Step 2: Escrever o teste falhando (retenção de 5 backups)**

```typescript
// backend/src/lib/backup.test.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { executarBackup, listarBackups } from './backup';

async function testRetencaoMantemApenasCinco() {
  const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const prisma = new PrismaClient();

  for (let i = 0; i < 6; i++) {
    await executarBackup(prisma, volumePath);
    await new Promise(r => setTimeout(r, 1100)); // garante timestamps distintos (granularidade de segundo)
  }

  const backups = await listarBackups(volumePath);
  if (backups.length !== 5) {
    throw new Error(`Esperado 5 backups retidos, encontrado ${backups.length}`);
  }

  const pastas = fs.readdirSync(path.join(volumePath, 'backups'));
  if (pastas.length !== 5) {
    throw new Error(`Esperado 5 pastas no volume, encontrado ${pastas.length}`);
  }

  await prisma.$disconnect();
  fs.rmSync(volumePath, { recursive: true, force: true });
  console.log('testRetencaoMantemApenasCinco: OK');
}

async function testResumoTemFormatoEsperado() {
  const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const prisma = new PrismaClient();

  const resumo = await executarBackup(prisma, volumePath);

  if (!resumo.timestamp || !resumo.data || !resumo.tabelas || !Array.isArray(resumo.erros)) {
    throw new Error(`Resumo com formato inesperado: ${JSON.stringify(resumo)}`);
  }
  if (Object.keys(resumo.tabelas).length === 0) {
    throw new Error('Resumo sem nenhuma tabela exportada — banco de teste vazio ou export quebrado');
  }

  await prisma.$disconnect();
  fs.rmSync(volumePath, { recursive: true, force: true });
  console.log('testResumoTemFormatoEsperado: OK');
}

async function main() {
  await testResumoTemFormatoEsperado();
  await testRetencaoMantemApenasCinco();
  console.log('TODOS OS TESTES PASSARAM');
}

main().catch(err => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Rodar o teste e verificar que falha (arquivo `backup.ts` ainda não existe)**

Run: `cd backend && DATABASE_URL="mysql://root:YIOmtcoslVnthbSIgIqpFTcErsHlqEgw@hayabusa.proxy.rlwy.net:15443/railway" npx tsx src/lib/backup.test.ts`
Expected: FAIL — erro de módulo `./backup` não encontrado.

- [ ] **Step 4: Implementar `backend/src/lib/backup.ts`**

```typescript
// backend/src/lib/backup.ts
//
// Lógica de export de backup do banco — reaproveitada tanto pelo endpoint
// POST /backups (rodando no backend Railway) quanto, no futuro, por scripts
// locais equivalentes. Mesma abordagem do backend/scripts/backup-diario.cjs:
// descobre as tabelas via information_schema e exporta cada uma via SELECT *.

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export interface ResumoBackup {
  timestamp: string;
  data: string;
  tabelas: Record<string, number>;
  erros: Array<{ tabela: string; erro: string }>;
}

const RETENCAO_MAXIMA = 5;

function serializar(_key: string, value: any) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function pastaBackups(volumePath: string) {
  return path.join(volumePath, 'backups');
}

export async function executarBackup(prisma: PrismaClient, volumePath: string): Promise<ResumoBackup> {
  const agora = new Date();
  const timestamp = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const raiz = pastaBackups(volumePath);
  const pastaAtual = path.join(raiz, timestamp);
  fs.mkdirSync(pastaAtual, { recursive: true });

  const tabelas = await prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );

  const resumo: ResumoBackup = { timestamp, data: agora.toISOString(), tabelas: {}, erros: [] };

  for (const { TABLE_NAME: tabela } of tabelas) {
    try {
      const linhas = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM \`${tabela}\``);
      fs.writeFileSync(path.join(pastaAtual, `${tabela}.json`), JSON.stringify(linhas, serializar, 2), 'utf8');
      resumo.tabelas[tabela] = linhas.length;
    } catch (err: any) {
      resumo.erros.push({ tabela, erro: err.message });
    }
  }

  fs.writeFileSync(path.join(pastaAtual, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');

  aplicarRetencao(raiz);

  return resumo;
}

function aplicarRetencao(raiz: string) {
  if (!fs.existsSync(raiz)) return;
  const pastas = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse(); // mais recente primeiro

  for (const nome of pastas.slice(RETENCAO_MAXIMA)) {
    fs.rmSync(path.join(raiz, nome), { recursive: true, force: true });
  }
}

export async function listarBackups(volumePath: string): Promise<ResumoBackup[]> {
  const raiz = pastaBackups(volumePath);
  if (!fs.existsSync(raiz)) return [];

  const pastas = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse()
    .slice(0, RETENCAO_MAXIMA);

  const resumos: ResumoBackup[] = [];
  for (const nome of pastas) {
    const caminhoResumo = path.join(raiz, nome, '_resumo.json');
    if (fs.existsSync(caminhoResumo)) {
      resumos.push(JSON.parse(fs.readFileSync(caminhoResumo, 'utf8')));
    }
  }
  return resumos;
}
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

Run: `cd backend && DATABASE_URL="mysql://root:YIOmtcoslVnthbSIgIqpFTcErsHlqEgw@hayabusa.proxy.rlwy.net:15443/railway" npx tsx src/lib/backup.test.ts`
Expected: `testResumoTemFormatoEsperado: OK`, depois `testRetencaoMantemApenasCinco: OK`, depois `TODOS OS TESTES PASSARAM`. (Este teste demora alguns segundos por rodar 7 exports completos do banco de produção — é esperado.)

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/lib/backup.ts src/lib/backup.test.ts && git commit -m "feat: modulo de export de backup com retencao de 5"
```

---

## Task 2: Rotas `POST /backups` e `GET /backups`

**Files:**
- Create: `backend/src/routes/backups.ts`
- Modify: `backend/src/server.ts:397` (adicionar entrada na lista `routeModules`)

**Interfaces:**
- Consumes: `executarBackup(prisma, volumePath)` e `listarBackups(volumePath)` de `backend/src/lib/backup.ts` (Task 1); `ResumoBackup` interface.
- Produces: `export async function backupsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient })` registrando `POST /backups` e `GET /backups`.

- [ ] **Step 1: Implementar `backend/src/routes/backups.ts`**

```typescript
// backend/src/routes/backups.ts
//
// Backup manual sob demanda: qualquer usuário logado pode disparar um export
// completo do banco (POST /backups) e ver os 5 mais recentes (GET /backups).
// Roda no backend Railway, salvando em BACKUP_VOLUME_PATH (Railway Volume em
// produção). Independente do job local agendado (backup-diario.cjs + MEGA).

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { executarBackup, listarBackups } from '../lib/backup';

export async function backupsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const volumePath = process.env.BACKUP_VOLUME_PATH || './backups-local';

  fastify.post('/backups', async (request, reply) => {
    try {
      const resumo = await executarBackup(prisma, volumePath);
      return reply.send(resumo);
    } catch (err: any) {
      request.log.error(err, '[BACKUPS] Falha ao executar backup manual');
      return reply.status(500).send({ error: 'Falha ao executar backup', detalhe: err.message });
    }
  });

  fastify.get('/backups', async (request, reply) => {
    try {
      const backups = await listarBackups(volumePath);
      return reply.send(backups);
    } catch (err: any) {
      request.log.error(err, '[BACKUPS] Falha ao listar backups');
      return reply.status(500).send({ error: 'Falha ao listar backups', detalhe: err.message });
    }
  });
}
```

- [ ] **Step 2: Registrar a rota em `backend/src/server.ts`**

Adicionar à lista `routeModules` (perto de `sdr`, mantendo o alinhamento das colunas do array):

```typescript
    ['sdr',                   () => import('./routes/sdr'),                   'sdrRoutes'],
    ['backups',               () => import('./routes/backups'),               'backupsRoutes'],
```

- [ ] **Step 3: Testar manualmente contra o banco local/produção**

Run:
```bash
cd backend && DATABASE_URL="mysql://root:YIOmtcoslVnthbSIgIqpFTcErsHlqEgw@hayabusa.proxy.rlwy.net:15443/railway" BACKUP_VOLUME_PATH="C:/tmp/backup-teste" npm run dev
```
Em outro terminal:
```bash
curl -X POST http://localhost:3001/backups
curl http://localhost:3001/backups
```
Expected: o `POST` retorna um JSON com `timestamp`, `data`, `tabelas` (contagens por tabela) e `erros: []`; o `GET` retorna um array com esse mesmo backup. Verificar que `C:/tmp/backup-teste/backups/<timestamp>/` foi criado com um `.json` por tabela.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/routes/backups.ts src/server.ts && git commit -m "feat: rotas POST/GET /backups para backup manual sob demanda"
```

---

## Task 3: Criar o Railway Volume e configurar a variável de ambiente

**Files:** nenhum arquivo de código — mudança de infraestrutura no painel Railway.

Esta task é feita manualmente pelo usuário no painel do Railway (é uma mudança de infraestrutura de produção, não deve ser automatizada sem confirmação). O agente deve parar aqui e pedir para o usuário:

1. No painel Railway, abrir o serviço de **backend** do projeto CRM.
2. Ir em "Volumes" → criar um novo volume, montado em `/data`.
3. Em "Variables" do mesmo serviço, adicionar `BACKUP_VOLUME_PATH=/data`.
4. Fazer um novo deploy (ou aguardar o próximo push disparar o deploy automático).

- [ ] **Step 1: Pedir para o usuário confirmar que o volume e a variável foram criados antes de prosseguir para a Task 4.**

---

## Task 4: Adicionar `apiClient.executarBackup()` e `apiClient.listarBackups()`

**Files:**
- Modify: `frontend/lib/api-client.ts:722` (logo após `saveConfiguracoesIntegracoes`)

**Interfaces:**
- Produces:
  - `async executarBackup(): Promise<{ data: ResumoBackup }>`
  - `async listarBackups(): Promise<{ data: ResumoBackup[] }>`
  - `export interface ResumoBackup { timestamp: string; data: string; tabelas: Record<string, number>; erros: Array<{ tabela: string; erro: string }>; }` (mesmo shape do backend Task 1/2)

- [ ] **Step 1: Adicionar a interface e os métodos**

Adicionar antes de `class ApiClient` (perto de `export interface User`):

```typescript
export interface ResumoBackup {
  timestamp: string;
  data: string;
  tabelas: Record<string, number>;
  erros: Array<{ tabela: string; erro: string }>;
}
```

Adicionar dentro da classe, logo após `saveConfiguracoesIntegracoes` ([api-client.ts:722](frontend/lib/api-client.ts#L722)):

```typescript

  async executarBackup() {
    return this.client.post<ResumoBackup>('/backups');
  }

  async listarBackups() {
    return this.client.get<ResumoBackup[]>('/backups');
  }
```

- [ ] **Step 2: Verificar que o TypeScript compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem novos erros relacionados a `api-client.ts`.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add lib/api-client.ts && git commit -m "feat: apiClient.executarBackup e apiClient.listarBackups"
```

---

## Task 5: Card "Backup" em `/configuracoes`

**Files:**
- Modify: `frontend/app/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `apiClient.executarBackup()`, `apiClient.listarBackups()`, `ResumoBackup` (Task 4).

- [ ] **Step 1: Importar o ícone e o tipo**

Modificar a linha de import de ícones ([configuracoes/page.tsx:8](frontend/app/configuracoes/page.tsx#L8)):

```typescript
import { Check, Moon, Sun, Palette, Bell, GitMerge, FileText, Info, Save, Zap, Shield, ExternalLink, DatabaseBackup, AlertTriangle } from 'lucide-react';
import { apiClient, ResumoBackup } from '@/lib/api-client';
```

- [ ] **Step 2: Adicionar estado do backup no componente**

Adicionar logo após o bloco de estado do ZapSign ([configuracoes/page.tsx:117](frontend/app/configuracoes/page.tsx#L117), após `const [zapLoading, setZapLoading] = useState(false);`):

```typescript

  // Backup manual
  const [backups, setBackups] = useState<ResumoBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupRodando, setBackupRodando] = useState(false);
  const [backupErro, setBackupErro] = useState<string | null>(null);
```

- [ ] **Step 3: Carregar a lista ao montar e adicionar a função de disparar backup**

Adicionar logo após o `useEffect` que carrega `getConfiguracoesIntegracoes` ([configuracoes/page.tsx:150](frontend/app/configuracoes/page.tsx#L150), após o fechamento `}, [isAuthenticated]);`):

```typescript

  const carregarBackups = () => {
    setBackupsLoading(true);
    apiClient.listarBackups()
      .then(res => setBackups(res.data))
      .catch(() => {})
      .finally(() => setBackupsLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    carregarBackups();
  }, [isAuthenticated]);

  const handleBackupAgora = async () => {
    setBackupRodando(true);
    setBackupErro(null);
    try {
      await apiClient.executarBackup();
      carregarBackups();
    } catch (err: any) {
      setBackupErro(err?.response?.data?.error || 'Falha ao executar backup');
    } finally {
      setBackupRodando(false);
    }
  };
```

- [ ] **Step 4: Adicionar o card "Backup" na UI**

Adicionar dentro do `<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>` ([configuracoes/page.tsx:240](frontend/app/configuracoes/page.tsx#L240)), como novo card antes ou depois do card "Aparência" (inserir logo após o fechamento do card de Aparência, mantendo o padrão visual `cardStyle`/`sectionHeader`):

```tsx

          {/* ══ BACKUP ══════════════════════════════════════ */}
          <div style={cardStyle}>
            <div style={sectionHeader}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--t-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <DatabaseBackup size={16} color="var(--t-primary)" />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Backup</h2>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)', maxWidth: 480 }}>
                  Exporta todas as tabelas do banco agora mesmo. Mantém os 5 backups mais recentes.
                </p>
                <button
                  onClick={handleBackupAgora}
                  disabled={backupRodando}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    color: '#fff', cursor: backupRodando ? 'default' : 'pointer', border: 'none',
                    opacity: backupRodando ? 0.7 : 1,
                    background: 'linear-gradient(135deg, var(--t-primary) 0%, var(--t-primary-dark) 100%)',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--t-primary) 25%, transparent)',
                    transition: 'all 0.2s'
                  }}>
                  <DatabaseBackup size={14} />
                  {backupRodando ? 'Fazendo backup...' : 'Fazer backup agora'}
                </button>
              </div>

              {backupErro && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={13} /> {backupErro}
                </div>
              )}

              {backupsLoading ? (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Carregando...</p>
              ) : backups.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum backup manual ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {backups.map(b => {
                    const totalLinhas = Object.values(b.tabelas).reduce((a, c) => a + c, 0);
                    const totalTabelas = Object.keys(b.tabelas).length;
                    return (
                      <div key={b.timestamp} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8,
                        background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)',
                        fontSize: 12
                      }}>
                        <span style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>
                          {new Date(b.data).toLocaleString('pt-BR')}
                        </span>
                        <span style={{ color: 'var(--t-text-muted)' }}>
                          {totalTabelas} tabelas · {totalLinhas} linhas
                        </span>
                        {b.erros.length > 0 && (
                          <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> {b.erros.length} erro(s)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
```

- [ ] **Step 5: Rodar o frontend localmente e testar manualmente**

Run:
```bash
cd frontend && npm run dev
```
Acessar `http://localhost:3000/configuracoes` logado, localizar o card "Backup", clicar em "Fazer backup agora" e verificar:
- botão mostra "Fazendo backup..." e fica desabilitado durante a chamada;
- após concluir, a lista mostra o novo backup no topo com data/hora, contagem de tabelas e linhas;
- se a API retornar erro (ex.: derrubar o backend momentaneamente), a faixa de erro vermelha aparece com a mensagem.

Expected: comportamento acima confirmado visualmente.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add app/configuracoes/page.tsx && git commit -m "feat: card de backup manual em Configuracoes"
```

---

## Task 6: Deploy e verificação em produção

**Files:** nenhum arquivo novo — validação pós-deploy.

**Interfaces:** nenhuma nova; valida o fluxo completo das Tasks 1–5 já em produção.

- [ ] **Step 1: Confirmar que a Task 3 (volume + variável no Railway) foi concluída**

Perguntar ao usuário se o volume `/data` e a variável `BACKUP_VOLUME_PATH=/data` já foram criados no serviço de backend do Railway. Não prosseguir sem essa confirmação — sem o volume, `POST /backups` vai escrever num diretório efêmero do container (perdido a cada novo deploy) em vez de persistir.

- [ ] **Step 2: Push para main**

```bash
git push origin main
```

- [ ] **Step 3: Aguardar o deploy do backend e do frontend no Railway e checar `/health`**

Run: `curl https://crmcomercialprosystem-production-945e.up.railway.app/health`
Expected: `versao` (campo do JSON) bate com o SHA do commit recém-pushado — confirma que o deploy novo já está no ar antes de testar.

- [ ] **Step 4: Testar em produção**

Acessar a URL de produção do frontend, ir em Configurações, clicar em "Fazer backup agora" e confirmar que a lista atualiza com o novo backup. Repetir 6 vezes (ou usar `curl -X POST` direto no endpoint de produção) e confirmar que a lista nunca mostra mais que 5 itens.

- [ ] **Step 5: Reportar ao usuário**

Confirmar ao usuário que o backup manual está funcionando em produção, lembrando que o job local (Task Scheduler + MEGA) continua rodando em paralelo sem alteração.
