import type { PrismaClient } from '@prisma/client';
import { enviarPush } from './push.service';
import {
  ROTULO_SITUACAO, ROTULO_RETORNO, deveAvisarRetorno, destinatariosRetorno, textoRetorno, quandoRetornoTexto,
  type SituacaoPedido, type TipoRetorno,
} from '../lib/churn-retorno';
import { STATUS_ENCERRADO } from '../lib/caso-churn-status';

// Casos de churn: etiqueta "em observação" / "pediu cancelamento" e retorno marcado com aviso
// (pedido da Jessica, 26/10/2026). Cada mudança vai para a linha do tempo do caso.

type Ator = { id: string; nome?: string };

class ErroRetorno extends Error {
  constructor(msg: string) { super(msg); this.name = 'BadRequestError'; }
}

const nomeCliente = (c: any) => c?.nome_fantasia || c?.razao_social || c?.nome || 'Cliente';

async function registrar(prisma: PrismaClient, casoId: string, tipo: string, texto: string, ator: Ator) {
  await (prisma as any).atualizacaoCaso.create({
    data: { caso_churn_id: casoId, tipo, texto, feito_por: ator.id, feito_por_nome: ator.nome || null },
  }).catch(() => {});
}

async function casoOuErro(prisma: PrismaClient, id: string) {
  const caso = await prisma.casoChurn.findUnique({ where: { id }, include: { cliente: true } });
  if (!caso) { const e = new Error('Caso não encontrado'); e.name = 'NotFoundError'; throw e; }
  return caso as any;
}

export async function definirSituacaoPedido(prisma: PrismaClient, id: string, situacao: SituacaoPedido | null, ator: Ator) {
  const caso = await casoOuErro(prisma, id);
  if ((caso.situacao_pedido || null) === situacao) return caso;
  const atualizado = await prisma.casoChurn.update({
    where: { id },
    data: { situacao_pedido: situacao, situacao_pedido_em: situacao ? new Date() : null } as any,
    include: { cliente: true },
  });
  await registrar(prisma, id, 'STATUS', situacao ? `Etiqueta: ${ROTULO_SITUACAO[situacao]}` : 'Etiqueta retirada (sem marcação)', ator);
  return atualizado;
}

export async function marcarRetorno(
  prisma: PrismaClient, id: string,
  d: { em: string; tipo: TipoRetorno; obs?: string | null; responsavel_id?: string | null }, ator: Ator,
) {
  const caso = await casoOuErro(prisma, id);
  if (STATUS_ENCERRADO.includes(caso.status)) throw new ErroRetorno('Caso encerrado: não dá para marcar retorno.');
  const em = new Date(d.em);
  if (Number.isNaN(em.getTime())) throw new ErroRetorno('Data do retorno inválida.');

  let responsavel: { id: string; nome: string } | null = null;
  if (d.responsavel_id) {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>('SELECT id, nome FROM UsuarioCRM WHERE id = ? LIMIT 1', d.responsavel_id).catch(() => []);
    if (!rows[0]) throw new ErroRetorno('Colaborador não encontrado.');
    responsavel = { id: rows[0].id, nome: rows[0].nome };
  }
  const dados = {
    retorno_em: em, retorno_tipo: d.tipo, retorno_obs: d.obs?.trim() || null,
    retorno_responsavel_id: responsavel?.id || ator.id, retorno_responsavel_nome: responsavel?.nome || ator.nome || null,
    retorno_marcado_por: ator.id, retorno_marcado_por_nome: ator.nome || null,
    retorno_avisado_em: null,
  };
  const atualizado = await prisma.casoChurn.update({ where: { id }, data: dados as any, include: { cliente: true } });
  await registrar(prisma, id, 'OBSERVACAO', `📅 ${textoRetorno(dados)}`, ator);

  // Designado para outra pessoa: ela fica sabendo na hora (e de novo quando chegar a data).
  if (dados.retorno_responsavel_id !== ator.id) {
    await enviarPush(prisma, [dados.retorno_responsavel_id], {
      titulo: `📅 ${ator.nome || 'A gestão'} te designou um retorno`,
      corpo: `${nomeCliente(caso.cliente)} · ${ROTULO_RETORNO[d.tipo]} em ${quandoRetornoTexto(em)}${dados.retorno_obs ? ` · ${dados.retorno_obs}` : ''}`.slice(0, 180),
      url: `/casos?caso=${id}`, tag: `churn-retorno-${id}`,
    }).catch(() => 0);
  }
  return atualizado;
}

const LIMPAR_RETORNO = {
  retorno_em: null, retorno_tipo: null, retorno_obs: null, retorno_responsavel_id: null, retorno_responsavel_nome: null,
  retorno_marcado_por: null, retorno_marcado_por_nome: null, retorno_avisado_em: null,
};

/** Retorno feito: registra o que aconteceu na linha do tempo e libera para marcar o próximo. */
export async function concluirRetorno(prisma: PrismaClient, id: string, texto: string | null, ator: Ator) {
  const caso = await casoOuErro(prisma, id);
  if (!caso.retorno_em) throw new ErroRetorno('Este caso não tem retorno marcado.');
  const tipo = caso.retorno_tipo === 'CONTATO' ? 'CONTATO' : 'OBSERVACAO';
  const feito = `✅ ${ROTULO_RETORNO[caso.retorno_tipo as TipoRetorno] || 'Retorno'} de ${quandoRetornoTexto(caso.retorno_em)} feito`;
  await registrar(prisma, id, tipo, texto?.trim() ? `${feito}: ${texto.trim()}` : feito, ator);
  return prisma.casoChurn.update({ where: { id }, data: { ...LIMPAR_RETORNO, updated_at: new Date() } as any, include: { cliente: true } });
}

export async function desmarcarRetorno(prisma: PrismaClient, id: string, ator: Ator) {
  const caso = await casoOuErro(prisma, id);
  if (!caso.retorno_em) return caso;
  await registrar(prisma, id, 'OBSERVACAO', `Retorno de ${quandoRetornoTexto(caso.retorno_em)} desmarcado`, ator);
  return prisma.casoChurn.update({ where: { id }, data: LIMPAR_RETORNO as any, include: { cliente: true } });
}

/** Retornos marcados (vencidos e futuros). usuarioId = só os dele (responsável ou quem marcou); null = todos. */
export async function retornosMarcados(prisma: PrismaClient, usuarioId: string | null) {
  return prisma.casoChurn.findMany({
    where: {
      retorno_em: { not: null }, status: { notIn: STATUS_ENCERRADO },
      ...(usuarioId ? { OR: [{ retorno_responsavel_id: usuarioId }, { retorno_marcado_por: usuarioId }] } : {}),
    } as any,
    include: { cliente: { select: { id: true, nome: true, nome_fantasia: true, razao_social: true, codigo: true } } },
    orderBy: { retorno_em: 'asc' } as any,
    take: 200,
  });
}

/** Rodada do agendador: avisa no celular quem tem retorno que chegou a hora. Uma vez por retorno. */
export async function avisarRetornosChurn(prisma: PrismaClient, agora = new Date()): Promise<number> {
  const vencidos: any[] = await prisma.casoChurn.findMany({
    where: { retorno_em: { lte: agora }, retorno_avisado_em: null, status: { notIn: STATUS_ENCERRADO } } as any,
    include: { cliente: { select: { nome: true, nome_fantasia: true, razao_social: true } } },
    take: 50,
  });
  let n = 0;
  for (const c of vencidos) {
    if (!deveAvisarRetorno(c, agora)) continue;
    // Marca antes de enviar: se o push falhar, o retorno continua no sino de Alertas e no card.
    await prisma.casoChurn.update({ where: { id: c.id }, data: { retorno_avisado_em: agora } as any });
    const sit = c.situacao_pedido === 'CANCELAMENTO' ? '🔴 ' : c.situacao_pedido === 'OBSERVACAO' ? '🔵 ' : '';
    await enviarPush(prisma, destinatariosRetorno(c), {
      titulo: `⏰ Hora do retorno: ${sit}${nomeCliente(c.cliente)}`.slice(0, 80),
      corpo: textoRetorno(c).slice(0, 180),
      url: `/casos?caso=${c.id}`, tag: `churn-retorno-${c.id}`,
    }).catch(() => 0);
    n++;
  }
  return n;
}
