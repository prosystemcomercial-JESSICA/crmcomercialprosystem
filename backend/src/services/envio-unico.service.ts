import type { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Trava contra mensagens repetidas que sobrevive a reinícios do servidor (cada publicação
// reinicia; controles só em memória esqueciam e reenviavam). Grava a marca no banco.

/**
 * true = pode enviar agora (e já marca); false = já foi dentro da janela.
 * A chave única do banco garante que dois processos não passem juntos.
 */
export async function podeEnviarUmaVez(prisma: PrismaClient, chave: string, janelaHoras: number): Promise<boolean> {
  const k = `envio.${chave}`.slice(0, 190);
  const agora = new Date();
  const atual = await prisma.configuracaoIntegracao.findUnique({ where: { chave: k } }).catch(() => null);
  if (atual) {
    const em = new Date(atual.valor);
    if (!isNaN(em.getTime()) && agora.getTime() - em.getTime() < janelaHoras * 3600_000) return false;
    const r = await prisma.configuracaoIntegracao.updateMany({ where: { chave: k, valor: atual.valor }, data: { valor: agora.toISOString() } }).catch(() => ({ count: 0 }));
    return r.count === 1;
  }
  try {
    await prisma.configuracaoIntegracao.create({ data: { chave: k, valor: agora.toISOString(), updated_by: 'sistema' } });
    return true;
  } catch {
    return false; // outro processo marcou primeiro
  }
}

export const hashTexto = (t: string) => createHash('sha1').update(t.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

export const diaSP = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
