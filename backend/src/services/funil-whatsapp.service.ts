import type { PrismaClient } from '@prisma/client';
import { deveIrParaInteressados, DIAS_INTERAGINDO, finaisTelefone } from '@/lib/funil-whatsapp';

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

// Move para "Fechado" as conversas de quem fechou (lead FECHADO/GANHO ou com implantação ativa).
// Acha a conversa pelo lead vinculado ou pelos 8 últimos dígitos do telefone do lead.
// Roda junto com "Interessados" (a cada 10 min e no boot). Pausa a cadência automática, como a troca manual.
export async function moverFechados(prisma: PrismaClient): Promise<number> {
  const [leads, imps] = await Promise.all([
    prisma.lead.findMany({
      where: { deleted_at: null, OR: [{ etapa_comercial: 'FECHADO' }, { status: 'GANHO' }] },
      select: { id: true, telefone: true, responsavel_telefone: true },
    }),
    prisma.implantacao.findMany({ where: { status: { not: 'CANCELADA' } }, select: { lead_id: true, proposta_id: true } }),
  ]);
  // Implantação sem lead_id: chega ao lead pela proposta.
  const propostaIds = imps.filter(i => !i.lead_id && i.proposta_id).map(i => i.proposta_id!);
  const propostas = propostaIds.length ? await prisma.proposta.findMany({ where: { id: { in: propostaIds } }, select: { lead_id: true } }) : [];
  const idsImp = [...imps.map(i => i.lead_id), ...propostas.map(p => p.lead_id)].filter(Boolean) as string[];
  const conhecidos = new Set(leads.map(l => l.id));
  const extras = idsImp.filter(id => !conhecidos.has(id));
  const leadsImp = extras.length ? await prisma.lead.findMany({ where: { id: { in: extras }, deleted_at: null }, select: { id: true, telefone: true, responsavel_telefone: true } }) : [];
  const todos = [...leads, ...leadsImp];
  if (!todos.length) return 0;

  const fins = [...new Set(todos.flatMap(l => finaisTelefone(l.telefone, l.responsavel_telefone)))];
  const OR: any[] = [{ lead_id: { in: todos.map(l => l.id) } }];
  for (let i = 0; i < fins.length; i += 200) OR.push(...fins.slice(i, i + 200).map(f => ({ contato_numero: { endsWith: f } })));
  const conversas = await prisma.whatsappConversa.findMany({
    where: { estagio_funil: { not: 'FECHADO' }, OR },
    select: { id: true, cadencia_proxima_etapa: true },
  });
  if (!conversas.length) return 0;
  const r = await prisma.whatsappConversa.updateMany({
    where: { id: { in: conversas.map(c => c.id) } },
    data: { estagio_funil: 'FECHADO', cadencia_proxima_etapa: null, cadencia_proximo_envio: null, cadencia_pausada: false },
  });
  return r.count;
}
