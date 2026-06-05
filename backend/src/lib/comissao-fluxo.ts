import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Fluxo de comissão atrelado à implantação:
 *
 *  - Contrato ASSINADO  → cria Implantacao (AGUARDANDO_INSTALACAO) e a comissão do
 *    VENDEDOR em estágio A_RECEBER (expectativa, sem mês de pagamento).
 *  - Supervisão informa data de instalação + 1º vencimento → implantação INSTALADO,
 *    mês de pagamento da comissão = (mês do 1º vencimento + 1). As comissões vão para
 *    CONFIRMADA com esse mês. Antes de informar o 1º vencimento, ficam A_CONFIRMAR.
 *
 * A META só conta contrato ASSINADO (ver meta-progress). A comissão da SUPERVISÃO
 * (5% do faturamento do setor) é calculada à parte por período; aqui materializamos
 * a parcela por contrato para entrar no relatório financeiro com o mês de pagamento.
 */

export const PCT_VENDEDOR = 15;    // 15% sobre o setup
export const PCT_SUPERVISAO = 5;   // 5% sobre o setup (faturamento do setor)

// "YYYY-MM" do mês seguinte ao 1º vencimento.
export function mesPagamentoDoVencimento(primeiroVencimento: Date): string {
  const d = new Date(primeiroVencimento);
  const ano = d.getFullYear();
  const mes = d.getMonth() + 1; // 1-12 do vencimento
  const alvo = new Date(ano, mes, 1); // +1 mês
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`;
}

function competencia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Cria a Implantacao e as comissões (vendedor + supervisão) ao assinar o contrato.
export async function criarImplantacaoEComissoes(prisma: PrismaClient, contratoId: string) {
  const c = await prisma.contratoComercial.findUnique({ where: { id: contratoId } });
  if (!c) return;

  const jaTem = await prisma.implantacao.findUnique({ where: { contrato_id: contratoId } }).catch(() => null);
  const setup = Number(c.valor_setup_total || 0);
  const comp = competencia(c.signed_at || new Date());

  if (!jaTem) {
    // Da proposta: data de entrada (trilha) e tipo da base (banco zerado x conversão).
    let dataEntrada: Date | undefined;
    let tipoBase: string | undefined;
    let sistemaAnterior: string | undefined;
    if (c.proposta_comercial_id) {
      const p = await prisma.propostaComercial.findUnique({
        where: { id: c.proposta_comercial_id },
        select: { created_at: true, cnpj: true, tipo_loja: true, sistema_atual: true },
      }).catch(() => null);
      if (p?.created_at) dataEntrada = p.created_at;
      // tipo_loja: "Migração"/"Upgrade" + sistema_atual → CONVERSÃO; senão → banco zerado.
      const tl = String(p?.tipo_loja || '').toLowerCase();
      const ehConversao = (!!p?.sistema_atual && p.sistema_atual.trim() !== '')
        || tl.includes('migra') || tl.includes('convers') || tl.includes('upgrade');
      tipoBase = ehConversao ? 'CONVERSAO' : 'BANCO_ZERADO';
      if (ehConversao) sistemaAnterior = p?.sistema_atual || undefined;
    }

    await prisma.implantacao.create({
      data: {
        contrato_id: c.id,
        proposta_id: c.proposta_comercial_id || undefined,
        cliente_razao_social: c.razao_social,
        cliente_cnpj: c.cnpj || undefined,
        plano: c.plano_contratado || undefined,
        vendedor_id: (c as any).vendedor_id || undefined,
        vendedor_nome: c.vendedor_nome || undefined,
        valor_setup: setup,
        mensalidade: c.mensalidade || undefined,
        status: 'AGUARDANDO_INSTALACAO',
        data_assinatura: c.signed_at || new Date(),
        data_entrada_lead: dataEntrada,
        tipo_base: tipoBase,
        sistema_anterior: sistemaAnterior,
      },
    }).catch(() => {});
  }

  // Comissões A_RECEBER (uma do vendedor, uma da supervisão) — idempotente por contrato+papel.
  const vendId = (c as any).vendedor_id || c.created_by;
  await upsertComissaoContrato(prisma, {
    contratoId, responsavelId: vendId, papel: 'VENDEDOR', pct: PCT_VENDEDOR, setup, periodo: comp,
    descricao: `Comissão venda · Contrato ${c.numero_contrato} · ${c.razao_social}`,
  });

  // Supervisão: cada SUPERVISAO_COMERCIAL ativo recebe 5% (cheios) do setup deste contrato.
  const sups: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM UsuarioCRM WHERE cargo = 'SUPERVISAO_COMERCIAL' AND status = 'ATIVO'`
  ).catch(() => []);
  for (const s of sups) {
    await upsertComissaoContrato(prisma, {
      contratoId, responsavelId: s.id, papel: 'SUPERVISAO', pct: PCT_SUPERVISAO, setup, periodo: comp,
      descricao: `Comissão supervisão · Contrato ${c.numero_contrato} · ${c.razao_social}`,
    });
  }
}

async function upsertComissaoContrato(prisma: PrismaClient, p: {
  contratoId: string; responsavelId: string; papel: string; pct: number; setup: number; periodo: string; descricao: string;
}) {
  const valor = Math.round(p.setup * (p.pct / 100) * 100) / 100;
  const existente = await prisma.comissao.findFirst({
    where: { referencia_id: p.contratoId, tipo: 'CONTRATO', papel: p.papel, responsavel_id: p.responsavelId },
    select: { id: true },
  }).catch(() => null);
  if (existente) return;
  await prisma.comissao.create({
    data: {
      id: randomUUID(),
      responsavel_id: p.responsavelId,
      tipo: 'CONTRATO',
      referencia_id: p.contratoId,
      descricao: p.descricao,
      valor_base: p.setup,
      percentual: p.pct,
      valor_comissao: valor,
      periodo: p.periodo,
      status: 'PENDENTE',
      estagio: 'A_RECEBER',
      papel: p.papel,
    } as any,
  }).catch(() => {});
}

// Ao informar instalação + 1º vencimento: define o mês de pagamento e move as comissões.
export async function confirmarImplantacao(
  prisma: PrismaClient,
  implantacaoId: string,
  dados: { data_instalacao?: Date | null; data_primeiro_vencimento?: Date | null; status?: string; data_agendada?: Date | null; observacoes?: string },
) {
  const imp = await prisma.implantacao.findUnique({ where: { id: implantacaoId } });
  if (!imp) return null;

  const data_instalacao = dados.data_instalacao ?? imp.data_instalacao;
  const data_primeiro_vencimento = dados.data_primeiro_vencimento ?? imp.data_primeiro_vencimento;
  const mesPag = data_primeiro_vencimento ? mesPagamentoDoVencimento(new Date(data_primeiro_vencimento)) : null;

  let status = dados.status ?? imp.status;
  if (data_instalacao && status === 'AGUARDANDO_INSTALACAO') status = 'INSTALADO';

  const atualizada = await prisma.implantacao.update({
    where: { id: implantacaoId },
    data: {
      data_instalacao: data_instalacao ?? undefined,
      data_primeiro_vencimento: data_primeiro_vencimento ?? undefined,
      data_agendada: dados.data_agendada ?? undefined,
      mes_pagamento_comissao: mesPag ?? undefined,
      status,
      observacoes: dados.observacoes ?? imp.observacoes ?? undefined,
    },
  });

  // Move as comissões do contrato conforme o que já se sabe.
  const comissoes = await prisma.comissao.findMany({
    where: { referencia_id: imp.contrato_id, tipo: 'CONTRATO' },
    select: { id: true, estagio: true },
  });
  for (const cm of comissoes) {
    if (mesPag) {
      // 1º vencimento informado → CONFIRMADA com mês de pagamento.
      await prisma.comissao.update({
        where: { id: cm.id },
        data: { estagio: 'CONFIRMADA', mes_pagamento: mesPag, status: 'APROVADA', implantacao_id: imp.id } as any,
      }).catch(() => {});
    } else if (data_instalacao) {
      // instalado mas sem 1º vencimento → A_CONFIRMAR.
      await prisma.comissao.update({
        where: { id: cm.id },
        data: { estagio: 'A_CONFIRMAR', implantacao_id: imp.id } as any,
      }).catch(() => {});
    }
  }

  return atualizada;
}
