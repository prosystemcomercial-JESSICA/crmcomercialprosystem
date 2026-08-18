import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, podeVerTudo } from '@/lib/scope';
import { calcularDesempenhoSdr } from '@/lib/sdr-desempenho';

// Painel de desempenho do SDR — funil de prospecção (Task 7).
// SDR só vê o próprio desempenho; gestão comercial (CEO/ADMIN/SUPERVISAO_COMERCIAL)
// vê agregado geral ou filtrado por um SDR específico via ?sdr_id=.
export async function sdrRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/sdr/desempenho', async (request, reply) => {
    const user = getUser(request);
    const q = request.query as { data_inicio?: string; data_fim?: string; sdr_id?: string };

    // SDR só vê o próprio; gestor pode filtrar por sdr_id ou ver agregado geral.
    let sdrId: string | null;
    if (!podeVerTudo(user)) {
      sdrId = user?.id || '__no_user__';
    } else {
      sdrId = q.sdr_id || null;
    }

    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    // data_fim vem como "YYYY-MM-DD" e o construtor Date a interpreta como
    // meia-noite UTC — sem isso, tudo criado depois da meia-noite no último
    // dia do período (ex.: um lead cadastrado às 12h) fica fora do filtro
    // `created_at <= dataFim` e some dos KPIs.
    const dataFim = q.data_fim ? new Date(`${q.data_fim}T23:59:59.999Z`) : new Date();

    const desempenho = await calcularDesempenhoSdr(prisma, sdrId, dataInicio, dataFim);

    return reply.send({
      status: 'success',
      data: desempenho,
    });
  });
}
