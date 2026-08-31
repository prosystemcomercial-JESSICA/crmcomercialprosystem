import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('GET /health-scores/ranking-tecnicos não trava quando há cliente inativo no meio da lista', () => {
  it('retorna ranking completo mesmo com um cliente INATIVA seguido de um cliente ATIVA no mesmo grupo_tecnico', async () => {
    const grupoTeste = 'Grupo Teste Automatizado';
    const clienteInativo = await prisma.cliente.create({
      data: { nome: 'TESTE_INATIVO', grupo_tecnico: grupoTeste, situacao: 'INATIVA', mrr_perdido: 100 },
    });
    const clienteAtivo = await prisma.cliente.create({
      data: { nome: 'TESTE_ATIVO', grupo_tecnico: grupoTeste, situacao: 'ATIVA', mensalidade_base: 200 },
    });

    try {
      // Chama a função de agregação diretamente (extraída no Step 3)
      const { calcularRankingTecnicos } = await import('../src/lib/ranking-tecnicos');
      const ranking = await calcularRankingTecnicos(prisma);

      const grupo = ranking.find(r => r.tecnico === grupoTeste);
      expect(grupo).toBeDefined();
      // Se o bug existisse, `ativos` seria 0 (o cliente ativo nunca seria contado,
      // porque a função já teria retornado no cliente inativo, se ele viesse primeiro
      // na ordem de iteração do Prisma).
      expect(grupo!.total).toBe(2);
      expect(grupo!.ativos).toBe(1);
      expect(grupo!.inativos).toBe(1);
    } finally {
      await prisma.cliente.delete({ where: { id: clienteInativo.id } });
      await prisma.cliente.delete({ where: { id: clienteAtivo.id } });
    }
  }, 30000);
});
