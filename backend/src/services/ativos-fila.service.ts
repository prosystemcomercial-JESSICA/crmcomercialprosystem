import type { PrismaClient } from '@prisma/client';
import { filaDoDia, META_DIA_ATIVOS } from '@/lib/ativos-fila';
import { inicioDoDia } from '@/lib/placar-comercial';

// Programa de Ativos (parte 3 do plano, 14/10/2026): a fila de hoje de cada vendedor, 8 contatos, com o que já fez.
// vendedorId null = gestão (todos os vendedores com fila ativa).
export async function filaDoDiaAtivos(prisma: PrismaClient, vendedorId: string | null, agora = new Date()) {
  const contatos = await prisma.contatoAtivo.findMany({
    where: { campanha: { status: 'ATIVA' }, ...(vendedorId ? { vendedor_id: vendedorId } : {}) },
    select: { id: true, campanha_id: true, cliente_id: true, cliente_nome: true, cliente_codigo: true, vendedor_id: true, etapa: true, oculto: true, tem_problema: true, saude: true, contatado_em: true, tentativas: true },
  });
  const campanhas = await prisma.campanhaAtivo.findMany({ where: { status: 'ATIVA', ...(vendedorId ? { vendedor_id: vendedorId } : {}) }, select: { vendedor_id: true, vendedor_nome: true } });
  const hoje = inicioDoDia(agora);
  const porVendedor = new Map<string, typeof contatos>();
  for (const c of contatos) porVendedor.set(c.vendedor_id, [...(porVendedor.get(c.vendedor_id) || []), c]);
  const vendedores = [...new Map(campanhas.map(c => [c.vendedor_id, (c.vendedor_nome || '').trim() || 'Vendedor'])).entries()];
  return {
    meta_dia: META_DIA_ATIVOS,
    vendedores: vendedores.map(([id, nome]) => {
      const dele = porVendedor.get(id) || [];
      const feitos = dele.filter(c => c.contatado_em && c.contatado_em >= hoje).length;
      return { vendedor_id: id, vendedor_nome: nome, feitos_hoje: feitos, faltam_hoje: Math.max(0, META_DIA_ATIVOS - feitos), fila: filaDoDia(dele, agora, Math.max(0, META_DIA_ATIVOS - feitos)) };
    }),
  };
}

/** Contatos de ativos feitos no período (para o placar). */
export async function ativosContatados(prisma: PrismaClient, ini: Date, fim: Date) {
  return prisma.contatoAtivo.count({ where: { contatado_em: { gte: ini, lt: fim } } });
}

/** Meta de contatos de ativos por dia: 8 por vendedor com fila ativa. */
export async function metaDiaAtivos(prisma: PrismaClient) {
  const vs = await prisma.campanhaAtivo.findMany({ where: { status: 'ATIVA' }, select: { vendedor_id: true }, distinct: ['vendedor_id'] });
  return vs.length * META_DIA_ATIVOS;
}
