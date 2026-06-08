import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

// Centro de Custos Comercial — lançamentos de entradas e saídas.
// Só gestão (CEO/ADMIN/Supervisão Comercial) acessa.

const CATEGORIAS_SAIDA = ['SALARIO', 'BENEFICIO', 'AJUDA_CUSTO', 'MARKETING', 'COMISSAO', 'OUTRO_CUSTO'];
const CATEGORIAS_ENTRADA = ['MENSALIDADE', 'INSTALACAO', 'SERVICO', 'VENDA', 'OUTRA_ENTRADA'];

const LancamentoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  categoria: z.string().min(1),
  descricao: z.string().optional(),
  valor: z.number().positive(),
  recorrencia: z.enum(['MENSAL', 'ANUAL', 'PONTUAL', 'EXTRAORDINARIO']).default('MENSAL'),
  competencia_ano: z.number().int().min(2000).max(2100),
  competencia_mes: z.number().int().min(1).max(12),
  data: z.string().datetime().optional(),
  observacoes: z.string().optional(),
  vendedor_id: z.string().optional(),
  cliente_id: z.string().optional(),
});

export async function financeiroRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Metadados (categorias p/ alimentar selects do front).
  fastify.get('/financeiro/categorias', async (_req, reply) => {
    return reply.send({ status: 'success', data: { entrada: CATEGORIAS_ENTRADA, saida: CATEGORIAS_SAIDA } });
  });

  // Lista lançamentos com filtros por período/tipo/categoria.
  fastify.get('/financeiro/lancamentos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      ano: z.coerce.number().optional(),
      mes: z.coerce.number().optional(),
      tipo: z.string().optional(),
      categoria: z.string().optional(),
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });

    const where: any = {};
    if (q.data.ano) where.competencia_ano = q.data.ano;
    if (q.data.mes) where.competencia_mes = q.data.mes;
    if (q.data.tipo) where.tipo = q.data.tipo;
    if (q.data.categoria) where.categoria = q.data.categoria;

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where, orderBy: [{ competencia_ano: 'desc' }, { competencia_mes: 'desc' }, { created_at: 'desc' }], take: 1000,
    });
    return reply.send({ status: 'success', data: lancamentos });
  });

  // Cria lançamento.
  fastify.post('/financeiro/lancamentos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = LancamentoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });
    const user = (request as any).user;
    const d = body.data;
    const lanc = await prisma.lancamentoFinanceiro.create({
      data: {
        tipo: d.tipo, categoria: d.categoria, descricao: d.descricao, valor: d.valor,
        recorrencia: d.recorrencia, competencia_ano: d.competencia_ano, competencia_mes: d.competencia_mes,
        data: d.data ? new Date(d.data) : new Date(), observacoes: d.observacoes,
        vendedor_id: d.vendedor_id, cliente_id: d.cliente_id, created_by: user?.id || 'system',
      },
    });
    return reply.status(201).send({ status: 'success', data: lanc });
  });

  // Atualiza lançamento.
  fastify.patch('/financeiro/lancamentos/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = LancamentoSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const d: any = { ...body.data };
    if (d.data) d.data = new Date(d.data);
    try {
      const lanc = await prisma.lancamentoFinanceiro.update({ where: { id }, data: d });
      return reply.send({ status: 'success', data: lanc });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lançamento não encontrado' });
      throw err;
    }
  });

  // Remove lançamento.
  fastify.delete('/financeiro/lancamentos/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    await prisma.lancamentoFinanceiro.delete({ where: { id } }).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // Resumo: entradas x saídas x resultado + por categoria + médias (MRR/instalação).
  fastify.get('/financeiro/resumo', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({
      ano: z.coerce.number().default(new Date().getFullYear()),
      mes: z.coerce.number().optional(), // sem mês = ano inteiro
    }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });

    const where: any = { competencia_ano: q.data.ano };
    if (q.data.mes) where.competencia_mes = q.data.mes;

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({ where });

    let totalEntradas = 0, totalSaidas = 0;
    const porCategoria: Record<string, number> = {};
    const mrrValores: number[] = [];
    const instalacaoValores: number[] = [];

    for (const l of lancamentos) {
      const v = Number(l.valor);
      if (l.tipo === 'ENTRADA') totalEntradas += v; else totalSaidas += v;
      porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + v;
      if (l.categoria === 'MENSALIDADE') mrrValores.push(v);
      if (l.categoria === 'INSTALACAO') instalacaoValores.push(v);
    }

    const media = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return reply.send({
      status: 'success',
      data: {
        periodo: { ano: q.data.ano, mes: q.data.mes ?? null },
        total_entradas: round2(totalEntradas),
        total_saidas: round2(totalSaidas),
        resultado: round2(totalEntradas - totalSaidas),
        por_categoria: Object.entries(porCategoria).map(([categoria, valor]) => ({ categoria, valor: round2(valor) })),
        media_mensalidade: round2(media(mrrValores)),
        media_instalacao: round2(media(instalacaoValores)),
        qtd_lancamentos: lancamentos.length,
      },
    });
  });
}
