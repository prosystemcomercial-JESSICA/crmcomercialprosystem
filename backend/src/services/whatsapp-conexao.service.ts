// Vigia das conexões (caso de 22/10/2026): a cada 5 min confere na API o status de cada número
// da empresa e corrige o banco. Antes, uma vaga extra marcada DESCONECTADO por engano só voltava
// quando alguém abria Configurações → Números, e enquanto isso os envios aos contatos dela ficavam
// bloqueados e ela saía do rodízio. Falha temporária da API não muda nada (evolution.obterStatus).
import { PrismaClient } from '@prisma/client';
import { NOMES_NUMEROS_EMPRESA } from '@/lib/whatsapp-vagas';
import { obterStatus } from './evolution.service';
import { limparCacheInstancias } from './whatsapp-roteador.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';

export const INTERVALO_VIGIA_MS = 5 * 60 * 1000;

/** Confere todos os números cadastrados; devolve quantos mudaram de status. */
export async function conferirConexoes(prisma: PrismaClient): Promise<number> {
  const insts = await prisma.whatsappInstancia.findMany({
    where: { instancia_nome: { in: NOMES_NUMEROS_EMPRESA }, instance_token: { not: null } },
    select: { id: true, instancia_nome: true, instance_token: true, status: true, numero: true, conectado_em: true },
  });
  let mudaram = 0;
  for (const i of insts) {
    const r = await obterStatus(i.instance_token!);
    if (r.falhaApi) continue;
    if (r.status === i.status && (!r.numero || r.numero === i.numero)) continue;
    await prisma.whatsappInstancia.update({
      where: { id: i.id },
      data: {
        status: r.status,
        numero: r.numero || i.numero,
        conectado_em: r.status === 'CONECTADO' ? (i.conectado_em ?? new Date()) : i.conectado_em,
        ...(r.status === 'CONECTADO' ? { qr_code: null } : {}),
      },
    });
    console.log(`[WPP] Vigia: "${i.instancia_nome}" ${i.status} → ${r.status}`);
    emitirEventoConversa(null, 'conversa_atualizada', { instanciaId: i.id });
    mudaram++;
  }
  if (mudaram) limparCacheInstancias();
  return mudaram;
}

export function iniciarVigiaConexoes(prisma: PrismaClient) {
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try { await conferirConexoes(prisma); }
    catch (e: any) { console.error('[WPP] Vigia de conexões:', e?.message); }
    finally { rodando = false; }
  };
  setTimeout(rodar, 30 * 1000);
  setInterval(rodar, INTERVALO_VIGIA_MS);
  console.log('[BOOT] Vigia das conexões do WhatsApp iniciado (5 min)');
}
