import type { PrismaClient } from '@prisma/client';
import { montarDadosPainelTv, STATUS_FECHADA } from '@/routes/painel-tv';
import {
  montarHtmlResumoExecutivo, assuntoResumoExecutivo, montarHtmlResumoSemanal, assuntoResumoSemanal,
  calcularEficiencia, diaDaSemanaSP, type DadosSemana,
} from '@/lib/resumo-executivo';
import { limitesPeriodo, CARGOS_EQUIPE_TV, ehSaidaHumana, iniciadaPor, primeiroNome, valorInstalacao, soma, dataFechamento, dentro, type MsgResumo } from '@/lib/painel-tv';
import { enviarEmailSmtp } from './notification.service';

// Resumo executivo: vai para a diretoria (cargo CEO) com cópia para a supervisão
// comercial. Seg–qui às 18h o do dia; sexta às 18h o da semana (ver lib/resumo-executivo).
export const CARGOS_DESTINO_EXECUTIVO = ['CEO'];
export const CARGOS_COPIA_EXECUTIVO = ['SUPERVISAO_COMERCIAL'];

const fmtDia = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** Números da semana corrente (segunda 00:00 até agora, fuso de São Paulo). */
export async function montarDadosSemana(prisma: PrismaClient, agora = new Date()): Promise<DadosSemana> {
  const { inicioHoje, fimHoje } = limitesPeriodo(agora);
  const diasDesdeSegunda = (diaDaSemanaSP(agora) + 6) % 7;
  const inicio = new Date(inicioHoje.getTime() - diasDesdeSegunda * 86400000);
  const semana = { gte: inicio, lt: fimHoje };

  const leads = await prisma.lead.findMany({ where: { deleted_at: null, created_at: semana }, select: { origem: true } });
  const por_origem: Record<string, number> = {};
  leads.forEach(l => { const o = (l.origem || 'MANUAL').toUpperCase(); por_origem[o] = (por_origem[o] || 0) + 1; });
  const obs = await prisma.leadObservacao.findMany({ where: { created_at: semana, created_by: 'bot', created_by_name: 'Triagem automática' }, select: { lead_id: true } });

  const enviadas = await prisma.propostaHistorico.count({ where: { created_at: semana, tipo: 'STATUS', valor_novo: 'ENVIADA' } });
  const fechadas = (await prisma.propostaComercial.findMany({
    where: { status: { in: STATUS_FECHADA }, deleted_at: null, OR: [{ data_aceite: semana }, { AND: [{ data_aceite: null }, { created_at: semana }] }] },
    select: { data_aceite: true, created_at: true, valor_implantacao: true, valor_final: true, vendedor_id: true, created_by: true },
  })).filter(p => dentro(dataFechamento(p), inicio, fimHoje));
  const propostasCriadas = await prisma.propostaComercial.findMany({ where: { deleted_at: null, created_at: semana }, select: { vendedor_id: true, created_by: true } });

  const conversas = await prisma.whatsappConversa.findMany({
    where: { created_at: semana },
    select: { mensagens: { select: { direcao: true, enviada_por: true, created_at: true }, orderBy: { created_at: 'asc' }, take: 20 } },
  });
  const saidas = (await prisma.whatsappMensagem.findMany({ where: { direcao: 'SAIDA', created_at: semana }, select: { conversaId: true, enviada_por: true, direcao: true, created_at: true } }))
    .filter(m => ehSaidaHumana(m as MsgResumo));
  const respondidasPor: Record<string, Set<string>> = {};
  saidas.forEach(m => { if (m.enviada_por) (respondidasPor[m.enviada_por] ||= new Set()).add(m.conversaId); });

  // Atividades que contam na semana: com prazo na semana ou concluídas na semana.
  const atividades = await prisma.atividade.findMany({
    where: { status: { not: 'CANCELADA' }, OR: [{ data_prevista: semana }, { status: 'REALIZADA', data_realizada: semana }] },
    select: { responsavel_id: true, status: true, titulo: true, tipo: true, data_prevista: true, data_realizada: true },
  });

  const time = await prisma.usuarioCRM.findMany({ where: { status: 'ATIVO', cargo: { in: CARGOS_EQUIPE_TV } }, select: { id: true, nome: true, cargo: true }, orderBy: { nome: 'asc' } });
  const dono = (p: { vendedor_id?: string | null; created_by?: string | null }) => p.vendedor_id || p.created_by;
  const equipe = time.map(u => {
    const minhas = atividades.filter(a => a.responsavel_id === u.id);
    return {
      nome: primeiroNome(u.nome), cargo: u.cargo || '',
      conversas_respondidas: respondidasPor[u.id]?.size || 0,
      propostas: propostasCriadas.filter(p => dono(p) === u.id).length,
      contratos: fechadas.filter(p => dono(p) === u.id).length,
      eficiencia: calcularEficiencia(minhas, agora),
      concluidas: minhas.filter(a => a.status === 'REALIZADA' && a.data_realizada && dentro(a.data_realizada, inicio, fimHoje)).map(a => a.titulo),
    };
  });

  return {
    periodo: `${fmtDia(inicio)} a ${fmtDia(agora)}`,
    leads_novos: leads.length, por_origem, qualificados: new Set(obs.map(o => o.lead_id)).size,
    propostas_enviadas: enviadas, contratos: fechadas.length, faturamento_instalacao: soma(fechadas.map(valorInstalacao)),
    conversas_iniciadas: conversas.filter(c => iniciadaPor(c.mensagens as MsgResumo[]) !== null).length,
    conversas_respondidas: new Set(saidas.map(m => m.conversaId)).size,
    equipe,
    eficiencia_geral: calcularEficiencia(atividades.filter(a => time.some(u => u.id === a.responsavel_id)), agora),
  };
}

export async function enviarResumoExecutivo(prisma: PrismaClient, opts: { somenteEmail?: string; tipo?: 'diario' | 'semanal' } = {}) {
  const ativos = await prisma.usuarioCRM.findMany({
    where: { status: 'ATIVO', email: { not: '' }, cargo: { in: [...CARGOS_DESTINO_EXECUTIVO, ...CARGOS_COPIA_EXECUTIVO] } },
    select: { email: true, cargo: true },
  });
  let para = ativos.filter(u => CARGOS_DESTINO_EXECUTIVO.includes(u.cargo || '')).map(u => u.email);
  let copia = ativos.filter(u => CARGOS_COPIA_EXECUTIVO.includes(u.cargo || '')).map(u => u.email).filter(e => !para.includes(e));
  if (opts.somenteEmail) { para = [opts.somenteEmail]; copia = []; } // envio de teste
  if (!para.length) return { ok: false, error: 'Nenhum destinatário (CEO ativo) encontrado.' };

  const painel = await montarDadosPainelTv(prisma);
  const link = `${(process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com'}/tv`;
  let subject: string, html: string;
  if (opts.tipo === 'semanal') {
    const semana = await montarDadosSemana(prisma);
    subject = assuntoResumoSemanal(semana);
    html = montarHtmlResumoSemanal(semana, painel, link);
  } else {
    const dataTxt = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    subject = assuntoResumoExecutivo(painel, dataTxt);
    html = montarHtmlResumoExecutivo(painel, dataTxt, link);
  }
  const r = await enviarEmailSmtp({ to: para, cc: copia, subject, html, rotulo: 'EXECUTIVO' });
  if (r.ok) console.log(`[EXECUTIVO] Resumo ${opts.tipo || 'diario'} enviado para ${para.join(', ')}${copia.length ? ` (cópia: ${copia.join(', ')})` : ''}`);
  return { ...r, para, copia };
}
