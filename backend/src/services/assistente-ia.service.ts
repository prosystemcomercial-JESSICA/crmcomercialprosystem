import type { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import path from 'path';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { chamarGemini, chaveGemini } from './ia-gemini.service';
import { montarEstadoConversa } from '@/lib/laya';
import {
  podeAutoResponder, promptTiraDuvidas, promptResumo, promptSugestao, lerJsonIa, respostaSegura,
  MODOS_TIRA_DUVIDAS, type ModoTiraDuvidas,
} from '@/lib/assistente/ia-texto';
import { REMETENTES_AUTOMATICOS } from '@/lib/painel-tv';

// IA de texto (Fase 3): tira-dúvidas automático, resumo da conversa, sugestão de
// resposta e transcrição de áudio. Mensagens da IA saem com enviada_por 'assistente_ia'.

export const REMETENTE_IA = 'assistente_ia';
const CHAVE_MODO = 'assistente.tira_duvidas';
const CHAVE_TRANSCREVER = 'assistente.transcrever_auto';

let guiaCache: { em: number; texto: string } | null = null;
/** Guia comercial (docs do repositório) + textos de material de farmácia e padaria. */
export async function guiaComercial(prisma: PrismaClient): Promise<string> {
  if (guiaCache && Date.now() - guiaCache.em < 10 * 60000) return guiaCache.texto;
  const arquivo = path.resolve(process.cwd(), '..', 'docs', 'comercial', 'base-conhecimento-comercial.md');
  const doc = await readFile(arquivo, 'utf8').catch(() => '');
  const mats = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: ['whatsapp.triagem.material.farmacia', 'whatsapp.triagem.material.padaria'] } } }).catch(() => []);
  const materiais = mats.map(m => { try { return JSON.parse(m.valor).texto || ''; } catch { return ''; } }).filter(Boolean).join('\n\n');
  const texto = `${doc}\n\n### Material enviado aos leads\n${materiais}`.slice(0, 60000);
  guiaCache = { em: Date.now(), texto };
  return texto;
}

export async function obterConfigIaTexto(prisma: PrismaClient) {
  const rows = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: [CHAVE_MODO, CHAVE_TRANSCREVER] } } }).catch(() => []);
  const modo = rows.find(r => r.chave === CHAVE_MODO)?.valor as ModoTiraDuvidas | undefined;
  const transc = rows.find(r => r.chave === CHAVE_TRANSCREVER)?.valor;
  return {
    tira_duvidas: (MODOS_TIRA_DUVIDAS.includes(modo as any) ? modo : 'fora_do_horario') as ModoTiraDuvidas,
    transcrever_auto: transc === undefined ? true : transc === 'true',
    tem_chave: !!(await chaveGemini(prisma)),
  };
}

export async function salvarConfigIaTexto(prisma: PrismaClient, c: { tira_duvidas?: ModoTiraDuvidas; transcrever_auto?: boolean; gemini_chave?: string }, por: string) {
  const pares: [string, string][] = [];
  if (c.tira_duvidas) pares.push([CHAVE_MODO, c.tira_duvidas]);
  if (c.transcrever_auto !== undefined) pares.push([CHAVE_TRANSCREVER, String(c.transcrever_auto)]);
  if (c.gemini_chave !== undefined) pares.push(['assistente.gemini_chave', c.gemini_chave.trim()]);
  for (const [chave, valor] of pares) {
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: por }, update: { valor, updated_by: por } });
  }
}

async function textoDaConversa(prisma: PrismaClient, conversaId: string, take = 40) {
  const msgs = await prisma.whatsappMensagem.findMany({
    where: { conversaId }, orderBy: { created_at: 'desc' }, take,
    select: { direcao: true, tipo: true, conteudo: true, transcricao: true },
  });
  // Áudio transcrito entra como texto.
  return montarEstadoConversa(msgs.reverse().map(m => m.tipo === 'AUDIO' && m.transcricao ? { ...m, tipo: 'TEXTO', conteudo: `(áudio) ${m.transcricao}` } : m), 6000);
}

export async function resumirConversa(prisma: PrismaClient, conversaId: string) {
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_nome: true, tipo_contato: true, contato_empresa: true, bot_dados: true } });
  const conversa = await textoDaConversa(prisma, conversaId, 60);
  if (!conversa) throw new Error('A conversa ainda não tem texto para resumir.');
  const receita = (c?.bot_dados as any)?.receita;
  const contexto = [c?.contato_nome, c?.tipo_contato && `tipo: ${c.tipo_contato}`, c?.contato_empresa, receita?.razao_social, (c?.bot_dados as any)?.segmento].filter(Boolean).join(' · ');
  const p = promptResumo(conversa, contexto);
  const r = lerJsonIa<{ quem: string; falado: string; falta: string; venda_adicional: string | null }>(await chamarGemini(prisma, { sistema: p.sistema, partes: [{ text: p.usuario }], json: true }));
  if (!r) throw new Error('Não consegui resumir agora. Tente de novo.');
  return r;
}

export async function sugerirResposta(prisma: PrismaClient, conversaId: string, vendedora: string) {
  const conversa = await textoDaConversa(prisma, conversaId);
  if (!conversa) throw new Error('A conversa ainda não tem texto.');
  const p = promptSugestao(await guiaComercial(prisma), conversa, vendedora);
  return (await chamarGemini(prisma, { sistema: p.sistema, partes: [{ text: p.usuario }], temperatura: 0.5 })).replace(/^["“]|["”]$/g, '').trim();
}

/** Transcreve um áudio já guardado (midia_url em data URL) e grava na mensagem. */
export async function transcreverAudio(prisma: PrismaClient, mensagemId: string): Promise<string> {
  const m = await prisma.whatsappMensagem.findUnique({ where: { id: mensagemId }, select: { id: true, tipo: true, midia_url: true, transcricao: true, conversaId: true } });
  if (!m || m.tipo !== 'AUDIO') throw new Error('Mensagem de áudio não encontrada.');
  if (m.transcricao) return m.transcricao;
  const dm = (m.midia_url || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!dm) throw new Error('O áudio não está disponível para transcrever.');
  if (dm[2].length > 18_000_000) throw new Error('Áudio muito longo para transcrever.');
  const texto = await chamarGemini(prisma, {
    sistema: 'Você transcreve áudios de WhatsApp em português do Brasil, fielmente, sem comentários.',
    partes: [{ inline_data: { mime_type: dm[1].split(';')[0] || 'audio/ogg', data: dm[2] } }, { text: 'Transcreva este áudio. Responda só com a transcrição.' }],
    temperatura: 0, timeoutMs: 90_000,
  });
  await prisma.whatsappMensagem.update({ where: { id: m.id }, data: { transcricao: texto.slice(0, 20000) } });
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: m.conversaId }, select: { dono_id: true } });
  emitirEventoConversa(conv?.dono_id ?? null, 'conversa_atualizada', { conversaId: m.conversaId });
  return texto;
}

/**
 * Tira-dúvidas: depois de gravar a mensagem do lead, decide se pode responder
 * sozinho e pergunta à IA. Nunca lança; na dúvida, não responde (a equipe responde).
 */
export async function autoResponderDuvida(prisma: PrismaClient, token: string, conversaId: string, texto: string): Promise<void> {
  try {
    const cfg = await obterConfigIaTexto(prisma);
    if (!cfg.tem_chave || cfg.tira_duvidas === 'desligado') return;
    const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, tipo_contato: true, bot_ativo: true, bot_estado: true, dono_id: true } });
    if (!c) return;
    const agora = new Date();
    const inicioDia = new Date(agora.getTime() - 24 * 3600000);
    const saidas = await prisma.whatsappMensagem.findMany({
      where: { conversaId, direcao: 'SAIDA', created_at: { gte: inicioDia } }, select: { enviada_por: true, created_at: true }, orderBy: { created_at: 'desc' },
    });
    const humana = saidas.find(s => !REMETENTES_AUTOMATICOS.includes(s.enviada_por || '') && s.enviada_por !== REMETENTE_IA);
    const ok = podeAutoResponder({
      modo: cfg.tira_duvidas, agora, tipo_contato: c.tipo_contato, em_triagem: c.bot_ativo && !!c.bot_estado && c.bot_estado !== 'FIM',
      ultima_saida_humana_em: humana?.created_at || null, auto_hoje: saidas.filter(s => s.enviada_por === REMETENTE_IA).length, texto,
    });
    if (!ok) return;
    const p = promptTiraDuvidas(await guiaComercial(prisma), await textoDaConversa(prisma, conversaId, 20));
    const resposta = respostaSegura(lerJsonIa(await chamarGemini(prisma, { sistema: p.sistema, partes: [{ text: p.usuario }], json: true, temperatura: 0.2 })));
    if (!resposta) return;
    const r = await evo.enviarTexto(token, c.contato_numero, resposta);
    await prisma.whatsappMensagem.create({ data: { conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: resposta, status: 'ENVIADA', enviada_por: REMETENTE_IA } });
    await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: resposta.slice(0, 200), ultima_em: new Date() } });
    emitirEventoConversa(c.dono_id, 'conversa_atualizada', { conversaId });
    console.log(`[IA] tira-dúvidas respondeu ${c.contato_numero}`);
  } catch (e: any) {
    console.warn('[IA] tira-dúvidas:', e?.message);
  }
}
