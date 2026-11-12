import type { PrismaClient } from '@prisma/client';
import { alertaDevido, textoAlertaCompromisso, JANELA_ATRASO_MIN } from '@/lib/implantacao/agenda-tecnico';
import { avisarTecnico, URL_FRONT } from './implantacao-portal.service';

/**
 * Agenda do técnico: a cada minuto, manda o alerta dos compromissos que chegaram na hora (ou na antecedência
 * escolhida). O alerta vai para o WhatsApp do técnico, para o sino do portal e como notificação no celular.
 * Cada compromisso avisa uma vez só: o registro é "reservado" (alerta_em) antes do envio, então duas cópias do
 * servidor rodando juntas não mandam duas vezes.
 */
export async function rodarAlertasAgenda(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const candidatos = await prisma.agendaTecnico.findMany({
    where: {
      status: 'AGENDADO', alerta_em: null,
      inicio: { gte: new Date(agora.getTime() - JANELA_ATRASO_MIN * 60000), lte: new Date(agora.getTime() + 1441 * 60000) },
    },
    take: 200,
  });
  let enviados = 0;
  for (const c of candidatos.filter(x => alertaDevido(x, agora))) {
    const reservou = await prisma.agendaTecnico.updateMany({ where: { id: c.id, alerta_em: null, status: 'AGENDADO' }, data: { alerta_em: agora } });
    if (reservou.count !== 1) continue;
    const link = `${URL_FRONT()}/portal-tecnico?tab=agenda`;
    const r = await avisarTecnico(prisma, {
      para_id: c.tecnico_id, implantacao_id: c.implantacao_id, origem: 'SISTEMA',
      titulo: '⏰ Lembrete da sua agenda', texto: textoAlertaCompromisso(c, link, agora), forcarWhatsapp: true, url: '/portal-tecnico?tab=agenda',
    }).catch((e: any) => { console.error('[AGENDA] alerta:', e?.message); return null; });
    const status = !r ? 'FALHOU' : r.whatsapp === 'ENVIADO' ? 'ENVIADO' : r.whatsapp === 'SEM_TELEFONE' ? 'SEM_TELEFONE' : 'FALHOU';
    await prisma.agendaTecnico.update({ where: { id: c.id }, data: { alerta_status: status } }).catch(() => null);
    enviados++;
  }
  return enviados;
}
