import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { calcularSlaPrazo } from './whatsapp-sla.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { ultimos8 } from '@/lib/assistente/gestao';
import {
  textoResumoProposta, menuAceite, opcoesPlanos, lerBotaoProposta, textoPosAceite, textoDuvida, decidirFollowup, textoFollowup, linkProposta,
  type PropostaResumo,
} from '@/lib/assistente/proposta';

// Proposta pelo WhatsApp (Fase 1, entrega 2): envio com botões Aceitar/Tenho
// dúvidas, resposta aos botões e follow-up nos dias 2, 5 e 7.

const ABERTAS = ['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'];
const SELECT_RESUMO = {
  id: true, razao_social: true, nome_fantasia: true, responsavel_nome: true, plano_selecionado: true,
  mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, valor_final: true, valor_implantacao: true,
  entrada: true, parcelas: true, valor_parcela: true, validade: true, vendedor_nome: true, segmento: true,
  public_token: true, status: true, cnpj: true, responsavel_telefone: true, created_at: true,
  wpp_conversa_id: true, wpp_enviada_em: true, wpp_followup_etapa: true,
} as const;

const baseFrontend = () => (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com';
const digitos = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

async function gravarSaida(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id: string | undefined, enviadaPor: string) {
  await prisma.whatsappMensagem.create({
    data: { conversaId, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo, status: 'ENVIADA', enviada_por: enviadaPor },
  }).catch((e: any) => console.error('[PROPOSTA-WPP] gravar saída:', e?.message));
  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { ultima_mensagem: conteudo.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
}

/** Propostas abertas que casam com a conversa: mesmo CNPJ (conversa/lead) ou mesmo telefone do responsável. */
export async function propostasDaConversa(prisma: PrismaClient, conversaId: string) {
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_numero: true, bot_dados: true, lead_id: true } });
  if (!c) return [];
  const lead = c.lead_id ? await prisma.lead.findUnique({ where: { id: c.lead_id }, select: { cnpj: true } }).catch(() => null) : null;
  const cnpjs = [digitos((c.bot_dados as any)?.cnpj), digitos(lead?.cnpj)].filter(x => x.length === 14);
  const tel = ultimos8(c.contato_numero);
  const ps = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, status: { in: ABERTAS } }, select: SELECT_RESUMO, orderBy: { created_at: 'desc' }, take: 300,
  });
  return ps.filter(p => cnpjs.includes(digitos(p.cnpj)) || (tel.length === 8 && ultimos8(p.responsavel_telefone) === tel)).slice(0, 10);
}

export async function enviarPropostaWhatsapp(prisma: PrismaClient, conversaId: string, propostaId: string, user: { id: string; nome?: string }) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('WhatsApp da empresa não está conectado.');
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, dono_id: true } });
  const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: SELECT_RESUMO });
  if (!conversa || !p) throw new Error('Conversa ou proposta não encontrada.');
  if (!p.public_token) throw new Error('A proposta ainda não tem link público. Abra a proposta e gere o link antes de enviar.');
  if (!ABERTAS.includes(p.status)) throw new Error('Esta proposta não está mais aberta.');
  // Desconto acima do limite: só sai depois da aprovação da gestão (ideia 23).
  const { situacaoDesconto } = await import('./assistente-desconto.service');
  const sd = await situacaoDesconto(prisma, p.id);
  if (sd?.precisa) {
    const e: any = new Error(sd.status === 'PENDENTE'
      ? `O desconto de ${sd.pct}% está aguardando aprovação da gestão.`
      : `O desconto de ${sd.pct}% passa do limite de ${sd.limite}%. Peça aprovação antes de enviar.`);
    e.codigo = sd.status === 'PENDENTE' ? 'APROVACAO_PENDENTE' : 'APROVACAO_NECESSARIA';
    throw e;
  }

  const link = linkProposta(baseFrontend(), p.public_token);
  const texto = textoResumoProposta(p as PropostaResumo, link);
  const r1 = await evo.enviarTexto(inst.instance_token, conversa.contato_numero, texto);
  await gravarSaida(prisma, conversa.id, texto, r1.externo_id, user.id);
  const menu = menuAceite(p.id, opcoesPlanos(p as PropostaResumo));
  const r2 = await evo.enviarMenu(inst.instance_token, conversa.contato_numero, menu);
  await gravarSaida(prisma, conversa.id, `${menu.texto}\n\n${menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`, r2.externo_id, user.id);
  // Igual a uma resposta enviada pelo CRM: a conversa sai do prazo de resposta.
  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { sla_prazo_em: null } }).catch(() => {});

  await prisma.propostaComercial.update({
    where: { id: p.id },
    data: { wpp_conversa_id: conversa.id, wpp_enviada_em: new Date(), wpp_followup_etapa: 0, ...(p.status === 'RASCUNHO' ? { status: 'ENVIADA' } : {}) },
  });
  await prisma.propostaHistorico.create({
    data: {
      proposta_id: p.id, tipo: p.status === 'RASCUNHO' ? 'STATUS' : 'ENVIO', valor_anterior: p.status === 'RASCUNHO' ? 'RASCUNHO' : null,
      valor_novo: p.status === 'RASCUNHO' ? 'ENVIADA' : 'Reenviada pelo WhatsApp', feito_por_id: user.id, feito_por_nome: user.nome || 'Equipe',
    } as any,
  }).catch((e: any) => console.error('[PROPOSTA-WPP] histórico:', e?.message));
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/**
 * Clique em "Aceitar proposta"/"Tenho dúvidas". Devolve true quando a mensagem
 * era desses botões (o webhook para aqui). `aceitarPorToken` roda o mesmo aceite do link público.
 */
export async function responderBotaoProposta(
  prisma: PrismaClient, token: string, conversaId: string, botaoId: string | null | undefined,
  aceitarPorToken: (publicToken: string, plano?: string) => Promise<boolean>,
): Promise<boolean> {
  const b = lerBotaoProposta(botaoId);
  if (!b) return false;
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, dono_id: true } });
  const p = await prisma.propostaComercial.findUnique({ where: { id: b.id }, select: SELECT_RESUMO });
  if (!conversa || !p || p.wpp_conversa_id !== conversa.id) return false; // botão de outra conversa: ignora

  let texto: string;
  if (b.acao === 'aceitar') {
    // Botão de um plano (Pro/Plus): o aceite grava esse plano e os valores dele.
    const ok = p.public_token ? await aceitarPorToken(p.public_token, b.plano) : false;
    if (!ok) texto = 'Recebemos o seu aceite! Nossa equipe vai confirmar e já te chama. 🙏';
    else {
      const pix = await prisma.configuracaoIntegracao.findUnique({ where: { chave: 'assistente.pix_chave' } }).catch(() => null);
      const escolhido = b.plano ? opcoesPlanos(p as PropostaResumo).find(o => o.plano === b.plano) : null;
      texto = (escolhido ? `✅ Plano escolhido: *${escolhido.nome}*.

` : '') + textoPosAceite(p as PropostaResumo, pix?.valor || '');
    }
  } else {
    texto = textoDuvida(p as PropostaResumo);
    await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { prioridade: 'CRITICA', sla_prazo_em: calcularSlaPrazo('CRITICA') } }).catch(() => {});
  }
  const r = await evo.enviarTexto(token, conversa.contato_numero, texto).catch((e: any) => { console.error('[PROPOSTA-WPP] resposta:', e?.message); return {} as any; });
  await gravarSaida(prisma, conversa.id, texto, r.externo_id, 'bot');
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
  return true;
}

/** Follow-up das propostas enviadas pelo WhatsApp (dias 2, 5 e 7). Devolve quantas mensagens saíram. */
export async function rodarFollowupPropostas(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return 0;
  const ps = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, wpp_enviada_em: { not: null }, wpp_conversa_id: { not: null }, wpp_followup_etapa: { lt: 3 } },
    select: SELECT_RESUMO, take: 100,
  });
  let enviados = 0;
  for (const p of ps) {
    const conversa = await prisma.whatsappConversa.findUnique({ where: { id: p.wpp_conversa_id! }, select: { id: true, contato_numero: true } });
    if (!conversa) continue;
    const ultimaEntrada = await prisma.whatsappMensagem.findFirst({
      where: { conversaId: conversa.id, direcao: 'ENTRADA' }, orderBy: { created_at: 'desc' }, select: { created_at: true },
    });
    const d = decidirFollowup({ status: p.status, enviada_em: p.wpp_enviada_em, etapa: p.wpp_followup_etapa, ultima_entrada_em: ultimaEntrada?.created_at || null, agora });
    if (d === null) continue;
    // SQL cru: não mexe em updated_at (base de "propostas paradas").
    if (d === 'parar') { await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_followup_etapa = 3 WHERE id = ?', p.id); continue; }
    const texto = textoFollowup(d, p as PropostaResumo, linkProposta(baseFrontend(), p.public_token || ''));
    try {
      const r = await evo.enviarTexto(inst.instance_token, conversa.contato_numero, texto);
      await gravarSaida(prisma, conversa.id, texto, r.externo_id, 'cadencia_automatica');
      await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_followup_etapa = ? WHERE id = ?', d, p.id);
      enviados++;
    } catch (e: any) {
      console.error(`[PROPOSTA-WPP] follow-up ${p.id}:`, e?.message);
    }
  }
  if (enviados) console.log(`[PROPOSTA-WPP] ${enviados} follow-up(s) enviado(s)`);
  return enviados;
}
