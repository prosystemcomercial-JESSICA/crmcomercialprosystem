import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { calcularSlaPrazo } from './whatsapp-sla.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { ultimos8 } from '@/lib/assistente/gestao';
import {
  textoResumoProposta, menuAceite, opcoesPlanos, lerBotaoProposta, textoPosAceite, textoDuvida, decidirFollowup, textoFollowup, linkProposta,
  textoCobrancaEntrada, chavePixParaBotao,
  type PropostaResumo,
} from '@/lib/assistente/proposta';

// Proposta pelo WhatsApp (Fase 1, entrega 2): envio com botões Aceitar/Tenho
// dúvidas, resposta aos botões e follow-up nos dias 2, 5 e 7.

const ABERTAS = ['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'EM_NEGOCIACAO'];
const ACEITAS = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];
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

/** Propostas abertas (e as já aceitas, para cobrar a entrada) que casam com a conversa: mesmo CNPJ (conversa/lead) ou mesmo telefone do responsável. */
export async function propostasDaConversa(prisma: PrismaClient, conversaId: string) {
  const c = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { contato_numero: true, bot_dados: true, lead_id: true } });
  if (!c) return [];
  const lead = c.lead_id ? await prisma.lead.findUnique({ where: { id: c.lead_id }, select: { cnpj: true } }).catch(() => null) : null;
  const cnpjs = [digitos((c.bot_dados as any)?.cnpj), digitos(lead?.cnpj)].filter(x => x.length === 14);
  const tel = ultimos8(c.contato_numero);
  const ps = await prisma.propostaComercial.findMany({
    where: { deleted_at: null, status: { in: [...ABERTAS, ...ACEITAS] } }, select: SELECT_RESUMO, orderBy: { created_at: 'desc' }, take: 300,
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
  // Clique repetido: a proposta sai uma vez só (reenviar de propósito continua valendo depois de 1 minuto).
  if (p.wpp_enviada_em && p.wpp_conversa_id === conversa.id && Date.now() - p.wpp_enviada_em.getTime() < 60_000) {
    throw new Error('Esta proposta acabou de ser enviada para este contato.');
  }
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
  // Central de Leads: proposta enviada ao lead desta conversa.
  {
    const lc = await prisma.whatsappConversa.findUnique({ where: { id: conversa.id }, select: { lead_id: true } }).catch(() => null);
    const { avancarEtapaLead } = await import('@/lib/etapa-lead');
    await avancarEtapaLead(prisma, lc?.lead_id, 'PROPOSTA_ENVIADA', 'proposta enviada pelo WhatsApp', user.nome || 'Equipe');
  }
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
    if (ok) {
      await enviarPosAceite(prisma, token, conversa, p as PropostaResumo, b.plano);
      emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
      return true;
    }
    texto = 'Recebemos o seu aceite! Nossa equipe vai confirmar e já te chama. 🙏';
  } else {
    texto = textoDuvida(p as PropostaResumo);
    await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { prioridade: 'CRITICA', sla_prazo_em: calcularSlaPrazo('CRITICA') } }).catch(() => {});
  }
  const r = await evo.enviarTexto(token, conversa.contato_numero, texto).catch((e: any) => { console.error('[PROPOSTA-WPP] resposta:', e?.message); return {} as any; });
  await gravarSaida(prisma, conversa.id, texto, r.externo_id, 'bot');
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
  return true;
}

/** Chave PIX da empresa e nome de quem recebe (Configurações > Assistente no WhatsApp). */
async function lerPix(prisma: PrismaClient): Promise<{ chave: string; nome: string }> {
  const rs = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: ['assistente.pix_chave', 'assistente.pix_nome'] } } }).catch(() => []);
  const v = (k: string) => (rs.find(r => r.chave === k)?.valor || '').trim();
  return { chave: v('assistente.pix_chave'), nome: v('assistente.pix_nome') };
}

/** Botão "Copiar chave Pix"; se não der (formato da chave, número gratuito, erro da API), manda a chave em texto. */
async function enviarChavePix(prisma: PrismaClient, token: string, conversa: { id: string; contato_numero: string }, pix: { chave: string; nome: string }, enviadaPor: string) {
  const b = chavePixParaBotao(pix.chave);
  if (b) {
    try {
      const r = await evo.enviarBotaoPix(token, conversa.contato_numero, { ...b, nome: pix.nome });
      await gravarSaida(prisma, conversa.id, `[Botão PIX] ${pix.nome || 'Pix'} · ${pix.chave}`, r.externo_id, enviadaPor);
      return;
    } catch (e: any) { console.error('[PROPOSTA-WPP] botão PIX:', e?.message); }
  }
  const t = `Chave PIX${pix.nome ? ` (${pix.nome})` : ''}: *${pix.chave}*`;
  const r = await evo.enviarTexto(token, conversa.contato_numero, t).catch((e: any) => { console.error('[PROPOSTA-WPP] chave PIX:', e?.message); return {} as any; });
  await gravarSaida(prisma, conversa.id, t, r.externo_id, enviadaPor);
}

/** Mensagem após o aceite: próximos passos + cobrança da entrada com o botão PIX. */
async function enviarPosAceite(prisma: PrismaClient, token: string, conversa: { id: string; contato_numero: string }, p: PropostaResumo, plano?: string | null) {
  const pix = await lerPix(prisma);
  const cobra = !!(p.entrada && pix.chave);
  const escolhido = plano ? opcoesPlanos(p).find(o => o.plano === plano) : null;
  const texto = (escolhido ? `✅ Plano escolhido: *${escolhido.nome}*.\n\n` : '') + textoPosAceite(p, pix.chave, cobra);
  const r = await evo.enviarTexto(token, conversa.contato_numero, texto).catch((e: any) => { console.error('[PROPOSTA-WPP] pós-aceite:', e?.message); return {} as any; });
  await gravarSaida(prisma, conversa.id, texto, r.externo_id, 'bot');
  if (cobra) await enviarChavePix(prisma, token, conversa, pix, 'bot');
}

/**
 * Aceite pelo link público de uma proposta enviada pelo WhatsApp: o cliente recebe na
 * mesma conversa os próximos passos e o botão PIX da entrada (igual ao aceite pelo botão).
 */
export async function posAceitePeloLink(prisma: PrismaClient, propostaId: string): Promise<void> {
  const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: SELECT_RESUMO });
  if (!p?.wpp_conversa_id) return;
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: p.wpp_conversa_id }, select: { id: true, contato_numero: true, dono_id: true } });
  const inst = await obterInstanciaEmpresa(prisma);
  if (!conversa || !inst?.instance_token) return;
  await enviarPosAceite(prisma, inst.instance_token, conversa, p as PropostaResumo, null);
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/** Botão "Enviar chave Pix" do painel da conversa: só o cartão "Copiar chave Pix", para qualquer contato. */
export async function enviarPixConversa(prisma: PrismaClient, conversaId: string, user: { id: string }) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('WhatsApp da empresa não está conectado.');
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, dono_id: true } });
  if (!conversa) throw new Error('Conversa não encontrada.');
  const pix = await lerPix(prisma);
  if (!pix.chave) throw new Error('Cadastre a chave PIX da empresa em Configurações > Assistente no WhatsApp.');
  await enviarChavePix(prisma, inst.instance_token, conversa, pix, user.id);
  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { sla_prazo_em: null } }).catch(() => {});
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/** Botão "Cobrar entrada (PIX)" do painel da conversa: proposta aceita → texto com o valor + botão PIX. */
export async function cobrarEntradaWhatsapp(prisma: PrismaClient, conversaId: string, propostaId: string, user: { id: string; nome?: string }) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('WhatsApp da empresa não está conectado.');
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id: conversaId }, select: { id: true, contato_numero: true, dono_id: true } });
  const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: SELECT_RESUMO });
  if (!conversa || !p) throw new Error('Conversa ou proposta não encontrada.');
  if (!ACEITAS.includes(p.status)) throw new Error('A cobrança da entrada é para proposta aceita.');
  const valor = p.entrada || p.valor_final || p.valor_implantacao;
  if (!valor) throw new Error('A proposta não tem valor de entrada.');
  const pix = await lerPix(prisma);
  if (!pix.chave) throw new Error('Cadastre a chave PIX da empresa em Configurações > Assistente no WhatsApp.');

  const texto = textoCobrancaEntrada(valor, pix.chave, !!chavePixParaBotao(pix.chave));
  const r = await evo.enviarTexto(inst.instance_token, conversa.contato_numero, texto);
  await gravarSaida(prisma, conversa.id, texto, r.externo_id, user.id);
  await enviarChavePix(prisma, inst.instance_token, conversa, pix, user.id);
  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { sla_prazo_em: null } }).catch(() => {});
  await prisma.propostaHistorico.create({
    data: { proposta_id: p.id, tipo: 'ENVIO', valor_novo: 'Cobrança da entrada (PIX) enviada pelo WhatsApp', feito_por_id: user.id, feito_por_nome: user.nome || 'Equipe' } as any,
  }).catch((e: any) => console.error('[PROPOSTA-WPP] histórico:', e?.message));
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
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
