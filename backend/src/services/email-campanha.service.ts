import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

// Endereço de envio: hoje é o sandbox do Resend (só entrega pro e-mail
// cadastrado na conta Resend). Quando um domínio for verificado no painel
// do Resend, troca só essa env var — nenhum código muda.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Prosystem <onboarding@resend.dev>';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

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
