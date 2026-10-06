import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import { onboardingOk, ehCargoTecnico } from '@/lib/implantacao/portal';
import { ETAPAS, TIPOS_SESSAO, TIPOS_ESPERA, JORNADA_PADRAO, diaSP, emSP, fimAutomatico, resumoDoDia, temposDaDemanda, type Jornada } from '@/lib/implantacao/cronometro';

/**
 * Cronômetro do técnico de implantação (play/pausa) e esperas da demanda.
 * Só uma sessão aberta por técnico: play em outra demanda fecha a anterior (TROCA).
 * Esperas (programação, cliente, processamento) pausam a demanda e contam à parte.
 */

const CHAVE_JORNADA = 'implantacao.jornada';
const NOME_ESPERA: Record<string, string> = { PROGRAMACAO: 'aguardando programação', CLIENTE: 'aguardando cliente', PROCESSAMENTO: 'processamento em andamento' };
const NOME_ETAPA: Record<string, string> = { ONBOARDING: 'Onboarding técnico', INSTALACAO: 'Instalação', CONVERSAO: 'Conversão', TREINAMENTO: 'Treinamento', ASSISTIDA: 'Operação assistida', CORRECAO: 'Correção pós-virada' };
const NOME_TIPO: Record<string, string> = { SUPORTE: 'Suporte', REUNIAO: 'Reunião', INTERNO: 'Tarefa interna' };

/** Gestão (comercial) ou supervisão técnica: vê e corrige o tempo de todos os técnicos. */
const ehGestaoTecnica = (u: any) => podeVerTudo(u) || (u?.role || '').toUpperCase() === 'SUPERVISAO_TECNICA';

export async function obterJornada(prisma: PrismaClient): Promise<Jornada> {
  const row = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_JORNADA } }).catch(() => null);
  try { return { ...JORNADA_PADRAO, ...(row?.valor ? JSON.parse(row.valor) : {}) }; } catch { return JORNADA_PADRAO; }
}

async function linhaDoTempo(prisma: PrismaClient, implantacaoId: string | null | undefined, descricao: string, ator?: { id?: string; nome?: string }) {
  if (!implantacaoId) return;
  await prisma.implantacaoAtividade.create({ data: { implantacao_id: implantacaoId, tipo: 'CRONOMETRO', descricao, autor_id: ator?.id, autor_nome: ator?.nome || 'Sistema' } }).catch(() => null);
}

/** Fecha a sessão aberta do técnico (se houver). Devolve a sessão fechada. */
async function fecharAberta(prisma: PrismaClient, tecnicoId: string, origem: string, quando = new Date()) {
  const aberta = await prisma.implantacaoSessao.findFirst({ where: { tecnico_id: tecnicoId, fim: null }, orderBy: { inicio: 'desc' } });
  if (!aberta) return null;
  await prisma.implantacaoSessao.updateMany({ where: { tecnico_id: tecnicoId, fim: null }, data: { fim: quando, origem_fim: origem } });
  return aberta;
}

/** Sessões esquecidas abertas de dias anteriores fecham às 23:59:59 do dia em que começaram. */
export async function fecharSessoesEsquecidas(prisma: PrismaClient, agora = new Date()) {
  const hoje = emSP(diaSP(agora), '00:00');
  const velhas = await prisma.implantacaoSessao.findMany({ where: { fim: null, inicio: { lt: hoje } } });
  for (const s of velhas) {
    await prisma.implantacaoSessao.update({ where: { id: s.id }, data: { fim: fimAutomatico(s.inicio), origem_fim: 'AUTO_23H59' } });
    await linhaDoTempo(prisma, s.implantacao_id, `⏱ Cronômetro de ${s.tecnico_nome || 'técnico'} ficou aberto e foi fechado sozinho às 23h59 de ${s.inicio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. A gestão pode corrigir o horário.`);
  }
  return velhas.length;
}

export async function implantacaoCronometroRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const podeNaDemanda = async (u: any, implantacaoId: string) => {
    const imp = await prisma.implantacao.findUnique({ where: { id: implantacaoId }, select: { id: true, tecnico_id: true, cliente_razao_social: true } });
    if (!imp) return null;
    if (ehGestaoTecnica(u) || !ehCargoTecnico(u?.role) || imp.tecnico_id === u.id) return imp;
    return null;
  };

  // ── O que está rodando agora (para a barra do cronômetro)
  fastify.get('/implantacoes/cronometro/atual', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const sessao = await prisma.implantacaoSessao.findFirst({ where: { tecnico_id: u.id, fim: null }, include: { implantacao: { select: { id: true, cliente_razao_social: true } } } });
    const hoje = diaSP(new Date());
    const sessoesHoje = await prisma.implantacaoSessao.findMany({ where: { tecnico_id: u.id, inicio: { lt: new Date(emSP(hoje, '00:00').getTime() + 864e5) }, OR: [{ fim: null }, { fim: { gte: emSP(hoje, '00:00') } }] } });
    const resumo = resumoDoDia(sessoesHoje, hoje, { cfg: await obterJornada(prisma) });
    return reply.send({ status: 'success', data: { sessao, resumo } });
  });

  // ── Play: abre sessão nova e fecha a anterior (troca)
  fastify.post('/implantacoes/cronometro/play', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const b = z.object({
      tipo: z.enum(TIPOS_SESSAO).default('DEMANDA'),
      implantacao_id: z.string().optional().nullable(),
      etapa: z.enum(ETAPAS).optional().nullable(),
      descricao: z.string().max(500).optional().nullable(),
      ocorrencia_id: z.string().optional().nullable(),
    }).safeParse(request.body || {});
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const d = b.data;
    if (d.tipo === 'DEMANDA' && (!d.implantacao_id || !d.etapa)) return reply.status(400).send({ status: 'error', message: 'Escolha a demanda e a etapa' });
    let cliente: string | null = null;
    if (d.tipo === 'DEMANDA') {
      const imp = await podeNaDemanda(u, d.implantacao_id!);
      if (!imp) return reply.status(403).send({ status: 'error', message: 'Demanda não encontrada ou não é sua' });
      cliente = imp.cliente_razao_social;
      // Onboarding técnico primeiro: nenhuma outra etapa antes do primeiro contato concluído.
      if (d.etapa !== 'ONBOARDING') {
        const full = await prisma.implantacao.findUnique({ where: { id: d.implantacao_id! }, include: { checklist: { select: { grupo: true, feito: true } } } });
        if (full && !onboardingOk(full, full.checklist)) return reply.status(400).send({ status: 'error', message: 'Conclua o onboarding técnico (primeiro contato com o cliente) antes de começar esta etapa.' });
      }
    }
    const agora = new Date();
    const anterior = await fecharAberta(prisma, u.id, 'TROCA', agora);
    if (anterior?.implantacao_id && anterior.implantacao_id !== d.implantacao_id) {
      await linhaDoTempo(prisma, anterior.implantacao_id, `⏸ ${u.nome || 'Técnico'} pausou (passou para ${cliente || NOME_TIPO[d.tipo] || 'outra atividade'})`, u);
    }
    const sessao = await prisma.implantacaoSessao.create({
      data: { tecnico_id: u.id, tecnico_nome: u.nome || null, tipo: d.tipo, implantacao_id: d.tipo === 'DEMANDA' ? d.implantacao_id : null, etapa: d.tipo === 'DEMANDA' ? d.etapa : null, descricao: d.descricao || null, ocorrencia_id: d.tipo === 'DEMANDA' && d.etapa === 'CORRECAO' ? d.ocorrencia_id || null : null, inicio: agora },
      include: { implantacao: { select: { id: true, cliente_razao_social: true } } },
    });
    if (d.tipo === 'DEMANDA' && anterior?.implantacao_id !== d.implantacao_id) await linhaDoTempo(prisma, d.implantacao_id, `▶ ${u.nome || 'Técnico'} começou a trabalhar (${NOME_ETAPA[d.etapa!]})`, u);
    return reply.status(201).send({ status: 'success', data: sessao });
  });

  // ── Pausa
  fastify.post('/implantacoes/cronometro/pausa', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    // Motivo da pausa (06/10/2026): vai para a sessão e para o histórico do card.
    const motivo = String((request.body as any)?.motivo || '').trim().slice(0, 300) || null;
    const s = await fecharAberta(prisma, u.id, 'PAUSA');
    if (s && motivo) await prisma.implantacaoSessao.update({ where: { id: s.id }, data: { motivo_pausa: motivo } }).catch(() => null);
    if (s?.implantacao_id) await linhaDoTempo(prisma, s.implantacao_id, `⏸ ${u.nome || 'Técnico'} pausou${motivo ? `: ${motivo}` : ''}`, u);
    return reply.send({ status: 'success', data: { pausada: !!s } });
  });

  // ── Dia do técnico (técnico: o próprio; gestão: qualquer um)
  fastify.get('/implantacoes/cronometro/dia', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const q = request.query as { tecnico_id?: string; data?: string };
    const tecnicoId = q.tecnico_id && ehGestaoTecnica(u) ? q.tecnico_id : u.id;
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.data || '') ? q.data! : diaSP(new Date());
    const ini = emSP(dia, '00:00'), fim = new Date(ini.getTime() + 864e5);
    const sessoes = await prisma.implantacaoSessao.findMany({
      where: { tecnico_id: tecnicoId, inicio: { lt: fim }, OR: [{ fim: null }, { fim: { gt: ini } }] },
      include: { implantacao: { select: { id: true, cliente_razao_social: true } } }, orderBy: { inicio: 'asc' },
    });
    const resumo = resumoDoDia(sessoes, dia, { cfg: await obterJornada(prisma) });
    return reply.send({ status: 'success', data: { tecnico_id: tecnicoId, resumo, sessoes } });
  });

  // ── Correção manual de horário (gestão)
  fastify.patch('/implantacoes/sessoes/:id', async (request, reply) => {
    const u = getUser(request);
    if (!ehGestaoTecnica(u)) return reply.status(403).send({ status: 'error', message: 'Só a gestão corrige horários' });
    const { id } = request.params as { id: string };
    const b = z.object({ inicio: z.string().datetime({ offset: true }).optional(), fim: z.string().datetime({ offset: true }).optional() }).safeParse(request.body || {});
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Horário inválido' });
    const s = await prisma.implantacaoSessao.findUnique({ where: { id } });
    if (!s) return reply.status(404).send({ status: 'error', message: 'Sessão não encontrada' });
    const inicio = b.data.inicio ? new Date(b.data.inicio) : s.inicio, fim = b.data.fim ? new Date(b.data.fim) : s.fim;
    if (fim && fim <= inicio) return reply.status(400).send({ status: 'error', message: 'O fim precisa ser depois do início' });
    const fmt = (d: Date | null) => d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'aberta';
    const atual = await prisma.implantacaoSessao.update({ where: { id }, data: { inicio, fim, origem_fim: fim ? 'CORRECAO' : s.origem_fim, corrigido_por: u!.nome || u!.id } });
    await linhaDoTempo(prisma, s.implantacao_id, `✏ ${u!.nome || 'Gestão'} corrigiu o horário de ${s.tecnico_nome || 'técnico'}: ${fmt(s.inicio)}–${fmt(s.fim)} → ${fmt(inicio)}–${fmt(fim)}`, u);
    return reply.send({ status: 'success', data: atual });
  });

  // ── Tempos da demanda (trabalho por etapa, esperas, prazo total)
  fastify.get('/implantacoes/:id/tempos', async (request, reply) => {
    const u = getUser(request);
    const { id } = request.params as { id: string };
    if (!(await podeNaDemanda(u, id))) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const imp = await prisma.implantacao.findUnique({ where: { id }, select: { data_assinatura: true, data_conclusao: true } });
    const [sessoes, esperas] = await Promise.all([
      prisma.implantacaoSessao.findMany({ where: { implantacao_id: id }, orderBy: { inicio: 'asc' } }),
      prisma.implantacaoEspera.findMany({ where: { implantacao_id: id }, orderBy: { inicio: 'desc' } }),
    ]);
    const tempos = temposDaDemanda(sessoes, esperas, { inicio: imp?.data_assinatura, conclusao: imp?.data_conclusao });
    return reply.send({ status: 'success', data: { tempos, sessoes, esperas } });
  });

  // ── Esperas: abrir (pausa o cronômetro se estiver nesta demanda) e resolver
  fastify.post('/implantacoes/:id/esperas', async (request, reply) => {
    const u = getUser(request);
    const { id } = request.params as { id: string };
    if (!u || !(await podeNaDemanda(u, id))) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({
      tipo: z.enum(TIPOS_ESPERA), motivo: z.string().min(3).max(2000), o_que_resolver: z.string().max(2000).optional().nullable(),
      responsavel_id: z.string().optional().nullable(), responsavel_nome: z.string().max(120).optional().nullable(),
    }).safeParse(request.body || {});
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Informe o motivo' });
    const aberta = await prisma.implantacaoSessao.findFirst({ where: { tecnico_id: u.id, fim: null, implantacao_id: id } });
    if (aberta) await fecharAberta(prisma, u.id, 'ESPERA');
    const espera = await prisma.implantacaoEspera.create({ data: { implantacao_id: id, ...b.data, aberta_por_id: u.id, aberta_por_nome: u.nome || null } });
    if (b.data.tipo === 'PROGRAMACAO') {
      const { avisarProgramacao } = await import('@/services/implantacao-portal.service');
      await avisarProgramacao(prisma, espera.id).catch(() => {});
    }
    await linhaDoTempo(prisma, id, `⏳ ${NOME_ESPERA[b.data.tipo][0].toUpperCase()}${NOME_ESPERA[b.data.tipo].slice(1)}: ${b.data.motivo}${b.data.o_que_resolver ? ` · Precisa: ${b.data.o_que_resolver}` : ''}${b.data.responsavel_nome ? ` · Com: ${b.data.responsavel_nome}` : ''}`, u);
    return reply.status(201).send({ status: 'success', data: espera });
  });

  fastify.post('/implantacoes/esperas/:esperaId/resolver', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const { esperaId } = request.params as { esperaId: string };
    const b = z.object({ resposta: z.string().max(2000).optional().nullable() }).safeParse(request.body || {});
    const e = await prisma.implantacaoEspera.findUnique({ where: { id: esperaId } });
    if (!e || e.fim) return reply.status(404).send({ status: 'error', message: 'Espera não encontrada ou já resolvida' });
    // Quem pode resolver: gestão, quem abriu, o responsável (ex.: Sinval) ou o técnico da demanda.
    const imp = await prisma.implantacao.findUnique({ where: { id: e.implantacao_id }, select: { tecnico_id: true } });
    if (!ehGestaoTecnica(u) && ![e.aberta_por_id, e.responsavel_id, imp?.tecnico_id].includes(u.id)) return reply.status(403).send({ status: 'error', message: 'Sem permissão para resolver esta espera' });
    const resposta = b.success ? b.data.resposta || null : null;
    const atual = await prisma.implantacaoEspera.update({ where: { id: esperaId }, data: { fim: new Date(), resolvida_por_nome: u.nome || u.id, resposta } });
    const horas = ((atual.fim!.getTime() - e.inicio.getTime()) / 3600000).toFixed(1).replace('.', ',');
    await linhaDoTempo(prisma, e.implantacao_id, `✅ Fim da espera (${NOME_ESPERA[e.tipo]}), ${horas}h parada${resposta ? `: ${resposta}` : ''}`, u);
    return reply.send({ status: 'success', data: atual });
  });

  // ── Esperas abertas (painel da programação/gestão)
  fastify.get('/implantacoes/esperas/abertas', async (request, reply) => {
    const u = getUser(request);
    if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const where: any = { fim: null };
    if (!ehGestaoTecnica(u)) where.OR = [{ responsavel_id: u.id }, { aberta_por_id: u.id }, { implantacao: { tecnico_id: u.id } }];
    const esperas = await prisma.implantacaoEspera.findMany({ where, include: { implantacao: { select: { id: true, cliente_razao_social: true, tecnico_nome: true } } }, orderBy: { inicio: 'asc' } });
    return reply.send({ status: 'success', data: esperas });
  });

  // ── Jornada (gestão)
  fastify.get('/implantacoes/cronometro/jornada', async (_request, reply) => reply.send({ status: 'success', data: await obterJornada(prisma) }));
}
