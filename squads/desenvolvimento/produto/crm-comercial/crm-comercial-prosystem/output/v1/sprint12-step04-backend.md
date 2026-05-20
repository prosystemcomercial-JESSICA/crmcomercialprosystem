# Sprint 12 — Step 04 — Felipe Santos (Backend)
# Importação de Leads — Implementação API

## Migration Prisma

```sql
-- CreateEnum
CREATE TYPE "ImportacaoStatus" AS ENUM (
  'PENDENTE', 'VALIDANDO', 'AGUARDANDO_CONFIRMACAO', 'PROCESSANDO', 'CONCLUIDO', 'ERRO'
);

-- AlterTable Lead
ALTER TABLE "leads" ADD COLUMN "importacaoId" TEXT;

-- CreateTable importacoes_lead
CREATE TABLE "importacoes_lead" (
  "id"              TEXT NOT NULL,
  "nomeArquivo"     TEXT NOT NULL,
  "tipoArquivo"     TEXT NOT NULL,
  "totalLinhas"     INTEGER NOT NULL DEFAULT 0,
  "totalValidos"    INTEGER NOT NULL DEFAULT 0,
  "totalErros"      INTEGER NOT NULL DEFAULT 0,
  "totalDuplicatas" INTEGER NOT NULL DEFAULT 0,
  "totalImportados" INTEGER NOT NULL DEFAULT 0,
  "status"          "ImportacaoStatus" NOT NULL DEFAULT 'PENDENTE',
  "mapeamento"      JSONB NOT NULL DEFAULT '{}',
  "distribuicao"    JSONB NOT NULL DEFAULT '{}',
  "erros"           JSONB,
  "duplicatas"      JSONB,
  "criadoPorId"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "importacoes_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable mapeamentos_colunas
CREATE TABLE "mapeamentos_colunas" (
  "id"          TEXT NOT NULL,
  "nome"        TEXT NOT NULL,
  "tipoArquivo" TEXT NOT NULL,
  "mapeamento"  JSONB NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mapeamentos_colunas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "importacoes_lead"   ADD CONSTRAINT "importacoes_lead_criadoPorId_fkey"   FOREIGN KEY ("criadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "mapeamentos_colunas" ADD CONSTRAINT "mapeamentos_colunas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT;
```

## Dependências novas

```bash
npm install multer @types/multer xlsx papaparse @types/papaparse
```

## Estrutura de arquivos

```
src/
  modules/
    importacao/
      importacao.routes.ts
      importacao.service.ts
      importacao.schema.ts
      importacao.parser.ts       # parse CSV/XLSX → ParsedRow[]
      importacao.validator.ts    # validação de campos + duplicatas
      importacao.distributor.ts  # round-robin e por-segmento
      importacao.job.ts          # job assíncrono + SSE emitter
      importacao.template.ts     # geração do CSV template
```

## importacao.schema.ts

```typescript
import { z } from 'zod'

export const uploadResponseSchema = z.object({
  importacaoId: z.string(),
  cabecalhos: z.array(z.string()),
  mapeamentoDetectado: z.record(z.string()),
  mapeamentosSalvos: z.array(z.object({ id: z.string(), nome: z.string() })),
})

export const validarBodySchema = z.object({
  mapeamento: z.record(z.string()),           // { colArquivo: campoCRM | '' }
  salvarMapeamento: z.boolean().optional(),
  nomeMapeamento: z.string().optional(),
})

export const executarBodySchema = z.object({
  distribuicao: z.discriminatedUnion('modo', [
    z.object({ modo: z.literal('manual'),     vendedorId: z.string() }),
    z.object({ modo: z.literal('round-robin'), vendedorIds: z.array(z.string()).min(1) }),
    z.object({ modo: z.literal('segmento'),   mapeamentoSegmento: z.record(z.string()) }),
    z.object({ modo: z.literal('coluna'),     colunaArquivo: z.string() }),
  ]),
  ignorarErros:      z.boolean().default(false),
  ignorarDuplicatas: z.boolean().default(false),
})
```

## importacao.parser.ts

```typescript
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import path from 'path'

export type ParsedRow = Record<string, string>

export function parseArquivo(filePath: string, originalName: string): {
  cabecalhos: string[]
  linhas: ParsedRow[]
} {
  const ext = path.extname(originalName).toLowerCase()

  if (ext === '.csv') {
    const content = require('fs').readFileSync(filePath, 'utf-8')
    const result = Papa.parse<ParsedRow>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    })
    return { cabecalhos: result.meta.fields ?? [], linhas: result.data }
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(filePath)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const linhas = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '' })
    const cabecalhos = Object.keys(linhas[0] ?? {})
    return { cabecalhos, linhas }
  }

  throw new Error('Formato não suportado. Use CSV ou XLSX.')
}
```

## importacao.validator.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { ParsedRow } from './importacao.parser'

export type ErroValidacao   = { linha: number; campo: string; mensagem: string }
export type DuplicataInfo   = { linha: number; campo: string; valorDuplicado: string; leadId: string }

function normalizePhone(v: string) {
  return v.replace(/\D/g, '')
}

export async function validarLinhas(
  linhas: ParsedRow[],
  mapeamento: Record<string, string>,
  prisma: PrismaClient
): Promise<{
  validas: ParsedRow[]
  erros: ErroValidacao[]
  duplicatas: DuplicataInfo[]
}> {
  const erros: ErroValidacao[]    = []
  const candidatas: ParsedRow[]   = []

  // 1. Validação estrutural
  linhas.forEach((row, idx) => {
    const linha = idx + 2 // +1 header +1 base-1
    const mapped = mapear(row, mapeamento)

    if (!mapped.nomeEmpresa?.trim()) {
      erros.push({ linha, campo: 'nomeEmpresa', mensagem: 'Nome da empresa é obrigatório' })
      return
    }
    if (!mapped.whatsapp && !mapped.email && !mapped.cnpj) {
      erros.push({ linha, campo: 'identificador', mensagem: 'Informe WhatsApp, e-mail ou CNPJ para deduplicação' })
      return
    }
    candidatas.push({ ...mapped, _linha: String(linha) })
  })

  // 2. Deduplicação
  const duplicatas = await detectarDuplicatas(candidatas, prisma)
  const linhasDuplicadas = new Set(duplicatas.map(d => d.linha))
  const validas = candidatas.filter(r => !linhasDuplicadas.has(Number(r._linha)))

  return { validas, erros, duplicatas }
}

function mapear(row: ParsedRow, mapeamento: Record<string, string>): ParsedRow {
  const mapped: ParsedRow = {}
  for (const [colArquivo, campoCRM] of Object.entries(mapeamento)) {
    if (campoCRM) mapped[campoCRM] = row[colArquivo] ?? ''
  }
  return mapped
}

async function detectarDuplicatas(linhas: ParsedRow[], prisma: PrismaClient): Promise<DuplicataInfo[]> {
  const cnpjs     = [...new Set(linhas.map(r => r.cnpj).filter(Boolean))]
  const whatsapps = [...new Set(linhas.map(r => normalizePhone(r.whatsapp ?? '')).filter(Boolean))]
  const emails    = [...new Set(linhas.map(r => r.email?.toLowerCase()).filter(Boolean))]

  const [byCnpj, byWpp, byEmail] = await Promise.all([
    cnpjs.length     ? prisma.lead.findMany({ where: { cnpj: { in: cnpjs } }, select: { id: true, cnpj: true } }) : [],
    whatsapps.length ? prisma.lead.findMany({ where: { whatsapp: { in: whatsapps } }, select: { id: true, whatsapp: true } }) : [],
    emails.length    ? prisma.lead.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : [],
  ])

  const mapCnpj  = new Map(byCnpj.map(l  => [l.cnpj,      l.id]))
  const mapWpp   = new Map(byWpp.map(l   => [l.whatsapp,   l.id]))
  const mapEmail = new Map(byEmail.map(l => [l.email,      l.id]))

  const result: DuplicataInfo[] = []
  for (const row of linhas) {
    const linha = Number(row._linha)
    if (row.cnpj && mapCnpj.has(row.cnpj))
      result.push({ linha, campo: 'cnpj', valorDuplicado: row.cnpj, leadId: mapCnpj.get(row.cnpj)! })
    else if (row.whatsapp && mapWpp.has(normalizePhone(row.whatsapp)))
      result.push({ linha, campo: 'whatsapp', valorDuplicado: row.whatsapp, leadId: mapWpp.get(normalizePhone(row.whatsapp))! })
    else if (row.email && mapEmail.has(row.email.toLowerCase()))
      result.push({ linha, campo: 'email', valorDuplicado: row.email, leadId: mapEmail.get(row.email.toLowerCase())! })
  }
  return result
}
```

## importacao.distributor.ts

```typescript
import { ParsedRow } from './importacao.parser'

export function distribuir(
  validas: ParsedRow[],
  distribuicao: any
): ParsedRow[] {
  switch (distribuicao.modo) {
    case 'manual':
      return validas.map(r => ({ ...r, vendedorId: distribuicao.vendedorId }))

    case 'round-robin': {
      const ids: string[] = distribuicao.vendedorIds
      return validas.map((r, i) => ({ ...r, vendedorId: ids[i % ids.length] }))
    }

    case 'segmento': {
      const map: Record<string, string> = distribuicao.mapeamentoSegmento
      return validas.map(r => ({ ...r, vendedorId: map[r.segmento] ?? '' }))
    }

    case 'coluna': {
      // coluna do arquivo já mapeada para vendedorId
      return validas.map(r => ({ ...r, vendedorId: r[distribuicao.colunaArquivo] ?? '' }))
    }

    default:
      return validas
  }
}
```

## importacao.job.ts

```typescript
import { EventEmitter } from 'events'
import { PrismaClient } from '@prisma/client'
import { ParsedRow } from './importacao.parser'

export const importJobEmitter = new EventEmitter()
importJobEmitter.setMaxListeners(100)

export async function executarImportacao(
  importacaoId: string,
  linhas: ParsedRow[],
  prisma: PrismaClient
) {
  const CHUNK = 50
  let processados = 0

  try {
    for (let i = 0; i < linhas.length; i += CHUNK) {
      const chunk = linhas.slice(i, i + CHUNK)

      await prisma.lead.createMany({
        data: chunk.map(r => ({
          nomeEmpresa:            r.nomeEmpresa,
          whatsapp:               r.whatsapp || null,
          email:                  r.email || null,
          cnpj:                   r.cnpj || null,
          segmento:               r.segmento || null,
          origem:                 r.origem || null,
          cidade:                 r.cidade || null,
          estado:                 r.estado || null,
          contato:                r.contato || null,
          telefone:               r.telefone || null,
          potencialMensalidade:   r.potencialMensalidade ? parseFloat(r.potencialMensalidade) : null,
          observacao:             r.observacao || null,
          vendedorId:             r.vendedorId || null,
          importacaoId,
          etapaFunil:             'primeiro-contato',
          status:                 'ativo',
        })),
      })

      processados += chunk.length
      importJobEmitter.emit(`progress:${importacaoId}`, {
        processados,
        total: linhas.length,
        status: 'PROCESSANDO',
      })

      await new Promise(resolve => setImmediate(resolve))
    }

    await prisma.importacaoLead.update({
      where: { id: importacaoId },
      data: { status: 'CONCLUIDO', totalImportados: processados },
    })

    importJobEmitter.emit(`progress:${importacaoId}`, {
      processados,
      total: linhas.length,
      status: 'CONCLUIDO',
    })
  } catch (err) {
    await prisma.importacaoLead.update({
      where: { id: importacaoId },
      data: { status: 'ERRO' },
    })
    importJobEmitter.emit(`progress:${importacaoId}`, { status: 'ERRO' })
  }
}
```

## importacao.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../../lib/prisma'
import { parseArquivo } from './importacao.parser'
import { validarLinhas } from './importacao.validator'
import { distribuir } from './importacao.distributor'
import { executarImportacao, importJobEmitter } from './importacao.job'
import { detectarMapeamento } from './importacao.service'
import { validarBodySchema, executarBodySchema } from './importacao.schema'

const upload = multer({
  dest: '/tmp/importacoes',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

// Cache temporário dos dados validados (evita re-parse no executar)
const validacaoCache = new Map<string, any>()

export async function importacaoRoutes(fastify: FastifyInstance) {
  // POST /api/importacao/upload
  fastify.post('/upload', { preHandler: [fastify.authenticate, upload.single('arquivo')] }, async (req, reply) => {
    const file = (req as any).file
    if (!file) return reply.code(400).send({ error: 'Arquivo obrigatório' })

    const { cabecalhos, linhas } = parseArquivo(file.path, file.originalname)
    const mapeamentoDetectado = detectarMapeamento(cabecalhos)

    const importacao = await prisma.importacaoLead.create({
      data: {
        nomeArquivo: file.originalname,
        tipoArquivo: path.extname(file.originalname).replace('.', ''),
        totalLinhas: linhas.length,
        mapeamento: {},
        distribuicao: {},
        criadoPorId: (req as any).user.id,
      },
    })

    // Salva linhas no cache para uso posterior
    validacaoCache.set(importacao.id, { linhas, filePath: file.path })

    const mapeamentosSalvos = await prisma.mapeamentoColunas.findMany({
      where: { criadoPorId: (req as any).user.id },
      select: { id: true, nome: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return reply.send({ importacaoId: importacao.id, cabecalhos, mapeamentoDetectado, mapeamentosSalvos })
  })

  // POST /api/importacao/:id/validar
  fastify.post('/:id/validar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const body = validarBodySchema.parse(req.body)

    const cached = validacaoCache.get(id)
    if (!cached) return reply.code(404).send({ error: 'Sessão de importação expirada. Faça upload novamente.' })

    const { validas, erros, duplicatas } = await validarLinhas(cached.linhas, body.mapeamento, prisma)

    await prisma.importacaoLead.update({
      where: { id },
      data: {
        mapeamento: body.mapeamento,
        status: 'AGUARDANDO_CONFIRMACAO',
        totalValidos: validas.length,
        totalErros: erros.length,
        totalDuplicatas: duplicatas.length,
        erros,
        duplicatas,
      },
    })

    // Salva mapeamento nomeado se solicitado
    if (body.salvarMapeamento && body.nomeMapeamento) {
      await prisma.mapeamentoColunas.create({
        data: {
          nome: body.nomeMapeamento,
          tipoArquivo: cached.linhas.length > 0 ? 'csv' : 'xlsx',
          mapeamento: body.mapeamento,
          criadoPorId: (req as any).user.id,
        },
      })
    }

    // Preview: primeiras 10 linhas válidas
    const preview = validas.slice(0, 10)

    return reply.send({
      totalValidos: validas.length,
      totalErros: erros.length,
      totalDuplicatas: duplicatas.length,
      preview,
      erros,
      duplicatas,
    })
  })

  // POST /api/importacao/:id/executar
  fastify.post('/:id/executar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const body = executarBodySchema.parse(req.body)

    const importacao = await prisma.importacaoLead.findUnique({ where: { id } })
    if (!importacao) return reply.code(404).send({ error: 'Importação não encontrada' })
    if (importacao.status !== 'AGUARDANDO_CONFIRMACAO')
      return reply.code(409).send({ error: 'Importação já processada ou não validada' })

    const cached = validacaoCache.get(id)
    if (!cached) return reply.code(404).send({ error: 'Sessão expirada. Refaça o upload.' })

    // Re-valida para obter as linhas válidas
    const { validas, duplicatas } = await validarLinhas(cached.linhas, importacao.mapeamento as any, prisma)

    let linhasParaImportar = validas
    if (body.ignorarDuplicatas) {
      // Inclui duplicatas como novos leads (sem merge)
      const linhasDuplas = duplicatas.map(d => ({ ...cached.linhas[d.linha - 2] }))
      linhasParaImportar = [...validas, ...linhasDuplas]
    }

    const linhasDistribuidas = distribuir(linhasParaImportar, body.distribuicao)

    await prisma.importacaoLead.update({
      where: { id },
      data: { status: 'PROCESSANDO' },
    })

    // Dispara job sem aguardar
    setImmediate(() => executarImportacao(id, linhasDistribuidas, prisma))

    // Limpa arquivo temporário
    fs.unlink(cached.filePath, () => {})
    validacaoCache.delete(id)

    return reply.send({ jobId: id })
  })

  // GET /api/importacao/:id/progresso  (SSE)
  fastify.get('/:id/progresso', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':   'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // Envia estado atual do banco ao conectar
    const importacao = await prisma.importacaoLead.findUnique({ where: { id } })
    if (importacao) {
      send({
        processados: importacao.totalImportados,
        total: importacao.totalValidos,
        status: importacao.status,
      })
      if (importacao.status === 'CONCLUIDO' || importacao.status === 'ERRO') {
        reply.raw.end()
        return
      }
    }

    importJobEmitter.on(`progress:${id}`, send)
    req.raw.on('close', () => importJobEmitter.off(`progress:${id}`, send))
  })

  // GET /api/importacao  — histórico
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId   = (req as any).user.id
    const perfil   = (req as any).user.perfil
    const { page = '1', limit = '20' } = req.query as any

    const where = perfil === 'VENDEDOR' ? { criadoPorId: userId } : {}

    const [total, items] = await Promise.all([
      prisma.importacaoLead.count({ where }),
      prisma.importacaoLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true, nomeArquivo: true, status: true,
          totalLinhas: true, totalImportados: true, totalErros: true, totalDuplicatas: true,
          createdAt: true,
          criadoPor: { select: { id: true, nome: true } },
        },
      }),
    ])

    return reply.send({ total, page: Number(page), items })
  })

  // GET /api/importacao/template  — download CSV template
  fastify.get('/template', async (_, reply) => {
    const csv = [
      'nomeEmpresa,whatsapp,email,cnpj,segmento,origem,cidade,estado,contato,telefone,potencialMensalidade,observacao',
      'Farmácia Exemplo,(11)99999-0001,exemplo@farm.com,12.345.678/0001-90,Farmácia,Indicação,São Paulo,SP,João Silva,(11)3333-0001,890.00,Cliente interessado',
      'Padaria Modelo,(11)99999-0002,contato@padaria.com,98.765.432/0001-10,Padaria,Google,Campinas,SP,Maria Souza,(19)3333-0002,650.00,',
    ].join('\n')

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="template-importacao-leads.csv"')
      .send('﻿' + csv) // BOM para Excel reconhecer UTF-8
  })
}
```

## Registro das rotas em server.ts

```typescript
// server.ts
import { importacaoRoutes } from './modules/importacao/importacao.routes'

fastify.register(importacaoRoutes, { prefix: '/api/importacao' })
```

## Permissões

- Upload/Validar/Executar: todos os perfis autenticados
- Histórico: VENDEDOR vê apenas suas importações; SUPERVISAO/CEO/ADMIN veem todas
- Template: público (sem auth) — facilita onboarding

## Testes unitários (jest)

```typescript
describe('importacao.validator', () => {
  it('rejeita linha sem nomeEmpresa', ...)
  it('rejeita linha sem nenhum identificador', ...)
  it('detecta duplicata por CNPJ', ...)
  it('detecta duplicata por WhatsApp normalizado', ...)
  it('detecta duplicata por e-mail case-insensitive', ...)
  it('prioriza CNPJ sobre WhatsApp na deduplicação', ...)
})

describe('importacao.distributor', () => {
  it('distribui manual: todos recebem o mesmo vendedorId', ...)
  it('round-robin balanceia corretamente', ...)
  it('round-robin com 3 vendedores e 7 leads: 3-2-2', ...)
})

describe('importacao.parser', () => {
  it('parse CSV com cabeçalho', ...)
  it('parse XLSX primeira aba', ...)
  it('rejeita formato .pdf', ...)
})
```
