import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { ownerWhereId } from '@/lib/scope';

// ─── Transporter (mesmo padrão do email.service) ───────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'mail.prosystemnet.com.br',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface ItemPendencia {
  tipo: string;
  urgencia: 'ALTA' | 'MEDIA' | 'BAIXA';
  titulo: string;
  descricao: string;
  data?: Date | string | null;
}

export interface PendenciasUsuario {
  total: number;
  alta: number;
  itens: ItemPendencia[];
}

// ─── Coletor: replica a lógica do /alertas para UM usuário (sem request) ───────
// verTudo = true → gestor (sem filtro de dono). false → vendedor (só o próprio).
export async function coletarPendenciasDoUsuario(
  prisma: PrismaClient,
  userId: string,
  verTudo: boolean,
): Promise<PendenciasUsuario> {
  const now = new Date();
  const seteAtras = new Date(now); seteAtras.setDate(seteAtras.getDate() - 7);

  // Escopo: gestor → {} (tudo); vendedor → filtro por suas colunas de dono.
  const escAtiv = verTudo ? {} : ownerWhereId('Atividade', userId);
  const escLead = verTudo ? { deleted_at: null } : ownerWhereId('Lead', userId);
  const escProp = verTudo ? {} : ownerWhereId('Proposta', userId);

  const [atrasadas, vencem_hoje, sem_atividade, propostas_expiram] = await Promise.all([
    prisma.atividade.findMany({
      where: { status: 'PENDENTE', data_prevista: { lt: now }, ...escAtiv },
      include: { lead: { select: { nome: true, empresa: true } } },
      orderBy: { data_prevista: 'asc' }, take: 20,
    }),
    prisma.atividade.findMany({
      where: {
        status: 'PENDENTE',
        data_prevista: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
        ...escAtiv,
      },
      include: { lead: { select: { nome: true, empresa: true } } }, take: 20,
    }),
    prisma.lead.findMany({
      where: { status: { notIn: ['GANHO', 'PERDIDO'] }, updated_at: { lt: seteAtras }, ...escLead },
      orderBy: { updated_at: 'asc' }, take: 15,
    }),
    prisma.proposta.findMany({
      where: {
        status: { in: ['ENVIADA', 'VISUALIZADA'] },
        validade: { gt: now, lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
        ...escProp,
      },
      include: { lead: { select: { nome: true, empresa: true } } }, take: 10,
    }),
  ]);

  const itens: ItemPendencia[] = [
    ...atrasadas.map((a): ItemPendencia => ({
      tipo: 'ATIVIDADE_ATRASADA', urgencia: 'ALTA',
      titulo: `Atividade atrasada: ${a.titulo}`,
      descricao: `${a.lead?.nome ?? ''}${a.lead?.empresa ? ` · ${a.lead.empresa}` : ''} · ${a.tipo}`,
      data: a.data_prevista,
    })),
    ...propostas_expiram.map((p): ItemPendencia => ({
      tipo: 'PROPOSTA_EXPIRANDO', urgencia: 'ALTA',
      titulo: `Proposta expirando: ${p.titulo}`,
      descricao: `${p.lead?.nome ?? ''} · ${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      data: p.validade,
    })),
    ...vencem_hoje.map((a): ItemPendencia => ({
      tipo: 'VENCE_HOJE', urgencia: 'MEDIA',
      titulo: `Vence hoje: ${a.titulo}`,
      descricao: `${a.lead?.nome ?? ''}${a.lead?.empresa ? ` · ${a.lead.empresa}` : ''}`,
      data: a.data_prevista,
    })),
    ...sem_atividade.map((l): ItemPendencia => ({
      tipo: 'SEM_ATIVIDADE', urgencia: 'BAIXA',
      titulo: `Lead sem contato: ${l.nome}`,
      descricao: `${l.empresa || ''} · sem atividade há ${Math.floor((now.getTime() - new Date(l.updated_at).getTime()) / 86400000)} dias`,
      data: l.updated_at,
    })),
  ];

  const alta = itens.filter(i => i.urgencia === 'ALTA').length;
  return { total: itens.length, alta, itens };
}

// ─── Template do digest (padrão visual ProSystem) ──────────────────────────────
const COR_URGENCIA: Record<string, string> = { ALTA: '#DC2626', MEDIA: '#D97706', BAIXA: '#2563EB' };
const baseUrl = () => process.env.FRONTEND_URL || process.env.APP_URL || 'https://frontend-production-3a79.up.railway.app';

function buildDigestHtml(params: {
  nome: string; saudacao: string; pendencias: PendenciasUsuario; isGestao: boolean;
}): string {
  const { nome, saudacao, pendencias, isGestao } = params;
  const linhas = pendencias.itens.map(i => `
    <tr>
      <td width="6" style="background:${COR_URGENCIA[i.urgencia]};"></td>
      <td style="padding:12px 16px;border-bottom:1px solid #EBF4FF;">
        <p style="margin:0 0 2px;font-size:14px;color:#0D2238;font-weight:600;">${i.titulo}</p>
        <p style="margin:0;font-size:12px;color:#4A6E8A;">${i.descricao}</p>
      </td>
    </tr>`).join('');

  const titulo = isGestao ? 'Resumo da equipe comercial' : 'Suas pendências de hoje';
  const subt = isGestao
    ? 'Consolidado de tudo que precisa de ação no funil da equipe.'
    : 'O que precisa da sua atenção para não deixar venda esfriar.';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,34,56,0.10);">
        <tr><td style="background:linear-gradient(135deg,#0D2238,#1A4E82);padding:32px 36px;">
          <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#fff;">Pro<span style="color:#90BEF0;">System</span></p>
          <p style="margin:0;font-size:11px;color:#6AAAE5;letter-spacing:2px;text-transform:uppercase;">CRM Comercial · ${saudacao}</p>
        </td></tr>
        <tr><td style="padding:32px 36px 0;">
          <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0D2238;">${titulo}</h2>
          <p style="margin:0 0 4px;font-size:14px;color:#4A6E8A;">Olá, ${nome}! ${subt}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#0D2238;">
            <strong>${pendencias.total}</strong> item(ns) pendente(s)
            ${pendencias.alta > 0 ? ` · <span style="color:#DC2626;font-weight:700;">${pendencias.alta} urgente(s)</span>` : ''}
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #EBF4FF;border-radius:10px;overflow:hidden;">${linhas}</table>
        </td></tr>
        <tr><td style="padding:28px 36px;text-align:center;">
          <a href="${baseUrl()}/alertas" style="display:inline-block;background:#4B8EC8;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">Abrir o CRM</a>
        </td></tr>
        <tr><td style="padding:0 36px 32px;">
          <p style="margin:0;font-size:11px;color:#7AAACB;text-align:center;line-height:1.6;border-top:1px solid #E8F0F8;padding-top:16px;">
            Resumo automático do CRM ProSystem. Você recebe este e-mail 2x ao dia quando há pendências.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Envio ─────────────────────────────────────────────────────────────────
async function enviarDigest(params: {
  email: string; nome: string; saudacao: string; pendencias: PendenciasUsuario; isGestao: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[DIGEST] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }
  if (params.pendencias.total === 0) return { ok: true }; // nunca envia vazio

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const html = buildDigestHtml(params);

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.email,
      replyTo: fromEmail,
      subject: `${params.pendencias.alta > 0 ? '🔴 ' : '📋 '}${params.saudacao}: ${params.pendencias.total} pendência(s) no seu funil`,
      html,
      headers: { 'X-Mailer': 'ProSystem CRM 2.0', 'X-Priority': params.pendencias.alta > 0 ? '1' : '3' },
    });
    console.log(`[DIGEST] Enviado para ${params.email} (${params.pendencias.total} itens)`);
    return { ok: true };
  } catch (err: any) {
    console.error(`[DIGEST] Erro ao enviar para ${params.email}:`, err.message);
    return { ok: false, error: err.message };
  }
}

export function enviarEmailDigestVendedor(p: { email: string; nome: string; saudacao: string; pendencias: PendenciasUsuario }) {
  return enviarDigest({ ...p, isGestao: false });
}

export function enviarEmailDigestGestao(p: { email: string; nome: string; saudacao: string; pendencias: PendenciasUsuario }) {
  return enviarDigest({ ...p, isGestao: true });
}
