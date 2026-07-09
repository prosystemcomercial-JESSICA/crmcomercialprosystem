import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const TIPOS_VALIDOS = ['CONTRATO', 'COMPROVANTE', 'IDENTIDADE', 'NOTA_FISCAL', 'OUTRO'] as const;
const MIME_VALIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const LIMITE_BYTES = 8 * 1024 * 1024; // 8MB

export async function clienteDocumentosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Listar documentos de um cliente (sem o conteúdo binário — só metadados)
  fastify.get('/clientes/:clienteId/documentos', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const docs = await prisma.clienteDocumento.findMany({
      where: { cliente_id: clienteId },
      select: {
        id: true, nome: true, tipo: true, mime_type: true,
        tamanho: true, descricao: true, enviado_por_nome: true, created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: docs });
  });

  // Download / visualização de um documento (retorna conteúdo binário)
  fastify.get('/clientes/:clienteId/documentos/:docId/download', async (request, reply) => {
    const { clienteId, docId } = request.params as { clienteId: string; docId: string };
    const doc = await prisma.clienteDocumento.findFirst({
      where: { id: docId, cliente_id: clienteId },
      select: { nome: true, mime_type: true, conteudo: true },
    });
    if (!doc) return reply.status(404).send({ status: 'error', message: 'Documento não encontrado' });

    return reply
      .header('Content-Type', doc.mime_type)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nome)}"`)
      .header('Cache-Control', 'private, max-age=3600')
      .send(doc.conteudo);
  });

  // Upload de documento (recebe JSON com conteúdo base64)
  fastify.post('/clientes/:clienteId/documentos', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const user = (request as any).user;

    const body = z.object({
      nome: z.string().min(1).max(255),
      tipo: z.enum(TIPOS_VALIDOS).default('OUTRO'),
      mime_type: z.string(),
      conteudo_base64: z.string().min(1),
      descricao: z.string().optional(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', erros: body.error.errors });
    }

    if (!MIME_VALIDOS.includes(body.data.mime_type)) {
      return reply.status(400).send({ status: 'error', message: 'Tipo de arquivo não permitido. Use PDF ou imagens (PNG, JPG, GIF, WebP).' });
    }

    // Decodifica base64 → buffer
    let buffer: Buffer;
    try {
      const base64 = body.data.conteudo_base64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return reply.status(400).send({ status: 'error', message: 'Conteúdo base64 inválido' });
    }

    if (buffer.length > LIMITE_BYTES) {
      return reply.status(400).send({ status: 'error', message: `Arquivo muito grande. Limite: ${LIMITE_BYTES / 1024 / 1024}MB` });
    }

    // Verifica se o cliente existe
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    const doc = await prisma.clienteDocumento.create({
      data: {
        cliente_id: clienteId,
        nome: body.data.nome,
        tipo: body.data.tipo,
        mime_type: body.data.mime_type,
        tamanho: buffer.length,
        conteudo: buffer,
        descricao: body.data.descricao || null,
        enviado_por: user?.id || null,
        enviado_por_nome: user?.nome || null,
      },
      select: {
        id: true, nome: true, tipo: true, mime_type: true,
        tamanho: true, descricao: true, enviado_por_nome: true, created_at: true,
      },
    });

    return reply.status(201).send({ status: 'success', data: doc });
  });

  // Excluir documento
  fastify.delete('/clientes/:clienteId/documentos/:docId', async (request, reply) => {
    const { clienteId, docId } = request.params as { clienteId: string; docId: string };
    try {
      await prisma.clienteDocumento.deleteMany({ where: { id: docId, cliente_id: clienteId } });
      return reply.send({ status: 'success' });
    } catch {
      return reply.status(404).send({ status: 'error', message: 'Documento não encontrado' });
    }
  });
}
