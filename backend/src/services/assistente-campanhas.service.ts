import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { garantirConversa, registrarSaida } from './assistente-posvenda.service';
import {
  montarPublico, textoPersonalizado, ehPedidoDeSaida, ultimos8, ENVIOS_POR_RODADA, type Publico,
} from '@/lib/assistente/campanhas';

// Campanhas pelo WhatsApp (Fase 4): a gestão escolhe o público e o texto; a fila
// manda ~24 por hora em horário comercial; "SAIR" tira o contato das próximas.

export const REMETENTE_CAMPANHA = 'campanha';
const FECHADAS = ['FECHADO', 'PERDIDO', 'ACEITO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO', 'ONBOARDING', 'EXECUCAO_TECNICA'];

export type FiltroCampanha = { publico: Publico; segmento?: string | null; dias_parado?: number | null };

async function contatosDoPublico(prisma: PrismaClient, f: FiltroCampanha) {
  const seg = (f.segmento || '').trim();
  if (f.publico === 'CLIENTES') {
    // Clientes ativos. O telefone do cadastro costuma estar sem DDD, então as melhores
    // fontes vêm primeiro: contatos do cliente (têm nome) e conversas de WhatsApp vinculadas.
    const whereCli = { situacao: 'ATIVA', ...(seg ? { segmento: { contains: seg } } : {}) };
    const cs = await prisma.cliente.findMany({ where: whereCli, select: { id: true, telefone: true, nome_fantasia: true, razao_social: true, nome: true }, take: 5000 });
    const ids = cs.map(c => c.id);
    const rotulo = new Map(cs.map(c => [c.id, (c.nome_fantasia || c.razao_social || c.nome || '').trim()]));
    const contatos = await prisma.contatoCliente.findMany({ where: { cliente_id: { in: ids }, telefone: { not: null } }, select: { cliente_id: true, nome: true, telefone: true } });
    const conversas = await prisma.whatsappConversa.findMany({ where: { cliente_id: { in: ids } }, select: { cliente_id: true, contato_nome: true, contato_numero: true } });
    return [
      ...contatos.map(c => ({ telefone: c.telefone, nome: c.nome as string | null, rotulo: rotulo.get(c.cliente_id) || '', lead_id: null as string | null, tipo: 'CLIENTE' as const })),
      ...conversas.map(c => ({ telefone: c.contato_numero, nome: c.contato_nome as string | null, rotulo: rotulo.get(c.cliente_id!) || '', lead_id: null as string | null, tipo: 'CLIENTE' as const })),
      ...cs.map(c => ({ telefone: c.telefone, nome: null as string | null, rotulo: rotulo.get(c.id) || '', lead_id: null as string | null, tipo: 'CLIENTE' as const })),
    ];
  }
  const dias = Math.max(7, Math.min(365, f.dias_parado || 30));
  const ls = await prisma.lead.findMany({
    where: {
      deleted_at: null, etapa_comercial: { notIn: FECHADAS }, updated_at: { lt: new Date(Date.now() - dias * 86400000) },
      ...(seg ? { segmento: { contains: seg } } : {}),
    },
    select: { id: true, responsavel_nome: true, nome: true, nome_fantasia: true, razao_social: true, responsavel_telefone: true, telefone: true },
    orderBy: { updated_at: 'desc' }, take: 3000,
  });
  return ls.map(l => ({ telefone: l.responsavel_telefone || l.telefone, nome: l.responsavel_nome || null, rotulo: (l.nome_fantasia || l.razao_social || l.nome || '').trim(), lead_id: l.id, tipo: 'LEAD' as const }));
}

async function numerosQueSairam(prisma: PrismaClient) {
  const cs = await prisma.whatsappConversa.findMany({ where: { optout_campanhas: true }, select: { contato_numero: true } });
  return cs.map(c => c.contato_numero);
}

export async function previaCampanha(prisma: PrismaClient, f: FiltroCampanha) {
  const contatos = await contatosDoPublico(prisma, f);
  const lista = montarPublico(contatos.map(c => ({ telefone: c.telefone, nome: c.rotulo || c.nome })), await numerosQueSairam(prisma));
  return { total: lista.length, amostra: lista.slice(0, 8).map(x => x.nome || x.numero) };
}

export async function criarCampanha(prisma: PrismaClient, f: FiltroCampanha & { nome: string; texto: string }, userId: string) {
  const contatos = await contatosDoPublico(prisma, f);
  const lista = montarPublico(contatos.map(c => ({ telefone: c.telefone, nome: c.nome })), await numerosQueSairam(prisma));
  if (!lista.length) throw new Error('Nenhum celular válido nesse público.');
  const camp = await prisma.campanhaWhatsapp.create({
    data: {
      nome: f.nome.trim().slice(0, 120), publico: f.publico, filtros: { segmento: f.segmento || null, dias_parado: f.dias_parado || null },
      texto: f.texto, total: lista.length, criado_por: userId,
    },
  });
  await prisma.campanhaEnvio.createMany({
    data: lista.map(x => ({ campanhaId: camp.id, numero: x.numero, nome: x.nome || null })),
  });
  return camp;
}

/** Fila: até ENVIOS_POR_RODADA mensagens por rodada (a cada 10 min, horário comercial). */
export async function processarFilaCampanhas(prisma: PrismaClient): Promise<number> {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return 0;
  const envios = await prisma.campanhaEnvio.findMany({
    where: { status: 'PENDENTE', campanha: { status: 'ENVIANDO' } },
    include: { campanha: { select: { id: true, texto: true, publico: true } } },
    orderBy: { id: 'asc' }, take: ENVIOS_POR_RODADA,
  });
  const sairam = new Set((await numerosQueSairam(prisma)).map(ultimos8));
  let n = 0;
  for (const e of envios) {
    if (sairam.has(ultimos8(e.numero))) { await prisma.campanhaEnvio.update({ where: { id: e.id }, data: { status: 'IGNORADO', erro: 'pediu para sair' } }); continue; }
    try {
      const tipo = e.campanha.publico === 'CLIENTES' ? 'CLIENTE' : 'LEAD';
      const lead = tipo === 'LEAD' ? await prisma.lead.findFirst({ where: { OR: [{ responsavel_telefone: { endsWith: ultimos8(e.numero).slice(-4) } }, { telefone: { endsWith: ultimos8(e.numero).slice(-4) } }], deleted_at: null }, select: { id: true, responsavel_telefone: true, telefone: true } }) : null;
      const leadId = lead && [lead.responsavel_telefone, lead.telefone].some(t => ultimos8((t || '').replace(/\D/g, '')) === ultimos8(e.numero)) ? lead.id : null;
      const conv = await garantirConversa(prisma, inst.id, e.numero, { nome: e.nome, tipo_contato: tipo, lead_id: leadId });
      const texto = textoPersonalizado(e.campanha.texto, e.nome); // nome da PESSOA (ou saudação sem nome)
      const r = await evo.enviarTexto(inst.instance_token, e.numero, texto);
      await registrarSaida(prisma, conv.id, texto, r.externo_id, REMETENTE_CAMPANHA);
      await prisma.campanhaEnvio.update({ where: { id: e.id }, data: { status: 'ENVIADO', enviado_em: new Date() } });
      n++;
    } catch (err: any) {
      await prisma.campanhaEnvio.update({ where: { id: e.id }, data: { status: 'FALHA', erro: String(err?.message || err).slice(0, 300) } });
    }
  }
  // Campanhas sem pendentes: concluídas.
  const ativas = await prisma.campanhaWhatsapp.findMany({ where: { status: 'ENVIANDO' }, select: { id: true, _count: { select: { envios: { where: { status: 'PENDENTE' } } } } } });
  for (const c of ativas) if (c._count.envios === 0) await prisma.campanhaWhatsapp.update({ where: { id: c.id }, data: { status: 'CONCLUIDA' } });
  if (n) console.log(`[CAMPANHA] ${n} mensagem(ns) enviada(s)`);
  return n;
}

/** "SAIR" de quem recebeu campanha: marca e confirma. true = consumida. */
export async function responderSaida(prisma: PrismaClient, token: string, conversaId: string, numero: string, texto: string): Promise<boolean> {
  if (!ehPedidoDeSaida(texto)) return false;
  const recebeu = await prisma.campanhaEnvio.findFirst({ where: { numero: { endsWith: ultimos8(numero) }, status: 'ENVIADO' }, select: { id: true } });
  if (!recebeu) return false;
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { optout_campanhas: true } });
  const resp = 'Pronto! Você não vai mais receber estas mensagens. Se precisar de algo, é só chamar por aqui. 💙';
  const r = await evo.enviarTexto(token, numero, resp).catch(() => ({} as any));
  await registrarSaida(prisma, conversaId, resp, r.externo_id, 'bot');
  return true;
}

export async function listarCampanhas(prisma: PrismaClient) {
  const cs = await prisma.campanhaWhatsapp.findMany({ orderBy: { created_at: 'desc' }, take: 30 });
  const contagens = await prisma.campanhaEnvio.groupBy({ by: ['campanhaId', 'status'], where: { campanhaId: { in: cs.map(c => c.id) } }, _count: { _all: true } });
  return cs.map(c => {
    const por = (s: string) => contagens.find(x => x.campanhaId === c.id && x.status === s)?._count._all || 0;
    return { ...c, enviados: por('ENVIADO'), pendentes: por('PENDENTE'), falhas: por('FALHA'), ignorados: por('IGNORADO') };
  });
}
