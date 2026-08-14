import { describe, it, expect } from 'vitest';
import { calcularDesempenhoSdr } from '@/lib/sdr-desempenho';

// Verifica que calcularDesempenhoSdr (extraída de sdr.ts na Task 8) produz exatamente
// a mesma forma/valores que a lógica inline original de GET /sdr/desempenho (Task 7),
// usando um Prisma mockado com contagens determinísticas.
function mockPrisma(overrides: Partial<{
  leadsCadastrados: number; leadsQualificados: number; vendasOriginadas: number;
  tentativas: number; contatosEfetivos: number; reunioesAgendadas: number; reunioesRealizadas: number;
  distribuidos: number;
}> = {}) {
  const v = {
    leadsCadastrados: 20, leadsQualificados: 8, vendasOriginadas: 3,
    tentativas: 100, contatosEfetivos: 40, reunioesAgendadas: 12, reunioesRealizadas: 9,
    distribuidos: 5,
    ...overrides,
  };
  return {
    lead: {
      count: async ({ where }: any) => {
        if (where.etapa_comercial === 'QUALIFICADO') return v.leadsQualificados;
        if (where.etapa_comercial?.in) return v.vendasOriginadas;
        return v.leadsCadastrados;
      },
    },
    atividade: {
      count: async ({ where }: any) => {
        if (where.tipo === 'REUNIAO' && where.status === 'REALIZADA') return v.reunioesRealizadas;
        if (where.tipo === 'REUNIAO') return v.reunioesAgendadas;
        if (where.status === 'REALIZADA') return v.contatosEfetivos;
        return v.tentativas;
      },
    },
    $queryRawUnsafe: async (_sql: string, ..._args: any[]) => [{ c: v.distribuidos }],
  } as any;
}

describe('calcularDesempenhoSdr', () => {
  it('retorna o mesmo formato/campos usados por GET /sdr/desempenho (funil + taxas)', async () => {
    const prisma = mockPrisma();
    const dataInicio = new Date('2026-01-01');
    const dataFim = new Date('2026-01-31');
    const r = await calcularDesempenhoSdr(prisma, 'sdr-1', dataInicio, dataFim);

    expect(r.periodo).toEqual({ data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() });
    expect(r.funil).toEqual({
      leads_cadastrados: 20,
      tentativas_contato: 100,
      contatos_efetivos: 40,
      leads_qualificados: 8,
      reunioes_agendadas: 12,
      reunioes_realizadas: 9,
      leads_distribuidos: 5,
      vendas_originadas: 3,
    });
    // taxas replicam exatamente pct(a,b) = round(a/b*1000)/10 da lógica original
    expect(r.taxas.taxa_contato).toBe(40); // 40/100
    expect(r.taxas.taxa_qualificacao).toBe(40); // 8/20
    expect(r.taxas.taxa_comparecimento).toBe(75); // 9/12
    expect(r.taxas.conversao_distribuido_venda).toBe(60); // 3/5
  });

  it('taxas ficam 0 quando o denominador é zero (sem divisão por zero)', async () => {
    const prisma = mockPrisma({ tentativas: 0, leadsCadastrados: 0, reunioesAgendadas: 0, distribuidos: 0 });
    const r = await calcularDesempenhoSdr(prisma, null, new Date('2026-01-01'), new Date('2026-01-31'));
    expect(r.taxas.taxa_contato).toBe(0);
    expect(r.taxas.taxa_qualificacao).toBe(0);
    expect(r.taxas.taxa_comparecimento).toBe(0);
    expect(r.taxas.conversao_distribuido_venda).toBe(0);
  });

  it('sdrId=null (agregado geral) não quebra e usa a query sem filtro por SDR', async () => {
    const prisma = mockPrisma();
    const r = await calcularDesempenhoSdr(prisma, null, new Date('2026-01-01'), new Date('2026-01-31'));
    expect(r.funil.leads_distribuidos).toBe(5);
    expect(r.funil.leads_cadastrados).toBe(20);
  });
});
