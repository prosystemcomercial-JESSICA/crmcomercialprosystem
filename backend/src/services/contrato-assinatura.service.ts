import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import {
  extrairAssinante, faltando, textoDadosRecebidos, textoPedeFaltante, textoLinkAssinatura, textoLembreteAssinatura, textoAssinado,
} from '@/lib/assistente/contrato';

// Contrato pela ZapSign, do aceite à assinatura: o cliente manda nome/CPF/e-mail no WhatsApp,
// o CRM preenche o contrato e avisa a gestão para conferir; ao enviar para assinatura, o link
// vai pelo WhatsApp; lembrete em 24 h, aviso em 48 h; assinado → agradecimento ao cliente.

const ESPERANDO_DADOS = ['A_GERAR', 'PENDENTE_CORRECAO'];

async function enviar(prisma: PrismaClient, conversaId: string, numero: string, texto: string) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return false;
  const r = await evo.enviarTexto(inst.instance_token, numero, texto).catch(() => null);
  if (!r) return false;
  await prisma.whatsappMensagem.create({ data: { conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: texto, status: 'ENVIADA', enviada_por: 'bot' } }).catch(() => {});
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: texto.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
  return true;
}

/** Contrato à espera dos dados de quem assina, ligado a esta conversa (pela proposta aceita). */
async function contratoDaConversa(prisma: PrismaClient, conversaId: string) {
  const ps = await prisma.propostaComercial.findMany({ where: { wpp_conversa_id: conversaId, deleted_at: null }, select: { id: true }, orderBy: { updated_at: 'desc' }, take: 5 });
  if (!ps.length) return null;
  return prisma.contratoComercial.findFirst({ where: { proposta_comercial_id: { in: ps.map(p => p.id) }, status: { in: ESPERANDO_DADOS } }, orderBy: { created_at: 'desc' } });
}

/**
 * Mensagem do cliente depois do aceite: se tiver nome/CPF/e-mail, preenche o contrato.
 * true = a mensagem era isso (os agentes não respondem por cima).
 */
export async function captarDadosAssinante(prisma: PrismaClient, conversaId: string, numero: string, texto: string): Promise<boolean> {
  const c = await contratoDaConversa(prisma, conversaId);
  if (!c) return false;
  const a = extrairAssinante(texto);
  if (!a.cpf && !a.email && !(a.nome && !c.representante_nome)) return false; // não é resposta com os dados
  const dados = {
    ...(a.nome && !c.representante_nome ? { representante_nome: a.nome } : {}),
    ...(a.cpf ? { representante_cpf: a.cpf } : {}),
    ...(a.email ? { representante_email: a.email } : {}),
    ...(!c.representante_telefone ? { representante_telefone: numero } : {}),
  };
  const novo = await prisma.contratoComercial.update({ where: { id: c.id }, data: dados });
  const falta = faltando({ nome: novo.representante_nome, cpf: novo.representante_cpf, email: novo.representante_email });
  if (falta.length) {
    await enviar(prisma, conversaId, numero, textoPedeFaltante(falta));
    return true;
  }
  await enviar(prisma, conversaId, numero, textoDadosRecebidos(novo.representante_nome));
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'contrato_pronto', [
    `📄 *Contrato pronto para conferir: ${(novo.nome_fantasia || novo.razao_social || '').trim()}*`,
    `Nº ${novo.numero_contrato} · plano ${novo.plano_contratado || '—'}`,
    `Assina: ${novo.representante_nome} · CPF ${novo.representante_cpf} · ${novo.representante_email}`,
    'Abra *Contratos*, confira e clique em *✍️ Enviar para assinatura*.',
  ].join('\n'));
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { dono_id: true } });
  emitirEventoConversa(conv?.dono_id ?? null, 'conversa_atualizada', { conversaId });
  return true;
}

/** Depois de enviar à ZapSign: o link de assinatura vai pelo WhatsApp da empresa. */
export async function enviarLinkAssinatura(prisma: PrismaClient, contratoId: string): Promise<boolean> {
  const c = await prisma.contratoComercial.findUnique({ where: { id: contratoId } });
  if (!c?.zapsign_signing_url) return false;
  const alvo = await conversaDoContrato(prisma, c);
  if (!alvo) return false;
  return enviar(prisma, alvo.conversaId, alvo.numero, textoLinkAssinatura(c.representante_nome, c.zapsign_signing_url));
}

async function conversaDoContrato(prisma: PrismaClient, c: { proposta_comercial_id: string | null; representante_telefone: string | null }) {
  if (c.proposta_comercial_id) {
    const p = await prisma.propostaComercial.findUnique({ where: { id: c.proposta_comercial_id }, select: { wpp_conversa_id: true } });
    if (p?.wpp_conversa_id) {
      const conv = await prisma.whatsappConversa.findUnique({ where: { id: p.wpp_conversa_id }, select: { id: true, contato_numero: true } });
      if (conv) return { conversaId: conv.id, numero: conv.contato_numero };
    }
  }
  const tel = (c.representante_telefone || '').replace(/\D/g, '');
  if (tel.length < 10) return null;
  const conv = await prisma.whatsappConversa.findFirst({ where: { contato_numero: { endsWith: tel.slice(-8) } }, select: { id: true, contato_numero: true }, orderBy: { ultima_em: 'desc' } });
  return conv ? { conversaId: conv.id, numero: conv.contato_numero } : null;
}

/** Lembretes: 24 h sem assinar → lembrete ao cliente; 48 h → aviso à gestão (uma vez cada). */
export async function rodarLembretesAssinatura(prisma: PrismaClient, agora = new Date()): Promise<void> {
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  const cs = await prisma.contratoComercial.findMany({
    where: { status: 'ENVIADO_ASSINATURA', sent_to_sign_at: { lt: new Date(agora.getTime() - 24 * 3600_000), gt: new Date(agora.getTime() - 30 * 864e5) } },
    take: 50,
  });
  for (const c of cs) {
    const horas = (agora.getTime() - c.sent_to_sign_at!.getTime()) / 3600_000;
    if (c.zapsign_signing_url && (await podeEnviarUmaVez(prisma, `contrato_lembrete24.${c.id}`, 24 * 365))) {
      const alvo = await conversaDoContrato(prisma, c);
      if (alvo) await enviar(prisma, alvo.conversaId, alvo.numero, textoLembreteAssinatura(c.representante_nome, c.zapsign_signing_url));
    }
    if (horas >= 48 && (await podeEnviarUmaVez(prisma, `contrato_aviso48.${c.id}`, 24 * 365))) {
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      await enviarAvisoGestao(prisma, 'contrato_pronto', `⏳ *Contrato sem assinatura há 2 dias: ${(c.nome_fantasia || c.razao_social || '').trim()}*\nNº ${c.numero_contrato} · ${c.representante_nome || ''}. Vale uma ligação.`);
    }
  }
}

/** Assinado (aviso confirmado na ZapSign): agradecimento ao cliente no WhatsApp. */
export async function agradecerAssinatura(prisma: PrismaClient, contratoId: string): Promise<void> {
  const c = await prisma.contratoComercial.findUnique({ where: { id: contratoId } });
  if (!c) return;
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  if (!(await podeEnviarUmaVez(prisma, `contrato_obrigado.${c.id}`, 24 * 365))) return;
  const alvo = await conversaDoContrato(prisma, c);
  if (alvo) await enviar(prisma, alvo.conversaId, alvo.numero, textoAssinado(c.representante_nome));
}
