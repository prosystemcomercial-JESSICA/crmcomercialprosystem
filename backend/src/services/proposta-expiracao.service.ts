import { PrismaClient } from '@prisma/client';

/**
 * Marca como EXPIRADA toda PropostaComercial que passou da `validade` sem
 * decisão do cliente (ainda em RASCUNHO/ENVIADA/VISUALIZADA/EM_NEGOCIACAO).
 * Não mexe em propostas já aceitas/recusadas/em contrato — só o "limbo" sem
 * resposta depois do prazo.
 */
const STATUS_AINDA_ABERTOS = ['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'];

export async function rodarSchedulerExpiracaoPropostas(prisma: PrismaClient) {
  // updateMany não devolve os registros afetados — busca antes p/ poder
  // registrar o histórico (status anterior) de cada uma individualmente.
  const candidatas = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, status: { in: STATUS_AINDA_ABERTOS }, validade: { lt: new Date() } },
    select: { id: true, status: true },
  });
  for (const p of candidatas) {
    await prisma.propostaComercial.update({ where: { id: p.id }, data: { status: 'EXPIRADA' } }).catch(() => {});
    await prisma.propostaHistorico.create({
      data: { proposta_id: p.id, tipo: 'STATUS', valor_anterior: p.status, valor_novo: 'EXPIRADA', feito_por_nome: 'Sistema (validade vencida)' },
    }).catch(() => {});
  }
  return { expiradas: candidatas.length };
}
