import { Resend } from 'resend';

export const EMAIL_FROM = process.env.EMAIL_FROM || 'Prosystem <onboarding@resend.dev>';

let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
