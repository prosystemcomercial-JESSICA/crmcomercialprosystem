import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { ehPedidoDeSaida, ultimos8 } from '@/lib/assistente/campanhas';
import { REMETENTES_AUTOMATICOS } from '@/lib/painel-tv';
import { registrarMudancaTemperatura } from '@/lib/lead-temperatura';
import {
  lerLeadsColados, horarioComercial, limiteDoDia, intervaloSorteado, tempoDigitando, deveRetomar, diasUteisEntre,
  lerRespostaCaroline, temperaturaDaNota, promptCaroline, saudacaoAgora, ABERTURA_JESSICA, TENTATIVAS_MAX,
  type RespostaCaroline, type FaseCaroline,
} from '@/lib/assistente/sdr';

// Caroline, a SDR: recebe os leads das campanhas (colados pela Jessica), faz o
// primeiro contato pelo WhatsApp da empresa com ritmo seguro, conversa pela IA
// buscando a dor principal, dá a nota de interesse e termina em demonstração,
// vendedora ou encerramento. Uma pessoa assumiu a conversa → ela sai na hora.

export const REMETENTE_CAROLINE = 'caroline';
const CHAVE_CFG = 'assistente.caroline';
const ATIVOS = ['FILA', 'AGUARDANDO', 'CONVERSANDO'];

export type ConfigCaroline = { ativa: boolean; aprovar: boolean; limite: number; ativada_em: string | null; pausada_motivo: string | null };
const PADRAO: ConfigCaroline = { ativa: false, aprovar: true, limite: 30, ativada_em: null, pausada_motivo: null };

export async function obterConfigCaroline(prisma: PrismaClient): Promise<ConfigCaroline> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_CFG } }).catch(() => null);
  try { return { ...PADRAO, ...(r?.valor ? JSON.parse(r.valor) : {}) }; } catch { return { ...PADRAO }; }
}

export async function salvarConfigCaroline(prisma: PrismaClient, novo: Partial<ConfigCaroline>, userId: string) {
  const atual = await obterConfigCaroline(prisma);
  const cfg: ConfigCaroline = { ...atual, ...novo };
  if (novo.ativa && !atual.ativa) { cfg.pausada_motivo = null; if (!cfg.ativada_em) cfg.ativada_em = new Date().toISOString(); }
  cfg.limite = Math.max(1, Math.min(30, Math.round(cfg.limite || 30)));
  const valor = JSON.stringify(cfg);
  await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE_CFG }, create: { chave: CHAVE_CFG, valor, updated_by: userId }, update: { valor, updated_by: userId } });
  return cfg;
}

// ── Entrada dos leads ───────────────────────────────────────────────────────

async function acharLead(prisma: PrismaClient, numero: string) {
  const fim = ultimos8(numero);
  const cs = await prisma.lead.findMany({ where: { deleted_at: null, OR: [{ telefone: { contains: fim.slice(-4) } }, { responsavel_telefone: { contains: fim.slice(-4) } }] }, select: { id: true, nome: true, telefone: true, responsavel_telefone: true, responsavel_id: true, vendedor_nome: true, etapa_comercial: true }, take: 50 });
  return cs.find(l => [l.telefone, l.responsavel_telefone].some(t => ultimos8((t || '').replace(/\D/g, '')) === fim)) || null;
}

export async function previaLeads(prisma: PrismaClient, texto: string) {
  const inst = await obterInstanciaEmpresa(prisma);
  const itens = lerLeadsColados(texto);
  return Promise.all(itens.map(async l => {
    const avisos: string[] = [];
    if (!l.numero) avisos.push('Telefone inválido: não dá para chamar no WhatsApp.');
    let lead = null, conversa = null, jaNaCaroline = false;
    if (l.numero) {
      lead = await acharLead(prisma, l.numero);
      if (lead) avisos.push(`Já existe o lead "${lead.nome}"${lead.vendedor_nome ? ` (com ${lead.vendedor_nome})` : ''}: será vinculado, sem duplicar.`);
      if (inst) {
        const cs = await prisma.whatsappConversa.findMany({ where: { instanciaId: inst.id, contato_numero: { endsWith: ultimos8(l.numero) } }, select: { id: true, dono_id: true, contato_numero: true, _count: { select: { mensagens: true } } } });
        conversa = cs.find(c => ultimos8(c.contato_numero) === ultimos8(l.numero!)) || null;
        if (conversa?._count.mensagens) avisos.push(`Já há conversa com ${conversa._count.mensagens} mensagem(ns) no WhatsApp da empresa: a Caroline continua de onde parou.`);
      }
      jaNaCaroline = !!(await prisma.sdrLead.findFirst({ where: { numero: { endsWith: ultimos8(l.numero) }, status: { in: ATIVOS } }, select: { id: true } }));
      if (jaNaCaroline) avisos.push('Este número já está com a Caroline.');
    }
    return { ...l, avisos, pode: !!l.numero && !jaNaCaroline };
  }));
}

/** Cria/vincula os leads e põe na fila da Caroline. */
export async function importarLeads(prisma: PrismaClient, texto: string, aberturaEnviada: boolean, user: { id: string; nome?: string }) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst) throw new Error('O WhatsApp da empresa não está configurado.');
  const prev = await previaLeads(prisma, texto);
  let criados = 0;
  for (const l of prev.filter(x => x.pode)) {
    const numero = l.numero!;
    let lead = await acharLead(prisma, numero);
    if (!lead) {
      const novo = await prisma.lead.create({
        data: {
          nome: l.empresa || l.nome || numero, empresa: l.empresa, responsavel_nome: l.nome, responsavel_telefone: numero, telefone: numero,
          responsavel_email: l.email, email: l.email, segmento: l.segmento, origem: 'CAMPANHA', temperatura: 'MORNO',
          utm_source: l.origem || 'facebook', utm_campaign: l.campanha, campanha_nome: l.campanha, plataforma: 'Facebook/Instagram Ads', link_origem: l.url,
          observacoes: `Lead de campanha${l.cadastro_em ? ` (inscrição em ${l.cadastro_em.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})` : ''}. Primeiro contato com a Caroline (SDR).`,
          created_by: user.id,
        } as any,
        select: { id: true },
      });
      lead = { id: novo.id } as any;
    }
    // Conversa no WhatsApp da empresa (reaproveita a existente, mesmo número com/sem 9).
    const cs = await prisma.whatsappConversa.findMany({ where: { instanciaId: inst.id, contato_numero: { endsWith: ultimos8(numero) } }, select: { id: true, contato_numero: true, dono_id: true } });
    let conv = cs.find(c => ultimos8(c.contato_numero) === ultimos8(numero)) || null;
    if (!conv) {
      conv = await prisma.whatsappConversa.create({
        data: { instanciaId: inst.id, contato_numero: numero, contato_nome: l.nome, tipo_contato: 'LEAD', lead_id: lead!.id, bot_ativo: false, nao_lidas: 0 },
        select: { id: true, contato_numero: true, dono_id: true },
      });
    } else {
      // Passar para a Caroline = a conversa fica com ela (sem dono), vinculada ao lead.
      await prisma.whatsappConversa.update({ where: { id: conv.id }, data: { lead_id: lead!.id, tipo_contato: 'LEAD', contato_nome: l.nome || undefined, dono_id: null, bot_ativo: false } });
    }
    const temMsgs = await prisma.whatsappMensagem.count({ where: { conversaId: conv.id } });
    // Abertura que a Jessica mandou pelo celular antes do CRM registrar: guarda no histórico.
    if (aberturaEnviada && !temMsgs) {
      await prisma.whatsappMensagem.create({ data: { conversaId: conv.id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: ABERTURA_JESSICA(l.nome, l.segmento), status: 'ENVIADA', enviada_por: 'abertura_jessica' } });
    }
    await prisma.sdrLead.create({
      data: {
        lead_id: lead!.id, conversaId: conv.id, numero, nome: l.nome, empresa: l.empresa, email: l.email, segmento: l.segmento, campanha: l.campanha,
        cadastro_em: l.cadastro_em, abertura_enviada: aberturaEnviada, status: 'FILA', tentativas: aberturaEnviada ? 1 : 0,
        ultima_caroline_em: aberturaEnviada ? new Date() : null, criado_por: user.id,
      },
    });
    criados++;
  }
  registrarAcaoAgente('caroline', `recebeu ${criados} lead(s) para o primeiro contato`);
  return { criados, ignorados: prev.length - criados };
}

// ── Regras da conversa ──────────────────────────────────────────────────────

/** Uma pessoa assumiu depois que a Caroline pegou a conversa? (dono ou mensagem humana). */
async function pessoaAssumiu(prisma: PrismaClient, sdr: { conversaId: string | null; desde: Date }): Promise<boolean> {
  if (!sdr.conversaId) return false;
  const c = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { dono_id: true } });
  if (c?.dono_id) return true;
  const humana = await prisma.whatsappMensagem.findFirst({
    where: {
      conversaId: sdr.conversaId, direcao: 'SAIDA', created_at: { gt: sdr.desde },
      OR: [{ enviada_por: null }, { enviada_por: { notIn: [...REMETENTES_AUTOMATICOS, REMETENTE_CAROLINE, 'abertura_jessica', 'assistente_ia'] } }],
    },
    select: { id: true },
  });
  return !!humana;
}

async function historico(prisma: PrismaClient, conversaId: string) {
  const ms = await prisma.whatsappMensagem.findMany({ where: { conversaId }, orderBy: { created_at: 'desc' }, take: 14, select: { direcao: true, tipo: true, conteudo: true, transcricao: true, enviada_por: true, midia_url: true } });
  const linhas = ms.reverse().map(m => {
    const quem = m.direcao === 'ENTRADA' ? 'Cliente' : m.enviada_por === REMETENTE_CAROLINE ? 'Caroline' : m.enviada_por === 'abertura_jessica' || !m.enviada_por ? 'Jessica' : 'Empresa';
    const txt = m.tipo === 'AUDIO' ? `[áudio] ${m.transcricao || '(sem transcrição)'}` : m.tipo === 'IMAGEM' ? `[foto] ${m.conteudo || ''}` : (m.conteudo || '');
    return `${quem}: ${txt.replace(/\s+/g, ' ').trim().slice(0, 600)}`;
  });
  const ultimaFoto = ms.filter(m => m.direcao === 'ENTRADA' && m.tipo === 'IMAGEM' && (m.midia_url || '').startsWith('data:')).pop();
  return { texto: linhas.join('\n'), foto: ultimaFoto?.midia_url || null };
}

async function exemplosEditados(prisma: PrismaClient) {
  const xs = await prisma.sdrMensagem.findMany({ where: { status: 'EDITADA' }, orderBy: { decidido_em: 'desc' }, take: 6, select: { texto: true, texto_final: true } });
  return xs.filter(x => x.texto_final).map(x => ({ antes: x.texto.slice(0, 400), depois: x.texto_final!.slice(0, 400) }));
}

async function gerarResposta(prisma: PrismaClient, sdr: any, fase: FaseCaroline): Promise<RespostaCaroline | null> {
  const { guiaComercial } = await import('./assistente-ia.service');
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const { chamarGemini } = await import('./ia-gemini.service');
  const h = await historico(prisma, sdr.conversaId);
  // Assuntos da semana da Sofia (últimos 14 dias): só do segmento exato do lead e de gestão
  // (farmácia não recebe assunto de manipulação; assunto clínico/de produto fica de fora).
  const pesquisas = await prisma.pesquisaSetor.findMany({ where: { created_at: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { created_at: 'desc' }, take: 3, select: { itens: true } }).catch(() => []);
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const seg = norm(sdr.segmento || '');
  const atualidades = pesquisas.flatMap(x => (Array.isArray(x.itens) ? x.itens : []) as any[])
    .filter(i => {
      const s = norm(String(i?.segmento || ''));
      return i?.titulo && (s === seg || s.startsWith('gest'));
    })
    .slice(0, 6).map(i => ({ segmento: String(i.segmento || ''), titulo: String(i.titulo), resumo: String(i.resumo || '').slice(0, 300), por_que_importa: String(i.por_que_importa || '').slice(0, 200) }));
  const p = promptCaroline({
    guia: await guiaComercial(prisma), instrucoes: await instrucoesPara(prisma, 'caroline'), exemplos: await exemplosEditados(prisma),
    historico: h.texto, fase, saudacao: saudacaoAgora(new Date()), atualidades,
    lead: { nome: sdr.nome, empresa: sdr.empresa, segmento: sdr.segmento, campanha: sdr.campanha, abertura_jessica: sdr.abertura_enviada, tentativa: sdr.tentativas },
  });
  const partes: any[] = [{ text: p.usuario }];
  const dm = h.foto?.match(/^data:([^;]+);base64,(.+)$/);
  if (fase === 'resposta' && dm && dm[2].length < 6_000_000) partes.push({ inline_data: { mime_type: dm[1], data: dm[2] } });
  for (let i = 0; i < 2; i++) {
    try {
      const bruto = await chamarGemini(prisma, { sistema: p.sistema, partes, json: true, temperatura: 0.5, timeoutMs: 90_000 });
      const r = lerRespostaCaroline(JSON.parse(bruto.replace(/^```(json)?|```$/g, '').trim()));
      if (r) return r;
    } catch (e: any) { console.warn('[CAROLINE] IA:', e?.message); }
  }
  return null;
}

async function enviarMensagens(prisma: PrismaClient, token: string, sdr: any, mensagens: string[]) {
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { contato_numero: true, dono_id: true } });
  if (!conv) throw new Error('Conversa não encontrada.');
  for (const m of mensagens) {
    const r = await evo.enviarTexto(token, conv.contato_numero, m, tempoDigitando(m));
    await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: m, status: 'ENVIADA', enviada_por: REMETENTE_CAROLINE } });
  }
  await prisma.whatsappConversa.update({ where: { id: sdr.conversaId }, data: { ultima_mensagem: mensagens[mensagens.length - 1].slice(0, 200), ultima_em: new Date() } });
  emitirEventoConversa(conv.dono_id, 'conversa_atualizada', { conversaId: sdr.conversaId });
}

async function atualizarTermometro(prisma: PrismaClient, sdr: any, r: RespostaCaroline) {
  const temperatura = temperaturaDaNota(r.nota);
  const dados = { ...(sdr.dados || {}), ...Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v)), ...(r.dor_principal ? { dor_principal: r.dor_principal } : {}) };
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { nota: r.nota, nota_motivo: r.nota_motivo, temperatura, dados } });
  if (sdr.lead_id) {
    const lead = await prisma.lead.findUnique({ where: { id: sdr.lead_id }, select: { temperatura: true } }).catch(() => null);
    if (lead && lead.temperatura !== temperatura) {
      await prisma.lead.update({ where: { id: sdr.lead_id }, data: { temperatura, ...(dados.cidade ? { cidade: String(dados.cidade).slice(0, 100) } : {}), ...(dados.sistema_atual ? { sistema_atual: String(dados.sistema_atual).slice(0, 100) } : {}) } as any }).catch(() => {});
      await registrarMudancaTemperatura(prisma, { leadId: sdr.lead_id, temperaturaAnterior: lead.temperatura, temperaturaNova: temperatura, autorNome: `Caroline (nota ${r.nota})` }).catch(() => {});
    }
  }
  return dados;
}

function resumoLead(sdr: any, dados: any, r: { nota: number; nota_motivo: string }) {
  return [
    `🤖 Caroline (SDR): ${sdr.nome || ''}${sdr.empresa ? ` · ${sdr.empresa}` : ''}`,
    `Termômetro: ${r.nota}/100 (${temperaturaDaNota(r.nota).replace('_', ' ').toLowerCase()}): ${r.nota_motivo || '—'}`,
    `Dor principal: ${dados.dor_principal || 'não identificada'}`,
    dados.cidade ? `Cidade: ${dados.cidade}` : null, dados.sistema_atual ? `Sistema atual: ${dados.sistema_atual}` : null,
    dados.lojas ? `Lojas/caixas: ${dados.lojas}` : null, dados.momento ? `Momento: ${dados.momento}` : null, dados.decisor ? `Decisor: ${dados.decisor}` : null,
    sdr.campanha ? `Campanha: ${sdr.campanha}` : null,
  ].filter(Boolean).join('\n');
}

async function aplicarAcao(prisma: PrismaClient, token: string, sdr: any, acao: string, r: { nota: number; nota_motivo: string; duvida?: string | null }) {
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  const atual = await prisma.sdrLead.findUnique({ where: { id: sdr.id } });
  const dados: any = atual?.dados || {};
  const resumo = resumoLead(atual, dados, r);
  const obs = (descricao: string) => atual?.lead_id && prisma.leadObservacao.create({ data: { lead_id: atual.lead_id, tipo: 'SISTEMA', descricao, created_by: 'bot', created_by_name: 'Caroline (SDR)' } }).catch(() => {});
  if (acao === 'oferecer_demo') {
    const { oferecerDemo } = await import('./assistente-demo.service');
    await oferecerDemo(prisma, token, sdr.conversaId).catch((e: any) => console.warn('[CAROLINE] demo:', e?.message));
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'DEMO', resumo } });
    await obs(`${resumo}\n\nDemonstração oferecida.`);
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🔥 *Caroline ofereceu demonstração*\n${resumo}`);
    registrarAcaoAgente('caroline', `ofereceu demonstração para ${atual?.nome || 'um lead'}`);
  } else if (acao === 'passar_vendedora') {
    if (atual?.lead_id) await prisma.lead.update({ where: { id: atual.lead_id }, data: { etapa_sdr: 'QUALIFICADO' } }).catch(() => {});
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'VENDEDORA', resumo } });
    await obs(`${resumo}\n\nPassado para a vendedora (Leads para Distribuir).`);
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🔔 *Lead pronto para a vendedora* (Caroline)\n${resumo}`);
    registrarAcaoAgente('caroline', `passou ${atual?.nome || 'um lead'} para a vendedora`);
  } else if (acao === 'sem_interesse') {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SEM_INTERESSE', resumo } });
    await obs(`${resumo}\n\nSem interesse no momento (a Caroline encerrou com gentileza).`);
    registrarAcaoAgente('caroline', `encerrou: ${atual?.nome || 'lead'} sem interesse agora`);
  } else if (acao === 'duvida_fora_material') {
    await enviarAvisoGestao(prisma, 'lead_qualificado', `❓ *Dúvida que a Caroline não sabe responder*\n${atual?.nome || ''}${atual?.empresa ? ` · ${atual.empresa}` : ''}: "${r.duvida || 'ver conversa'}"\nResponda na conversa do WhatsApp (ao responder, você assume e ela sai).`);
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'CONVERSANDO' } });
  }
}

/**
 * Gera a próxima fala da Caroline e envia (ou deixa para aprovação).
 * Nunca lança; na dúvida não envia.
 */
async function falar(prisma: PrismaClient, token: string, sdrId: string, fase: FaseCaroline): Promise<'enviado' | 'aprovacao' | 'nada' | 'falha'> {
  const sdr = await prisma.sdrLead.findUnique({ where: { id: sdrId } });
  if (!sdr || !sdr.conversaId || !ATIVOS.includes(sdr.status)) return 'nada';
  if (await pessoaAssumiu(prisma, sdr)) {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
    registrarAcaoAgente('caroline', `saiu da conversa de ${sdr.nome || 'um lead'}: uma pessoa assumiu`);
    return 'nada';
  }
  if (await prisma.sdrMensagem.findFirst({ where: { sdrId, status: 'PENDENTE' }, select: { id: true } })) return 'aprovacao';
  const r = await gerarResposta(prisma, sdr, fase);
  if (!r) { console.warn(`[CAROLINE] sem resposta utilizável para ${sdr.numero}`); return 'falha'; }
  await atualizarTermometro(prisma, sdr, r);
  const cfg = await obterConfigCaroline(prisma);
  const agora = new Date();
  const base = {
    ultima_caroline_em: agora,
    ...(fase === 'resposta' ? { status: 'CONVERSANDO' } : { status: 'AGUARDANDO', tentativas: { increment: 1 } as any }),
    ...(fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {}),
  };
  if (cfg.aprovar) {
    await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), acao: JSON.stringify({ acao: r.acao, nota: r.nota, nota_motivo: r.nota_motivo, duvida: r.duvida, fase }) } });
    await prisma.sdrLead.update({ where: { id: sdrId }, data: fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {} });
    registrarAcaoAgente('caroline', `escreveu para ${sdr.nome || 'um lead'}: esperando sua aprovação`);
    emitirEventoConversa(null, 'conversa_atualizada', { conversaId: sdr.conversaId });
    return 'aprovacao';
  }
  if (r.mensagens.length) await enviarMensagens(prisma, token, sdr, r.mensagens);
  await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), status: 'ENVIADA_AUTO', acao: r.acao, decidido_em: agora } });
  await prisma.sdrLead.update({ where: { id: sdrId }, data: base });
  registrarAcaoAgente('caroline', `${fase === 'resposta' ? 'respondeu' : 'chamou'} ${sdr.nome || 'um lead'} (nota ${r.nota})`);
  if (r.acao !== 'continuar') await aplicarAcao(prisma, token, sdr, r.acao, r);
  return 'enviado';
}

/** Aprovar (com ou sem edição) ou descartar uma mensagem da Caroline. */
export async function decidirMensagem(prisma: PrismaClient, id: string, decisao: { aprovar: boolean; texto?: string | null }, userId: string) {
  const m = await prisma.sdrMensagem.findUnique({ where: { id } });
  if (!m || m.status !== 'PENDENTE') throw new Error('Esta mensagem já foi decidida.');
  const sdr = await prisma.sdrLead.findUnique({ where: { id: m.sdrId } });
  if (!sdr) throw new Error('Lead da Caroline não encontrado.');
  if (!decisao.aprovar) {
    await prisma.sdrMensagem.update({ where: { id }, data: { status: 'DESCARTADA', decidido_em: new Date(), decidido_por: userId } });
    return { status: 'DESCARTADA' };
  }
  if (await pessoaAssumiu(prisma, sdr)) {
    await prisma.sdrMensagem.update({ where: { id }, data: { status: 'DESCARTADA', decidido_em: new Date(), decidido_por: userId } });
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
    throw new Error('Uma pessoa já assumiu esta conversa; a mensagem foi descartada.');
  }
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('O WhatsApp da empresa não está conectado.');
  const final = (decisao.texto ?? '').trim() || m.texto;
  const editada = final !== m.texto;
  await enviarMensagens(prisma, inst.instance_token, sdr, final.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).slice(0, 3));
  await prisma.sdrMensagem.update({ where: { id }, data: { status: editada ? 'EDITADA' : 'APROVADA', texto_final: final, decidido_em: new Date(), decidido_por: userId } });
  const meta = (() => { try { return JSON.parse(m.acao || '{}'); } catch { return {}; } })();
  const agora = new Date();
  await prisma.sdrLead.update({
    where: { id: sdr.id },
    data: { ultima_caroline_em: agora, ...(meta.fase === 'resposta' ? { status: 'CONVERSANDO' } : { status: 'AGUARDANDO', tentativas: { increment: 1 } }), ...(sdr.primeiro_envio_em ? {} : { primeiro_envio_em: agora }) },
  });
  if (meta.acao && meta.acao !== 'continuar') await aplicarAcao(prisma, inst.instance_token, sdr, meta.acao, meta);
  return { status: editada ? 'EDITADA' : 'APROVADA' };
}

// ── Mensagem do lead (webhook) ───────────────────────────────────────────────

const espera = new Map<string, NodeJS.Timeout>();
const ESPERA_MS = 40_000; // junta mensagens seguidas antes de responder

/** Chamado pelo webhook do WhatsApp da empresa. true = a conversa é da Caroline (os outros robôs ficam quietos). */
export async function aoReceberDoLead(prisma: PrismaClient, token: string, conversaId: string, tipo: string, texto: string, mensagemId: string): Promise<boolean> {
  const sdr = await prisma.sdrLead.findFirst({ where: { conversaId, status: { in: ATIVOS } }, orderBy: { created_at: 'desc' } });
  if (!sdr) return false;
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { ultima_lead_em: new Date(), ...(sdr.status !== 'FILA' ? { status: 'CONVERSANDO' } : {}) } });
  if (tipo === 'TEXTO' && ehPedidoDeSaida(texto)) {
    await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { optout_campanhas: true } });
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SAIU' } });
    const resp = 'Tudo bem! Não vou mais te mandar mensagens. Se precisar, é só chamar por aqui. 💙';
    await enviarMensagens(prisma, token, sdr, [resp]).catch(() => {});
    registrarAcaoAgente('caroline', `${sdr.nome || 'um lead'} pediu para sair`);
    return true;
  }
  if (tipo === 'AUDIO') {
    const { transcreverAudio } = await import('./assistente-ia.service');
    await transcreverAudio(prisma, mensagemId).catch((e: any) => console.warn('[CAROLINE] áudio:', e?.message));
  }
  const cfg = await obterConfigCaroline(prisma);
  if (!cfg.ativa) return true; // desligada: guarda a conversa, a equipe responde
  const anterior = espera.get(conversaId);
  if (anterior) clearTimeout(anterior);
  espera.set(conversaId, setTimeout(() => {
    espera.delete(conversaId);
    // Fora do horário (7h–21h) ela espera; a rodada da manhã responde.
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (h < 7 || h >= 21) return;
    void falar(prisma, token, sdr.id, 'resposta').catch((e: any) => console.warn('[CAROLINE] resposta:', e?.message));
  }, ESPERA_MS));
  return true;
}

// ── Rodada (a cada 2 min) ────────────────────────────────────────────────────

let proximoPrimeiroContato = 0;
let falhasSeguidas = 0;

export async function rodarCaroline(prisma: PrismaClient, agora = new Date()): Promise<void> {
  const cfg = await obterConfigCaroline(prisma);
  if (!cfg.ativa) return;
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return;
  const token = inst.instance_token;

  // Demonstração marcada pelo lead: status DEMO.
  const emDemo = await prisma.sdrLead.findMany({ where: { status: { in: [...ATIVOS, 'DEMO'] }, conversaId: { not: null } }, select: { id: true, conversaId: true, status: true } });
  if (emDemo.length) {
    const marcadas = await prisma.atividade.findMany({ where: { whatsapp_conversa_id: { in: emDemo.map(s => s.conversaId!) }, status: { not: 'CANCELADA' } }, select: { whatsapp_conversa_id: true } });
    const conv = new Set(marcadas.map(a => a.whatsapp_conversa_id));
    for (const s of emDemo) if (conv.has(s.conversaId) && s.status !== 'DEMO') await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'DEMO' } });
  }

  if (!horarioComercial(agora)) return;

  // 1) Respostas atrasadas (chegaram fora do horário ou a IA falhou): responde quem está esperando.
  const esperando = await prisma.sdrLead.findMany({ where: { status: 'CONVERSANDO', ultima_lead_em: { not: null } }, take: 20 });
  for (const s of esperando) {
    if (s.ultima_caroline_em && s.ultima_lead_em! <= s.ultima_caroline_em) continue;
    if (Date.now() - s.ultima_lead_em!.getTime() < 2 * 60_000) continue; // o webhook está cuidando
    await falar(prisma, token, s.id, 'resposta');
  }

  // 2) Retomadas de quem não respondeu; depois da 3ª tentativa, "sem resposta".
  const aguardando = await prisma.sdrLead.findMany({ where: { status: 'AGUARDANDO' }, take: 50 });
  for (const s of aguardando) {
    if (s.tentativas >= TENTATIVAS_MAX) {
      if (s.ultima_caroline_em && diasUteisEntre(s.ultima_caroline_em, agora) >= 5) {
        await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'SEM_RESPOSTA' } });
      }
      continue;
    }
    if (deveRetomar(s.tentativas, s.ultima_caroline_em, agora)) await falar(prisma, token, s.id, 'retomada');
  }

  // 3) Primeiros contatos: um por vez, intervalo sorteado, dentro do limite do dia (somado às campanhas).
  if (Date.now() < proximoPrimeiroContato) return;
  const desde = new Date(`${agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T00:00:00-03:00`);
  const [feitosCaroline, feitosCampanha] = await Promise.all([
    prisma.sdrLead.count({ where: { primeiro_envio_em: { gte: desde } } }),
    prisma.campanhaEnvio.count({ where: { status: 'ENVIADO', enviado_em: { gte: desde } } }),
  ]);
  const limite = limiteDoDia(cfg.ativada_em ? new Date(cfg.ativada_em) : null, cfg.limite, agora);
  if (feitosCaroline + feitosCampanha >= limite) return;
  const proximo = await prisma.sdrLead.findFirst({ where: { status: 'FILA' }, orderBy: { created_at: 'asc' } });
  if (!proximo) return;
  const r = await falar(prisma, token, proximo.id, 'abertura');
  proximoPrimeiroContato = Date.now() + intervaloSorteado();
  if (r === 'falha') {
    falhasSeguidas++;
    if (falhasSeguidas >= 3) {
      await salvarConfigCaroline(prisma, { ativa: false, pausada_motivo: '3 falhas seguidas no envio/IA' }, 'caroline');
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      await enviarAvisoGestao(prisma, 'lead_qualificado', '⚠️ *A Caroline pausou sozinha*: 3 falhas seguidas no primeiro contato. Confira o WhatsApp da empresa e religue no Escritório.');
      falhasSeguidas = 0;
    }
  } else falhasSeguidas = 0;
}

// ── Painel ─────────────────────────────────────────────────────────────────

export async function painelCaroline(prisma: PrismaClient) {
  const [cfg, leads, pendentes] = await Promise.all([
    obterConfigCaroline(prisma),
    prisma.sdrLead.findMany({ orderBy: { updated_at: 'desc' }, take: 200 }),
    prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE' }, orderBy: { created_at: 'asc' } }),
  ]);
  const porStatus: Record<string, number> = {};
  for (const l of leads) porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  const nomes = new Map(leads.map(l => [l.id, l]));
  return {
    config: cfg, por_status: porStatus,
    leads: leads.map(l => ({ id: l.id, nome: l.nome, empresa: l.empresa, numero: l.numero, segmento: l.segmento, campanha: l.campanha, status: l.status, tentativas: l.tentativas, nota: l.nota, nota_motivo: l.nota_motivo, temperatura: l.temperatura, temperatura_confirmada: l.temperatura_confirmada, dados: l.dados, conversaId: l.conversaId, lead_id: l.lead_id, atualizado_em: l.updated_at })),
    pendentes: pendentes.map(m => ({ id: m.id, sdrId: m.sdrId, texto: m.texto, meta: (() => { try { return JSON.parse(m.acao || '{}'); } catch { return {}; } })(), criado_em: m.created_at, lead: nomes.get(m.sdrId)?.nome || null, empresa: nomes.get(m.sdrId)?.empresa || null })),
  };
}

const SEG_LAYA: Record<string, string> = { 'Farmácia': 'farmacia', 'Manipulação': 'manipulacao', 'Padaria': 'padaria', 'Varejo': 'varejo' };

/** A Jessica confirma/corrige a temperatura: vira exemplo de treino da Laya (fonte Caroline). */
export async function confirmarTemperatura(prisma: PrismaClient, sdrId: string, temperatura: string, userId: string) {
  if (!['FRIO', 'MORNO', 'QUENTE', 'MUITO_QUENTE'].includes(temperatura)) throw new Error('Temperatura inválida.');
  const s = await prisma.sdrLead.findUnique({ where: { id: sdrId } });
  if (!s?.conversaId) throw new Error('Lead da Caroline não encontrado.');
  const { textoParaIa } = await import('./laya.service');
  const texto = await textoParaIa(prisma, s.conversaId);
  await prisma.iaAmostra.create({
    data: {
      conversaId: s.conversaId, texto, criado_por: userId,
      rotulos: { segmento: SEG_LAYA[s.segmento || ''] || 'nao_sei', intencao: 'comprar', cancelar: false, temperatura, fonte: 'caroline' },
      sugestao: { temperatura: s.temperatura, nota: s.nota, fonte: 'caroline' },
    },
  });
  await prisma.sdrLead.update({ where: { id: sdrId }, data: { temperatura_confirmada: temperatura } });
  if (s.lead_id && temperatura !== s.temperatura) {
    await prisma.lead.update({ where: { id: s.lead_id }, data: { temperatura } }).catch(() => {});
    await registrarMudancaTemperatura(prisma, { leadId: s.lead_id, temperaturaAnterior: s.temperatura, temperaturaNova: temperatura, autorId: userId, autorNome: 'Confirmação da gestão' }).catch(() => {});
  }
  (await import('./laya.service')).esquecerCacheLaya();
}
