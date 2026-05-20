# Sprint 32 — Step 04 — Felipe Santos (Backend)
# Portal do Cliente — Implementação API

## src/modules/portal/portal-auth.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { enviarEmail } from '../../lib/email'
import { registrarHistorico } from '../../lib/historico'

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET!
const PORTAL_URL = process.env.PORTAL_URL ?? 'https://crm.prosystem.com.br'
const MAX_TENTATIVAS = 5
const BLOQUEIO_MIN = 15

function gerarSenhaTemporaria(): string {
  return crypto.randomBytes(5).toString('base64url').slice(0, 8)
}

export async function convidarCliente(leadId: string, usuarioId: string, prisma: PrismaClient) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, nome: true, email: true, vendedor: { select: { nome: true, email: true, telefone: true } } },
  })
  if (!lead) throw Object.assign(new Error('Lead não encontrado'), { statusCode: 404 })
  if (!lead.email) throw Object.assign(new Error('Lead sem e-mail cadastrado'), { statusCode: 400 })

  const senhaTemp = gerarSenhaTemporaria()
  const senhaHash = await bcrypt.hash(senhaTemp, 12)

  await prisma.portalCliente.upsert({
    where: { leadId },
    create: { leadId, email: lead.email, senhaHash, ativo: true, primeiroAcesso: true },
    update: { senhaHash, primeiroAcesso: true, ativo: true, tentativasFalha: 0, bloqueadoAte: null },
  })

  await enviarEmail({
    para: lead.email,
    assunto: 'Seu acesso ao Portal ProSystem',
    html: `
      <h2>Olá, ${lead.nome}!</h2>
      <p>Seu acesso ao Portal do Cliente ProSystem foi criado.</p>
      <p><strong>Link:</strong> <a href="${PORTAL_URL}/portal/login">${PORTAL_URL}/portal/login</a></p>
      <p><strong>E-mail:</strong> ${lead.email}</p>
      <p><strong>Senha temporária:</strong> <code>${senhaTemp}</code></p>
      <p>No primeiro acesso, você será solicitado a criar uma nova senha.</p>
      <hr/>
      <p>Dúvidas? Fale com ${lead.vendedor?.nome ?? 'seu vendedor'}: ${lead.vendedor?.email ?? ''}</p>
    `,
  })

  return { ok: true, email: lead.email }
}

export async function loginPortal(email: string, senha: string, prisma: PrismaClient) {
  const cliente = await prisma.portalCliente.findUnique({
    where: { email },
    include: { lead: { select: { nome: true, empresa: true } } },
  })

  if (!cliente || !cliente.ativo) {
    throw Object.assign(new Error('Credenciais inválidas'), { statusCode: 401 })
  }

  // Verificar bloqueio
  if (cliente.bloqueadoAte && cliente.bloqueadoAte > new Date()) {
    const minutos = Math.ceil((cliente.bloqueadoAte.getTime() - Date.now()) / 60000)
    throw Object.assign(new Error(`Conta bloqueada. Tente novamente em ${minutos} minuto(s)`), { statusCode: 429 })
  }

  const senhaOk = await bcrypt.compare(senha, cliente.senhaHash)
  if (!senhaOk) {
    const novasTentativas = cliente.tentativasFalha + 1
    const bloquear = novasTentativas >= MAX_TENTATIVAS
    await prisma.portalCliente.update({
      where: { id: cliente.id },
      data: {
        tentativasFalha: novasTentativas,
        bloqueadoAte: bloquear ? new Date(Date.now() + BLOQUEIO_MIN * 60000) : undefined,
      },
    })
    throw Object.assign(new Error('Credenciais inválidas'), { statusCode: 401 })
  }

  // Reset tentativas
  await prisma.portalCliente.update({
    where: { id: cliente.id },
    data: { tentativasFalha: 0, bloqueadoAte: null },
  })

  const token = jwt.sign(
    { sub: cliente.id, leadId: cliente.leadId, email: cliente.email, primeiroAcesso: cliente.primeiroAcesso },
    PORTAL_SECRET,
    { expiresIn: '4h' }
  )

  return {
    token,
    primeiroAcesso: cliente.primeiroAcesso,
    cliente: { nome: cliente.lead.nome, empresa: cliente.lead.empresa },
  }
}

export async function alterarSenhaPortal(clienteId: string, novaSenha: string, prisma: PrismaClient) {
  if (novaSenha.length < 8) throw Object.assign(new Error('Senha mínima: 8 caracteres'), { statusCode: 400 })
  const senhaHash = await bcrypt.hash(novaSenha, 12)
  await prisma.portalCliente.update({
    where: { id: clienteId },
    data: { senhaHash, primeiroAcesso: false },
  })
  return { ok: true }
}
```

## src/modules/portal/portal-data.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { registrarHistorico } from '../../lib/historico'
import { sseHub } from '../../lib/sse-hub'

const HISTORICO_PUBLICO = ['mensagem_respondida', 'proposta_enviada', 'proposta_aprovada_portal', 'contrato_criado']

export async function getDashboardPortal(leadId: string, prisma: PrismaClient) {
  const [propostasPendentes, contratosAtivos, lead] = await Promise.all([
    prisma.proposta.count({ where: { leadId, status: 'AGUARDANDO_APROVACAO' } }),
    prisma.contrato.count({ where: { leadId, status: 'ATIVO' } }),
    prisma.lead.findUnique({
      where: { id: leadId },
      select: { nome: true, empresa: true, vendedor: { select: { nome: true, email: true, telefone: true } } },
    }),
  ])

  return { propostasPendentes, contratosAtivos, lead }
}

export async function getPropostas(leadId: string, prisma: PrismaClient) {
  return prisma.proposta.findMany({
    where: { leadId },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, numero: true, titulo: true, status: true, valorTotal: true, criadoEm: true, validadeAte: true },
  })
}

export async function getPropostaDetalhe(id: string, leadId: string, prisma: PrismaClient) {
  const proposta = await prisma.proposta.findFirst({
    where: { id, leadId },
    include: { itens: true },
  })
  if (!proposta) throw Object.assign(new Error('Proposta não encontrada'), { statusCode: 404 })
  return proposta
}

export async function aprovarProposta(id: string, leadId: string, prisma: PrismaClient) {
  const proposta = await prisma.proposta.findFirst({ where: { id, leadId, status: 'AGUARDANDO_APROVACAO' } })
  if (!proposta) throw Object.assign(new Error('Proposta não encontrada ou não pendente'), { statusCode: 404 })

  await prisma.proposta.update({ where: { id }, data: { status: 'APROVADA' } })

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })

  await registrarHistorico({
    leadId,
    tipoEvento: 'proposta_aprovada_portal',
    descricao: `Proposta ${proposta.numero} aprovada pelo cliente via portal`,
    usuarioId: null,
  }, prisma)

  if (lead?.vendedorId) {
    sseHub.notificarUsuario(lead.vendedorId, {
      tipo: 'proposta_aprovada_portal',
      leadId,
      propostaId: id,
      numero: proposta.numero,
    })
  }

  return { ok: true }
}

export async function recusarProposta(id: string, leadId: string, motivo: string | undefined, prisma: PrismaClient) {
  const proposta = await prisma.proposta.findFirst({ where: { id, leadId, status: 'AGUARDANDO_APROVACAO' } })
  if (!proposta) throw Object.assign(new Error('Proposta não encontrada ou não pendente'), { statusCode: 404 })

  await prisma.proposta.update({ where: { id }, data: { status: 'RECUSADA', motivoPerda: motivo } })

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })

  await registrarHistorico({
    leadId,
    tipoEvento: 'proposta_recusada_portal',
    descricao: `Proposta ${proposta.numero} recusada pelo cliente via portal${motivo ? `: "${motivo}"` : ''}`,
    usuarioId: null,
  }, prisma)

  if (lead?.vendedorId) {
    sseHub.notificarUsuario(lead.vendedorId, {
      tipo: 'proposta_recusada_portal',
      leadId,
      propostaId: id,
      numero: proposta.numero,
      motivo,
    })
  }

  return { ok: true }
}

export async function getContratos(leadId: string, prisma: PrismaClient) {
  return prisma.contrato.findMany({
    where: { leadId },
    orderBy: { criadoEm: 'desc' },
    include: { servicosContratados: { select: { nome: true, valorMensal: true, status: true } } },
  })
}

export async function getServicos(leadId: string, prisma: PrismaClient) {
  return prisma.servicoContratado.findMany({
    where: { contrato: { leadId } },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, nome: true, valorMensal: true, status: true, dataInicio: true, dataRenovacao: true },
  })
}

export async function getHistoricoPublico(leadId: string, prisma: PrismaClient) {
  return prisma.historicoLead.findMany({
    where: { leadId, tipoEvento: { in: HISTORICO_PUBLICO as any[] } },
    orderBy: { criadoEm: 'desc' },
    take: 50,
    select: { id: true, tipoEvento: true, descricao: true, criadoEm: true },
  })
}

export async function registrarAcesso(portalClienteId: string, rota: string, ip: string | undefined, prisma: PrismaClient) {
  await prisma.portalAcesso.create({
    data: { portalClienteId, rota, ip: ip ?? null },
  }).catch(() => {}) // não bloquear se falhar
}

export async function getAcessos(portalClienteId: string, prisma: PrismaClient) {
  return prisma.portalAcesso.findMany({
    where: { portalClienteId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
}
```

## src/modules/portal/portal.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma'
import * as auth from './portal-auth.service'
import * as data from './portal-data.service'

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET!
const PERFIS_CRM = ['VENDEDOR', 'SUPERVISAO', 'CEO', 'ADMIN']

async function portalAuthenticate(req: any, reply: any) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.code(401).send({ error: 'Token obrigatório' })
  try {
    req.portalUser = jwt.verify(token, PORTAL_SECRET)
  } catch {
    return reply.code(401).send({ error: 'Token inválido ou expirado' })
  }
}

async function portalAccessLog(req: any) {
  if (!req.portalUser?.sub) return
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip
  await data.registrarAcesso(req.portalUser.sub, req.url, ip, prisma)
}

export async function portalRoutes(fastify: FastifyInstance) {
  // === ÁREA PÚBLICA ===
  fastify.post('/portal/api/auth/login', async (req, reply) => {
    const { email, senha } = req.body as { email: string; senha: string }
    return reply.send(await auth.loginPortal(email, senha, prisma))
  })

  // === ÁREA DO CLIENTE (Portal JWT) ===
  fastify.post('/portal/api/auth/alterar-senha',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => {
      const { novaSenha } = req.body as { novaSenha: string }
      return reply.send(await auth.alterarSenhaPortal(req.portalUser.sub, novaSenha, prisma))
    }
  )

  fastify.get('/portal/api/dashboard',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getDashboardPortal(req.portalUser.leadId, prisma))
  )

  fastify.get('/portal/api/propostas',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getPropostas(req.portalUser.leadId, prisma))
  )

  fastify.get('/portal/api/propostas/:id',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getPropostaDetalhe(req.params.id, req.portalUser.leadId, prisma))
  )

  fastify.patch('/portal/api/propostas/:id/aprovar',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.aprovarProposta(req.params.id, req.portalUser.leadId, prisma))
  )

  fastify.patch('/portal/api/propostas/:id/recusar',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => {
      const { motivo } = req.body as { motivo?: string }
      return reply.send(await data.recusarProposta(req.params.id, req.portalUser.leadId, motivo, prisma))
    }
  )

  fastify.get('/portal/api/contratos',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getContratos(req.portalUser.leadId, prisma))
  )

  fastify.get('/portal/api/servicos',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getServicos(req.portalUser.leadId, prisma))
  )

  fastify.get('/portal/api/historico',
    { preHandler: [portalAuthenticate, portalAccessLog] },
    async (req: any, reply) => reply.send(await data.getHistoricoPublico(req.portalUser.leadId, prisma))
  )

  // === ÁREA INTERNA CRM ===
  fastify.post('/api/portal-clientes/convidar',
    { preHandler: [fastify.authenticate] },
    async (req: any, reply) => {
      const { leadId } = req.body as { leadId: string }
      if (!PERFIS_CRM.includes(req.user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
      return reply.send(await auth.convidarCliente(leadId, req.user.id, prisma))
    }
  )

  fastify.get('/api/portal-clientes/:id/acessos',
    { preHandler: [fastify.authenticate] },
    async (req: any, reply) => reply.send(await data.getAcessos(req.params.id, prisma))
  )
}
```

## Registro no server.ts

```typescript
import { portalRoutes } from './modules/portal/portal.routes'
fastify.register(portalRoutes)
```
