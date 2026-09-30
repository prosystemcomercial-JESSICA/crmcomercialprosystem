import type { PrismaClient } from '@prisma/client';

/**
 * Conversas que precisam de atenção (mesma regra da TV do Escritório):
 *  - esperando: o cliente escreveu e ninguém respondeu há 10+ min (ou o prazo de resposta venceu);
 *  - parado: a última mensagem foi nossa e o cliente não responde há 24h+ (janela de 7 dias),
 *    ou o agente marcou que ele parou de responder.
 */

const MIN_ESPERANDO = 10;
const HORAS_PARADO = 24;
const DIAS_JANELA = 7;
const ETIQUETAS_NAO_COMERCIAIS = ['Suporte', 'Financeiro'];

export type Atencao = { tipo: 'esperando' | 'parado'; desde: string };

export async function conversasEmAtencao(prisma: PrismaClient, escopo: Record<string, any> = {}, agora = new Date()): Promise<Map<string, Atencao>> {
  const janela = new Date(agora.getTime() - DIAS_JANELA * 864e5);
  const abertas = {
    finalizada_em: null, estagio_funil: { not: 'FECHADO' },
    OR: [{ etiqueta: null }, { etiqueta: { notIn: ETIQUETAS_NAO_COMERCIAIS } }],
    // Escopo da pessoa (dono/pool) e conversa da equipe fora — em AND para um OR não sobrescrever o outro.
    AND: [escopo, { OR: [{ tipo_contato: null }, { tipo_contato: { not: 'EQUIPE' } }] }] as any[],
  };
  const out = new Map<string, Atencao>();

  const limiteEsperando = new Date(agora.getTime() - MIN_ESPERANDO * 60000);
  const esperando = await prisma.whatsappConversa.findMany({
    where: { ...abertas, ultima_em: { gte: janela }, nao_lidas: { gt: 0 }, AND: [...abertas.AND, { OR: [{ ultima_em: { lt: limiteEsperando } }, { sla_prazo_em: { lt: agora } }] }] },
    select: { id: true, ultima_em: true }, take: 300,
  }).catch(() => []);
  for (const c of esperando) out.set(c.id, { tipo: 'esperando', desde: (c.ultima_em || agora).toISOString() });

  const limiteParado = new Date(agora.getTime() - HORAS_PARADO * 3600_000);
  const candidatas = await prisma.whatsappConversa.findMany({
    where: { ...abertas, nao_lidas: 0, bot_ativo: false, ultima_em: { gte: janela, lt: limiteParado } },
    select: { id: true, ultima_em: true }, orderBy: { ultima_em: 'desc' }, take: 200,
  }).catch(() => []);
  const ultimas = await Promise.all(candidatas.map(c => prisma.whatsappMensagem.findFirst({ where: { conversaId: c.id }, orderBy: { created_at: 'desc' }, select: { direcao: true } })));
  candidatas.forEach((c, i) => { if (ultimas[i]?.direcao === 'SAIDA' && !out.has(c.id)) out.set(c.id, { tipo: 'parado', desde: (c.ultima_em || agora).toISOString() }); });

  // Leads que o agente marcou como "parou de responder".
  const sdr = await prisma.sdrLead.findMany({ where: { status: 'AGUARDANDO', updated_at: { gte: janela }, conversaId: { not: null } }, select: { conversaId: true, dados: true }, take: 200 }).catch(() => []);
  const ids = sdr.filter(s => (s.dados as any)?.parou_em).map(s => s.conversaId!) ;
  if (ids.length) {
    const noEscopo = await prisma.whatsappConversa.findMany({ where: { ...abertas, id: { in: ids } }, select: { id: true } }).catch(() => []);
    const ok = new Set(noEscopo.map(c => c.id));
    for (const s of sdr) if (s.conversaId && ok.has(s.conversaId) && !out.has(s.conversaId)) out.set(s.conversaId, { tipo: 'parado', desde: String((s.dados as any).parou_em) });
  }
  return out;
}
