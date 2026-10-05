// Google Agenda da empresa (token único "system", o mesmo da tela Agenda Google do CRM).
// Viradas e fases de treinamento viram eventos com o técnico convidado: aparecem no calendário dele.
// Sem token ou com erro: não trava nada (o portal segue funcionando), só registra no log.
import type { PrismaClient } from '@prisma/client';

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function tokenSistema(prisma: PrismaClient): Promise<string | null> {
  let t = await prisma.calendarToken.findUnique({ where: { user_id: 'system' } }).catch(() => null);
  if (!t) t = await prisma.calendarToken.findUnique({ where: { user_id: 'default' } }).catch(() => null);
  if (!t) return null;
  if (Number(t.expiry_date) > Date.now() + 60_000) return t.access_token;
  if (!t.refresh_token || !process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: t.refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const j: any = await r.json();
    if (!j.access_token) return null;
    await prisma.calendarToken.update({ where: { user_id: t.user_id }, data: { access_token: j.access_token, expiry_date: BigInt(Date.now() + (j.expires_in || 3600) * 1000) } });
    return j.access_token;
  } catch { return null; }
}

/** Cria ou atualiza o evento. Devolve o id do evento (ou null se não deu). */
export async function salvarEventoGoogle(prisma: PrismaClient, p: { eventoId?: string | null; titulo: string; descricao?: string; inicio: Date; fim?: Date; diaTodo?: boolean; convidados: string[] }): Promise<string | null> {
  const token = await tokenSistema(prisma);
  if (!token) return null;
  const dia = (d: Date) => new Date(d.getTime() - 3 * 36e5).toISOString().slice(0, 10);
  const body: any = {
    summary: p.titulo, description: p.descricao || '',
    start: p.diaTodo ? { date: dia(p.inicio) } : { dateTime: p.inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: p.diaTodo ? { date: dia(new Date(p.inicio.getTime() + 864e5)) } : { dateTime: (p.fim || new Date(p.inicio.getTime() + 4 * 36e5)).toISOString(), timeZone: 'America/Sao_Paulo' },
    attendees: [...new Set(p.convidados.filter(e => /@/.test(e)))].map(email => ({ email })),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: p.diaTodo ? 600 : 60 }] },
  };
  try {
    const r = await fetch(p.eventoId ? `${API}/${encodeURIComponent(p.eventoId)}?sendUpdates=all` : `${API}?sendUpdates=all`, {
      method: p.eventoId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j: any = await r.json();
    if (!r.ok) {
      // Evento apagado no Google: cria de novo.
      if (p.eventoId && (r.status === 404 || r.status === 410)) return salvarEventoGoogle(prisma, { ...p, eventoId: null });
      console.warn('[AGENDA] Google recusou o evento:', j?.error?.message || r.status);
      return null;
    }
    return j.id || null;
  } catch (e: any) { console.warn('[AGENDA] Falha no Google Agenda:', e?.message); return null; }
}

export async function removerEventoGoogle(prisma: PrismaClient, eventoId: string): Promise<void> {
  const token = await tokenSistema(prisma);
  if (!token) return;
  await fetch(`${API}/${encodeURIComponent(eventoId)}?sendUpdates=all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

/** E-mail do técnico (convidado do evento). */
export async function emailDoTecnico(prisma: PrismaClient, tecnicoId?: string | null): Promise<string[]> {
  if (!tecnicoId) return [];
  const u = await prisma.usuarioCRM.findUnique({ where: { id: tecnicoId }, select: { email: true } }).catch(() => null);
  return u?.email ? [u.email] : [];
}
