# Sprint 12 — Step 03 — Daniel Mendes (Tech Lead)
# Importação de Leads — Arquitetura e Modelagem

## Novos modelos Prisma

```prisma
model ImportacaoLead {
  id              String   @id @default(cuid())
  nomeArquivo     String
  tipoArquivo     String   // "csv" | "xlsx"
  totalLinhas     Int      @default(0)
  totalValidos    Int      @default(0)
  totalErros      Int      @default(0)
  totalDuplicatas Int      @default(0)
  totalImportados Int      @default(0)
  status          ImportacaoStatus @default(PENDENTE)
  mapeamento      Json     // { colunaArquivo: campoCRM }
  distribuicao    Json     // { modo, vendedorIds?, segmento?, colunaArquivo? }
  erros           Json?    // array de { linha, campo, mensagem }
  duplicatas      Json?    // array de { linha, campo, valorDuplicado, leadId }
  criadoPorId     String
  criadoPor       User     @relation(fields: [criadoPorId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("importacoes_lead")
}

model MapeamentoColunas {
  id          String   @id @default(cuid())
  nome        String
  tipoArquivo String   // "csv" | "xlsx"
  mapeamento  Json     // { colunaArquivo: campoCRM }
  criadoPorId String
  criadoPor   User     @relation(fields: [criadoPorId], references: [id])
  createdAt   DateTime @default(now())

  @@map("mapeamentos_colunas")
}

enum ImportacaoStatus {
  PENDENTE
  VALIDANDO
  AGUARDANDO_CONFIRMACAO
  PROCESSANDO
  CONCLUIDO
  ERRO
}
```

## Campos CRM mapeáveis (target)

```typescript
export const CAMPOS_CRM_IMPORTACAO = [
  { campo: 'nomeEmpresa',       label: 'Nome da Empresa',     obrigatorio: true  },
  { campo: 'whatsapp',          label: 'WhatsApp',            obrigatorio: false },
  { campo: 'email',             label: 'E-mail',              obrigatorio: false },
  { campo: 'cnpj',              label: 'CNPJ',                obrigatorio: false },
  { campo: 'segmento',          label: 'Segmento',            obrigatorio: false },
  { campo: 'origem',            label: 'Origem',              obrigatorio: false },
  { campo: 'cidade',            label: 'Cidade',              obrigatorio: false },
  { campo: 'estado',            label: 'Estado',              obrigatorio: false },
  { campo: 'contato',           label: 'Nome do Contato',     obrigatorio: false },
  { campo: 'telefone',          label: 'Telefone',            obrigatorio: false },
  { campo: 'potencialMensalidade', label: 'Potencial Mensalidade', obrigatorio: false },
  { campo: 'observacao',        label: 'Observação',          obrigatorio: false },
] as const
```

## Detecção automática de colunas

```typescript
// Mapeamento heurístico: normaliza cabeçalho do arquivo → campo CRM
const HEURISTICAS: Record<string, string> = {
  'empresa': 'nomeEmpresa', 'nome empresa': 'nomeEmpresa', 'razao social': 'nomeEmpresa',
  'whatsapp': 'whatsapp', 'celular': 'whatsapp', 'fone': 'whatsapp', 'telefone celular': 'whatsapp',
  'email': 'email', 'e-mail': 'email',
  'cnpj': 'cnpj',
  'segmento': 'segmento', 'ramo': 'segmento', 'setor': 'segmento',
  'origem': 'origem', 'como conheceu': 'origem',
  'cidade': 'cidade', 'municipio': 'cidade',
  'estado': 'estado', 'uf': 'estado',
  'contato': 'contato', 'responsavel': 'contato',
  'telefone': 'telefone', 'fone fixo': 'telefone',
  'mensalidade': 'potencialMensalidade', 'valor': 'potencialMensalidade',
  'obs': 'observacao', 'observacao': 'observacao', 'observação': 'observacao',
}

export function detectarMapeamento(cabecalhos: string[]): Record<string, string> {
  return Object.fromEntries(
    cabecalhos.map(col => {
      const normalizado = col.toLowerCase().trim().replace(/[_-]/g, ' ')
      return [col, HEURISTICAS[normalizado] ?? '']
    })
  )
}
```

## Lógica de deduplicação

```typescript
// Prioridade: CNPJ > WhatsApp > e-mail
// Qualquer match = duplicata
async function detectarDuplicatas(
  linhas: ParsedRow[],
  prisma: PrismaClient
): Promise<DuplicataResult[]> {
  const cnpjs    = linhas.map(r => r.cnpj).filter(Boolean)
  const whatsapps = linhas.map(r => normalizePhone(r.whatsapp)).filter(Boolean)
  const emails   = linhas.map(r => r.email?.toLowerCase()).filter(Boolean)

  const [leadsPorCnpj, leadsPorWpp, leadsPorEmail] = await Promise.all([
    prisma.lead.findMany({ where: { cnpj: { in: cnpjs } }, select: { id: true, cnpj: true } }),
    prisma.lead.findMany({ where: { whatsapp: { in: whatsapps } }, select: { id: true, whatsapp: true } }),
    prisma.lead.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }),
  ])

  // Monta maps para lookup O(1)
  const mapCnpj  = new Map(leadsPorCnpj.map(l => [l.cnpj, l.id]))
  const mapWpp   = new Map(leadsPorWpp.map(l => [l.whatsapp, l.id]))
  const mapEmail = new Map(leadsPorEmail.map(l => [l.email, l.id]))

  return linhas.flatMap((row, i) => {
    const dups: DuplicataResult[] = []
    if (row.cnpj && mapCnpj.has(row.cnpj))
      dups.push({ linha: i + 2, campo: 'cnpj', valorDuplicado: row.cnpj, leadId: mapCnpj.get(row.cnpj)! })
    else if (row.whatsapp && mapWpp.has(normalizePhone(row.whatsapp)))
      dups.push({ linha: i + 2, campo: 'whatsapp', valorDuplicado: row.whatsapp, leadId: mapWpp.get(normalizePhone(row.whatsapp))! })
    else if (row.email && mapEmail.has(row.email.toLowerCase()))
      dups.push({ linha: i + 2, campo: 'email', valorDuplicado: row.email, leadId: mapEmail.get(row.email.toLowerCase())! })
    return dups
  })
}
```

## Round-robin distribution

```typescript
export function distribuirRoundRobin(
  leads: ParsedRow[],
  vendedorIds: string[]
): Map<string, ParsedRow[]> {
  const mapa = new Map<string, ParsedRow[]>(vendedorIds.map(id => [id, []]))
  leads.forEach((lead, i) => {
    const vendedorId = vendedorIds[i % vendedorIds.length]
    mapa.get(vendedorId)!.push(lead)
  })
  return mapa
}
```

## Arquitetura async com SSE

```
POST /api/importacao/upload
  → parse arquivo (multer/busboy, máx 5MB)
  → detectar mapeamento automático
  → salva ImportacaoLead { status: PENDENTE }
  → retorna { importacaoId, cabecalhos, mapeamentoDetectado }

POST /api/importacao/:id/validar   (body: { mapeamento })
  → atualiza mapeamento no registro
  → roda validação + deduplicação síncrona (arquivo já em memória/temp)
  → salva erros[], duplicatas[], totalValidos, totalErros, totalDuplicatas
  → status → AGUARDANDO_CONFIRMACAO
  → retorna preview 10 linhas válidas + contadores + erros + duplicatas

POST /api/importacao/:id/executar  (body: { distribuicao, ignorarErros, ignorarDuplicatas })
  → status → PROCESSANDO
  → dispara job assíncrono (setImmediate / worker_threads)
  → retorna { jobId }

GET  /api/importacao/:id/progresso  (SSE)
  → stream de eventos: { processados, total, status }
  → ao concluir: { status: 'CONCLUIDO', totalImportados, relatório }

GET  /api/importacao
  → lista histórico de importações do usuário (paginada)

GET  /api/importacao/:id/relatorio
  → relatório completo pós-importação
```

## Job assíncrono (sem Bull — processar em-process com chunks)

```typescript
// Sem dependência externa; processa em lotes de 50
async function executarImportacaoJob(
  importacaoId: string,
  linhasValidas: ParsedRow[],
  distribuicao: DistribuicaoConfig,
  prisma: PrismaClient,
  emitProgress: (processados: number, total: number) => void
) {
  const CHUNK = 50
  let processados = 0

  const leadsParaCriar = prepararLeads(linhasValidas, distribuicao)

  for (let i = 0; i < leadsParaCriar.length; i += CHUNK) {
    const chunk = leadsParaCriar.slice(i, i + CHUNK)
    await prisma.lead.createMany({ data: chunk, skipDuplicates: false })
    processados += chunk.length
    emitProgress(processados, leadsParaCriar.length)
    // yield para event loop a cada chunk
    await new Promise(resolve => setImmediate(resolve))
  }

  await prisma.importacaoLead.update({
    where: { id: importacaoId },
    data: { status: 'CONCLUIDO', totalImportados: processados, updatedAt: new Date() }
  })
}
```

## SSE endpoint pattern

```typescript
fastify.get('/api/importacao/:id/progresso', async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const send = (data: object) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Registra listener no emitter global do job
  importJobEmitter.on(`progress:${req.params.id}`, send)
  req.raw.on('close', () => importJobEmitter.off(`progress:${req.params.id}`, send))
})
```

## Template CSV

```
nomeEmpresa,whatsapp,email,cnpj,segmento,origem,cidade,estado,contato,telefone,potencialMensalidade,observacao
Farmácia Exemplo,(11)99999-0001,exemplo@farm.com,12.345.678/0001-90,Farmácia,Indicação,São Paulo,SP,João Silva,(11)3333-0001,890.00,Cliente interessado
Padaria Modelo,(11)99999-0002,contato@padaria.com,98.765.432/0001-10,Padaria,Google,Campinas,SP,Maria Souza,(19)3333-0002,650.00,
```

## Decisões técnicas

- **Sem Bull/Redis:** processamento em-process com setImmediate entre chunks de 50 — elimina dependência externa, suficiente para 5000 leads
- **SSE em vez de WebSocket:** mais simples (unidirecional), sem upgrade de protocolo, funciona com Fastify sem plugin extra
- **Arquivo temporário:** multer salva em /tmp com TTL implícito; após CONCLUIDO/ERRO limpar com fs.unlink
- **Mapeamento salvo em JSON:** evita tabela pivot complexa; consulta o JSON direto no createMany
- **createMany com skipDuplicates:false:** deduplicação já foi feita na etapa de validação; não repete trabalho
- **EventEmitter global:** único por processo Fastify; sem estado distribuído necessário para escala atual

## Impacto em módulos existentes

- Lead list: filtro `importacaoId` adicionado ao GET /api/leads para o botão "Ver leads importados"
- Nenhum modelo existente alterado — apenas campos `importacaoId String?` no Lead
