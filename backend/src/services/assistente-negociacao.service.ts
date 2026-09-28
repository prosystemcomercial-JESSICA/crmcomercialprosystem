import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { acharGestor } from '@/lib/assistente/gestao';
import { listarGestao, lerPrefsAvisos } from './assistente-gestao.service';
import { opcoesPlanos, mensalidadeDe, linkProposta, planoNormal, type PropostaResumo } from '@/lib/assistente/proposta';
import { pctDesconto } from '@/lib/assistente/desconto';
import {
  textoPedidoNegociacao, menuNegociacao, campanhaVigente, validadeCampanha, lerBotaoNegociacao, calcularCondicao, textoCondicaoAplicada, type CondicaoAutorizada,
} from '@/lib/assistente/negociacao';

// Máquina de negociação do Luiz Felipe: pede autorização da gestão pelo WhatsApp (prévia + botões),
// guarda a condição autorizada no lead e, quando o cliente topa, atualiza a proposta e manda com os botões de aceite.

const SELECT = {
  id: true, razao_social: true, nome_fantasia: true, responsavel_nome: true, plano_selecionado: true, segmento: true,
  mensalidade_basic: true, mensalidade_pro: true, mensalidade_plus: true, valor_final: true, valor_implantacao: true, valor_conversao: true,
  entrada: true, parcelas: true, valor_parcela: true, validade: true, vendedor_nome: true, public_token: true, desconto: true, status: true,
} as const;

const baseFrontend = () => (process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com';
export const mesAtual = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

async function propostaDo(prisma: PrismaClient, sdr: any) {
  return sdr.proposta_id ? prisma.propostaComercial.findUnique({ where: { id: sdr.proposta_id }, select: SELECT }) : null;
}

/** Envia para a gestão (quem recebe avisos de lead) a prévia da proposta + a mensagem + botões de desconto. */
export async function pedirAutorizacaoNegociacao(prisma: PrismaClient, sdr: any, msg: { id: string; texto: string }, agente: string) {
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return;
  const p = await propostaDo(prisma, sdr);
  const plano = p ? (opcoesPlanos(p as PropostaResumo).find(o => o.plano === planoNormal(p.plano_selecionado))?.nome || p.plano_selecionado) : null;
  const texto = textoPedidoNegociacao({
    empresa: (p?.nome_fantasia || p?.razao_social || sdr.empresa || sdr.nome || sdr.numero || 'Cliente').trim(),
    contato: sdr.nome || p?.responsavel_nome || null, plano,
    mensalidade: p ? mensalidadeDe(p as PropostaResumo) : null,
    implantacao: p ? (p.valor_implantacao ?? null) : null,
    link: p?.public_token ? linkProposta(baseFrontend(), p.public_token) : null,
    mensagem: msg.texto, agente,
  });
  const menu = menuNegociacao(msg.id, texto);
  for (const g of await listarGestao(prisma)) {
    if (!(await lerPrefsAvisos(prisma, g.id)).includes('lead_qualificado')) continue;
    await evo.enviarMenu(inst.instance_token, g.telefone!, menu).catch((e: any) => console.error('[NEGOCIACAO] envio:', e?.message));
  }
}

/** Botão da gestão: 30% / 20% autoriza (a mensagem sai e o desconto fica liberado); 0 = sem campanha (sai só o pedido de previsão). */
export async function responderAutorizacaoNegociacao(prisma: PrismaClient, token: string, numero: string, botaoId: string | null | undefined): Promise<boolean> {
  const b = lerBotaoNegociacao(botaoId);
  if (!b) return false;
  const gestor = acharGestor(numero, await listarGestao(prisma));
  if (!gestor) return false;
  const enviar = (t: string) => evo.enviarTexto(token, numero, t).catch(() => {});
  const m = await prisma.sdrMensagem.findUnique({ where: { id: b.msgId } });
  if (!m) { await enviar('Não achei essa mensagem.'); return true; }
  if (m.status !== 'PENDENTE') { await enviar('Essa autorização já foi respondida. ✅'); return true; }
  const sdr = await prisma.sdrLead.findUnique({ where: { id: m.sdrId } });
  if (!sdr) { await enviar('Não achei esse cliente.'); return true; }
  const dados: any = sdr.dados || {};
  const { decidirMensagem } = await import('./caroline.service');
  const primeiro = (sdr.nome || '').trim().split(/\s+/)[0];
  try {
    if (b.pct > 0) {
      const p = await propostaDo(prisma, sdr);
      const c: CondicaoAutorizada = { ...calcularCondicao(b.pct, p?.valor_implantacao ?? null, p ? mensalidadeDe(p as PropostaResumo) : null), por: gestor.nome, em: new Date().toISOString() };
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...dados, desconto_autorizado: c, campanha_mes: mesAtual() } } });
      await decidirMensagem(prisma, m.id, { aprovar: true }, gestor.id);
      await enviar(`✅ Autorizado! A mensagem saiu para *${sdr.nome || sdr.empresa || 'o cliente'}* e o Luiz pode negociar até *${b.pct}%* na implantação e *10%* na mensalidade por 12 meses. Campanha válida por 5 dias, até ${validadeCampanha(c).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}.`);
    } else {
      await prisma.sdrLead.update({ where: { id: sdr.id }, data: { dados: { ...dados, campanha_mes: mesAtual(), campanha_recusada: true } } });
      const semCampanha = `Sem problema${primeiro ? `, ${primeiro}` : ''}! Pra quando você acha que consegue decidir? Assim já te chamo nesse dia. 😊`;
      await decidirMensagem(prisma, m.id, { aprovar: true, texto: semCampanha }, gestor.id);
      await enviar(`Ok, sem campanha para *${sdr.nome || sdr.empresa || 'o cliente'}*. O Luiz só pediu a previsão de decisão.`);
    }
  } catch (e: any) { await enviar(`Não consegui concluir: ${e?.message || 'erro'}`); }
  return true;
}

/** Cliente topou a condição: atualiza a proposta (desconto na implantação + condição da mensalidade) e manda com os botões de aceite. */
export async function aplicarCondicaoNaProposta(prisma: PrismaClient, sdr: any, agente: string): Promise<boolean> {
  const c: CondicaoAutorizada | undefined = (sdr.dados || {}).desconto_autorizado;
  const p = await propostaDo(prisma, sdr);
  if (!c || !p || !sdr.conversaId || !campanhaVigente(c)) return false;
  const base = (p.valor_implantacao || 0) + (p.valor_conversao || 0);
  const desconto = Math.round((p.valor_implantacao || 0) * c.impl_pct) / 100;
  const condicao = `Campanha: ${c.impl_pct}% de desconto na implantação e ${c.mens_pct}% na mensalidade por ${c.meses} meses${c.mens_por != null ? ` (R$ ${c.mens_por.toFixed(2).replace('.', ',')} nos primeiros ${c.meses} meses)` : ''}. Autorizado por ${c.por || 'gestão'}.`;
  const pct = pctDesconto({ desconto, valor_implantacao: p.valor_implantacao, valor_conversao: p.valor_conversao });
  await prisma.propostaComercial.update({
    where: { id: p.id },
    data: {
      desconto, valor_final: Math.round((base - desconto) * 100) / 100, condicao_especial: condicao,
      desconto_aprov_status: 'APROVADO', desconto_aprov_pct: pct, desconto_aprov_em: new Date(),
      ...(['ENVIADA', 'VISUALIZADA', 'EXPIRADA'].includes(p.status) ? { status: 'EM_NEGOCIACAO' } : {}),
    } as any,
  });
  await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'RENEGOCIACAO', campo_alterado: 'desconto', valor_anterior: String(p.desconto ?? 0), valor_novo: String(desconto), motivo: condicao, feito_por_nome: agente } }).catch(() => {});
  const { enviarPropostaWhatsapp } = await import('./assistente-proposta.service');
  await enviarPropostaWhatsapp(prisma, sdr.conversaId, p.id, { id: 'bot', nome: agente });
  const inst = await obterInstanciaEmpresa(prisma);
  const conv = await prisma.whatsappConversa.findUnique({ where: { id: sdr.conversaId }, select: { contato_numero: true } });
  if (inst?.instance_token && conv) {
    const t = textoCondicaoAplicada(c);
    const r = await evo.enviarTexto(inst.instance_token, conv.contato_numero, t);
    await prisma.whatsappMensagem.create({ data: { conversaId: sdr.conversaId, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: t, status: 'ENVIADA', enviada_por: 'luiz_felipe' } });
  }
  return true;
}
