import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, requireGestor } from '@/lib/scope';
import { resolverNomesUsuarios } from '@/lib/usuarios';

export async function comissoesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ── Bônus trimestral — Programa Acelerador de Resultados ────────────────────
  // Trimestres iniciam em MAIO (regra Prosystem): mai-jul, ago-out, nov-jan,
  // fev-abr. Faixas por contratos fechados no trimestre:
  //   15 → R$400 | 22 → R$600 | 30 → R$1.000 (pega a maior faixa atingida).
  const FAIXAS_BONUS = [
    { meta: 30, premio: 1000, rotulo: '200% da meta' },
    { meta: 22, premio: 600,  rotulo: '150% da meta' },
    { meta: 15, premio: 400,  rotulo: '100% da meta' },
  ];
  const STATUS_FECHADA_BONUS = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];

  // Dado um ano-mês de referência, retorna o trimestre Prosystem que o contém.
  // Âncora em maio: meses 5,6,7 = T1; 8,9,10 = T2; 11,12,1 = T3; 2,3,4 = T4.
  function trimestreProsystem(ano: number, mes1a12: number) {
    // desloca p/ que maio (5) seja o início (offset 0..11 a partir de maio)
    const offset = (mes1a12 - 5 + 12) % 12;
    const indiceTri = Math.floor(offset / 3); // 0..3
    const mesInicioOffset = indiceTri * 3;     // 0,3,6,9
    const mesInicio = ((5 - 1 + mesInicioOffset) % 12) + 1; // mês 1..12 do início
    // ano de início: se o mês de início é > mês de referência, começou no ano anterior
    let anoInicio = ano;
    if (mesInicio > mes1a12) anoInicio = ano - 1;
    const inicio = new Date(anoInicio, mesInicio - 1, 1);
    const fim = new Date(anoInicio, mesInicio - 1 + 3, 0, 23, 59, 59); // último dia do 3º mês
    const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const fimMes = ((mesInicio - 1 + 2) % 12) + 1;
    const fimAno = mesInicio + 2 > 12 ? anoInicio + 1 : anoInicio;
    const rotulo = `${nomesMes[mesInicio - 1]}/${anoInicio} a ${nomesMes[fimMes - 1]}/${fimAno}`;
    return { inicio, fim, rotulo, indiceTri };
  }

  fastify.get('/comissoes/bonus-trimestral', async (request, reply) => {
    const q = z.object({ ref: z.string().optional(), vendedor_id: z.string().optional() }).safeParse(request.query);
    // ref = YYYY-MM dentro do trimestre desejado (default: mês atual).
    const agora = new Date();
    const [yy, mm] = q.data?.ref ? q.data.ref.split('-').map(Number) : [agora.getFullYear(), agora.getMonth() + 1];
    const tri = trimestreProsystem(yy, mm);

    // Escopo: vendedor vê só o seu; gestor vê todos (ou filtra por vendedor_id).
    const scopeId = scopeUserId(request);
    const whereVend: any = {};
    if (scopeId !== null) whereVend.vendedor_id = scopeId;
    else if (q.data?.vendedor_id) whereVend.vendedor_id = q.data.vendedor_id;

    // Contratos FECHADOS no trimestre (data_aceite ou created_at), por vendedor.
    const props = await prisma.propostaComercial.findMany({
      where: {
        ...whereVend,
        status: { in: STATUS_FECHADA_BONUS },
        OR: [
          { data_aceite: { gte: tri.inicio, lte: tri.fim } },
          { AND: [{ data_aceite: null }, { created_at: { gte: tri.inicio, lte: tri.fim } }] },
        ],
        deleted_at: null,
      },
      select: { vendedor_id: true, vendedor_nome: true },
    }).catch(() => [] as any[]);

    const porVend: Record<string, { vendedor_id: string; vendedor_nome: string | null; contratos: number }> = {};
    for (const p of props) {
      const id = p.vendedor_id || 'sem-vendedor';
      if (!porVend[id]) porVend[id] = { vendedor_id: id, vendedor_nome: p.vendedor_nome || null, contratos: 0 };
      porVend[id].contratos += 1;
    }
    const ids = Object.keys(porVend).filter(i => i !== 'sem-vendedor');
    const nomes = await resolverNomesUsuarios(prisma, ids).catch(() => ({} as Record<string, string>));

    const linhas = Object.values(porVend).map(v => {
      const faixa = FAIXAS_BONUS.find(f => v.contratos >= f.meta);
      const proxima = [...FAIXAS_BONUS].reverse().find(f => v.contratos < f.meta);
      return {
        vendedor_id: v.vendedor_id,
        vendedor_nome: nomes[v.vendedor_id] || v.vendedor_nome || v.vendedor_id,
        contratos: v.contratos,
        premio: faixa ? faixa.premio : 0,
        faixa_atingida: faixa ? faixa.rotulo : null,
        proxima_faixa: proxima ? { meta: proxima.meta, premio: proxima.premio, faltam: proxima.meta - v.contratos } : null,
      };
    }).sort((a, b) => b.contratos - a.contratos);

    return reply.send({
      status: 'success',
      data: { trimestre: tri.rotulo, inicio: tri.inicio, fim: tri.fim, faixas: FAIXAS_BONUS, linhas },
    });
  });

  // Resolve a RAZÃO SOCIAL do cliente de cada comissão (em vez do id do contrato):
  //  - CONTRATO        → ContratoComercial.razao_social (via referencia_id)
  //  - VENDA_ADICIONAL → VendaAdicional → Cliente.nome
  async function mapaClientes(comissoes: any[]): Promise<Record<string, string>> {
    const mapa: Record<string, string> = {};
    const contratoIds = [...new Set(comissoes.filter(c => c.tipo === 'CONTRATO' && c.referencia_id).map(c => c.referencia_id))];
    // SUPERVISAO_VENDA_ADICIONAL tem referencia_id = VendaAdicional.id (igual ao VENDA_ADICIONAL)
    const vendaIds = [...new Set(comissoes.filter(c =>
      (c.tipo === 'VENDA_ADICIONAL' || c.tipo === 'SUPERVISAO_VENDA_ADICIONAL') && c.referencia_id
    ).map(c => c.referencia_id))];

    if (contratoIds.length) {
      const cts = await prisma.contratoComercial.findMany({
        where: { id: { in: contratoIds } }, select: { id: true, razao_social: true, numero_contrato: true },
      }).catch(() => [] as any[]);
      cts.forEach((c: any) => { mapa[c.id] = c.razao_social || c.numero_contrato || c.id; });
    }
    if (vendaIds.length) {
      const vas = await prisma.vendaAdicional.findMany({
        where: { id: { in: vendaIds } },
        select: { id: true, cliente: { select: { nome: true, razao_social: true, nome_fantasia: true, empresa: true, codigo: true } } },
      }).catch(() => [] as any[]);
      vas.forEach((v: any) => {
        const cli = v.cliente;
        const nome = cli?.razao_social || cli?.nome_fantasia || cli?.empresa || cli?.nome || v.id;
        const cod = cli?.codigo ? ` · Cód. ${cli.codigo}` : '';
        mapa[v.id] = nome + cod;
      });
    }
    return mapa;
  }

  // ===== REGRAS DE COMISSÃO =====
  fastify.get('/comissoes/regras', async (request, reply) => {
    const regras = await prisma.regraComissao.findMany({
      orderBy: { created_at: 'desc' }
    });
    return reply.send({ status: 'success', data: regras });
  });

  fastify.post('/comissoes/regras', async (request, reply) => {
    const body = z.object({
      nome: z.string().min(1),
      responsavel_id: z.string(),
      tipo: z.enum(['CONTRATO', 'PROPOSTA', 'LEAD']).default('CONTRATO'),
      percentual: z.number().min(0).max(100),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const regra = await prisma.regraComissao.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: regra });
  });

  fastify.patch('/comissoes/regras/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      percentual: z.number().optional(),
      ativo: z.boolean().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const regra = await prisma.regraComissao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: regra });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Regra não encontrada' });
      throw err;
    }
  });

  // ===== COMISSÃO DA SUPERVISÃO COMERCIAL =====
  // Regra: 5% sobre TODO o faturamento do setor comercial no período, ou seja:
  //   • SETUP/instalação de todos os contratos ASSINADOS (de todos os vendedores)
  //   • valor das VENDAS ADICIONAIS confirmadas (serviços vendidos, sem contrato)
  // Cada usuário com cargo SUPERVISAO_COMERCIAL recebe os 5% cheios.
  const COMISSAO_SUPERVISAO_PCT = 5;

  fastify.get('/comissoes/supervisao', async (request, reply) => {
    const q = z.object({ periodo: z.string().optional() }).safeParse(request.query);
    // periodo "YYYY-MM" (default: mês corrente)
    const now = new Date();
    const periodo = q.success && q.data.periodo ? q.data.periodo
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [ano, mes] = periodo.split('-').map(Number);
    const inicio = new Date(ano, (mes || 1) - 1, 1);
    const fim = new Date(ano, (mes || 1), 0, 23, 59, 59);

    // 1) Setup dos contratos ASSINADOS no período
    const contratos = await prisma.contratoComercial.findMany({
      where: { status: 'ASSINADO', signed_at: { gte: inicio, lte: fim } },
      select: { id: true, numero_contrato: true, razao_social: true, valor_setup_total: true, signed_at: true, vendedor_nome: true },
    }).catch(() => [] as any[]);
    const fatContratos = contratos.reduce((s: number, c: any) => s + Number(c.valor_setup_total || 0), 0);

    // 2) Vendas adicionais confirmadas/pagas no período
    const vendas = await prisma.vendaAdicional.findMany({
      where: { status: { in: ['CONFIRMADA', 'PAGA'] }, created_at: { gte: inicio, lte: fim } },
      select: { id: true, valor_venda: true, plano_novo: true, created_at: true },
    }).catch(() => [] as any[]);
    const fatVendas = vendas.reduce((s: number, v: any) => s + Number(v.valor_venda || 0), 0);

    const faturamento = Math.round((fatContratos + fatVendas) * 100) / 100;
    const comissaoUnit = Math.round(faturamento * (COMISSAO_SUPERVISAO_PCT / 100) * 100) / 100;

    // 3) Gestores comerciais ativos (SUPERVISAO_COMERCIAL ou ADMIN/Diretora) — cada um recebe os 0,5% cheios
    const supervisores: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo IN ('SUPERVISAO_COMERCIAL','ADMIN') AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);

    return reply.send({
      status: 'success',
      data: {
        periodo,
        percentual: COMISSAO_SUPERVISAO_PCT,
        faturamento_setor: faturamento,
        faturamento_contratos: Math.round(fatContratos * 100) / 100,
        faturamento_vendas_adicionais: Math.round(fatVendas * 100) / 100,
        qtd_contratos: contratos.length,
        qtd_vendas_adicionais: vendas.length,
        comissao_por_supervisor: comissaoUnit,
        supervisores: supervisores.map(s => ({ id: s.id, nome: s.nome, comissao: comissaoUnit })),
        detalhamento: {
          contratos: contratos.map((c: any) => ({
            numero: c.numero_contrato, cliente: c.razao_social, setup: Number(c.valor_setup_total || 0),
            vendedor: c.vendedor_nome, data: c.signed_at,
          })),
        },
      },
    });
  });

  // ===== RELATÓRIO DE COMISSÕES A PAGAR (supervisão → financeiro) =====
  // Por mês de pagamento E por vendedor. Inclui as comissões de vendedores e supervisão.
  // estagio: A_RECEBER | A_CONFIRMAR | CONFIRMADA | PAGA | CANCELADA
  fastify.get('/comissoes/relatorio', async (request, reply) => {
    const q = z.object({ mes_pagamento: z.string().optional(), estagio: z.string().optional() }).safeParse(request.query);
    const where: any = { status: { not: 'CANCELADA' } };
    if (q.success && q.data.mes_pagamento) where.mes_pagamento = q.data.mes_pagamento;
    if (q.success && q.data.estagio) where.estagio = q.data.estagio;

    const comissoes = await prisma.comissao.findMany({ where, orderBy: { created_at: 'desc' } });

    // Nomes dos responsáveis (vendedores/supervisores + contas de sistema, ex.: Jessica/Diretora).
    const ids = [...new Set(comissoes.map(c => c.responsavel_id))];
    const nomesResolvidos = await resolverNomesUsuarios(prisma, ids);
    const usuarios: any[] = ids.length
      ? await prisma.$queryRawUnsafe(
          `SELECT id, nome, cargo FROM UsuarioCRM WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
      : [];
    const nomeDe: Record<string, any> = {};
    usuarios.forEach(u => { nomeDe[u.id] = u; });
    // Garante nome p/ contas de sistema que não estão no UsuarioCRM.
    ids.forEach(id => { if (!nomeDe[id] && nomesResolvidos[id]) nomeDe[id] = { id, nome: nomesResolvidos[id], cargo: 'DIRETOR' }; });

    // Razão social do cliente de cada comissão (em vez do id do contrato).
    const clienteDe = await mapaClientes(comissoes as any[]);

    // Agrupa por mês de pagamento e por responsável
    const porMes: Record<string, any> = {};
    const porResponsavel: Record<string, any> = {};
    for (const c of comissoes as any[]) {
      const mes = c.mes_pagamento || 'A confirmar';
      porMes[mes] = porMes[mes] || { mes_pagamento: mes, total: 0, count: 0, itens: [] };
      porMes[mes].total += c.valor_comissao; porMes[mes].count += 1;
      porMes[mes].itens.push({
        ...c,
        responsavel_nome: nomeDe[c.responsavel_id]?.nome || c.responsavel_id,
        cliente: clienteDe[c.referencia_id || ''] || null,
      });

      const r = c.responsavel_id;
      porResponsavel[r] = porResponsavel[r] || {
        responsavel_id: r, responsavel_nome: nomeDe[r]?.nome || r, cargo: nomeDe[r]?.cargo || '',
        papel: c.papel || '', total: 0, a_receber: 0, a_confirmar: 0, confirmada: 0, paga: 0, count: 0,
      };
      porResponsavel[r].total += c.valor_comissao; porResponsavel[r].count += 1;
      if (c.estagio === 'A_RECEBER') porResponsavel[r].a_receber += c.valor_comissao;
      else if (c.estagio === 'A_CONFIRMAR') porResponsavel[r].a_confirmar += c.valor_comissao;
      else if (c.estagio === 'CONFIRMADA') porResponsavel[r].confirmada += c.valor_comissao;
      else if (c.estagio === 'PAGA') porResponsavel[r].paga += c.valor_comissao;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return reply.send({
      status: 'success',
      data: {
        por_mes: Object.values(porMes).map((m: any) => ({ ...m, total: round(m.total) })),
        por_responsavel: Object.values(porResponsavel).map((r: any) => ({
          ...r, total: round(r.total), a_receber: round(r.a_receber), a_confirmar: round(r.a_confirmar),
          confirmada: round(r.confirmada), paga: round(r.paga),
        })),
        totais: {
          total: round(comissoes.reduce((s, c) => s + c.valor_comissao, 0)),
          a_receber: round(comissoes.filter((c: any) => c.estagio === 'A_RECEBER').reduce((s, c) => s + c.valor_comissao, 0)),
          a_confirmar: round(comissoes.filter((c: any) => c.estagio === 'A_CONFIRMAR').reduce((s, c) => s + c.valor_comissao, 0)),
          confirmada: round(comissoes.filter((c: any) => c.estagio === 'CONFIRMADA').reduce((s, c) => s + c.valor_comissao, 0)),
          paga: round(comissoes.filter((c: any) => c.estagio === 'PAGA').reduce((s, c) => s + c.valor_comissao, 0)),
        },
      },
    });
  });

  // Marca comissões como PAGAS (financeiro) — por mês de pagamento ou por ids.
  fastify.post('/comissoes/marcar-pagas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({ ids: z.array(z.string()).optional(), mes_pagamento: z.string().optional() }).safeParse(request.body);
    if (!body.success || (!body.data.ids?.length && !body.data.mes_pagamento)) {
      return reply.status(400).send({ status: 'error', message: 'Informe ids ou mes_pagamento' });
    }
    const where: any = { estagio: 'CONFIRMADA' };
    if (body.data.ids?.length) where.id = { in: body.data.ids };
    if (body.data.mes_pagamento) where.mes_pagamento = body.data.mes_pagamento;
    const r = await prisma.comissao.updateMany({
      where, data: { estagio: 'PAGA', status: 'PAGA', paga_em: new Date() } as any,
    });
    return reply.send({ status: 'success', data: { pagas: r.count } });
  });

  // Remarcar o MÊS DE PAGAMENTO de uma comissão (gestão). Útil quando a instalação
  // não fecha no mês e a comissão precisa ir para outro mês de pagamento.
  fastify.patch('/comissoes/:id/mes-pagamento', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ mes_pagamento: z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM') }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Mês inválido' });
    try {
      const c = await prisma.comissao.update({
        where: { id },
        data: { mes_pagamento: body.data.mes_pagamento } as any,
      });
      return reply.send({ status: 'success', data: c });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Comissão não encontrada' });
      throw e;
    }
  });

  // APROVAR uma comissão indicando o MÊS de pagamento (gestão). Vai para CONFIRMADA
  // (a pagar) no mês informado → reflete no relatório do vendedor e no da gestão.
  fastify.post('/comissoes/:id/aprovar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = z.object({ mes_pagamento: z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM') }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Informe o mês de pagamento (AAAA-MM)' });
    try {
      const c = await prisma.comissao.update({
        where: { id },
        data: { status: 'APROVADA', estagio: 'CONFIRMADA', mes_pagamento: body.data.mes_pagamento, aprovada_por: user?.id || 'system', aprovada_em: new Date() } as any,
      });
      return reply.send({ status: 'success', data: c });
    } catch (e: any) {
      if (e.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Comissão não encontrada' });
      throw e;
    }
  });

  // ORDEM DE PAGAMENTO mensal: comissões a pagar (CONFIRMADA/APROVADA) de um mês de
  // pagamento, agrupadas por responsável (vendedor/supervisão), com total por pessoa.
  // Formato da "ordem de pagamento" da gestão (Razão+Código · Demanda · valor · % · comissão).
  fastify.get('/comissoes/ordem-pagamento', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ mes_pagamento: z.string().regex(/^\d{4}-\d{2}$/).optional() }).safeParse(request.query);
    const mes = q.success && q.data.mes_pagamento ? q.data.mes_pagamento
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // A pagar = ainda não paga (exclui PAGA e CANCELADA) com mes_pagamento = mês.
    const comissoes = await prisma.comissao.findMany({
      where: { mes_pagamento: mes, status: { notIn: ['PAGA', 'CANCELADA'] } },
      orderBy: { valor_comissao: 'desc' },
    }).catch(() => [] as any[]);

    const clienteDe = await mapaClientes(comissoes as any[]);
    const ids = [...new Set(comissoes.map((c: any) => c.responsavel_id).filter(Boolean))];
    const nomeDe = await resolverNomesUsuarios(prisma, ids).catch(() => ({} as any));

    // Supervisora real = único usuário com role SUPERVISAO — garante exibição correta
    // mesmo que registros antigos tenham responsavel_id errado.
    const supervisoraReal = await (prisma as any).usuarioCRM.findFirst({
      where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }).catch(() => null);

    // Agrupa por (responsavel_id + papel) — chave composta para separar corretamente
    // a Jessica-vendedora da Jessica-supervisora (ou qualquer pessoa com dois papéis).
    // Comissões de supervisão sempre vão para a supervisora cadastrada com role SUPERVISAO.
    const grupos: Record<string, any> = {};
    for (const c of comissoes as any[]) {
      const ehSupervisao = c.tipo === 'SUPERVISAO_VENDA_ADICIONAL' || c.papel === 'SUPERVISAO';
      const rid = ehSupervisao && supervisoraReal ? supervisoraReal.id : (c.responsavel_id || 'sem');
      const papel = ehSupervisao ? 'SUPERVISAO' : 'VENDEDOR';
      const nomeExibir = ehSupervisao && supervisoraReal ? supervisoraReal.nome : (nomeDe[rid] || rid);
      // Chave composta: mesmo responsavel com papéis diferentes → blocos separados
      const chave = `${rid}::${papel}`;
      grupos[chave] = grupos[chave] || {
        responsavel_id: rid, responsavel_nome: nomeExibir,
        papel, total: 0, itens: [] as any[],
      };
      grupos[chave].total += Number(c.valor_comissao || 0);
      grupos[chave].itens.push({
        cliente: clienteDe[c.referencia_id || ''] || c.descricao || '—',
        demanda: c.descricao || (c.tipo === 'VENDA_ADICIONAL' ? 'Venda adicional' : c.tipo === 'BONUS' ? 'Bônus' : 'Instalação'),
        valor_servico: Number(c.valor_base || 0),
        percentual: Number(c.percentual || 0),
        valor_comissao: Number(c.valor_comissao || 0),
        tipo: c.tipo,
      });
    }
    const lista = Object.values(grupos).sort((a: any, b: any) => b.total - a.total);
    const totalGeral = lista.reduce((s: number, g: any) => s + g.total, 0);
    const totalVendedores = lista.filter((g: any) => g.papel !== 'SUPERVISAO').reduce((s: number, g: any) => s + g.total, 0);
    const totalSupervisao = lista.filter((g: any) => g.papel === 'SUPERVISAO').reduce((s: number, g: any) => s + g.total, 0);

    return reply.send({ status: 'success', data: { mes_pagamento: mes, grupos: lista, total_geral: Math.round(totalGeral * 100) / 100, total_vendedores: Math.round(totalVendedores * 100) / 100, total_supervisao: Math.round(totalSupervisao * 100) / 100 } });
  });

  // LANÇAR BÔNUS TRIMESTRAL: ao fim da campanha, cria a comissão de bônus p/ cada
  // vendedor que bateu a meta, com pagamento no MÊS SEGUINTE ao fim do trimestre
  // (terminou em julho → paga em agosto). Idempotente por (vendedor + trimestre).
  fastify.post('/comissoes/bonus-trimestral/lancar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = (request as any).user;
    const q = z.object({ ref: z.string().regex(/^\d{4}-\d{2}$/).optional() }).safeParse(request.body);
    const agora = new Date();
    const [yy, mm] = q.success && q.data.ref ? q.data.ref.split('-').map(Number) : [agora.getFullYear(), agora.getMonth() + 1];
    const tri = trimestreProsystem(yy, mm);

    // Mês de pagamento = mês seguinte ao FIM do trimestre.
    const fimMesPagto = new Date(tri.fim.getFullYear(), tri.fim.getMonth() + 1, 1);
    const mesPagamento = `${fimMesPagto.getFullYear()}-${String(fimMesPagto.getMonth() + 1).padStart(2, '0')}`;

    // Conta contratos fechados no trimestre por vendedor.
    const props = await prisma.propostaComercial.findMany({
      where: {
        status: { in: STATUS_FECHADA_BONUS },
        OR: [
          { data_aceite: { gte: tri.inicio, lte: tri.fim } },
          { AND: [{ data_aceite: null }, { created_at: { gte: tri.inicio, lte: tri.fim } }] },
        ],
        deleted_at: null,
      },
      select: { vendedor_id: true, vendedor_nome: true },
    }).catch(() => [] as any[]);

    const porVend: Record<string, { nome: string | null; contratos: number }> = {};
    for (const p of props) {
      const id = p.vendedor_id; if (!id) continue;
      porVend[id] = porVend[id] || { nome: p.vendedor_nome || null, contratos: 0 };
      porVend[id].contratos += 1;
    }
    const nomes = await resolverNomesUsuarios(prisma, Object.keys(porVend)).catch(() => ({} as any));

    let criadas = 0, jaExistiam = 0; const detalhe: any[] = [];
    for (const [vid, v] of Object.entries(porVend)) {
      const faixa = FAIXAS_BONUS.find(f => v.contratos >= f.meta);
      if (!faixa) continue;
      const refId = `bonus-${tri.rotulo}-${vid}`; // idempotência por vendedor+trimestre
      const existe = await prisma.comissao.findFirst({ where: { referencia_id: refId, tipo: 'BONUS' } }).catch(() => null);
      if (existe) { jaExistiam++; continue; }
      await prisma.comissao.create({
        data: {
          responsavel_id: vid, tipo: 'BONUS', referencia_id: refId,
          descricao: `Bônus trimestral (${tri.rotulo}) — ${faixa.rotulo}, ${v.contratos} contratos`,
          valor_base: faixa.premio, percentual: 100, valor_comissao: faixa.premio,
          periodo: mesPagamento, mes_pagamento: mesPagamento, papel: 'VENDEDOR',
          status: 'APROVADA', estagio: 'CONFIRMADA', aprovada_por: user?.id || 'system', aprovada_em: new Date(),
          created_by: user?.id || 'system',
        } as any,
      });
      criadas++;
      detalhe.push({ vendedor: nomes[vid] || v.nome || vid, contratos: v.contratos, faixa: faixa.rotulo, premio: faixa.premio });
    }

    return reply.send({ status: 'success', data: { trimestre: tri.rotulo, mes_pagamento: mesPagamento, bonus_criados: criadas, ja_existiam: jaExistiam, detalhe } });
  });

  // ===== EXTRATO DE COMISSÕES =====
  // Períodos (YYYY-MM) que TÊM comissão lançada — p/ o seletor de mês mostrar
  // todos (inclusive meses futuros, ex.: comissão de venda adicional lançada p/
  // o mês posterior ao vencimento). Vendedor vê só os seus; gestor, todos.
  fastify.get('/comissoes/periodos', async (request, reply) => {
    const scopeId = scopeUserId(request);
    const where: any = {};
    if (scopeId !== null) where.responsavel_id = scopeId;
    // Inclui tanto o mês da venda (periodo) quanto o mês de pagamento (mes_pagamento),
    // p/ que o seletor mostre o mês em que a comissão será paga (ex.: 2026-07).
    const rows = await prisma.comissao.findMany({
      where, select: { periodo: true, mes_pagamento: true },
    }).catch(() => [] as any[]);
    const set = new Set<string>();
    rows.forEach((r: any) => { if (r.periodo) set.add(r.periodo); if (r.mes_pagamento) set.add(r.mes_pagamento); });
    const periodos = Array.from(set).sort().reverse();
    return reply.send({ status: 'success', data: { periodos } });
  });

  fastify.get('/comissoes', async (request, reply) => {
    const query = z.object({
      responsavel_id: z.string().optional(),
      periodo: z.string().optional(),
      status: z.string().optional(),
      tipo: z.string().optional(),
    }).safeParse(request.query);

    const where: any = {};
    // O "período" da tela casa com o mês da VENDA (periodo) OU o mês de PAGAMENTO
    // (mes_pagamento). Assim a comissão aparece tanto no mês em que foi vendida
    // quanto no mês em que vai ser paga — sem "sumir" ao trocar o mês no topo.
    if (query.data?.periodo) {
      where.OR = [{ periodo: query.data.periodo }, { mes_pagamento: query.data.periodo }];
    }
    if (query.data?.status) where.status = query.data.status;
    if (query.data?.tipo) where.tipo = query.data.tipo;
    // Escopo: vendedor só vê a própria comissão (ignora responsavel_id de outro);
    // gestor vê todas (ou filtra por responsavel_id da query).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.responsavel_id = scopeId;
    else if (query.data?.responsavel_id) where.responsavel_id = query.data.responsavel_id;

    const comissoesRaw = await prisma.comissao.findMany({
      where,
      include: { regra: true },
      orderBy: { created_at: 'desc' }
    });
    // Anexa a razão social do cliente e o NOME do responsável (vendedor/supervisão)
    // de cada comissão — em vez de mostrar o id ou "system".
    const clienteDe = await mapaClientes(comissoesRaw as any[]);
    const respIds = [...new Set(comissoesRaw.map((c: any) => c.responsavel_id).filter(Boolean))];
    const nomeDe = await resolverNomesUsuarios(prisma, respIds);
    // Busca supervisora real para exibir nome correto nas comissões de supervisão
    const supervisoraLista = await (prisma as any).usuarioCRM.findFirst({
      where: { role: { in: ['SUPERVISAO', 'SUPERVISAO_COMERCIAL'] }, ativo: true },
      orderBy: { nome: 'asc' }, select: { id: true, nome: true },
    }).catch(() => null);

    const comissoes = comissoesRaw.map((c: any) => {
      const ehSupervisao = c.tipo === 'SUPERVISAO_VENDA_ADICIONAL' || c.papel === 'SUPERVISAO';
      return {
        ...c,
        cliente: clienteDe[c.referencia_id || ''] || null,
        responsavel_nome: ehSupervisao && supervisoraLista ? supervisoraLista.nome : (nomeDe[c.responsavel_id] || null),
        responsavel_id: ehSupervisao && supervisoraLista ? supervisoraLista.id : c.responsavel_id,
      };
    });

    // Agrupado por responsável
    const por_responsavel = comissoes.reduce((acc: any, c) => {
      if (!acc[c.responsavel_id]) {
        acc[c.responsavel_id] = { responsavel_id: c.responsavel_id, responsavel_nome: c.responsavel_nome || nomeDe[c.responsavel_id] || null, total: 0, pendente: 0, pago: 0, count: 0 };
      }
      acc[c.responsavel_id].total += c.valor_comissao;
      acc[c.responsavel_id].count += 1;
      if (c.status === 'PAGA') acc[c.responsavel_id].pago += c.valor_comissao;
      else if (c.status === 'PENDENTE' || c.status === 'APROVADA') acc[c.responsavel_id].pendente += c.valor_comissao;
      return acc;
    }, {});

    return reply.send({
      status: 'success',
      data: {
        comissoes,
        resumo: Object.values(por_responsavel),
        totais: {
          total: comissoes.reduce((s, c) => s + c.valor_comissao, 0),
          pendente: comissoes.filter(c => c.status === 'PENDENTE').reduce((s, c) => s + c.valor_comissao, 0),
          pago: comissoes.filter(c => c.status === 'PAGA').reduce((s, c) => s + c.valor_comissao, 0)
        }
      }
    });
  });

  fastify.post('/comissoes', async (request, reply) => {
    const body = z.object({
      responsavel_id: z.string(),
      tipo: z.enum(['CONTRATO', 'PROPOSTA', 'LEAD', 'MANUAL', 'BONUS']).default('MANUAL'),
      referencia_id: z.string().optional(),
      descricao: z.string().optional(),
      valor_base: z.number().min(0),
      percentual: z.number().min(0).max(100),
      periodo: z.string(),
      regra_id: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const valor_comissao = body.data.valor_base * (body.data.percentual / 100);
    const comissao = await prisma.comissao.create({
      data: { ...body.data, valor_comissao }
    });
    return reply.status(201).send({ status: 'success', data: comissao });
  });

  fastify.patch('/comissoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'APROVADA', 'PAGA', 'CANCELADA']).optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const comissao = await prisma.comissao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: comissao });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Comissão não encontrada' });
      throw err;
    }
  });

  // Auto-calcular comissões de contratos do mês
  fastify.post('/comissoes/calcular-mes', async (request, reply) => {
    const body = z.object({ periodo: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Período inválido (formato YYYY-MM)' });

    const { periodo } = body.data;
    const [ano, mes] = periodo.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar contratos criados no período
    const contratos = await prisma.contrato.findMany({
      where: { created_at: { gte: inicio, lte: fim }, status: 'ATIVO' },
      include: { lead: { select: { responsavel_id: true } } }
    });

    // Buscar regras ativas
    const regras = await prisma.regraComissao.findMany({ where: { ativo: true, tipo: 'CONTRATO' } });

    let criadas = 0;
    for (const contrato of contratos) {
      const responsavel_id = contrato.lead?.responsavel_id;
      if (!responsavel_id) continue;

      const regra = regras.find(r => r.responsavel_id === responsavel_id) || regras[0];
      if (!regra) continue;

      const existente = await prisma.comissao.findFirst({
        where: { referencia_id: contrato.id, tipo: 'CONTRATO', periodo }
      });
      if (existente) continue;

      await prisma.comissao.create({
        data: {
          responsavel_id,
          regra_id: regra.id,
          tipo: 'CONTRATO',
          referencia_id: contrato.id,
          descricao: `Contrato #${contrato.numero || contrato.id.slice(-6)}`,
          valor_base: contrato.valor,
          percentual: regra.percentual,
          valor_comissao: contrato.valor * (regra.percentual / 100),
          periodo
        }
      });
      criadas++;
    }

    return reply.send({ status: 'success', data: { criadas, periodo } });
  });

  // ===== INDICAÇÕES =====
  fastify.get('/indicacoes', async (request, reply) => {
    const query = z.object({ status: z.string().optional() }).safeParse(request.query);
    const where: any = {};
    if (query.data?.status) where.status = query.data.status;

    const indicacoes = await prisma.indicacao.findMany({
      where,
      include: {
        cliente_indicador: { select: { id: true, nome: true, empresa: true } },
        lead: { select: { id: true, nome: true, status: true, valor_estimado: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    const stats = {
      total: indicacoes.length,
      convertidas: indicacoes.filter(i => i.status === 'CONVERTIDO').length,
      pendentes: indicacoes.filter(i => i.status === 'PENDENTE').length,
      bonus_total: indicacoes.filter(i => i.bonus_pago).reduce((s, i) => s + i.bonus_valor, 0)
    };

    return reply.send({ status: 'success', data: { indicacoes, stats } });
  });

  fastify.post('/indicacoes', async (request, reply) => {
    const body = z.object({
      cliente_indicador_id: z.string(),
      nome_indicado: z.string().min(1),
      email_indicado: z.string().email().optional(),
      telefone_indicado: z.string().optional(),
      empresa_indicado: z.string().optional(),
      bonus_valor: z.number().default(0),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const indicacao = await prisma.indicacao.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: indicacao });
  });

  fastify.patch('/indicacoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'CONTATO', 'CONVERTIDO', 'PERDIDO']).optional(),
      lead_id: z.string().optional(),
      bonus_pago: z.boolean().optional(),
      bonus_valor: z.number().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const indicacao = await prisma.indicacao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: indicacao });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Indicação não encontrada' });
      throw err;
    }
  });
}
