import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('GET /leads/previsao usa a mesma fórmula de valorOportunidade que /dashboard/forecast', () => {
  it('um lead com valor_setup e mensalidade_estimada preenchidos usa setup + mensalidade×12, não valor_estimado puro', async () => {
    // Cria um lead de teste com valor_setup=1000, mensalidade_estimada=300,
    // valor_estimado=99999 (valor absurdo só pra provar que NÃO deve ser usado
    // quando setup+mensalidade está preenchido).
    const lead = await prisma.lead.create({
      data: {
        nome: 'TESTE_FORMULA_FORECAST',
        etapa_comercial: 'EM_NEGOCIACAO', // prob 0.65
        status: 'EM_ANDAMENTO',
        valor_setup: 1000,
        mensalidade_estimada: 300,
        valor_estimado: 99999,
        responsavel_id: null,
        created_by: 'teste-automatizado',
      },
    });

    try {
      // valorOportunidade esperado: 1000 + (300*12) = 4600
      // ponderado esperado: 4600 * 0.65 = 2990
      const valorEsperado = 1000 + 300 * 12;
      const ponderadoEsperado = Math.round(valorEsperado * 0.65);

      // Chama a lógica diretamente (sem subir servidor HTTP) importando a função
      // exportada — ver Step 3 para a extração da função testável.
      const { calcularPrevisao } = await import('../src/lib/previsao');
      const resultado = await calcularPrevisao(prisma, { dias: 30, ownerFilter: {} });

      const leadNoResultado = resultado.top_oportunidades.find(o => o.id === lead.id);
      expect(leadNoResultado).toBeDefined();
      expect(leadNoResultado!.valor_ponderado).toBe(ponderadoEsperado);
      // Prova que NÃO usou valor_estimado (99999 * 0.65 = 64999, bem diferente)
      expect(leadNoResultado!.valor_ponderado).not.toBe(Math.round(99999 * 0.65));
    } finally {
      await prisma.lead.delete({ where: { id: lead.id } });
    }
  }, 30000);
});
