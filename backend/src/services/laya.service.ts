import type { PrismaClient } from '@prisma/client';
import { PERGUNTAS_LAYA, PERGUNTAS_TRIAGEM, TIPOS_SEM_IA, montarEstadoConversa, lerRespostaLaya, lerEscolhaTriagem } from '../lib/laya';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { vocabulario, casoParecido, type AmostraLaya } from '../lib/laya-caderno';

// Aprendizado imediato: as confirmações da equipe (IaAmostra) viram vocabulário nas
// perguntas e memória de casos parecidos. Recarrega a cada 2 min ou quando chega confirmação.
let cacheAmostras: { em: number; xs: AmostraLaya[] } | null = null;
export function esquecerCacheLaya() { cacheAmostras = null; }
async function amostrasConfirmadas(prisma: PrismaClient): Promise<AmostraLaya[]> {
  if (cacheAmostras && Date.now() - cacheAmostras.em < 120_000) return cacheAmostras.xs;
  const xs = await prisma.iaAmostra.findMany({ select: { texto: true, rotulos: true, sugestao: true, criado_por: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 3000 }).catch(() => []);
  cacheAmostras = { em: Date.now(), xs };
  return xs;
}

/** Perguntas da Laya com as palavras típicas que a equipe já confirmou em cada opção. */
export function perguntasComVocabulario(xs: AmostraLaya[]): any {
  const q: any = JSON.parse(JSON.stringify(PERGUNTAS_LAYA));
  for (const t of ['segmento', 'intencao'] as const) {
    const voc = vocabulario(xs, t, 6);
    for (const [rot, ws] of Object.entries(voc)) {
      if (ws.length && q[t].criteria[rot]) q[t].criteria[rot] += ` (palavras comuns: ${ws.join(', ')})`;
    }
  }
  return q;
}

const SIMILARIDADE_MEMORIA = 0.6;

// Serviço Laya local (pm2 "laya", só escuta em 127.0.0.1). Se estiver fora do ar,
// a conversa segue normal, só sem sugestão.
const LAYA_URL = process.env.LAYA_URL || 'http://127.0.0.1:8765';
const MSGS_ANALISADAS = 30;

// Uma análise por conversa de cada vez; se chegar mensagem nova durante a
// análise, roda de novo no fim (com o texto atualizado).
const emAndamento = new Set<string>();
const pendente = new Set<string>();

export async function textoParaIa(prisma: PrismaClient, conversaId: string): Promise<string> {
  const msgs = await prisma.whatsappMensagem.findMany({
    where: { conversaId }, orderBy: { created_at: 'desc' }, take: MSGS_ANALISADAS,
    select: { direcao: true, tipo: true, conteudo: true },
  });
  return montarEstadoConversa(msgs.reverse());
}

async function analisar(prisma: PrismaClient, conversaId: string): Promise<void> {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { dono_id: true, tipo_contato: true, ia_sugestao: true, contato_nome: true, contato_numero: true } });
  if (!conversa || (conversa.tipo_contato && TIPOS_SEM_IA.includes(conversa.tipo_contato))) return;
  const estado = await textoParaIa(prisma, conversaId);
  if (!estado.includes('Cliente:')) return;

  const xs = await amostrasConfirmadas(prisma);
  const res = await fetch(`${LAYA_URL}/v1/systemone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: estado, questions: perguntasComVocabulario(xs), model: 'multilingual' }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Laya HTTP ${res.status}`);
  const sugestao: any = lerRespostaLaya(await res.json());
  // Memória: caso quase igual já confirmado pela equipe → vale a resposta confirmada.
  for (const t of ['segmento', 'intencao'] as const) {
    const c = casoParecido(estado, xs, t);
    if (c && c.similaridade >= SIMILARIDADE_MEMORIA && c.rotulo !== sugestao[t]) {
      sugestao[t] = c.rotulo;
      sugestao.memoria = { ...(sugestao.memoria || {}), [t]: c.similaridade };
    }
  }
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ia_sugestao: sugestao, ia_sugerido_em: new Date() } });
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
  // Passou a indicar risco de cancelamento: avisa a gestão (uma vez, na virada).
  // Limite e público vêm de Configurações; padrão 0,8 e só clientes da base enquanto
  // a Laya não é treinada (sem treino ela confunde "boleto" com cancelar).
  const { obterConfigIa } = await import('./assistente-config.service');
  const ia = await obterConfigIa(prisma);
  const antes = Number((conversa.ia_sugestao as any)?.cancelar ?? 0);
  const publicoOk = ia.risco_so_clientes ? conversa.tipo_contato === 'CLIENTE' : true;
  if (publicoOk && sugestao.cancelar >= ia.risco_limite && antes < ia.risco_limite) {
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    const ultima = estado.split('\n').filter(l => l.startsWith('Cliente:')).pop()?.slice(9, 160) || '';
    await enviarAvisoGestao(prisma, 'risco_cancelar',
      `🚨 *Risco de cancelamento* (IA Laya)\n${conversa.contato_nome || conversa.contato_numero}: "${ultima}"`);
  }
}

/** Triagem: classifica um texto livre na hora (até 20 s). null se a Laya falhar ou não tiver certeza. */
export async function classificarTriagem(pergunta: 'menu' | 'segmento', texto: string, confiancaMin: number): Promise<string | null> {
  try {
    const res = await fetch(`${LAYA_URL}/v1/systemone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: `Cliente: ${texto.slice(0, 500)}`, questions: { q: PERGUNTAS_TRIAGEM[pergunta] }, model: 'multilingual' }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return lerEscolhaTriagem(await res.json(), confiancaMin);
  } catch (e: any) {
    console.warn(`[LAYA] triagem (${pergunta}) falhou: ${e?.message || e}`);
    return null;
  }
}

/** Dispara a análise sem travar quem chamou (webhook). Nunca lança. */
export function agendarAnaliseIa(prisma: PrismaClient, conversaId: string): void {
  if (emAndamento.has(conversaId)) { pendente.add(conversaId); return; }
  emAndamento.add(conversaId);
  void (async () => {
    try {
      do {
        pendente.delete(conversaId);
        await analisar(prisma, conversaId);
      } while (pendente.has(conversaId));
    } catch (e: any) {
      console.warn(`[LAYA] análise falhou (${conversaId}): ${e?.message || e}`);
    } finally {
      emAndamento.delete(conversaId);
      pendente.delete(conversaId);
    }
  })();
}
