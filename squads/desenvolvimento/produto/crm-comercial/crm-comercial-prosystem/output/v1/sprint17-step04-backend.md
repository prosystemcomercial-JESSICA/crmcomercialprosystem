# Sprint 17 — Step 04 — Felipe Santos (Backend)
# Arquivos e Anexos — Implementação API

## Dependências

```bash
npm install multer @types/multer
# multer já foi adicionado no Sprint 12 — sem nova instalação necessária
```

## arquivo.service.ts

```typescript
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { registrarHistorico } from '../../lib/historico'
import { buildUploadPath, ensureDir, deleteFile, MIME_ACEITOS } from './arquivo.storage'

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function uploadArquivo(params: {
  leadId: string
  propostaId?: string
  file: Express.Multer.File
  uploadadoPorId: string
}, prisma: PrismaClient) {
  const { leadId, propostaId, file, uploadadoPorId } = params

  // Valida MIME
  if (!MIME_ACEITOS[file.mimetype]) {
    await deleteFile(file.path) // limpa temp
    throw Object.assign(new Error('Tipo de arquivo não permitido'), { statusCode: 400 })
  }

  // Valida tamanho (Multer já controla, mas double-check)
  if (file.size > MAX_BYTES) {
    await deleteFile(file.path)
    throw Object.assign(new Error('Arquivo muito grande (máx. 10MB)'), { statusCode: 413 })
  }

  const { rel, abs, nomeArquivo } = buildUploadPath(leadId, file.originalname)
  await ensureDir(abs)
  await fs.rename(file.path, abs) // move de /tmp para destino final

  const arquivo = await prisma.arquivo.create({
    data: {
      leadId,
      propostaId: propostaId ?? null,
      nomeOriginal: file.originalname,
      nomeArquivo,
      caminho: rel,
      mimeType: file.mimetype,
      tamanhoBytes: file.size,
      uploadadoPorId,
    },
    include: { uploadadoPor: { select: { nome: true } } },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'campo_alterado',
    descricao: `Arquivo anexado: "${file.originalname}"`,
    valorNovo: arquivo.id,
    usuarioId: uploadadoPorId,
  }, prisma)

  return arquivo
}

export async function listarArquivos(leadId: string, prisma: PrismaClient) {
  return prisma.arquivo.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadadoPor: { select: { nome: true } },
      proposta: { select: { id: true, numero: true } },
    },
  })
}

export function getArquivoStream(caminho: string) {
  const abs = path.join(process.cwd(), 'uploads', caminho)
  return createReadStream(abs)
}

export async function excluirArquivo(
  id: string,
  usuarioId: string,
  perfil: string,
  prisma: PrismaClient
) {
  const arquivo = await prisma.arquivo.findUnique({
    where: { id },
    select: { id: true, caminho: true, uploadadoPorId: true, leadId: true, nomeOriginal: true },
  })
  if (!arquivo) throw Object.assign(new Error('Arquivo não encontrado'), { statusCode: 404 })

  const podeExcluir = perfil !== 'VENDEDOR' || arquivo.uploadadoPorId === usuarioId
  if (!podeExcluir) throw Object.assign(new Error('Sem permissão para excluir este arquivo'), { statusCode: 403 })

  await prisma.arquivo.delete({ where: { id } })
  await deleteFile(path.join(process.cwd(), 'uploads', arquivo.caminho))

  await registrarHistorico({
    leadId: arquivo.leadId,
    tipoEvento: 'campo_alterado',
    descricao: `Arquivo removido: "${arquivo.nomeOriginal}"`,
    valorAnterior: id,
    usuarioId,
  }, prisma)
}
```

## arquivo.storage.ts

```typescript
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'

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

export function buildUploadPath(leadId: string, nomeOriginal: string) {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const ext = path.extname(nomeOriginal).toLowerCase()
  const nomeSafe = path.basename(nomeOriginal, ext).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)
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
  try { await fs.unlink(absPath) } catch { /* ignorar */ }
}
```

## arquivo.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import multer from 'multer'
import { prisma } from '../../lib/prisma'
import { uploadArquivo, listarArquivos, getArquivoStream, excluirArquivo } from './arquivo.service'

const upload = multer({
  dest: '/tmp/arquivos',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

export async function arquivoRoutes(fastify: FastifyInstance) {
  // POST /api/leads/:leadId/arquivos
  fastify.post(
    '/leads/:leadId/arquivos',
    { preHandler: [fastify.authenticate, upload.single('arquivo')] },
    async (req, reply) => {
      const { leadId } = req.params as any
      const { propostaId } = req.body as any
      const file = (req as any).file
      const userId = (req as any).user.id

      if (!file) return reply.code(400).send({ error: 'Arquivo obrigatório' })

      // VENDEDOR só pode upload em seus próprios leads
      const perfil = (req as any).user.perfil
      if (perfil === 'VENDEDOR') {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })
        if (lead?.vendedorId !== userId) return reply.code(403).send({ error: 'Acesso negado' })
      }

      const arquivo = await uploadArquivo({ leadId, propostaId, file, uploadadoPorId: userId }, prisma)
      return reply.code(201).send(arquivo)
    }
  )

  // GET /api/leads/:leadId/arquivos
  fastify.get('/leads/:leadId/arquivos', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    const userId  = (req as any).user.id
    const perfil  = (req as any).user.perfil

    if (perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })
      if (lead?.vendedorId !== userId) return reply.code(403).send({ error: 'Acesso negado' })
    }

    const arquivos = await listarArquivos(leadId, prisma)
    return reply.send(arquivos)
  })

  // GET /api/arquivos/:id/download
  fastify.get('/arquivos/:id/download', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const arquivo = await prisma.arquivo.findUnique({
      where: { id },
      select: { caminho: true, mimeType: true, nomeOriginal: true, tamanhoBytes: true, lead: { select: { vendedorId: true } } },
    })

    if (!arquivo) return reply.code(404).send({ error: 'Arquivo não encontrado' })

    const perfil = (req as any).user.perfil
    const userId = (req as any).user.id
    if (perfil === 'VENDEDOR' && arquivo.lead.vendedorId !== userId) {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    const stream = getArquivoStream(arquivo.caminho)
    return reply
      .header('Content-Type', arquivo.mimeType)
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(arquivo.nomeOriginal)}"`)
      .header('Content-Length', arquivo.tamanhoBytes)
      .send(stream)
  })

  // DELETE /api/arquivos/:id
  fastify.delete('/arquivos/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id }   = req.params as any
    const userId   = (req as any).user.id
    const perfil   = (req as any).user.perfil

    await excluirArquivo(id, userId, perfil, prisma)
    return reply.send({ ok: true })
  })
}
```

## Registro no server.ts

```typescript
import { arquivoRoutes } from './modules/arquivo/arquivo.routes'
fastify.register(arquivoRoutes) // sem prefix global — rotas têm paths diferentes
```

## .gitignore — ignorar diretório de uploads

```gitignore
# Adicionar:
uploads/
```
