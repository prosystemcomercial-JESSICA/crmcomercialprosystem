import type { PrismaClient } from '@prisma/client';
import { situacaoDaIndicacao } from '@/lib/indicacao-situacao';

// Painel das indicações de clientes (14/10/2026): quem indicou, em que pé está cada indicado e quais prêmios de 50%
// falta aplicar no faturamento. A situação vem do lead, da conversa da Caroline e das propostas (pelo telefone).
const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const ult8 = (t: string | null | undefined) => String(t || '').replace(/\D/g, '').slice(-8);

export async function indicacoesDeClientes(prisma: PrismaClient) {
  const inds = await prisma.indicacao.findMany({
    orderBy: { created_at: 'desc' }, take: 300,
    include: { cliente_indicador: { select: { id: true, razao_social: true, nome_fantasia: true, nome: true, codigo: true } } },
  });
  const leadIds = inds.map(i => i.lead_id).filter(Boolean) as string[];
  const [sdrs, propostas] = await Promise.all([
    prisma.sdrLead.findMany({ where: { lead_id: { in: leadIds } }, select: { lead_id: true, status: true, primeiro_envio_em: true, ultima_lead_em: true, nota: true, conversaId: true } }),
    prisma.propostaComercial.findMany({ where: { deleted_at: null, created_at: { gte: new Date(Date.now() - 365 * 864e5) } }, select: { responsavel_telefone: true, status: true, data_aceite: true, created_at: true } }),
  ]);
  const linhas = [];
  for (const i of inds) {
    const s = sdrs.find(x => x.lead_id === i.lead_id);
    const props = propostas.filter(p => ult8(p.responsavel_telefone) === ult8(i.telefone_indicado) && ult8(i.telefone_indicado).length === 8 && p.created_at >= i.created_at);
    const sit = situacaoDaIndicacao({ sdrStatus: s?.status, primeiroEnvio: s?.primeiro_envio_em, respondeu: !!s?.ultima_lead_em, nota: s?.nota, temProposta: props.some(p => p.status !== 'RASCUNHO'), fechou: props.some(p => FECHADA.includes(p.status) && !!p.data_aceite), statusAtual: i.status });
    if (sit.status !== i.status) await prisma.indicacao.update({ where: { id: i.id }, data: { status: sit.status } }).catch(() => {});
    const c = i.cliente_indicador as any;
    linhas.push({
      id: i.id, criada_em: i.created_at, cliente: c?.nome_fantasia || c?.razao_social || c?.nome || 'Cliente', cliente_codigo: c?.codigo || null,
      indicado: i.nome_indicado, empresa: i.empresa_indicado, telefone: i.telefone_indicado, conversaId: s?.conversaId || null,
      fase: sit.fase, status: sit.status, bonus_pago: i.bonus_pago, premio_pendente: sit.status === 'CONVERTIDO' && !i.bonus_pago,
    });
  }
  return {
    linhas,
    resumo: { total: linhas.length, em_andamento: linhas.filter(l => l.status === 'PENDENTE' || l.status === 'CONTATO').length, fecharam: linhas.filter(l => l.status === 'CONVERTIDO').length, premios_pendentes: linhas.filter(l => l.premio_pendente).length },
  };
}

/** O desconto de 50% foi lançado no faturamento do cliente que indicou. */
export async function marcarPremioAplicado(prisma: PrismaClient, id: string, aplicado: boolean, quem: string) {
  const i = await prisma.indicacao.findUnique({ where: { id } });
  if (!i) throw new Error('Indicação não encontrada.');
  const obs = aplicado ? `${i.observacoes || ''}\nDesconto de 50% aplicado por ${quem} em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`.trim() : i.observacoes;
  return prisma.indicacao.update({ where: { id }, data: { bonus_pago: aplicado, observacoes: obs } });
}
