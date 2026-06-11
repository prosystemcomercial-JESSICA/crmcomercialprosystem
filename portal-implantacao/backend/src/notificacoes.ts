// Notificações do portal: e-mail (nodemailer) + alerta interno ao gestor.
// Config por env (mesmas credenciais SMTP do CRM comercial, se desejado).
import nodemailer from 'nodemailer';

export const FRESHDESK_URL = process.env.FRESHDESK_URL || 'https://suporteprosystem.freshdesk.com/support/home';

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null; // sem SMTP configurado → e-mails só são logados
  transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

export async function enviarEmail(p: { para: string; assunto: string; corpo: string }) {
  const t = getTransporter();
  if (!t) { console.log(`[EMAIL simulado] para=${p.para} assunto="${p.assunto}"`); return { ok: true, simulado: true }; }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: p.para, subject: p.assunto, text: p.corpo });
    return { ok: true };
  } catch (e: any) { console.error('[EMAIL erro]', e?.message); return { ok: false, error: e?.message }; }
}

// Alerta interno ao gestor: e-mail p/ GESTOR_EMAIL (se houver) + log vermelho.
// As notificações in-app são consumidas pela rota /alertas (banco de log).
export async function alertaGestor(mensagem: string) {
  console.warn('[ALERTA GESTOR]', mensagem);
  const dest = process.env.GESTOR_EMAIL;
  if (dest) await enviarEmail({ para: dest, assunto: 'Alerta de gargalo — Implantação Prosystem', corpo: mensagem });
}
