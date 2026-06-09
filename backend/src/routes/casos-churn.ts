import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CasoChurnService } from '@/services/caso-churn.service';
import { requireAuth, requireRole } from '@/middleware/auth';
import { CreateCasoChurnSchema, UpdateCasoChurnSchema, ListCasoChurnSchema } from '@/types/dto';

export async function casosChurnRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;
  const service = new CasoChurnService(prisma);

  // POST /casos-churn — Criar novo caso
  fastify.post(
    '/casos-churn',
    {
      onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])]
    },
    async (request, reply) => {
      try {
        const body = CreateCasoChurnSchema.parse(request.body);
        const user = (request as any).user;

        const caso = await service.create(body, user.id);

        return reply.status(201).send({
          status: 'success',
          data: caso,
          message: 'Caso de churn criado com sucesso'
        });
      } catch (error: any) {
        console.error('[POST /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validação falhou',
            errors: error.errors
          });
        }

        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao criar caso'
        });
      }
    }
  );

  // GET /casos-churn — Listar casos com filtros
  fastify.get(
    '/casos-churn',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const query = ListCasoChurnSchema.parse(request.query);
        const result = await service.list(query, query.page, query.limit);

        return reply.status(200).send({
          status: 'success',
          data: result.data,
          pagination: result.pagination
        });
      } catch (error: any) {
        console.error('[GET /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Parâmetros inválidos'
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao listar casos'
        });
      }
    }
  );

  // GET /casos-churn/:id — Obter caso por ID
  fastify.get('/casos-churn/:id', { onRequest: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const caso = await service.getById(id);

      return reply.status(200).send({
        status: 'success',
        data: caso
      });
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          status: 'error',
          message: error.message
        });
      }

      return reply.status(500).send({
        status: 'error',
        message: 'Erro ao obter caso'
      });
    }
  });

  // PATCH /casos-churn/:id — Atualizar caso
  fastify.patch(
    '/casos-churn/:id',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = UpdateCasoChurnSchema.parse(request.body);
        const user = (request as any).user;

        const caso = await service.update(id, body, user.id);

        return reply.status(200).send({
          status: 'success',
          data: caso,
          message: 'Caso atualizado com sucesso'
        });
      } catch (error: any) {
        console.error('[PATCH /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validação falhou',
            errors: error.errors
          });
        }

        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        if (error.name === 'BadRequestError') {
          return reply.status(400).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao atualizar caso'
        });
      }
    }
  );

  // ── RENEGOCIAÇÃO (dificuldade financeira) ─────────────────────────────────
  // PATCH /casos-churn/:id/renegociacao — salva os dados do acordo no caso.
  // Direto via Prisma (não passa pelo service/DTO) p/ não acoplar ao fluxo de caso.
  fastify.patch(
    '/casos-churn/:id/renegociacao',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const b = (request.body || {}) as any;
        const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

        const existe = await prisma.casoChurn.findUnique({ where: { id } });
        if (!existe) {
          return reply.status(404).send({ status: 'error', message: 'Caso não encontrado' });
        }

        const ativa = b.reneg_ativa !== false; // marcar renegociação por padrão
        const parcelas = b.reneg_parcelas != null ? Math.max(1, Math.min(6, Number(b.reneg_parcelas))) : null;

        const caso = await prisma.casoChurn.update({
          where: { id },
          data: {
            reneg_ativa: ativa,
            reneg_como_mantido: b.reneg_como_mantido ?? null,
            reneg_resultado: b.reneg_resultado ?? null,
            reneg_valor_devido: num(b.reneg_valor_devido),
            reneg_valor_entrada: num(b.reneg_valor_entrada),
            reneg_parcelas: parcelas,
            reneg_responsavel: b.reneg_responsavel ?? null,
            reneg_responsavel_cpf: b.reneg_responsavel_cpf ?? null,
            reneg_data: b.reneg_data ? new Date(b.reneg_data) : (existe.reneg_data ?? new Date()),
            // dificuldade financeira passa a ser o motivo registrado
            ...(ativa && !existe.motivo_principal ? { motivo_principal: 'Dificuldade financeira' } : {}),
          },
        });

        return reply.send({ status: 'success', data: caso, message: 'Renegociação salva' });
      } catch (error: any) {
        console.error('[PATCH /casos-churn/:id/renegociacao]', error);
        return reply.status(500).send({ status: 'error', message: 'Erro ao salvar renegociação' });
      }
    }
  );

  // GET /casos-churn/:id/renegociacao/pdf — gera o termo de renegociação (acordo).
  // Público (igual ao PDF do contrato) p/ permitir abrir/baixar via window.open
  // sem precisar injetar o token Bearer na URL; o id é um cuid não enumerável.
  fastify.get(
    '/casos-churn/:id/renegociacao/pdf',
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const caso = await prisma.casoChurn.findUnique({
          where: { id },
          include: { cliente: true },
        });
        if (!caso) {
          return reply.status(404).send({ status: 'error', message: 'Caso não encontrado' });
        }
        if (!caso.reneg_valor_devido || caso.reneg_valor_devido <= 0) {
          return reply.status(400).send({ status: 'error', message: 'Informe o valor devido antes de gerar o documento' });
        }
        if (!caso.reneg_responsavel || !caso.reneg_responsavel_cpf) {
          return reply.status(400).send({ status: 'error', message: 'Informe o responsável e o CPF antes de gerar o documento' });
        }

        const { gerarRenegociacaoPdf } = await import('@/lib/renegociacao-pdf');
        const cli = caso.cliente as any;
        const pdf = await gerarRenegociacaoPdf({
          razao_social: cli.razao_social || cli.empresa || cli.nome,
          nome_fantasia: cli.nome_fantasia,
          cnpj: cli.cnpj,
          responsavel: caso.reneg_responsavel,
          responsavel_cpf: caso.reneg_responsavel_cpf,
          valor_devido: caso.reneg_valor_devido,
          valor_entrada: caso.reneg_valor_entrada,
          parcelas: caso.reneg_parcelas,
          como_mantido: caso.reneg_como_mantido,
          resultado: caso.reneg_resultado,
          data: caso.reneg_data,
        });

        const nomeArq = `Renegociacao_${(cli.razao_social || cli.nome || id).replace(/[^\w.-]/g, '_')}.pdf`;
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="${nomeArq}"`)
          .send(pdf);
      } catch (error: any) {
        console.error('[GET /casos-churn/:id/renegociacao/pdf]', error);
        return reply.status(500).send({ status: 'error', message: 'Erro ao gerar documento' });
      }
    }
  );

  // DELETE /casos-churn/:id — Deletar (soft delete) caso
  fastify.delete(
    '/casos-churn/:id',
    { onRequest: [requireAuth, requireRole(['CEO'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const caso = await service.delete(id);

        return reply.status(200).send({
          status: 'success',
          data: caso,
          message: 'Caso deletado com sucesso'
        });
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao deletar caso'
        });
      }
    }
  );
}
