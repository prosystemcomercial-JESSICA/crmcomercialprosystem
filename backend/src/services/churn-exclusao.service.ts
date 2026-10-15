import { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { CasoChurnService } from './caso-churn.service';
import {
  STATUS_PODE_ENVIAR, chaveExclusao, lerRegistro, situacaoExclusao, textoAvisoCeo,
  type RegistroExclusao, type ItemAviso,
} from '@/lib/churn-exclusao';

/**
 * Churn → CEO (pedido da Jessica, 15/10/2026): a gestão seleciona os clientes perdidos e envia ao CEO
 * para retirar o cadastro do suporte e suspender as cobranças. O caso vai para AGUARDANDO_EXCLUSAO,
 * o CEO recebe a lista no WhatsApp (e no celular) e marca no CRM "retirado do suporte" e "cobrança suspensa".
 * Quando os dois estão marcados, quem enviou recebe a confirmação.
 */

type Usuario = { id: string; nome: string };

const LINK = 'https://comercial.prosystemnet.com/casos?aba=exclusao';

async function lerRegistros(prisma: PrismaClient, ids: string[]) {
  if (!ids.length) return new Map<string, RegistroExclusao>();
  const rs = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: ids.map(chaveExclusao) } } });
  const m = new Map<string, RegistroExclusao>();
  for (const r of rs) { const v = lerRegistro(r.valor); if (v) m.set(r.chave.replace('churn.exclusao.', ''), v); }
  return m;
}

async function salvarRegistro(prisma: PrismaClient, casoId: string, r: RegistroExclusao, por: string) {
  const valor = JSON.stringify(r);
  await prisma.configuracaoIntegracao.upsert({
    where: { chave: chaveExclusao(casoId) },
    create: { chave: chaveExclusao(casoId), valor, descricao: 'Churn: pedido ao CEO para retirar do suporte e suspender cobranças', updated_by: por },
    update: { valor, updated_by: por },
  });
}

/** CEOs ativos com WhatsApp (o usuário de teste automático fica de fora). */
async function ceos(prisma: PrismaClient) {
  const us = await prisma.usuarioCRM.findMany({ where: { status: 'ATIVO', cargo: 'CEO', telefone: { not: null } }, select: { id: true, nome: true, telefone: true } });
  return us.filter(u => !/\b(QA|E2E)\b/i.test(u.nome) && (u.telefone || '').replace(/\D/g, '').length >= 10);
}

const nomeCliente = (c: any) => (c?.nome_fantasia || c?.empresa || c?.razao_social || c?.nome || 'Cliente').trim();

/** Casos perdidos com a situação do pedido ao CEO. */
export async function listarExclusao(prisma: PrismaClient) {
  const casos = await prisma.casoChurn.findMany({
    where: { status: { in: STATUS_PODE_ENVIAR } },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, status: true, motivo_principal: true, descricao: true, fin_valor_atraso: true, created_at: true, updated_at: true, resolvido_em: true,
      cliente: { select: { id: true, codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true, cnpj: true, grupo_tecnico: true, mensalidade_base: true, mrr_perdido: true, valor_devido_inativacao: true, inativado_em: true } },
    },
  });
  const regs = await lerRegistros(prisma, casos.map(c => c.id));
  return casos.map(c => {
    const r = regs.get(c.id) || null;
    return {
      id: c.id, status: c.status, motivo: c.motivo_principal || c.descricao || null,
      perdido_em: c.resolvido_em || c.cliente?.inativado_em || c.updated_at,
      cliente: {
        id: c.cliente.id, codigo: c.cliente.codigo, nome: nomeCliente(c.cliente), razao_social: c.cliente.razao_social, cnpj: c.cliente.cnpj,
        grupo_tecnico: c.cliente.grupo_tecnico, mensalidade: c.cliente.mrr_perdido ?? c.cliente.mensalidade_base ?? null,
        valor_devido: c.fin_valor_atraso ?? c.cliente.valor_devido_inativacao ?? null,
      },
      situacao: situacaoExclusao(r), registro: r,
    };
  });
}

/** Envia os casos selecionados ao CEO. Devolve quantos foram e para quem o aviso saiu. */
export async function enviarAoCeo(prisma: PrismaClient, ids: string[], observacao: string | null, user: Usuario) {
  const unicos = [...new Set(ids)].slice(0, 100);
  const lista = (await listarExclusao(prisma)).filter(c => unicos.includes(c.id));
  if (!lista.length) throw Object.assign(new Error('Nenhum caso perdido selecionado.'), { name: 'BadRequestError' });
  const service = new CasoChurnService(prisma);
  const agora = new Date().toISOString();
  for (const c of lista) {
    // Mesmo fluxo do Kanban: status, evento na ficha do cliente e linha do tempo do caso.
    if (c.status !== 'AGUARDANDO_EXCLUSAO') await service.update(c.id, { status: 'AGUARDANDO_EXCLUSAO' } as any, user.id);
    // Reenvio mantém o que o CEO já marcou.
    const ant = c.registro;
    await salvarRegistro(prisma, c.id, {
      enviado_em: agora, enviado_por: user.id, enviado_por_nome: user.nome, observacao: observacao || null,
      suporte_em: ant?.suporte_em || null, suporte_por_nome: ant?.suporte_por_nome || null,
      cobranca_em: ant?.cobranca_em || null, cobranca_por_nome: ant?.cobranca_por_nome || null,
    }, user.id);
    await (prisma as any).atualizacaoCaso.create({
      data: { caso_churn_id: c.id, tipo: 'SISTEMA', texto: `📤 ${ant ? 'Reenviado' : 'Enviado'} ao CEO para retirar do suporte e suspender as cobranças${observacao ? `. Obs.: ${observacao}` : ''}`, feito_por: user.id, feito_por_nome: user.nome },
    }).catch(() => {});
  }
  const itens: ItemAviso[] = lista.map(c => ({ codigo: c.cliente.codigo, nome: c.cliente.nome, cnpj: c.cliente.cnpj, mensalidade: c.cliente.mensalidade, valor_devido: c.cliente.valor_devido, motivo: c.motivo }));
  const texto = textoAvisoCeo(itens, user.nome, observacao, LINK);
  const destino = await ceos(prisma);
  const avisados: string[] = [];
  const inst = await obterInstanciaEmpresa(prisma).catch(() => null);
  for (const d of destino) {
    if (inst?.instance_token && await evo.enviarTexto(inst.instance_token, d.telefone!, texto).then(() => true).catch((e: any) => { console.error('[CHURN→CEO]', d.nome, e?.message); return false; })) avisados.push(d.nome);
  }
  const { enviarPush } = await import('./push.service');
  await enviarPush(prisma, destino.map(d => d.id), { titulo: `Churn: ${lista.length} para retirar do suporte`, corpo: `${user.nome} enviou ${lista.map(c => c.cliente.nome).slice(0, 4).join(', ')}${lista.length > 4 ? '…' : ''}`, url: '/casos?aba=exclusao', tag: 'churn_exclusao' }).catch(() => 0);
  return { enviados: lista.length, avisados };
}

/** CEO (ou a gestão) marca "retirado do suporte" ou "cobrança suspensa". */
export async function marcarExclusao(prisma: PrismaClient, casoId: string, campo: 'suporte' | 'cobranca', feito: boolean, user: Usuario) {
  const r = (await lerRegistros(prisma, [casoId])).get(casoId);
  if (!r) throw Object.assign(new Error('Este caso ainda não foi enviado ao CEO.'), { name: 'BadRequestError' });
  const antes = situacaoExclusao(r);
  const agora = new Date().toISOString();
  const novo: RegistroExclusao = campo === 'suporte'
    ? { ...r, suporte_em: feito ? (r.suporte_em || agora) : null, suporte_por_nome: feito ? (r.suporte_por_nome || user.nome) : null }
    : { ...r, cobranca_em: feito ? (r.cobranca_em || agora) : null, cobranca_por_nome: feito ? (r.cobranca_por_nome || user.nome) : null };
  await salvarRegistro(prisma, casoId, novo, user.id);
  const caso = await prisma.casoChurn.findUnique({ where: { id: casoId }, select: { clienteId: true, cliente: { select: { codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true } } } });
  const oQue = campo === 'suporte' ? 'retirado do suporte' : 'cobranças suspensas';
  await (prisma as any).atualizacaoCaso.create({
    data: { caso_churn_id: casoId, tipo: 'SISTEMA', texto: feito ? `✅ ${user.nome} confirmou: ${oQue}` : `↩️ ${user.nome} desmarcou: ${oQue}`, feito_por: user.id, feito_por_nome: user.nome },
  }).catch(() => {});
  if (feito && caso?.clienteId) {
    await (prisma as any).eventoCliente.create({
      data: { cliente_id: caso.clienteId, tipo: 'DESATIVACAO', titulo: campo === 'suporte' ? '🧰 Retirado do suporte' : '💳 Cobranças suspensas', descricao: `Confirmado por ${user.nome} (pedido de churn enviado ao CEO).`, referencia_id: casoId, feito_por: user.id, feito_por_nome: user.nome },
    }).catch(() => {});
  }
  // Os dois feitos: avisa quem enviou (uma vez).
  if (antes !== 'CONCLUIDO' && situacaoExclusao(novo) === 'CONCLUIDO' && r.enviado_por !== user.id) {
    const quem = await prisma.usuarioCRM.findUnique({ where: { id: r.enviado_por }, select: { telefone: true, nome: true } }).catch(() => null);
    const inst = await obterInstanciaEmpresa(prisma).catch(() => null);
    const c = caso?.cliente;
    const txt = `✅ *Churn concluído:* ${c?.codigo ? `${c.codigo} · ` : ''}${nomeCliente(c)} foi retirado do suporte e as cobranças foram suspensas (${user.nome}).`;
    if (quem?.telefone && inst?.instance_token) await evo.enviarTexto(inst.instance_token, quem.telefone, txt).catch((e: any) => console.error('[CHURN→CEO] confirmação:', e?.message));
    const { enviarPush } = await import('./push.service');
    await enviarPush(prisma, [r.enviado_por], { titulo: 'Churn concluído', corpo: txt.replace(/\*/g, '').slice(0, 180), url: '/casos?aba=exclusao', tag: 'churn_exclusao' }).catch(() => 0);
  }
  return { situacao: situacaoExclusao(novo), registro: novo };
}
