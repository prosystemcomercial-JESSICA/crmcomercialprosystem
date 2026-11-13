import type { PrismaClient } from '@prisma/client';
import { canalDoLead, campanhaDoLead, ultimos8 } from '@/lib/funil-origem';
import {
  contar, funil, porCanal, porAgente, porVendedora, porSemana, motivosDePerda, oQueMelhorar, resumoParaVitoria, pct,
  type LeadMedido,
} from '@/lib/painel-leads';
import { NOTA_INTERESSE } from '@/lib/placar-comercial';

/**
 * Painel de Leads da Laya (pedido da Jessica, 13/11/2026). Só leitura.
 * - A Laya mede: canal, funil, conversão, tempo até o primeiro contato, perdas e "o que melhorar" (regras).
 * - O Rafael explica o porquê do gargalo lendo as conversas (sexta 15h ou no botão), guardado em
 *   ConfiguracaoIntegracao `painel_leads.porque`.
 * - A Vitória recebe o resumo na reunião de segunda (diretoria.service).
 * Ligação lead → proposta pelo telefone (últimos 8 dígitos), como no funil por origem.
 */

const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
const QUENTES = ['QUENTE', 'MUITO_QUENTE'];
const AVANCOU = ['QUALIFICADO', 'EM_NEGOCIACAO', 'PROPOSTA_A_GERAR', 'PROPOSTA_ENVIADA', 'AGUARDANDO_RETORNO', 'FECHADO'];
export const CHAVE_PORQUE = 'painel_leads.porque';

type Lido = LeadMedido & { id: string; conversas: string[] };

/** Lê os leads criados entre `de` e `ate` com tudo o que o funil precisa. */
async function medirLeads(prisma: PrismaClient, de: Date, ate: Date): Promise<Lido[]> {
  const leads = await prisma.lead.findMany({
    where: { created_at: { gte: de, lt: ate }, deleted_at: null },
    select: { id: true, origem: true, utm_source: true, utm_campaign: true, campanha_nome: true, telefone: true, responsavel_telefone: true, created_at: true, etapa_comercial: true, status: true, temperatura: true },
  });
  if (!leads.length) return [];
  const ids = leads.map(l => l.id);
  const [sdrs, reunioes, propostas] = await Promise.all([
    prisma.sdrLead.findMany({ where: { lead_id: { in: ids } }, select: { lead_id: true, agente: true, primeiro_envio_em: true, abertura_enviada: true, ultima_lead_em: true, nota: true, temperatura: true, temperatura_confirmada: true, conversaId: true, created_at: true }, orderBy: { created_at: 'asc' } }),
    prisma.atividade.findMany({ where: { tipo: 'REUNIAO', status: { not: 'CANCELADA' }, created_at: { gte: de } }, select: { lead_id: true, whatsapp_conversa_id: true } }),
    prisma.propostaComercial.findMany({ where: { deleted_at: null, created_at: { gte: de }, NOT: { status: 'RASCUNHO' } }, select: { responsavel_telefone: true, created_at: true, status: true, data_aceite: true, valor_final: true } }),
  ]);
  const sdrDo = new Map<string, typeof sdrs>();
  for (const s of sdrs) if (s.lead_id) sdrDo.set(s.lead_id, [...(sdrDo.get(s.lead_id) || []), s]);
  const comReuniao = new Set([...reunioes.map(r => r.lead_id), ...reunioes.map(r => r.whatsapp_conversa_id)].filter(Boolean) as string[]);
  const propsDoFone = new Map<string, typeof propostas>();
  for (const p of propostas) { const f = ultimos8(p.responsavel_telefone); if (f.length === 8) propsDoFone.set(f, [...(propsDoFone.get(f) || []), p]); }

  return leads.map(l => {
    const dele = sdrDo.get(l.id) || [];
    const conversas = dele.map(s => s.conversaId).filter(Boolean) as string[];
    const fones = [...new Set([ultimos8(l.telefone), ultimos8(l.responsavel_telefone)].filter(f => f.length === 8))];
    const props = fones.flatMap(f => propsDoFone.get(f) || []).filter(p => p.created_at >= l.created_at);
    const fechadas = props.filter(p => FECHADA.includes(p.status) && p.data_aceite);
    const primeiro = dele.map(s => s.primeiro_envio_em).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] || null;
    const temp = dele.map(s => s.temperatura_confirmada || s.temperatura).find(Boolean) || l.temperatura || null;
    const etapa = String(l.etapa_comercial || '');
    const demo = comReuniao.has(l.id) || conversas.some(c => comReuniao.has(c));
    const respondeu = dele.some(s => s.ultima_lead_em) || AVANCOU.includes(etapa);
    return {
      id: l.id, conversas,
      canal: canalDoLead(l), campanha: campanhaDoLead(l), criado: l.created_at,
      contatado: !!primeiro || dele.some(s => s.abertura_enviada) || (etapa !== '' && etapa !== 'NOVO_LEAD'),
      respondeu,
      interessado: dele.some(s => (s.nota ?? 0) >= NOTA_INTERESSE) || QUENTES.includes(String(temp)) || ['QUALIFICADO', 'EM_NEGOCIACAO', 'PROPOSTA_A_GERAR', 'PROPOSTA_ENVIADA', 'FECHADO'].includes(etapa),
      demo, proposta: props.length > 0 || ['PROPOSTA_ENVIADA', 'EM_NEGOCIACAO'].includes(etapa),
      contrato: fechadas.length > 0, valor: fechadas.reduce((s, p) => s + (p.valor_final || 0), 0),
      perdido: etapa === 'PERDIDO' || l.status === 'PERDIDO',
      agente: dele[0]?.agente || null,
      horas_ate_contato: primeiro ? Math.round(((primeiro.getTime() - l.created_at.getTime()) / 3600e3) * 10) / 10 : null,
      temperatura: temp,
    };
  });
}

const cache = new Map<number, { em: number; dados: any }>();

/** Tudo o que o Painel de Leads mostra, para os últimos `dias` contra os `dias` anteriores. */
export async function painelLeads(prisma: PrismaClient, dias = 30, agora = new Date()) {
  const c = cache.get(dias);
  if (c && Date.now() - c.em < 60_000) return c.dados;
  const ms = dias * 864e5;
  const ini = new Date(agora.getTime() - ms), iniAnt = new Date(agora.getTime() - 2 * ms);
  const [leads, anteriores, perdidos, propostas, porque] = await Promise.all([
    medirLeads(prisma, ini, agora),
    medirLeads(prisma, iniAnt, ini),
    prisma.lead.findMany({ where: { deleted_at: null, updated_at: { gte: ini }, OR: [{ etapa_comercial: 'PERDIDO' }, { status: 'PERDIDO' }] }, select: { motivo_perda: true } }),
    prisma.propostaComercial.findMany({ where: { deleted_at: null, created_at: { gte: ini }, NOT: { status: 'RASCUNHO' } }, select: { vendedor_nome: true, created_by_name: true, status: true, data_aceite: true, valor_final: true } }),
    lerPorque(prisma),
  ]);
  const atual = contar(leads, agora), anterior = contar(anteriores, ini);
  const canais = porCanal(leads, agora);
  const perdas = motivosDePerda(perdidos.map(p => p.motivo_perda));
  const melhorias = oQueMelhorar({ atual, anterior, canais, perdas, dias });
  const ativos = leads.filter(l => !l.perdido && !l.contrato);
  const temperatura = ['MUITO_QUENTE', 'QUENTE', 'MORNO', 'FRIO'].map(t => ({ temperatura: t, n: ativos.filter(l => String(l.temperatura || 'FRIO') === t).length }));
  const horas = leads.map(l => l.horas_ate_contato).filter((h): h is number => h !== null && h >= 0).sort((a, b) => a - b);
  const dados = {
    dias, desde: ini.toISOString(), gerado_em: agora.toISOString(),
    atual, anterior,
    taxas: {
      resposta: pct(atual.responderam, atual.contatados), conversao: pct(atual.contratos, atual.chegaram),
      conversao_anterior: pct(anterior.contratos, anterior.chegaram), interesse_para_demo: pct(atual.demonstracoes, atual.interessados),
      proposta_para_contrato: pct(atual.contratos, atual.propostas),
      horas_ate_contato: horas.length ? horas[Math.floor(horas.length / 2)] : null,
    },
    funil: funil(atual), canais, agentes: porAgente(leads, agora),
    vendedoras: porVendedora(propostas.map(p => ({ vendedor: p.vendedor_nome || p.created_by_name, fechada: FECHADA.includes(p.status) && !!p.data_aceite, valor: p.valor_final || 0 }))),
    semanas: porSemana(leads, agora), perdas, temperatura, melhorias, porque,
  };
  cache.set(dias, { em: Date.now(), dados });
  return dados;
}

// ───────────── O porquê, pelo Rafael ─────────────

export type Porque = { em: string; canal: string; etapa: string; resumo: string; causas: string[]; acoes: { quem: string; o_que: string }[]; conversas_lidas: number };

export async function lerPorque(prisma: PrismaClient): Promise<Porque | null> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_PORQUE } }).catch(() => null);
  try { return r?.valor ? JSON.parse(r.valor) : null; } catch { return null; }
}

/** Esconde telefone, e-mail e documentos antes de mandar o texto para a IA. */
const semDados = (t: string) => t.replace(/\S+@\S+/g, '[e-mail]').replace(/\d[\d\s().-]{7,}\d/g, '[número]');

/**
 * O Rafael lê até 10 conversas do canal com o maior gargalo (leads que responderam e não chegaram à demonstração)
 * e escreve por que não avançam e o que cada um deve fazer. Uma chamada de IA; guarda o resultado.
 */
export async function rafaelExplicaGargalo(prisma: PrismaClient, agora = new Date(), dias = 30): Promise<Porque> {
  const leads = await medirLeads(prisma, new Date(agora.getTime() - dias * 864e5), agora);
  const canais = porCanal(leads, agora).filter(c => c.responderam > 0);
  // O canal que mais perde gente entre "respondeu" e "demonstração".
  const alvo = [...canais].sort((a, b) => (b.responderam - b.demonstracoes) - (a.responderam - a.demonstracoes))[0];
  if (!alvo) throw new Error('ainda não há conversas suficientes para analisar');
  const travados = leads.filter(l => l.canal === alvo.canal && l.respondeu && !l.demo && !l.contrato && l.conversas.length)
    .sort((a, b) => Number(b.interessado) - Number(a.interessado) || b.criado.getTime() - a.criado.getTime()).slice(0, 10);
  const blocos: string[] = [];
  for (const [i, l] of travados.entries()) {
    const msgs = await prisma.whatsappMensagem.findMany({ where: { conversaId: { in: l.conversas } }, orderBy: { created_at: 'desc' }, take: 16, select: { direcao: true, conteudo: true, transcricao: true, created_at: true } });
    if (!msgs.length) continue;
    const linhas = msgs.reverse().map(m => `${m.direcao === 'ENTRADA' ? 'Cliente' : 'Prosystem'}: ${semDados(String(m.transcricao || m.conteudo || '')).slice(0, 300)}`);
    blocos.push(`--- Conversa ${i + 1} (${l.interessado ? 'mostrou interesse' : 'respondeu'}; temperatura ${l.temperatura || '?'}) ---\n${linhas.join('\n')}`);
  }
  if (!blocos.length) throw new Error('as conversas desse canal estão vazias');
  const { chamarGemini } = await import('./ia-gemini.service');
  const { lerJsonIa } = await import('@/lib/assistente/ia-texto');
  const sistema = 'Você é o Rafael, especialista em vendas de software da Prosystem (ERP e PDV para farmácias, drogarias, manipulação e padarias). '
    + 'Analisa conversas reais de WhatsApp entre os agentes da Prosystem e os leads para explicar à gestão por que os leads não avançam até a demonstração. '
    + 'Seja concreto, cite o padrão que se repete e dê ações práticas. Português do Brasil, sem jargão. Nunca cite telefone, CPF ou e-mail.';
  const pergunta = [
    `Canal: ${alvo.canal}. Nos últimos ${dias} dias: ${alvo.chegaram} leads, ${alvo.contatados} receberam contato, ${alvo.responderam} responderam, ${alvo.interessados} interessados, ${alvo.demonstracoes} demonstrações, ${alvo.contratos} contratos.`,
    `Abaixo, ${blocos.length} conversas de leads que responderam e NÃO chegaram à demonstração.`,
    'Responda só em JSON: {"resumo": "2 a 4 frases: por que esses leads não avançam", "causas": ["3 a 5 causas que se repetem, cada uma com o exemplo visto"], "acoes": [{"quem": "Caroline | Julio | Luiz Felipe | Heitor | vendedoras | Jessica", "o_que": "ação concreta"}]}',
    ...blocos,
  ].join('\n\n');
  const r = lerJsonIa<any>(await chamarGemini(prisma, { sistema, partes: [{ text: pergunta.slice(0, 60_000) }], json: true, temperatura: 0.3, timeoutMs: 150_000, agente: 'rafael' }));
  if (!r?.resumo) throw new Error('o Rafael não conseguiu fechar a análise desta vez');
  const porque: Porque = {
    em: agora.toISOString(), canal: alvo.canal, etapa: 'Respondeu → Demonstração', resumo: String(r.resumo).slice(0, 1200),
    causas: (Array.isArray(r.causas) ? r.causas : []).map((c: any) => String(c).slice(0, 400)).slice(0, 6),
    acoes: (Array.isArray(r.acoes) ? r.acoes : []).filter((a: any) => a?.o_que).map((a: any) => ({ quem: String(a.quem || 'equipe').slice(0, 60), o_que: String(a.o_que).slice(0, 400) })).slice(0, 8),
    conversas_lidas: blocos.length,
  };
  const valor = JSON.stringify(porque);
  await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE_PORQUE }, create: { chave: CHAVE_PORQUE, valor, updated_by: 'rafael' }, update: { valor } });
  cache.clear();
  try {
    const { registrarAcaoAgente } = await import('@/lib/assistente/escritorio');
    registrarAcaoAgente('rafael', `leu ${blocos.length} conversas e explicou por que ${alvo.canal} não chega à demonstração`);
  } catch { /* só o quadro do Escritório */ }
  return porque;
}

/** Texto curto para a reunião de segunda da Vitória. */
export async function resumoPainelParaVitoria(prisma: PrismaClient, agora = new Date()): Promise<string> {
  const d = await painelLeads(prisma, 30, agora);
  return resumoParaVitoria({ dias: d.dias, atual: d.atual, anterior: d.anterior, canais: d.canais, melhorias: d.melhorias, porque: d.porque ? { resumo: d.porque.resumo, acoes: d.porque.acoes.map((a: any) => `${a.quem}: ${a.o_que}`) } : null });
}
