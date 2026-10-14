import type { PrismaClient } from '@prisma/client';
import { METAS_PADRAO, semanaDe, inicioDoDia, esquecidoSemDemo, NOTA_INTERESSE, type MetaSemana } from '@/lib/placar-comercial';

// Parte 2 do Plano de Expansão (pedido da Jessica, 14/10/2026): nenhum interessado esquecido, placar do dia e da
// semana contra a meta do plano, e proposta parada em rascunho vira aviso. Só leitura; nada é enviado ao lead.

const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const ATIVOS_SDR = ['AGUARDANDO', 'CONVERSANDO'];
export const CHAVE_METAS = 'comercial.metas_semana';

async function metas(prisma: PrismaClient): Promise<Record<string, MetaSemana>> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_METAS } }).catch(() => null);
  try { return { ...METAS_PADRAO, ...(r?.valor ? JSON.parse(r.valor) : {}) }; } catch { return METAS_PADRAO; }
}

async function contar(prisma: PrismaClient, ini: Date, fim: Date) {
  const no = { gte: ini, lt: fim };
  const [primeiros_contatos, respostas, interessados, demonstracoes, propostas, contratos, ativos] = await Promise.all([
    prisma.sdrLead.count({ where: { primeiro_envio_em: no } }),
    prisma.sdrLead.count({ where: { ultima_lead_em: no } }),
    prisma.sdrLead.count({ where: { nota: { gte: NOTA_INTERESSE }, updated_at: no } }),
    prisma.atividade.count({ where: { tipo: 'REUNIAO', created_at: no, status: { not: 'CANCELADA' }, OR: [{ vinculo_tipo: 'LEAD' }, { vinculo_tipo: null }] } }),
    prisma.propostaComercial.count({ where: { deleted_at: null, OR: [{ wpp_enviada_em: no }, { created_at: no, status: { not: 'RASCUNHO' } }] } }),
    prisma.propostaComercial.count({ where: { deleted_at: null, status: { in: FECHADA }, data_aceite: no } }),
    // Programa de Ativos (parte 3, 14/10/2026): clientes da base contatados.
    prisma.contatoAtivo.count({ where: { contatado_em: no } }),
  ]);
  return { primeiros_contatos, respostas, interessados, demonstracoes, propostas, contratos, ativos };
}

/** Leads com interesse (termômetro 35+) há mais de 48 h, ainda conversando, sem demonstração marcada. */
export async function interessadosSemDemo(prisma: PrismaClient, agora = new Date()) {
  const ss = await prisma.sdrLead.findMany({
    where: { status: { in: ATIVOS_SDR }, nota: { gte: NOTA_INTERESSE }, conversaId: { not: null }, updated_at: { gte: new Date(agora.getTime() - 30 * 864e5) } },
    orderBy: { nota: 'desc' }, take: 60,
    select: { id: true, agente: true, nome: true, empresa: true, nota: true, conversaId: true, lead_id: true, dados: true, ultima_lead_em: true },
  });
  const comDemo = new Set((await prisma.atividade.findMany({
    where: { tipo: 'REUNIAO', status: { not: 'CANCELADA' }, OR: [{ whatsapp_conversa_id: { in: ss.map(s => s.conversaId!) } }, { lead_id: { in: ss.map(s => s.lead_id).filter(Boolean) as string[] } }] },
    select: { whatsapp_conversa_id: true, lead_id: true },
  })).flatMap(a => [a.whatsapp_conversa_id, a.lead_id]).filter(Boolean));
  return ss.filter(s => !comDemo.has(s.conversaId) && !(s.lead_id && comDemo.has(s.lead_id)) && esquecidoSemDemo((s.dados as any)?.interessado_em, agora))
    .map(s => ({ id: s.id, agente: s.agente, nome: s.nome, empresa: s.empresa, nota: s.nota, conversaId: s.conversaId, desde: (s.dados as any)?.interessado_em || null, ultima_resposta: s.ultima_lead_em }));
}

/** Propostas em rascunho há mais de 1 dia (últimos 30 dias). `donoId` filtra as de quem criou/vende. */
export async function propostasEmRascunho(prisma: PrismaClient, agora = new Date(), donoId?: string | null) {
  return prisma.propostaComercial.findMany({
    where: {
      status: 'RASCUNHO', deleted_at: null, created_at: { lt: new Date(agora.getTime() - 864e5), gte: new Date(agora.getTime() - 30 * 864e5) },
      ...(donoId ? { OR: [{ created_by: donoId }, { vendedor_id: donoId }] } : {}),
    },
    orderBy: { created_at: 'asc' }, take: 30,
    select: { id: true, razao_social: true, nome_fantasia: true, created_by_name: true, vendedor_nome: true, created_at: true, mensalidade_plus: true, mensalidade_pro: true },
  });
}

/** Placar do dia e da semana contra a meta, mais o que está parado. */
export async function placarComercial(prisma: PrismaClient, agora = new Date()) {
  const sem = semanaDe(agora);
  const { metaDiaAtivos } = await import('./ativos-fila.service');
  const [hoje, semana, todasMetas, interessados, rascunhos, metaAtivosDia] = await Promise.all([
    contar(prisma, inicioDoDia(agora), new Date(inicioDoDia(agora).getTime() + 864e5)),
    contar(prisma, sem.inicio, sem.fim),
    metas(prisma),
    interessadosSemDemo(prisma, agora),
    propostasEmRascunho(prisma, agora),
    metaDiaAtivos(prisma).catch(() => 0),
  ]);
  return { gerado_em: agora.toISOString(), semana_de: sem.chave, hoje, semana, meta_semana: todasMetas[sem.chave] ? { ...todasMetas[sem.chave], ativos: metaAtivosDia * 5 } : null, meta_ativos_dia: metaAtivosDia, interessados_sem_demo: interessados, propostas_rascunho: rascunhos };
}

/** Resumo do dia no WhatsApp da gestão (dias úteis, de manhã): só manda se houver algo parado. */
export async function avisoDiarioParte2(prisma: PrismaClient, agora = new Date()) {
  const p = await placarComercial(prisma, agora);
  if (!p.interessados_sem_demo.length && !p.propostas_rascunho.length) return false;
  const base = (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com';
  const m = p.meta_semana;
  const linhas = [
    '📋 *Do interesse à demonstração: o que está parado hoje*',
    m ? `Semana: ${p.semana.demonstracoes}/${m.demonstracoes} demonstrações · ${p.semana.propostas}/${m.propostas} propostas · ${p.semana.contratos}/${m.contratos} contratos` : '',
    p.interessados_sem_demo.length ? `\n🔥 *${p.interessados_sem_demo.length} interessado(s) sem demonstração há mais de 48 h:*` : '',
    ...p.interessados_sem_demo.slice(0, 6).map(s => `• ${s.nome || 'lead'}${s.empresa ? ` (${s.empresa})` : ''}, termômetro ${s.nota}: ${base}/whatsapp?conversa=${s.conversaId}`),
    p.propostas_rascunho.length ? `\n📝 *${p.propostas_rascunho.length} proposta(s) em rascunho há mais de 1 dia:*` : '',
    ...p.propostas_rascunho.slice(0, 6).map(x => `• ${x.nome_fantasia || x.razao_social}${x.created_by_name ? ` · ${x.created_by_name}` : ''}`),
    p.propostas_rascunho.length ? `Enviar em: ${base}/propostas-comerciais` : '',
    `\nPlacar completo no Escritório virtual.`,
  ].filter(Boolean);
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', linhas.join('\n'), { somenteAprovadora: true }).catch(() => {});
  return true;
}
