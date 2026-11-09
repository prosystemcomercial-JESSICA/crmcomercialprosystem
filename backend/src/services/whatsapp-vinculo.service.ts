// Vínculo conversa ↔ cliente e saída do funil. Usado pelo "Identificar" do Inbox
// e pela confirmação automática de cliente por CNPJ (mesmo comportamento).

import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { auditarAlteracoesLead } from '@/lib/lead-audit';

/**
 * Tira a conversa do funil: soft-delete do lead SÓ se nasceu do WhatsApp
 * (captação automática — lead manual é preservado, só desvincula) e devolve
 * os campos da conversa a gravar (sem lead, robô desligado).
 * `semAgentes`: a equipe decidiu que a conversa não é comercial ("Desvincular do funil"
 * ou etiqueta não comercial). Marca fora_do_funil_em e para a cadência: nenhum agente
 * atua mais nela, nem quando o contato escrever de novo. Cliente identificado não usa
 * (continua recebendo o pós-venda).
 */
export async function dadosSairDoFunil(prisma: PrismaClient, conversa: { id?: string; lead_id: string | null }, opcoes: { semAgentes?: boolean } = {}) {
  if (conversa.lead_id) {
    const lead = await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { origem: true } }).catch(() => null);
    if (lead?.origem === 'WHATSAPP') {
      await prisma.lead.update({ where: { id: conversa.lead_id }, data: { deleted_at: new Date() as any } }).catch(() => {});
    }
  }
  const base = { lead_id: null, bot_ativo: false, bot_estado: null };
  if (!opcoes.semAgentes) return base;
  // Agente (Caroline, Julio, Luiz Felipe) em andamento nesta conversa sai agora, sem esperar a próxima tentativa.
  if (conversa.id) {
    await prisma.sdrLead.updateMany({ where: { conversaId: conversa.id, status: { in: ['FILA', 'AGUARDANDO', 'CONVERSANDO'] } }, data: { status: 'HUMANO' } }).catch(() => {});
  }
  return { ...base, fora_do_funil_em: new Date(), cadencia_proxima_etapa: null, cadencia_proximo_envio: null };
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

/**
 * Desqualifica o lead pela conversa (pedido da Jessica, 09/11/2026): marca PERDIDO com o motivo
 * (motivo_perda no formato da tela de Leads: "CHAVE" ou "CHAVE: detalhe"), registra em LeadPerda
 * (quem, quando, valor) e na trilha do lead, e tira os agentes da conversa. O lead continua vinculado.
 */
export async function desqualificarLead(
  prisma: PrismaClient, conversaId: string, lead: any, motivo: string, detalhe: string | undefined,
  user: { id?: string; nome?: string } | null | undefined,
) {
  const motivoPerda = detalhe ? `${motivo}: ${detalhe}` : motivo;
  const dados = { etapa_funil: 'PERDIDO', etapa_comercial: 'PERDIDO', status: 'PERDIDO' as any, status_atendimento: 'PERDIDO', motivo_perda: motivoPerda };
  await prisma.lead.update({ where: { id: lead.id }, data: dados });
  await auditarAlteracoesLead(prisma, lead.id, lead.nome, lead, dados, { id: user?.id, nome: user?.nome });
  await prisma.$executeRawUnsafe(
    `INSERT INTO LeadPerda (id, lead_id, lead_nome, etapa_anterior, etapa_destino, motivo, motivo_outro, observacoes, valor_oportunidade, vendedor_id, vendedor_nome) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    randomUUID(), lead.id, lead.nome, lead.etapa_comercial, 'PERDIDO', motivo, detalhe || null, 'Desqualificado pela tela de WhatsApp.', lead.valor_estimado || 0, user?.id || null, user?.nome || null,
  );
  await prisma.leadObservacao.create({ data: { lead_id: lead.id, tipo: 'STATUS', descricao: `🚫 Lead desqualificado pelo WhatsApp. Motivo: ${motivoPerda}`, created_by: user?.id || 'system', created_by_name: user?.nome || 'Sistema' } }).catch(() => {});
  // Agentes param nesta conversa (como no "Desvincular", mas o lead fica vinculado).
  await prisma.sdrLead.updateMany({ where: { conversaId, status: { in: ['FILA', 'AGUARDANDO', 'CONVERSANDO'] } }, data: { status: 'HUMANO' } }).catch(() => {});
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { bot_ativo: false, bot_estado: null, cadencia_proxima_etapa: null, cadencia_proximo_envio: null } });
  return motivoPerda;
}
