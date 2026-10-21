import type { PrismaClient } from '@prisma/client';
import {
  probabilidadeProposta, probabilidadeLeadAgente, resumirPrevisao, mediana, diasEntre, semHistorico, FORA_DA_PREVISAO,
  type ItemPrevisao,
} from '@/lib/previsao-fechamento';

// Previsão de fechamento e ciclo de vendas com dados concretos (21/10/2026). Regras em lib/previsao-fechamento.ts.

const dig = (s: unknown) => String(s || '').replace(/\D/g, '');
const brt = (d: Date) => new Date(d.getTime() - 3 * 3600e3);

/** Ticket médio dos contratos dos últimos 180 dias (vale para lead sem proposta). */
async function ticketMedio(prisma: PrismaClient, agora: Date) {
  const a = await prisma.contratoComercial.aggregate({ where: { recuado_at: null, data_contrato: { gte: new Date(agora.getTime() - 180 * 864e5) } }, _avg: { mensalidade: true, valor_setup_total: true }, _count: { _all: true } });
  return { mensalidade: Math.round(a._avg.mensalidade || 0), implantacao: Math.round(a._avg.valor_setup_total || 0), contratos: a._count._all };
}

export async function calcularPrevisaoFechamento(prisma: PrismaClient, opts: { vendedorId?: string | null; agora?: Date } = {}) {
  const agora = opts.agora || new Date();
  const props = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, created_at: { gte: new Date(agora.getTime() - 180 * 864e5) }, status: { notIn: FORA_DA_PREVISAO },
      ...(opts.vendedorId ? { OR: [{ vendedor_id: opts.vendedorId }, { created_by: opts.vendedorId }] } : {}) },
    select: { id: true, razao_social: true, nome_fantasia: true, status: true, mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true,
      valor_final: true, valor_implantacao: true, vendedor_nome: true, wpp_enviada_em: true, created_at: true, wpp_conversa_id: true },
  });
  const itens: ItemPrevisao[] = props.map(p => {
    const dias = diasEntre(p.wpp_enviada_em || p.created_at, agora);
    return {
      origem: 'proposta', empresa: p.nome_fantasia || p.razao_social, status: p.status, probabilidade: probabilidadeProposta(p.status, dias),
      mensalidade: p.mensalidade_plus || p.mensalidade_pro || p.mensalidade_basic || 0, implantacao: p.valor_final || p.valor_implantacao || 0,
      dias, vendedor: (p.vendedor_nome || '').trim() || null, link: '/propostas-comerciais',
    };
  });

  // Leads quentes e mornos do último relatório do Analista (sem proposta), com o ticket médio
  const ticket = await ticketMedio(prisma, agora);
  if (!opts.vendedorId) {
    const { lerAnaliseResultados } = await import('./analista-resultados.service');
    const rel = await lerAnaliseResultados(prisma).catch(() => null);
    const nomesComProposta = new Set(itens.map(i => i.empresa.toLowerCase().trim()));
    for (const l of (rel?.leads || []) as any[]) {
      const prob = probabilidadeLeadAgente(l.temperatura);
      if (!prob || nomesComProposta.has(String(l.empresa || '').toLowerCase().trim())) continue;
      itens.push({ origem: 'lead', empresa: l.empresa, status: l.temperatura, probabilidade: prob, mensalidade: ticket.mensalidade, implantacao: ticket.implantacao,
        dias: diasEntre(l.ultima_cliente ? new Date(`${l.ultima_cliente}T12:00:00Z`) : null, agora), vendedor: null, link: l.conversaId ? `/whatsapp?conversa=${l.conversaId}` : null });
    }
  }
  itens.sort((a, b) => b.probabilidade - a.probabilidade || b.mensalidade - a.mensalidade);

  // Meta de contratos do mês e o realizado (módulo de contratos)
  const b = brt(agora);
  const periodo = `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`;
  const inicioMes = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1, 3));
  const [metas, feitos, historico] = await Promise.all([
    prisma.meta.findMany({ where: { tipo: 'CONTRATOS', periodo }, select: { valor_alvo: true } }),
    prisma.contratoComercial.aggregate({ where: { recuado_at: null, data_contrato: { gte: inicioMes } }, _count: { _all: true }, _sum: { mensalidade: true } }),
    prisma.propostaComercial.groupBy({ by: ['status'], where: { deleted_at: null, created_at: { gte: new Date(agora.getTime() - 180 * 864e5) } }, _count: { _all: true } }),
  ]);
  // A meta de contratos às vezes foi lançada em reais (ex.: 7500): só vale número de contratos plausível.
  const metaContratos = metas.map(m => m.valor_alvo || 0).filter(v => v > 0 && v <= 200).reduce((t, v) => t + v, 0) || null;
  const h = Object.fromEntries(historico.map(g => [g.status, g._count._all])) as Record<string, number>;
  const ganhas = h.CONTRATO_ASSINADO || 0, perdidas = (h.PERDIDA || 0) + (h.RECUSADA || 0) + (h.EXPIRADA || 0) + (h.CANCELADA || 0);

  return {
    gerado_em: agora.toISOString(),
    resumo: resumirPrevisao(itens),
    meta: { periodo, contratos: metaContratos, realizados: feitos._count._all, mensalidade_realizada: feitos._sum.mensalidade || 0,
      faltam: metaContratos != null ? Math.max(0, metaContratos - feitos._count._all) : null, meta_em_reais_ignorada: metas.some(m => (m.valor_alvo || 0) > 200) },
    taxa_historica: { ganhas, perdidas, pct: ganhas + perdidas ? Math.round((100 * ganhas) / (ganhas + perdidas)) : null },
    ticket_medio: ticket,
    por_origem: {
      propostas: itens.filter(i => i.origem === 'proposta').length,
      leads: itens.filter(i => i.origem === 'lead').length,
    },
    itens: itens.slice(0, 80).map(i => ({ ...i, probabilidade: Math.round(i.probabilidade * 100) })),
  };
}

export async function calcularCicloVendas(prisma: PrismaClient, opts: { desde?: Date; agora?: Date } = {}) {
  const agora = opts.agora || new Date();
  const desde = opts.desde || new Date('2026-06-01T03:00:00Z'); // módulo de contratos em uso desde junho/2026
  const cs = await prisma.contratoComercial.findMany({
    where: { recuado_at: null, data_contrato: { gte: desde } }, orderBy: { data_contrato: 'desc' },
    select: { id: true, nome_fantasia: true, razao_social: true, data_contrato: true, proposta_comercial_id: true, cnpj: true, representante_telefone: true, mensalidade: true },
  });
  const props = new Map((await prisma.propostaComercial.findMany({ where: { id: { in: cs.map(c => c.proposta_comercial_id).filter(Boolean) as string[] } },
    select: { id: true, created_at: true, wpp_enviada_em: true, data_aceite: true, cnpj: true, responsavel_telefone: true } })).map(p => [p.id, p]));

  const linhas = [];
  for (const c of cs) {
    const p = c.proposta_comercial_id ? props.get(c.proposta_comercial_id) : undefined;
    const cnpj = dig(p?.cnpj || c.cnpj), tel = dig(p?.responsavel_telefone || c.representante_telefone).slice(-8);
    const ors: any[] = [];
    if (cnpj.length >= 11) ors.push({ cnpj: { contains: cnpj } });
    if (tel.length === 8) ors.push({ responsavel_telefone: { endsWith: tel } }, { telefone: { endsWith: tel } });
    const lead = ors.length ? await prisma.lead.findFirst({ where: { OR: ors }, orderBy: { created_at: 'asc' }, select: { created_at: true } }) : null;
    const conversa = tel.length === 8 ? await prisma.whatsappConversa.findFirst({ where: { contato_numero: { endsWith: tel } }, orderBy: { created_at: 'asc' }, select: { created_at: true } }) : null;
    const entrada = [lead?.created_at, conversa?.created_at].filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] || null;
    const ate_proposta = diasEntre(entrada, p?.created_at);
    const proposta_ate_contrato = diasEntre(p?.created_at, c.data_contrato);
    const entrada_ate_contrato = diasEntre(entrada, c.data_contrato);
    linhas.push({
      empresa: c.nome_fantasia || c.razao_social, data_contrato: brt(c.data_contrato).toISOString().slice(0, 10), mensalidade: c.mensalidade || 0,
      entrada_ate_proposta: ate_proposta, proposta_ate_aceite: diasEntre(p?.created_at, p?.data_aceite), proposta_ate_contrato, entrada_ate_contrato,
      sem_historico: semHistorico(entrada_ate_contrato, proposta_ate_contrato),
    });
  }
  const validas = linhas.filter(l => !l.sem_historico);
  const col = (k: 'entrada_ate_proposta' | 'proposta_ate_contrato' | 'entrada_ate_contrato' | 'proposta_ate_aceite') => validas.map(l => l[k]).filter((v): v is number => v != null);
  const etapa = (rotulo: string, v: number[]) => ({ etapa: rotulo, dias_medio: v.length ? +(v.reduce((t, x) => t + x, 0) / v.length).toFixed(1) : 0, mediana: mediana(v), amostras: v.length });
  const total = col('entrada_ate_contrato');

  // Propostas abertas: há quantos dias estão paradas (o que o ciclo diz sobre o funil de hoje)
  const abertas = await prisma.propostaComercial.findMany({ where: { deleted_at: null, status: { notIn: [...FORA_DA_PREVISAO, 'RASCUNHO'] }, created_at: { gte: new Date(agora.getTime() - 180 * 864e5) } }, select: { created_at: true, wpp_enviada_em: true } });
  const idades = abertas.map(a => diasEntre(a.wpp_enviada_em || a.created_at, agora) || 0);

  return {
    total_contratos: linhas.length, com_historico: validas.length, sem_historico: linhas.length - validas.length,
    ciclo_mediana_dias: mediana(total), ciclo_medio_dias: total.length ? +(total.reduce((t, x) => t + x, 0) / total.length).toFixed(1) : 0,
    ciclo_min: total.length ? Math.min(...total) : 0, ciclo_max: total.length ? Math.max(...total) : 0,
    tempo_medio_por_etapa: [
      etapa('Entrada → proposta', col('entrada_ate_proposta')),
      etapa('Proposta → aceite', col('proposta_ate_aceite')),
      etapa('Proposta → contrato', col('proposta_ate_contrato')),
    ],
    propostas_abertas: { quantidade: idades.length, idade_mediana: mediana(idades), ate_15_dias: idades.filter(d => d <= 15).length, mais_de_45: idades.filter(d => d > 45).length },
    contratos: linhas,
  };
}
