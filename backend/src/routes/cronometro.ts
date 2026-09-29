import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser } from '../lib/scope';

// Cronômetro de atividades longas (um ativo por pessoa): iniciar, pausar com motivo, retomar,
// finalizar, e o relatório "Meu tempo" (horas por dia, por tarefa, pausas por motivo).

const agoraSeg = (desde: Date | null) => (desde ? Math.max(0, Math.round((Date.now() - desde.getTime()) / 1000)) : 0);
const comTempo = (c: any) => ({ ...c, segundos_agora: c.segundos + (c.status === 'RODANDO' ? agoraSeg(c.rodando_desde) : 0) });
const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export async function cronometroRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const logado = (request: any, reply: any) => {
    const u = getUser(request);
    if (!u) { reply.status(401).send({ status: 'error', message: 'Faça login.' }); return null; }
    return u;
  };
  const doUsuario = (id: string, usuario_id: string) => prisma.cronometro.findFirst({ where: { id, usuario_id } });

  // Cronômetro aberto (rodando ou pausado) da pessoa, com os eventos.
  fastify.get('/cronometros/ativo', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const c = await prisma.cronometro.findFirst({ where: { usuario_id: u.id, status: { in: ['RODANDO', 'PAUSADO'] } }, include: { eventos: { orderBy: { em: 'asc' } } }, orderBy: { iniciado_em: 'desc' } });
    return reply.send({ status: 'success', data: c ? comTempo(c) : null });
  });

  fastify.post('/cronometros', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const b = z.object({ titulo: z.string().trim().min(1).max(255), atividade_id: z.string().max(64).optional().nullable() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Diga o que você vai fazer (título).' });
    const aberto = await prisma.cronometro.findFirst({ where: { usuario_id: u.id, status: { in: ['RODANDO', 'PAUSADO'] } } });
    if (aberto) return reply.status(409).send({ status: 'error', message: `Você já tem um cronômetro aberto ("${aberto.titulo}"). Finalize antes de começar outro.` });
    const agora = new Date();
    const c = await prisma.cronometro.create({
      data: { usuario_id: u.id, usuario_nome: u.nome || null, titulo: b.data.titulo, atividade_id: b.data.atividade_id || null, status: 'RODANDO', rodando_desde: agora, iniciado_em: agora, eventos: { create: { tipo: 'INICIO', em: agora } } },
      include: { eventos: true },
    });
    return reply.send({ status: 'success', data: comTempo(c) });
  });

  fastify.post('/cronometros/:id/pausar', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ motivo: z.string().trim().min(2, 'Diga o motivo da pausa.').max(500) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Diga o motivo da pausa.' });
    const c = await doUsuario(id, u.id);
    if (!c || c.status !== 'RODANDO') return reply.status(400).send({ status: 'error', message: 'Este cronômetro não está rodando.' });
    const upd = await prisma.cronometro.update({
      where: { id }, data: { status: 'PAUSADO', segundos: c.segundos + agoraSeg(c.rodando_desde), rodando_desde: null, eventos: { create: { tipo: 'PAUSA', motivo: b.data.motivo } } },
      include: { eventos: { orderBy: { em: 'asc' } } },
    });
    return reply.send({ status: 'success', data: comTempo(upd) });
  });

  fastify.post('/cronometros/:id/retomar', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const c = await doUsuario(id, u.id);
    if (!c || c.status !== 'PAUSADO') return reply.status(400).send({ status: 'error', message: 'Este cronômetro não está pausado.' });
    const upd = await prisma.cronometro.update({
      where: { id }, data: { status: 'RODANDO', rodando_desde: new Date(), eventos: { create: { tipo: 'RETOMADA' } } },
      include: { eventos: { orderBy: { em: 'asc' } } },
    });
    return reply.send({ status: 'success', data: comTempo(upd) });
  });

  fastify.post('/cronometros/:id/finalizar', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ resultado: z.string().max(2000).optional().nullable() }).safeParse(request.body || {});
    const c = await doUsuario(id, u.id);
    if (!c || c.status === 'FINALIZADO') return reply.status(400).send({ status: 'error', message: 'Este cronômetro já foi finalizado.' });
    const segundos = c.segundos + (c.status === 'RODANDO' ? agoraSeg(c.rodando_desde) : 0);
    const upd = await prisma.cronometro.update({
      where: { id }, data: { status: 'FINALIZADO', segundos, rodando_desde: null, finalizado_em: new Date(), resultado: b.success ? b.data.resultado || null : null, eventos: { create: { tipo: 'FIM', motivo: b.success ? b.data.resultado || null : null } } },
    });
    return reply.send({ status: 'success', data: comTempo(upd), message: `Registrado: ${Math.round(segundos / 60)} min em "${c.titulo}".` });
  });

  // Relatório "Meu tempo" (gestão pode ver de outra pessoa com ?usuario_id=).
  fastify.get('/cronometros/relatorio', async (request, reply) => {
    const u = logado(request, reply); if (!u) return;
    const q = request.query as { dias?: string; usuario_id?: string };
    const dias = Math.max(1, Math.min(365, Number(q.dias) || 30));
    const gestao = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'].includes(String(u.role || '').toUpperCase());
    const usuario_id = gestao && q.usuario_id ? q.usuario_id : u.id;
    const de = new Date(Date.now() - dias * 86400000);
    const cs = await prisma.cronometro.findMany({ where: { usuario_id, iniciado_em: { gte: de } }, include: { eventos: true }, orderBy: { iniciado_em: 'desc' } });
    const itens = cs.map(comTempo);
    const porDia: Record<string, number> = {};
    for (let i = dias - 1; i >= 0; i--) porDia[diaSP(new Date(Date.now() - i * 86400000))] = 0;
    for (const c of itens) { const d = diaSP(c.iniciado_em); porDia[d] = (porDia[d] || 0) + c.segundos_agora; }
    const porTitulo: Record<string, number> = {};
    for (const c of itens) porTitulo[c.titulo] = (porTitulo[c.titulo] || 0) + c.segundos_agora;
    const pausas: Record<string, number> = {};
    for (const c of cs) for (const e of c.eventos) if (e.tipo === 'PAUSA') { const m = (e.motivo || 'sem motivo').trim(); pausas[m] = (pausas[m] || 0) + 1; }
    return reply.send({
      status: 'success',
      data: {
        dias,
        total_segundos: itens.reduce((s, c) => s + c.segundos_agora, 0),
        quantidade: itens.length,
        por_dia: Object.entries(porDia).map(([dia, segundos]) => ({ dia, segundos })),
        por_titulo: Object.entries(porTitulo).map(([titulo, segundos]) => ({ titulo, segundos })).sort((a, b) => b.segundos - a.segundos),
        pausas: Object.entries(pausas).map(([motivo, vezes]) => ({ motivo, vezes })).sort((a, b) => b.vezes - a.vezes),
        lista: itens.map(c => ({ id: c.id, titulo: c.titulo, status: c.status, segundos: c.segundos_agora, iniciado_em: c.iniciado_em, finalizado_em: c.finalizado_em, resultado: c.resultado, pausas: c.eventos.filter((e: any) => e.tipo === 'PAUSA').map((e: any) => e.motivo) })),
      },
    });
  });
}
