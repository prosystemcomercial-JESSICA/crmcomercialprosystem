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

  // Análise PONDERADA de saúde do cliente a partir do contato ativo.
  // Não é só a nota: pondera conhecimento das ferramentas, suporte, técnico, Plus e
  // se há caso de churn aberto. Retorna score 0-100, nível, estrelas (1-5) e rótulo.
  function analisarSaude(f: { nota?: number | null; conheceFerr?: boolean | null; suporteOk?: boolean | null; tecnicoOk?: boolean | null; plus?: boolean | null; temCaso?: boolean; saudeManual?: string | null }) {
    let score = 50;
    if (f.nota != null) score = (Number(f.nota) / 5) * 100;          // base = nota (0-100)
    if (f.conheceFerr === true) score += 8; else if (f.conheceFerr === false) score -= 18; // usa o sistema?
    if (f.suporteOk === false) score -= 15; else if (f.suporteOk === true) score += 5;
    if (f.tecnicoOk === false) score -= 12;
    if (f.plus === true) score += 4;
    if (f.temCaso) score = Math.min(score, 38);                       // caso aberto trava em risco
    score = Math.max(0, Math.min(100, Math.round(score)));
    const nivel = score >= 85 ? 'EXCELENTE' : score >= 70 ? 'SAUDAVEL' : score >= 50 ? 'ATENCAO' : score >= 30 ? 'RISCO' : 'CRITICO';
    const estrelas = score >= 85 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : score >= 30 ? 2 : 1;
    const rotulo = { EXCELENTE: 'Muito satisfeito', SAUDAVEL: 'Satisfeito', ATENCAO: 'Atenção', RISCO: 'Em risco', CRITICO: 'Crítico' }[nivel];
    return { score, nivel, estrelas, rotulo };
  }

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
      where, orderBy: [{ updated_at: 'desc' }],
    });

    // Enriquece cada contato com dados do Cliente (plano + telefones + segmento)
    // p/ a etiqueta de plano no card e a mini-ficha (contato sem sair do módulo).
    const cliIds = [...new Set(contatos.map(c => c.cliente_id))];
    const clientes = cliIds.length ? await prisma.cliente.findMany({
      where: { id: { in: cliIds } },
      select: { id: true, plano: true, telefone: true, telefone1: true, telefone2: true, email: true, segmento: true, razao_social: true, nome_fantasia: true, nome: true, contato: true, mensalidade_base: true },
    }).catch(() => [] as any[]) : [];
    const mapaCli = new Map(clientes.map((c: any) => [c.id, c]));
    const enriquecidos = contatos.map((ct: any) => {
      const cli: any = mapaCli.get(ct.cliente_id) || {};
      return {
        ...ct,
        plano: cli.plano || null,
        cli_telefone: cli.telefone || cli.telefone1 || null,
        cli_telefone2: cli.telefone2 || null,
        cli_email: cli.email || null,
        cli_segmento: cli.segmento || null,
        cli_contato: cli.contato || null,
        cli_razao: cli.razao_social || cli.nome_fantasia || cli.nome || null,
        cli_mensalidade: cli.mensalidade_base || null,
      };
    });
    return reply.send({ status: 'success', data: { campanha: camp, contatos: enriquecidos } });
  });

  // ── Mini-ficha de um contato: dados do cliente + últimas atualizações da ficha ──
  fastify.get('/ativos/contatos/:id/ficha', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ct = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!ct) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    const scopeId = scopeUserId(request);
    if (scopeId !== null && ct.vendedor_id !== scopeId) {
      return reply.status(403).send({ status: 'error', message: 'Sem acesso' });
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id: ct.cliente_id },
      select: { id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true, plano: true, segmento: true, telefone: true, telefone1: true, telefone2: true, email: true, contato: true, mensalidade_base: true, grupo_tecnico: true },
    }).catch(() => null);
    // Contatos (pessoas) e últimas atualizações da ficha (timeline).
    const contatosPessoas = await (prisma as any).contatoCliente.findMany({
      where: { cliente_id: ct.cliente_id }, orderBy: [{ principal: 'desc' }], take: 10,
    }).catch(() => [] as any[]);
    const eventos = await (prisma as any).eventoCliente.findMany({
      where: { cliente_id: ct.cliente_id }, orderBy: { created_at: 'desc' }, take: 8,
    }).catch(() => [] as any[]);
    return reply.send({ status: 'success', data: { cliente, contatos_pessoas: contatosPessoas, eventos } });
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
      etapa: z.enum(['A_CONTATAR', 'EM_CONTATO', 'COTACAO', 'EM_TRATAMENTO', 'CONCLUIDO', 'SEM_SUCESSO']).optional(),
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
      // ── Atualização de dados do cliente (vai p/ a ficha) ──
      atualizar_cliente: z.boolean().optional(),
      cli_nome: z.string().optional(),       // razão/nome
      cli_telefone1: z.string().optional(),
      cli_telefone2: z.string().optional(),
      cli_segmento: z.string().optional(),   // Padaria | Farmácia | Manipulação | Varejo
      // Responsável de contato (salvo em ContatoCliente)
      cli_responsavel_nome: z.string().optional(),
      cli_responsavel_cargo: z.string().optional(),
      cli_responsavel_telefone: z.string().optional(),
      // Contatos adicionais (array de {nome, cargo, telefone})
      cli_contatos_adicionais: z.array(z.object({
        nome: z.string(),
        cargo: z.string().optional(),
        telefone: z.string().optional(),
      })).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });

    const atual = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    // Escopo: vendedor só mexe nos próprios contatos.
    const scopeId = scopeUserId(request);
    if (scopeId !== null && atual.vendedor_id !== scopeId) {
      return reply.status(403).send({ status: 'error', message: 'Sem acesso a este contato' });
    }

    const { abrir_caso, parceiro_id, venda_valor, venda_acrescimo,
      atualizar_cliente, cli_nome, cli_telefone1, cli_telefone2, cli_segmento,
      cli_responsavel_nome, cli_responsavel_cargo, cli_responsavel_telefone,
      cli_contatos_adicionais,
      ...campos } = body.data;
    const data: any = { ...campos };

    // Atualiza o CADASTRO do cliente na base (nome/telefones/segmento) → ficha.
    // Só preenche os campos enviados (não apaga o que já existe). A vendedora usa
    // isso quando o contato corrige o telefone ou identifica o segmento que faltava.
    if (atualizar_cliente) {
      const upd: any = {};
      if (cli_nome && cli_nome.trim()) { upd.nome = cli_nome.trim(); upd.razao_social = cli_nome.trim(); }
      if (cli_telefone1 && cli_telefone1.trim()) { upd.telefone = cli_telefone1.trim(); upd.telefone1 = cli_telefone1.trim(); }
      if (cli_telefone2 && cli_telefone2.trim()) upd.telefone2 = cli_telefone2.trim();
      if (cli_segmento && cli_segmento.trim()) upd.segmento = cli_segmento.trim();
      if (Object.keys(upd).length) {
        await prisma.cliente.update({ where: { id: atual.cliente_id }, data: upd }).catch(() => {});
        // Atualiza o nome exibido no card também.
        if (upd.nome) data.cliente_nome = upd.nome;
        // Registra na ficha que a vendedora atualizou o cadastro.
        await (prisma as any).eventoCliente.create({
          data: {
            cliente_id: atual.cliente_id, tipo: 'OBSERVACAO',
            titulo: '✏️ Cadastro atualizado no contato ativo',
            descricao: Object.entries(upd).map(([k, v]) => `${k}: ${v}`).join(' · '),
            feito_por: user?.id, feito_por_nome: user?.nome,
          },
        }).catch(() => {});
      }

      // Salva responsável principal em ContatoCliente (upsert: atualiza se já existe como principal)
      if (cli_responsavel_nome && cli_responsavel_nome.trim()) {
        const contatoExistente = await (prisma as any).contatoCliente.findFirst({
          where: { cliente_id: atual.cliente_id, principal: true },
        }).catch(() => null);
        if (contatoExistente) {
          await (prisma as any).contatoCliente.update({
            where: { id: contatoExistente.id },
            data: {
              nome: cli_responsavel_nome.trim(),
              cargo: cli_responsavel_cargo?.trim() || contatoExistente.cargo,
              telefone: cli_responsavel_telefone?.trim() || contatoExistente.telefone,
            },
          }).catch(() => {});
        } else {
          await (prisma as any).contatoCliente.create({
            data: {
              cliente_id: atual.cliente_id,
              nome: cli_responsavel_nome.trim(),
              cargo: cli_responsavel_cargo?.trim() || null,
              telefone: cli_responsavel_telefone?.trim() || null,
              principal: true,
              origem: 'MANUAL',
            },
          }).catch(() => {});
        }
      }

      // Salva contatos adicionais (sempre cria novos — não remove os anteriores)
      if (cli_contatos_adicionais && cli_contatos_adicionais.length > 0) {
        for (const ct of cli_contatos_adicionais) {
          if (!ct.nome?.trim()) continue;
          await (prisma as any).contatoCliente.create({
            data: {
              cliente_id: atual.cliente_id,
              nome: ct.nome.trim(),
              cargo: ct.cargo?.trim() || null,
              telefone: ct.telefone?.trim() || null,
              principal: false,
              origem: 'MANUAL',
            },
          }).catch(() => {});
        }
      }
    }

    // Ao entrar EM_CONTATO pela 1ª vez, conta a tentativa; ao concluir, marca data.
    if (body.data.etapa === 'EM_CONTATO' && atual.etapa === 'A_CONTATAR') data.tentativas = (atual.tentativas || 0) + 1;
    if (body.data.etapa === 'CONCLUIDO' || body.data.etapa === 'SEM_SUCESSO') data.contatado_em = new Date();

    // MOVIMENTO de coluna (kanban): registra na ficha do cliente todo movimento, com detalhes.
    const ROTULO_ETAPA: Record<string, string> = {
      A_CONTATAR: 'A contatar', EM_CONTATO: 'Em contato', COTACAO: 'Cotação enviada',
      EM_TRATAMENTO: 'Em tratamento', SEM_SUCESSO: 'Sem sucesso', CONCLUIDO: 'Concluído',
    };
    if (body.data.etapa && body.data.etapa !== atual.etapa) {
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: atual.cliente_id, tipo: 'OBSERVACAO',
          titulo: `🔄 Ativos: movido para "${ROTULO_ETAPA[body.data.etapa] || body.data.etapa}"`,
          descricao: `Card movido de "${ROTULO_ETAPA[atual.etapa] || atual.etapa}" → "${ROTULO_ETAPA[body.data.etapa] || body.data.etapa}".`,
          referencia_id: atual.id, feito_por: user?.id, feito_por_nome: user?.nome,
        },
      }).catch(() => {});
    }

    // ── Regra de churn por SUBUTILIZAÇÃO (risco MÉDIO) ──
    // Cliente com nota 3 ou 4 E que NÃO conhece as ferramentas (não usa o sistema na
    // totalidade) vira caso de churn automaticamente, risco médio. Reaproveita os
    // dados deste contato; o motivo é "Subutilização de ferramentas".
    const nota = body.data.nota_prosystem ?? atual.nota_prosystem;
    const conheceFerr = body.data.conhece_novas_ferr ?? atual.conhece_novas_ferr;
    const subutilizacao = (nota === 3 || nota === 4) && conheceFerr === false;

    // Abrir caso de churn: manual (problema) OU automático (subutilização).
    let casoId = atual.caso_churn_id || null;
    const deveAbrir = abrir_caso || subutilizacao;
    if (deveAbrir && !casoId) {
      // ANTI-DUPLICAÇÃO: reaproveita caso ABERTO do cliente (não perdido/recuperado).
      const casoAberto = await prisma.casoChurn.findFirst({
        where: { clienteId: atual.cliente_id, status: { notIn: ['PERDIDO', 'RECUPERADO'] } },
        orderBy: { created_at: 'desc' },
      }).catch(() => null);
      // risco: problema relatado = alto (75); subutilização = médio (50).
      const riskScore = abrir_caso ? 75 : 50;
      const motivo = abrir_caso ? 'Identificado no contato ativo' : 'Subutilização de ferramentas';
      // Relato COMPLETO do contato ativo (origem + tudo que foi apurado) para a aba de churn.
      const suporteTxt = (body.data.suporte_ok ?? atual.suporte_ok) === false ? 'insatisfeito com suporte' : (body.data.suporte_ok ?? atual.suporte_ok) === true ? 'suporte OK' : '';
      const tecnicoTxt = (body.data.tecnico_ok ?? atual.tecnico_ok) === false ? 'insatisfeito com o técnico' : '';
      const ferrTxt = conheceFerr === false ? 'não conhece/não usa as novas ferramentas' : conheceFerr === true ? 'conhece as ferramentas' : '';
      const sugestoes = (body.data.sugestoes ?? atual.sugestoes) || '';
      const linhasRelato = [
        `🟦 Origem: Contato ativo (CS comercial)`,
        nota != null ? `Nota Prosystem: ${nota}/5` : '',
        [suporteTxt, tecnicoTxt, ferrTxt].filter(Boolean).join(' · '),
        body.data.problema_descricao ? `Problema relatado: ${body.data.problema_descricao}` : '',
        sugestoes ? `Relato/Sugestões do cliente: ${sugestoes}` : '',
        !abrir_caso ? 'Classificação automática: subutilização de ferramentas (risco médio).' : '',
      ].filter(Boolean);
      const descCaso = linhasRelato.join('\n');
      const caso = casoAberto || await prisma.casoChurn.create({
        data: {
          clienteId: atual.cliente_id, status: 'NOVO', risk_score: riskScore,
          motivo_principal: motivo, descricao: descCaso, created_by: user?.id || 'system',
        },
      }).catch(() => null);
      // Se reaproveitou um caso aberto, ANEXA o novo relato (não perde o que já tinha).
      if (casoAberto) {
        const novaDesc = [(casoAberto as any).descricao || '', `\n--- Atualização (contato ativo ${new Date().toLocaleDateString('pt-BR')}) ---\n${descCaso}`].join('');
        await prisma.casoChurn.update({ where: { id: casoAberto.id }, data: { descricao: novaDesc } }).catch(() => {});
      }
      if (caso) {
        casoId = caso.id;
        data.caso_churn_id = caso.id;
        data.tem_problema = true;
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
        const supervisorCS = await (prisma as any).usuarioCRM.findFirst({
          where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true },
        }).catch(() => null);
        const venda = await prisma.vendaAdicional.create({
          data: {
            cliente_id: atual.cliente_id,
            parceiro_id,
            vendedor_id: atual.vendedor_id,
            supervisao_id: supervisorCS?.id || null,
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

    // Ao registrar o contato (qualquer etapa final): grava na ficha + HealthScore.
    // ANTI-DUPLICAÇÃO: só UM evento por contato (referencia_id). Se já existe, atualiza
    // em vez de criar outro — era isso que gerava 5 eventos iguais na ficha.
    const ETAPAS_FINAIS = ['CONCLUIDO', 'COTACAO', 'EM_TRATAMENTO', 'SEM_SUCESSO'];
    if (body.data.etapa && ETAPAS_FINAIS.includes(body.data.etapa)) {
      const partes: string[] = [];
      if (contato.nota_prosystem != null) partes.push(`Nota Prosystem: ${contato.nota_prosystem}/5`);
      if (contato.suporte_ok === false) partes.push('Insatisfeito com suporte');
      if (contato.tecnico_ok === false) partes.push('Insatisfeito com o técnico');
      if (contato.plus_apresentado) partes.push('Plus apresentado');
      if (contato.gerou_venda) partes.push(`Oportunidade: ${contato.tipo_venda || 'venda'}`);
      const eventoData = {
        cliente_id: atual.cliente_id, tipo: 'OBSERVACAO',
        titulo: `📞 Contato ativo (CS) — saúde: ${contato.saude || '—'}`,
        descricao: [partes.join(' · '), contato.sugestoes ? `Sugestões: ${contato.sugestoes}` : '']
          .filter(Boolean).join('\n') || undefined,
        referencia_id: contato.id,
        metadados: { nota: contato.nota_prosystem, saude: contato.saude, gerou_venda: contato.gerou_venda, tipo_venda: contato.tipo_venda, caso_churn_id: casoId },
        feito_por: user?.id, feito_por_nome: user?.nome,
      };
      const eventoExistente = await (prisma as any).eventoCliente.findFirst({
        where: { referencia_id: contato.id, tipo: 'OBSERVACAO' },
      }).catch(() => null);
      if (eventoExistente) {
        await (prisma as any).eventoCliente.update({ where: { id: eventoExistente.id }, data: { titulo: eventoData.titulo, descricao: eventoData.descricao, metadados: eventoData.metadados } }).catch(() => {});
      } else {
        await (prisma as any).eventoCliente.create({ data: eventoData }).catch(() => {});
      }

      // HealthScore: ANÁLISE PONDERADA (não só o questionário) — gera 0-100 + nível + estrelas.
      // Considera: nota Prosystem, conhece ferramentas, satisfação suporte/técnico, Plus,
      // caso de churn aberto. Resultado vira as estrelas na ficha do cliente.
      {
        const analise = analisarSaude({
          nota: contato.nota_prosystem, conheceFerr: contato.conhece_novas_ferr,
          suporteOk: contato.suporte_ok, tecnicoOk: contato.tecnico_ok,
          plus: contato.plus_apresentado, temCaso: !!casoId, saudeManual: contato.saude,
        });
        const existente = await prisma.healthScore.findUnique({ where: { cliente_id: atual.cliente_id } }).catch(() => null);
        const fatores = { ...(existente?.fatores as any || {}), contato_ativo: { nota: contato.nota_prosystem, saude: contato.saude, estrelas: analise.estrelas, rotulo: analise.rotulo, analisado_em: new Date() } };
        if (existente) {
          await prisma.healthScore.update({
            where: { cliente_id: atual.cliente_id },
            data: { nivel: analise.nivel, score: analise.score, calculado_at: new Date(), fatores: fatores as any },
          }).catch(() => {});
        } else {
          await prisma.healthScore.create({
            data: { cliente_id: atual.cliente_id, nivel: analise.nivel, score: analise.score, fatores: fatores as any },
          }).catch(() => {});
        }
      }
    }

    return reply.send({ status: 'success', data: { ...contato, caso_churn_id: casoId } });
  });

  // ── Registrar uma TENTATIVA de contato (sem responder o questionário) ──
  // Incrementa o contador, registra a tentativa na ficha. Opcional: marcar sem sucesso.
  fastify.post('/ativos/contatos/:id/tentativa', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ obs: z.string().optional(), sem_sucesso: z.boolean().optional() }).safeParse(request.body);
    const user = (request as any).user;
    const atual = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!atual) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    const scopeId = scopeUserId(request);
    if (scopeId !== null && atual.vendedor_id !== scopeId) return reply.status(403).send({ status: 'error', message: 'Sem acesso' });

    const tentativas = (atual.tentativas || 0) + 1;
    const semSucesso = body.success ? !!body.data.sem_sucesso : false;
    const contato = await prisma.contatoAtivo.update({
      where: { id },
      data: {
        tentativas,
        // Sai de "A contatar" para "Em contato" na 1ª tentativa; vai p/ Sem Sucesso se marcado.
        etapa: semSucesso ? 'SEM_SUCESSO' : (atual.etapa === 'A_CONTATAR' ? 'EM_CONTATO' : atual.etapa),
        contatado_em: new Date(),
      },
    });
    // Registra a tentativa na ficha do cliente (timeline) — sem mexer no questionário.
    const obs = body.success ? (body.data.obs || '').trim() : '';
    await (prisma as any).eventoCliente.create({
      data: {
        cliente_id: atual.cliente_id, tipo: 'OBSERVACAO',
        titulo: semSucesso ? `📞 Tentativa de contato #${tentativas} — sem sucesso` : `📞 Tentativa de contato #${tentativas}`,
        descricao: obs || (semSucesso ? 'Sem resposta do cliente.' : 'Contato tentado.'),
        feito_por: user?.id, feito_por_nome: user?.nome,
      },
    }).catch(() => {});
    return reply.send({ status: 'success', data: contato });
  });

  // ── Contatos ativos de um cliente (p/ aba na ficha) ──
  fastify.get('/ativos/cliente/:clienteId', async (request, reply) => {
    const { clienteId } = request.params as { clienteId: string };
    const contatos = await prisma.contatoAtivo.findMany({
      where: { cliente_id: clienteId }, orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: contatos });
  });

  // ── OPORTUNIDADES DE VENDA (múltiplas por cliente, independentes) ──

  // Criar nova oportunidade (NEGOCIACAO) — não cria VendaAdicional ainda.
  fastify.post('/ativos/contatos/:id/oportunidades', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      parceiro_id: z.string().min(1),
      valor_venda:  z.number().optional(),
      acrescimo_mensal: z.number().optional(),
      observacao: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Dados inválidos' });

    const user = getUser(request);
    const contato = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!contato) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    const scopeId = scopeUserId(request);
    if (scopeId !== null && contato.vendedor_id !== scopeId) return reply.status(403).send({ status: 'error', message: 'Sem acesso' });

    const parceiro = await prisma.parceiro.findUnique({ where: { id: body.data.parceiro_id } }).catch(() => null);
    const oport = await (prisma as any).oportunidadeAtivo.create({
      data: {
        contato_id: id,
        cliente_id: contato.cliente_id,
        vendedor_id: contato.vendedor_id,
        parceiro_id: body.data.parceiro_id,
        parceiro_nome: parceiro?.nome || null,
        categoria: parceiro?.categoria || null,
        status: 'NEGOCIACAO',
        valor_venda: body.data.valor_venda ?? null,
        acrescimo_mensal: body.data.acrescimo_mensal ?? null,
        observacao: body.data.observacao ?? null,
        criado_por: user?.id ?? null,
      },
    });

    // Marca o contato com gerou_venda e atualiza etapa para COTACAO
    await prisma.contatoAtivo.update({
      where: { id },
      data: { gerou_venda: true, tipo_venda: parceiro?.categoria || 'INDICACAO', etapa: 'COTACAO' },
    }).catch(() => {});

    // Registra na ficha do cliente
    await (prisma as any).eventoCliente.create({
      data: {
        cliente_id: contato.cliente_id, tipo: 'OBSERVACAO',
        titulo: `💰 Oportunidade de venda: ${parceiro?.nome || body.data.parceiro_id}`,
        descricao: body.data.observacao || `Categoria: ${parceiro?.categoria || '—'}`,
        feito_por: user?.id, feito_por_nome: user?.nome,
      },
    }).catch(() => {});

    return reply.send({ status: 'success', data: oport });
  });

  // Listar oportunidades de um contato
  fastify.get('/ativos/contatos/:id/oportunidades', async (request, reply) => {
    const { id } = request.params as { id: string };
    const contato = await prisma.contatoAtivo.findUnique({ where: { id } });
    if (!contato) return reply.status(404).send({ status: 'error', message: 'Contato não encontrado' });
    const scopeId = scopeUserId(request);
    if (scopeId !== null && contato.vendedor_id !== scopeId) return reply.status(403).send({ status: 'error', message: 'Sem acesso' });
    const oports = await (prisma as any).oportunidadeAtivo.findMany({
      where: { contato_id: id }, orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: oports });
  });

  // Confirmar fechamento → cria VendaAdicional + muda status para CONFIRMADA
  fastify.post('/ativos/oportunidades/:id/confirmar', async (request, reply) => {
    const { oId } = request.params as { oId: string };
    const resolvedId = (request.params as any).id || oId;
    const body = z.object({
      vendedor_id: z.string().optional(),
    }).safeParse(request.body);

    const user = getUser(request);
    const oport = await (prisma as any).oportunidadeAtivo.findUnique({ where: { id: resolvedId } });
    if (!oport) return reply.status(404).send({ status: 'error', message: 'Oportunidade não encontrada' });
    if (oport.status !== 'NEGOCIACAO') return reply.status(400).send({ status: 'error', message: 'Oportunidade já foi confirmada ou cancelada' });

    const scopeId = scopeUserId(request);
    const isGestor = podeVerTudo(user);
    if (!isGestor && scopeId !== null && oport.vendedor_id !== scopeId) return reply.status(403).send({ status: 'error', message: 'Sem acesso' });

    // Cria a VendaAdicional real (nasce PENDENTE — gestão confirma/data pelo fluxo normal)
    // Cria sempre, com ou sem parceiro (vendas internas do módulo Ativos não têm parceiro externo)
    const vendedorId = body.success && body.data.vendedor_id ? body.data.vendedor_id : oport.vendedor_id;
    const tipoNegocio = oport.parceiro_id ? 'INDICACAO' : 'EXPANSAO';

    // Supervisão = sempre o usuário com role SUPERVISAO cadastrado, nunca quem está logado.
    const supervisorAtivos = await (prisma as any).usuarioCRM.findFirst({
      where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true },
    }).catch(() => null);
    const supervisaoIdAtivos = supervisorAtivos?.id || null;

    let vendaId: string | null = null;
    const venda = await prisma.vendaAdicional.create({
      data: {
        cliente_id: oport.cliente_id,
        parceiro_id: oport.parceiro_id ?? null,
        vendedor_id: vendedorId,
        supervisao_id: supervisaoIdAtivos,
        tipo_negocio: tipoNegocio,
        valor_venda: oport.valor_venda ?? undefined,
        acrescimo_mensal: oport.acrescimo_mensal ?? undefined,
        status: 'PENDENTE',
        observacoes: oport.observacao ?? undefined,
        origem_oportunidade_id: oport.id,
        created_by: user?.id ?? vendedorId,
      } as any,
    }).catch((e: any) => { console.error('[ATIVOS] criar VendaAdicional:', e?.message); return null; });
    vendaId = venda?.id || null;

    const updated = await (prisma as any).oportunidadeAtivo.update({
      where: { id: resolvedId },
      data: {
        status: 'CONFIRMADA',
        venda_adicional_id: vendaId,
        confirmado_por: user?.id ?? null,
        confirmado_em: new Date(),
      },
    });

    // Atualiza o ContatoAtivo: etapa → CONCLUIDO, registra venda_ref_id para rastreio
    const contato = await prisma.contatoAtivo.findUnique({ where: { id: oport.contato_id } }).catch(() => null);
    if (contato) {
      await prisma.contatoAtivo.update({
        where: { id: contato.id },
        data: { etapa: 'CONCLUIDO', venda_ref_id: vendaId || contato.venda_ref_id },
      }).catch(() => {});

      // Registra fechamento na ficha do cliente
      await (prisma as any).eventoCliente.create({
        data: {
          cliente_id: oport.cliente_id,
          tipo: 'OBSERVACAO',
          titulo: `✅ Venda confirmada — ${oport.parceiro_nome || oport.categoria || 'Oportunidade'}`,
          descricao: [
            oport.valor_venda ? `Setup: R$ ${oport.valor_venda}` : '',
            oport.acrescimo_mensal ? `+R$ ${oport.acrescimo_mensal}/mês` : '',
            oport.observacao || '',
          ].filter(Boolean).join(' · ') || undefined,
          feito_por: user?.id,
          feito_por_nome: user?.nome,
        },
      }).catch(() => {});
    }

    // Cria comissão do vendedor para a venda recém-criada
    if (venda) {
      const proximoMes = () => {
        const prox = new Date(); prox.setMonth(prox.getMonth() + 1); prox.setDate(1);
        return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}`;
      };
      // Busca valor de comissão do parceiro; fallback R$50
      const parceiro = oport.parceiro_id
        ? await prisma.parceiro.findUnique({ where: { id: oport.parceiro_id } }).catch(() => null)
        : null;
      const comissaoValor = parceiro?.comissao_valor ?? 50;
      await prisma.comissao.create({
        data: {
          responsavel_id: vendedorId,
          tipo: 'VENDA_ADICIONAL',
          referencia_id: venda.id,
          descricao: `Venda Adicional: ${oport.parceiro_nome || oport.categoria || 'Expansão'} — ${oport.cliente_id}`,
          valor_base: comissaoValor,
          percentual: 100,
          valor_comissao: comissaoValor,
          papel: 'VENDEDOR',
          periodo: proximoMes(),
          status: 'APROVADA',
          created_by: user?.id ?? vendedorId,
        },
      }).catch((e: any) => console.error('[ATIVOS] criar comissão:', e?.message));
    }

    return reply.send({ status: 'success', data: { oportunidade: updated, venda_id: vendaId } });
  });

  // Cancelar oportunidade
  fastify.post('/ativos/oportunidades/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const oport = await (prisma as any).oportunidadeAtivo.findUnique({ where: { id } });
    if (!oport) return reply.status(404).send({ status: 'error', message: 'Oportunidade não encontrada' });
    if (oport.status !== 'NEGOCIACAO') return reply.status(400).send({ status: 'error', message: 'Só pode cancelar oportunidades em negociação' });
    const scopeId = scopeUserId(request);
    if (!podeVerTudo(user) && scopeId !== null && oport.vendedor_id !== scopeId) return reply.status(403).send({ status: 'error', message: 'Sem acesso' });
    const updated = await (prisma as any).oportunidadeAtivo.update({
      where: { id }, data: { status: 'CANCELADA' },
    });
    return reply.send({ status: 'success', data: updated });
  });

  // ── Listar TODAS as oportunidades em NEGOCIACAO (para aba "Em negociação" em Indicações) ──
  fastify.get('/ativos/oportunidades', async (request, reply) => {
    const user = getUser(request);
    const scopeId = scopeUserId(request);
    const where: any = { status: 'NEGOCIACAO' };
    if (scopeId !== null) where.vendedor_id = scopeId;

    const oports = await (prisma as any).oportunidadeAtivo.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // Enriquece com nomes de clientes e parceiros
    const clienteIds = [...new Set(oports.map((o: any) => o.cliente_id))];
    const parceiroIds = [...new Set(oports.map((o: any) => o.parceiro_id).filter(Boolean))];
    const vendedorIds = [...new Set(oports.map((o: any) => o.vendedor_id).filter(Boolean))];

    const [clientes, parceiros, nomes] = await Promise.all([
      clienteIds.length ? prisma.cliente.findMany({ where: { id: { in: clienteIds as string[] } }, select: { id: true, razao_social: true, nome_fantasia: true, nome: true, codigo: true } }) : [],
      parceiroIds.length ? prisma.parceiro.findMany({ where: { id: { in: parceiroIds as string[] } }, select: { id: true, nome: true, categoria: true } }) : [],
      vendedorIds.length ? resolverNomesUsuarios(prisma, vendedorIds as string[]) : {},
    ]);
    const cliMap: Record<string, any> = Object.fromEntries((clientes as any[]).map(c => [c.id, c]));
    const parMap: Record<string, any> = Object.fromEntries((parceiros as any[]).map(p => [p.id, p]));

    const lista = oports.map((o: any) => ({
      ...o,
      cliente_nome: cliMap[o.cliente_id]?.razao_social || cliMap[o.cliente_id]?.nome_fantasia || cliMap[o.cliente_id]?.nome || '—',
      cliente_codigo: cliMap[o.cliente_id]?.codigo || null,
      parceiro_nome: parMap[o.parceiro_id]?.nome || o.parceiro_nome || '—',
      categoria: parMap[o.parceiro_id]?.categoria || o.categoria || '—',
      vendedor_nome: (nomes as any)[o.vendedor_id] || '—',
    }));

    return reply.send({ status: 'success', data: lista });
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

  // ── MIGRAÇÃO: converte VendaAdicional PENDENTE (criadas pelo fluxo antigo de Ativos)
  // em OportunidadeAtivo NEGOCIACAO, limpando venda_ref_id no ContatoAtivo.
  // Rota idempotente — pode ser chamada mais de uma vez sem duplicar.
  fastify.post('/ativos/migrar-oportunidades', async (request, reply) => {
    if (!requireGestor(request, reply)) return;

    // CASO 1: contatos com venda_ref_id preenchido (VendaAdicional criada prematuramente)
    const comRef = await prisma.contatoAtivo.findMany({
      where: { venda_ref_id: { not: null } },
    });

    const vendaIds = comRef.map(c => c.venda_ref_id).filter(Boolean) as string[];
    const vendas = await prisma.vendaAdicional.findMany({
      where: { id: { in: vendaIds }, status: 'PENDENTE' },
    });
    const vendaMap: Record<string, any> = Object.fromEntries(vendas.map(v => [v.id, v]));

    let migrados = 0;
    for (const ct of comRef) {
      const venda = ct.venda_ref_id ? vendaMap[ct.venda_ref_id] : null;
      if (!venda) continue;

      const jaExiste = await (prisma as any).oportunidadeAtivo.findFirst({
        where: { contato_id: ct.id, status: 'NEGOCIACAO' },
      });
      if (jaExiste) {
        await prisma.vendaAdicional.delete({ where: { id: venda.id } }).catch(() => {});
        await prisma.contatoAtivo.update({ where: { id: ct.id }, data: { venda_ref_id: null } }).catch(() => {});
        continue;
      }

      await (prisma as any).oportunidadeAtivo.create({
        data: {
          contato_id: ct.id,
          cliente_id: ct.cliente_id,
          vendedor_id: ct.vendedor_id,
          parceiro_id: venda.parceiro_id || null,
          parceiro_nome: null,
          categoria: venda.tipo_negocio || ct.tipo_venda || null,
          status: 'NEGOCIACAO',
          valor_venda: venda.valor_venda ?? null,
          acrescimo_mensal: venda.acrescimo_mensal ?? null,
          observacao: venda.observacoes || null,
          criado_por: venda.created_by || ct.vendedor_id,
        },
      });

      await prisma.vendaAdicional.delete({ where: { id: venda.id } }).catch(() => {});
      await prisma.contatoAtivo.update({ where: { id: ct.id }, data: { venda_ref_id: null } });
      migrados++;
    }

    // CASO 2: contatos com gerou_venda=true mas SEM venda_ref_id e SEM OportunidadeAtivo
    // (fluxo antigo onde gerou_venda foi marcado mas a venda não chegou a ser criada)
    const semRef = await prisma.contatoAtivo.findMany({
      where: { gerou_venda: true, venda_ref_id: null },
    });

    for (const ct of semRef) {
      const jaExiste = await (prisma as any).oportunidadeAtivo.findFirst({
        where: { contato_id: ct.id },
      });
      if (jaExiste) continue; // já tem oportunidade — não duplica

      await (prisma as any).oportunidadeAtivo.create({
        data: {
          contato_id: ct.id,
          cliente_id: ct.cliente_id,
          vendedor_id: ct.vendedor_id,
          parceiro_id: null,
          parceiro_nome: null,
          categoria: ct.tipo_venda || 'INDICACAO',
          status: 'NEGOCIACAO',
          valor_venda: (ct as any).venda_valor ?? null,
          acrescimo_mensal: (ct as any).venda_acrescimo ?? null,
          observacao: (ct as any).venda_obs || 'Migrado do fluxo antigo — preencha os detalhes.',
          criado_por: ct.vendedor_id,
        },
      });
      migrados++;
    }

    return reply.send({ status: 'success', data: { migrados, total_encontrados: comRef.length + semRef.length } });
  });

  // ── MIGRAÇÃO: cria VendaAdicional para oportunidades CONFIRMADAS sem venda vinculada
  // Cobre o caso das confirmações feitas antes do parceiro_id se tornar opcional.
  // Rota idempotente — pode ser chamada mais de uma vez sem duplicar.
  fastify.post('/ativos/migrar-vendas-confirmadas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;

    const oprtsSemVenda = await (prisma as any).oportunidadeAtivo.findMany({
      where: { status: 'CONFIRMADA', venda_adicional_id: null },
    });

    let criadas = 0;
    const erros: string[] = [];

    for (const oport of oprtsSemVenda) {
      try {
        const tipoNegocio = oport.parceiro_id ? 'INDICACAO' : 'EXPANSAO';
        const venda = await prisma.vendaAdicional.create({
          data: {
            cliente_id: oport.cliente_id,
            parceiro_id: oport.parceiro_id ?? null,
            vendedor_id: oport.vendedor_id,
            tipo_negocio: tipoNegocio,
            valor_venda: oport.valor_venda ?? undefined,
            acrescimo_mensal: oport.acrescimo_mensal ?? undefined,
            status: 'PENDENTE',
            observacoes: oport.observacao ?? undefined,
            origem_oportunidade_id: oport.id,
            created_by: oport.confirmado_por ?? oport.vendedor_id ?? oport.criado_por,
          } as any,
        });

        await (prisma as any).oportunidadeAtivo.update({
          where: { id: oport.id },
          data: { venda_adicional_id: venda.id },
        });
        criadas++;
      } catch (e: any) {
        console.error('[MIGRAR-VENDAS] erro oport', oport.id, e?.message);
        erros.push(oport.id);
      }
    }

    return reply.send({ status: 'success', data: { criadas, total: oprtsSemVenda.length, erros } });
  });

  // ── MIGRAÇÃO: corrige comissões SUPERVISAO_VENDA_ADICIONAL que ficaram com responsavel_id errado.
  // Ocorreu porque o sistema usava user?.id (vendedor logado) como supervisao_id.
  // Agora usa o usuário com role SUPERVISAO. Esta rota corrige os registros antigos.
  fastify.post('/ativos/corrigir-comissoes-supervisao', async (request, reply) => {
    if (!requireGestor(request, reply)) return;

    const supervisora = await (prisma as any).usuarioCRM.findFirst({
      where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
      orderBy: { nome: 'asc' },
    }).catch(() => null);

    if (!supervisora) return reply.status(404).send({ status: 'error', message: 'Nenhuma supervisora com role SUPERVISAO encontrada.' });

    // Corrige comissões com tipo SUPERVISAO mas responsavel_id diferente da supervisora
    const comissoesErradas = await prisma.comissao.findMany({
      where: { tipo: 'SUPERVISAO_VENDA_ADICIONAL', NOT: { responsavel_id: supervisora.id } },
    });

    let corrigidasComissoes = 0;
    for (const c of comissoesErradas) {
      await prisma.comissao.update({ where: { id: c.id }, data: { responsavel_id: supervisora.id } }).catch(() => null);
      corrigidasComissoes++;
    }

    // Corrige vendas com supervisao_id diferente da supervisora
    const vendasErradas = await (prisma as any).vendaAdicional.findMany({
      where: { supervisao_id: { not: null, notIn: [supervisora.id] } },
      select: { id: true },
    }).catch(() => []);

    let corrigidasVendas = 0;
    for (const v of vendasErradas) {
      await (prisma as any).vendaAdicional.update({ where: { id: v.id }, data: { supervisao_id: supervisora.id } }).catch(() => null);
      corrigidasVendas++;
    }

    return reply.send({
      status: 'success',
      data: {
        supervisora: supervisora.nome,
        comissoes_corrigidas: corrigidasComissoes,
        vendas_corrigidas: corrigidasVendas,
      },
    });
  });
}
