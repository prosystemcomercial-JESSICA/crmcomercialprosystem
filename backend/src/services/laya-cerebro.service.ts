import type { PrismaClient } from '@prisma/client';
import { PERGUNTAS_LAYA, lerEscolhaTriagem } from '../lib/laya';
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
export async function aprenderComDecisao(prisma: PrismaClient, conversaId: string, rotulos: { segmento?: string; intencao?: string; cancelar?: boolean }, fonte: string) {
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

/** Contador de chamadas à IA externa que a Laya evitou. */
export function layaEvitouIa(agente: string, motivo: string) {
  registrarUsoIa('evitada');
  registrarAcaoAgente('laya', `decidiu sozinha (${motivo}) e poupou a IA externa na conversa do ${agente}`);
}
