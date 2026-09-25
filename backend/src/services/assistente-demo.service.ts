import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { serializarPorChave } from '@/lib/serializar';
import { chaveConversa } from './whatsapp-confirmacao-cliente.service';
import {
  gerarHorarios, menuHorarios, lerBotaoDemo, querRemarcar, textoConfirmacaoDemo, textoLembreteDemo,
  TEXTO_HORARIO_OCUPADO, TEXTO_SEM_HORARIOS, DURACAO_MIN, ANTECEDENCIA_MIN,
} from '@/lib/assistente/demo';

// Demonstração marcada pelo lead (Fase 1, entrega 3). A reunião só é criada
// quando o PRÓPRIO lead escolhe o horário (exceção aprovada à regra de "nenhuma
// atividade automática"). Estado em bot_dados.demo: { oferecida_em, atividade_id }.

const STATUS_ATIVOS = ['PENDENTE', 'CONFIRMADA'];

async function gravarSaidaBot(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id?: string) {
  await prisma.whatsappMensagem.create({ data: { conversaId, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo, status: 'ENVIADA', enviada_por: 'bot' } })
    .catch((e: any) => console.error('[DEMO] gravar saída:', e?.message));
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: conteudo.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
}

async function horariosOcupados(prisma: PrismaClient, agora: Date) {
  const rs = await prisma.atividade.findMany({
    where: { tipo: 'REUNIAO', status: { in: STATUS_ATIVOS }, data_prevista: { gte: new Date(agora.getTime() - 3600000), lt: new Date(agora.getTime() + 9 * 86400000) } },
    select: { data_prevista: true, duracao_minutos: true },
  });
  return rs.map(r => ({ inicio: r.data_prevista!, fim: new Date(r.data_prevista!.getTime() + (r.duracao_minutos || 60) * 60000) }));
}

async function enviarHorarios(prisma: PrismaClient, token: string, conversa: { id: string; contato_numero: string }, prefixo?: string) {
  const agora = new Date();
  const slots = gerarHorarios(agora, await horariosOcupados(prisma, agora));
  if (!slots.length) {
    const r = await evo.enviarTexto(token, conversa.contato_numero, TEXTO_SEM_HORARIOS);
    await gravarSaidaBot(prisma, conversa.id, TEXTO_SEM_HORARIOS, r.externo_id);
    return false;
  }
  const menu = menuHorarios(slots);
  if (prefixo) menu.texto = `${prefixo}\n\n${menu.texto}`;
  const r = await evo.enviarMenu(token, conversa.contato_numero, menu);
  await gravarSaidaBot(prisma, conversa.id, `${menu.texto}\n\n${menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, r.externo_id);
  return true;
}

/** Fim da triagem com lead qualificado: oferece a demo (se não houver "É a sua empresa?" pendente). */
export async function oferecerDemo(prisma: PrismaClient, token: string, conversaId: string) {
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, bot_dados: true, cliente_id: true } });
  if (!c || c.cliente_id) return;
  const dados: any = c.bot_dados || {};
  // Já é cliente, tem "É a sua empresa?" em aberto ou a demo já foi oferecida: não oferece.
  if (dados.relacao === 'cliente' || dados.confirmacao_cliente || dados.demo) return;
  const ok = await enviarHorarios(prisma, token, c);
  await prisma.whatsappConversa.update({ where: { id: c.id }, data: { bot_dados: { ...dados, demo: { oferecida_em: new Date().toISOString(), ofertas: ok ? 1 : 0 } } } });
}

/** Escolha de horário ou "remarcar". true = mensagem consumida. */
export async function responderDemo(prisma: PrismaClient, token: string, conversaId: string, texto: string, botaoId?: string | null): Promise<boolean> {
  const quando = lerBotaoDemo(botaoId);
  if (!quando && !querRemarcar(texto)) return false;
  return serializarPorChave(chaveConversa(conversaId), async () => {
    const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, contato_nome: true, bot_dados: true, dono_id: true, lead_id: true } });
    if (!c) return false;
    const dados: any = c.bot_dados || {};
    if (!dados.demo) return false; // demo nunca oferecida nesta conversa: segue o fluxo normal

    if (!quando) { // remarcar
      if (!dados.demo.atividade_id) return false;
      await prisma.atividade.updateMany({ where: { id: dados.demo.atividade_id, status: { in: STATUS_ATIVOS } }, data: { status: 'REMARCADA' } });
      await prisma.whatsappConversa.update({ where: { id: c.id }, data: { bot_dados: { ...dados, demo: { ...dados.demo, atividade_id: null } } } });
      await enviarHorarios(prisma, token, c, 'Sem problemas! Vamos escolher outro horário.');
      emitirEventoConversa(c.dono_id, 'conversa_atualizada', { conversaId: c.id });
      return true;
    }

    const agora = new Date();
    const fim = new Date(quando.getTime() + DURACAO_MIN * 60000);
    const conflito = (await horariosOcupados(prisma, agora)).some(o => quando < o.fim && fim > o.inicio);
    if (conflito || quando.getTime() < agora.getTime() + (ANTECEDENCIA_MIN - 30) * 60000) {
      await enviarHorarios(prisma, token, c, TEXTO_HORARIO_OCUPADO);
      return true;
    }
    // Troca de horário sem "remarcar": a reunião anterior sai da agenda.
    if (dados.demo.atividade_id) {
      await prisma.atividade.updateMany({ where: { id: dados.demo.atividade_id, status: { in: STATUS_ATIVOS } }, data: { status: 'REMARCADA' } });
    }
    const responsavel = c.dono_id || (await prisma.usuarioCRM.findFirst({ where: { status: 'ATIVO', cargo: 'SUPERVISAO_COMERCIAL' }, select: { id: true } }))?.id || null;
    const lead = c.lead_id ? await prisma.lead.findUnique({ where: { id: c.lead_id }, select: { nome_fantasia: true, razao_social: true, empresa: true } }).catch(() => null) : null;
    const empresa = (lead?.nome_fantasia || lead?.razao_social || lead?.empresa || c.contato_nome || c.contato_numero).trim();
    const at = await prisma.atividade.create({
      data: {
        lead_id: c.lead_id || null, vinculo_tipo: c.lead_id ? 'LEAD' : 'NENHUM', vinculo_nome: c.lead_id ? null : empresa,
        tipo: 'REUNIAO', titulo: `Demonstração Prosystem · ${empresa}`,
        descricao: `Marcada pelo próprio contato no WhatsApp (${c.contato_numero}).`,
        status: 'PENDENTE', data_prevista: quando, duracao_minutos: DURACAO_MIN,
        responsavel_id: responsavel, created_by: 'lead_whatsapp', whatsapp_conversa_id: c.id,
      },
    });
    await prisma.whatsappConversa.update({ where: { id: c.id }, data: { bot_dados: { ...dados, demo: { ...dados.demo, atividade_id: at.id, marcada_para: quando.toISOString() } } } });
    const conf = textoConfirmacaoDemo(quando);
    const r = await evo.enviarTexto(token, c.contato_numero, conf);
    await gravarSaidaBot(prisma, c.id, conf, r.externo_id);
    emitirEventoConversa(c.dono_id, 'conversa_atualizada', { conversaId: c.id });
    return true;
  });
}

/** Lembrete pelo WhatsApp 2h antes das demos marcadas pelo lead. */
export async function enviarLembretesDemo(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return 0;
  const ats = await prisma.atividade.findMany({
    where: {
      tipo: 'REUNIAO', status: { in: STATUS_ATIVOS }, whatsapp_conversa_id: { not: null }, lembrete_whatsapp_em: null,
      data_prevista: { gt: agora, lte: new Date(agora.getTime() + 2 * 3600000) },
    },
    select: { id: true, data_prevista: true, google_meet_link: true, link_externo: true, whatsapp_conversa_id: true },
  });
  let n = 0;
  for (const a of ats) {
    const c = await prisma.whatsappConversa.findUnique({ where: { id: a.whatsapp_conversa_id! }, select: { id: true, contato_numero: true } });
    if (!c) continue;
    const texto = textoLembreteDemo(a.data_prevista!, a.google_meet_link || a.link_externo || null);
    try {
      const r = await evo.enviarTexto(inst.instance_token, c.contato_numero, texto);
      await gravarSaidaBot(prisma, c.id, texto, r.externo_id);
      await prisma.atividade.update({ where: { id: a.id }, data: { lembrete_whatsapp_em: new Date() } });
      n++;
    } catch (e: any) { console.error(`[DEMO] lembrete ${a.id}:`, e?.message); }
  }
  return n;
}
