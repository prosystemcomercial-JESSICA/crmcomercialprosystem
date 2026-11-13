import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, requireGestor } from '../lib/scope';

// Diretoria dos agentes (13/11/2026): painel da Vitória (CEO), do Gustavo e da Renata (gerentes) e o boletim do
// Rafael com a Laya. As rodadas sob demanda levam alguns minutos (IA): rodam em segundo plano.
export async function diretoriaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const emAndamento = new Set<string>();
  const emSegundoPlano = (nome: string, fn: () => Promise<any>) => {
    if (emAndamento.has(nome)) return false;
    emAndamento.add(nome);
    fn().catch((e: any) => console.error(`[DIRETORIA] ${nome}:`, e?.message)).finally(() => emAndamento.delete(nome));
    return true;
  };

  fastify.get('/diretoria', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { painelDiretoria } = await import('../services/diretoria.service');
    return reply.send({ status: 'success', data: { ...(await painelDiretoria(prisma)), em_andamento: [...emAndamento] } });
  });

  const MENSAGEM: Record<string, string> = {
    boletim: 'O Rafael e a Laya começaram o boletim. Ele aparece aqui em alguns minutos.',
    vitoria: 'A Vitória começou a reunião. O plano e as providências aparecem aqui em alguns minutos e você recebe o resumo no WhatsApp.',
    gerentes: 'O Gustavo e a Renata estão conferindo os números agora.',
  };
  fastify.post('/diretoria/rodar/:quem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { quem } = request.params as { quem: string };
    if (!MENSAGEM[quem]) return reply.status(400).send({ status: 'error', message: 'Rodada desconhecida' });
    const s = await import('../services/diretoria.service');
    const fn = quem === 'boletim' ? () => s.gerarBoletim(prisma) : quem === 'vitoria' ? () => s.rodarVitoria(prisma, new Date(), 'semanal') : () => s.rodarGerentes(prisma);
    const ok = emSegundoPlano(quem, fn);
    return reply.send({ status: 'success', message: ok ? MENSAGEM[quem] : 'Já está rodando. Aguarde terminar.' });
  });

  fastify.post('/diretoria/providencia/:doc/:i/desfazer', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { doc, i } = request.params as { doc: string; i: string };
    const { desfazerProvidencia } = await import('../services/diretoria.service');
    try {
      const message = await desfazerProvidencia(prisma, doc, Number(i), getUser(request)?.id || 'gestao');
      return reply.send({ status: 'success', message });
    } catch (e: any) {
      return reply.status(400).send({ status: 'error', message: e?.message || 'Não deu para desfazer' });
    }
  });
}
