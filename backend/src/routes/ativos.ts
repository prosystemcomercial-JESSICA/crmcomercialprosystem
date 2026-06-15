import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor, scopeUserId, podeVerTudo, getUser } from '@/lib/scope';
import { resolverNomesUsuarios } from '@/lib/usuarios';

/**
 * MÓDULO ATIVOS — CS comercial feito pelos vendedores.
 * A supervisão designa um GRUPO TÉCNICO a um vendedor (CampanhaAtivo). A fila de
 * clientes ATIVOS daquele grupo vira ContatoAtivo (cards de kanban). O vendedor
 * liga, aplica o questionário, mede a saúde do cliente, abre caso de churn quando
 * há problema e registra oportunidades de venda. Reflete na ficha (EventoCliente)
 * e no HealthScore. Meta = % de cobertura da fila + vendas geradas.
 */
export async function ativosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const NIVEIS = ['CRITICO', 'RISCO', 'ATENCAO', 'SAUDAVEL', 'EXCELENTE'];

  // ── Designar campanha (supervisão): puxa os clientes ATIVOS do grupo p/ a fila ──
  fastify.post('/ativos/campanhas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = getUser(request);
    const body = z.object({
      grupo_tecnico: z.string().min(1, 'Informe o grupo técnico'),
      vendedor_id: z.string().min(1, 'Informe o vendedor'),
      meta_cobertura_pct: z.number().int().min(1).max(100).default(100),
      observacoes: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });

    // Nome do vendedor (UsuarioCRM ou conta de sistema).
    const nomes = await resolverNomesUsuarios(prisma, [body.data.vendedor_id]).catch(() => ({} as any));
    const vendedorNome = nomes[body.data.vendedor_id] || null;

    // Clientes ATIVOS do grupo técnico (a fila).
    const clientes = await prisma.cliente.findMany({
      where: { grupo_tecnico: body.data.grupo_tecnico, OR: [{ situacao: 'ATIVA' }, { situacao: null }] },
      select: { id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true },
    }).catch(() => [] as any[]);

    const campanha = await prisma.campanhaAtivo.create({
      data: {
        grupo_tecnico: body.data.grupo_tecnico,
        vendedor_id: body.data.vendedor_id,
        vendedor_nome: vendedorNome,
        criada_por: user?.id || 'system',
        meta_cobertura_pct: body.data.meta_cobertura_pct,
        observacoes: body.data.observacoes || undefined,
        total_fila: clientes.length,
      },
    });

    // Cria 1 ContatoAtivo por cliente (idempotente pela unique campanha+cliente).
    if (clientes.length) {
      await prisma.contatoAtivo.createMany({
        data: clientes.map((c: any) => ({
          campanha_id: campanha.id,
          cliente_id: c.id,
          cliente_nome: c.razao_social || c.nome_fantasia || c.nome || null,
          cliente_codigo: c.codigo || null,
          vendedor_id: body.data.vendedor_id,
        })),
        skipDuplicates: true,
      }).catch(() => {});
    }

    return reply.status(201).send({ status: 'success', data: { campanha, fila: clientes.length } });
  });

  // ── Listar campanhas (vendedor vê as suas; gestão vê todas) ──
  fastify.get('/ativos/campanhas', async (request, reply) => {
    const scopeId = scopeUserId(request);
    const where: any = {};
    if (scopeId !== null) where.vendedor_id = scopeId;
    const campanhas = await prisma.campanhaAtivo.findMany({
      where, orderBy: { created_at: 'desc' },
    });
    // Anexa progresso (concluídos / fila) p/ cada campanha.
    const ids = campanhas.map(c => c.id);
    const contatos = ids.length ? await prisma.contatoAtivo.findMany({
      where: { campanha_id: { in: ids } }, select: { campanha_id: true, etapa: true },
    }) : [];
    const prog: Record<string, any> = {};
    for (const ct of contatos) {
      prog[ct.campanha_id] = prog[ct.campanha_id] || { total: 0, concluidos: 0, em_contato: 0 };
      prog[ct.campanha_id].total += 1;
      if (ct.etapa === 'CONCLUIDO' || ct.etapa === 'SEM_SUCESSO') prog[ct.campanha_id].concluidos += 1;
      if (ct.etapa === 'EM_CONTATO') prog[ct.campanha_id].em_contato += 1;
    }
    const data = campanhas.map(c => {
      const p = prog[c.id] || { total: c.total_fila, concluidos: 0, em_contato: 0 };
      const cobertura = p.total ? Math.round((p.concluidos / p.total) * 100) : 0;
      return { ...c, progresso: { ...p, cobertura_pct: cobertura, bateu_meta: cobertura >= c.meta_cobertura_pct } };
    });
    return reply.send({ status: 'success', data });
  });

  // ── Kanban de uma campanha (contatos agrupados por etapa) ──
  fastify.get('/ativos/campanhas/:id/contatos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const camp = await prisma.campanhaAtivo.findUnique({ where: { id } });
    if (!camp) return reply.status(404).send({ status: 'error', message: 'Campanha não encontrada' });
    // Escopo: vendedor só acessa a própria campanha.
    const scopeId = scopeUserId(request);
    if (scopeId !== null && camp.vendedor_id !== scopeId) {
      return reply.status(403).send({ status: 'error', message: 'Sem acesso a esta campanha' });
    }
    // Vendedor NÃO vê os ocultados pela supervisão (não devem ser tratados).
    // Gestão vê todos (com a marcação de oculto/etiqueta) p/ poder gerenciar.
    const ehGestor = podeVerTudo(getUser(request));
    const where: any = { campanha_id: id };
    if (!ehGestor) where.oculto = false;
    const contatos = await prisma.contatoAtivo.findMany({
      where, orderBy: [{ etapa: 'asc' }, { cliente_nome: 'asc' }],
    });
    return reply.send({ status: 'success', data: { campanha: camp, contatos } });
  });

  // ── Supervisão: ocultar/exibir e etiquetar um contato (só gestão) ──
  fastify.patch('/ativos/contatos/:id/supervisao', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      oculto: z.boolean().optional(),
      oculto_motivo: z.string().optional(),
      etiqueta: z.string().nullable().optional(),
      etiqueta_cor: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const c = await prisma.contatoAtivo.update({ where: { id }, data: body.data as any });
      return reply.send({ status: 'success', data: c });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
      throw e;
    }
  });

  // ── Atualizar um contato: avançar etapa, salvar questionário, abrir caso, venda ──
  fastify.patch('/ativos/contatos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const body = z.object({
      etapa: z.enum(['A_CONTATAR', 'EM_CONTATO', 'CONCLUIDO', 'SEM_SUCESSO']).optional(),
      // questionário
      usa_sistema_ok: z.boolean().optional(),
      suporte_ok: z.boolean().optional(),
      tecnico_ok: z.boolean().optional(),
      conhece_novas_ferr: z.boolean().optional(),
      plus_apresentado: z.boolean().optional(),
      nota_prosystem: z.number().int().min(1).max(5).optional(),
      sugestoes: z.string().optional(),
      saude: z.enum(['CRITICO', 'RISCO', 'ATENCAO', 'SAUDAVEL', 'EXCELENTE']).optional(),
      // problema → abre caso de churn
      tem_problema: z.boolean().optional(),
      problema_descricao: z.string().optional(),
      abrir_caso: z.boolean().optional(),
      // oportunidade de venda — escolhe a oferta (parceiro) e cria a venda real
      gerou_venda: z.boolean().optional(),
      tipo_venda: z.string().optional(),
      venda_obs: z.string().optional(),
      parceiro_id: z.string().optional(),       // oferta escolhida do catálogo de parceiros
      venda_valor: z.number().optional(),        // setup/valor da venda
      venda_acrescimo: z.number().optional(),    // acréscimo na mensalidade (ex.: fiscal)
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });

    const atual = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    // Escopo: vendedor só mexe nos próprios contatos.
    const scopeId = scopeUserId(request);
    if (scopeId !== null && atual.vendedor_id !== scopeId) {
      return reply.status(403).send({ status: 'error', message: 'Sem acesso a este contato' });
    }

    const { abrir_caso, parceiro_id, venda_valor, venda_acrescimo, ...campos } = body.data;
    const data: any = { ...campos };

    // Ao entrar EM_CONTATO pela 1ª vez, conta a tentativa; ao concluir, marca data.
    if (body.data.etapa === 'EM_CONTATO' && atual.etapa === 'A_CONTATAR') data.tentativas = (atual.tentativas || 0) + 1;
    if (body.data.etapa === 'CONCLUIDO' || body.data.etapa === 'SEM_SUCESSO') data.contatado_em = new Date();

    // Abrir caso de churn (reaproveita o módulo de retenção) quando há problema.
    let casoId = atual.caso_churn_id || null;
    if (abrir_caso && !casoId) {
      const caso = await prisma.casoChurn.create({
        data: {
          clienteId: atual.cliente_id,
          status: 'NOVO',
          motivo_principal: 'Identificado no contato ativo',
          descricao: body.data.problema_descricao || 'Problema relatado no contato ativo (CS comercial).',
          created_by: user?.id || 'system',
        },
      }).catch(() => null);
      if (caso) {
        casoId = caso.id;
        data.caso_churn_id = caso.id;
        data.tem_problema = true;
        // Marca o cliente em risco/atenção (igual ao fluxo do churn).
        await prisma.cliente.update({ where: { id: atual.cliente_id }, data: { risco_atencao: true } }).catch(() => {});
        await prisma.healthScore.updateMany({
          where: { cliente_id: atual.cliente_id, nivel: { in: ['EXCELENTE', 'SAUDAVEL', 'ATENCAO'] } },
          data: { nivel: 'RISCO' },
        }).catch(() => {});
      }
    }

    // VENDA gerada a partir do contato: cria a VendaAdicional REAL (a mesma de
    // Indicações), com origem 'ATIVO' e ligada a este contato p/ rastreio. A venda
    // nasce PENDENTE — a gestão confirma/data depois, como já faz. Idempotente: só
    // cria se ainda não houver venda vinculada.
    if (body.data.gerou_venda && parceiro_id && !atual.venda_ref_id) {
      const parceiro = await prisma.parceiro.findUnique({ where: { id: parceiro_id } }).catch(() => null);
      if (parceiro) {
        const venda = await prisma.vendaAdicional.create({
          data: {
            cliente_id: atual.cliente_id,
            parceiro_id,
            vendedor_id: atual.vendedor_id,
            tipo_negocio: 'INDICACAO',
            valor_venda: venda_valor ?? undefined,
            acrescimo_mensal: venda_acrescimo ?? undefined,
            observacoes: `Origem: Contato ativo (CS)${body.data.venda_obs ? ' — ' + body.data.venda_obs : ''}`,
            status: 'PENDENTE',
            created_by: user?.id || 'system',
          } as any,
        }).catch(() => null);
        if (venda) {
          data.venda_ref_id = venda.id;
          data.tipo_venda = parceiro.categoria || data.tipo_venda;
          data.gerou_venda = true;
        }
      }
    }

    const contato = await prisma.contatoAtivo.update({ where: { id }, data });

    // Ao CONCLUIR: registra na ficha (EventoCliente) e atualiza o HealthScore.
    if (body.data.etapa === 'CONCLUIDO') {
      const partes: string[] = [];
      if (contato.nota_prosystem != null) partes.push(`Nota Prosystem: ${contato.nota_prosystem}/5`);
      if (contato.suporte_ok === false) partes.push('Insatisfeito com suporte');
      if (contato.tecnico_ok === false) partes.push('Insatisfeito com o técnico');
      if (contato.plus_apresentado) partes.push('Plus apresentado');
      if (contato.gerou_venda) partes.push(`Oportunidade: ${contato.tipo_venda || 'venda'}`);
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: atual.cliente_id, tipo: 'OBSERVACAO',
          titulo: `📞 Contato ativo (CS) — saúde: ${contato.saude || '—'}`,
          descricao: [partes.join(' · '), contato.sugestoes ? `Sugestões: ${contato.sugestoes}` : '']
            .filter(Boolean).join('\n') || undefined,
          referencia_id: contato.id,
          metadados: { nota: contato.nota_prosystem, saude: contato.saude, gerou_venda: contato.gerou_venda, tipo_venda: contato.tipo_venda, caso_churn_id: casoId },
          feito_por: user?.id, feito_por_nome: user?.nome,
        },
      }).catch(() => {});

      // HealthScore: registra a saúde percebida (nunca melhora um cliente em churn).
      if (contato.saude) {
        const scoreMap: Record<string, number> = { CRITICO: 15, RISCO: 35, ATENCAO: 55, SAUDAVEL: 80, EXCELENTE: 95 };
        const existente = await prisma.healthScore.findUnique({ where: { cliente_id: atual.cliente_id } }).catch(() => null);
        const nivelFinal = (casoId && NIVEIS.indexOf(contato.saude) > NIVEIS.indexOf('RISCO')) ? 'RISCO' : contato.saude;
        if (existente) {
          await prisma.healthScore.update({
            where: { cliente_id: atual.cliente_id },
            data: { nivel: nivelFinal, score: scoreMap[nivelFinal] ?? existente.score, calculado_at: new Date(), fatores: { ...(existente.fatores as any), contato_ativo: { nota: contato.nota_prosystem, saude: contato.saude } } as any },
          }).catch(() => {});
        } else {
          await prisma.healthScore.create({
            data: { cliente_id: atual.cliente_id, nivel: nivelFinal, score: scoreMap[nivelFinal] ?? 55, fatores: { contato_ativo: { nota: contato.nota_prosystem, saude: contato.saude } } as any },
          }).catch(() => {});
        }
      }
    }

    return reply.send({ status: 'success', data: { ...contato, caso_churn_id: casoId } });
  });

  // ── Contatos ativos de um cliente (p/ aba na ficha) ──
  fastify.get('/ativos/cliente/:clienteId', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const contatos = await prisma.contatoAtivo.findMany({
      where: { cliente_id: clienteId }, orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: contatos });
  });

  // ── PAINEL DA SUPERVISÃO: saúde da carteira por fila/vendedor/técnico ──
  // Cobertura (% contatados), saúde média, vendas geradas, casos abertos.
  fastify.get('/ativos/painel', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const campanhas = await prisma.campanhaAtivo.findMany({ orderBy: { created_at: 'desc' } });
    const contatos = await prisma.contatoAtivo.findMany({});

    // Valor real gerado: soma das VendaAdicional vinculadas (setup + acréscimo).
    const vendaIds = contatos.map(c => c.venda_ref_id).filter(Boolean) as string[];
    const vendas = vendaIds.length ? await prisma.vendaAdicional.findMany({
      where: { id: { in: vendaIds } }, select: { id: true, valor_venda: true, acrescimo_mensal: true, status: true },
    }).catch(() => [] as any[]) : [];
    const valorDaVenda: Record<string, number> = {};
    for (const v of vendas as any[]) valorDaVenda[v.id] = Number(v.valor_venda || 0) + Number(v.acrescimo_mensal || 0);

    const porCamp: Record<string, any> = {};
    for (const c of campanhas) {
      porCamp[c.id] = {
        campanha_id: c.id, grupo_tecnico: c.grupo_tecnico, vendedor_id: c.vendedor_id, vendedor_nome: c.vendedor_nome,
        meta_cobertura_pct: c.meta_cobertura_pct, status: c.status,
        total: 0, concluidos: 0, em_contato: 0, com_problema: 0, casos_abertos: 0, vendas: 0, valor_gerado: 0,
        nota_soma: 0, nota_count: 0, saude_dist: { CRITICO: 0, RISCO: 0, ATENCAO: 0, SAUDAVEL: 0, EXCELENTE: 0 },
      };
    }
    for (const ct of contatos) {
      const g = porCamp[ct.campanha_id]; if (!g) continue;
      g.total += 1;
      if (ct.etapa === 'CONCLUIDO' || ct.etapa === 'SEM_SUCESSO') g.concluidos += 1;
      if (ct.etapa === 'EM_CONTATO') g.em_contato += 1;
      if (ct.tem_problema) g.com_problema += 1;
      if (ct.caso_churn_id) g.casos_abertos += 1;
      if (ct.gerou_venda) g.vendas += 1;
      if (ct.venda_ref_id && valorDaVenda[ct.venda_ref_id]) g.valor_gerado += valorDaVenda[ct.venda_ref_id];
      if (ct.nota_prosystem != null) { g.nota_soma += ct.nota_prosystem; g.nota_count += 1; }
      if (ct.saude && g.saude_dist[ct.saude] !== undefined) g.saude_dist[ct.saude] += 1;
    }
    const filas = Object.values(porCamp).map((g: any) => ({
      ...g,
      cobertura_pct: g.total ? Math.round((g.concluidos / g.total) * 100) : 0,
      bateu_meta: g.total ? Math.round((g.concluidos / g.total) * 100) >= g.meta_cobertura_pct : false,
      nota_media: g.nota_count ? Math.round((g.nota_soma / g.nota_count) * 10) / 10 : null,
      saudaveis: g.saude_dist.SAUDAVEL + g.saude_dist.EXCELENTE,
      em_risco: g.saude_dist.RISCO + g.saude_dist.CRITICO,
    })).sort((a: any, b: any) => b.em_risco - a.em_risco);

    // Ranking por técnico (grupo) — agrega as filas do mesmo grupo.
    const porGrupo: Record<string, any> = {};
    for (const f of filas) {
      porGrupo[f.grupo_tecnico] = porGrupo[f.grupo_tecnico] || { grupo_tecnico: f.grupo_tecnico, total: 0, concluidos: 0, saudaveis: 0, em_risco: 0, casos_abertos: 0, vendas: 0, nota_soma: 0, nota_count: 0 };
      const gg = porGrupo[f.grupo_tecnico];
      gg.total += f.total; gg.concluidos += f.concluidos; gg.saudaveis += f.saudaveis; gg.em_risco += f.em_risco;
      gg.casos_abertos += f.casos_abertos; gg.vendas += f.vendas;
      if (f.nota_media != null) { gg.nota_soma += f.nota_media * f.nota_count; gg.nota_count += f.nota_count; }
    }
    const ranking_tecnicos = Object.values(porGrupo).map((g: any) => ({
      ...g,
      nota_media: g.nota_count ? Math.round((g.nota_soma / g.nota_count) * 10) / 10 : null,
      indice_saude: (g.saudaveis + g.em_risco) ? Math.round((g.saudaveis / (g.saudaveis + g.em_risco)) * 100) : null,
    })).sort((a: any, b: any) => (b.indice_saude ?? -1) - (a.indice_saude ?? -1));

    const totais = {
      filas: filas.length,
      contatos_total: contatos.length,
      concluidos: contatos.filter(c => c.etapa === 'CONCLUIDO' || c.etapa === 'SEM_SUCESSO').length,
      casos_abertos: contatos.filter(c => c.caso_churn_id).length,
      vendas_geradas: contatos.filter(c => c.gerou_venda).length,
      valor_gerado: Math.round(Object.values(valorDaVenda).reduce((s, v) => s + v, 0) * 100) / 100,
    };
    return reply.send({ status: 'success', data: { filas, ranking_tecnicos, totais } });
  });
}
