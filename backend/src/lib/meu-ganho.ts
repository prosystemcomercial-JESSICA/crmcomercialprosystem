/**
 * "Meu ganho no mês" — soma TUDO que o usuário logado recebe num mês, separado
 * por origem. Para quem acumula papéis (ex.: Jessica = vendedora + supervisora),
 * as comissões de VENDEDOR (15%) e SUPERVISAO (5%) do mesmo contrato aparecem
 * separadas e somadas no total, junto dos bônus de cada papel.
 *
 * Mês de referência de uma comissão = mes_pagamento (quando definido) senão periodo.
 * Comissões CANCELADAS não entram.
 */

export interface ComissaoParaGanho {
  papel?: string | null;
  tipo?: string | null;
  status?: string | null;
  valor_comissao: number;
  periodo?: string | null;
  mes_pagamento?: string | null;
}

export interface GanhoMes {
  mes: string;
  vendedor: number;          // comissão de venda (15%)
  supervisao: number;        // comissão de supervisão (5%)
  bonus_vendedor: number;    // bônus trimestral de vendedor
  bonus_supervisao: number;  // bônus trimestral da supervisão
  total: number;
  quantidade: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function mesDaComissao(c: ComissaoParaGanho): string | null {
  return c.mes_pagamento || c.periodo || null;
}

export function somarGanhoMes(comissoes: ComissaoParaGanho[], mes: string): GanhoMes {
  const g: GanhoMes = { mes, vendedor: 0, supervisao: 0, bonus_vendedor: 0, bonus_supervisao: 0, total: 0, quantidade: 0 };
  for (const c of comissoes) {
    if (String(c.status || '').toUpperCase() === 'CANCELADA') continue;
    if (mesDaComissao(c) !== mes) continue;
    const valor = Number(c.valor_comissao || 0);
    const ehSupervisao = c.papel === 'SUPERVISAO' || c.tipo === 'SUPERVISAO_VENDA_ADICIONAL';
    const ehBonus = c.tipo === 'BONUS';
    if (ehBonus && ehSupervisao) g.bonus_supervisao += valor;
    else if (ehBonus) g.bonus_vendedor += valor;
    else if (ehSupervisao) g.supervisao += valor;
    else g.vendedor += valor;
    g.quantidade += 1;
  }
  g.vendedor = r2(g.vendedor);
  g.supervisao = r2(g.supervisao);
  g.bonus_vendedor = r2(g.bonus_vendedor);
  g.bonus_supervisao = r2(g.bonus_supervisao);
  g.total = r2(g.vendedor + g.supervisao + g.bonus_vendedor + g.bonus_supervisao);
  return g;
}

export function mesAtual(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
