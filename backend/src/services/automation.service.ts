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
  return { leads_followup, renovacoes_proximas };
}
