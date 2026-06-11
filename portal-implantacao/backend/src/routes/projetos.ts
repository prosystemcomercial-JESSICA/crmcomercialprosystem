import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FASES, FASE_POR_CODIGO, FaseDef } from '../funis.js';
import { dispararAutomacoesPosMovimento, criarChecklistDaFase } from '../automacoes.js';

const CAMPOS_PROJETO = [
  'cliente_nome', 'razao_social', 'nome_fantasia', 'cnpj', 'telefone', 'email',
  'segmento_atuacao', 'regime_tributario', 'tipo_implantacao', 'erp_anterior',
  'volumetria_pdvs', 'tipo_certificado', 'dados_contador', 'csc_sefaz', 'responsavel_id',
];

export async function projetosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const getUser = (req: any) => req.user as { id?: string; nome?: string; role?: string } | undefined;

  // ── Lista projetos (kanban): por funil, agrupados por fase ──
  fastify.get('/projetos', async (request, reply) => {
    const q = z.object({ funil: z.string().optional(), status: z.string().optional(), busca: z.string().optional() }).safeParse(request.query);
    const where: any = {};
    if (q.data?.funil) where.funil = q.data.funil;
    if (q.data?.status) where.status = q.data.status;
    if (q.data?.busca) where.OR = [
      { cliente_nome: { contains: q.data.busca } }, { razao_social: { contains: q.data.busca } },
      { nome_fantasia: { contains: q.data.busca } }, { cnpj: { contains: q.data.busca } },
    ];
    const projetos = await prisma.projetoImplantacao.findMany({
      where, orderBy: { fase_desde: 'asc' },
      include: { checklists: true, responsavel: { select: { id: true, nome: true } } },
    });
    // anexa SLA e "dias na fase" calculados
    const agora = Date.now();
    const enriquecidos = projetos.map(p => {
      const fase = FASE_POR_CODIGO[p.fase];
      const sla = fase ? slaEfetivo(fase, p.tipo_implantacao) : undefined;
      const diasNaFase = (agora - new Date(p.fase_desde).getTime()) / 86400000;
      return { ...p, sla_dias: sla ?? null, dias_na_fase: Math.floor(diasNaFase * 10) / 10, sla_estourado: sla != null && diasNaFase > sla };
    });
    return reply.send({ status: 'success', data: enriquecidos });
  });

  // ── Detalhe de um projeto ──
  fastify.get('/projetos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await prisma.projetoImplantacao.findUnique({
      where: { id },
      include: { checklists: { orderBy: { ordem: 'asc' } }, historico: { orderBy: { created_at: 'desc' } }, responsavel: { select: { id: true, nome: true } } },
    });
    if (!p) return reply.status(404).send({ status: 'error', message: 'Projeto não encontrado' });
    const fase = FASE_POR_CODIGO[p.fase];
    return reply.send({ status: 'success', data: { ...p, sla_dias: fase ? slaEfetivo(fase, p.tipo_implantacao) ?? null : null } });
  });

  // ── Criar projeto (manual ou via ponte). Nasce na 1ª fase do funil indicado. ──
  fastify.post('/projetos', async (request, reply) => {
    const body = z.object({
      cliente_nome: z.string().min(1),
      ...Object.fromEntries(CAMPOS_PROJETO.filter(c => c !== 'cliente_nome' && c !== 'volumetria_pdvs').map(c => [c, z.string().optional()])),
      volumetria_pdvs: z.coerce.number().int().optional(),
      funil: z.enum(['COMERCIAL', 'IMPLANTACAO', 'ONBOARDING']).optional(),
      cliente_crm_id: z.string().optional(), contrato_crm_id: z.string().optional(),
    }).passthrough().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', detalhes: body.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) });

    const funil = body.data.funil || 'IMPLANTACAO'; // portal foca no técnico (sem pré-venda)
    const primeiraFase = FASES.filter(f => f.funil === funil).sort((a, b) => a.ordem - b.ordem)[0];
    const user = getUser(request);

    const data: any = { funil, fase: primeiraFase.codigo, fase_desde: new Date() };
    for (const c of CAMPOS_PROJETO) if ((body.data as any)[c] !== undefined && (body.data as any)[c] !== '') data[c] = (body.data as any)[c];
    if (body.data.cliente_crm_id) data.cliente_crm_id = body.data.cliente_crm_id;
    if (body.data.contrato_crm_id) data.contrato_crm_id = body.data.contrato_crm_id;

    const projeto = await prisma.projetoImplantacao.create({ data });
    await criarChecklistDaFase(prisma, projeto.id, primeiraFase);
    await prisma.historicoFase.create({ data: { projeto_id: projeto.id, funil_para: funil, fase_para: primeiraFase.codigo, movido_por: user?.id, movido_por_nome: user?.nome } });
    return reply.status(201).send({ status: 'success', data: projeto });
  });

  // ── Editar campos do projeto (campos personalizados Parte 1) ──
  fastify.patch('/projetos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const raw = (request.body || {}) as any;
    const data: any = {};
    for (const c of CAMPOS_PROJETO) {
      if (raw[c] === undefined) continue;
      if (c === 'volumetria_pdvs') { const n = Number(raw[c]); if (Number.isFinite(n)) data[c] = n; continue; }
      data[c] = raw[c] === '' ? null : raw[c];
    }
    const p = await prisma.projetoImplantacao.update({ where: { id }, data }).catch(() => null);
    if (!p) return reply.status(404).send({ status: 'error', message: 'Projeto não encontrado' });
    return reply.send({ status: 'success', data: p });
  });

  // ── Marcar/desmarcar item de checklist ──
  fastify.patch('/checklist/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const body = z.object({ concluido: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe concluido' });
    const user = getUser(request);
    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: { concluido: body.data.concluido, concluido_em: body.data.concluido ? new Date() : null, concluido_por: body.data.concluido ? (user?.nome || user?.id) : null },
    }).catch(() => null);
    if (!item) return reply.status(404).send({ status: 'error', message: 'Item não encontrado' });
    return reply.send({ status: 'success', data: item });
  });

  // ── Mover projeto de fase (com regras: exige campos + checklist + automações) ──
  fastify.post('/projetos/:id/mover', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ fase: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe a fase de destino' });

    const projeto = await prisma.projetoImplantacao.findUnique({ where: { id }, include: { checklists: true } });
    if (!projeto) return reply.status(404).send({ status: 'error', message: 'Projeto não encontrado' });
    const destino = FASE_POR_CODIGO[body.data.fase];
    if (!destino) return reply.status(400).send({ status: 'error', message: 'Fase inválida' });

    const faseAtual = FASE_POR_CODIGO[projeto.fase];
    const user = getUser(request);

    // Regra: campos obrigatórios p/ SAIR da fase atual (ex.: 1.2 exige segmento+volumetria; 1.5 exige tipo_implantacao).
    const avancando = faseAtual && destino.ordem > faseAtual.ordem && destino.funil === faseAtual.funil;
    if (avancando && faseAtual.exige_campos?.length) {
      const faltando = faseAtual.exige_campos.filter(c => (projeto as any)[c] == null || (projeto as any)[c] === '');
      if (faltando.length) return reply.status(422).send({ status: 'error', message: `Preencha antes de avançar: ${faltando.join(', ')}`, faltando });
    }
    // Regra 1 (bloqueio de fase): NENHUM card avança se o checklist obrigatório da
    // fase atual não estiver 100% concluído. Vale ao avançar dentro do funil OU ao
    // passar para o próximo funil (ex.: Go-Live → Treinamento).
    const passandoDeFunil = faseAtual && destino.funil !== faseAtual.funil;
    const ehAvanco = avancando || passandoDeFunil;
    if (ehAvanco && faseAtual?.checklist_obrigatorio) {
      const itens = (projeto.checklists || []).filter((ci: any) => ci.fase === faseAtual.codigo);
      const pend = itens.filter((ci: any) => !ci.concluido);
      // Se ainda não há itens (entrou agora), cria-os e bloqueia até marcar.
      if (itens.length === 0 || pend.length > 0) {
        return reply.status(422).send({
          status: 'error',
          message: `Conclua 100% do checklist da fase "${faseAtual.nome}" antes de avançar (${pend.length || itens.length} item(ns) pendente(s)).`,
        });
      }
    }

    const diasNaFaseAnterior = (Date.now() - new Date(projeto.fase_desde).getTime()) / 86400000;

    // Datas-chave p/ KPIs
    const extra: any = {};
    if (destino.codigo === 'COM_FECHADO' && !projeto.data_fechamento_comercial) extra.data_fechamento_comercial = new Date();
    if (destino.codigo === 'IMP_GOLIVE' && !projeto.data_go_live) extra.data_go_live = new Date();
    if (destino.codigo === 'ONB_SUCESSO' && !projeto.data_cliente_sucesso) extra.data_cliente_sucesso = new Date();
    if (destino.ganho) extra.status = 'GANHO';

    const atualizado = await prisma.projetoImplantacao.update({
      where: { id },
      data: { funil: destino.funil, fase: destino.codigo, fase_desde: new Date(), ...extra },
    });
    await prisma.historicoFase.create({
      data: {
        projeto_id: id, funil_de: faseAtual?.funil, fase_de: faseAtual?.codigo,
        funil_para: destino.funil, fase_para: destino.codigo,
        dias_na_fase_anterior: Math.round(diasNaFaseAnterior * 10) / 10,
        movido_por: user?.id, movido_por_nome: user?.nome,
      },
    });
    await criarChecklistDaFase(prisma, id, destino);
    // Automações da Parte 3 (transições, e-mails, NPS) — não bloqueiam a resposta.
    dispararAutomacoesPosMovimento(prisma, atualizado, destino).catch(e => console.error('[automacao]', e?.message));

    return reply.send({ status: 'success', data: atualizado });
  });
}

// SLA efetivo (considera SLA condicional pelo tipo de implantação).
function slaEfetivo(fase: FaseDef, tipoImplantacao?: string | null): number | undefined {
  if (fase.sla_condicional && tipoImplantacao) return fase.sla_condicional.mapa[tipoImplantacao];
  return fase.sla_dias;
}
