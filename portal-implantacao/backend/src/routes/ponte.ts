import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FASES } from '../funis.js';
import { criarChecklistDaFase } from '../automacoes.js';

// PONTE com o CRM comercial. Quando um contrato é fechado lá, o CRM chama este
// endpoint e o projeto de implantação nasce aqui (no Funil 2 — Kick-off, já que
// a venda foi fechada). Idempotente por contrato_crm_id. Protegido por um token
// compartilhado (PONTE_TOKEN) — não usa o JWT do usuário, é máquina-a-máquina.
export async function ponteRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.post('/ponte/projeto', async (request, reply) => {
    const token = (request.headers['x-ponte-token'] as string) || '';
    if (!process.env.PONTE_TOKEN || token !== process.env.PONTE_TOKEN) {
      return reply.status(401).send({ status: 'error', message: 'Token de ponte inválido' });
    }
    const body = z.object({
      cliente_nome: z.string().min(1),
      razao_social: z.string().optional(), nome_fantasia: z.string().optional(), cnpj: z.string().optional(),
      telefone: z.string().optional(), email: z.string().optional(),
      cliente_crm_id: z.string().optional(), contrato_crm_id: z.string().min(1),
      // campos opcionais que o comercial já conhece
      segmento_atuacao: z.string().optional(), regime_tributario: z.string().optional(),
      tipo_implantacao: z.string().optional(), volumetria_pdvs: z.coerce.number().int().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', detalhes: body.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) });

    // Idempotência: se já existe projeto p/ este contrato, retorna o existente.
    const existente = await prisma.projetoImplantacao.findFirst({ where: { contrato_crm_id: body.data.contrato_crm_id } });
    if (existente) return reply.send({ status: 'success', data: existente, message: 'Projeto já existia (idempotente)' });

    // Nasce no Funil 2 — Kick-off (a venda foi fechada no comercial).
    const kickoff = FASES.find(f => f.codigo === 'IMP_KICKOFF')!;
    const data: any = {
      funil: 'IMPLANTACAO', fase: 'IMP_KICKOFF', fase_desde: new Date(),
      data_fechamento_comercial: new Date(), // início do TTV
    };
    for (const c of ['cliente_nome','razao_social','nome_fantasia','cnpj','telefone','email','cliente_crm_id','contrato_crm_id','segmento_atuacao','regime_tributario','tipo_implantacao']) {
      if ((body.data as any)[c]) data[c] = (body.data as any)[c];
    }
    if (body.data.volumetria_pdvs != null) data.volumetria_pdvs = body.data.volumetria_pdvs;

    const projeto = await prisma.projetoImplantacao.create({ data });
    await criarChecklistDaFase(prisma, projeto.id, kickoff);
    await prisma.historicoFase.create({ data: { projeto_id: projeto.id, funil_para: 'IMPLANTACAO', fase_para: 'IMP_KICKOFF', movido_por_nome: 'Ponte CRM Comercial' } });
    return reply.status(201).send({ status: 'success', data: projeto });
  });
}
