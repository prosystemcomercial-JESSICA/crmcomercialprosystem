import { PrismaClient } from '@prisma/client';

export interface DashboardKPIs {
  total_casos: number;
  casos_por_status: Record<string, number>;
  risco_distribution: {
    BAIXO: number;
    MÉDIO: number;
    ALTO: number;
  };
  taxa_diagnosticados: number;
  taxa_planejados: number;
  taxa_recuperados: number;
  valor_total_em_risco: number;
  acoes_pendentes: number;
}

export class DashboardRetencaoService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calcula KPIs do dashboard de retenção
   */
  async calculateKPIs(filters?: { periodo?: string; status?: string }): Promise<DashboardKPIs> {
    // Filtro de período (default: últimos 30 dias)
    const dias = this.parsePeriodo(filters?.periodo || '30dias');
    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    // Total de casos
    const todos_casos = await this.prisma.casoChurn.findMany({
      where: {
        created_at: { gte: dataInicio },
        ...(filters?.status && { status: filters.status })
      },
      include: { cliente: true, diagnosis: true }
    });

    // Distribuição por status
    const casosPorStatus = await this.prisma.casoChurn.groupBy({
      by: ['status'],
      where: { created_at: { gte: dataInicio } },
      _count: true
    });

    const statusMap: Record<string, number> = {};
    casosPorStatus.forEach(item => {
      statusMap[item.status] = item._count;
    });

    // Distribuição de risco
    const low = todos_casos.filter(c => c.risk_score <= 30).length;
    const medium = todos_casos.filter(c => c.risk_score > 30 && c.risk_score <= 70).length;
    const high = todos_casos.filter(c => c.risk_score > 70).length;

    // Taxa de diagnóstico
    const diagnosticados = todos_casos.filter(c => c.diagnosis).length;
    const taxaDiagnosticados = todos_casos.length > 0 ? (diagnosticados / todos_casos.length) * 100 : 0;

    // Taxa de planejamento
    const planejados = todos_casos.filter(c => c.status === 'PLANEJADO').length;
    const taxaPlanejados = todos_casos.length > 0 ? (planejados / todos_casos.length) * 100 : 0;

    // Taxa de recuperação
    const recuperados = todos_casos.filter(c => c.status === 'RECUPERADO').length;
    const taxaRecuperados = todos_casos.length > 0 ? (recuperados / todos_casos.length) * 100 : 0;

    // Valor total em risco (estimado: valor mensal * score de risco)
    // Para isso, precisaremos adicionar campo de valor ao Cliente
    const valorTotalEmRisco = todos_casos.reduce((total, caso) => {
      const risco = (caso.risk_score / 100) * 1000; // Estimado
      return total + risco;
    }, 0);

    // Ações pendentes
    const acoesPendentes = await this.prisma.acaoRetencao.count({
      where: {
        status: { in: ['NOVA', 'EM_PROGRESSO'] }
      }
    });

    return {
      total_casos: todos_casos.length,
      casos_por_status: statusMap,
      risco_distribution: {
        BAIXO: low,
        MÉDIO: medium,
        ALTO: high
      },
      taxa_diagnosticados: parseFloat(taxaDiagnosticados.toFixed(2)),
      taxa_planejados: parseFloat(taxaPlanejados.toFixed(2)),
      taxa_recuperados: parseFloat(taxaRecuperados.toFixed(2)),
      valor_total_em_risco: valorTotalEmRisco,
      acoes_pendentes: acoesPendentes
    };
  }

  /**
   * Gera dados para gráfico de casos por status
   */
  async getStatusChart(dias: number = 30) {
    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    // Agrupar por dia
    const casos = await this.prisma.casoChurn.findMany({
      where: { created_at: { gte: dataInicio } },
      orderBy: { created_at: 'asc' }
    });

    const chartData: Record<string, Record<string, number>> = {};

    casos.forEach(caso => {
      const dia = caso.created_at.toISOString().split('T')[0];
      if (!chartData[dia]) {
        chartData[dia] = {
          NOVO: 0,
          DIAGNOSTICADO: 0,
          PLANEJADO: 0,
          EXECUTANDO: 0,
          RECUPERADO: 0,
          PERDIDO: 0
        };
      }
      chartData[dia][caso.status]++;
    });

    return Object.entries(chartData).map(([dia, statuses]) => ({
      data: dia,
      ...statuses
    }));
  }

  /**
   * Gera dados para gráfico de risco
   */
  async getRiscoChart() {
    const casos = await this.prisma.casoChurn.findMany({
      select: { risk_score: true }
    });

    return {
      BAIXO: casos.filter(c => c.risk_score <= 30).length,
      MÉDIO: casos.filter(c => c.risk_score > 30 && c.risk_score <= 70).length,
      ALTO: casos.filter(c => c.risk_score > 70).length
    };
  }

  /**
   * Top clientes em risco
   */
  async getTopRiscoClientes(limit: number = 10) {
    const casos = await this.prisma.casoChurn.findMany({
      orderBy: { risk_score: 'desc' },
      take: limit,
      include: { cliente: true },
      select: {
        id: true,
        cliente: { select: { id: true, nome: true, email: true } },
        risk_score: true,
        status: true
      }
    });

    return casos;
  }

  /**
   * Status dos planos de retenção
   */
  async getPlanoStatus() {
    const planos = await this.prisma.planoRetencao.groupBy({
      by: ['status'],
      _count: true
    });

    const result: Record<string, number> = {};
    planos.forEach(item => {
      result[item.status] = item._count;
    });

    return result;
  }

  /**
   * Ações por tipo
   */
  async getAcoesPorTipo() {
    const acoes = await this.prisma.acaoRetencao.groupBy({
      by: ['tipo'],
      _count: true,
      orderBy: { _count: { tipo: 'desc' } }
    });

    return acoes.map(item => ({
      tipo: item.tipo,
      count: item._count
    }));
  }

  /**
   * Taxa de sucesso de recuperação por motivo
   */
  async getRecuperacaoPorMotivo() {
    const casos = await this.prisma.casoChurn.findMany({
      where: {
        diagnosis: { isNot: null }
      },
      include: { diagnosis: true }
    });

    const motivoMap: Record<string, { total: number; recuperados: number }> = {};

    casos.forEach(caso => {
      const motivo = caso.diagnosis?.motivo_principal || 'Desconhecido';
      if (!motivoMap[motivo]) {
        motivoMap[motivo] = { total: 0, recuperados: 0 };
      }
      motivoMap[motivo].total++;
      if (caso.status === 'RECUPERADO') {
        motivoMap[motivo].recuperados++;
      }
    });

    return Object.entries(motivoMap).map(([motivo, stats]) => ({
      motivo,
      total: stats.total,
      recuperados: stats.recuperados,
      taxa: stats.total > 0 ? ((stats.recuperados / stats.total) * 100).toFixed(2) : '0'
    }));
  }

  private parsePeriodo(periodo: string): number {
    const periodos: Record<string, number> = {
      '7dias': 7,
      '30dias': 30,
      '90dias': 90,
      '6meses': 180
    };
    return periodos[periodo] || 30;
  }
}
