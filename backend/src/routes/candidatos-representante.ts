import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { enviarEmailNovaCandidaturaRepresentante } from '@/services/email.service';

const PERFIS = ['INDICADOR', 'REPRESENTANTE', 'FRANQUEADO'] as const;
const STATUS = ['NOVO', 'EM_ANALISE', 'APROVADO', 'REPROVADO'] as const;

const CandidatoSchema = z.object({
  nome:             z.string().min(1),
  empresa:          z.string().optional(),
  nome_fantasia:    z.string().optional(),
  cnpj:             z.string().optional(),
  cpf_responsavel:  z.string().optional(),
  telefone:         z.string().min(1),
  email:            z.string().email(),
  cidade:           z.string().optional(),
  estado:           z.string().optional(),
  perfil_desejado:  z.enum(PERFIS),
  respostas_detalhadas: z.record(z.any()),
});

const UpdateSchema = z.object({
  status:                z.enum(STATUS).optional(),
  observacoes_internas:  z.string().optional(),
});

// Campos retornados na listagem — sem `respostas_detalhadas` (payload leve do kanban).
const CAMPOS_LISTA = {
  id: true, nome: true, empresa: true, nome_fantasia: true, cnpj: true,
  cpf_responsavel: true, telefone: true, email: true, cidade: true, estado: true,
  perfil_desejado: true, status: true, observacoes_internas: true,
  created_at: true, updated_at: true,
} as const;

export async function candidatosRepresentanteRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  // Rota pública — sem requireAuth. Usada pelo wizard /parceiro.
  fastify.post('/candidatos-representante', async (request, reply) => {
    const body = CandidatoSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    }

    const candidato = await prisma.candidatoRepresentante.create({ data: body.data });

    enviarEmailNovaCandidaturaRepresentante(candidato).catch((err) => {
      console.error('[CANDIDATOS-REPRESENTANTE] Falha ao enviar e-mail de notificação:', err?.message || err);
    });

    return reply.status(201).send({ status: 'success', data: candidato });
  });

  fastify.get('/candidatos-representante', { onRequest: requireAuth }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const candidatos = await prisma.candidatoRepresentante.findMany({
      where: status ? { status } : {},
      select: CAMPOS_LISTA,
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: candidatos });
  });

  fastify.get('/candidatos-representante/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const candidato = await prisma.candidatoRepresentante.findUnique({ where: { id } });
    if (!candidato) {
      return reply.status(404).send({ status: 'error', message: 'Candidatura não encontrada' });
    }
    return reply.send({ status: 'success', data: candidato });
  });

  fastify.patch('/candidatos-representante/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    }
    const candidato = await prisma.candidatoRepresentante.update({ where: { id }, data: body.data });
    return reply.send({ status: 'success', data: candidato });
  });
}
