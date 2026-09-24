import type { PrismaClient } from '@prisma/client';
import { montarDadosPainelTv } from '@/routes/painel-tv';
import { montarHtmlResumoExecutivo, assuntoResumoExecutivo } from '@/lib/resumo-executivo';
import { enviarEmailSmtp } from './notification.service';

// Resumo executivo diário: vai para a diretoria (cargo CEO) com cópia para a
// supervisão comercial. Mesmos números do painel da TV (hoje + acumulado do ano).
export const CARGOS_DESTINO_EXECUTIVO = ['CEO'];
export const CARGOS_COPIA_EXECUTIVO = ['SUPERVISAO_COMERCIAL'];

export async function enviarResumoExecutivo(prisma: PrismaClient, opts: { somenteEmail?: string } = {}) {
  const ativos = await prisma.usuarioCRM.findMany({
    where: { status: 'ATIVO', email: { not: '' }, cargo: { in: [...CARGOS_DESTINO_EXECUTIVO, ...CARGOS_COPIA_EXECUTIVO] } },
    select: { email: true, cargo: true },
  });
  let para = ativos.filter(u => CARGOS_DESTINO_EXECUTIVO.includes(u.cargo || '')).map(u => u.email);
  let copia = ativos.filter(u => CARGOS_COPIA_EXECUTIVO.includes(u.cargo || '')).map(u => u.email).filter(e => !para.includes(e));
  if (opts.somenteEmail) { para = [opts.somenteEmail]; copia = []; } // envio de teste
  if (!para.length) return { ok: false, error: 'Nenhum destinatário (CEO ativo) encontrado.' };

  const dados = await montarDadosPainelTv(prisma);
  const dataTxt = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const link = (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com';
  const r = await enviarEmailSmtp({
    to: para, cc: copia,
    subject: assuntoResumoExecutivo(dados, dataTxt),
    html: montarHtmlResumoExecutivo(dados, dataTxt, `${link}/tv`),
    rotulo: 'EXECUTIVO',
  });
  if (r.ok) console.log(`[EXECUTIVO] Resumo enviado para ${para.join(', ')}${copia.length ? ` (cópia: ${copia.join(', ')})` : ''}`);
  return { ...r, para, copia };
}
