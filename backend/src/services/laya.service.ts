import type { PrismaClient } from '@prisma/client';
import { PERGUNTAS_LAYA, TIPOS_SEM_IA, montarEstadoConversa, lerRespostaLaya } from '../lib/laya';
import { emitirEventoConversa } from './whatsapp-eventos.service';

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

  const res = await fetch(`${LAYA_URL}/v1/systemone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: estado, questions: PERGUNTAS_LAYA, model: 'multilingual' }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Laya HTTP ${res.status}`);
  const sugestao = lerRespostaLaya(await res.json());
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ia_sugestao: sugestao, ia_sugerido_em: new Date() } });
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId });
  // Cliente da base passou a indicar risco de cancelamento: avisa a gestão (uma vez, na virada).
  // Limite alto (0,8) enquanto a Laya não é treinada: sem treino ela confunde "boleto" com cancelar.
  const antes = Number((conversa.ia_sugestao as any)?.cancelar ?? 0);
  if (conversa.tipo_contato === 'CLIENTE' && sugestao.cancelar >= 0.8 && antes < 0.8) {
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    const ultima = estado.split('\n').filter(l => l.startsWith('Cliente:')).pop()?.slice(9, 160) || '';
    await enviarAvisoGestao(prisma, 'risco_cancelar',
      `🚨 *Risco de cancelamento* (IA Laya)\n${conversa.contato_nome || conversa.contato_numero}: "${ultima}"`);
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
