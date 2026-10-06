import { contatoSemAgentes } from '@/lib/laya';
import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { campanhaVigente } from '@/lib/assistente/negociacao';
import { ehPedidoDeSaida, ultimos8 } from '@/lib/assistente/campanhas';
import { ehRespostaAutomatica, compromissoDeHorario, ehAdiamento } from '@/lib/assistente/sdr';
// Cliente adiou e não disse quando: retomada daqui a 5 dias (às 9h30), nunca no mesmo dia.
const DIAS_RETOMADA_ADIOU = 5;
const emDiasUteis = (dias: number, base = new Date()) => {
  const d = new Date(`${new Date(base.getTime() + dias * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T09:30:00-03:00`);
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d);
  return new Date(d.getTime() + (dow === 'Sat' ? 2 : dow === 'Sun' ? 1 : 0) * 864e5);
};
import { REMETENTES_AUTOMATICOS } from '@/lib/painel-tv';
import { registrarMudancaTemperatura } from '@/lib/lead-temperatura';
import {
  lerLeadsColados, horarioComercial, limiteDoDia, intervaloSorteado, tempoDigitando, deveRetomar, diasUteisEntre,
  lerRespostaCaroline, temperaturaDaNota, promptCaroline, saudacaoAgora, ABERTURA_JESSICA, TENTATIVAS_MAX, horaBoaParaRetomar,
  opcoesAgendamento, lerAgendamento, nomeDoDia, horarioVendedora, proximaJanelaVendedora,
  PERFIS_SDR, CONVITE_INSTAGRAM, mensagemSuporte, janelaCampanhaAtiva, ehSoConfirmacao, semelhanca, type RespostaCaroline, type FaseCaroline, type PerfilSdr,
  apresentacaoDoSegmento, garantirLinkApresentacao, MARCA_APRESENTACAO, type Apresentacao,
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
      if (jaNaCaroline) avisos.push('Este número já está com a Caroline: ao confirmar, só completo o cadastro dele com a empresa, o e-mail e a campanha (sem duplicar e sem mensagem nova).');
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
  // Já está com um agente: não duplica nem manda mensagem, mas completa o cadastro com os dados
  // da plataforma (empresa, e-mail, campanha), para o agente saber de onde o lead veio.
  let atualizados = 0;
  for (const l of prev.filter(x => !x.pode && x.numero)) {
    const s = await prisma.sdrLead.findFirst({ where: { numero: { endsWith: ultimos8(l.numero!) }, status: { in: ATIVOS } }, orderBy: { created_at: 'desc' } });
    if (!s) continue;
    await prisma.sdrLead.update({ where: { id: s.id }, data: { empresa: s.empresa || l.empresa, email: s.email || l.email, segmento: s.segmento || l.segmento, campanha: l.campanha || s.campanha, cadastro_em: s.cadastro_em || l.cadastro_em } });
    if (s.lead_id) {
      const lead = await prisma.lead.findUnique({ where: { id: s.lead_id }, select: { empresa: true, responsavel_email: true, segmento: true, campanha_nome: true } });
      await prisma.lead.update({ where: { id: s.lead_id }, data: {
        ...(!lead?.empresa && l.empresa ? { empresa: l.empresa } : {}), ...(!lead?.responsavel_email && l.email ? { responsavel_email: l.email } : {}),
        ...(!lead?.segmento && l.segmento ? { segmento: l.segmento } : {}), ...(l.campanha ? { campanha_nome: l.campanha, utm_campaign: l.campanha, utm_source: l.origem || 'facebook' } : {}),
      } as any }).catch(() => {});
      await prisma.leadObservacao.create({ data: { lead_id: s.lead_id, tipo: 'SISTEMA', descricao: `Também se inscreveu na campanha ${l.campanha || '—'}${l.empresa ? ` (empresa: ${l.empresa})` : ''}. Cadastro completado, sem duplicar.`, created_by: user.id, created_by_name: user.nome || 'Equipe' } }).catch(() => {});
    }
    atualizados++;
  }
  return { criados, atualizados, ignorados: prev.length - criados - atualizados };
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
  // Passagem de bastão com contexto: o que a Bia apurou na triagem vai para a Caroline.
  const apurado = [d.segmento && `segmento ${d.segmento}`, d.cidade && `cidade ${d.cidade}`, d.sistema_atual && `usa hoje ${d.sistema_atual}`, (d.receita?.nome_fantasia || d.receita?.razao_social) && `empresa ${d.receita?.nome_fantasia || d.receita?.razao_social}`, d.cnpj && `CNPJ ${d.cnpj}`].filter(Boolean).join(', ');
  const { anotar } = await import('./equipe.service');
  await anotar(prisma, { de: 'bia', para: 'caroline', tipo: 'CONTEXTO', assunto: `Lead da triagem: ${d.nome || c.contato_nome || c.contato_numero}`, texto: `Carol, passei ${d.nome || c.contato_nome || 'esse lead'} pela triagem e já mandei o material${apurado ? `. O que apurei: ${apurado}` : ''}. Segue com ele.`, ref: conversaId });
}

// ── Regras da conversa ──────────────────────────────────────────────────────

/** Uma pessoa assumiu depois que a Caroline pegou a conversa? (dono ou mensagem humana). */
async function pessoaAssumiu(prisma: PrismaClient, sdr: { conversaId: string | null; desde: Date }): Promise<boolean> {
  if (!sdr.conversaId) return false;
  const c = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { dono_id: true } });
  if (c?.dono_id) return true;
  // Mensagem de uma pessoa (ex.: mandada do celular) sem assumir no CRM só conta como "conversando"
  // nos últimos 10 minutos; depois disso o agente segue, para o cliente nunca ficar sem resposta.
  const recente = new Date(Math.max(new Date(sdr.desde).getTime(), Date.now() - 10 * 60_000));
  const humana = await prisma.whatsappMensagem.findFirst({
    where: {
      conversaId: sdr.conversaId, direcao: 'SAIDA', created_at: { gt: recente },
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

/**
 * Aprendizado com as conversas que a equipe assume: pares "cliente disse → pessoa respondeu"
 * dos últimos 30 dias (texto ou áudio transcrito), para os agentes fazerem igual ou melhor.
 * Cache de 30 min (a consulta varre mensagens).
 */
let cacheAprendizado: { em: number; pares: { cliente: string; equipe: string }[] } | null = null;
export async function aprendizadoDaEquipe(prisma: PrismaClient): Promise<{ cliente: string; equipe: string }[]> {
  if (cacheAprendizado && Date.now() - cacheAprendizado.em < 30 * 60_000) return cacheAprendizado.pares;
  const automaticos = [...REMETENTES_AUTOMATICOS, ...REMETENTES_SDR, 'bot', 'abertura_jessica', 'assistente_ia', 'campanha', 'cadencia_automatica'];
  const humanas = await prisma.whatsappMensagem.findMany({
    where: {
      direcao: 'SAIDA', created_at: { gte: new Date(Date.now() - 30 * 86400000) },
      OR: [{ enviada_por: null }, { enviada_por: { notIn: automaticos } }],
    },
    orderBy: { created_at: 'desc' }, take: 120,
    select: { conversaId: true, conteudo: true, transcricao: true, tipo: true, created_at: true },
  }).catch(() => []);
  const pares: { cliente: string; equipe: string }[] = [];
  const vistas = new Set<string>();
  for (const h of humanas) {
    if (pares.length >= 6) break;
    const resposta = (h.tipo === 'AUDIO' ? h.transcricao : h.conteudo) || '';
    if (resposta.trim().length < 25 || /^\[(áudio|imagem|vídeo|documento)\]$/i.test(resposta.trim()) || vistas.has(h.conversaId)) continue;
    const antes = await prisma.whatsappMensagem.findFirst({
      where: { conversaId: h.conversaId, direcao: 'ENTRADA', created_at: { lt: h.created_at } }, orderBy: { created_at: 'desc' },
      select: { conteudo: true, transcricao: true, tipo: true },
    }).catch(() => null);
    const cliente = (antes?.tipo === 'AUDIO' ? antes.transcricao : antes?.conteudo) || '';
    if (cliente.trim().length < 2) continue;
    vistas.add(h.conversaId);
    pares.push({ cliente: cliente.trim().slice(0, 300), equipe: resposta.trim().slice(0, 500) });
  }
  cacheAprendizado = { em: Date.now(), pares };
  return pares;
}

// Resumo da proposta do cliente (para o agente relembrar). Guarda os valores citados, que ficam liberados no filtro de preço.
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function resumoProposta(x: any, valores: string[]): string | null {
  const plano = String(x.plano_selecionado || '').toUpperCase();
  const mensal = plano === 'BASIC' ? x.mensalidade_basic : plano === 'PRO' ? x.mensalidade_pro : plano === 'PLUS' ? x.mensalidade_plus : null;
  const partes: string[] = [];
  const v = (n: number) => { const t = brl(n); valores.push(t); return t; };
  if (plano) partes.push(`plano ${plano === 'PLUS' ? 'Plus' : plano === 'PRO' ? 'Pro' : plano === 'BASIC' ? 'Basic' : plano}`);
  if (mensal) partes.push(`mensalidade ${v(mensal)}`);
  const impl = x.valor_final || x.valor_implantacao;
  if (impl) partes.push(`implantação ${v(impl)}`);
  if (x.parcelas && x.valor_parcela) partes.push(`${x.entrada ? `entrada de ${v(x.entrada)} + ` : ''}${x.parcelas}x de ${v(x.valor_parcela)}`);
  return partes.length ? partes.join(', ') : null;
}

const ASSUNTO_COMERCIAL = /(cobr|valor|r\$|\d+\s*reais|pag(ar|amento|uei)|boleto|servico|contrat|jessica|thiago|farmacia popular|banco de dados|troca de cnpj|cnpj|unidade nova|loja nova|filial|orcamento|nota fiscal)/;
// Contexto do cliente (cadastro e serviços contratados) pelo telefone, para o agente não responder no escuro.
async function contextoDoCliente(prisma: PrismaClient, numero: string | null | undefined): Promise<string> {
  const fim = ultimos8(numero || '');
  if (fim.length < 8) return '';
  const cli: any = await prisma.cliente.findFirst({ where: { OR: [{ telefone: { endsWith: fim } }, { telefone1: { endsWith: fim } }, { telefone2: { endsWith: fim } }] } as any, select: { id: true, razao_social: true, status: true } as any }).catch(() => null);
  if (!cli) return '';
  const vendas: any[] = await prisma.vendaAdicional.findMany({ where: { cliente_id: cli.id, status: { not: 'CANCELADO' } }, orderBy: { created_at: 'desc' }, take: 5, select: { descricao_servico: true, valor_venda: true, etapa: true, status: true, created_at: true, parceiro: { select: { nome: true } } } as any }).catch(() => []);
  const linhas = vendas.map(v => `- ${v.parceiro?.nome || 'Serviço'}${v.descricao_servico ? ` (${String(v.descricao_servico).slice(0, 120)})` : ''}${v.valor_venda ? `, ${brl(v.valor_venda)}` : ''}, fase ${v.etapa || v.status}, lançado em ${new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  return `CONTEXTO DO CLIENTE: este contato JÁ É CLIENTE da Prosystem (${cli.razao_social || 'cadastro'}${cli.status ? `, ${cli.status}` : ''}).${linhas.length ? ` Serviços contratados com a equipe:
${linhas.join('\n')}` : ''}
Não trate como lead novo. Se ele falar de um desses serviços (prazo, valor, andamento), responda com esses dados, sem inventar, e diga que vai confirmar o andamento com a responsável (use acao "duvida_fora_material" com a dúvida dele).`;
}

async function ehClienteAtivo(prisma: PrismaClient, numero: string | null | undefined): Promise<boolean> {
  const fim = ultimos8(numero || '');
  if (fim.length < 8) return false;
  const c: any = await prisma.cliente.findFirst({ where: { OR: [{ telefone: { endsWith: fim } }, { telefone1: { endsWith: fim } }, { telefone2: { endsWith: fim } }] } as any, select: { status: true } as any }).catch(() => null);
  return !!c && !/inativ|cancel/i.test(String(c.status || ''));
}
// Contato que já usa o Prosystem não é lead: sai da lista do agente (não apaga nada, só encerra o follow-up).
const JA_CLIENTE = /(ja (usa|usamos|utiliza|utilizamos|tem|temos|e|somos) (o )?(sistema )?(da )?prosystem|ja (e|somos) cliente|ja usa(mos)? o sistema de voces|cliente prosystem|ja usa o prosystem)/;
async function tirarDaListaJaCliente(prisma: PrismaClient, sdr: any, motivo: string) {
  const d: any = sdr.dados || {};
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SEM_INTERESSE', dados: { ...d, ja_cliente: true, ja_cliente_motivo: motivo, ja_cliente_em: new Date().toISOString(), retomar_em: null } } });
  registrarAcaoAgente(agenteDe(sdr), `tirou ${sdr.nome || sdr.empresa || 'um contato'} da lista: já é cliente Prosystem`);
}

/**
 * Quem respondeu passou o WhatsApp do decisor (dono/gerente): vira lead novo, ligado à mesma empresa,
 * e entra na fila da Caroline para a captação do zero (a fila respeita limite, intervalo e horário do número).
 * Não duplica: número já em conversa com agente, cliente ativo ou marcado sem agente fica de fora.
 */
async function registrarDecisorIndicado(prisma: PrismaClient, sdr: any, nc: NonNullable<RespostaCaroline['novo_contato']>) {
  const numero = nc.numero;
  const quem = [nc.nome, nc.cargo].filter(Boolean).join(', ') || 'o responsável';
  const anotar = (descricao: string) => sdr.lead_id
    ? prisma.leadObservacao.create({ data: { lead_id: sdr.lead_id, tipo: 'SISTEMA', descricao, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {})
    : Promise.resolve();
  if (ultimos8(numero) === ultimos8(sdr.numero || '')) return;
  if (await prisma.sdrLead.findFirst({ where: { numero: { endsWith: ultimos8(numero) }, status: { in: ATIVOS } }, select: { id: true } })) {
    await anotar(`📇 A loja passou o contato de ${quem}: ${numero}. Esse número já está em conversa com um agente.`);
    return;
  }
  if (await ehClienteAtivo(prisma, numero) || await contatoSemAgentes(prisma, numero)) {
    await anotar(`📇 A loja passou o contato de ${quem}: ${numero}. Não entra na captação (já é cliente ou está marcado para não falar com agentes).`);
    return;
  }
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst) return;
  const d: any = sdr.dados || {};
  const origem = sdr.lead_id ? await prisma.lead.findUnique({ where: { id: sdr.lead_id }, select: { empresa: true, nome_fantasia: true, razao_social: true, cnpj: true, segmento: true, cidade: true, estado: true } }).catch(() => null) : null;
  const empresa = sdr.empresa || origem?.nome_fantasia || origem?.empresa || null;
  const obs = `Decisor indicado pela própria loja na conversa com ${nomeDe(sdr)} (número da loja: ${sdr.numero}). ${quem}${empresa ? `, da ${empresa}` : ''}. Captação do zero.`;
  let lead = await acharLead(prisma, numero);
  if (!lead) {
    const novo = await prisma.lead.create({
      data: {
        nome: empresa || nc.nome || numero, nome_fantasia: origem?.nome_fantasia || null, razao_social: origem?.razao_social || null, empresa, cnpj: origem?.cnpj || null,
        segmento: sdr.segmento || origem?.segmento || null, cidade: d.cidade || origem?.cidade || null, estado: origem?.estado || null,
        responsavel_nome: nc.nome, telefone: numero, responsavel_telefone: numero, origem: 'INDICACAO', temperatura: 'FRIO', etapa_sdr: 'NOVO_LEAD',
        campanha_nome: 'Decisor indicado pela loja', observacoes: obs, created_by: agenteDe(sdr),
      } as any,
      select: { id: true },
    });
    lead = { id: novo.id } as any;
  }
  await prisma.leadObservacao.create({ data: { lead_id: lead!.id, tipo: 'SISTEMA', descricao: obs, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {});
  const conv = await garantirConversaLead(prisma, inst.id, numero, nc.nome, lead!.id);
  await prisma.sdrLead.create({
    data: {
      agente: 'caroline', lead_id: lead!.id, conversaId: conv.id, numero, nome: nc.nome, empresa, segmento: sdr.segmento, campanha: 'Decisor indicado pela loja',
      cadastro_em: new Date(), status: 'FILA', criado_por: agenteDe(sdr),
      dados: { indicacao: { por: sdr.nome || null, cargo: nc.cargo, sdr_origem: sdr.id, numero_loja: sdr.numero }, ...(d.cidade ? { cidade: d.cidade } : {}), ...(d.sistema_atual ? { sistema_atual: d.sistema_atual } : {}) },
    },
  });
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...d, decisor: quem, decisor_numero: numero } } }).catch(() => {});
  await anotar(`📇 A loja passou o contato de ${quem}: ${numero}. Cadastrado como lead novo; a Caroline começa a captação com ele.`);
  registrarAcaoAgente(agenteDe(sdr), `conseguiu o contato do decisor de ${empresa || 'uma loja'} (${quem}): virou lead novo`);
}

async function garantirConversaLead(prisma: PrismaClient, instanciaId: string, numero: string, nome: string | null, leadId: string) {
  const cs = await prisma.whatsappConversa.findMany({ where: { instanciaId, contato_numero: { endsWith: ultimos8(numero) } }, select: { id: true, contato_numero: true } });
  const achou = cs.find(c => ultimos8(c.contato_numero) === ultimos8(numero));
  if (achou) {
    await prisma.whatsappConversa.update({ where: { id: achou.id }, data: { lead_id: leadId, tipo_contato: 'LEAD', contato_nome: nome || undefined, dono_id: null, bot_ativo: false } });
    return achou;
  }
  return prisma.whatsappConversa.create({ data: { instanciaId, contato_numero: numero, contato_nome: nome, tipo_contato: 'LEAD', lead_id: leadId, bot_ativo: false, nao_lidas: 0 }, select: { id: true, contato_numero: true } });
}

/**
 * Apresentação do segmento para esta mensagem (padaria → padaria, farmácia → farmácia), com a marca de já enviada
 * se o link já está na conversa. null quando não se aplica: segmento desconhecido, Luiz Felipe (já tem proposta),
 * recuperação de proposta e o primeiro contato ativo (prospecção do Heitor ou indicação), que vai sem link para
 * proteger o número; nesses o link sai na primeira resposta.
 */
async function apresentacaoPara(prisma: PrismaClient, sdr: any, fase: FaseCaroline): Promise<Apresentacao | null> {
  const d: any = sdr.dados || {};
  if (agenteDe(sdr) === 'luiz_felipe' || sdr.proposta_id || recuperacaoAtiva(sdr) || !sdr.conversaId) return null;
  if (fase === 'abertura' && (d.prospeccao || d.indicacao)) return null;
  const ap = apresentacaoDoSegmento(sdr.segmento, sdr.empresa);
  if (!ap) return null;
  const enviada = !!(await prisma.whatsappMensagem.findFirst({ where: { conversaId: sdr.conversaId, direcao: 'SAIDA', conteudo: { contains: MARCA_APRESENTACAO } }, select: { id: true } }).catch(() => null));
  return { ...ap, enviada };
}

/** Link da apresentação pendente garantido na mensagem (só quando a conversa segue; nunca em despedida). */
function comApresentacao(r: RespostaCaroline, ap: Apresentacao | null): RespostaCaroline {
  if (!ap || ap.enviada || !['continuar', 'oferecer_demo'].includes(r.acao)) return r;
  return { ...r, mensagens: garantirLinkApresentacao(r.mensagens, ap.url) };
}

async function gerarResposta(prisma: PrismaClient, sdr: any, fase: FaseCaroline, dica = ''): Promise<RespostaCaroline | null> {
  const valoresProposta: string[] = [];
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
  const ap = await apresentacaoPara(prisma, sdr, fase);
  const { contextoDaEquipe } = await import('./equipe.service');
  const daEquipe = await contextoDaEquipe(prisma, sdr.conversaId);
  const p = promptCaroline({
    guia: await guiaComercial(prisma), instrucoes: (await instrucoesPara(prisma, agenteDe(sdr))) + (await import('@/lib/assistente/conversas-agentes').then(m => { const x = m.memoriaDoAgente(agenteDe(sdr)); return x.length ? `\n### O que você aprendeu com os colegas (use se ajudar)\n${x.slice(0, 5).map(y => `- ${y.texto}`).join('\n')}` : ''; })) + daEquipe + refazer + (dica ? `\n=== ATENÇÃO NESTA RESPOSTA ===\n${dica}` : ''), exemplos: await exemplosEditados(prisma), aprendizado: await aprendizadoDaEquipe(prisma),
    historico: h.texto, fase, saudacao: saudacaoAgora(new Date()),
    perfil: agenteDe(sdr),
    apresentacao: ap,
    // Campanha: só dias 20+, e uma vez por mês por cliente (depois de autorizada ou recusada não pede de novo).
    janelaCampanha: janelaCampanhaAtiva(new Date()) && (sdr.dados as any)?.campanha_mes !== new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7),
    // Condição autorizada vale 5 dias corridos a partir da autorização; depois some da conversa.
    descontoAutorizado: campanhaVigente((sdr.dados as any)?.desconto_autorizado) ? (sdr.dados as any).desconto_autorizado : null,
    followup: {
      cadastro_em: sdr.cadastro_em ? new Date(sdr.cadastro_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' }) : null,
      proposta: sdr.proposta_id ? await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { plano_selecionado: true, wpp_enviada_em: true, created_at: true, status: true, mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, valor_implantacao: true, valor_final: true, entrada: true, parcelas: true, valor_parcela: true } })
        .then(x => x && { plano: x.plano_selecionado, status: x.status, enviada_em: (x.wpp_enviada_em || x.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }), resumo: resumoProposta(x, valoresProposta) }).catch(() => null) : null,
    },
    // Assuntos da atualidade só no follow-up de quem já conversou (1ª e 2ª retomadas usam o dia a dia).
    atualidades: fase === 'retomada' && sdr.ultima_lead_em ? atualidades : [],
    lead: { nome: agenteDe(sdr) === 'caroline' ? sdr.nome : await nomeParaChamar(prisma, sdr.numero, sdr.nome), empresa: sdr.empresa, segmento: sdr.segmento, campanha: sdr.campanha, abertura_jessica: sdr.abertura_enviada, tentativa: sdr.tentativas, ja_conversou: !!sdr.ultima_lead_em, combinado: fase === 'retomada' && (sdr.dados as any)?.chamar_combinado ? String((sdr.dados as any).chamar_combinado) : null,
      indicacao: (sdr.dados as any)?.indicacao ? { por: (sdr.dados as any).indicacao.por || null, cargo: (sdr.dados as any).indicacao.cargo || null } : null,
      prospeccao: (sdr.dados as any)?.prospeccao ? { cidade: (sdr.dados as any).cidade || null, bairro: (sdr.dados as any).bairro || null } : null,
      recuperacao: recuperacaoAtiva(sdr) ? { motivo_informado: recuperacaoAtiva(sdr).motivo_informado || null, pergunta_feita: !!recuperacaoAtiva(sdr).pergunta_feita_em } : null },
  });
  const partes: any[] = [{ text: p.usuario }];
  const dm = h.foto?.match(/^data:([^;]+);base64,(.+)$/);
  if (fase === 'resposta' && dm && dm[2].length < 6_000_000) partes.push({ inline_data: { mime_type: dm[1], data: dm[2] } });
  for (let i = 0; i < 2; i++) {
    try {
      const bruto = await chamarGemini(prisma, { sistema: p.sistema, partes, json: true, temperatura: 0.5, timeoutMs: 90_000 });
      const r = lerRespostaCaroline(JSON.parse(bruto.replace(/^```(json)?|```$/g, '').trim()), valoresProposta);
      if (r) return comApresentacao(r, ap);
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
  // Central de Leads acompanha: o agente falou com o lead (com proposta = Luiz Felipe retomando a proposta).
  const { avancarEtapaLead } = await import('@/lib/etapa-lead');
  await avancarEtapaLead(prisma, sdr.lead_id, sdr.proposta_id ? 'PROPOSTA_ENVIADA' : 'PRIMEIRO_CONTATO',
    sdr.proposta_id ? `${nomeDe(sdr)} está acompanhando a proposta enviada` : `${nomeDe(sdr)} fez o primeiro contato pelo WhatsApp`, nomeDe(sdr));
}

/** Vídeos, treinamento e suporte técnico são do setor de suporte: avisa que o agente é do comercial e manda o botão. */
async function encaminharSuporte(prisma: PrismaClient, token: string, sdr: any) {
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { contato_numero: true, dono_id: true } });
  if (!conv) return;
  const { LINK_CONTATO_GERAL } = await import('@/lib/triagem/fluxo');
  const texto = mensagemSuporte(nomeDe(sdr));
  const r = await evo.enviarMenu(token, conv.contato_numero, { modo: 'button', texto, opcoes: [{ id: LINK_CONTATO_GERAL, texto: '💬 Falar com o suporte' }] } as any);
  await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: `${texto}\n\n▫️ 💬 Falar com o suporte`, status: 'ENVIADA', enviada_por: agenteDe(sdr) } });
  await prisma.whatsappConversa.update({ where: { id: sdr.conversaId }, data: { ultima_mensagem: texto.slice(0, 200), ultima_em: new Date() } });
  emitirEventoConversa(conv.dono_id, 'conversa_atualizada', { conversaId: sdr.conversaId });
  registrarAcaoAgente(agenteDe(sdr), `encaminhou ${sdr.nome || 'um cliente'} para o suporte (vídeos/treinamento)`);
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
  // Passagem de bastão com contexto: o que o Julio sabe desse cliente vai para a Caroline.
  const dJ: any = sdr.dados || {};
  const sabido = [dJ.dor_principal && `dor: ${dJ.dor_principal}`, dJ.sistema_atual && `usa hoje ${dJ.sistema_atual}`, dJ.cidade && `cidade ${dJ.cidade}`, dJ.decisor && `decisor: ${dJ.decisor}`, dJ.momento && `momento: ${dJ.momento}`, sdr.nota != null && `termômetro ${sdr.nota}`].filter(Boolean).join('; ');
  import('./equipe.service').then(m => m.anotar(prisma, { de: 'julio', para: 'caroline', tipo: 'CONTEXTO', assunto: `Lead ${sdr.empresa || sdr.nome || ''}`.trim(), texto: `Carol, retomei ${sdr.nome || 'esse lead'}${sdr.empresa ? ` da ${sdr.empresa}` : ''} e ele mostrou interesse (${motivo}).${sabido ? ` O que já sei: ${sabido}.` : ''} É contigo.`, ref: sdr.conversaId })).catch(() => {});
  import('@/lib/assistente/conversas-agentes').then(m => m.registrarConversaAgentes('julio', 'caroline', `Lead ${sdr.empresa || sdr.nome || ''}`.trim(), [
    { quem: 'julio', texto: `Carol, ${sdr.nome || 'esse lead'}${sdr.empresa ? ` da ${sdr.empresa}` : ''} mostrou interesse. É contigo!` },
    { quem: 'caroline', texto: 'Oba! Deixa comigo: vou entender a dor e marcar a demonstração.' },
    { quem: 'julio', texto: `Anotei: ${String(motivo).slice(0, 80)}` },
  ])).catch(() => {});
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

// Lista do Informativo Prosystem (jornal): quem não tem mais interesse só recebe informativos e novidades do blog.
export const ETIQUETA_NEWS = 'Informativo Prosystem';
const ETIQUETA_NEWS_ANTIGA = 'News';

/** Etiqueta do sistema que marca quem só recebe informativos da Prosystem (público "News" das campanhas). */
export async function etiquetaNews(prisma: PrismaClient) {
  const ja = await prisma.etiqueta.findFirst({ where: { nome: ETIQUETA_NEWS, tipo: 'LEAD' } });
  if (ja) return ja;
  // Etiqueta antiga "News" vira "Informativo Prosystem" (mesma lista, nome novo).
  const antiga = await prisma.etiqueta.findFirst({ where: { nome: ETIQUETA_NEWS_ANTIGA, tipo: 'LEAD' } });
  if (antiga) return prisma.etiqueta.update({ where: { id: antiga.id }, data: { nome: ETIQUETA_NEWS, descricao: 'Informativo Prosystem: só recebe o jornal e as novidades do blog (sem interesse agora, porta aberta).' } });
  return prisma.etiqueta.create({ data: { nome: ETIQUETA_NEWS, cor: '#7c3aed', tipo: 'LEAD', sistema: true, descricao: 'Informativo Prosystem: só recebe o jornal e as novidades do blog (sem interesse agora, porta aberta).', created_by: 'sistema' } });
}

/** Negócio perdido com o motivo do cliente (lead no funil + proposta) e contato na lista News. */
export async function marcarPerdidoNews(prisma: PrismaClient, sdr: any, motivo: string, texto: string, agente: string) {
  const descricao = texto.trim().slice(0, 300);
  const motivoCompleto = descricao ? `${motivo}: ${descricao}` : motivo;
  // Proposta sem lead vinculado (Luiz Felipe): acha o lead pelo celular; se não houver, cria um já
  // perdido, para o contato ficar no funil com o motivo e entrar na lista News.
  if (!sdr.lead_id && sdr.proposta_id) {
    const u8 = ultimos8(sdr.numero || '');
    const achado = u8 ? await prisma.lead.findFirst({ where: { deleted_at: null, OR: [{ responsavel_telefone: { endsWith: u8 } }, { telefone: { endsWith: u8 } }] }, select: { id: true } }) : null;
    let leadId = achado?.id;
    if (!leadId) {
      const pr = await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { created_by: true, vendedor_id: true, razao_social: true, nome_fantasia: true, responsavel_nome: true, responsavel_email: true, segmento: true, cidade: true, estado: true, cnpj: true } });
      const nome = pr?.nome_fantasia || pr?.razao_social || sdr.empresa || sdr.nome || sdr.numero;
      const novo = await prisma.lead.create({ data: { nome, empresa: nome, razao_social: pr?.razao_social, nome_fantasia: pr?.nome_fantasia, cnpj: pr?.cnpj, responsavel_nome: pr?.responsavel_nome || sdr.nome, responsavel_email: pr?.responsavel_email, email: pr?.responsavel_email, responsavel_telefone: sdr.numero, telefone: sdr.numero, segmento: pr?.segmento, cidade: pr?.cidade, estado: pr?.estado, origem: 'PROPOSTA', temperatura: 'FRIO', created_by: pr?.vendedor_id || pr?.created_by || 'sistema' } as any, select: { id: true } });
      leadId = novo.id;
    }
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { lead_id: leadId } });
    sdr = { ...sdr, lead_id: leadId };
  }
  if (sdr.lead_id) {
    const lead = await prisma.lead.findUnique({ where: { id: sdr.lead_id } });
    if (lead && lead.status !== 'PERDIDO') {
      await prisma.lead.update({ where: { id: lead.id }, data: { etapa_funil: 'PERDIDO', etapa_comercial: 'PERDIDO', status: 'PERDIDO' as any, motivo_perda: motivoCompleto } });
      const { randomUUID } = await import('crypto');
      await prisma.$executeRawUnsafe(
        `INSERT INTO LeadPerda (id, lead_id, lead_nome, etapa_anterior, etapa_destino, motivo, motivo_outro, observacoes, valor_oportunidade, vendedor_id, vendedor_nome) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        randomUUID(), lead.id, lead.nome, lead.etapa_funil, 'PERDIDO', motivo, descricao || null, `Registrado por ${agente} pela conversa do WhatsApp.`, lead.valor_estimado || 0, lead.responsavel_id || null, agente,
      );
    }
    const et = await etiquetaNews(prisma);
    await prisma.leadEtiquetaAplicada.upsert({ where: { lead_id_etiqueta_id: { lead_id: sdr.lead_id, etiqueta_id: et.id } }, create: { lead_id: sdr.lead_id, etiqueta_id: et.id }, update: {} });
  }
  if (sdr.proposta_id) {
    const p = await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { id: true, status: true } });
    if (p && !['PERDIDA', 'ACEITA', 'CONTRATO_ASSINADO'].includes(p.status)) {
      await prisma.propostaComercial.update({ where: { id: p.id }, data: { status: 'PERDIDA' } });
      await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'STATUS', campo_alterado: 'status', valor_anterior: p.status, valor_novo: 'PERDIDA', motivo: motivoCompleto, observacao: 'Cliente informou pelo WhatsApp. Contato passou para o Informativo Prosystem.', feito_por_nome: agente } });
      if (sdr.lead_id) await prisma.leadObservacao.create({ data: { lead_id: sdr.lead_id, tipo: 'STATUS', descricao: `📄 Proposta RECUSADA pelo cliente (${motivoCompleto}). Contato passou para o Informativo Prosystem.`, created_by: 'bot', created_by_name: agente } }).catch(() => {});
    }
  }
  registrarAcaoAgente(agenteDe(sdr), `marcou ${sdr.nome || 'um lead'} como perdido (${motivo}) e passou para o Informativo Prosystem`);
}

// ── Recuperação de proposta recusada (Luiz Felipe entende o motivo; conversa natural, sem botões) ──
const DIAS_SEM_RESPOSTA_RECUPERACAO = 3;
export function recuperacaoAtiva(sdr: any): any | null {
  const r = (sdr?.dados as any)?.recuperacao;
  return r && !r.desfecho ? r : null;
}

/** Marca o início da recuperação: proposta RECUSADA (histórico) e o SdrLead aguardando a resposta do cliente. */
export async function iniciarRecuperacao(prisma: PrismaClient, sdr: any, o: { origem: 'conversa' | 'vendedora'; motivo: string | null; texto: string; perguntou: boolean; por: string }) {
  const agora = new Date();
  const dados: any = sdr.dados || {};
  await prisma.sdrLead.update({
    where: { id: sdr.id },
    data: {
      status: o.perguntou ? 'AGUARDANDO' : 'FILA', tentativas: o.perguntou ? 1 : 0, ...(o.perguntou ? { ultima_caroline_em: agora } : {}),
      dados: { ...dados, retomar_em: null, ciclo_em: null, recuperacao: { origem: o.origem, iniciada_em: agora.toISOString(), pergunta_feita_em: o.perguntou ? agora.toISOString() : null, motivo_informado: [o.motivo, o.texto].filter(Boolean).join(': ') || null, desfecho: null } },
    },
  });
  if (sdr.proposta_id) {
    const p = await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { id: true, status: true } });
    if (p && !['RECUSADA', 'PERDIDA', 'ACEITA', 'CONTRATO_ASSINADO'].includes(p.status)) {
      await prisma.propostaComercial.update({ where: { id: p.id }, data: { status: 'RECUSADA' } });
      await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'STATUS', campo_alterado: 'status', valor_anterior: p.status, valor_novo: 'RECUSADA', motivo: o.motivo || null, observacao: 'Cliente recusou pelo WhatsApp. Luiz Felipe está entendendo o motivo para tentar recuperar.', feito_por_nome: o.por } }).catch(() => {});
    }
  }
  registrarAcaoAgente('luiz_felipe', `${sdr.nome || 'um cliente'} recusou a proposta: entendendo o motivo`);
}

/**
 * Vendedora marcou a proposta como RECUSADA e pediu a recuperação: a conversa volta para o Luiz Felipe
 * (entrega explícita da vendedora), que manda a 1ª mensagem no próximo ciclo do horário comercial.
 * Devolve o motivo de não ter iniciado, ou null quando iniciou.
 */
export async function recuperarPelaVendedora(prisma: PrismaClient, propostaId: string, motivo: string, por: string): Promise<string | null> {
  const pr = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: { id: true, responsavel_nome: true, responsavel_telefone: true, nome_fantasia: true, razao_social: true, segmento: true, created_at: true } });
  if (!pr) return 'proposta não encontrada';
  const numero = numeroWhatsapp(pr.responsavel_telefone);
  if (!numero) return 'proposta sem celular do responsável';
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst) return 'WhatsApp da empresa não está conectado';
  const ja = await prisma.sdrLead.findFirst({ where: { proposta_id: pr.id }, orderBy: { created_at: 'desc' } });
  if ((ja?.dados as any)?.recuperacao) return 'esta proposta já passou por recuperação';
  const lead = await acharLead(prisma, numero);
  const conv = await conversaPara(prisma, inst.id, numero, { nome: pr.responsavel_nome, lead_id: lead?.id || null });
  if (conv.optout_campanhas) return 'o cliente pediu para não receber mensagens';
  // A vendedora entrega a conversa ao agente.
  await prisma.whatsappConversa.update({ where: { id: conv.id }, data: { dono_id: null, bot_ativo: false } }).catch(() => {});
  const sdr = ja
    ? await prisma.sdrLead.update({ where: { id: ja.id }, data: { agente: 'luiz_felipe', conversaId: conv.id } })
    : await prisma.sdrLead.create({ data: { agente: 'luiz_felipe', proposta_id: pr.id, lead_id: lead?.id || null, conversaId: conv.id, numero, nome: pr.responsavel_nome, empresa: (pr.nome_fantasia || pr.razao_social || '').trim() || null, segmento: pr.segmento, cadastro_em: pr.created_at, status: 'FILA', criado_por: 'luiz_felipe' } });
  await iniciarRecuperacao(prisma, sdr, { origem: 'vendedora', motivo, texto: '', perguntou: false, por });
  if (sdr.lead_id) await prisma.leadObservacao.create({ data: { lead_id: sdr.lead_id, tipo: 'STATUS', descricao: `📄 Proposta RECUSADA (${motivo}), marcada por ${por}. Luiz Felipe vai entender o motivo e tentar recuperar.`, created_by: 'bot', created_by_name: 'Luiz Felipe' } }).catch(() => {});
  return null;
}

async function voltouANegociar(prisma: PrismaClient, sdr: any) {
  if (!sdr.proposta_id) return;
  const p = await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { id: true, status: true } });
  if (p?.status !== 'RECUSADA') return;
  await prisma.propostaComercial.update({ where: { id: p.id }, data: { status: 'EM_NEGOCIACAO' } });
  await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'STATUS', campo_alterado: 'status', valor_anterior: 'RECUSADA', valor_novo: 'EM_NEGOCIACAO', observacao: 'Cliente voltou a negociar na conversa de recuperação com o Luiz Felipe.', feito_por_nome: 'Luiz Felipe' } }).catch(() => {});
  const atual = await prisma.sdrLead.findUnique({ where: { id: sdr.id }, select: { dados: true } });
  const d: any = atual?.dados || {};
  if (d.recuperacao) await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...d, recuperacao: { ...d.recuperacao, desfecho: 'recuperada', desfecho_em: new Date().toISOString() } } } });
  registrarAcaoAgente('luiz_felipe', `recuperou a conversa com ${sdr.nome || 'um cliente'}: proposta voltou para negociação`);
}

/** Sem resposta à pergunta em 3 dias: proposta PERDIDA e contato no Informativo, sem mandar mensagem. */
async function fecharRecuperacaoSemResposta(prisma: PrismaClient, s: any, agora: Date): Promise<boolean> {
  const rec = recuperacaoAtiva(s);
  const inicio = rec?.pergunta_feita_em || s.ultima_caroline_em;
  if (!inicio) return false;
  const desde = new Date(Math.max(new Date(inicio).getTime(), s.ultima_caroline_em ? new Date(s.ultima_caroline_em).getTime() : 0));
  if (s.ultima_lead_em && new Date(s.ultima_lead_em) > desde) return false; // o cliente respondeu: a conversa segue
  if (agora.getTime() - desde.getTime() < DIAS_SEM_RESPOSTA_RECUPERACAO * 864e5) return true; // esperando: nada de retomada
  await marcarPerdidoNews(prisma, s, 'OUTRO', `não informou o motivo da recusa (sem resposta em ${DIAS_SEM_RESPOSTA_RECUPERACAO} dias)`, 'Luiz Felipe').catch((e: any) => console.warn('[RECUPERACAO] fechar:', e?.message));
  await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'SEM_RESP', dados: { ...(s.dados || {}), recuperacao: { ...rec, desfecho: 'sem_resposta', desfecho_em: agora.toISOString() } } } });
  registrarAcaoAgente('luiz_felipe', `${s.nome || 'um cliente'} não respondeu em ${DIAS_SEM_RESPOSTA_RECUPERACAO} dias: proposta perdida, contato no Informativo`);
  return true;
}

// A decisão do agente (IA externa) vira comparação para a Laya: assunto e ramo da conversa.
async function aprenderLaya(prisma: PrismaClient, sdr: any, acao: string, nota?: number | null) {
  const intencao = acao === 'encaminhar_suporte' ? 'suporte' : ['oferecer_demo', 'passar_vendedora', 'recusou', 'aceitar_condicao', 'continuar', 'duvida_fora_material'].includes(acao) ? 'comprar' : null;
  const segmento = SEG_LAYA[sdr.segmento || ''] || (/padar|panif|confeit/i.test(sdr.segmento || '') ? 'padaria' : /manipula/i.test(sdr.segmento || '') ? 'manipulacao' : /farm|drog/i.test(sdr.segmento || '') ? 'farmacia' : undefined);
  // Nota de interesse do agente (0-100) → temperatura: até 34 Frio, 35-59 Morno, 60-79 Quente, 80+ Muito quente.
  const temperatura = typeof nota === 'number' && intencao === 'comprar' ? (nota >= 80 ? 'MUITO_QUENTE' : nota >= 60 ? 'QUENTE' : nota >= 35 ? 'MORNO' : 'FRIO') : undefined;
  if (!intencao && !segmento && !temperatura) return;
  const { aprenderComDecisao } = await import('./laya-cerebro.service');
  await aprenderComDecisao(prisma, sdr.conversaId, { ...(intencao ? { intencao } : {}), ...(segmento ? { segmento } : {}), ...(temperatura ? { temperatura } : {}) }, agenteDe(sdr)).catch(() => {});
}

async function aplicarAcao(prisma: PrismaClient, token: string, sdr: any, acaoIa: string, r: { nota: number; nota_motivo: string; duvida?: string | null; motivo_perda?: string | null }) {
  let acao = acaoIa;
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  const atual = await prisma.sdrLead.findUnique({ where: { id: sdr.id } });
  const dados: any = atual?.dados || {};
  const resumo = resumoLead(atual, dados, r);
  const obs = (descricao: string) => atual?.lead_id && prisma.leadObservacao.create({ data: { lead_id: atual.lead_id, tipo: 'SISTEMA', descricao, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {});
  // Contato disse que já usa o Prosystem: sai da lista (sem marcar perda, sem lista News/Instagram).
  {
    const ultimas = sdr.conversaId ? await prisma.whatsappMensagem.findMany({ where: { conversaId: sdr.conversaId }, orderBy: { created_at: 'desc' }, take: 4, select: { conteudo: true } }).catch(() => []) : [];
    const texto = [r.nota_motivo || '', ...ultimas.map(m => m.conteudo || '')].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (JA_CLIENTE.test(texto)) {
      await tirarDaListaJaCliente(prisma, atual || sdr, 'disse na conversa que já usa o Prosystem');
      await obs(`${resumo}\n\nJá é cliente Prosystem: retirado da lista de follow-up.`);
      return;
    }
  }
  const rec = recuperacaoAtiva(atual);
  if (acao === 'recusou' && (agenteDe(sdr) !== 'luiz_felipe' || !atual?.proposta_id || rec || dados.recuperacao)) acao = 'sem_interesse';
  if (acao === 'recusou') {
    // Primeira recusa: o Luiz Felipe já acolheu e perguntou o motivo. Nada de encerrar nem de botões.
    await iniciarRecuperacao(prisma, atual!, { origem: 'conversa', motivo: r.motivo_perda || null, texto: r.nota_motivo || '', perguntou: true, por: nomeDe(sdr) });
    await obs(`${resumo}\n\nCliente recusou a proposta pelo WhatsApp. ${nomeDe(sdr)} perguntou o motivo para tentar recuperar.`);
    return;
  }
  if (acao === 'oferecer_demo') {
    const { oferecerDemo } = await import('./assistente-demo.service');
    await oferecerDemo(prisma, token, sdr.conversaId, { aPartirDe: r.demo_a_partir || null }).catch((e: any) => console.warn('[CAROLINE] demo:', e?.message));
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
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'SEM_INTERESSE', resumo, ...(rec ? { dados: { ...dados, recuperacao: { ...rec, desfecho: 'perdida', desfecho_em: new Date().toISOString() } } } : {}) } });
    await obs(`${resumo}\n\nSem interesse no momento (encerrado com gentileza).`);
    registrarAcaoAgente(agenteDe(sdr), `encerrou: ${atual?.nome || 'lead'} sem interesse agora`);
    // Proposta recusada (Luiz Felipe) ou já fechou com outro sistema: negócio perdido com o motivo
    // que o cliente deu, e o contato passa para a lista News (só informativos) com o nosso Instagram.
    const motivo = r.motivo_perda || 'SEM_INTERESSE';
    if (atual && (atual.proposta_id || motivo === 'JA_TEM_FORNECEDOR')) {
      await marcarPerdidoNews(prisma, atual, motivo, r.nota_motivo || '', nomeDe(sdr)).catch((e: any) => console.warn('[CAROLINE] perda/news:', e?.message));
      await enviarMensagens(prisma, token, atual, [CONVITE_INSTAGRAM]).catch(() => {});
    } else if (atual?.lead_id) {
      // Sem interesse agora (ex.: "já resolvi"): só entra no Informativo Prosystem (jornal), sem virar perdido.
      const et = await etiquetaNews(prisma).catch(() => null);
      if (et) await prisma.leadEtiquetaAplicada.upsert({ where: { lead_id_etiqueta_id: { lead_id: atual.lead_id, etiqueta_id: et.id } }, create: { lead_id: atual.lead_id, etiqueta_id: et.id }, update: {} }).catch(() => {});
      await obs('📰 Sem interesse agora: passou para o Informativo Prosystem (recebe só o jornal e as novidades do blog).');
    }
  } else if (acao === 'aceitar_condicao') {
    // Cliente topou a condição autorizada: proposta atualizada e reenviada com os botões de aceite.
    const { aplicarCondicaoNaProposta } = await import('./assistente-negociacao.service');
    const ok = await aplicarCondicaoNaProposta(prisma, atual || sdr, nomeDe(sdr)).catch((e: any) => { console.warn('[CAROLINE] condição:', e?.message); return false; });
    await obs(`${resumo}\n\n${ok ? 'Cliente aceitou a condição da campanha: proposta atualizada e reenviada com os botões de aceite.' : 'Cliente quer a condição, mas não deu para atualizar a proposta sozinho.'}`);
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🔥 *${atual?.nome || 'Cliente'} topou a condição da campanha* (${nomeDe(sdr)})\n${ok ? 'Proposta atualizada e reenviada com os botões de aceite.' : '⚠️ Não consegui atualizar a proposta: finalize manualmente.'}`);
    registrarAcaoAgente(agenteDe(sdr), `mandou a proposta com a condição da campanha para ${atual?.nome || 'um cliente'}`);
  } else if (acao === 'encaminhar_suporte') {
    // O texto do suporte sai no máximo uma vez a cada 7 dias na conversa; repetir irrita o cliente. Na repetição, avisa a gestão.
    const jaMandou = await prisma.whatsappMensagem.findFirst({ where: { conversaId: sdr.conversaId, direcao: 'SAIDA', conteudo: { contains: 'setor de suporte' }, created_at: { gte: new Date(Date.now() - 7 * 864e5) } }, select: { id: true } });
    if (jaMandou) {
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
      await enviarAvisoGestao(prisma, 'lead_qualificado', `💬 *${atual?.nome || 'Cliente'}* escreveu de novo na conversa do ${nomeDe(sdr)} e o assunto não é comercial (o botão do suporte já tinha sido enviado). O agente saiu da conversa: dê uma olhada.`).catch(() => {});
      return;
    }
    await encaminharSuporte(prisma, token, atual || sdr).catch((e: any) => console.warn('[CAROLINE] suporte:', e?.message));
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'CONVERSANDO' } });
  } else if (acao === 'duvida_fora_material') {
    await enviarAvisoGestao(prisma, 'lead_qualificado', `❓ *Dúvida que ${nomeDe(sdr)} não sabe responder*\n${atual?.nome || ''}${atual?.empresa ? ` · ${atual.empresa}` : ''}: "${r.duvida || 'ver conversa'}"\nResponda na conversa do WhatsApp (ao responder, você assume e ela sai).`);
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'CONVERSANDO' } });
    // O Rafael não sabia: vai atrás da resposta (pesquisa e escreve para a Jessica aprovar; aprovada, vale para todos).
    // A dúvida sobe para o Rafael (o chefe) no mural da equipe; a resposta dele vale para todos.
    if (r.duvida) await import('./equipe.service').then(m => m.anotar(prisma, { de: agenteDe(sdr), para: 'rafael', tipo: 'DUVIDA', assunto: `Dúvida de ${atual?.nome || sdr.nome || 'cliente'}${atual?.empresa ? ` (${atual.empresa})` : ''}`, texto: r.duvida!, ref: sdr.conversaId })).catch(() => {});
    if (r.duvida) import('./especialista.service').then(m => m.pesquisarDuvida(prisma, r.duvida!, nomeDe(sdr))).catch((e: any) => console.warn('[RAFAEL] dúvida:', e?.message));
  }
}

/**
 * Gera a próxima fala da Caroline e envia (ou deixa para aprovação).
 * Nunca lança; na dúvida não envia.
 */
async function falar(prisma: PrismaClient, token: string, sdrId: string, fase: FaseCaroline, dicaExtra = ''): Promise<'enviado' | 'aprovacao' | 'nada' | 'falha'> {
  const sdr = await prisma.sdrLead.findUnique({ where: { id: sdrId } });
  if (!sdr || !sdr.conversaId || !ATIVOS.includes(sdr.status)) return 'nada';
  // Contato marcado como equipe/parceiro/fornecedor/outro: nenhum agente escreve.
  if (await contatoSemAgentes(prisma, sdr.numero)) {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO', dados: { ...((sdr.dados as any) || {}), bloqueado_etiqueta: true } } });
    registrarAcaoAgente(agenteDe(sdr), `parou de falar com ${sdr.nome || 'um contato'}: está marcado como não lead/cliente`);
    return 'nada';
  }
  if (await pessoaAssumiu(prisma, sdr)) {
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
    registrarAcaoAgente(agenteDe(sdr), `saiu da conversa de ${sdr.nome || 'um lead'}: uma pessoa assumiu`);
    return 'nada';
  }
  if (await prisma.sdrMensagem.findFirst({ where: { sdrId, status: 'PENDENTE' }, select: { id: true } })) return 'aprovacao';
  // Últimas mensagens do agente: base da trava contra repetição e do "só confirmou".
  const ultimasDoAgente = await prisma.whatsappMensagem.findMany({ where: { conversaId: sdr.conversaId, direcao: 'SAIDA', enviada_por: agenteDe(sdr) }, orderBy: { created_at: 'desc' }, take: 4, select: { conteudo: true, created_at: true } });
  // Cliente só confirmou/agradeceu ("👍", "ok", "obrigado") depois da fala do agente: não responde.
  // A conversa fica em espera (retomada leve em 7 dias, ou na data que o cliente combinou).
  let dicaDecisor = '';
  if (fase === 'resposta') {
    const desdeAgente = ultimasDoAgente[0]?.created_at || sdr.desde;
    const novas = await prisma.whatsappMensagem.findMany({ where: { conversaId: sdr.conversaId, direcao: 'ENTRADA', created_at: { gt: desdeAgente } }, select: { conteudo: true, tipo: true } });
    if (novas.length && novas.every(m => m.tipo === 'TEXTO' && ehRespostaAutomatica(m.conteudo))) {
      // Atitude: só respondeu o robô da loja. Uma vez por conversa, escreve para o atendente pedindo o decisor.
      const dA: any = sdr.dados || {};
      if (dA.pediu_decisor_em) {
        registrarAcaoAgente(agenteDe(sdr), `recebeu a mensagem automática da loja de ${sdr.nome || 'um lead'}: já pediu o decisor, espera a pessoa`);
        return 'nada';
      }
      dicaDecisor = 'A loja respondeu só com MENSAGEM AUTOMÁTICA (robô de atendimento). Não agradeça nem converse com o robô. Escreva UMA mensagem curta para o ATENDENTE que vai ler: diga quem você é e o motivo em uma frase (sistema de gestão da farmácia/padaria, sem vender), e peça com educação o nome e o WhatsApp do dono ou do gerente que cuida da parte de sistema, ou o melhor horário para falar com ele. Use acao "continuar".';
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...dA, pediu_decisor_em: new Date().toISOString() } } });
      registrarAcaoAgente(agenteDe(sdr), `só a mensagem automática de ${sdr.nome || 'um lead'} respondeu: pediu o contato do decisor ao atendente`);
    }
    if (ultimasDoAgente.length && novas.length && novas.every(m => m.tipo === 'TEXTO' && ehSoConfirmacao(m.conteudo))) {
      const d: any = sdr.dados || {};
      const retomar = d.retomar_em && new Date(d.retomar_em) > new Date() ? d.retomar_em : new Date(`${new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T09:30:00-03:00`).toISOString();
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'AGUARDANDO', tentativas: 1, ultima_caroline_em: new Date(), dados: { ...d, retomar_em: retomar, combinado: d.combinado || null } } });
      registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'o lead'} só confirmou: sem resposta, volta a falar em ${new Date(retomar).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      return 'nada';
    }
  }
  // Trava contra saturação: retomada não sai se o agente já escreveu nas últimas 20 h e o cliente não respondeu.
  if (fase !== 'resposta' && ultimasDoAgente[0] && Date.now() - ultimasDoAgente[0].created_at.getTime() < 20 * 3600_000
      && !(sdr.ultima_lead_em && sdr.ultima_lead_em > ultimasDoAgente[0].created_at)) {
    const dT: any = sdr.dados || {};
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'AGUARDANDO', dados: { ...dT, retomar_em: emDiasUteis(dT.adiou_em ? DIAS_RETOMADA_ADIOU : 1).toISOString() } } });
    registrarAcaoAgente(agenteDe(sdr), `segurou uma retomada para ${sdr.nome || 'um lead'}: já tinha escrito há pouco, sem resposta`);
    return 'nada';
  }
  // Já é cliente da Prosystem (pelo telefone): sai da lista de prospecção/follow-up, sem nova mensagem.
  if (fase !== 'resposta' && await ehClienteAtivo(prisma, sdr.numero)) {
    await tirarDaListaJaCliente(prisma, sdr, 'telefone cadastrado como cliente');
    return 'nada';
  }
  // Quem já é cliente (cadastro ativo ou proposta aceita) é atendido por pessoas: o agente não responde,
  // sai da conversa e avisa a gestão com o que o cliente disse.
  if (fase === 'resposta') {
    const pr = sdr.proposta_id ? await prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: { status: true } }).catch(() => null) : null;
    const virouCliente = !!pr && ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'].includes(pr.status);
    if (virouCliente || await ehClienteAtivo(prisma, sdr.numero)) {
      const ult = await prisma.whatsappMensagem.findFirst({ where: { conversaId: sdr.conversaId, direcao: 'ENTRADA' }, orderBy: { created_at: 'desc' }, select: { conteudo: true, transcricao: true } });
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      await enviarAvisoGestao(prisma, 'lead_qualificado', `💬 *${sdr.nome || 'Cliente'}* (já é cliente) escreveu na conversa do ${nomeDe(sdr)}:\n"${((ult?.transcricao || ult?.conteudo) || '').slice(0, 300)}"\nO agente não respondeu e saiu da conversa: o atendimento é seu.`).catch(() => {});
      registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'um cliente'} já é cliente: passou a conversa para a equipe`);
      return 'nada';
    }
  }
  if (fase === 'resposta') dicaDecisor = [dicaDecisor, await contextoDoCliente(prisma, sdr.numero)].filter(Boolean).join('\n');
  let r = await gerarResposta(prisma, sdr, fase, [dicaDecisor, dicaExtra].filter(Boolean).join('\n'));
  // Trava: cliente falando de implantação/treinamento/combinados com a equipe → é com uma pessoa: o agente sai, sem mensagem.
  if (r && fase === 'resposta') {
    const ultM = await prisma.whatsappMensagem.findFirst({ where: { conversaId: sdr.conversaId, direcao: 'ENTRADA' }, orderBy: { created_at: 'desc' }, select: { conteudo: true, transcricao: true } });
    const txt = ((ultM?.transcricao || ultM?.conteudo) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/(treinament|implanta|videochamada|video chamada|ensinar|ensinando|orientar as|orientando|virada do sistema|agendar com voce|passar pra elas|passar para elas)/.test(txt)) {
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'HUMANO' } });
      const { enviarAvisoGestao } = await import('./assistente-gestao.service');
      await enviarAvisoGestao(prisma, 'lead_qualificado', `💬 *${sdr.nome || 'Cliente'}* falou de implantação/treinamento na conversa do ${nomeDe(sdr)}:\n"${((ultM?.transcricao || ultM?.conteudo) || '').slice(0, 300)}"\nO agente não respondeu e saiu da conversa: o atendimento é seu.`).catch(() => {});
      registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'um cliente'} falou de implantação/treinamento: passou para a equipe`);
      return 'nada';
    }
  }
  // Trava: cliente falando de serviço contratado, valor ou alguém da equipe não vai para o suporte.
  if (r && r.acao === 'encaminhar_suporte' && fase === 'resposta') {
    const ult = (await prisma.whatsappMensagem.findFirst({ where: { conversaId: sdr.conversaId, direcao: 'ENTRADA' }, orderBy: { created_at: 'desc' }, select: { conteudo: true } }))?.conteudo || '';
    if (ASSUNTO_COMERCIAL.test(ult.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())) {
      r = { ...r, acao: 'duvida_fora_material', duvida: ult.slice(0, 300), mensagens: r.mensagens.length ? r.mensagens : ['Entendi! Isso é com a nossa equipe comercial: vou verificar agora com a responsável pelo seu serviço e já te retorno por aqui.'] };
    }
  }
  if (!r) { console.warn(`[CAROLINE] sem resposta utilizável para ${sdr.numero}`); return 'falha'; }
  // Trava contra repetição: mensagem muito parecida com uma das últimas do agente não sai.
  const parecida = (x: RespostaCaroline) => x.mensagens.some(m => ultimasDoAgente.some(u => semelhanca(m, u.conteudo || '') >= 0.6));
  if (parecida(r) && r.acao === 'continuar') {
    // 1) Nova tentativa, com outra abordagem.
    const nova = await gerarResposta(prisma, sdr, fase, 'Sua resposta anterior repetia o que você já tinha dito. Responda ao que o cliente acabou de escrever, de forma natural e curta (ex.: se ele só cumprimentou, cumprimente de volta e retome com leveza, sem repetir a pergunta anterior palavra por palavra). Nunca repita frases suas.');
    if (nova && !parecida(nova)) r = nova;
    else {
      // 2) Pede orientação ao Rafael (especialista), que lê a conversa e diz a próxima mensagem.
      const { orientarAgente } = await import('./especialista.service');
      const o = await orientarAgente(prisma, agenteDe(sdr), sdr.conversaId).catch(() => null);
      if (o?.mensagem) {
        const guiada = await gerarResposta(prisma, sdr, fase, `Orientação do Rafael (especialista): ${o.orientacao}\nMensagem sugerida por ele (adapte ao seu jeito, sem repetir frases suas): "${o.mensagem}"`);
        if (guiada && !parecida(guiada)) r = guiada;
      }
    }
  }
  const repetida = parecida(r);
  if (repetida && r.acao === 'continuar') {
    console.warn(`[CAROLINE] mensagem repetida bloqueada para ${sdr.numero}`);
    registrarAcaoAgente(agenteDe(sdr), `ia repetir a mesma mensagem para ${sdr.nome || 'um lead'}: bloqueada`);
    const d: any = sdr.dados || {};
    const amanha = new Date(`${new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T09:30:00-03:00`);
    await prisma.sdrLead.update({ where: { id: sdr.id }, data: { status: 'AGUARDANDO', ultima_caroline_em: new Date(), dados: { ...d, retomar_em: d.retomar_em && new Date(d.retomar_em) > amanha ? d.retomar_em : amanha.toISOString() } } });
    return 'nada';
  }
  await atualizarTermometro(prisma, sdr, r);
  const cfg = await obterConfigAgente(prisma, agenteDe(sdr));
  const agora = new Date();
  // Retomada de quem ainda não respondeu: vai com botões (e imagem na última tentativa).
  const chamariz = fase !== 'resposta' && (fase === 'retomada' || fase === 'encerramento' || sdr.abertura_enviada) && !sdr.ultima_lead_em;
  const ultima = sdr.tentativas + 1 >= TENTATIVAS_MAX;
  const base = {
    ultima_caroline_em: agora,
    ...(fase === 'resposta' ? { status: 'CONVERSANDO' } : { status: 'AGUARDANDO', tentativas: { increment: 1 } as any }),
    ...(fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {}),
  };
  // Fora do horário comercial a conversa não para: respostas a quem está conversando saem sem aprovação
  // (a Jessica confere depois na agenda). Primeiro contato e retomada continuam passando por ela.
  // Aprovação só de segunda a sexta, 8h–18h; sábado e domingo ela responde direto.
  const sabado = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(agora) === 'Sat';
  // Resposta a quem escreveu sai SEMPRE na hora (prioridade: até 1 minuto). Aprovação só no que o agente
  // puxa sozinho (primeiro contato e retomadas), e nas retomadas de quem já conversou fora do comercial.
  void sabado;
  const semAprovacao = fase === 'resposta' || (fase === 'retomada' && !!sdr.ultima_lead_em && (!horarioComercial(agora) || sabado));
  // Oferta de campanha / revisão de proposta: sempre passa pela autorização da Jessica, com aviso no WhatsApp dela.
  const pedeAutorizacao = !!r.revisar_proposta && janelaCampanhaAtiva(agora);
  if (r.revisar_proposta && !pedeAutorizacao) return 'falha'; // fora da janela (dias 20 ao fim do mês) nunca sai
  if ((cfg.aprovar && !semAprovacao) || pedeAutorizacao) {
    const pendente = await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), acao: JSON.stringify({ acao: r.acao, nota: r.nota, nota_motivo: r.nota_motivo, duvida: r.duvida, motivo_perda: r.motivo_perda, negociacao: pedeAutorizacao, fase, chamariz, ultima }) } });
    await prisma.sdrLead.update({ where: { id: sdrId }, data: fase === 'abertura' && !sdr.primeiro_envio_em ? { primeiro_envio_em: agora } : {} });
    // Campanha/revisão: a gestão recebe no WhatsApp a prévia da proposta + a mensagem, e responde nos botões.
    if (pedeAutorizacao) {
      const { pedirAutorizacaoNegociacao } = await import('./assistente-negociacao.service');
      await pedirAutorizacaoNegociacao(prisma, sdr, { id: pendente.id, texto: pendente.texto }, nomeDe(sdr)).catch((e: any) => console.warn('[CAROLINE] autorização:', e?.message));
    }
    registrarAcaoAgente(agenteDe(sdr), `escreveu para ${sdr.nome || 'um lead'}: esperando sua aprovação`);
    emitirEventoConversa(null, 'conversa_atualizada', { conversaId: sdr.conversaId });
    return 'aprovacao';
  }
  if (r.mensagens.length) await enviarMensagens(prisma, token, sdr, r.mensagens);
  if (chamariz && r.acao === 'continuar' && !recuperacaoAtiva(sdr)) await enviarChamariz(prisma, token, sdr, ultima);
  await prisma.sdrMensagem.create({ data: { sdrId, conversaId: sdr.conversaId, texto: r.mensagens.join('\n\n'), status: 'ENVIADA_AUTO', acao: r.acao, decidido_em: agora } });
  await prisma.sdrLead.update({ where: { id: sdrId }, data: base });
  // Cliente adiou ("estou viajando", "quando voltar eu chamo"): o agente confirmou uma vez e agora espera a data.
  // Cliente adiou (viagem, "quando voltar eu chamo"...): o agente pergunta UMA vez quando; sem data, volta em 5 dias.
  {
    const d0: any = (await prisma.sdrLead.findUnique({ where: { id: sdrId }, select: { dados: true } }))?.dados || {};
    if (d0.adiou_em && agora.getTime() - new Date(d0.adiou_em).getTime() < 3 * 864e5 && r.acao === 'continuar' && !r.retomar_em && !r.adiar_dias) r.adiar_dias = DIAS_RETOMADA_ADIOU;
  }
  // Rede de segurança: o agente prometeu um horário na mensagem e não registrou → registra.
  if (!r.retomar_em && r.acao === 'continuar') {
    const h = r.mensagens.map(m => compromissoDeHorario(m, agora)).find(Boolean) || null;
    if (h) r.retomar_em = h;
  }
  // Retorno combinado: dia e hora exatos (retomar_em) têm prioridade sobre "daqui a N dias".
  if ((r.retomar_em || r.adiar_dias) && r.acao === 'continuar') {
    const quando = r.retomar_em || new Date(`${new Date(agora.getTime() + r.adiar_dias! * 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T09:30:00-03:00`);
    const quandoTxt = quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', ...(r.retomar_em ? { hour: '2-digit', minute: '2-digit' } : {}) });
    const d: any = (await prisma.sdrLead.findUnique({ where: { id: sdrId }, select: { dados: true } }))?.dados || {};
    await prisma.sdrLead.update({ where: { id: sdrId }, data: { status: 'AGUARDANDO', tentativas: 1, dados: { ...d, retomar_em: quando.toISOString(), combinado: r.retomar_em ? `combinado com ele: ${quandoTxt}` : `quando ele pediu (${quandoTxt})` } } });
    if (sdr.lead_id) await prisma.leadObservacao.create({ data: { lead_id: sdr.lead_id, tipo: 'SISTEMA', descricao: `⏸ Cliente pediu para retomar depois. ${nomeDe(sdr)} volta a falar ${quandoTxt}${r.retomar_em ? ' (combinado com o cliente)' : ''}, sem mensagens até lá.`, created_by: 'bot', created_by_name: nomeDe(sdr) } }).catch(() => {});
    registrarAcaoAgente(agenteDe(sdr), `${sdr.nome || 'o lead'} combinou retorno: ${quandoTxt}`);
  }
  registrarAcaoAgente(agenteDe(sdr), `${fase === 'resposta' ? 'respondeu' : 'chamou'} ${sdr.nome || 'um lead'} (nota ${r.nota})`);
  if (r.novo_contato) await registrarDecisorIndicado(prisma, sdr, r.novo_contato).catch(e => console.error('[agente] decisor indicado:', e?.message || e));
  // Experiência para a equipe: o que levou à demonstração e por que perdemos (todos aprendem com o caso real).
  if (r.acao === 'oferecer_demo' || r.acao === 'sem_interesse') {
    const quem = `${sdr.empresa || sdr.nome || 'cliente'}${sdr.segmento ? ` (${sdr.segmento})` : ''}`;
    const { anotar } = await import('./equipe.service');
    await anotar(prisma, r.acao === 'oferecer_demo'
      ? { de: agenteDe(sdr), para: 'equipe', tipo: 'EXPERIENCIA', assunto: `Levou à demonstração: ${quem}`, texto: `${r.dor_principal ? `Dor: ${r.dor_principal}. ` : ''}O que eu escrevi: "${r.mensagens.join(' ').slice(0, 400)}"`, ref: sdr.conversaId }
      : { de: agenteDe(sdr), para: 'equipe', tipo: 'EXPERIENCIA', assunto: `Perdemos: ${quem}`, texto: `Motivo: ${r.motivo_perda || 'sem interesse'}. ${r.nota_motivo ? `O que ele disse: ${r.nota_motivo}` : ''}`.trim(), ref: sdr.conversaId });
  }
  if (r.acao !== 'continuar') await aplicarAcao(prisma, token, sdr, r.acao, r);
  if (fase === 'resposta') void aprenderLaya(prisma, sdr, r.acao, r.nota);
  if (recuperacaoAtiva(sdr) && (r.revisar_proposta || r.retomar_em || r.adiar_dias || r.acao === 'duvida_fora_material')) await voltouANegociar(prisma, sdr);
  // Julio: com interesse (nota 35+, demo ou vendedora), a conversa segue com a Caroline.
  if (r.nota >= 35 || ['oferecer_demo', 'passar_vendedora'].includes(r.acao)) await passarParaCaroline(prisma, sdr, `interesse na conversa (nota ${r.nota})`);
  return 'enviado';
}

/** Faz o agente responder agora uma conversa que está esperando (ex.: recuperação manual). */
export async function responderAgora(prisma: PrismaClient, sdrId: string, fase: FaseCaroline = 'resposta') {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('O WhatsApp da empresa não está conectado.');
  return falar(prisma, inst.instance_token, sdrId, fase);
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
  if (meta.chamariz && (!meta.acao || meta.acao === 'continuar') && !recuperacaoAtiva(sdr)) await enviarChamariz(prisma, inst.instance_token, sdr, !!meta.ultima);
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
const ESPERA_MS = 20_000; // junta mensagens seguidas antes de responder (resposta em até ~1 min)

/** Chamado pelo webhook do WhatsApp da empresa. true = a conversa é da Caroline (os outros robôs ficam quietos). */
export async function aoReceberDoLead(prisma: PrismaClient, token: string, conversaId: string, tipo: string, texto: string, mensagemId: string, botaoId?: string | null): Promise<boolean> {
  const convB = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_numero: true } });
  if (convB && await contatoSemAgentes(prisma, convB.contato_numero)) return false;
  let sdr = await prisma.sdrLead.findFirst({ where: { conversaId, status: { in: ATIVOS } }, orderBy: { created_at: 'desc' } });
  if (!sdr) {
    // Saiu por uma mensagem mandada do celular, mas ninguém assumiu no CRM: o cliente não pode ficar sem resposta.
    // Sem dono, sem finalizar e sem pessoa conversando agora → o agente volta para a conversa.
    const orfao = await prisma.sdrLead.findFirst({ where: { conversaId, status: 'HUMANO' }, orderBy: { created_at: 'desc' } });
    const conv = orfao ? await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { dono_id: true, finalizada_em: true } }) : null;
    if (!orfao || !conv || conv.dono_id || conv.finalizada_em || await pessoaAssumiu(prisma, orfao)) return false;
    sdr = await prisma.sdrLead.update({ where: { id: orfao.id }, data: { status: 'CONVERSANDO' } });
    registrarAcaoAgente(agenteDe(sdr), `voltou para a conversa de ${sdr.nome || 'um lead'}: ninguém tinha assumido`);
  }
  const adiou = tipo === 'TEXTO' && ehAdiamento(texto);
  await prisma.sdrLead.update({ where: { id: sdr.id }, data: { ultima_lead_em: new Date(), ...(sdr.status !== 'FILA' ? { status: 'CONVERSANDO' } : {}), ...(adiou ? { dados: { ...((sdr.dados as any) || {}), adiou_em: new Date().toISOString() } } : {}) } });
  // O lead respondeu: está em atendimento (só avança; quem já está em proposta/negociação fica onde está).
  { const { avancarEtapaLead } = await import('@/lib/etapa-lead'); await avancarEtapaLead(prisma, sdr.lead_id, 'EM_ATENDIMENTO', `respondeu ao ${nomeDe(sdr)} no WhatsApp`, nomeDe(sdr)); }

  // Tocar em "Me chama depois"/"Quero saber mais" já é sinal de interesse: registra no termômetro.
  if (botaoId === 'sdr_depois' || botaoId === 'sdr_quero') {
    await registrarInteresse(prisma, sdr, botaoId === 'sdr_quero' ? 45 : 35,
      botaoId === 'sdr_quero' ? 'Tocou em "Quero saber mais" (interesse declarado)' : 'Pediu para ser chamado depois, não encerrou (interesse inicial)');
  }

  // "Me chama depois": combina o próximo dia útil, de manhã ou à tarde (resposta direta, sem IA).
  const nomeChamar = agenteDe(sdr) === 'caroline' ? sdr.nome : await nomeParaChamar(prisma, sdr.numero, sdr.nome);
  const primeiro = (nomeChamar || '').trim().split(/\s+/)[0];
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
    void (async () => {
      // Cérebro: a Laya decide a rota antes da IA externa (só com nível Assistente em intenção).
      const { rotaDaLaya, layaEvitouIa } = await import('./laya-cerebro.service');
      const rota = await rotaDaLaya(prisma, conversaId).catch(() => null);
      if (rota === 'suporte') { await encaminharSuporte(prisma, token, sdr); layaEvitouIa(nomeDe(sdr), 'assunto de suporte'); return; }
      if (rota === 'financeiro') {
        await enviarMensagens(prisma, token, sdr, ['Esse assunto é com o nosso financeiro. Já avisei a equipe e eles te respondem por aqui. 😊']).catch(() => {});
        await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { etiqueta: 'Financeiro', etiqueta_cor: '#0891b2' } }).catch(() => {});
        const { enviarAvisoGestao } = await import('./assistente-gestao.service');
        await enviarAvisoGestao(prisma, 'lead_qualificado', `💳 *Assunto financeiro* na conversa do ${nomeDe(sdr)} com ${sdr.nome || sdr.numero}. A Laya identificou e avisou o cliente que a equipe responde.`).catch(() => {});
        layaEvitouIa(nomeDe(sdr), 'assunto financeiro'); return;
      }
      await falar(prisma, token, sdr.id, 'resposta');
    })().catch((e: any) => console.warn('[CAROLINE] resposta:', e?.message));
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
  await prisma.sdrLead.update({ where: { id: s.id }, data: { agente: 'julio', status: 'AGUARDANDO', dados: { ...d, ciclos: ciclos + 1, ciclo_em: volta.toISOString(), encerramento_em: null } } });
  if (s.lead_id) await prisma.leadObservacao.create({ data: { lead_id: s.lead_id, tipo: 'SISTEMA', descricao: `🤖 Sem resposta nas 3 tentativas. O Julio volta a chamar em ${volta.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (ciclo ${ciclos + 1} de ${CICLOS_MAX}).`, created_by: 'bot', created_by_name: 'Julio' } }).catch(() => {});
  registrarAcaoAgente('julio', `vai voltar a chamar ${s.nome || 'um lead'} em ${volta.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
}

// ── Rodada (a cada 2 min) ────────────────────────────────────────────────────

let proximoPrimeiroContato = 0;
const falhouEm = new Map<string, number>();
const falhasSeguidas: Record<string, number> = {};

// Conversa já existente no WhatsApp da empresa (mesmo número com/sem 9) ou uma nova, ligada ao lead.
// Nome para chamar o cliente. O cadastro (proposta/lead) às vezes traz o sócio da Receita e não
// quem conversa com a gente (ex.: proposta em nome do "Marco", mas quem fala é a Carina).
// Lê as mensagens da equipe (pessoas, não agentes) com esse número: se chamamos a pessoa por outro
// nome, usa esse; se já houve conversa e o nome do cadastro nunca apareceu, não usa nome.
const SAUDACAO_COM_NOME = /\b(?:ol[aá]|oi|bom dia|boa tarde|boa noite)[\s,!]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})/g;
const NAO_E_NOME = new Set(['tudo', 'pessoal', 'equipe', 'senhor', 'senhora', 'amigo', 'amiga', 'querido', 'querida', 'prosystem', 'aqui', 'como']);
export async function nomeParaChamar(prisma: PrismaClient, numero: string, nomeCadastro: string | null): Promise<string | null> {
  const fim = ultimos8(numero);
  const msgs = await prisma.whatsappMensagem.findMany({
    where: { conversa: { contato_numero: { endsWith: fim } } }, orderBy: { created_at: 'desc' }, take: 300,
    select: { direcao: true, enviada_por: true, conteudo: true },
  }).catch(() => []);
  if (!msgs.length) return nomeCadastro;
  const contagem = new Map<string, number>();
  for (const m of msgs) {
    if (m.direcao !== 'SAIDA' || AGENTES_SDR.includes(m.enviada_por as any) || ['bot', 'assistente_ia', 'cadencia_automatica', 'campanha'].includes(m.enviada_por || '')) continue;
    for (const r of (m.conteudo || '').matchAll(SAUDACAO_COM_NOME)) {
      const n = r[1];
      if (!NAO_E_NOME.has(n.toLowerCase())) contagem.set(n, (contagem.get(n) || 0) + 1);
    }
  }
  const primeiro = (nomeCadastro || '').trim().split(/\s+/)[0];
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const usado = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (usado && (!primeiro || norm(usado) !== norm(primeiro))) return usado;
  if (!primeiro) return null;
  const apareceu = msgs.some(m => norm(m.conteudo || '').includes(norm(primeiro)) && !AGENTES_SDR.includes(m.enviada_por as any));
  if (apareceu) return nomeCadastro;
  // Sem confirmação no histórico: confere o nome do perfil do WhatsApp da pessoa.
  const perfil = await nomeDoPerfil(prisma, fim);
  if (perfil === undefined) return msgs.length < 3 ? nomeCadastro : null; // API não respondeu: regra do histórico
  if (!perfil) return null;                                                // perfil sem nome de pessoa (ex.: nome de loja)
  return norm(perfil) === norm(primeiro) ? nomeCadastro : perfil;
}

const NAO_E_PESSOA = /^(farm|drog|padar|panif|confeit|loja|mercad|supermerc|minimerc|distrib|comercial|empresa|atacad|varej|posto)|^(ltda|me|eireli)$/i;
/** Primeiro nome do perfil do WhatsApp (undefined = não deu para consultar; null = não parece nome de pessoa). */
async function nomeDoPerfil(prisma: PrismaClient, fim8: string): Promise<string | null | undefined> {
  const conv = await prisma.whatsappConversa.findFirst({ where: { contato_numero: { endsWith: fim8 } }, select: { contato_numero: true, instancia: { select: { instance_token: true } } } }).catch(() => null);
  if (!conv?.instancia?.instance_token) return undefined;
  const bruto = await evo.nomeDoContato(conv.instancia.instance_token, conv.contato_numero).catch(() => undefined);
  if (bruto === undefined) return undefined;
  const primeiro = (bruto || '').replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/)[0] || '';
  if (primeiro.length < 3 || NAO_E_PESSOA.test(primeiro)) return null;
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

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
    // Prioridade: os leads parados em "Leads para Distribuir" (qualificados, sem vendedora) vêm primeiro;
    // depois os demais, do mais novo para o mais antigo. O limite diário do número continua valendo.
    const selecao = { id: true, nome: true, nome_fantasia: true, empresa: true, responsavel_nome: true, responsavel_telefone: true, telefone: true, segmento: true, created_at: true } as const;
    const baseWhere = { deleted_at: null, etapa_comercial: { notIn: FECHADAS_LEAD }, status: { notIn: ['GANHO', 'PERDIDO'] } } as any;
    // Mesma regra da tela "Leads para Distribuir": qualificado e sem vendedora (ou ainda com a própria SDR que cadastrou).
    const aDistribuir = (await prisma.lead.findMany({ where: { ...baseWhere, etapa_sdr: 'QUALIFICADO' }, select: { ...selecao, responsavel_id: true, created_by: true }, orderBy: { created_at: 'desc' }, take: 300 }).catch(() => []))
      .filter(l => !l.responsavel_id || l.responsavel_id === l.created_by);
    const demais = await prisma.lead.findMany({ where: baseWhere, select: selecao, orderBy: { created_at: 'desc' }, take: 300 });
    const vistos = new Set(aDistribuir.map(l => l.id));
    const ls = [...aDistribuir, ...demais.filter(l => !vistos.has(l.id))];
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

/**
 * Conversa assumida por uma pessoa (pedido da Jessica, 01/10/2026): se a última mensagem foi nossa e o cliente
 * sumiu, o agente retoma com base na conversa. 1ª retomada após 1 dia útil sem resposta; 2ª após mais 3 dias
 * úteis; depois para. A conversa continua sendo de quem assumiu: se o cliente responder, o agente não responde.
 * Não vale para quem já é cliente (suporte, financeiro) nem para conversa finalizada.
 */
const RETOMADAS_ASSUMIDA = [1, 3];
async function retomarAssumidas(prisma: PrismaClient, token: string, ativos: string[], agora: Date) {
  // Conversa de lead assumida direto por uma pessoa (veio da triagem, sem agente): passa a ter acompanhamento.
  // Agente: Luiz Felipe se já houve proposta enviada na conversa; senão, a Caroline.
  if (ativos.includes('caroline') || ativos.includes('luiz_felipe')) {
    const soltas = await prisma.whatsappConversa.findMany({
      where: { dono_id: { not: null }, finalizada_em: null, ultima_em: { gte: new Date(agora.getTime() - 30 * 864e5) }, OR: [{ tipo_contato: null }, { tipo_contato: 'LEAD' }] },
      select: { id: true, contato_numero: true, contato_nome: true, lead_id: true }, take: 60,
    });
    for (const c of soltas) {
      if (await prisma.sdrLead.findFirst({ where: { conversaId: c.id }, select: { id: true } })) continue;
      if (await ehClienteAtivo(prisma, c.contato_numero) || await contatoSemAgentes(prisma, c.contato_numero)) continue;
      const comProposta = !!(await prisma.whatsappMensagem.findFirst({ where: { conversaId: c.id, direcao: 'SAIDA', conteudo: { contains: '/p/' } }, select: { id: true } }));
      const agente = comProposta && ativos.includes('luiz_felipe') ? 'luiz_felipe' : 'caroline';
      if (!ativos.includes(agente)) continue;
      await prisma.sdrLead.create({ data: { agente, numero: c.contato_numero, nome: c.contato_nome || null, conversaId: c.id, lead_id: c.lead_id || null, status: 'HUMANO', abertura_enviada: true } as any }).catch(() => {});
    }
  }
  const candidatos = await prisma.sdrLead.findMany({
    // HUMANO (pessoa assumiu) e DEMO/VENDEDORA (demonstração marcada ou lead com a consultora): se o cliente sumir, não fica de lado.
    where: { status: { in: ['HUMANO', 'DEMO', 'VENDEDORA'] }, agente: { in: ativos }, conversaId: { not: null }, updated_at: { gte: new Date(agora.getTime() - 60 * 864e5) } },
    orderBy: { updated_at: 'desc' }, take: 40,
  });
  let enviadas = 0;
  for (const s of candidatos) {
    if (enviadas >= 3) break; // poucas por rodada, para proteger o número
    const d: any = s.dados || {};
    if (d.ja_cliente || d.bloqueado_etiqueta || await contatoSemAgentes(prisma, s.numero)) continue;
    const conv = await prisma.whatsappConversa.findUnique({ where: { id: s.conversaId! }, select: { finalizada_em: true, tipo_contato: true } });
    if (!conv || conv.finalizada_em || conv.tipo_contato === 'EQUIPE' || conv.tipo_contato === 'CLIENTE') continue;
    const [ultSaida, ultEntrada] = await Promise.all([
      prisma.whatsappMensagem.findFirst({ where: { conversaId: s.conversaId!, direcao: 'SAIDA' }, orderBy: { created_at: 'desc' }, select: { id: true, created_at: true, enviada_por: true } }),
      prisma.whatsappMensagem.findFirst({ where: { conversaId: s.conversaId!, direcao: 'ENTRADA' }, orderBy: { created_at: 'desc' }, select: { created_at: true } }),
    ]);
    if (!ultSaida || !ultEntrada || ultEntrada.created_at > ultSaida.created_at) continue; // cliente respondeu: é com a pessoa
    const f = d.retomada_assumida || {};
    // Contagem recomeça quando a última fala não é uma retomada nossa (a pessoa voltou a falar com o cliente).
    const n = f.ultima_msg_id && f.ultima_msg_id === ultSaida.id ? Number(f.n || 0) : 0;
    if (n >= RETOMADAS_ASSUMIDA.length) continue;
    if (diasUteisEntre(ultSaida.created_at, agora) < RETOMADAS_ASSUMIDA[n]) continue;
    if (await ehClienteAtivo(prisma, s.numero)) continue;
    const dica = `CONVERSA ${s.status === 'HUMANO' ? 'ASSUMIDA PELA EQUIPE' : 'COM DEMONSTRAÇÃO/CONSULTORA'}: a equipe estava atendendo este cliente e ele parou de responder há ${diasUteisEntre(ultSaida.created_at, agora)} dia(s) útil(eis). Se havia uma demonstração ou ligação a combinar, o objetivo é REMARCAR (pergunte manhã ou tarde e um dia próximo). `
      + 'Leia a conversa inteira e escreva UMA retomada curta continuando exatamente do ponto em que parou (o último assunto, a última pergunta ou o próximo passo combinado), com leveza e sem cobrança. '
      + 'Não se reapresente como se fosse o primeiro contato, não repita o que já foi dito e não invente valores ou condições. Termine com uma pergunta fácil de responder. Use acao "continuar".'
      + (n > 0 ? ' Esta é a segunda e última retomada: deixe a porta aberta, sem insistir.' : '');
    const r = await gerarResposta(prisma, s, 'retomada', dica).catch(() => null);
    if (!r || !r.mensagens.length) continue;
    await enviarMensagens(prisma, token, s, r.mensagens.slice(0, 2));
    const ultima = await prisma.whatsappMensagem.findFirst({ where: { conversaId: s.conversaId!, direcao: 'SAIDA' }, orderBy: { created_at: 'desc' }, select: { id: true } });
    await prisma.sdrLead.update({ where: { id: s.id }, data: { dados: { ...d, retomada_assumida: { n: n + 1, em: agora.toISOString(), ultima_msg_id: ultima?.id || null } } } });
    await prisma.sdrMensagem.create({ data: { sdrId: s.id, conversaId: s.conversaId!, texto: r.mensagens.join('\n\n'), status: 'ENVIADA_AUTO', acao: 'retomada_assumida', decidido_em: agora } }).catch(() => {});
    registrarAcaoAgente(agenteDe(s), `retomou a conversa assumida de ${s.nome || 'um lead'} (${n + 1}ª tentativa): o cliente tinha parado de responder`);
    enviadas++;
  }
}

/**
 * Pedido da Jessica (05/10/2026): quem já foi contatado pela Caroline ou pelo Julio e ainda não recebeu a apresentação
 * do segmento recebe UMA retomada no contexto da conversa, sutil, com o link (padaria → padaria, farmácia → farmácia).
 * Protege o número: uma por vez, com o intervalo sorteado dos primeiros contatos, no máximo 20 por dia, só nos
 * horários de retomada e nunca antes de um horário combinado com o cliente. Passa pela aprovação como toda retomada.
 */
const MAX_APRESENTACAO_DIA = 20;
let proximaApresentacao = 0;
async function retomarComApresentacao(prisma: PrismaClient, token: string, ativos: string[], agora: Date) {
  const agentes = ativos.filter(a => a === 'caroline' || a === 'julio');
  if (!agentes.length || Date.now() < proximaApresentacao) return;
  const hoje = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const mexidosHoje = await prisma.sdrLead.findMany({ where: { updated_at: { gte: new Date(`${hoje}T00:00:00-03:00`) } }, select: { dados: true } });
  if (mexidosHoje.filter(x => (x.dados as any)?.apresentacao_retomada === hoje).length >= MAX_APRESENTACAO_DIA) return;
  const candidatos = await prisma.sdrLead.findMany({
    where: { agente: { in: agentes }, status: 'AGUARDANDO', conversaId: { not: null }, ultima_caroline_em: { not: null }, proposta_id: null },
    orderBy: { updated_at: 'desc' }, take: 200,
  });
  for (const s of candidatos) {
    const d: any = s.dados || {};
    if (d.apresentacao_retomada || d.retomar_em || d.ja_cliente || d.bloqueado_etiqueta || recuperacaoAtiva(s)) continue;
    if (s.tentativas >= TENTATIVAS_MAX && !d.ciclo_em && !d.encerramento_em) continue; // a mensagem de encerramento já leva o link
    if (s.ultima_lead_em && s.ultima_lead_em > s.ultima_caroline_em!) continue; // a vez é do agente responder
    if (diasUteisEntre(s.ultima_caroline_em!, agora) < 1) continue;             // falou há pouco: espera
    const ap = await apresentacaoPara(prisma, s, 'retomada');
    if (!ap || ap.enviada) continue;
    if (await prisma.sdrMensagem.findFirst({ where: { sdrId: s.id, status: 'PENDENTE' }, select: { id: true } })) continue;
    // Marca antes de falar: nunca sai duas vezes para o mesmo lead, mesmo se a IA falhar.
    await prisma.sdrLead.update({ where: { id: s.id }, data: { dados: { ...d, apresentacao_retomada: hoje } } });
    const loja = ap.tipo === 'padaria' ? 'padaria' : 'farmácia';
    const dica = `RETOMADA COM A APRESENTAÇÃO: este cliente já foi contatado e ainda não recebeu a apresentação para ${loja}. Leia a conversa inteira e retome com sutileza, continuando do ponto em que parou (não se reapresente se já se apresentou, não cobre resposta, não repita o que já disse). Envie a apresentação como algo útil para ele, no espírito de "separei uma apresentação rápida de como o Prosystem vai adiantar a rotina da sua ${loja}, dá uma olhada quando puder", com o link exato numa linha própria, e termine com uma pergunta leve. Use acao "continuar".`;
    const r = await falar(prisma, token, s.id, 'retomada', dica).catch(() => 'falha' as const);
    registrarAcaoAgente(agenteDe(s), r === 'enviado' ? `retomou ${s.nome || 'um lead'} com a apresentação de ${loja}` : r === 'aprovacao' ? `escreveu para ${s.nome || 'um lead'} com a apresentação de ${loja}: esperando sua aprovação` : `não conseguiu retomar ${s.nome || 'um lead'} com a apresentação`);
    proximaApresentacao = Date.now() + intervaloSorteado();
    return; // uma por rodada
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

  // 1b) Parou no meio da conversa (a última mensagem é do agente, 2 h sem resposta, entre 8h e 20h):
  //     vira retomada de follow-up e a gestão é avisada. Nenhum lead fica esquecido.
  const conversando = await prisma.sdrLead.findMany({ where: { agente: { in: ativos }, status: 'CONVERSANDO', ultima_caroline_em: { not: null } }, take: 50 });
  for (const s of conversando) {
    if (s.ultima_lead_em && s.ultima_lead_em > s.ultima_caroline_em!) continue; // a vez é do agente
    if (agora.getTime() - s.ultima_caroline_em!.getTime() < 2 * 3600_000) continue; // 2 h sem resposta
    const horaAgora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora));
    if (horaAgora < 8 || horaAgora >= 20) continue; // cutuca de dia (a mensagem das 22h vira "bom dia")
    if (await prisma.sdrMensagem.findFirst({ where: { sdrId: s.id, status: 'PENDENTE' }, select: { id: true } })) continue; // esperando aprovação
    if (recuperacaoAtiva(s)) { await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'AGUARDANDO' } }); continue; } // recuperação: sem cutucada, espera 3 dias
    // Sem cutucada no mesmo dia: retoma no próximo dia útil (ou em 5 dias, se o cliente tinha adiado).
    const dS: any = s.dados || {};
    const adiouRecente = dS.adiou_em && agora.getTime() - new Date(dS.adiou_em).getTime() < 5 * 864e5;
    const retomarEm = dS.retomar_em && new Date(dS.retomar_em) > agora ? dS.retomar_em : emDiasUteis(adiouRecente ? DIAS_RETOMADA_ADIOU : 1, agora).toISOString();
    await prisma.sdrLead.update({ where: { id: s.id }, data: { status: 'AGUARDANDO', tentativas: 1, dados: { ...dS, parou_em: agora.toISOString(), retomar_em: retomarEm } } });
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `⏸ *${s.nome || s.numero}${s.empresa ? ` (${s.empresa})` : ''} parou de responder* ${nomeDe(s) === 'Luiz Felipe' ? 'ao' : 'à'} ${nomeDe(s)}.\nÚltima mensagem ${s.ultima_caroline_em!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Termômetro ${s.nota ?? '—'}.\nA retomada já está programada (até 3 tentativas). Se quiser, assuma a conversa.`).catch(() => {});
    registrarAcaoAgente(agenteDe(s), `${s.nome || 'um lead'} parou de responder: retomada em ${new Date(retomarEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  }

  if (!horarioComercial(agora)) return;

  // 2) Retomadas de quem não respondeu; depois da 3ª tentativa, o ciclo longo (nunca desiste de cara).
  const aguardando = await prisma.sdrLead.findMany({ where: { agente: { in: ativos }, status: 'AGUARDANDO' }, take: 50 });
  for (const s of aguardando) {
    // Recuperação de proposta recusada: sem retomadas; fecha sozinha após 3 dias sem resposta.
    if (recuperacaoAtiva(s) && !(s.dados as any)?.retomar_em) { await fecharRecuperacaoSemResposta(prisma, s, agora); continue; }
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
      const d: any = s.dados || {};
      // Antes do ciclo longo: mensagem de encerramento ("ainda tem interesse?") com soluções do material,
      // 2 dias úteis depois da 3ª tentativa. Sem resposta em 5 dias úteis, vai para o ciclo do Julio.
      if (!d.encerramento_em) {
        if (s.ultima_caroline_em && diasUteisEntre(s.ultima_caroline_em, agora) >= 2 && horaBoaParaRetomar(agora)) {
          await prisma.sdrLead.update({ where: { id: s.id }, data: { dados: { ...d, encerramento_em: agora.toISOString() } } });
          await falar(prisma, token, s.id, 'encerramento');
        }
        continue;
      }
      if (s.ultima_caroline_em && diasUteisEntre(s.ultima_caroline_em, agora) >= 5) await naoDesistir(prisma, s, agora);
      continue;
    }
    // Retomada só nos horários em que o comerciante costuma olhar o celular (9h–11h30 e 14h–17h).
    // Quem demonstrou interesse (pediu demonstração, proposta, preço, orçamento, "quero conhecer") não espera o
    // ritmo do lead frio: retomada a cada dia útil (pedido da Jessica, 01/10/2026).
    const interessado = (s.nota ?? 0) >= 35 || !!(s.conversaId && await prisma.whatsappMensagem.findFirst({
      where: { conversaId: s.conversaId, direcao: 'ENTRADA', OR: ['demonstra', 'apresenta', 'quero conhecer', 'proposta', 'valor', 'preço', 'preco', 'orçamento', 'orcamento', 'comprar'].map(t => ({ conteudo: { contains: t } })) },
      select: { id: true },
    }));
    const pronto = interessado
      ? !!s.ultima_caroline_em && s.tentativas < TENTATIVAS_MAX && diasUteisEntre(s.ultima_caroline_em, agora) >= 1
      : deveRetomar(s.tentativas, s.ultima_caroline_em, agora);
    if (pronto && horaBoaParaRetomar(agora)) await falar(prisma, token, s.id, 'retomada');
  }

  // 2b) Conversas assumidas por uma pessoa em que o cliente parou de responder: o agente retoma no contexto.
  if (horaBoaParaRetomar(agora)) await retomarAssumidas(prisma, token, ativos, agora).catch((e: any) => console.warn('[AGENTES] retomar assumidas:', e?.message));

  // 2c) Já contatados que ainda não receberam a apresentação do segmento: uma retomada com o link.
  if (horaBoaParaRetomar(agora)) await retomarComApresentacao(prisma, token, ativos, agora).catch((e: any) => console.warn('[AGENTES] apresentação:', e?.message));

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
  // Prospecção do Heitor (contato ativo) só depois de todo o resto e até o teto próprio do dia.
  const { obterConfigHeitor, enviadosHeitorHoje } = await import('./heitor.service');
  const podeHeitor = (await enviadosHeitorHoje(prisma, agora)) < (await obterConfigHeitor(prisma)).envios_dia;
  for (const a of ativos) { // prioridade: Caroline (campanha) → Luiz Felipe (propostas) → Julio (base)
    proximo = await prisma.sdrLead.findFirst({ where: { agente: a, status: 'FILA', OR: [{ criado_por: null }, { criado_por: { not: 'heitor' } }] }, orderBy: a === 'caroline' ? { created_at: 'asc' } : { cadastro_em: 'desc' } });
    if (proximo) break;
  }
  if (!proximo && podeHeitor && ativos.includes('caroline')) {
    proximo = await prisma.sdrLead.findFirst({ where: { agente: 'caroline', status: 'FILA', criado_por: 'heitor' }, orderBy: { created_at: 'asc' } });
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
      sugestao: { ...(((await prisma.whatsappConversa.findUnique({ where: { id: s.conversaId }, select: { ia_sugestao: true } }))?.ia_sugestao as any) || {}), temperatura: s.temperatura, nota: s.nota, fonte: 'caroline' },
    },
  });
  await prisma.sdrLead.update({ where: { id: sdrId }, data: { temperatura_confirmada: temperatura } });
  if (s.lead_id && temperatura !== s.temperatura) {
    await prisma.lead.update({ where: { id: s.lead_id }, data: { temperatura } }).catch(() => {});
    await registrarMudancaTemperatura(prisma, { leadId: s.lead_id, temperaturaAnterior: s.temperatura, temperaturaNova: temperatura, autorId: userId, autorNome: 'Confirmação da gestão' }).catch(() => {});
  }
  (await import('./laya.service')).esquecerCacheLaya();
}
