// Roteador de envio do WhatsApp: aplica "contato preso ao número" (lib/contato-instancia.ts)
// antes de todo envio feito por evolution.service.ts. Registrado uma vez no server.ts.
import { PrismaClient } from '@prisma/client';
import { chaveContato, decidirInstanciaEnvio, InstanciaResumo } from '@/lib/contato-instancia';
import { VAGAS, chaveServidorDaVaga } from '@/lib/whatsapp-vagas';
import { ContatoDeOutroNumero, definirServidorDoToken, registrarRoteadorEnvio } from './evolution.service';

const SELECT = { id: true, instancia_nome: true, apelido: true, instance_token: true, status: true } as const;

let cache: { em: number; lista: InstanciaResumo[] } | null = null;
async function instancias(prisma: PrismaClient): Promise<InstanciaResumo[]> {
  if (cache && Date.now() - cache.em < 30_000) return cache.lista;
  const lista = await prisma.whatsappInstancia.findMany({ select: SELECT });
  cache = { em: Date.now(), lista };
  return lista;
}
export const limparCacheInstancias = () => { cache = null; };

/**
 * Instância dona do contato: a da primeira conversa com mensagens trocadas (qualquer direção).
 * Sem mensagem em nenhuma, a da primeira conversa aberta (ex.: levada ao número do rodízio e
 * esperando a aprovação do primeiro contato).
 */
export async function instanciaDonaDoContato(prisma: PrismaClient, numero: string): Promise<InstanciaResumo | null> {
  const chave = chaveContato(numero);
  const fim8 = (numero || '').replace(/\D/g, '').slice(-8);
  if (fim8.length < 8) return null;
  const convs = (await prisma.whatsappConversa.findMany({
    where: { contato_numero: { endsWith: fim8 } },
    orderBy: { created_at: 'asc' },
    select: { contato_numero: true, instancia: { select: SELECT }, _count: { select: { mensagens: true } } },
  })).filter(c => chaveContato(c.contato_numero) === chave);
  return (convs.find(c => c._count.mensagens > 0) || convs[0])?.instancia || null;
}

/** Conta UAZAPI de cada vaga extra (19/10/2026): recarrega do banco o servidor de cada token. */
export async function carregarServidoresUazapi(prisma: PrismaClient) {
  const extras = VAGAS.filter(v => v.provedor === 'UAZAPI' && !v.principal);
  const [regs, insts] = await Promise.all([
    prisma.configuracaoIntegracao.findMany({ where: { chave: { in: extras.map(v => chaveServidorDaVaga(v.vaga)) } } }),
    prisma.whatsappInstancia.findMany({ where: { instancia_nome: { in: extras.map(v => v.vaga) } }, select: { instancia_nome: true, instance_token: true } }),
  ]);
  for (const i of insts) {
    const servidor = regs.find(r => r.chave === chaveServidorDaVaga(i.instancia_nome))?.valor;
    if (i.instance_token && servidor) definirServidorDoToken(i.instance_token, servidor);
  }
}

export function ativarRoteadorEnvio(prisma: PrismaClient) {
  carregarServidoresUazapi(prisma).catch((e: any) => console.error('[WPP] contas UAZAPI:', e?.message));
  registrarRoteadorEnvio(async (tokenPedido, numero) => {
    const lista = await instancias(prisma);
    // Só um número cadastrado: nada a rotear (situação de hoje, sem consulta extra).
    if (lista.length <= 1) return tokenPedido;
    const pedida = lista.find(i => i.instance_token === tokenPedido) || null;
    const dona = await instanciaDonaDoContato(prisma, numero);
    const d = decidirInstanciaEnvio(tokenPedido, pedida, dona && (lista.find(i => i.id === dona.id) || dona));
    if ('bloquear' in d) throw new ContatoDeOutroNumero(numero, d.bloquear);
    if (d.desviou) console.log(`[WPP] Envio para ${numero.slice(0, 4)}…${numero.slice(-4)} desviado de "${pedida?.instancia_nome || '?'}" para o número dono do contato.`);
    return d.token;
  });
}
