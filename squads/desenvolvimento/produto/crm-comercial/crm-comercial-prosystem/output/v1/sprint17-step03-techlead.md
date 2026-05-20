# Sprint 17 — Step 03 — Daniel Mendes (Tech Lead)
# Arquivos e Anexos — Arquitetura

## Novo modelo Prisma

```prisma
model Arquivo {
  id          String   @id @default(cuid())
  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  propostaId  String?
  proposta    Proposta? @relation(fields: [propostaId], references: [id], onDelete: SetNull)
  nomeOriginal String
  nomeArquivo  String   // UUID + extensão (nome no disco)
  caminho      String   // path completo relativo a /uploads
  mimeType     String
  tamanhoBytes Int
  uploadadoPorId String
  uploadadoPor   User   @relation(fields: [uploadadoPorId], references: [id])
  createdAt    DateTime @default(now())

  @@map("arquivos")
}
```

## Migration

```sql
CREATE TABLE "arquivos" (
  "id"              TEXT NOT NULL,
  "leadId"          TEXT NOT NULL,
  "propostaId"      TEXT,
  "nomeOriginal"    TEXT NOT NULL,
  "nomeArquivo"     TEXT NOT NULL,
  "caminho"         TEXT NOT NULL,
  "mimeType"        TEXT NOT NULL,
  "tamanhoBytes"    INTEGER NOT NULL,
  "uploadadoPorId"  TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE;
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_propostaId_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "propostas"("id") ON DELETE SET NULL;
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_uploadadoPorId_fkey"
  FOREIGN KEY ("uploadadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT;
```

## Estratégia de storage (local filesystem)

```
/uploads/
  leads/
    {leadId}/
      {ano}/
        {mes}/
          {cuid}-{nome-sanitizado}.{ext}
```

Exemplo: `/uploads/leads/clx123abc/2026/05/cm8xyz-proposta-final.pdf`

```typescript
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'

export function buildUploadPath(leadId: string, nomeOriginal: string): { rel: string; abs: string; nomeArquivo: string } {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const ext = path.extname(nomeOriginal).toLowerCase()
  const nomeSafe = path.basename(nomeOriginal, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 50)
  const uuid = randomUUID()
  const nomeArquivo = `${uuid}-${nomeSafe}${ext}`
  const rel = `leads/${leadId}/${ano}/${mes}/${nomeArquivo}`
  const abs = path.join(process.cwd(), 'uploads', rel)
  return { rel, abs, nomeArquivo }
}

export async function ensureDir(absPath: string) {
  await fs.mkdir(path.dirname(absPath), { recursive: true })
}

export async function deleteFile(absPath: string) {
  try { await fs.unlink(absPath) } catch { /* arquivo já removido */ }
}
```

## Tipos MIME aceitos

```typescript
export const MIME_ACEITOS: Record<string, string[]> = {
  'application/pdf':                                                          ['.pdf'],
  'application/msword':                                                       ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':  ['.docx'],
  'application/vnd.ms-excel':                                                 ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       ['.xlsx'],
  'image/png':  ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif':  ['.gif'],
}

export const EXTENSOES_ACEITAS = Object.values(MIME_ACEITOS).flat()
```

## API endpoints

```
POST  /api/leads/:leadId/arquivos              → upload (multipart)
GET   /api/leads/:leadId/arquivos              → listar arquivos do lead
GET   /api/arquivos/:id/download               → servir arquivo (stream)
DELETE /api/arquivos/:id                        → excluir (com validação de permissão)
```

## Rota de download (stream seguro)

```typescript
// Serve o arquivo via stream sem expor o caminho interno
fastify.get('/api/arquivos/:id/download', async (req, reply) => {
  const { id } = req.params as any
  const arquivo = await prisma.arquivo.findUnique({ where: { id } })
  if (!arquivo) return reply.code(404).send()

  const absPath = path.join(process.cwd(), 'uploads', arquivo.caminho)
  const stream = require('fs').createReadStream(absPath)

  return reply
    .header('Content-Type', arquivo.mimeType)
    .header('Content-Disposition', `attachment; filename="${arquivo.nomeOriginal}"`)
    .header('Content-Length', arquivo.tamanhoBytes)
    .send(stream)
})
```

## Serve estático bloqueado

O diretório `/uploads` **não** é servido estaticamente pelo Fastify — apenas via endpoint autenticado de download. Isso evita acesso direto a arquivos por URL.

## Decisões

- **Filesystem local (sem S3):** sem dependência externa, backup incluso no backup do servidor; path organizado por data facilita manutenção
- **UUID no nome:** evita conflito de nomes e torna o nome interno opaco
- **onDelete: Cascade em Lead:** ao excluir lead, arquivos também são deletados do banco (limpeza do disco fica para job futuro ou trigger manual)
- **Download via stream autenticado:** não expõe path real; Content-Disposition força download
- **Multer configurado com dest: '/tmp':** arquivo vai para temp primeiro; após validação, mover para destino final via `fs.rename`
- **Tamanho máximo 10MB por arquivo:** configurado no Multer via `limits.fileSize`
