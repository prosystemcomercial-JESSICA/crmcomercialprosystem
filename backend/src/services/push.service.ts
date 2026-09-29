import type { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

// Notificação no celular/computador (Web Push, padrão do navegador; no iPhone funciona com o
// CRM instalado na Tela de Início, iOS 16.4+). As chaves VAPID ficam só no .env do servidor.

let configurado: boolean | null = null;
function configurar(): boolean {
  if (configurado !== null) return configurado;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) { configurado = false; return false; }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:comercial@prosystemnet.com.br', pub, priv);
  configurado = true;
  return true;
}

export const chavePublicaPush = () => process.env.VAPID_PUBLIC_KEY || null;

export type AvisoPush = { titulo: string; corpo: string; url?: string; tag?: string };

/** Quantas coisas esperam a pessoa: bolinha no ícone do app. */
export async function contagemPendencias(prisma: PrismaClient, usuarioId: string, gestao: boolean): Promise<{ total: number; aprovar: number; sem_dono: number; nao_lidas: number }> {
  const [aprovar, semDono, minhas] = await Promise.all([
    gestao ? prisma.sdrMensagem.count({ where: { status: 'PENDENTE' } }) : Promise.resolve(0),
    prisma.whatsappConversa.count({ where: { dono_id: null, finalizada_em: null, nao_lidas: { gt: 0 } } as any }),
    prisma.whatsappConversa.aggregate({ where: { dono_id: usuarioId, finalizada_em: null } as any, _sum: { nao_lidas: true } }),
  ]);
  const naoLidas = Number(minhas._sum.nao_lidas || 0);
  return { total: aprovar + semDono + naoLidas, aprovar, sem_dono: semDono, nao_lidas: naoLidas };
}

/** Envia para todos os aparelhos das pessoas. Nunca lança; remove inscrições vencidas. */
export async function enviarPush(prisma: PrismaClient, usuarioIds: string[], aviso: AvisoPush): Promise<number> {
  if (!usuarioIds.length || !configurar()) return 0;
  const subs = await prisma.pushInscricao.findMany({ where: { usuario_id: { in: usuarioIds } } }).catch(() => []);
  let n = 0;
  for (const s of subs) {
    const badge = await contagemPendencias(prisma, s.usuario_id, true).then(c => c.total).catch(() => undefined);
    const payload = JSON.stringify({ ...aviso, url: aviso.url || '/whatsapp', badge });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' });
      await prisma.pushInscricao.update({ where: { id: s.id }, data: { ultimo_ok: new Date() } }).catch(() => {});
      n++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await prisma.pushInscricao.delete({ where: { id: s.id } }).catch(() => {});
      else console.warn('[PUSH] falha:', e?.statusCode || e?.message);
    }
  }
  return n;
}
