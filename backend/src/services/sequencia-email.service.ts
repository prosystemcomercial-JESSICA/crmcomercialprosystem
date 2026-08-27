import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getResend, EMAIL_FROM } from '@/lib/resend-client';

/**
 * Insere um lead numa sequência de e-mail (ex.: Padarias 2026). Idempotente:
 * se o lead já está na sequência, retorna o vínculo existente sem duplicar
 * (respeita o @@unique([sequencia_id, lead_id]) do schema).
 */
export async function entrarNaSequencia(
  prisma: PrismaClient,
  params: { sequenciaId: string; leadId: string; userId: string }
) {
  const existente = await prisma.leadSequenciaEmail.findUnique({
    where: { sequencia_id_lead_id: { sequencia_id: params.sequenciaId, lead_id: params.leadId } },
  });
  if (existente) return existente;

  const primeiraEtapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: params.sequenciaId, numero: 1 },
  });
  if (!primeiraEtapa) throw new Error('Sequência sem etapa 1 configurada');

  return prisma.leadSequenciaEmail.create({
    data: {
      sequencia_id: params.sequenciaId,
      lead_id: params.leadId,
      fase_kanban: 'BASE_VALIDADA',
      // Etapa 1 é D+0 — o scheduler do mesmo dia já pode disparar.
      proximo_envio_em: new Date(),
      created_by: params.userId,
    },
  });
}

/** Lê o HTML do template e substitui o placeholder de descadastro. */
function carregarTemplate(templatePath: string, unsubscribeUrl: string): string {
  const fullPath = path.join(process.cwd(), 'src', 'email-templates', templatePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Template não encontrado: ${templatePath}`);
  return fs.readFileSync(fullPath, 'utf-8').replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
}

/**
 * Envia o PRÓXIMO e-mail pendente de um LeadSequenciaEmail (aquele cujo
 * `ultima_etapa_enviada + 1` ainda não foi enviado) e agenda o próximo envio.
 * Se já enviou a etapa 12, marca fase_kanban = LONGO_PRAZO e não agenda mais nada.
 * Nunca lança: falha de envio grava um LeadSequenciaEmailDisparo com status ERRO
 * e agenda um REENVIO da MESMA etapa pro dia seguinte, sem avançar
 * ultima_etapa_enviada/fase_kanban (a etapa não pode ser considerada "enviada").
 * Após 3 falhas consecutivas na mesma etapa, pausa a sequência em vez de
 * tentar reenviar pra sempre (ex.: e-mail do lead permanentemente inválido).
 */
export async function dispararProximoEmail(prisma: PrismaClient, leadSequenciaId: string) {
  const ls = await prisma.leadSequenciaEmail.findUnique({
    where: { id: leadSequenciaId },
    include: { lead: true, sequencia: true },
  });
  if (!ls || ls.pausada) return null;

  const proximoNumero = (ls.ultima_etapa_enviada || 0) + 1;
  const etapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: ls.sequencia_id, numero: proximoNumero },
  });

  // Sem mais etapas → fim da sequência, vai para nutrição de longo prazo.
  if (!etapa) {
    await prisma.leadSequenciaEmail.update({
      where: { id: ls.id },
      data: { fase_kanban: 'LONGO_PRAZO', proximo_envio_em: null },
    });
    return null;
  }

  const email = ls.lead.email || ls.lead.responsavel_email;
  if (!email) {
    // Lead sem e-mail válido — pausa em vez de tentar reenviar pra sempre.
    await prisma.leadSequenciaEmail.update({
      where: { id: ls.id },
      data: { pausada: true, motivo_pausa: 'Lead sem e-mail cadastrado', pausada_em: new Date() },
    });
    return null;
  }

  const unsubscribeUrl = `${process.env.BACKEND_URL || 'https://crmcomercialprosystem-production-945e.up.railway.app'}/sequencias-email/descadastro/${ls.id}`;
  const html = carregarTemplate(etapa.template_path, unsubscribeUrl);

  let resultado: { status: 'ENVIADO' | 'ERRO'; messageId?: string; erro?: string };
  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: etapa.assunto,
      html,
    });
    resultado = error ? { status: 'ERRO', erro: error.message } : { status: 'ENVIADO', messageId: data!.id };
  } catch (e: any) {
    resultado = { status: 'ERRO', erro: e?.message || 'Erro desconhecido' };
  }

  // Falha no envio: NÃO avança a etapa nem a fase — reagenda a MESMA etapa
  // pro dia seguinte, pra o scheduler tentar de novo. Corta o loop de retry
  // depois de 3 falhas consecutivas nesta etapa, pausando a sequência.
  // A contagem de falhas ANTERIORES precisa rodar antes de criar o registro
  // de disparo desta tentativa, senão a própria tentativa atual entraria na
  // contagem que decide o destino dela (off-by-one).
  if (resultado.status === 'ERRO') {
    const falhasAnteriores = await prisma.leadSequenciaEmailDisparo.count({
      where: { lead_sequencia_id: ls.id, etapa_id: etapa.id, status: 'ERRO' },
    });

    await prisma.leadSequenciaEmailDisparo.create({
      data: {
        lead_sequencia_id: ls.id,
        etapa_id: etapa.id,
        status: resultado.status,
        message_id: resultado.messageId,
        erro: resultado.erro,
        sent_at: null,
      },
    });

    if (falhasAnteriores >= 3) {
      await prisma.leadSequenciaEmail.update({
        where: { id: ls.id },
        data: {
          pausada: true,
          motivo_pausa: 'Falha de envio repetida (3+ tentativas)',
          pausada_em: new Date(),
        },
      });
    } else {
      await prisma.leadSequenciaEmail.update({
        where: { id: ls.id },
        data: { proximo_envio_em: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
    }

    return resultado;
  }

  await prisma.leadSequenciaEmailDisparo.create({
    data: {
      lead_sequencia_id: ls.id,
      etapa_id: etapa.id,
      status: resultado.status,
      message_id: resultado.messageId,
      erro: resultado.erro,
      sent_at: new Date(),
    },
  });

  // Calcula a data do PRÓXIMO e-mail (etapa+1) a partir de entrou_em — não do
  // envio atual, pra não acumular atraso se o scheduler rodar um dia depois.
  const proximaEtapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: ls.sequencia_id, numero: proximoNumero + 1 },
  });
  const proximoEnvioEm = proximaEtapa
    ? new Date(ls.entrou_em.getTime() + proximaEtapa.dia_envio * 86400000)
    : null;

  await prisma.leadSequenciaEmail.update({
    where: { id: ls.id },
    data: {
      ultima_etapa_enviada: proximoNumero,
      proximo_envio_em: proximoEnvioEm,
      fase_kanban: proximaEtapa ? proximaEtapa.fase_kanban : 'LONGO_PRAZO',
    },
  });

  return resultado;
}

/** Pausa a sequência (clique automático via webhook, ou ação manual). */
export async function pausarSequencia(prisma: PrismaClient, leadSequenciaId: string, motivo: string) {
  return prisma.leadSequenciaEmail.update({
    where: { id: leadSequenciaId },
    data: { pausada: true, motivo_pausa: motivo, pausada_em: new Date(), fase_kanban: 'ENGAJOU_QUALIFICAR' },
  });
}

/**
 * Roda 1x/dia (scheduler, ver Task 7): dispara o e-mail de todo
 * LeadSequenciaEmail não pausado cujo proximo_envio_em já venceu.
 */
export async function rodarSchedulerSequenciaEmail(prisma: PrismaClient) {
  const pendentes = await prisma.leadSequenciaEmail.findMany({
    where: { pausada: false, proximo_envio_em: { lte: new Date() } },
  });
  let enviados = 0, erros = 0;
  for (const ls of pendentes) {
    const r = await dispararProximoEmail(prisma, ls.id);
    if (r?.status === 'ENVIADO') enviados++;
    else if (r?.status === 'ERRO') erros++;
  }
  return { processados: pendentes.length, enviados, erros };
}
