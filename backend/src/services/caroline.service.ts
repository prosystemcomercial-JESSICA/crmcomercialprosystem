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
  lerRespostaCaroline, temperaturaDaNota, promptCaroline, saudacaoAgora, ABERTURA_JESSICA, TENTATIVAS_MAX, horaBoaParaRetomar,
  opcoesAgendamento, lerAgendamento, nomeDoDia, horarioVendedora, proximaJanelaVendedora,
  PERFIS_SDR, type RespostaCaroline, type FaseCaroline, type PerfilSdr,
} from '@/lib/assistente/sdr';
import { numeroWhatsapp } from '@/lib/assistente/campanhas';

// Caroline, a SDR: recebe os leads das campanhas (colados pela Jessica), faz o
// primeiro contato pelo WhatsApp da empresa com ritmo seguro, conversa pela IA
// buscando a dor principal, dá a nota de interesse e termina em demonstração,
// vendedora ou encerramento. Uma pessoa assumiu a conversa → ela sai na hora.

export const REMETENTE_CAROLINE = 'caroline';
export const AGENTES_SDR: PerfilSdr[] = ['caroline', 'luiz_felipe', 'julio']; // ordem de prioridade no primeiro contato
export const REMETENTES_SDR = ['caroline', 'julio', 'luiz_felipe'];
const ATIVOS = ['FILA', 'AGUARDANDO', 'CONVERSANDO'];
export const agenteDe = (sdr: any): PerfilSdr => (AGENTES_SDR.includes(sdr?.agente) ? sdr.agente : 'caroline');
const nomeDe = (sdr: any) => PERFIS_SDR[agenteDe(sdr)].nome;
const chaveCfg = (a: PerfilSdr) => (a === 'caroline' ? 'assistente.caroline' : `assistente.sdr.${a}`);

// inicia_em: o agente só começa a partir desse horário (ex.: segunda 9h).
export type ConfigCaroline = { ativa: boolean; aprovar: boolean; limite: number; ativada_em: string | null; pausada_motivo: string | null; inicia_em?: string | null };
const PADRAO: ConfigCaroline = { ativa: false, aprovar: true, limite: 30, ativada_em: null, pausada_motivo: null, inicia_em: null };

export async function obterConfigAgente(prisma: PrismaClient, agente: PerfilSdr): Promise<ConfigCaroline> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: chaveCfg(agente) } }).catch(() => null);
  try { return { ...PADRAO, ...(r?.valor ? JSON.parse(r.valor) : {}) }; } catch { return { ...PADRAO }; }
}
export const obterConfigCaroline = (prisma: PrismaClient) => obterConfigAgente(prisma, 'caroline');

export async function salvarConfigAgente(prisma: PrismaClient, agente: PerfilSdr, novo: Partial<ConfigCaroline>, userId: string) {
  const atual = await obterConfigAgente(prisma, agente);
  const cfg: ConfigCaroline = { ...atual, ...novo };
  if (novo.ativa && !atual.ativa) { cfg.pausada_motivo = null; if (!cfg.ativada_em) cfg.ativada_em = new Date().toISOString(); }
  cfg.limite = Math.max(1, Math.min(30, Math.round(cfg.limite || 30)));
  const valor = JSON.stringify(cfg);
  const chave = chaveCfg(agente);
  await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: userId }, update: { valor, updated_by: userId } });
  return cfg;
}
export const salvarConfigCaroline = (prisma: PrismaClient, novo: Partial<ConfigCaroline>, userId: string) => salvarConfigAgente(prisma, 'caroline', novo, userId);

/** Agente ligado e já dentro do horário de início (inicia_em). */
const trabalhando = (cfg: ConfigCaroline, agora: Date) => cfg.ativa && (!cfg.inicia_em || agora >= new Date(cfg.inicia_em));

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

/**
 * Fim da triagem da Bia (lead qualificado): a conversa passa para a Caroline, que responde
 * na próxima rodada (1 a 3 min). É contato que chegou sozinho: não conta no limite de primeiros contatos.
 */
export async function receberDaTriagem(prisma: PrismaClient, conversaId: string) {
  if (await prisma.sdrLead.findFirst({ where: { conversaId, status: { in: ATIVOS } }, select: { id: true } })) return;
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_numero: true, contato_nome: true, lead_id: true, bot_dados: true, dono_id: true } });
  if (!c || c.dono_id) return;
  const d: any = c.bot_dados || {};
  const agora = new Date();
  await prisma.sdrLead.create({
    data: {
      agente: 'caroline', conversaId, lead_id: c.lead_id, numero: c.contato_numero, nome: d.nome || c.contato_nome, segmento: d.segmento || null,
      empresa: d.receita?.nome_fantasia || d.receita?.razao_social || null, campanha: 'WhatsApp (triagem da Bia)', status: 'CONVERSANDO',
      ultima_lead_em: agora, primeiro_envio_em: null, criado_por: 'bia',
    },
  });
  registrarAcaoAgente('bia', `passou ${d.nome || c.contato_nome || 'um lead'} para a Caroline`);
  registrarAcaoAgente('caroline', `recebeu ${d.nome || c.contato_nome || 'um lead'} da Bia`);
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
      OR: [{ enviada_por: null }, { enviada_por: { notIn: [...REMETENTES_AUTOMATICOS, ...REMETENTES_SDR, 'abertura_jessica', 'assistente_ia'] } }],
    },
    select: { id: true },
  });
  return !!humana;
}

async function historico(prisma: PrismaClient, conversaId: string) {
  const ms = await prisma.whatsappMensagem.findMany({ where: { conversaId }, orderBy: { created_at: 'desc' }, take: 14, select: { direcao: true, tipo: true, conteudo: true, transcricao: true, enviada_por: true, midia_url: true } });
  const linhas = ms.reverse().map(m => {
    const quem = m.direcao === 'ENTRADA' ? 'Cliente' : REMETENTES_SDR.includes(m.enviada_por || '') ? PERFIS_SDR[m.enviada_por as PerfilSdr].nome : m.enviada_por === 'abertura_jessica' || !m.enviada_por ? 'Jessica' : 'Empresa';
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
  // Observações da equipe (ex.: ligação por telefone): contexto que não está no WhatsApp.
  const notas = await prisma.whatsappNota.findMany({ where: { conversaId: sdr.conversaId }, orderBy: { created_at: 'desc' }, take: 5, select: { texto: true, created_at: true } }).catch(() => []);
  if (notas.length) h.texto = `[Observações da equipe sobre este cliente, use como contexto e não repita literalmente:\n${notas.reverse().map(n => `- ${n.created_at.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}: ${n.texto.slice(0, 400)}`).join('\n')}]\n\n${h.texto}`;
  // Assuntos da semana da Sofia (últimos 14 dias): só do segmento exato do lead e de gestão
  // (farmácia não recebe assunto de manipulação; assunto clínico/de produto fica de fora).
  const pesquisas = await prisma.pesquisaSetor.findMany({ where: { created_at: { gte: new Date(Date.now() - 60 * 864e5) } }, orderBy: { created_at: 'desc' }, take: 10, select: { itens: true, created_at: true } }).catch(() => []);
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const seg = norm(sdr.segmento || '');
  const atualidades = pesquisas.flatMap(x => ((Array.isArray(x.itens) ? x.itens : []) as any[]).map(i => ({ ...i, _em: x.created_at })))
    .filter(i => {
      const s = norm(String(i?.segmento || ''));
      return i?.titulo && (s === seg || s.startsWith('gest'));
    })
    .slice(0, 8).map(i => ({ segmento: String(i.segmento || ''), titulo: `${String(i.titulo)} (pesquisado em ${new Date(i._em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`, resumo: String(i.resumo || '').slice(0, 300), por_que_importa: String(i.por_que_importa || '').slice(0, 200) }));
  // Versões que a Jessica descartou desde a última mensagem enviada: refazer diferente, seguindo o pedido dela.
  const desde = sdr.ultima_caroline_em && !sdr.abertura_enviada ? sdr.ultima_caroline_em : sdr.desde;
  const descartadas = await prisma.sdrMensagem.findMany({ where: { sdrId: sdr.id, status: 'DESCARTADA', created_at: { gte: desde } }, orderBy: { created_at: 'desc' }, take: 4, select: { texto: true, texto_final: true } });
  const refazer = descartadas.length
    ? '\n=== A JESSICA DESCARTOU ESTAS VERSÕES (pense diferente: outro gancho, outra estrutura, outras palavras; nunca repita) ===\n' +
      descartadas.map(d => `- "${d.texto.slice(0, 400)}"${d.texto_final ? `\n  Pedido dela: ${d.texto_final.slice(0, 300)}` : ''}`).join('\n')
    : '';
  const p = promptCaroline({
    guia: await guiaComercial(prisma), instrucoes: (await instrucoesPara(prisma, agenteDe(sdr))) + refazer, exemplos: await exemplosEditados(prisma),
    historico: h.texto, fase, saudacao: saudacaoAgora(new Date()),
    perfil: agenteDe(sdr),
    followup: {
      cadastro_em: sdr.cadastro_em ? new Date(sdr.cadastro_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' }) : null,
      proposta: sdr.proposta_id ? await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { plano_selecionado: true, wpp_enviada_em: true, created_at: true, status: true } })
        .then(x => x && { plano: x.plano_selecionado, status: x.status, enviada_em: (x.wpp_enviada_em || x.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }).catch(() => null) : null,
    },
    // Assuntos da atualidade só no follow-up de quem já conversou (1ª e 2ª retomadas usam o dia a dia).
    atualidades: fase === 'retomada' && sdr.ultima_lead_em ? atualidades : [],
    lead: { nome: sdr.nome, empresa: sdr.empresa, segmento: sdr.segmento, campanha: sdr.campanha, abertura_jessica: sdr.abertura_enviada, tentativa: sdr.tentativas, ja_conversou: !!sdr.ultima_lead_em, combinado: fase === 'retomada' && (sdr.dados as any)?.chamar_combinado ? String((sdr.dados as any).chamar_combinado) : null },
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
    await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: m, status: 'ENVIADA', enviada_por: agenteDe(sdr) } });
  }
  await prisma.whatsappConversa.update({ where: { id: sdr.conversaId }, data: { ultima_mensagem: mensagens[mensagens.length - 1].slice(0, 200), ultima_em: new Date() } });
  emitirEventoConversa(conv.dono_id, 'conversa_atualizada', { conversaId: sdr.conversaId });
}

/**
 * Chamariz para quem não respondeu: botões de resposta com um toque (responder é mais fácil
 * que digitar) e, na última tentativa, a imagem do material do segmento.
 */
export const BOTOES_RETOMADA = [
  { id: 'sdr_quero', texto: 'Quero saber mais' },
  { id: 'sdr_depois', texto: 'Me chama depois' },
  { id: 'sdr_nao', texto: 'Agora não' },
];
async function enviarChamariz(prisma: PrismaClient, token: string, sdr: any, ultima: boolean) {
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { contato_numero: true } });
  if (!conv) return;
  if (ultima) {
    const { obterConfigTriagem } = await import('./triagem-config.service');
    const cfg = await obterConfigTriagem(prisma);
    const m = /padar|confeit/i.test(sdr.segmento || '') ? cfg.material.padaria : cfg.material.farmacia;
    if (m.imagem) {
      const r: any = await evo.enviarArquivo(token, conv.contato_numero, m.imagem, 'prosystem.jpg').catch(() => ({}));
      await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: r.tipo || 'IMAGEM', conteudo: '🖼️ Imagem', midia_url: m.imagem, status: 'ENVIADA', enviada_por: agenteDe(sdr) } }).catch(() => {});
    }
  }
  const menu = { modo: 'button' as const, texto: 'Se preferir, é só tocar numa opção 👇', rodape: `${nomeDe(sdr)} · Prosystem`, opcoes: BOTOES_RETOMADA };
  const r: any = await evo.enviarMenu(token, conv.contato_numero, menu).catch(() => ({}));
  await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: `${menu.texto}\n\n${menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, status: 'ENVIADA', enviada_por: agenteDe(sdr) } }).catch(() => {});
}

/** Sinal de interesse (clique em botão): sobe a nota até um mínimo, sem nunca baixar. */
export async function registrarInteresse(prisma: PrismaClient, sdr: any, notaMinima: number, motivo: string) {
  const atual = await prisma.sdrLead.findUnique({ where: { id: sdr.id }, select: { nota: true, nota_motivo: true, dados: true, lead_id: true, conversaId: true, temperatura: true } });
  if (!atual) return;
  if ((atual.nota ?? 0) < notaMinima) {
    const temperatura = temperaturaDaNota(notaMinima);
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { nota: notaMinima, nota_motivo: motivo, temperatura, dados: { ...((atual.dados as any) || {}), intencao: 'comprar' } } });
    if (atual.lead_id) {
      const lead = await prisma.lead.findUnique({ where: { id: atual.lead_id }, select: { temperatura: true } }).catch(() => null);
      if (lead && lead.temperatura !== temperatura && !['QUENTE', 'MUITO_QUENTE'].includes(lead.temperatura)) {
        await prisma.lead.update({ where: { id: atual.lead_id }, data: { temperatura } }).catch(() => {});
        await registrarMudancaTemperatura(prisma, { leadId: atual.lead_id, temperaturaAnterior: lead.temperatura, temperaturaNova: temperatura, autorNome: `${nomeDe(sdr)} (nota ${notaMinima})` }).catch(() => {});
      }
      await prisma.leadObservacao.create({ data: { lead_id: atual.lead_id, tipo: 'SISTEMA', descricao: `🤖 ${nomeDe(sdr)}: ${motivo}. Termômetro ${notaMinima}/100.`, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {});
    }
  }
  // Intenção na conversa (o que a Laya mostra no painel): quer comprar.
  if (atual.conversaId) {
    const c = await prisma.whatsappConversa.findUnique({ where: { id: atual.conversaId }, select: { ia_sugestao: true } });
    await prisma.whatsappConversa.update({ where: { id: atual.conversaId }, data: { ia_sugestao: { ...((c?.ia_sugestao as any) || { segmento: 'nao_sei', cancelar: 0, urgencia: 0 }), intencao: 'comprar' } } }).catch(() => {});
  }
  registrarAcaoAgente(agenteDe(sdr), `registrou interesse de ${sdr.nome || 'um lead'}: ${motivo}`);
  await passarParaCaroline(prisma, sdr, motivo);
}

/** Julio achou interesse: a conversa passa para a Caroline, que aprofunda a dor e marca a demonstração. */
export async function passarParaCaroline(prisma: PrismaClient, sdr: any, motivo: string) {
  if (agenteDe(sdr) !== 'julio') return;
  const r = await prisma.sdrLead.updateMany({ where: { id: sdr.id, agente: 'julio' }, data: { agente: 'caroline' } });
  if (!r.count) return;
  if (sdr.lead_id) {
    await prisma.leadObservacao.create({ data: { lead_id: sdr.lead_id, tipo: 'SISTEMA', descricao: `🤖 Julio passou para a Caroline: ${motivo}`, created_by: 'bot', created_by_name: 'Julio' } }).catch(() => {});
  }
  registrarAcaoAgente('julio', `passou ${sdr.nome || 'um lead'} para a Caroline (${motivo})`);
  registrarAcaoAgente('caroline', `recebeu ${sdr.nome || 'um lead'} do Julio`);
}

async function atualizarTermometro(prisma: PrismaClient, sdr: any, r: RespostaCaroline) {
  const temperatura = temperaturaDaNota(r.nota);
  const dados = { ...(sdr.dados || {}), ...Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v)), ...(r.dor_principal ? { dor_principal: r.dor_principal } : {}) };
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { nota: r.nota, nota_motivo: r.nota_motivo, temperatura, dados } });
  if (sdr.lead_id) {
    const lead = await prisma.lead.findUnique({ where: { id: sdr.lead_id }, select: { temperatura: true } }).catch(() => null);
    if (lead && lead.temperatura !== temperatura) {
      await prisma.lead.update({ where: { id: sdr.lead_id }, data: { temperatura, ...(dados.cidade ? { cidade: String(dados.cidade).slice(0, 100) } : {}), ...(dados.sistema_atual ? { sistema_atual: String(dados.sistema_atual).slice(0, 100) } : {}) } as any }).catch(() => {});
      await registrarMudancaTemperatura(prisma, { leadId: sdr.lead_id, temperaturaAnterior: lead.temperatura, temperaturaNova: temperatura, autorNome: `${nomeDe(sdr)} (nota ${r.nota})` }).catch(() => {});
    }
  }
  return dados;
}

function resumoLead(sdr: any, dados: any, r: { nota: number; nota_motivo: string }) {
  return [
    `🤖 ${nomeDe(sdr)}: ${sdr.nome || ''}${sdr.empresa ? ` · ${sdr.empresa}` : ''}`,
    `Termômetro: ${r.nota}/100 (${temperaturaDaNota(r.nota).replace('_', ' ').toLowerCase()}): ${r.nota_motivo || '—'}`,
    `Dor principal: ${dados.dor_principal || 'não identificada'}`,
    dados.cidade ? `Cidade: ${dados.cidade}` : null, dados.sistema_atual ? `Sistema atual: ${dados.sistema_atual}` : null,
    dados.lojas ? `Lojas/caixas: ${dados.lojas}` : null, dados.momento ? `Momento: ${dados.momento}` : null, dados.decisor ? `Decisor: ${dados.decisor}` : null,
    sdr.campanha ? `Campanha: ${sdr.campanha}` : null,
  ].filter(Boolean).join('\n');
}

/** Entrega o lead à vendedora: entra em "Leads para Distribuir" e a gestão é avisada (só no expediente). */
export async function entregarParaVendedora(prisma: PrismaClient, sdrId: string) {
  const s = await prisma.sdrLead.findUnique({ where: { id: sdrId } });
  if (!s) return;
  const d: any = s.dados || {};
  // Alguém já assumiu a conversa: o lead é dessa pessoa, não volta para a distribuição.
  const conv = s.conversaId ? await prisma.whatsappConversa.findUnique({ where: { id: s.conversaId }, select: { dono_id: true } }) : null;
  if (conv?.dono_id) { await prisma.sdrLead.update({ where: { id: sdrId }, data: { dados: { ...d, entregar_em: null } } }); return; }
  if (s.lead_id) await prisma.lead.update({ where: { id: s.lead_id }, data: { etapa_sdr: 'QUALIFICADO' } }).catch(() => {});
  await prisma.sdrLead.update({ where: { id: sdrId }, data: { dados: { ...d, entregar_em: null, entregue_em: new Date().toISOString() } } });
  if (s.lead_id) await prisma.leadObservacao.create({ data: { lead_id: s.lead_id, tipo: 'SISTEMA', descricao: `${s.resumo || ''}\n\nPassado para a vendedora (Leads para Distribuir).`.trim(), created_by: 'bot', created_by_name: nomeDe(s) } }).catch(() => {});
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', `🔔 *Lead pronto para a vendedora* (${nomeDe(s)})\n${s.resumo || s.nome || s.numero}`);
  registrarAcaoAgente(agenteDe(s), `passou ${s.nome || 'um lead'} para a vendedora`);
}

async function aplicarAcao(prisma: PrismaClient, token: string, sdr: any, acao: string, r: { nota: number; nota_motivo: string; duvida?: string | null }) {
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  const atual = await prisma.sdrLead.findUnique({ where: { id: sdr.id } });
  const dados: any = atual?.dados || {};
  const resumo = resumoLead(atual, dados, r);
  const obs = (descricao: string) => atual?.lead_id && prisma.leadObservacao.create({ data: { lead_id: atual.lead_id, tipo: 'SISTEMA', descricao, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {});
  if (acao === 'oferecer_demo') {
    const { oferecerDemo } = await import('./assistente-demo.service');
    await oferecerDemo(prisma, token, sdr.conversaId).catch((e: any) => console.warn('[CAROLINE] demo:', e?.message));
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'DEMO', resumo } });
    await obs(`${resumo}\n\nDemonstração oferecida.`);
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🔥 *${nomeDe(sdr)} ofereceu demonstração*\n${resumo}`);
    registrarAcaoAgente(agenteDe(sdr), `ofereceu demonstração para ${atual?.nome || 'um lead'}`);
  } else if (acao === 'passar_vendedora') {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'VENDEDORA', resumo } });
    const agora = new Date();
    if (horarioVendedora(agora)) {
      await entregarParaVendedora(prisma, sdr.id);
    } else {
      // Fora do expediente (seg–sex 8h30–17h): o lead fica guardado e entra às 8h30 do próximo dia útil.
      const quando = proximaJanelaVendedora(agora);
      const diaQ = quando.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const dia = diaQ === agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) ? 'hoje' : nomeDoDia(diaQ, agora).replace(/ \(.*\)/, '');
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...dados, entregar_em: quando.toISOString() } } });
      await enviarMensagens(prisma, token, atual, [`A nossa consultora fala com você ${dia} a partir das 8h30. 😊`]).catch(() => {});
      await obs(`${resumo}\n\nFora do horário da vendedora: entra em Leads para Distribuir ${quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
      registrarAcaoAgente(agenteDe(sdr), `guardou ${atual?.nome || 'um lead'} para a vendedora (${dia} 8h30)`);
    }
  } else if (acao === 'sem_interesse') {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SEM_INTERESSE', resumo } });
    await obs(`${resumo}\n\nSem interesse no momento (encerrado com gentileza).`);
    registrarAcaoAgente(agenteDe(sdr), `encerrou: ${atual?.nome || 'lead'} sem interesse agora`);
  } else if (acao === 'duvida_fora_material') {
    await enviarAvisoGestao(prisma, 'lead_qualificado', `❓ *Dúvida que ${nomeDe(sdr)} não sabe responder*\n${atual?.nome || ''}${atual?.empresa ? ` · ${atual.empresa}` : ''}: "${r.duvida || 'ver conversa'}"\nResponda na conversa do WhatsApp (ao responder, você assume e ela sai).`);
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
    registrarAcaoAgente(agenteDe(sdr), `saiu da conversa de ${sdr.nome || 'um lead'}: uma pessoa assumiu`);
    return 'nada';
  }
  if (await prisma.sdrMensagem.findFirst({ where: { sdrId, status: 'PENDENTE' }, select: { id: true } })) return 'aprovacao';
  const r = await gerarResposta(prisma, sdr, fase);
  if (!r) { console.warn(`[CAROLINE] sem resposta utilizável para ${sdr.numero}`); return 'falha'; }
  await atualizarTermometro(prisma, sdr, r);
  const cfg = await obterConfigAgente(prisma, agenteDe(sdr));
  const agora = new Date();
  // Retomada de quem ainda não respondeu: vai com botões (e imagem na última tentativa).
  const chamariz = fase !== 'resposta' && (fase === 'retomada' || sdr.abertura_enviada) && !sdr.ultima_lead_em;
  const ultima = sdr.tentativas + 1 >= TENTATIVAS_MAX;
  const base = {
    ultima_caroline_em: agora,
    ...(fase === 'resposta' ? { status: 'CONVERSANDO' } : { status: 'AGUARDANDO', tentativas: { increment: 1 } as any }),
    ...(fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {}),
  };
  if (cfg.aprovar) {
    await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), acao: JSON.stringify({ acao: r.acao, nota: r.nota, nota_motivo: r.nota_motivo, duvida: r.duvida, fase, chamariz, ultima }) } });
    await prisma.sdrLead.update({ where: { id: sdrId }, data: fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {} });
    registrarAcaoAgente(agenteDe(sdr), `escreveu para ${sdr.nome || 'um lead'}: esperando sua aprovação`);
    emitirEventoConversa(null, 'conversa_atualizada', { conversaId: sdr.conversaId });
    return 'aprovacao';
  }
  if (r.mensagens.length) await enviarMensagens(prisma, token, sdr, r.mensagens);
  if (chamariz && r.acao === 'continuar') await enviarChamariz(prisma, token, sdr, ultima);
  await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), status: 'ENVIADA_AUTO', acao: r.acao, decidido_em: agora } });
  await prisma.sdrLead.update({ where: { id: sdrId }, data: base });
  registrarAcaoAgente(agenteDe(sdr), `${fase === 'resposta' ? 'respondeu' : 'chamou'} ${sdr.nome || 'um lead'} (nota ${r.nota})`);
  if (r.acao !== 'continuar') await aplicarAcao(prisma, token, sdr, r.acao, r);
  // Julio: com interesse (nota 35+, demo ou vendedora), a conversa segue com a Caroline.
  if (r.nota >= 35 || ['oferecer_demo', 'passar_vendedora'].includes(r.acao)) await passarParaCaroline(prisma, sdr, `interesse na conversa (nota ${r.nota})`);
  return 'enviado';
}

/** Aprovar (com ou sem edição) ou descartar uma mensagem da Caroline. */
export async function decidirMensagem(prisma: PrismaClient, id: string, decisao: { aprovar: boolean; texto?: string | null }, userId: string) {
  const m = await prisma.sdrMensagem.findUnique({ where: { id } });
  if (!m || m.status !== 'PENDENTE') throw new Error('Esta mensagem já foi decidida.');
  const sdr = await prisma.sdrLead.findUnique({ where: { id: m.sdrId } });
  if (!sdr) throw new Error('Lead da Caroline não encontrado.');
  if (!decisao.aprovar) {
    // Descartar = refazer: guarda o pedido da Jessica ("o que mudar?") e já escreve outra versão.
    await prisma.sdrMensagem.update({ where: { id }, data: { status: 'DESCARTADA', texto_final: (decisao.texto || '').trim().slice(0, 500) || null, decidido_em: new Date(), decidido_por: userId } });
    const meta = (() => { try { return JSON.parse(m.acao || '{}'); } catch { return {}; } })();
    const inst = await obterInstanciaEmpresa(prisma);
    if (inst?.instance_token) {
      void falar(prisma, inst.instance_token, sdr.id, (meta.fase as FaseCaroline) || 'resposta').catch((e: any) => console.warn('[CAROLINE] refazer:', e?.message));
    }
    registrarAcaoAgente(agenteDe(sdr), `está reescrevendo a mensagem para ${sdr.nome || 'um lead'}`);
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
  if (meta.chamariz && (!meta.acao || meta.acao === 'continuar')) await enviarChamariz(prisma, inst.instance_token, sdr, !!meta.ultima);
  const agora = new Date();
  await prisma.sdrLead.update({
    where: { id: sdr.id },
    data: { ultima_caroline_em: agora, ...(meta.fase === 'resposta' ? { status: 'CONVERSANDO' } : { status: 'AGUARDANDO', tentativas: { increment: 1 } }), ...(sdr.primeiro_envio_em ? {} : { primeiro_envio_em: agora }) },
  });
  if (meta.acao && meta.acao !== 'continuar') await aplicarAcao(prisma, inst.instance_token, sdr, meta.acao, meta);
  if ((meta.nota ?? 0) >= 35 || ['oferecer_demo', 'passar_vendedora'].includes(meta.acao)) await passarParaCaroline(prisma, sdr, `interesse na conversa (nota ${meta.nota ?? '—'})`);
  return { status: editada ? 'EDITADA' : 'APROVADA' };
}

// ── Mensagem do lead (webhook) ───────────────────────────────────────────────

const espera = new Map<string, NodeJS.Timeout>();
const ESPERA_MS = 40_000; // junta mensagens seguidas antes de responder

/** Chamado pelo webhook do WhatsApp da empresa. true = a conversa é da Caroline (os outros robôs ficam quietos). */
export async function aoReceberDoLead(prisma: PrismaClient, token: string, conversaId: string, tipo: string, texto: string, mensagemId: string, botaoId?: string | null): Promise<boolean> {
  const sdr = await prisma.sdrLead.findFirst({ where: { conversaId, status: { in: ATIVOS } }, orderBy: { created_at: 'desc' } });
  if (!sdr) return false;
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { ultima_lead_em: new Date(), ...(sdr.status !== 'FILA' ? { status: 'CONVERSANDO' } : {}) } });

  // Tocar em "Me chama depois"/"Quero saber mais" já é sinal de interesse: registra no termômetro.
  if (botaoId === 'sdr_depois' || botaoId === 'sdr_quero') {
    await registrarInteresse(prisma, sdr, botaoId === 'sdr_quero' ? 45 : 35,
      botaoId === 'sdr_quero' ? 'Tocou em "Quero saber mais" (interesse declarado)' : 'Pediu para ser chamado depois, não encerrou (interesse inicial)');
  }

  // "Me chama depois": combina o próximo dia útil, de manhã ou à tarde (resposta direta, sem IA).
  const primeiro = (sdr.nome || '').trim().split(/\s+/)[0];
  if (botaoId === 'sdr_depois') {
    const { dia, opcoes } = opcoesAgendamento(new Date());
    void dia;
    await enviarMensagens(prisma, token, sdr, [`Combinado${primeiro ? `, ${primeiro}` : ''}! 😊 Qual o melhor momento pra eu te chamar?`]).catch(() => {});
    const conv = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_numero: true } });
    if (conv) {
      const menu = { modo: 'button' as const, texto: 'É só tocar 👇', rodape: `${nomeDe(sdr)} · Prosystem`, opcoes };
      const r: any = await evo.enviarMenu(token, conv.contato_numero, menu).catch(() => ({}));
      await prisma.whatsappMensagem.create({ data: { conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: `${menu.texto}\n\n${opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, status: 'ENVIADA', enviada_por: agenteDe(sdr) } }).catch(() => {});
    }
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { ultima_caroline_em: new Date() } });
    registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'um lead'} pediu para chamar depois: combinando o horário`);
    return true;
  }
  const ag = lerAgendamento(botaoId);
  if (ag && ag !== 'outro') {
    const quando = `${nomeDoDia(ag.dia, new Date())} ${ag.periodo === 'manhã' ? 'de manhã' : 'à tarde'}`;
    await enviarMensagens(prisma, token, sdr, [`Perfeito! Te chamo ${quando}, então. Até lá! 👋`]).catch(() => {});
    // Volta a esperar; a rodada chama no horário combinado (retomada, sem contar como tentativa perdida).
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'AGUARDANDO', ultima_caroline_em: new Date(), tentativas: 1, dados: { ...((sdr.dados as any) || {}), retomar_em: ag.quando.toISOString(), combinado: quando } } });
    registrarAcaoAgente(agenteDe(sdr), `combinou chamar ${sdr.nome || 'o lead'} ${quando}`);
    return true;
  }
  if (tipo === 'TEXTO' && ehPedidoDeSaida(texto)) {
    await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { optout_campanhas: true } });
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SAIU' } });
    const resp = 'Tudo bem! Não vou mais te mandar mensagens. Se precisar, é só chamar por aqui. 💙';
    await enviarMensagens(prisma, token, sdr, [resp]).catch(() => {});
    registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'um lead'} pediu para sair`);
    return true;
  }
  if (tipo === 'AUDIO') {
    const { transcreverAudio } = await import('./assistente-ia.service');
    await transcreverAudio(prisma, mensagemId).catch((e: any) => console.warn('[CAROLINE] áudio:', e?.message));
  }
  const cfg = await obterConfigAgente(prisma, agenteDe(sdr));
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

/**
 * Acabaram as 3 tentativas: não desiste. O lead vai para o ciclo longo do Julio (nova rodada de
 * retomadas a cada 30 dias, até 3 ciclos). Depois disso, a vendedora recebe o lead com aviso.
 */
const CICLOS_MAX = 3;
async function naoDesistir(prisma: PrismaClient, s: any, agora: Date) {
  const d: any = s.dados || {};
  const ciclos = Number(d.ciclos || 0);
  if (ciclos >= CICLOS_MAX) {
    // Vai para a vendedora (ligação), respeitando o expediente dela (seg–sex 8h30–17h).
    const resumo = `📵 ${s.nome || s.numero}${s.empresa ? ` (${s.empresa})` : ''} não respondeu depois de ${CICLOS_MAX} ciclos de retomada: vale uma ligação da vendedora.`;
    await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'VENDEDORA', resumo, dados: { ...d, entregar_em: horarioVendedora(agora) ? null : proximaJanelaVendedora(agora).toISOString() } } });
    if (horarioVendedora(agora)) await entregarParaVendedora(prisma, s.id);
    return;
  }
  const volta = new Date(`${new Date(agora.getTime() + 30 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T09:30:00-03:00`);
  await prisma.sdrLead.update({ where: { id: s.id }, data: { agente: 'julio', status: 'AGUARDANDO', dados: { ...d, ciclos: ciclos + 1, ciclo_em: volta.toISOString() } } });
  if (s.lead_id) await prisma.leadObservacao.create({ data: { lead_id: s.lead_id, tipo: 'SISTEMA', descricao: `🤖 Sem resposta nas 3 tentativas. O Julio volta a chamar em ${volta.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (ciclo ${ciclos + 1} de ${CICLOS_MAX}).`, created_by: 'bot', created_by_name: 'Julio' } }).catch(() => {});
  registrarAcaoAgente('julio', `vai voltar a chamar ${s.nome || 'um lead'} em ${volta.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
}

// ── Rodada (a cada 2 min) ────────────────────────────────────────────────────

let proximoPrimeiroContato = 0;
const falhouEm = new Map<string, number>();
const falhasSeguidas: Record<string, number> = {};

// Conversa já existente no WhatsApp da empresa (mesmo número com/sem 9) ou uma nova, ligada ao lead.
async function conversaPara(prisma: PrismaClient, instanciaId: string, numero: string, d: { nome: string | null; lead_id: string | null }) {
  const cs = await prisma.whatsappConversa.findMany({ where: { instanciaId, contato_numero: { endsWith: ultimos8(numero) } }, select: { id: true, contato_numero: true, optout_campanhas: true, ultima_em: true } });
  const c = cs.find(x => ultimos8(x.contato_numero) === ultimos8(numero));
  if (c) return c;
  return prisma.whatsappConversa.create({
    data: { instanciaId, contato_numero: numero, contato_nome: d.nome, tipo_contato: 'LEAD', lead_id: d.lead_id, bot_ativo: false, nao_lidas: 0 },
    select: { id: true, contato_numero: true, optout_campanhas: true, ultima_em: true },
  });
}

const FECHADAS_LEAD = ['FECHADO', 'PERDIDO', 'ACEITO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO', 'ONBOARDING', 'EXECUCAO_TECNICA'];
const PROPOSTA_ABERTA = ['ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO', 'EXPIRADA', 'CONTRATO_EM_GERACAO'];
const SETE_DIAS = 7 * 864e5;

/**
 * Abastece as filas automáticas com poucos por vez (sem criar centenas de conversas):
 * Luiz Felipe = propostas não assinadas paradas há 7+ dias; Julio = leads abertos,
 * do mais novo para o mais antigo, sem conversa nos últimos 7 dias.
 */
async function abastecerFila(prisma: PrismaClient, agente: 'julio' | 'luiz_felipe', instanciaId: string) {
  const naFila = await prisma.sdrLead.count({ where: { agente, status: 'FILA' } });
  if (naFila >= 2) return;
  const jaTem = new Set((await prisma.sdrLead.findMany({ select: { lead_id: true, proposta_id: true, numero: true } })).flatMap(x => [x.lead_id, x.proposta_id, ultimos8(x.numero)]).filter(Boolean) as string[]);
  const recente = new Date(Date.now() - SETE_DIAS);
  const quer = 2 - naFila;
  let postos = 0;
  if (agente === 'luiz_felipe') {
    const ps = await prisma.propostaComercial.findMany({
      where: { deleted_at: null, status: { in: PROPOSTA_ABERTA }, updated_at: { lt: recente } },
      select: { id: true, responsavel_nome: true, responsavel_telefone: true, nome_fantasia: true, razao_social: true, segmento: true, created_at: true, wpp_enviada_em: true, wpp_followup_etapa: true },
      orderBy: { updated_at: 'desc' }, take: 50,
    });
    for (const x of ps) {
      if (postos >= quer) break;
      const numero = numeroWhatsapp(x.responsavel_telefone);
      if (!numero || jaTem.has(x.id) || jaTem.has(ultimos8(numero))) continue;
      if (x.wpp_enviada_em && (x.wpp_followup_etapa ?? 0) < 3) continue; // o follow-up dos dias 2/5/7 ainda está cuidando
      const lead = await acharLead(prisma, numero);
      const conv = await conversaPara(prisma, instanciaId, numero, { nome: x.responsavel_nome, lead_id: lead?.id || null });
      if (conv.optout_campanhas || (conv.ultima_em && conv.ultima_em > recente)) continue;
      await prisma.sdrLead.create({ data: { agente, proposta_id: x.id, lead_id: lead?.id || null, conversaId: conv.id, numero, nome: x.responsavel_nome, empresa: (x.nome_fantasia || x.razao_social || '').trim() || null, segmento: x.segmento, cadastro_em: x.created_at, status: 'FILA', criado_por: 'luiz_felipe' } });
      jaTem.add(ultimos8(numero)); postos++;
    }
  } else {
    const ls = await prisma.lead.findMany({
      where: { deleted_at: null, etapa_comercial: { notIn: FECHADAS_LEAD }, status: { notIn: ['GANHO', 'PERDIDO'] } },
      select: { id: true, nome: true, nome_fantasia: true, empresa: true, responsavel_nome: true, responsavel_telefone: true, telefone: true, segmento: true, created_at: true },
      orderBy: { created_at: 'desc' }, take: 300,
    });
    const comProposta = new Set((await prisma.propostaComercial.findMany({ where: { deleted_at: null, status: { in: PROPOSTA_ABERTA } }, select: { responsavel_telefone: true } })).map(p => ultimos8((p.responsavel_telefone || '').replace(/\D/g, ''))));
    for (const x of ls) {
      if (postos >= quer) break;
      const numero = numeroWhatsapp(x.responsavel_telefone || x.telefone);
      if (!numero || jaTem.has(x.id) || jaTem.has(ultimos8(numero)) || comProposta.has(ultimos8(numero))) continue; // proposta aberta = Luiz Felipe
      const conv = await conversaPara(prisma, instanciaId, numero, { nome: x.responsavel_nome, lead_id: x.id });
      if (conv.optout_campanhas || (conv.ultima_em && conv.ultima_em > recente)) { jaTem.add(ultimos8(numero)); continue; }
      // Follow-up conduzido pelo Julio: a conversa parada fica sem dono enquanto ele fala (quem responder assume).
      await prisma.whatsappConversa.update({ where: { id: conv.id }, data: { dono_id: null, lead_id: x.id, bot_ativo: false } }).catch(() => {});
      await prisma.sdrLead.create({ data: { agente, lead_id: x.id, conversaId: conv.id, numero, nome: x.responsavel_nome, empresa: (x.nome_fantasia || x.empresa || x.nome || '').trim() || null, segmento: x.segmento, cadastro_em: x.created_at, status: 'FILA', criado_por: 'julio' } });
      jaTem.add(ultimos8(numero)); postos++;
    }
  }
}

export async function rodarCaroline(prisma: PrismaClient, agora = new Date()): Promise<void> {
  const cfgs = Object.fromEntries(await Promise.all(AGENTES_SDR.map(async a => [a, await obterConfigAgente(prisma, a)] as const))) as Record<PerfilSdr, ConfigCaroline>;
  const ativos = AGENTES_SDR.filter(a => trabalhando(cfgs[a], agora));
  if (!ativos.length) return;
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

  // Leads guardados fora do expediente: entram para a vendedora às 8h30 do dia útil.
  if (horarioVendedora(agora)) {
    const guardados = await prisma.sdrLead.findMany({ where: { status: 'VENDEDORA' }, select: { id: true, dados: true }, take: 100 });
    for (const g of guardados) {
      const em = (g.dados as any)?.entregar_em;
      if (em && new Date(em) <= agora) await entregarParaVendedora(prisma, g.id);
    }
  }

  // 1) Respostas atrasadas (a IA falhou, o servidor reiniciou ou chegou fora de hora): responde quem
  //    está esperando. É conversa que o cliente puxou, então vale das 7h às 21h, todos os dias.
  const horaSP = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora));
  if (horaSP >= 7 && horaSP < 21) {
    const esperando = await prisma.sdrLead.findMany({ where: { agente: { in: ativos }, status: 'CONVERSANDO', ultima_lead_em: { not: null } }, take: 20 });
    for (const s of esperando) {
      if (s.ultima_caroline_em && s.ultima_lead_em! <= s.ultima_caroline_em) continue;
      if (Date.now() - s.ultima_lead_em!.getTime() < 2 * 60_000) continue; // o webhook está cuidando
      if ((falhouEm.get(s.id) || 0) > Date.now() - 10 * 60_000) continue; // falhou há pouco: tenta de novo em 10 min
      const r = await falar(prisma, token, s.id, 'resposta').catch(() => 'falha' as const);
      if (r === 'falha') falhouEm.set(s.id, Date.now()); else falhouEm.delete(s.id);
    }
  }

  if (!horarioComercial(agora)) return;

  // 1b) Parou no meio da conversa (a última mensagem é do agente, 1 dia útil sem resposta):
  //     vira retomada de follow-up e a gestão é avisada. Nenhum lead fica esquecido.
  const conversando = await prisma.sdrLead.findMany({ where: { agente: { in: ativos }, status: 'CONVERSANDO', ultima_caroline_em: { not: null } }, take: 50 });
  for (const s of conversando) {
    if (s.ultima_lead_em && s.ultima_lead_em > s.ultima_caroline_em!) continue; // a vez é do agente
    if (diasUteisEntre(s.ultima_caroline_em!, agora) < 1) continue;
    if (await prisma.sdrMensagem.findFirst({ where: { sdrId: s.id, status: 'PENDENTE' }, select: { id: true } })) continue; // esperando aprovação
    await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'AGUARDANDO', tentativas: 1, dados: { ...((s.dados as any) || {}), parou_em: agora.toISOString() } } });
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `⏸ *${s.nome || s.numero}${s.empresa ? ` (${s.empresa})` : ''} parou de responder* ${nomeDe(s) === 'Luiz Felipe' ? 'ao' : 'à'} ${nomeDe(s)}.\nÚltima mensagem ${s.ultima_caroline_em!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Termômetro ${s.nota ?? '—'}.\nA retomada já está programada (até 3 tentativas). Se quiser, assuma a conversa.`).catch(() => {});
    registrarAcaoAgente(agenteDe(s), `${s.nome || 'um lead'} parou de responder: retomada programada`);
  }

  // 2) Retomadas de quem não respondeu; depois da 3ª tentativa, o ciclo longo (nunca desiste de cara).
  const aguardando = await prisma.sdrLead.findMany({ where: { agente: { in: ativos }, status: 'AGUARDANDO' }, take: 50 });
  for (const s of aguardando) {
    // Horário combinado com o lead ("Me chama depois"): chama nesse horário, não antes.
    const combinado = (s.dados as any)?.retomar_em ? new Date((s.dados as any).retomar_em) : null;
    if (combinado) {
      if (agora >= combinado) {
        await prisma.sdrLead.update({ where: { id: s.id }, data: { dados: { ...((s.dados as any) || {}), retomar_em: null, chamar_combinado: (s.dados as any).combinado || true } } });
        await falar(prisma, token, s.id, 'retomada');
        // O "como combinamos" vale só para esta mensagem.
        const depois = await prisma.sdrLead.findUnique({ where: { id: s.id }, select: { dados: true } });
        await prisma.sdrLead.update({ where: { id: s.id }, data: { dados: { ...((depois?.dados as any) || {}), chamar_combinado: null } } });
      }
      continue;
    }
    // Ciclo longo (lead que não respondeu às 3 tentativas): o Julio volta a chamar na data marcada.
    const ciclo = (s.dados as any)?.ciclo_em ? new Date((s.dados as any).ciclo_em) : null;
    if (ciclo) {
      if (agora >= ciclo && horaBoaParaRetomar(agora)) {
        await prisma.sdrLead.update({ where: { id: s.id }, data: { tentativas: 0, dados: { ...((s.dados as any) || {}), ciclo_em: null } } });
        await falar(prisma, token, s.id, 'retomada');
      }
      continue;
    }
    if (s.tentativas >= TENTATIVAS_MAX) {
      if (s.ultima_caroline_em && diasUteisEntre(s.ultima_caroline_em, agora) >= 5) await naoDesistir(prisma, s, agora);
      continue;
    }
    // Retomada só nos horários em que o comerciante costuma olhar o celular (9h–11h30 e 14h–17h).
    if (deveRetomar(s.tentativas, s.ultima_caroline_em, agora) && horaBoaParaRetomar(agora)) await falar(prisma, token, s.id, 'retomada');
  }

  // 3) Primeiros contatos: UM por vez para todos os agentes juntos, intervalo sorteado (4–9 min)
  //    e um limite do dia ÚNICO (Caroline + Julio + Luiz Felipe + campanhas). Protege o número.
  for (const a of ['julio', 'luiz_felipe'] as const) if (ativos.includes(a)) await abastecerFila(prisma, a, inst.id).catch((e: any) => console.warn(`[${a}] fila:`, e?.message));
  if (Date.now() < proximoPrimeiroContato) return;
  const desde = new Date(`${agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T00:00:00-03:00`);
  const [feitosAgentes, feitosCampanha] = await Promise.all([
    prisma.sdrLead.count({ where: { primeiro_envio_em: { gte: desde } } }),
    prisma.campanhaEnvio.count({ where: { status: 'ENVIADO', enviado_em: { gte: desde } } }),
  ]);
  // Limite mais conservador entre os agentes ligados (quem começou há menos de 2 semanas puxa para 15).
  const limite = Math.min(...ativos.map(a => limiteDoDia(cfgs[a].ativada_em ? new Date(cfgs[a].ativada_em!) : null, cfgs[a].limite, agora)));
  if (feitosAgentes + feitosCampanha >= limite) return;
  let proximo = null as Awaited<ReturnType<typeof prisma.sdrLead.findFirst>>;
  for (const a of ativos) { // prioridade: Caroline (campanha) → Luiz Felipe (propostas) → Julio (base)
    proximo = await prisma.sdrLead.findFirst({ where: { agente: a, status: 'FILA' }, orderBy: a === 'caroline' ? { created_at: 'asc' } : { cadastro_em: 'desc' } });
    if (proximo) break;
  }
  if (!proximo) return;
  const r = await falar(prisma, token, proximo.id, 'abertura');
  proximoPrimeiroContato = Date.now() + intervaloSorteado();
  const ag = agenteDe(proximo);
  if (r === 'falha') {
    falhasSeguidas[ag] = (falhasSeguidas[ag] || 0) + 1;
    if (falhasSeguidas[ag] >= 3) {
      await salvarConfigAgente(prisma, ag, { ativa: false, pausada_motivo: '3 falhas seguidas no envio/IA' }, ag);
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      await enviarAvisoGestao(prisma, 'lead_qualificado', `⚠️ *${PERFIS_SDR[ag].nome} pausou sozinho(a)*: 3 falhas seguidas no primeiro contato. Confira o WhatsApp da empresa e religue no Escritório.`);
      falhasSeguidas[ag] = 0;
    }
  } else falhasSeguidas[ag] = 0;
}

// ── Painel ─────────────────────────────────────────────────────────────────

export async function painelCaroline(prisma: PrismaClient, agente: PerfilSdr = 'caroline') {
  const [cfg, leads] = await Promise.all([
    obterConfigAgente(prisma, agente),
    prisma.sdrLead.findMany({ where: { agente }, orderBy: { updated_at: 'desc' }, take: 200 }),
  ]);
  const pendentes = await prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE', sdrId: { in: leads.map(l => l.id) } }, orderBy: { created_at: 'asc' } });
  const porStatus: Record<string, number> = {};
  for (const l of leads) porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  const nomes = new Map(leads.map(l => [l.id, l]));
  const { usoIaUltimosDias } = await import('./uso-ia.service');
  return {
    uso_ia: await usoIaUltimosDias(prisma, 7),
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
