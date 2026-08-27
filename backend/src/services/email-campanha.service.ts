import { PrismaClient } from '@prisma/client';
import { getResend, EMAIL_FROM } from '@/lib/resend-client';

export interface EnviarEmailCampanhaParams {
  campanhaId: string;
  acaoId?: string;
  clienteId: string;
  to: string;
  subject: string;
  html: string;
}

export interface EnviarEmailCampanhaResultado {
  disparoId: string;
  status: 'ENVIADO' | 'ERRO';
  messageId?: string;
  erro?: string;
}

/**
 * Envia um e-mail de campanha via Resend e grava o resultado em
 * CampanhaDisparo — reaproveita o modelo já existente no schema (message_id,
 * status, sent_at) em vez de criar uma tabela de log paralela. Nunca lança:
 * falha de envio vira um disparo com status ERRO, não uma exceção.
 */
export async function enviarEmailCampanha(
  prisma: PrismaClient,
  params: EnviarEmailCampanhaParams
): Promise<EnviarEmailCampanhaResultado> {
  const { campanhaId, acaoId, clienteId, to, subject, html } = params;

  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      const disparo = await prisma.campanhaDisparo.create({
        data: {
          campanha_id: campanhaId,
          acao_id: acaoId,
          cliente_id: clienteId,
          tipo: 'EMAIL',
          status: 'ERRO',
          metadados: { erro: error.message, to, subject },
        },
      });
      return { disparoId: disparo.id, status: 'ERRO', erro: error.message };
    }

    const disparo = await prisma.campanhaDisparo.create({
      data: {
        campanha_id: campanhaId,
        acao_id: acaoId,
        cliente_id: clienteId,
        tipo: 'EMAIL',
        status: 'ENVIADO',
        message_id: data!.id,
        sent_at: new Date(),
        metadados: { to, subject },
      },
    });
    return { disparoId: disparo.id, status: 'ENVIADO', messageId: data!.id };
  } catch (e: any) {
    const disparo = await prisma.campanhaDisparo.create({
      data: {
        campanha_id: campanhaId,
        acao_id: acaoId,
        cliente_id: clienteId,
        tipo: 'EMAIL',
        status: 'ERRO',
        metadados: { erro: e?.message || 'Erro desconhecido', to, subject },
      },
    });
    return { disparoId: disparo.id, status: 'ERRO', erro: e?.message };
  }
}
