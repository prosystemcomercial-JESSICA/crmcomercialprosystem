import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireGestor, getUser } from '../lib/scope';
import { catalogo, FUNCOES, validarRotas, rotaPadrao } from '../lib/ia-rotas';
import { CHAVE_ROTAS, esquecerRotasIa, rotasIa, provedoresComChave } from '../services/ia-gemini.service';

// Configurações › Modelos de IA (pedido da Jessica, 29/10/2026): modelo principal e reserva de cada
// assistente. Só a gestão vê e muda. Grava em ConfiguracaoIntegracao 'ia.rotas' (sem mudança de banco).

export async function iaModelosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const montar = async () => {
    const chaves = await provedoresComChave(prisma);
    const rotas = await rotasIa(prisma);
    return {
      modelos: catalogo(process.env).map(m => ({ ...m, tem_chave: chaves[m.provedor] })),
      funcoes: FUNCOES.map(f => ({ ...f, ...(rotas[f.id] || rotaPadrao()) })),
    };
  };

  fastify.get('/configuracoes/ia-modelos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    return reply.send({ status: 'success', data: await montar() });
  });

  fastify.put('/configuracoes/ia-modelos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const rotas = validarRotas((request.body as any)?.rotas, catalogo(process.env));
    const valor = JSON.stringify(rotas);
    const por = getUser(request)?.id || 'sistema';
    await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE_ROTAS }, create: { chave: CHAVE_ROTAS, valor, updated_by: por }, update: { valor, updated_by: por } });
    esquecerRotasIa();
    return reply.send({ status: 'success', data: await montar() });
  });
}
