// Rodízio de números na prospecção (pedido da Jessica, 07/10/2026): os primeiros contatos dos
// agentes (Caroline, Julio, Luiz Felipe, Heitor) se dividem entre os números extras ligados no
// rodízio, cada um com o próprio limite do dia (aquecimento). Sem número extra disponível, segue
// o número principal com o limite de sempre. O contato fica preso ao número que o chamou.
import { PrismaClient } from '@prisma/client';
import { limiteDoDia } from '@/lib/whatsapp-vagas';
import { limparCacheInstancias } from './whatsapp-roteador.service';

export type NumeroRodizio = { id: string; instancia_nome: string; instance_token: string; usados: number; limite: number };

/** O que tem mais folga (proporcional ao limite); empate → o que usou menos. Sem folga → null. */
export function escolherNumero(candidatos: NumeroRodizio[]): NumeroRodizio | null {
  const livres = candidatos.filter(c => c.usados < c.limite);
  if (!livres.length) return null;
  return livres.sort((a, b) => a.usados / a.limite - b.usados / b.limite || a.usados - b.usados)[0];
}

/** Primeiros contatos de hoje por número (agentes), pelo número da conversa. */
export async function feitosHojePorNumero(prisma: PrismaClient, desde: Date): Promise<Map<string, number>> {
  const sdr = await prisma.sdrLead.findMany({ where: { primeiro_envio_em: { gte: desde }, conversaId: { not: null } }, select: { conversaId: true } });
  const convs = sdr.length ? await prisma.whatsappConversa.findMany({ where: { id: { in: sdr.map(s => s.conversaId!) } }, select: { instanciaId: true } }) : [];
  const m = new Map<string, number>();
  for (const c of convs) m.set(c.instanciaId, (m.get(c.instanciaId) || 0) + 1);
  return m;
}

export async function escolherNumeroProspeccao(prisma: PrismaClient, desde: Date, agora = new Date()): Promise<NumeroRodizio | null> {
  const insts = await prisma.whatsappInstancia.findMany({
    where: { rodizio: true, status: 'CONECTADO', pausada_motivo: null, instance_token: { not: null } },
    select: { id: true, instancia_nome: true, instance_token: true, limite_dia: true, aquecimento_desde: true },
  });
  if (!insts.length) return null;
  const feitos = await feitosHojePorNumero(prisma, desde);
  return escolherNumero(insts.map(i => ({
    id: i.id, instancia_nome: i.instancia_nome, instance_token: i.instance_token!,
    usados: feitos.get(i.id) || 0, limite: limiteDoDia(i.aquecimento_desde, i.limite_dia, agora),
  })));
}

/**
 * Leva a conversa (ainda sem nenhuma mensagem) para o número do rodízio antes do primeiro contato.
 * Conversa com mensagens, contato que já fala com outro número ou conflito no destino: não move.
 */
export async function moverConversaParaNumero(prisma: PrismaClient, conversaId: string, instanciaId: string): Promise<boolean> {
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { instanciaId: true, contato_numero: true, _count: { select: { mensagens: true } } } });
  if (!conv) return false;
  if (conv.instanciaId === instanciaId) return true;
  if (conv._count.mensagens > 0) return false;
  const fim8 = conv.contato_numero.replace(/\D/g, '').slice(-8);
  const jaFala = await prisma.whatsappConversa.findFirst({ where: { id: { not: conversaId }, contato_numero: { endsWith: fim8 }, mensagens: { some: {} } }, select: { id: true } });
  if (jaFala) return false;
  const noDestino = await prisma.whatsappConversa.findFirst({ where: { instanciaId, contato_numero: conv.contato_numero }, select: { id: true } });
  if (noDestino) return false;
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { instanciaId } });
  return true;
}

// Falhas seguidas por número: cada uma avisa a gestão com o motivo (no máximo 1 aviso a cada 30 min por número);
// na 3ª o número sai do rodízio e o aviso traz os 3 motivos (pedido da Jessica, 14/10/2026).
const falhas = new Map<string, { n: number; motivos: string[] }>();
const ultimoAviso = new Map<string, number>();
export async function registrarResultadoRodizio(prisma: PrismaClient, n: NumeroRodizio, ok: boolean, motivo?: string | null, contato?: string | null) {
  if (ok) { falhas.delete(n.id); return; }
  const atual = falhas.get(n.id) || { n: 0, motivos: [] };
  const f = { n: atual.n + 1, motivos: [...atual.motivos, `${contato || 'contato'}: ${motivo || 'motivo não informado'}`].slice(-3) };
  falhas.set(n.id, f);
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  if (f.n < 3) {
    if (Date.now() - (ultimoAviso.get(n.id) || 0) < 30 * 60_000) return;
    ultimoAviso.set(n.id, Date.now());
    await enviarAvisoGestao(prisma, 'lead_qualificado', `⚠️ *Falha no número "${n.instancia_nome}"* (${f.n} de 3 antes de sair do rodízio).\nMotivo: ${f.motivos[f.motivos.length - 1]}`).catch(() => {});
    return;
  }
  falhas.delete(n.id);
  await prisma.whatsappInstancia.update({ where: { id: n.id }, data: { pausada_motivo: `3 falhas seguidas. Última: ${f.motivos[f.motivos.length - 1]}`.slice(0, 190), rodizio: false } }).catch(() => {});
  limparCacheInstancias();
  await enviarAvisoGestao(prisma, 'lead_qualificado', `⚠️ *O número "${n.instancia_nome}" saiu do rodízio da prospecção*: 3 falhas seguidas.\n${f.motivos.map(x => `• ${x}`).join('\n')}\nResolva o motivo e religue o rodízio em Configurações > Números de WhatsApp.`).catch(() => {});
}
