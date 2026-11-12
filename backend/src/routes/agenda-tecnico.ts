import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, podeVerTudo } from '@/lib/scope';
import { ehCargoTecnico } from '@/lib/implantacao/portal';
import { TIPOS_COMPROMISSO, ROTULO_ANTECEDENCIA, validarCompromisso } from '@/lib/implantacao/agenda-tecnico';

/**
 * Agenda do técnico (12/11/2026): compromissos com o cliente marcados no Portal Técnico (menu Agenda ou card).
 * O alerta no WhatsApp do técnico sai pelo `rodarAlertasAgenda` (scheduler de 1 minuto no server.ts).
 *
 * Quem vê o quê: cada pessoa vê a própria agenda; a gestão técnica vê e marca para qualquer técnico; dentro de um
 * card, quem tem acesso ao card vê todos os compromissos daquele cliente.
 */

const ehGestaoTecnica = (u: any) => podeVerTudo(u) || (u?.role || '').toUpperCase() === 'SUPERVISAO_TECNICA';
const fmt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

/** "2026-11-13T10:00" (campo de data e hora da tela, sem fuso) é horário de Brasília. */
function lerInicio(v: any): Date {
  const s = String(v || '').trim();
  if (!s) return new Date('x');
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(s)) return new Date(s);
  return new Date(`${s.length === 16 ? `${s}:00` : s}-03:00`);
}
const txt = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

export async function agendaTecnicoRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const linhaDoCard = (implantacaoId: string | null, descricao: string, u: any) => implantacaoId
    ? prisma.implantacaoAtividade.create({ data: { implantacao_id: implantacaoId, tipo: 'NOTA', descricao, autor_id: u?.id, autor_nome: u?.nome || 'Sistema' } }).catch(() => null)
    : null;

  /** Card acessível (técnico: só os dele; gestão: todos). */
  const cardDe = async (u: any, id: string) => {
    const imp = await prisma.implantacao.findUnique({ where: { id }, select: { id: true, cliente_razao_social: true, tecnico_id: true, tecnico_nome: true } });
    if (!imp) return null;
    if (ehCargoTecnico(u?.role) && !ehGestaoTecnica(u) && imp.tecnico_id !== u.id) return null;
    return imp;
  };
  const podeMexer = (u: any, c: { tecnico_id: string; criado_por_id: string | null }) => ehGestaoTecnica(u) || c.tecnico_id === u.id || c.criado_por_id === u.id;

  // Opções da tela (tipos e quando avisar), para não repetir a lista no frontend.
  fastify.get('/agenda-tecnico/opcoes', async (_request, reply) => reply.send({
    status: 'success',
    data: { tipos: Object.entries(TIPOS_COMPROMISSO).map(([k, v]) => ({ k, ...v })), antecedencias: Object.entries(ROTULO_ANTECEDENCIA).map(([k, l]) => ({ k: Number(k), l })) },
  }));

  // ── LISTA: ?de=&ate=&tecnico_id=&implantacao_id=
  fastify.get('/agenda-tecnico', async (request, reply) => {
    const u = getUser(request); if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const q = request.query as { de?: string; ate?: string; tecnico_id?: string; implantacao_id?: string };
    const where: any = {};
    if (q.implantacao_id) {
      if (!(await cardDe(u, q.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
      where.implantacao_id = q.implantacao_id;
    } else {
      where.tecnico_id = ehGestaoTecnica(u) ? (q.tecnico_id || undefined) : u.id;
      const agora = Date.now();
      const de = q.de ? new Date(q.de) : new Date(agora - 7 * 864e5);
      const ate = q.ate ? new Date(q.ate) : new Date(agora + 90 * 864e5);
      where.inicio = { gte: isNaN(de.getTime()) ? new Date(agora - 7 * 864e5) : de, lte: isNaN(ate.getTime()) ? new Date(agora + 90 * 864e5) : ate };
    }
    const lista = await prisma.agendaTecnico.findMany({ where, orderBy: { inicio: 'asc' }, take: 500 });
    return reply.send({ status: 'success', data: lista });
  });

  // ── NOVO compromisso
  fastify.post('/agenda-tecnico', async (request, reply) => {
    const u = getUser(request); if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const b = (request.body || {}) as any;
    const inicio = lerInicio(b.inicio);
    const dados = {
      tipo: TIPOS_COMPROMISSO[b.tipo] ? b.tipo : 'REUNIAO', titulo: txt(b.titulo, 200) || '', inicio,
      avisar_antes_min: b.avisar_antes_min == null || b.avisar_antes_min === '' ? 0 : Number(b.avisar_antes_min),
      duracao_min: b.duracao_min == null || b.duracao_min === '' ? 60 : Number(b.duracao_min),
    };
    const erro = validarCompromisso(dados, new Date());
    if (erro) return reply.status(400).send({ status: 'error', message: erro });

    let card: Awaited<ReturnType<typeof cardDe>> = null;
    if (b.implantacao_id) {
      card = await cardDe(u, String(b.implantacao_id));
      if (!card) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    }
    // Para quem é: a gestão escolhe o técnico (ou fica com o técnico do card); os demais marcam para si.
    let tecnicoId = u.id;
    if (ehGestaoTecnica(u)) tecnicoId = txt(b.tecnico_id, 40) || card?.tecnico_id || u.id;
    const tecnico = await prisma.usuarioCRM.findUnique({ where: { id: tecnicoId }, select: { id: true, nome: true, telefone: true } });
    if (!tecnico) return reply.status(400).send({ status: 'error', message: 'Técnico não encontrado' });

    const c = await prisma.agendaTecnico.create({
      data: {
        ...dados, tecnico_id: tecnico.id, tecnico_nome: tecnico.nome, implantacao_id: card?.id || null,
        cliente_nome: txt(b.cliente_nome, 200) || card?.cliente_razao_social || null,
        descricao: txt(b.descricao, 4000), contato_nome: txt(b.contato_nome, 120), contato_fone: txt(b.contato_fone, 40), link: txt(b.link, 500),
        criado_por_id: u.id, criado_por_nome: (u as any).nome || null,
      },
    });
    await linhaDoCard(c.implantacao_id, `📅 Agendado: ${TIPOS_COMPROMISSO[c.tipo].label} em ${fmt(c.inicio)}${c.tecnico_id !== u.id ? ` (técnico ${c.tecnico_nome})` : ''}: ${c.titulo}`, u);
    return reply.send({ status: 'success', data: c, sem_telefone: !tecnico.telefone });
  });

  // ── EDITAR (remarcar, mudar o aviso, o assunto…). Mudou a hora ou o aviso: o alerta volta a valer.
  fastify.put('/agenda-tecnico/:id', async (request, reply) => {
    const u = getUser(request); if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const { id } = request.params as { id: string };
    const atual = await prisma.agendaTecnico.findUnique({ where: { id } });
    if (!atual || !podeMexer(u, atual)) return reply.status(404).send({ status: 'error', message: 'Compromisso não encontrado' });
    const b = (request.body || {}) as any;
    const inicio = b.inicio != null ? lerInicio(b.inicio) : atual.inicio;
    const dados = {
      tipo: b.tipo != null ? b.tipo : atual.tipo, titulo: b.titulo != null ? (txt(b.titulo, 200) || '') : atual.titulo, inicio,
      avisar_antes_min: b.avisar_antes_min != null ? Number(b.avisar_antes_min) : atual.avisar_antes_min,
      duracao_min: b.duracao_min != null ? Number(b.duracao_min) : atual.duracao_min,
    };
    const remarcou = inicio.getTime() !== atual.inicio.getTime();
    const erro = validarCompromisso({ ...dados, inicio: remarcou ? inicio : new Date(8.64e15) }, new Date());
    if (erro) return reply.status(400).send({ status: 'error', message: erro });
    let tecnico: { id: string; nome: string } | null = null;
    if (ehGestaoTecnica(u) && b.tecnico_id && b.tecnico_id !== atual.tecnico_id) {
      tecnico = await prisma.usuarioCRM.findUnique({ where: { id: String(b.tecnico_id) }, select: { id: true, nome: true } });
      if (!tecnico) return reply.status(400).send({ status: 'error', message: 'Técnico não encontrado' });
    }
    const zeraAlerta = remarcou || dados.avisar_antes_min !== atual.avisar_antes_min || !!tecnico;
    const c = await prisma.agendaTecnico.update({
      where: { id },
      data: {
        ...dados,
        ...(b.cliente_nome !== undefined ? { cliente_nome: txt(b.cliente_nome, 200) } : {}),
        ...(b.descricao !== undefined ? { descricao: txt(b.descricao, 4000) } : {}),
        ...(b.contato_nome !== undefined ? { contato_nome: txt(b.contato_nome, 120) } : {}),
        ...(b.contato_fone !== undefined ? { contato_fone: txt(b.contato_fone, 40) } : {}),
        ...(b.link !== undefined ? { link: txt(b.link, 500) } : {}),
        ...(tecnico ? { tecnico_id: tecnico.id, tecnico_nome: tecnico.nome } : {}),
        ...(zeraAlerta ? { alerta_em: null, alerta_status: null, status: 'AGENDADO', concluido_em: null } : {}),
      },
    });
    if (remarcou) await linhaDoCard(c.implantacao_id, `📅 Remarcado: ${TIPOS_COMPROMISSO[c.tipo]?.label || 'Compromisso'} de ${fmt(atual.inicio)} para ${fmt(c.inicio)}: ${c.titulo}`, u);
    return reply.send({ status: 'success', data: c });
  });

  // ── REALIZADO / CANCELADO / reabrir
  fastify.post('/agenda-tecnico/:id/status', async (request, reply) => {
    const u = getUser(request); if (!u) return reply.status(401).send({ status: 'error', message: 'Faça login' });
    const { id } = request.params as { id: string };
    const b = (request.body || {}) as { status?: string; resultado?: string };
    if (!['REALIZADO', 'CANCELADO', 'AGENDADO'].includes(String(b.status))) return reply.status(400).send({ status: 'error', message: 'Situação inválida' });
    const atual = await prisma.agendaTecnico.findUnique({ where: { id } });
    if (!atual || !podeMexer(u, atual)) return reply.status(404).send({ status: 'error', message: 'Compromisso não encontrado' });
    const c = await prisma.agendaTecnico.update({
      where: { id },
      data: { status: b.status!, resultado: b.resultado !== undefined ? txt(b.resultado, 4000) : atual.resultado, concluido_em: b.status === 'AGENDADO' ? null : new Date() },
    });
    const rot = TIPOS_COMPROMISSO[c.tipo]?.label || 'Compromisso';
    const desc = b.status === 'REALIZADO' ? `✅ Realizado: ${rot} de ${fmt(c.inicio)}, ${c.titulo}${c.resultado ? `\nO que ficou combinado: ${c.resultado}` : ''}`
      : b.status === 'CANCELADO' ? `✖ Cancelado: ${rot} de ${fmt(c.inicio)}, ${c.titulo}${c.resultado ? ` (${c.resultado})` : ''}`
      : `↩ Reaberto: ${rot} de ${fmt(c.inicio)}, ${c.titulo}`;
    if (atual.status !== c.status) await linhaDoCard(c.implantacao_id, desc, u);
    return reply.send({ status: 'success', data: c });
  });
}
