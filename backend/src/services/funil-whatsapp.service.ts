import type { PrismaClient } from '@prisma/client';
import { deveIrParaInteressados, DIAS_INTERAGINDO } from '@/lib/funil-whatsapp';

// Move para "Interessados" os contatos de "Novo Contato" que têm interesse e estão conversando.
// Roda a cada 10 min (e logo no boot, para organizar o que já existe) e na hora em que a Laya analisa uma conversa.

export async function moverInteressados(prisma: PrismaClient, ids?: string[]): Promise<number> {
  const agora = new Date();
  const conversas = await prisma.whatsappConversa.findMany({
    where: { estagio_funil: 'NOVO_CONTATO', finalizada_em: null, ultima_em: { gte: new Date(agora.getTime() - DIAS_INTERAGINDO * 864e5) }, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, estagio_funil: true, finalizada_em: true, optout_campanhas: true, tipo_contato: true, etiqueta: true, ia_sugestao: true, lead_id: true },
  });
  if (!conversas.length) return 0;
  const [entradas, leads] = await Promise.all([
    prisma.whatsappMensagem.groupBy({ by: ['conversaId'], where: { conversaId: { in: conversas.map(c => c.id) }, direcao: 'ENTRADA' }, _max: { created_at: true } }),
    prisma.lead.findMany({ where: { id: { in: conversas.map(c => c.lead_id).filter(Boolean) as string[] } }, select: { id: true, temperatura: true } }),
  ]);
  const ultima = new Map(entradas.map(e => [e.conversaId, e._max.created_at]));
  const temp = new Map(leads.map(l => [l.id, l.temperatura]));
  const mover = conversas.filter(c => deveIrParaInteressados({ ...c, lead_temperatura: c.lead_id ? temp.get(c.lead_id) : null, ultima_entrada: ultima.get(c.id) || null }, agora)).map(c => c.id);
  if (!mover.length) return 0;
  // Só quem ainda está em Novo Contato (a equipe pode ter movido no meio do caminho).
  const r = await prisma.whatsappConversa.updateMany({ where: { id: { in: mover }, estagio_funil: 'NOVO_CONTATO' }, data: { estagio_funil: 'INTERESSADO' } });
  return r.count;
}
