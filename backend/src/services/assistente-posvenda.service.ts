import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { calcularSlaPrazo } from './whatsapp-sla.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { ultimos8 } from '@/lib/assistente/gestao';
import {
  elegivelBoasVindas, elegivelPesquisa, textoBoasVindas, menuPesquisa, lerBotaoPesquisa, textoRespostaPesquisa, NOME_NOTA,
} from '@/lib/assistente/posvenda';

// Pós-venda (Fase 4): boas-vindas e pesquisa de satisfação. Desligado por padrão
// (Configurações → Assistente no WhatsApp). Ao ligar, grava "desde" para nunca
// mandar nada a contratos antigos.

const CHAVE_ATIVO = 'assistente.posvenda';
const CHAVE_DESDE = 'assistente.posvenda_desde';

export async function obterConfigPosVenda(prisma: PrismaClient) {
  const rows = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: [CHAVE_ATIVO, CHAVE_DESDE] } } }).catch(() => []);
  const ativo = rows.find(r => r.chave === CHAVE_ATIVO)?.valor === 'true';
  const desdeTxt = rows.find(r => r.chave === CHAVE_DESDE)?.valor;
  return { ativo, desde: ativo && desdeTxt ? new Date(desdeTxt) : null };
}

export async function salvarPosVenda(prisma: PrismaClient, ativo: boolean, por: string) {
  const atual = await obterConfigPosVenda(prisma);
  const up = (chave: string, valor: string) => prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: por }, update: { valor, updated_by: por } });
  await up(CHAVE_ATIVO, String(ativo));
  if (ativo && !atual.ativo) await up(CHAVE_DESDE, new Date().toISOString()); // só contratos a partir de agora
}

/**
 * Conversa do contato no WhatsApp da empresa; cria se não existir, já identificada,
 * para a resposta do contato cair no Inbox sem virar lead novo nem abrir a triagem.
 */
export async function garantirConversa(prisma: PrismaClient, instanciaId: string, numero: string, d: { nome?: string | null; tipo_contato: 'CLIENTE' | 'LEAD'; lead_id?: string | null; dono_id?: string | null }) {
  const alvo = ultimos8(numero);
  const existentes = await prisma.whatsappConversa.findMany({ where: { instanciaId, contato_numero: { endsWith: alvo } }, select: { id: true, contato_numero: true, dono_id: true } });
  const achou = existentes.find(c => ultimos8(c.contato_numero) === alvo);
  if (achou) return achou;
  return prisma.whatsappConversa.create({
    data: {
      instanciaId, contato_numero: numero, contato_nome: d.nome || null, tipo_contato: d.tipo_contato, lead_id: d.lead_id || null,
      dono_id: d.dono_id || null, bot_ativo: false, bot_estado: null, nao_lidas: 0,
    },
    select: { id: true, contato_numero: true, dono_id: true },
  });
}

export async function registrarSaida(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id: string | undefined, enviadaPor: string) {
  await prisma.whatsappMensagem.create({ data: { conversaId, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo, status: 'ENVIADA', enviada_por: enviadaPor } })
    .catch((e: any) => console.error('[POSVENDA] gravar saída:', e?.message));
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: conteudo.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
}

const SELECT = {
  id: true, status: true, origem: true, data_aceite: true, updated_at: true, wpp_boasvindas_em: true, wpp_pesquisa_em: true,
  responsavel_telefone: true, responsavel_nome: true, nome_fantasia: true, razao_social: true, vendedor_id: true,
} as const;

/** Rodada do pós-venda (a cada 10 min, horário comercial). */
export async function rodarPosVenda(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const cfg = await obterConfigPosVenda(prisma);
  if (!cfg.ativo || !cfg.desde) return 0;
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return 0;
  const { numeroWhatsapp } = await import('@/lib/assistente/campanhas');
  const ps = await prisma.propostaComercial.findMany({
    where: {
      deleted_at: null, status: 'CONTRATO_ASSINADO', NOT: { origem: 'RETROATIVO' },
      OR: [{ wpp_boasvindas_em: null, updated_at: { gte: cfg.desde } }, { wpp_boasvindas_em: { not: null }, wpp_pesquisa_em: null }],
    },
    select: SELECT, take: 50,
  });
  let n = 0;
  for (const p of ps) {
    const empresa = (p.nome_fantasia || p.razao_social || 'sua empresa').trim();
    const numero = numeroWhatsapp(p.responsavel_telefone);
    if (!numero) continue;
    try {
      if (elegivelBoasVindas(p, cfg.desde, agora)) {
        const conv = await garantirConversa(prisma, inst.id, numero, { nome: p.responsavel_nome, tipo_contato: 'CLIENTE', dono_id: p.vendedor_id });
        const texto = textoBoasVindas(p.responsavel_nome, empresa);
        const r = await evo.enviarTexto(inst.instance_token, numero, texto);
        await registrarSaida(prisma, conv.id, texto, r.externo_id, 'bot');
        await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_boasvindas_em = ? WHERE id = ?', new Date(), p.id);
        n++;
      } else if (elegivelPesquisa(p, agora)) {
        const conv = await garantirConversa(prisma, inst.id, numero, { nome: p.responsavel_nome, tipo_contato: 'CLIENTE', dono_id: p.vendedor_id });
        const menu = menuPesquisa(p.id, empresa);
        const r = await evo.enviarMenu(inst.instance_token, numero, menu);
        await registrarSaida(prisma, conv.id, `${menu.texto}\n\n${menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, r.externo_id, 'bot');
        await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_pesquisa_em = ? WHERE id = ?', new Date(), p.id);
        n++;
      }
    } catch (e: any) { console.error(`[POSVENDA] ${p.id}:`, e?.message); }
  }
  if (n) console.log(`[POSVENDA] ${n} mensagem(ns) de pós-venda`);
  return n;
}

/** Resposta aos botões da pesquisa. true = consumida. */
export async function responderPesquisa(prisma: PrismaClient, token: string, conversaId: string, numero: string, botaoId: string | null | undefined): Promise<boolean> {
  const b = lerBotaoPesquisa(botaoId);
  if (!b) return false;
  const p = await prisma.propostaComercial.findUnique({ where: { id: b.id }, select: { id: true, responsavel_telefone: true, nome_fantasia: true, razao_social: true, wpp_pesquisa_nota: true } });
  if (!p || ultimos8(p.responsavel_telefone || '') !== ultimos8(numero)) return false;
  if (p.wpp_pesquisa_nota == null) {
    await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_pesquisa_nota = ? WHERE id = ?', b.nota, p.id);
    const empresa = (p.nome_fantasia || p.razao_social || 'Cliente').trim();
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'pesquisa_satisfacao', `${b.nota === 1 ? '🚨' : b.nota === 2 ? '⚠️' : '💙'} *Pesquisa de satisfação*\n${empresa}: ${NOME_NOTA[b.nota]}`);
    if (b.nota === 1) await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { prioridade: 'CRITICA', sla_prazo_em: calcularSlaPrazo('CRITICA') } }).catch(() => {});
  }
  const texto = textoRespostaPesquisa(b.nota);
  const r = await evo.enviarTexto(token, numero, texto).catch(() => ({} as any));
  await registrarSaida(prisma, conversaId, texto, r.externo_id, 'bot');
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { dono_id: true } });
  emitirEventoConversa(c?.dono_id ?? null, 'conversa_atualizada', { conversaId });
  return true;
}
