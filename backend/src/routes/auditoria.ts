import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

/**
 * Auditoria consolidada — UMA aba para CEO/Supervisão auditarem TUDO sobre
 * todos os usuários. Une as 4 fontes de trilha já gravadas no sistema:
 *   - PropostaHistorico  (módulo PROPOSTA: criação, renegociação, aceite, exclusão)
 *   - LeadHistorico      (módulo LEAD: mudança de etapa, alteração de dados, atribuição)
 *   - LeadObservacao     (módulo LEAD: contatos/observações)
 *   - AuditoriaUsuario   (módulo USUARIO: criar/editar/excluir usuário)
 *
 * Cada evento é normalizado para um formato único e filtrável.
 */

interface EventoAuditoria {
  id: string;
  data: string;            // ISO
  modulo: string;          // PROPOSTA | LEAD | USUARIO
  tipo: string;            // ação (ex.: CRIACAO, MOVEU_ETAPA, EXCLUSAO...)
  descricao: string;       // texto legível
  ator_id: string | null;  // quem fez
  ator_nome: string | null;
  ator_role: string | null;
  alvo: string | null;     // sobre o quê (proposta/lead/usuário)
  detalhe: string | null;  // de→para, motivo, observação
}

export async function auditoriaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/auditoria', async (request, reply) => {
    if (!requireGestor(request, reply)) return;   // só CEO/Supervisão/Admin

    const q = z.object({
      modulo: z.string().optional(),       // PROPOSTA | LEAD | USUARIO
      ator_id: z.string().optional(),      // filtra por usuário (quem fez)
      tipo: z.string().optional(),         // filtra por ação
      data_inicio: z.string().optional(),
      data_fim: z.string().optional(),
      busca: z.string().optional(),        // texto livre (descrição/alvo/detalhe)
      page: z.coerce.number().default(0),
      limit: z.coerce.number().default(50),
    }).safeParse(request.query);
    const f = q.success ? q.data : ({} as any);

    const ini = f.data_inicio ? new Date(f.data_inicio) : null;
    const fim = f.data_fim ? new Date(f.data_fim) : null;
    const dentro = (d?: Date | null) => {
      if (!d) return false;
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      return true;
    };
    const wantModulo = (m: string) => !f.modulo || f.modulo === m;

    // Mapa id→{nome,cargo} para resolver atores que só têm id
    const usuarios: any[] = await prisma.$queryRawUnsafe(`SELECT id, nome, cargo FROM UsuarioCRM`).catch(() => []);
    const uMap: Record<string, any> = {};
    for (const u of usuarios) uMap[u.id] = u;
    uMap['user-jessica'] = uMap['user-jessica'] || { id: 'user-jessica', nome: 'Jessica', cargo: 'CEO' };
    const nomeDe = (id?: string | null, fallback?: string | null) => (id && uMap[id]?.nome) || fallback || (id || null);
    const roleDe = (id?: string | null, fallback?: string | null) => (id && uMap[id]?.cargo) || fallback || null;

    const eventos: EventoAuditoria[] = [];

    // ── PROPOSTA (PropostaHistorico) ──
    if (wantModulo('PROPOSTA')) {
      const rows = await prisma.propostaHistorico.findMany({
        orderBy: { created_at: 'desc' }, take: 1500,
        include: { proposta: { select: { razao_social: true } } },
      }).catch(() => [] as any[]);
      for (const r of rows) {
        eventos.push({
          id: 'ph-' + r.id, data: (r.created_at || new Date()).toISOString(),
          modulo: 'PROPOSTA', tipo: r.tipo || 'EVENTO',
          descricao: r.valor_novo || r.observacao || r.tipo || 'Evento de proposta',
          ator_id: r.feito_por_id || null, ator_nome: nomeDe(r.feito_por_id, r.feito_por_nome), ator_role: roleDe(r.feito_por_id, r.feito_por_role),
          alvo: r.proposta?.razao_social || ('Proposta ' + r.proposta_id),
          detalhe: [r.valor_anterior && ('De: ' + r.valor_anterior), r.motivo && ('Motivo: ' + r.motivo)].filter(Boolean).join(' · ') || null,
        });
      }
    }

    // ── LEAD (LeadHistorico) ──
    if (wantModulo('LEAD')) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes, created_at
         FROM LeadHistorico ORDER BY created_at DESC LIMIT 1500`
      ).catch(() => []);
      for (const r of rows) {
        let det: string | null = null;
        if (r.etapa_anterior || r.etapa_destino) det = (r.etapa_anterior || '—') + ' → ' + (r.etapa_destino || '—');
        else if (r.detalhes) { try { const d = typeof r.detalhes === 'string' ? JSON.parse(r.detalhes) : r.detalhes; if (d?.mudancas) det = d.mudancas.map((m: any) => `${m.label}: ${m.de}→${m.para}`).join(' · '); } catch {} }
        eventos.push({
          id: 'lh-' + r.id, data: new Date(r.created_at).toISOString(),
          modulo: 'LEAD', tipo: r.acao || 'EVENTO',
          descricao: r.lead_nome ? ('Lead: ' + r.lead_nome) : 'Evento de lead',
          ator_id: r.ator_id || null, ator_nome: nomeDe(r.ator_id, r.ator_nome), ator_role: roleDe(r.ator_id),
          alvo: r.lead_nome || ('Lead ' + r.lead_id), detalhe: det,
        });
      }
      // Observações/contatos
      const obs = await prisma.leadObservacao.findMany({
        orderBy: { created_at: 'desc' }, take: 1000,
        include: { lead: { select: { nome: true } } },
      }).catch(() => [] as any[]);
      for (const o of obs) {
        eventos.push({
          id: 'lo-' + o.id, data: (o.created_at || new Date()).toISOString(),
          modulo: 'LEAD', tipo: o.tipo || 'OBSERVACAO',
          descricao: o.descricao || 'Observação no lead',
          ator_id: o.created_by || null, ator_nome: nomeDe(o.created_by, o.created_by_name), ator_role: roleDe(o.created_by),
          alvo: o.lead?.nome || ('Lead ' + o.lead_id), detalhe: null,
        });
      }
    }

    // ── USUARIO (AuditoriaUsuario) ──
    if (wantModulo('USUARIO')) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, ator_id, ator_nome, ator_role, acao, alvo_id, alvo_nome, detalhes, created_at
         FROM AuditoriaUsuario ORDER BY created_at DESC LIMIT 1000`
      ).catch(() => []);
      for (const r of rows) {
        eventos.push({
          id: 'au-' + r.id, data: new Date(r.created_at).toISOString(),
          modulo: 'USUARIO', tipo: r.acao || 'EVENTO',
          descricao: 'Usuário: ' + (r.alvo_nome || r.alvo_id || '—'),
          ator_id: r.ator_id || null, ator_nome: nomeDe(r.ator_id, r.ator_nome), ator_role: r.ator_role || roleDe(r.ator_id),
          alvo: r.alvo_nome || r.alvo_id || null, detalhe: null,
        });
      }
    }

    // ── Filtros (em memória, sobre o feed unificado) ──
    let lista = eventos;
    if (f.ator_id) lista = lista.filter(e => e.ator_id === f.ator_id);
    if (f.tipo) lista = lista.filter(e => e.tipo === f.tipo);
    if (ini || fim) lista = lista.filter(e => dentro(new Date(e.data)));
    if (f.busca) {
      const b = f.busca.toLowerCase();
      lista = lista.filter(e =>
        (e.descricao || '').toLowerCase().includes(b) ||
        (e.alvo || '').toLowerCase().includes(b) ||
        (e.ator_nome || '').toLowerCase().includes(b) ||
        (e.detalhe || '').toLowerCase().includes(b));
    }

    lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const total = lista.length;
    const page = f.page || 0, limit = f.limit || 50;
    const pagina = lista.slice(page * limit, page * limit + limit);

    // Tipos distintos (p/ popular o filtro no frontend)
    const tipos = Array.from(new Set(eventos.map(e => e.tipo))).sort();

    return reply.send({
      status: 'success',
      data: {
        eventos: pagina, total, page, limit,
        tipos,
        usuarios: usuarios.map(u => ({ id: u.id, nome: u.nome, cargo: u.cargo })),
      },
    });
  });
}
