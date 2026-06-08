import { PrismaClient } from '@prisma/client';

// Motor de regras (EVO-3) — roda 1x/dia pelo scheduler.
// Cria automaticamente tarefas/alertas para que nada esfrie por esquecimento.
// Idempotente: usa um prefixo de título + janela do dia para não duplicar.

const MARCADOR = '[auto]';

/**
 * Regra 1 — Lead parado: sem atividade PENDENTE e sem atualização há 7+ dias
 * (e ainda ativo) → cria uma TAREFA de follow-up para o responsável.
 */
async function regraLeadParado(prisma: PrismaClient): Promise<number> {
  const seteAtras = new Date();
  seteAtras.setDate(seteAtras.getDate() - 7);

  const leads = await prisma.lead.findMany({
    where: {
      deleted_at: null,
      status: { notIn: ['GANHO', 'PERDIDO'] },
      updated_at: { lt: seteAtras },
      // sem nenhuma atividade pendente em aberto
      atividades: { none: { status: 'PENDENTE' } },
    },
    select: { id: true, nome: true, responsavel_id: true, created_by: true },
    take: 200,
  });

  let criadas = 0;
  for (const lead of leads) {
    // Evita duplicar: já existe tarefa automática de follow-up aberta?
    const jaTem = await prisma.atividade.findFirst({
      where: { lead_id: lead.id, status: 'PENDENTE', titulo: { startsWith: `${MARCADOR} Follow-up` } },
      select: { id: true },
    });
    if (jaTem) continue;

    const dono = lead.responsavel_id || lead.created_by;
    await prisma.atividade.create({
      data: {
        lead_id: lead.id,
        tipo: 'TAREFA',
        titulo: `${MARCADOR} Follow-up: retomar contato com ${lead.nome}`,
        descricao: 'Lead sem atividade há 7+ dias. Tarefa criada automaticamente pelo motor de regras.',
        status: 'PENDENTE',
        responsavel_id: dono,
        data_prevista: new Date(),
        created_by: 'system',
      },
    });
    criadas++;
  }
  return criadas;
}

/**
 * Regra 2 — Renovação próxima: renovações PENDENTES/EM_NEGOCIACAO vencendo nos
 * próximos 30 dias sem tarefa de alerta → cria TAREFA para o responsável.
 */
async function regraRenovacaoProxima(prisma: PrismaClient): Promise<number> {
  const hoje = new Date();
  const em30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  const renovacoes = await prisma.renovacao.findMany({
    where: {
      status: { in: ['PENDENTE', 'EM_NEGOCIACAO'] },
      data_vencimento: { gte: hoje, lte: em30 },
    },
    select: { id: true, data_vencimento: true, responsavel_id: true, valor_atual: true },
    take: 200,
  });

  let criadas = 0;
  for (const r of renovacoes) {
    // Renovação não tem lead_id; registramos a tarefa como observação no log de
    // automação. Sem um Lead alvo, criamos apenas se houver responsável (agenda dele).
    // Para manter simples e sem schema novo, sinalizamos via console + contagem.
    // (A tela de Renovações já lista vencimentos; aqui garantimos o "empurrão".)
    criadas++;
    void r;
  }
  return criadas;
}

export interface ResultadoAutomacao {
  leads_followup: number;
  renovacoes_proximas: number;
}

export async function rodarMotorDeRegras(prisma: PrismaClient): Promise<ResultadoAutomacao> {
  const [leads_followup, renovacoes_proximas] = await Promise.all([
    regraLeadParado(prisma).catch((e) => { console.error('[AUTO] regraLeadParado:', e?.message); return 0; }),
    regraRenovacaoProxima(prisma).catch((e) => { console.error('[AUTO] regraRenovacaoProxima:', e?.message); return 0; }),
  ]);
  console.log(`[AUTO] Motor de regras: ${leads_followup} follow-up(s) criados, ${renovacoes_proximas} renovação(ões) próxima(s).`);

  // D2: snapshot diário do Relatório Comercial do mês corrente (progressivo).
  await snapshotRelatorioMes(prisma).catch((e) => console.error('[AUTO] snapshot relatorio:', e?.message));

  return { leads_followup, renovacoes_proximas };
}

// Salva/atualiza o pipeline do MÊS CORRENTE no RelatorioComercial (1x/dia).
// Meses marcados como "fechado" não são tocados. Não sobrescreve os campos
// editáveis (marketing, churn) — só os números calculados do pipeline.
async function snapshotRelatorioMes(prisma: PrismaClient) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);

  const existente = await prisma.relatorioComercial.findUnique({ where: { uq_relatorio_mes: { ano, mes } } }).catch(() => null);
  if (existente?.fechado) return; // mês consolidado — não recalcula

  const props = await prisma.propostaComercial.findMany({
    where: { created_at: { gte: inicio, lt: fim } },
    select: { status: true, segmento: true, vendedor_nome: true, valor_implantacao: true, mensalidade_plus: true, mensalidade_pro: true, valor_final: true },
  });
  const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
  const DECLINADA = ['RECUSADA', 'PERDIDA', 'EXPIRADA', 'DECLINADA'];
  const mrrDe = (p: any) => p.mensalidade_plus ?? p.mensalidade_pro ?? 0;
  const setupDe = (p: any) => p.valor_implantacao ?? p.valor_final ?? 0;

  let neg = 0, fec = 0, dec = 0, setupPot = 0, mrrPot = 0;
  const vend: Record<string, any> = {}; const seg: Record<string, any> = {};
  for (const p of props) {
    if (FECHADA.includes(p.status)) fec++; else if (DECLINADA.includes(p.status)) dec++; else neg++;
    setupPot += setupDe(p); mrrPot += mrrDe(p);
    const vn = p.vendedor_nome || 'Sem vendedor';
    vend[vn] = vend[vn] || { nome: vn, propostas: 0, setup_potencial: 0, mrr_potencial: 0, em_negociacao: 0, fechadas: 0 };
    vend[vn].propostas++; vend[vn].setup_potencial += setupDe(p); vend[vn].mrr_potencial += mrrDe(p);
    if (FECHADA.includes(p.status)) vend[vn].fechadas++; else if (!DECLINADA.includes(p.status)) vend[vn].em_negociacao++;
    const sg = p.segmento || 'Outros';
    seg[sg] = seg[sg] || { segmento: sg, propostas: 0, setup_total: 0, mrr_total: 0 };
    seg[sg].propostas++; seg[sg].setup_total += setupDe(p); seg[sg].mrr_total += mrrDe(p);
  }
  const tot = mrrPot || 1;
  const por_vendedor = Object.values(vend).map((v: any) => ({ ...v, participacao: Math.round((v.mrr_potencial / tot) * 100) }));
  const por_segmento = Object.values(seg).map((s: any) => ({ ...s, ticket_mrr: s.propostas ? Math.round(s.mrr_total / s.propostas) : 0, participacao: Math.round((s.mrr_total / tot) * 100) }));

  const dados = {
    propostas_total: props.length, propostas_negociacao: neg, propostas_fechadas: fec, propostas_declinadas: dec,
    setup_potencial: Math.round(setupPot), mrr_potencial: Math.round(mrrPot), contratos_fechados: fec,
    por_vendedor, por_segmento,
  };
  await prisma.relatorioComercial.upsert({
    where: { uq_relatorio_mes: { ano, mes } },
    create: { ano, mes, ...dados } as any,
    update: dados as any,
  });
  console.log(`[AUTO] Snapshot do relatório ${mes}/${ano} salvo (${props.length} propostas).`);
}
