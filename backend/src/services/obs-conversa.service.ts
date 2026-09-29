import type { PrismaClient } from '@prisma/client';

// Registro automático do que foi conversado no WhatsApp nas OBSERVAÇÕES do lead.
// Quando a conversa de um lead fica 30 min parada e o cliente respondeu desde o último registro,
// a IA resume (quem é, o que foi falado, o que falta) e grava na timeline do lead.
// Assim qualquer pessoa ou agente que retomar já tem o contexto. Roda no agendador (10 em 10 min).

const PARADA_MIN = 30;           // conversa parada há pelo menos 30 min
const JANELA_H = 48;             // olha conversas movimentadas nas últimas 48 h
const POR_RODADA = 12;           // limite de resumos por rodada (custo de IA)
const chave = (conversaId: string) => `obs_wpp.${conversaId}`;

export async function registrarConversasNasObservacoes(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const convs = await prisma.whatsappConversa.findMany({
    where: {
      lead_id: { not: null },
      ultima_em: { gte: new Date(agora.getTime() - JANELA_H * 3600_000), lte: new Date(agora.getTime() - PARADA_MIN * 60_000) },
    },
    select: { id: true, lead_id: true, ultima_em: true, contato_nome: true },
    orderBy: { ultima_em: 'desc' },
    take: 200,
  });
  if (!convs.length) return 0;
  const marcas = new Map((await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: convs.map(c => chave(c.id)) } }, select: { chave: true, valor: true } }))
    .map(m => [m.chave, new Date(m.valor)]));
  const { resumirConversa } = await import('./assistente-ia.service');
  let n = 0;
  for (const c of convs) {
    if (n >= POR_RODADA) break;
    const desde = marcas.get(chave(c.id)) || new Date(0);
    if (c.ultima_em && c.ultima_em <= desde) continue;
    // Só registra quando houve retorno do cliente (positivo ou negativo) desde o último registro.
    const respostas = await prisma.whatsappMensagem.count({ where: { conversaId: c.id, direcao: 'ENTRADA', created_at: { gt: desde } } });
    if (!respostas) {
      await marcar(prisma, c.id, c.ultima_em || agora);
      continue;
    }
    try {
      const r = await resumirConversa(prisma, c.id);
      const linhas = [
        `💬 Conversa no WhatsApp${c.contato_nome ? ` com ${c.contato_nome}` : ''} (${fmt(c.ultima_em || agora)})`,
        r.quem ? `Quem: ${r.quem}` : null,
        r.falado ? `O que foi conversado: ${r.falado}` : null,
        r.falta ? `O que falta: ${r.falta}` : null,
        r.venda_adicional ? `Oportunidade: ${r.venda_adicional}` : null,
      ].filter(Boolean).join('\n');
      await prisma.leadObservacao.create({ data: { lead_id: c.lead_id!, tipo: 'WHATSAPP', descricao: linhas, created_by: 'bot', created_by_name: 'Registro automático (WhatsApp)' } });
      await prisma.lead.update({ where: { id: c.lead_id! }, data: { ultima_obs_at: agora } }).catch(() => {});
      await marcar(prisma, c.id, c.ultima_em || agora);
      n++;
    } catch (e: any) {
      console.warn('[OBS-WPP]', c.id, e?.message);
    }
  }
  return n;
}

async function marcar(prisma: PrismaClient, conversaId: string, em: Date) {
  const k = chave(conversaId);
  await prisma.configuracaoIntegracao.upsert({ where: { chave: k }, create: { chave: k, valor: em.toISOString(), updated_by: 'sistema' }, update: { valor: em.toISOString() } }).catch(() => {});
}

const fmt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
