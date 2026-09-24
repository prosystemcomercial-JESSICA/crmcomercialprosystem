// Vínculo conversa ↔ cliente e saída do funil. Usado pelo "Identificar" do Inbox
// e pela confirmação automática de cliente por CNPJ (mesmo comportamento).

import type { PrismaClient } from '@prisma/client';

/**
 * Tira a conversa do funil: soft-delete do lead SÓ se nasceu do WhatsApp
 * (captação automática — lead manual é preservado, só desvincula) e devolve
 * os campos da conversa a gravar (sem lead, robô desligado).
 */
export async function dadosSairDoFunil(prisma: PrismaClient, conversa: { lead_id: string | null }) {
  if (conversa.lead_id) {
    const lead = await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { origem: true } }).catch(() => null);
    if (lead?.origem === 'WHATSAPP') {
      await prisma.lead.update({ where: { id: conversa.lead_id }, data: { deleted_at: new Date() as any } }).catch(() => {});
    }
  }
  return { lead_id: null, bot_ativo: false, bot_estado: null };
}

/** Vincula a conversa a um cliente e cria/atualiza o contato na ficha dele (dedupe por telefone). */
export async function vincularContatoCliente(
  prisma: PrismaClient,
  conversa: { id: string; contato_nome: string | null; contato_numero: string },
  clienteId: string, nome: string | undefined, cargo: string | undefined, user: { id?: string; nome?: string } | null,
) {
  const nomeContato = nome || conversa.contato_nome || conversa.contato_numero;
  const telefone = conversa.contato_numero;

  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { cliente_id: clienteId } });

  const existente = await (prisma as any).contatoCliente.findFirst({ where: { cliente_id: clienteId, telefone } }).catch(() => null);
  let contato;
  if (existente) {
    contato = await (prisma as any).contatoCliente.update({
      where: { id: existente.id },
      data: { nome: nomeContato, cargo: cargo ?? existente.cargo, origem: 'WHATSAPP' },
    });
  } else {
    contato = await (prisma as any).contatoCliente.create({
      data: { cliente_id: clienteId, nome: nomeContato, telefone, cargo: cargo || null, origem: 'WHATSAPP' },
    });
  }

  await (prisma as any).eventoCliente.create({
    data: {
      cliente_id: clienteId, tipo: 'OBSERVACAO',
      titulo: `Contato de WhatsApp vinculado: ${nomeContato}${cargo ? ' (' + cargo + ')' : ''}`,
      descricao: `Telefone ${telefone}`, feito_por: user?.id, feito_por_nome: user?.nome,
    },
  }).catch(() => {});
  return contato;
}
