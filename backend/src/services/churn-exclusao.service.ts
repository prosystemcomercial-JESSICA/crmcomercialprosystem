import { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { CasoChurnService } from './caso-churn.service';
import {
  STATUS_LISTA_EXCLUSAO, statusAposConfirmacao, etapasDoCancelamento, chaveExclusao, lerRegistro, situacaoExclusao, textoAvisoCeo,
  type RegistroExclusao, type ItemAviso, type CanalExclusao,
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
    where: { status: { in: STATUS_LISTA_EXCLUSAO } },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, status: true, motivo_principal: true, descricao: true, fin_valor_atraso: true, fin_situacao: true, fin_observacao: true, created_at: true, updated_at: true, resolvido_em: true,
      cliente: { select: { id: true, codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true, cnpj: true, cidade: true, estado: true, grupo_tecnico: true, mensalidade_base: true, mrr_perdido: true, valor_devido_inativacao: true, inativado_em: true } },
    },
  });
  const regs = await lerRegistros(prisma, casos.map(c => c.id));
  return casos.map(c => {
    const r = regs.get(c.id) || null;
    return {
      id: c.id, status: c.status, motivo: c.motivo_principal || c.descricao || null,
      relato: c.descricao || null, fin_situacao: c.fin_situacao || null, fin_observacao: c.fin_observacao || null,
      perdido_em: c.resolvido_em || c.cliente?.inativado_em || c.updated_at,
      cliente: {
        id: c.cliente.id, codigo: c.cliente.codigo, nome: nomeCliente(c.cliente), razao_social: c.cliente.razao_social, cnpj: c.cliente.cnpj,
        cidade: [c.cliente.cidade, c.cliente.estado].filter(Boolean).join('/') || null,
        grupo_tecnico: c.cliente.grupo_tecnico, mensalidade: c.cliente.mrr_perdido ?? c.cliente.mensalidade_base ?? null,
        valor_devido: c.fin_valor_atraso ?? c.cliente.valor_devido_inativacao ?? null,
      },
      situacao: situacaoExclusao(r), registro: r,
    };
  });
}

/**
 * Envia os casos selecionados ao CEO. canal "whatsapp": lista no WhatsApp e push. canal "pdf" (15/10/2026: a conversa
 * interna é no Teams): só registra o envio; o relatório sai por relatorioExclusaoPdf e a Jessica posta no Teams.
 */
export async function enviarAoCeo(prisma: PrismaClient, ids: string[], observacao: string | null, user: Usuario, canal: CanalExclusao = 'whatsapp') {
  const unicos = [...new Set(ids)].slice(0, 100);
  const lista = (await listarExclusao(prisma)).filter(c => unicos.includes(c.id));
  if (!lista.length) throw Object.assign(new Error('Nenhum caso perdido selecionado.'), { name: 'BadRequestError' });
  const service = new CasoChurnService(prisma);
  const agora = new Date().toISOString();
  for (const c of lista) {
    // Mesmo fluxo do Kanban: status, evento na ficha do cliente e linha do tempo do caso.
    if (c.status !== 'AGUARDANDO_EXCLUSAO' && c.status !== 'FINALIZADO') await service.update(c.id, { status: 'AGUARDANDO_EXCLUSAO' } as any, user.id);
    // Reenvio mantém o que o CEO já marcou.
    const ant = c.registro;
    await salvarRegistro(prisma, c.id, {
      enviado_em: agora, enviado_por: user.id, enviado_por_nome: user.nome, observacao: observacao || null, canal,
      suporte_em: ant?.suporte_em || null, suporte_por_nome: ant?.suporte_por_nome || null,
      cobranca_em: ant?.cobranca_em || null, cobranca_por_nome: ant?.cobranca_por_nome || null,
    }, user.id);
    await (prisma as any).atualizacaoCaso.create({
      data: { caso_churn_id: c.id, tipo: 'SISTEMA', texto: `📤 ${ant ? 'Reenviado' : 'Enviado'} ao CEO ${canal === 'pdf' ? 'por relatório em PDF (Teams)' : 'por WhatsApp'} para retirar do suporte e suspender as cobranças${observacao ? `. Obs.: ${observacao}` : ''}`, feito_por: user.id, feito_por_nome: user.nome },
    }).catch(() => {});
  }
  if (canal === 'pdf') return { enviados: lista.length, avisados: [] as string[] };
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
  // Finalizado é definitivo (pedido da Jessica, 26/10/2026): as confirmações não podem mais ser desmarcadas.
  const atual = await prisma.casoChurn.findUnique({ where: { id: casoId }, select: { status: true } });
  if (atual?.status === 'FINALIZADO') throw Object.assign(new Error('Caso finalizado: as confirmações não podem mais ser mudadas.'), { name: 'BadRequestError' });
  const antes = situacaoExclusao(r);
  const agora = new Date().toISOString();
  const novo: RegistroExclusao = campo === 'suporte'
    ? { ...r, suporte_em: feito ? (r.suporte_em || agora) : null, suporte_por_nome: feito ? (r.suporte_por_nome || user.nome) : null }
    : { ...r, cobranca_em: feito ? (r.cobranca_em || agora) : null, cobranca_por_nome: feito ? (r.cobranca_por_nome || user.nome) : null };
  await salvarRegistro(prisma, casoId, novo, user.id);
  const caso = await prisma.casoChurn.findUnique({ where: { id: casoId }, select: { status: true, clienteId: true, cliente: { select: { codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true } } } });
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
    if (r.canal !== 'pdf' && quem?.telefone && inst?.instance_token) await evo.enviarTexto(inst.instance_token, quem.telefone, txt).catch((e: any) => console.error('[CHURN→CEO] confirmação:', e?.message));
    const { enviarPush } = await import('./push.service');
    await enviarPush(prisma, [r.enviado_por], { titulo: 'Churn concluído', corpo: txt.replace(/\*/g, '').slice(0, 180), url: '/casos?aba=exclusao', tag: 'churn_exclusao' }).catch(() => 0);
  }
  // Os dois feitos: caso FINALIZADO (concluído de vez).
  // Mesmo fluxo do Kanban (evento na ficha do cliente e linha do tempo do caso).
  let status = caso?.status || null;
  const proximo = status ? statusAposConfirmacao(situacaoExclusao(novo), status) : null;
  if (proximo) {
    await new CasoChurnService(prisma).update(casoId, { status: proximo } as any, user.id);
    status = proximo;
  }
  return { situacao: situacaoExclusao(novo), registro: novo, status };
}

/**
 * Trilha completa do cancelamento (aba Exclusões › Concluídos, pedido da Jessica, 26/10/2026): dados do cliente,
 * o caso, o fluxograma das etapas e a linha do tempo (atualizações do caso + eventos da ficha do cliente). Só leitura.
 */
export async function trilhaCancelamento(prisma: PrismaClient, casoId: string) {
  const caso: any = await prisma.casoChurn.findUnique({
    where: { id: casoId },
    include: {
      cliente: { select: { id: true, codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true, cnpj: true, cidade: true, estado: true, segmento: true, plano: true, grupo_tecnico: true, responsavel_nome: true, telefone: true, telefone1: true, email: true, data_entrada: true, dia_vencimento: true, mensalidade_base: true, mrr_perdido: true, valor_devido_inativacao: true, motivo_inativacao: true, inativado_em: true, sistema_removido_em: true, situacao: true } },
      diagnosis: { select: { motivo_principal: true, created_at: true } },
      planos: { select: { titulo: true, descricao: true, status: true, created_at: true }, orderBy: { created_at: 'asc' } },
      acoes: { select: { titulo: true, descricao: true, tipo: true, status: true, created_at: true }, orderBy: { created_at: 'asc' } },
    } as any,
  });
  if (!caso) throw Object.assign(new Error('Caso não encontrado.'), { name: 'BadRequestError' });
  const [registro, atualizacoes, eventos] = await Promise.all([
    lerRegistros(prisma, [casoId]).then(m => m.get(casoId) || null),
    (prisma as any).atualizacaoCaso.findMany({ where: { caso_churn_id: casoId }, orderBy: { created_at: 'asc' }, select: { tipo: true, texto: true, canal: true, resultado: true, feito_por_nome: true, created_at: true } }).catch(() => []),
    (prisma as any).eventoCliente.findMany({ where: { cliente_id: caso.clienteId }, orderBy: { created_at: 'asc' }, select: { tipo: true, titulo: true, descricao: true, feito_por_nome: true, created_at: true } }).catch(() => []),
  ]);
  const c = caso.cliente;
  const linhaDoTempo = [
    ...atualizacoes.map((a: any) => ({ origem: 'CASO', tipo: a.tipo, titulo: a.texto, detalhe: [a.canal, a.resultado].filter(Boolean).join(' · ') || null, por: a.feito_por_nome || null, em: a.created_at })),
    ...eventos.map((e: any) => ({ origem: 'CLIENTE', tipo: e.tipo, titulo: e.titulo, detalhe: e.descricao || null, por: e.feito_por_nome || null, em: e.created_at })),
  ].sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
  return {
    caso: {
      id: caso.id, status: caso.status, motivo: caso.motivo_principal || null, relato: caso.descricao || null,
      aberto_em: caso.data_abertura_real || caso.created_at, perdido_em: caso.resolvido_em || c.inativado_em || null, sistema_removido_em: caso.sistema_removido_em || null,
      fin_situacao: caso.fin_situacao || null, fin_valor_atraso: caso.fin_valor_atraso ?? null, fin_dias_atraso: caso.fin_dias_atraso ?? null, fin_observacao: caso.fin_observacao || null,
      reneg_ativa: !!caso.reneg_ativa, reneg_resultado: caso.reneg_resultado || null, reaberto: !!caso.reaberto,
      diagnostico: caso.diagnosis?.motivo_principal || null, planos: caso.planos || [], acoes: caso.acoes || [],
    },
    cliente: {
      id: c.id, codigo: c.codigo, nome: nomeCliente(c), razao_social: c.razao_social, cnpj: c.cnpj, cidade: [c.cidade, c.estado].filter(Boolean).join('/') || null,
      segmento: c.segmento, plano: c.plano, grupo_tecnico: c.grupo_tecnico, responsavel: c.responsavel_nome, telefone: c.telefone1 || c.telefone || null, email: c.email,
      cliente_desde: c.data_entrada, dia_vencimento: c.dia_vencimento, mensalidade: c.mrr_perdido ?? c.mensalidade_base ?? null,
      valor_devido: caso.fin_valor_atraso ?? c.valor_devido_inativacao ?? null, motivo_inativacao: c.motivo_inativacao, inativado_em: c.inativado_em,
    },
    registro,
    etapas: etapasDoCancelamento(caso, c.inativado_em, registro),
    linha_do_tempo: linhaDoTempo,
  };
}

/** Relatório em PDF (identidade Prosystem) dos casos selecionados, com as observações de cada um. Não muda nada no CRM. */
export async function relatorioExclusaoPdf(prisma: PrismaClient, ids: string[], observacao: string | null, user: Usuario) {
  const unicos = [...new Set(ids)].slice(0, 100);
  const lista = (await listarExclusao(prisma)).filter(c => unicos.includes(c.id));
  if (!lista.length) throw Object.assign(new Error('Nenhum caso perdido selecionado.'), { name: 'BadRequestError' });
  const atts = await (prisma as any).atualizacaoCaso.findMany({
    where: { caso_churn_id: { in: lista.map(c => c.id) }, tipo: { in: ['OBSERVACAO', 'CONTATO', 'TENTATIVA', 'FINANCEIRO'] } },
    orderBy: { created_at: 'desc' }, select: { caso_churn_id: true, texto: true, feito_por_nome: true, created_at: true },
  }).catch(() => [] as any[]);
  const ceo = (await ceos(prisma))[0];
  const { gerarRelatorioExclusaoPdf } = await import('@/lib/churn-exclusao-pdf');
  return gerarRelatorioExclusaoPdf({
    enviado_por: user.nome, para: ceo ? `${ceo.nome} (CEO)` : null, observacao, link: LINK,
    clientes: lista.map(c => ({
      codigo: c.cliente.codigo, nome: c.cliente.nome, razao_social: c.cliente.razao_social, cnpj: c.cliente.cnpj, cidade: c.cliente.cidade,
      grupo_tecnico: c.cliente.grupo_tecnico, status: c.status, perdido_em: c.perdido_em, mensalidade: c.cliente.mensalidade, valor_devido: c.cliente.valor_devido,
      motivo: c.motivo, relato: c.relato, fin_situacao: c.fin_situacao, fin_observacao: c.fin_observacao,
      observacao_envio: c.registro?.observacao && c.registro.observacao !== observacao ? c.registro.observacao : null,
      atualizacoes: atts.filter((a: any) => a.caso_churn_id === c.id).slice(0, 4).map((a: any) => ({ em: a.created_at, por: a.feito_por_nome, texto: a.texto })),
    })),
  });
}
