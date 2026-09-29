import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo, requireGestor } from '../lib/scope';
import { chavePublicaPush, contagemPendencias, enviarPush } from '../services/push.service';

// App no celular: notificações (Web Push), bolinha com o número no ícone e a tela única
// "Aprovar" (mensagens dos agentes e autorizações de campanha, com um toque).
export async function pushRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const logado = (request: any, reply: any) => {
    const u = getUser(request);
    if (!u) { reply.status(401).send({ status: 'error', message: 'Faça login.' }); return null; }
    return u;
  };

  fastify.get('/push/chave', async (_request, reply) => reply.send({ status: 'success', data: { chave: chavePublicaPush() } }));

  fastify.post('/push/inscrever', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const b = z.object({
      endpoint: z.string().url().max(700),
      keys: z.object({ p256dh: z.string().max(255), auth: z.string().max(255) }),
      aparelho: z.string().max(255).optional().nullable(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Inscrição inválida.' });
    const d = b.data;
    await prisma.pushInscricao.upsert({
      where: { endpoint: d.endpoint },
      create: { usuario_id: u.id, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, aparelho: d.aparelho || null },
      update: { usuario_id: u.id, p256dh: d.keys.p256dh, auth: d.keys.auth, aparelho: d.aparelho || null },
    });
    return reply.send({ status: 'success', message: 'Notificações ativadas neste aparelho.' });
  });

  fastify.post('/push/cancelar', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const b = z.object({ endpoint: z.string().max(700) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
    await prisma.pushInscricao.deleteMany({ where: { endpoint: b.data.endpoint, usuario_id: u.id } });
    return reply.send({ status: 'success', message: 'Notificações desligadas neste aparelho.' });
  });

  fastify.post('/push/teste', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const n = await enviarPush(prisma, [u.id], { titulo: 'CRM Prosystem', corpo: 'Tudo certo! As notificações estão funcionando. ✅', url: '/aprovar', tag: 'teste' });
    return reply.send({ status: 'success', data: { enviados: n }, message: n ? 'Notificação de teste enviada.' : 'Nenhum aparelho ativo: toque em "Ativar notificações" primeiro.' });
  });

  fastify.get('/push/contagem', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    return reply.send({ status: 'success', data: await contagemPendencias(prisma, u.id, podeVerTudo(u)) });
  });

  // ── Tela "Aprovar": tudo o que espera decisão, de todos os agentes ──
  fastify.get('/assistente/aprovacoes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const ms = await prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE' }, orderBy: { created_at: 'asc' }, take: 100 });
    const sdrs = await prisma.sdrLead.findMany({ where: { id: { in: ms.map(m => m.sdrId) } }, select: { id: true, nome: true, empresa: true, agente: true, conversaId: true, proposta_id: true } });
    const porId = new Map(sdrs.map(s => [s.id, s]));
    const NOMES: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe' };
    return reply.send({
      status: 'success',
      data: ms.map(m => {
        const meta = (() => { try { return JSON.parse(m.acao || '{}'); } catch { return {}; } })();
        const s = porId.get(m.sdrId);
        return {
          id: m.id, texto: m.texto, criado_em: m.created_at, tipo: meta.negociacao ? 'negociacao' : 'mensagem', fase: meta.fase || null,
          agente: NOMES[s?.agente || 'caroline'] || 'Caroline', cliente: s?.nome || null, empresa: s?.empresa || null, conversaId: s?.conversaId || null,
        };
      }),
    });
  });

  fastify.post('/assistente/aprovacoes/:id/negociacao', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const b = z.object({ pct: z.union([z.literal(0), z.literal(20), z.literal(30)]) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Escolha 30%, 20% ou não autorizar.' });
    const u = getUser(request)!;
    const { decidirNegociacao } = await import('../services/assistente-negociacao.service');
    const texto = await decidirNegociacao(prisma, id, b.data.pct, { id: u.id, nome: u.nome || 'Gestão' });
    return reply.send({ status: 'success', message: texto.replace(/\*/g, '') });
  });
}
