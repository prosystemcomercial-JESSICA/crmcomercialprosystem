import { describe, it, expect, vi } from 'vitest';
import { validarPapelComissao, criarComissaoValidada, ComissaoValidationError } from '@/lib/comissao-fluxo';
import { somarGanhoMes } from '@/lib/meu-ganho';

const JESSICA = { id: 'jess', nome: 'Jessica Supervisao ', cargo: 'SUPERVISAO_COMERCIAL', vende: 1 };

describe('validarPapelComissao', () => {
  it('Supervisão Comercial com flag vende recebe VENDEDOR (15%) e SUPERVISAO (5%)', () => {
    expect(validarPapelComissao(JESSICA, 'VENDEDOR', 'jess')).toBeNull();
    expect(validarPapelComissao(JESSICA, 'SUPERVISAO', 'jess')).toBeNull();
  });
  it('Supervisão Comercial SEM flag vende não recebe comissão de venda', () => {
    expect(validarPapelComissao({ ...JESSICA, vende: 0 }, 'VENDEDOR', 'jess')).toMatch(/VENDEDOR/);
  });
  it('vendedor não recebe supervisão; CEO não recebe nenhuma', () => {
    expect(validarPapelComissao({ nome: 'Ana', cargo: 'VENDEDOR' }, 'VENDEDOR', 'a')).toBeNull();
    expect(validarPapelComissao({ nome: 'Ana', cargo: 'VENDEDOR' }, 'SUPERVISAO', 'a')).toMatch(/SUPERVISAO_COMERCIAL/);
    expect(validarPapelComissao({ nome: 'Thiago', cargo: 'CEO' }, 'VENDEDOR', 't')).not.toBeNull();
  });
  it('usuário inexistente', () => {
    expect(validarPapelComissao(null, 'VENDEDOR', 'user-jessica')).toMatch(/não existe/);
  });
});

// Fake de Prisma: só o que criarComissaoValidada usa.
function fakePrisma(usuarios: any[]) {
  const criadas: any[] = [];
  return {
    criadas,
    $queryRawUnsafe: vi.fn(async (_sql: string, id: string) => usuarios.filter(u => u.id === id)),
    comissao: { create: vi.fn(async ({ data }: any) => { criadas.push(data); return data; }) },
  } as any;
}

describe('criarComissaoValidada — mesma pessoa, dois papéis', () => {
  it('gera as DUAS linhas (15% vendedor + 5% supervisão) para o mesmo responsavel_id', async () => {
    const prisma = fakePrisma([JESSICA]);
    const base = { responsavel_id: 'jess', tipo: 'CONTRATO', referencia_id: 'ctr-1', valor_base: 1000, periodo: '2026-09' };
    await criarComissaoValidada(prisma, { ...base, papel: 'VENDEDOR', percentual: 15, valor_comissao: 150 });
    await criarComissaoValidada(prisma, { ...base, papel: 'SUPERVISAO', percentual: 5, valor_comissao: 50 });
    expect(prisma.criadas).toHaveLength(2);
    expect(prisma.criadas.map((c: any) => [c.responsavel_id, c.papel, c.percentual])).toEqual([
      ['jess', 'VENDEDOR', 15],
      ['jess', 'SUPERVISAO', 5],
    ]);
  });

  it('continua recusando conta mock antiga (fora do banco)', async () => {
    const prisma = fakePrisma([JESSICA]);
    await expect(criarComissaoValidada(prisma, {
      responsavel_id: 'user-jessica', papel: 'VENDEDOR', tipo: 'CONTRATO', valor_base: 1, percentual: 15, valor_comissao: 0.15, periodo: '2026-09',
    })).rejects.toBeInstanceOf(ComissaoValidationError);
  });
});

describe('somarGanhoMes', () => {
  const linhas = [
    { papel: 'VENDEDOR', tipo: 'CONTRATO', status: 'APROVADA', valor_comissao: 150, mes_pagamento: '2026-09', periodo: '2026-08' },
    { papel: 'SUPERVISAO', tipo: 'CONTRATO', status: 'APROVADA', valor_comissao: 50, mes_pagamento: '2026-09', periodo: '2026-08' },
    { papel: 'SUPERVISAO', tipo: 'SUPERVISAO_VENDA_ADICIONAL', status: 'PENDENTE', valor_comissao: 10, mes_pagamento: null, periodo: '2026-09' },
    { papel: 'VENDEDOR', tipo: 'BONUS', status: 'APROVADA', valor_comissao: 400, mes_pagamento: '2026-09' },
    { papel: 'SUPERVISAO', tipo: 'BONUS', status: 'APROVADA', valor_comissao: 600, mes_pagamento: '2026-09' },
    { papel: 'VENDEDOR', tipo: 'CONTRATO', status: 'CANCELADA', valor_comissao: 999, mes_pagamento: '2026-09' },
    { papel: 'VENDEDOR', tipo: 'CONTRATO', status: 'APROVADA', valor_comissao: 77, mes_pagamento: '2026-10' },
  ];
  it('separa vendedor, supervisão e bônus de cada papel e soma o total', () => {
    const g = somarGanhoMes(linhas, '2026-09');
    expect(g).toMatchObject({ vendedor: 150, supervisao: 60, bonus_vendedor: 400, bonus_supervisao: 600, total: 1210, quantidade: 5 });
  });
  it('mês sem nada → zeros', () => {
    expect(somarGanhoMes(linhas, '2025-01').total).toBe(0);
  });
});
