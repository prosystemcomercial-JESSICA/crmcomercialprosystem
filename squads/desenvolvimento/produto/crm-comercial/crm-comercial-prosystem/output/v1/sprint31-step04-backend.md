# Sprint 31 — Step 04 — Felipe Santos (Backend)
# App Mobile — Push Tokens API + Integração Push

## src/lib/expo-push.ts

```typescript
import { PrismaClient } from '@prisma/client'

interface PushMessage {
  to: string
  title: string
  body: string
  data?: object
  sound?: 'default' | null
  badge?: number
}

export async function enviarPushParaUsuario(
  usuarioId: string,
  titulo: string,
  mensagem: string,
  data: object,
  prisma: PrismaClient
) {
  const tokens = await prisma.pushToken.findMany({
    where: { usuarioId },
    select: { token: true },
  })
  if (!tokens.length) return

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: titulo,
    body: mensagem,
    data,
    sound: 'default',
  }))

  // Expo Push API aceita até 100 mensagens por batch
  const chunks: PushMessage[][] = []
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(chunk),
    }).catch(console.error)
  }
}
```

## src/modules/push/push.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function pushRoutes(fastify: FastifyInstance) {
  // POST /api/push-tokens — registrar/atualizar token
  fastify.post('/push-tokens', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const usuarioId = (req as any).user.id
    const { token, plataforma } = req.body as { token: string; plataforma: string }

    if (!token || !plataforma) {
      return reply.code(400).send({ error: 'token e plataforma obrigatórios' })
    }

    // Upsert pelo token (token pode mudar; upsert por usuário+plataforma seria alternativa)
    await prisma.pushToken.upsert({
      where: { token },
      create: { usuarioId, token, plataforma },
      update: { usuarioId, plataforma }, // reatribuir se token foi de outro usuário
    })

    return reply.code(201).send({ ok: true })
  })

  // DELETE /api/push-tokens/:token — remover ao fazer logout
  fastify.delete(
    '/push-tokens/:token',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      await prisma.pushToken.deleteMany({
        where: { token, usuarioId: (req as any).user.id },
      })
      return reply.send({ ok: true })
    }
  )
}
```

## Integração Push nos Crons Existentes

### Cron de atividades vencidas (00:05 — atualizar para incluir push)

```typescript
// src/crons/atividades-vencidas.cron.ts
// Adicionar ao final do loop de atividades vencidas:

import { enviarPushParaUsuario } from '../lib/expo-push'

// Após identificar atividades vencidas de cada vendedor:
for (const vendedorId of vendedoresComAtividadesVencidas) {
  const contagem = atividadesPorVendedor[vendedorId]
  await enviarPushParaUsuario(
    vendedorId,
    'Atividades vencidas',
    `Você tem ${contagem} atividade${contagem > 1 ? 's' : ''} vencida${contagem > 1 ? 's' : ''} hoje`,
    { screen: 'leads' },
    prisma
  ).catch(console.error)
}
```

### Cron de eventos próximos (a cada hora +05min)

```typescript
// Adicionar push ao cron de lembrete de agenda:
await enviarPushParaUsuario(
  evento.lead?.vendedorId ?? evento.organizadorId,
  `Evento em 15 minutos`,
  `${evento.titulo} às ${formatHora(evento.dataInicio)}`,
  { screen: 'agenda', eventoId: evento.id },
  prisma
).catch(console.error)
```

### Webhook WhatsApp (processarMensagemInbound)

```typescript
// Adicionar ao final do handler de mensagem recebida:
if (conversaAtualizada?.lead?.vendedorId) {
  await enviarPushParaUsuario(
    conversaAtualizada.lead.vendedorId,
    `WhatsApp de ${conversaAtualizada.lead?.nome ?? conversaAtualizada.telefone}`,
    texto?.slice(0, 80) ?? '[mídia recebida]',
    { screen: 'conversas', leadId: conversaAtualizada.leadId },
    prisma
  ).catch(console.error)
}
```

## Registro no server.ts

```typescript
import { pushRoutes } from './modules/push/push.routes'

fastify.register(pushRoutes, { prefix: '/api' })
```
