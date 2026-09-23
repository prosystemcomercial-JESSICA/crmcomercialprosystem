import { timingSafeEqual } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AuthUserLike, podeVerTudo } from '@/lib/scope';

// "WhatsApp da empresa": uma única instância UAZAPI para o CRM todo, guardada
// como uma linha de WhatsappInstancia com instancia_nome fixo. A gestão cola o
// token da instância em Configurações; conversas de número novo entram sem dono
// (dono_id = null, o "pool") e o vendedor assume.

export const INSTANCIA_EMPRESA = 'empresa';
export const APELIDO_EMPRESA = 'WhatsApp da empresa';

/** Instância da empresa, se configurada (tem token). */
export async function obterInstanciaEmpresa(prisma: PrismaClient) {
  const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: INSTANCIA_EMPRESA } }).catch(() => null);
  return inst?.instance_token ? inst : null;
}

/**
 * Confere o token recebido no webhook com o token da instância da empresa.
 * Comparação em tempo constante; vazio/ausente nunca confere.
 */
export function tokenWebhookConfere(recebido: unknown, esperado: string | null | undefined): boolean {
  if (typeof recebido !== 'string' || !recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Filtro da listagem de conversas:
 *   - escopo=pool  → conversas sem dono (visível a todo usuário logado);
 *   - escopo=todos → gestão vê tudo (demais caem no padrão);
 *   - padrão       → só as próprias.
 */
export function whereListaConversas(escopo: string | undefined, user?: AuthUserLike): Record<string, any> {
  if (escopo === 'pool') return { dono_id: null };
  if (escopo === 'todos' && podeVerTudo(user)) return {};
  return { dono_id: user?.id || '__no_user__' };
}

/** Ações numa conversa: permitidas ao dono ou em conversa do pool (sem dono). */
export function whereAcaoConversa(user?: AuthUserLike): Record<string, any> {
  return { OR: [{ dono_id: user?.id || '__no_user__' }, { dono_id: null }] };
}

/** Leitura (mensagens/painel): gestão vê qualquer conversa; demais, dono ou pool. */
export function whereLeituraConversa(user?: AuthUserLike): Record<string, any> {
  return podeVerTudo(user) ? {} : whereAcaoConversa(user);
}
