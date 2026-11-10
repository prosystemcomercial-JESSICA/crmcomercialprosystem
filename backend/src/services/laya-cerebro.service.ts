import type { PrismaClient } from '@prisma/client';
import { PERGUNTAS_LAYA, PERGUNTA_ASSUNTO_DUVIDA, lerEscolhaTriagem } from '../lib/laya';
import { historicoAcertos, nivelTarefa, TAREFAS_LAYA, type TarefaLaya } from '../lib/laya-caderno';
import { registrarAcaoAgente } from '../lib/assistente/escritorio';
import { registrarUsoIa } from './uso-ia.service';

/**
 * A LAYA COMO CÉREBRO.
 * 1) Aprende com cada decisão (equipe e agentes), não só quando alguém clica em confirmar:
 *    cada decisão vira uma comparação com o palpite que ela já tinha dado.
 * 2) Decide a rota antes da IA externa: suporte/financeiro não precisam de IA para escrever.
 * 3) Só assume uma tarefa quando atinge o nível Assistente (≥80% em 30 comparações);
 *    até lá trabalha em paralelo e a IA externa decide.
 */

const LAYA_URL = process.env.LAYA_URL || 'http://127.0.0.1:8765';
const CONFIANCA_ROTA = 0.75;

let cacheNiveis: { em: number; niveis: Record<TarefaLaya, ReturnType<typeof nivelTarefa>> } | null = null;
export function esquecerNiveisLaya() { cacheNiveis = null; }

/** Nível atual de cada tarefa da Laya (cache de 2 min). */
export async function niveisLaya(prisma: PrismaClient) {
  if (cacheNiveis && Date.now() - cacheNiveis.em < 120_000) return cacheNiveis.niveis;
  const xs = await prisma.iaAmostra.findMany({ select: { texto: true, rotulos: true, sugestao: true, criado_por: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 3000 }).catch(() => []);
  const niveis = Object.fromEntries(TAREFAS_LAYA.map(t => [t, nivelTarefa(historicoAcertos(xs as any, t))])) as Record<TarefaLaya, ReturnType<typeof nivelTarefa>>;
  cacheNiveis = { em: Date.now(), niveis };
  return niveis;
}

/** A Laya já pode decidir sozinha nesta tarefa? (Assistente ou Titular) */
export async function layaCompetente(prisma: PrismaClient, t: TarefaLaya): Promise<boolean> {
  return (await niveisLaya(prisma))[t].nivel !== 'aprendiz';
}

/**
 * Aprende com uma decisão real (da equipe ou de um agente): grava a comparação entre o que
 * aconteceu e o palpite que a Laya já tinha dado nesta conversa. Uma por conversa a cada 12 h.
 */
export async function aprenderComDecisao(prisma: PrismaClient, conversaId: string, rotulos: { segmento?: string; intencao?: string; cancelar?: boolean; temperatura?: string }, fonte: string) {
  try {
    const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { ia_sugestao: true, ia_sugerido_em: true } });
    const s: any = c?.ia_sugestao;
    if (!s || !c?.ia_sugerido_em || Date.now() - c.ia_sugerido_em.getTime() > 24 * 3600_000) return false; // sem palpite recente, não há o que comparar
    const { podeEnviarUmaVez } = await import('./envio-unico.service');
    if (!(await podeEnviarUmaVez(prisma, `laya.aprende.${conversaId}.${fonte}`, 12))) return false;
    const { textoParaIa, esquecerCacheLaya } = await import('./laya.service');
    const texto = await textoParaIa(prisma, conversaId);
    if (!texto.includes('Cliente:')) return false;
    await prisma.iaAmostra.create({ data: { conversaId, texto, rotulos: { ...rotulos, fonte }, sugestao: s, criado_por: `auto:${fonte}` } });
    esquecerCacheLaya(); esquecerNiveisLaya();
    return true;
  } catch { return false; }
}

/** Intenção da última conversa, na hora (até 15 s). null = sem certeza suficiente ou Laya fora do ar. */
export async function intencaoAgora(prisma: PrismaClient, conversaId: string): Promise<string | null> {
  try {
    const { textoParaIa } = await import('./laya.service');
    const estado = await textoParaIa(prisma, conversaId);
    if (!estado.includes('Cliente:')) return null;
    registrarUsoIa('laya');
    const res = await fetch(`${LAYA_URL}/v1/systemone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: estado, questions: { q: PERGUNTAS_LAYA.intencao }, model: 'multilingual' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return lerEscolhaTriagem(await res.json(), CONFIANCA_ROTA);
  } catch { return null; }
}

/**
 * Rota decidida pela Laya antes de chamar a IA externa (só com nível Assistente em "intenção").
 * Devolve 'suporte' | 'financeiro' quando o assunto não é comercial; null = segue com a IA.
 */
export async function rotaDaLaya(prisma: PrismaClient, conversaId: string): Promise<'suporte' | 'financeiro' | null> {
  if (!(await layaCompetente(prisma, 'intencao'))) return null;
  const i = await intencaoAgora(prisma, conversaId);
  return i === 'suporte' || i === 'financeiro' ? i : null;
}

/**
 * Assunto da última mensagem, antes do tira-dúvidas (até 15 s, confiança 0,8).
 * null = dúvida sobre o sistema, sem certeza ou Laya fora do ar: segue com a IA, como antes.
 */
export async function assuntoDaDuvida(texto: string): Promise<string | null> {
  try {
    registrarUsoIa('laya');
    const res = await fetch(`${LAYA_URL}/v1/systemone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: `Cliente: ${texto.slice(0, 500)}`, questions: { q: PERGUNTA_ASSUNTO_DUVIDA }, model: 'multilingual' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return lerEscolhaTriagem(await res.json(), 0.8);
  } catch { return null; }
}

/** Contador de chamadas à IA externa que a Laya evitou. */
export function layaEvitouIa(agente: string, motivo: string) {
  registrarUsoIa('evitada');
  registrarAcaoAgente('laya', `decidiu sozinha (${motivo}) e poupou a IA externa na conversa do ${agente}`);
}

// ── Laya guardiã (10/11/2026) ───────────────────────────────────────────────────
// A Laya passa a participar de cada conversa dos SDRs: diz se quem respondeu é robô, confere cada
// mensagem antes de sair (regras puras + nota contra as lições do Rafael) e responde ao Rafael o que
// a Jessica já respondeu. Nenhuma dessas conferências trava a conversa se a IA falhar: na dúvida, passa.

const LAYA_SISTEMA = 'Você é a Laya, revisora de qualidade do time comercial da Prosystem (ERP/PDV para farmácias e padarias). Seja objetiva. Responda SOMENTE JSON.';
const cacheRobo = new Map<string, boolean>();

/** Porteira de robô: quando as regras não pegam, a IA decide se a mensagem é automática (saudação, menu, horário). */
export async function layaEhRobo(prisma: PrismaClient, textos: string[]): Promise<boolean> {
  const t = textos.map(x => x.trim()).filter(Boolean).join('\n').slice(0, 1200);
  if (t.length < 15) return false;
  const guardado = cacheRobo.get(t);
  if (guardado !== undefined) return guardado;
  try {
    const { chamarGemini } = await import('./ia-gemini.service');
    const { lerJsonIa } = await import('../lib/assistente/ia-texto');
    const r = lerJsonIa<{ robo?: boolean }>(await chamarGemini(prisma, {
      sistema: LAYA_SISTEMA,
      partes: [{ text: `Nossa equipe chamou uma loja no WhatsApp e chegou isto. É RESPOSTA AUTOMÁTICA (robô, menu numerado, saudação padrão da loja, horário de funcionamento, "em breve atenderemos", texto institucional, mensagem de outra empresa que não é a loja) ou uma PESSOA escrevendo de verdade? {"robo": true|false, "motivo": "curto"}\n\n"""${t}"""` }],
      json: true, temperatura: 0, timeoutMs: 30_000, simples: true, agente: 'laya',
    }));
    const robo = r?.robo === true;
    if (cacheRobo.size > 500) cacheRobo.clear();
    cacheRobo.set(t, robo);
    if (robo) registrarAcaoAgente('laya', 'identificou uma resposta automática de loja e segurou o agente');
    return robo;
  } catch { return false; }
}

export type ConferenciaLaya = { ok: true } | { ok: false; motivo: string };

/**
 * Conferência de saída: regras puras (link, corte, repetição, excesso) e, passando nelas, uma nota de 0 a 10
 * contra as lições recentes do Rafael para este agente e para a equipe. Nota abaixo de 6 = não sai assim.
 */
export async function layaConfereSaida(prisma: PrismaClient, p: { agente: string; conversaId: string; mensagens: string[]; ultimasDoAgente: string[]; fase: string }): Promise<ConferenciaLaya> {
  const { conferirPura } = await import('../lib/laya-guardia');
  const puros = conferirPura({ mensagens: p.mensagens, ultimas: p.ultimasDoAgente });
  if (puros.length) return { ok: false, motivo: puros.join('; ') };
  try {
    const desde = new Date(Date.now() - 14 * 864e5);
    const [licoes, daConversa, historico] = await Promise.all([
      prisma.agenteNota.findMany({ where: { tipo: 'ORIENTACAO', para: { in: [p.agente, 'equipe'] }, created_at: { gte: desde } }, orderBy: { created_at: 'desc' }, take: 10, select: { texto: true } }),
      prisma.agenteNota.findMany({ where: { tipo: 'ORIENTACAO', ref: p.conversaId, resolvida_em: null }, orderBy: { created_at: 'desc' }, take: 3, select: { texto: true } }),
      prisma.whatsappMensagem.findMany({ where: { conversaId: p.conversaId }, orderBy: { created_at: 'desc' }, take: 8, select: { direcao: true, conteudo: true, transcricao: true, tipo: true } }),
    ]);
    if (!licoes.length && !daConversa.length) return { ok: true };
    const conversa = historico.reverse().map(m => `${m.direcao === 'ENTRADA' ? 'Cliente' : 'Agente'}: ${((m.tipo === 'AUDIO' ? m.transcricao : m.conteudo) || `[${String(m.tipo).toLowerCase()}]`).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    const { chamarGemini } = await import('./ia-gemini.service');
    const { lerJsonIa } = await import('../lib/assistente/ia-texto');
    const r = lerJsonIa<{ nota?: number; problema?: string }>(await chamarGemini(prisma, {
      sistema: LAYA_SISTEMA,
      partes: [{ text: [
        `Dê uma nota de 0 a 10 para a PRÓXIMA MENSAGEM do agente nesta conversa de WhatsApp (fase: ${p.fase}). Critérios, do mais grave ao menos: 1) responde ao que a pessoa acabou de dizer e cumpre o que foi combinado (ex.: falar com outra pessoa, retornar numa data); 2) não insiste depois de objeção ou pedido de tempo; 3) não afirma recurso, preço ou prazo que não esteja no material; 4) curta, natural, termina com uma pergunta fácil ou um próximo passo; 5) segue as lições do Rafael abaixo. Nota 6 ou mais = pode sair. {"nota": 0-10, "problema": "o que impede de sair, em uma frase, ou vazio"}`,
        '', '=== LIÇÕES DO RAFAEL (especialista) ===', ...licoes.map(l => `- ${l.texto.replace(/\s+/g, ' ').slice(0, 400)}`),
        ...(daConversa.length ? ['=== CORREÇÕES PENDENTES NESTA CONVERSA ===', ...daConversa.map(l => `- ${l.texto.replace(/\s+/g, ' ').slice(0, 400)}`)] : []),
        '', '=== CONVERSA (últimas mensagens) ===', conversa,
        '', '=== PRÓXIMA MENSAGEM DO AGENTE ===', ...p.mensagens.map(m => `> ${m}`),
      ].join('\n') }],
      json: true, temperatura: 0.1, timeoutMs: 45_000, simples: true, agente: 'laya',
    }));
    const nota = Number(r?.nota);
    if (!Number.isFinite(nota)) return { ok: true };
    if (nota >= 6) return { ok: true };
    return { ok: false, motivo: `nota ${nota}/10 da Laya: ${String(r?.problema || 'não segue as lições do Rafael').slice(0, 300)}` };
  } catch (e: any) {
    console.warn('[LAYA] conferência de saída falhou, mensagem liberada:', e?.message);
    return { ok: true };
  }
}

/** Mensagem conferida saiu: as correções do Rafael nesta conversa contam como aplicadas. */
export async function layaMarcarOrientacoesAplicadas(prisma: PrismaClient, conversaId: string) {
  const r = await prisma.agenteNota.updateMany({ where: { tipo: 'ORIENTACAO', ref: conversaId, resolvida_em: null }, data: { resolvida_em: new Date() } }).catch(() => ({ count: 0 }));
  if (r.count) registrarAcaoAgente('laya', `confirmou ${r.count} correção(ões) do Rafael aplicada(s) numa conversa`);
}

/** O Rafael perguntou algo que a Jessica já respondeu (documento dela ou resposta no mural)? Devolve a resposta. */
export async function respostaJaDada(prisma: PrismaClient, pergunta: string): Promise<string | null> {
  const { cobertura } = await import('../lib/laya-guardia');
  const [docs, notas] = await Promise.all([
    prisma.especialistaDoc.findMany({ where: { status: 'APROVADO', origem: 'jessica' }, orderBy: { decidido_em: 'desc' }, take: 80, select: { titulo: true, conteudo: true, decidido_em: true } }).catch(() => []),
    prisma.agenteNota.findMany({ where: { tipo: 'RESPOSTA', de: 'jessica' }, orderBy: { created_at: 'desc' }, take: 80, select: { assunto: true, texto: true, created_at: true } }).catch(() => []),
  ]);
  const candidatos = [
    ...docs.map(d => ({ texto: `${d.titulo}\n${d.conteudo}`, resposta: d.conteudo, em: d.decidido_em })),
    ...notas.map(n => ({ texto: `${n.assunto}\n${n.texto}`, resposta: n.texto, em: n.created_at })),
  ];
  let melhor: { c: number; resposta: string; em: Date | null } | null = null;
  for (const c of candidatos) {
    const v = cobertura(pergunta, c.texto.slice(0, 1200));
    if (v >= 0.6 && (!melhor || v > melhor.c)) melhor = { c: v, resposta: c.resposta, em: c.em };
  }
  if (!melhor) return null;
  const quando = melhor.em ? new Date(melhor.em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
  return `A Jessica já respondeu isso${quando ? ` em ${quando}` : ''}: ${melhor.resposta.replace(/\s+/g, ' ').slice(0, 900)}`;
}
