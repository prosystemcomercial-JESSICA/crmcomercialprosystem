import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

// Pesquisa de Satisfação — LP pública (técnico envia o link no fim do atendimento).
// POST /pesquisa/responder é PÚBLICO (sem auth). As rotas de leitura são da gestão.

const RespostaSchema = z.object({
  identificacao: z.string().min(1),         // razão social ou nome fantasia digitada
  respondente_nome: z.string().optional(),
  nota_suporte: z.coerce.number().int().min(1).max(5),
  nota_sistema: z.coerce.number().int().min(1).max(5),
  conhece_plano: z.coerce.boolean().default(false),
  observacao: z.string().optional(),
  sugestoes: z.string().optional(),
});

export async function pesquisaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== PÚBLICO — cliente responde a pesquisa =====
  fastify.post('/pesquisa/responder', async (request, reply) => {
    const body = RespostaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Preencha as notas e a identificação.' });
    const d = body.data;

    const media = (d.nota_suporte + d.nota_sistema) / 2;
    // Crítico: alguma nota baixa, média < 3, ou não conhece os diferenciais do plano.
    const critico = d.nota_suporte < 3 || d.nota_sistema < 3 || media < 3 || !d.conhece_plano;

    // Tenta casar com um Cliente da base pela razão social / nome fantasia / empresa.
    const termo = d.identificacao.trim();
    const cliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { razao_social: { contains: termo } },
          { nome_fantasia: { contains: termo } },
          { empresa: { contains: termo } },
          { nome: { contains: termo } },
        ],
      },
      select: { id: true, nome: true },
    }).catch(() => null);

    // Se crítico E casou com cliente → abre caso de churn automático + marca risco.
    let casoChurnId: string | undefined;
    if (critico && cliente) {
      try {
        const caso = await prisma.casoChurn.create({
          data: {
            clienteId: cliente.id,
            status: 'NOVO',
            risk_score: Math.round((5 - media) * 20), // 0-100 (quanto pior a nota, maior)
            motivo_principal: !d.conhece_plano ? 'Não conhece diferenciais do plano' : 'Baixa satisfação na pesquisa',
            created_by: 'pesquisa-satisfacao',
          },
        });
        casoChurnId = caso.id;
        await prisma.cliente.update({ where: { id: cliente.id }, data: { risco_atencao: true } }).catch(() => {});
      } catch (e: any) { console.error('[PESQUISA] abrir caso churn:', e?.message); }
    }

    const pesquisa = await prisma.pesquisaSatisfacao.create({
      data: {
        identificacao: termo,
        respondente_nome: d.respondente_nome,
        cliente_id: cliente?.id,
        cliente_casado: !!cliente,
        nota_suporte: d.nota_suporte,
        nota_sistema: d.nota_sistema,
        conhece_plano: d.conhece_plano,
        observacao: d.observacao,
        sugestoes: d.sugestoes,
        critico,
        media,
        caso_churn_id: casoChurnId,
        ip_address: (request.headers['x-forwarded-for'] as string)?.split(',')[0] || request.ip,
      },
    });

    return reply.send({ status: 'success', data: { id: pesquisa.id, obrigado: true } });
  });

  // ===== GESTÃO — lista de respostas (painel) =====
  fastify.get('/pesquisa', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      critico: z.coerce.boolean().optional(),
      cliente_id: z.string().optional(),
    }).safeParse(request.query);
    const where: any = {};
    if (q.success && q.data.critico) where.critico = true;
    if (q.success && q.data.cliente_id) where.cliente_id = q.data.cliente_id;

    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where, orderBy: { created_at: 'desc' }, take: 500,
    });

    // Resumo agregado.
    const total = respostas.length;
    const criticos = respostas.filter(r => r.critico).length;
    const mediaSuporte = total ? respostas.reduce((s, r) => s + r.nota_suporte, 0) / total : 0;
    const mediaSistema = total ? respostas.reduce((s, r) => s + r.nota_sistema, 0) / total : 0;
    const naoConhecePlano = respostas.filter(r => !r.conhece_plano).length;

    return reply.send({
      status: 'success',
      data: {
        respostas,
        resumo: {
          total, criticos, nao_conhece_plano: naoConhecePlano,
          media_suporte: Math.round(mediaSuporte * 10) / 10,
          media_sistema: Math.round(mediaSistema * 10) / 10,
        },
      },
    });
  });

  // ===== Respostas de um cliente específico (ficha) =====
  fastify.get('/pesquisa/cliente/:clienteId', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where: { cliente_id: clienteId }, orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: respostas });
  });

  // ===== GESTÃO — respostas que NÃO casaram com nenhum cliente da base =====
  fastify.get('/pesquisa/nao-casadas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const respostas = await prisma.pesquisaSatisfacao.findMany({
      where: { cliente_casado: false }, orderBy: { created_at: 'desc' }, take: 300,
    });
    return reply.send({ status: 'success', data: respostas });
  });

  // ===== GESTÃO — vincular manualmente uma resposta a um cliente =====
  // Reavalia criticidade e abre caso de churn se necessário (e ainda não houver).
  fastify.post('/pesquisa/:id/vincular', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ cliente_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o cliente.' });

    const [pesquisa, cliente] = await Promise.all([
      prisma.pesquisaSatisfacao.findUnique({ where: { id } }),
      prisma.cliente.findUnique({ where: { id: body.data.cliente_id }, select: { id: true } }),
    ]);
    if (!pesquisa) return reply.status(404).send({ status: 'error', message: 'Pesquisa não encontrada' });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

    // Abre caso de churn se a resposta é crítica e ainda não tem caso.
    let casoChurnId = pesquisa.caso_churn_id || undefined;
    if (pesquisa.critico && !casoChurnId) {
      try {
        const caso = await prisma.casoChurn.create({
          data: {
            clienteId: cliente.id, status: 'NOVO',
            risk_score: Math.round((5 - pesquisa.media) * 20),
            motivo_principal: !pesquisa.conhece_plano ? 'Não conhece diferenciais do plano' : 'Baixa satisfação na pesquisa',
            created_by: 'pesquisa-satisfacao',
          },
        });
        casoChurnId = caso.id;
        await prisma.cliente.update({ where: { id: cliente.id }, data: { risco_atencao: true } }).catch(() => {});
      } catch (e: any) { console.error('[PESQUISA] vincular/churn:', e?.message); }
    }

    const atualizada = await prisma.pesquisaSatisfacao.update({
      where: { id },
      data: { cliente_id: cliente.id, cliente_casado: true, caso_churn_id: casoChurnId },
    });
    return reply.send({ status: 'success', data: atualizada });
  });
}
