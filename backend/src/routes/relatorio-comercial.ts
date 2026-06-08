import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

// Relatório Comercial mensal (o que vai para o CEO).
// GET calcula o pipeline automaticamente das PropostasComerciais e mescla com o
// que foi salvo (marketing, churn, ligações). PUT salva/edita. Só gestão.

const STATUS_FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const STATUS_NEGOCIACAO = ['ENVIADA', 'EM_NEGOCIACAO', 'RASCUNHO'];
const STATUS_DECLINADA = ['RECUSADA', 'PERDIDA', 'EXPIRADA', 'DECLINADA'];

export async function relatorioComercialRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Seed: Março/2026 com os números reais que a Jessica passou (1x, idempotente).
  fastify.addHook('onReady', async () => {
    try {
      const existe = await prisma.relatorioComercial.findUnique({ where: { uq_relatorio_mes: { ano: 2026, mes: 3 } } });
      if (existe) return;
      await prisma.relatorioComercial.create({
        data: {
          ano: 2026, mes: 3, supervisor: 'Jessica Cardoso', fechado: true,
          contratos_fechados: 7, meta_contratos: 15, instalacao_total: 9400, mrr_total: 2350,
          cancelamentos: 4, mrr_perdido: 1153,
          propostas_total: 58, propostas_negociacao: 43, propostas_fechadas: 10, propostas_declinadas: 5,
          setup_potencial: 41450, mrr_potencial: 13510,
          por_vendedor: [
            { nome: 'Jessica Cardoso', propostas: 31, setup_potencial: 18150, mrr_potencial: 6700, em_negociacao: 22, fechadas: 9, participacao: 53 },
            { nome: 'Sarah', propostas: 16, setup_potencial: 11450, mrr_potencial: 3230, em_negociacao: 10, fechadas: 1, participacao: 28 },
            { nome: 'Kaio', propostas: 11, setup_potencial: 11850, mrr_potencial: 3580, em_negociacao: 11, fechadas: 0, participacao: 19 },
          ],
          por_segmento: [
            { segmento: 'Farmácia', propostas: 32, setup_total: 44700, mrr_total: 11330, ticket_mrr: 354, participacao: 77 },
            { segmento: 'Padaria', propostas: 20, setup_total: 12200, mrr_total: 5540, ticket_mrr: 277, participacao: 18 },
            { segmento: 'Varejo', propostas: 6, setup_total: 3800, mrr_total: 1710, ticket_mrr: 285, participacao: 5 },
          ],
          contratos_lista: [
            { empresa: 'Farmácia Preço Baixo de Muqui', segmento: 'Farmácia', instalacao: 1650, mrr: 350, origem: 'Lista Inativos' },
            { empresa: 'Farmácia do Trabalhador Mimoso do Sul', segmento: 'Farmácia', instalacao: 1450, mrr: 350, origem: 'Lista Inativos' },
            { empresa: 'Rangel Farmácia e Drogaria', segmento: 'Farmácia', instalacao: 950, mrr: 330, origem: 'Ebook' },
            { empresa: 'Perfumaria Riviera', segmento: 'Varejo', instalacao: 750, mrr: 280, origem: 'Cliente Base' },
            { empresa: 'FPB Porangatu', segmento: 'Farmácia', instalacao: 1800, mrr: 380, origem: 'Lista Inativos' },
          ],
          atividade: [
            { vendedor: 'Kaio', ligacoes: 1297, qualificadas: 19, tempo: '23h19min', conversao: '1,5%' },
            { vendedor: 'Sarah', ligacoes: 627, qualificadas: 27, tempo: '9h49min', conversao: null },
          ],
          marketing: { investido: 1104, resultados: 65, impressoes: 42220, roi: 6.6, campanhas: [
            { nome: 'SHE Leads', leads: 29, cpl: 29.65, investimento: 859.77 },
            { nome: 'Campanha Isca', assinaturas: 36, custo: 6.79, investimento: 244.60 },
          ] },
          cancelamentos_lista: [
            { motivo: 'Troca de sistema', qtd: 2 },
            { motivo: 'Falta de suporte / atendimento', qtd: 2 },
          ],
          resumo_executivo: [
            '✅ 7 contratos fechados',
            '✅ Pipeline robusto (58 propostas)',
            '✅ Farmácia continua sendo o principal motor comercial',
            '✅ Lista de inativos gerou o maior número de fechamentos',
            '⚠️ Cancelamentos ligados a suporte precisam de atenção',
            '⚠️ Alto volume comercial ainda pode converter mais contratos',
            '⚠️ Meta mensal atingida: apenas 47%',
          ],
        },
      });
      console.log('[RELATORIO] Março/2026 seedado.');
    } catch (e: any) { console.error('[RELATORIO] seed:', e?.message); }
  });

  // Calcula o pipeline do mês a partir das propostas comerciais.
  async function calcularPipeline(ano: number, mes: number) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);
    const props = await prisma.propostaComercial.findMany({
      where: { created_at: { gte: inicio, lt: fim } },
      select: { status: true, segmento: true, vendedor_nome: true, valor_implantacao: true, mensalidade_plus: true, mensalidade_pro: true, valor_final: true },
    });

    const mrrDe = (p: any) => p.mensalidade_plus ?? p.mensalidade_pro ?? 0;
    const setupDe = (p: any) => p.valor_implantacao ?? p.valor_final ?? 0;

    let negociacao = 0, fechadas = 0, declinadas = 0, setupPot = 0, mrrPot = 0;
    const vend: Record<string, any> = {};
    const seg: Record<string, any> = {};

    for (const p of props) {
      const st = p.status;
      if (STATUS_FECHADA.includes(st)) fechadas++;
      else if (STATUS_DECLINADA.includes(st)) declinadas++;
      else negociacao++;
      setupPot += setupDe(p);
      mrrPot += mrrDe(p);

      const vn = p.vendedor_nome || 'Sem vendedor';
      vend[vn] = vend[vn] || { nome: vn, propostas: 0, setup_potencial: 0, mrr_potencial: 0, em_negociacao: 0, fechadas: 0 };
      vend[vn].propostas++; vend[vn].setup_potencial += setupDe(p); vend[vn].mrr_potencial += mrrDe(p);
      if (STATUS_FECHADA.includes(st)) vend[vn].fechadas++; else if (!STATUS_DECLINADA.includes(st)) vend[vn].em_negociacao++;

      const sg = p.segmento || 'Outros';
      seg[sg] = seg[sg] || { segmento: sg, propostas: 0, setup_total: 0, mrr_total: 0 };
      seg[sg].propostas++; seg[sg].setup_total += setupDe(p); seg[sg].mrr_total += mrrDe(p);
    }

    const totalMrr = mrrPot || 1;
    const por_vendedor = Object.values(vend).map((v: any) => ({ ...v, participacao: Math.round((v.mrr_potencial / totalMrr) * 100) }));
    const por_segmento = Object.values(seg).map((s: any) => ({ ...s, ticket_mrr: s.propostas ? Math.round(s.mrr_total / s.propostas) : 0, participacao: Math.round((s.mrr_total / totalMrr) * 100) }));

    return {
      propostas_total: props.length, propostas_negociacao: negociacao, propostas_fechadas: fechadas,
      propostas_declinadas: declinadas, setup_potencial: Math.round(setupPot), mrr_potencial: Math.round(mrrPot),
      por_vendedor, por_segmento, contratos_fechados: fechadas,
    };
  }

  // GET — relatório do mês (auto-pipeline mesclado com o salvo).
  fastify.get('/relatorio-comercial', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ ano: z.coerce.number().default(new Date().getFullYear()), mes: z.coerce.number().min(1).max(12).default(new Date().getMonth() + 1) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const { ano, mes } = q.data;

    const salvo = await prisma.relatorioComercial.findUnique({ where: { uq_relatorio_mes: { ano, mes } } });
    const pipeline = await calcularPipeline(ano, mes);

    // Se o mês está "fechado", usa o salvo; senão, sobrepõe o pipeline calculado.
    const data = salvo?.fechado ? salvo : { ...(salvo || {}), ...pipeline, ano, mes };
    return reply.send({ status: 'success', data: { ...data, _pipeline_auto: pipeline } });
  });

  // Lista de meses disponíveis (p/ o seletor).
  fastify.get('/relatorio-comercial/meses', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const lista = await prisma.relatorioComercial.findMany({ orderBy: [{ ano: 'desc' }, { mes: 'desc' }], select: { ano: true, mes: true, fechado: true } });
    return reply.send({ status: 'success', data: lista });
  });

  // PUT — salva/edita o relatório do mês (campos externos + consolida).
  fastify.put('/relatorio-comercial', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({
      ano: z.number(), mes: z.number().min(1).max(12),
      supervisor: z.string().optional(),
      meta_contratos: z.number().optional(),
      instalacao_total: z.number().optional(), mrr_total: z.number().optional(),
      cancelamentos: z.number().optional(), mrr_perdido: z.number().optional(),
      contratos_fechados: z.number().optional(),
      por_vendedor: z.any().optional(), por_segmento: z.any().optional(),
      contratos_lista: z.any().optional(), atividade: z.any().optional(),
      marketing: z.any().optional(), cancelamentos_lista: z.any().optional(),
      resumo_executivo: z.any().optional(), observacoes: z.string().optional(),
      fechado: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });
    const { ano, mes, ...resto } = body.data;

    const rel = await prisma.relatorioComercial.upsert({
      where: { uq_relatorio_mes: { ano, mes } },
      create: { ano, mes, ...resto } as any,
      update: resto as any,
    });
    return reply.send({ status: 'success', data: rel });
  });
}
