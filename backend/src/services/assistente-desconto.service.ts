import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { acharGestor } from '@/lib/assistente/gestao';
import { LIMITE_PADRAO_PCT, pctDesconto, precisaAprovacao, textoPedidoAprovacao, menuAprovacao, lerBotaoDesconto } from '@/lib/assistente/desconto';
import { listarGestao } from './assistente-gestao.service';

// Aprovação de desconto pelo celular (ideia 23): pedido vai por WhatsApp para a
// gestão (menos quem pediu); a resposta por botão grava na proposta e avisa quem pediu.

const CHAVE_LIMITE = 'assistente.desconto_limite_pct';

export async function obterLimiteDesconto(prisma: PrismaClient): Promise<number> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_LIMITE } }).catch(() => null);
  if (!r) return LIMITE_PADRAO_PCT;
  const n = Number(r.valor);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : LIMITE_PADRAO_PCT;
}

export async function salvarLimiteDesconto(prisma: PrismaClient, pct: number, por: string) {
  await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE_LIMITE }, create: { chave: CHAVE_LIMITE, valor: String(pct), updated_by: por }, update: { valor: String(pct), updated_by: por } });
}

const SELECT = {
  id: true, desconto: true, valor_implantacao: true, valor_conversao: true, valor_final: true, plano_selecionado: true,
  nome_fantasia: true, razao_social: true, desconto_aprov_status: true, desconto_aprov_pct: true, desconto_aprov_pedido_por: true,
} as const;

/** Situação do desconto da proposta (para a tela). */
export async function situacaoDesconto(prisma: PrismaClient, propostaId: string) {
  const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: SELECT });
  if (!p) return null;
  const limite = await obterLimiteDesconto(prisma);
  return { pct: pctDesconto(p), limite, precisa: precisaAprovacao(p, limite), status: p.desconto_aprov_status };
}

export async function pedirAprovacaoDesconto(prisma: PrismaClient, propostaId: string, user: { id: string; nome?: string }) {
  const p = await prisma.propostaComercial.findUnique({ where: { id: propostaId }, select: SELECT });
  if (!p) throw new Error('Proposta não encontrada.');
  const limite = await obterLimiteDesconto(prisma);
  if (!precisaAprovacao(p, limite)) throw new Error('Este desconto não precisa de aprovação.');
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('WhatsApp da empresa não está conectado.');
  const gestao = await listarGestao(prisma);
  const aprovadores = gestao.filter(g => g.id !== user.id);
  const destino = aprovadores.length ? aprovadores : gestao;
  if (!destino.length) throw new Error('Nenhuma pessoa da gestão com telefone cadastrado para aprovar.');

  await prisma.propostaComercial.update({ where: { id: p.id }, data: { desconto_aprov_status: 'PENDENTE', desconto_aprov_pedido_por: user.id, desconto_aprov_pct: null, desconto_aprov_por: null, desconto_aprov_em: null } });
  const nome = (p.nome_fantasia || p.razao_social || 'Cliente').trim();
  const menu = menuAprovacao(p.id, textoPedidoAprovacao({ ...p, nome, plano: p.plano_selecionado }, (user.nome || 'A vendedora').split(' ')[0], limite));
  for (const g of destino) await evo.enviarMenu(inst.instance_token, g.telefone!, menu).catch((e: any) => console.error('[DESCONTO] envio:', e?.message));
  await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'STATUS', campo_alterado: 'desconto', valor_novo: `Pedido de aprovação de desconto (${pctDesconto(p)}%)`, feito_por_id: user.id, feito_por_nome: user.nome || null } }).catch(() => {});
  return { enviado_para: destino.map(d => d.nome.split(' ')[0]) };
}

/** Botão Aprovar/Recusar de um número da gestão. true = consumido. */
export async function responderAprovacaoDesconto(prisma: PrismaClient, token: string, numero: string, botaoId: string | null | undefined): Promise<boolean> {
  const b = lerBotaoDesconto(botaoId);
  if (!b) return false;
  const gestao = await listarGestao(prisma);
  const gestor = acharGestor(numero, gestao);
  if (!gestor) return false;
  const p = await prisma.propostaComercial.findUnique({ where: { id: b.id }, select: SELECT });
  const enviar = (t: string) => evo.enviarTexto(token, numero, t).catch(() => {});
  if (!p) { await enviar('Não achei essa proposta.'); return true; }
  if (p.desconto_aprov_status !== 'PENDENTE') { await enviar(`Essa proposta já foi ${p.desconto_aprov_status === 'APROVADO' ? 'aprovada' : 'recusada'}.`); return true; }

  const pct = pctDesconto(p);
  await prisma.propostaComercial.update({
    where: { id: p.id },
    data: { desconto_aprov_status: b.aprovado ? 'APROVADO' : 'RECUSADO', desconto_aprov_pct: b.aprovado ? pct : null, desconto_aprov_por: gestor.id, desconto_aprov_em: new Date() },
  });
  const nome = (p.nome_fantasia || p.razao_social || 'Cliente').trim();
  const decisao = b.aprovado ? 'aprovado ✅' : 'recusado ❌';
  await prisma.propostaHistorico.create({ data: { proposta_id: p.id, tipo: 'STATUS', campo_alterado: 'desconto', valor_novo: `Desconto de ${pct}% ${b.aprovado ? 'aprovado' : 'recusado'} por ${gestor.nome}`, feito_por_id: gestor.id, feito_por_nome: gestor.nome } }).catch(() => {});
  await enviar(`Desconto de ${pct.toLocaleString('pt-BR')}% para ${nome} ${decisao}.`);
  // Avisa quem pediu (se for da gestão e não for quem respondeu).
  const pediu = gestao.find(g => g.id === p.desconto_aprov_pedido_por);
  if (pediu && pediu.id !== gestor.id) {
    await evo.enviarTexto(token, pediu.telefone!, `💸 ${gestor.nome.split(' ')[0]} ${b.aprovado ? 'aprovou' : 'recusou'} o desconto de ${pct.toLocaleString('pt-BR')}% para *${nome}*.${b.aprovado ? ' Já pode enviar a proposta.' : ''}`).catch(() => {});
  }
  return true;
}
