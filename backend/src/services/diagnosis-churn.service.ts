import { PrismaClient } from '@prisma/client';
import { CasoChurnService, NotFoundError, BadRequestError } from './caso-churn.service';

export interface RiskFactors {
  dias_sem_interacao: number;     // 0-20 pontos
  valor_mensal: number;            // 0-15 pontos
  frequencia_suporte: number;       // 0-20 pontos
  tempo_cliente: number;            // 0-15 pontos
  motivo_reportado: string;        // 0-30 pontos
}

export class DiagnosisChurnService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Cria diagnóstico automático com score de risco
   * Score 0-100: 0-30=Baixo, 31-70=Médio, 71-100=Alto
   */
  async create(casoChurnId: string, factors: Partial<RiskFactors> = {}) {
    // Validar que caso existe
    const caso = await this.prisma.casoChurn.findUnique({
      where: { id: casoChurnId },
      include: { cliente: true }
    });

    if (!caso) {
      throw new NotFoundError(`Caso ${casoChurnId} não encontrado`);
    }

    // Calcular score de risco
    const riskScore = this.calculateRiskScore(factors);
    const riskFactors = this.identifyRiskFactors(factors, riskScore);

    // Determinar motivo principal
    const motivo_principal = factors.motivo_reportado || 'Não especificado';

    // Criar diagnóstico
    const diagnosis = await this.prisma.diagnosisChurn.create({
      data: {
        caso_churn_id: casoChurnId,
        motivo_principal,
        risco_score: riskScore,
        fatores: riskFactors
      }
    });

    // Atualizar risk_score do caso
    await this.prisma.casoChurn.update({
      where: { id: casoChurnId },
      data: {
        risk_score: riskScore,
        status: 'DIAGNOSTICADO'
      }
    });

    console.log(
      `[Diagnosis] Diagnóstico criado para caso ${casoChurnId}: score=${riskScore}, motivo=${motivo_principal}`
    );

    return diagnosis;
  }

  async getById(id: string) {
    const diagnosis = await this.prisma.diagnosisChurn.findUnique({
      where: { id }
    });

    if (!diagnosis) {
      throw new NotFoundError(`Diagnóstico ${id} não encontrado`);
    }

    return diagnosis;
  }

  async getByCasoId(casoChurnId: string) {
    return this.prisma.diagnosisChurn.findUnique({
      where: { caso_churn_id: casoChurnId }
    });
  }

  async update(id: string, data: Partial<RiskFactors>) {
    const diagnosis = await this.getById(id);

    const newScore = this.calculateRiskScore(data);
    const newFactors = this.identifyRiskFactors(data, newScore);

    const updated = await this.prisma.diagnosisChurn.update({
      where: { id },
      data: {
        risco_score: newScore,
        fatores: newFactors,
        motivo_principal: data.motivo_reportado || diagnosis.motivo_principal
      }
    });

    // Atualizar score do caso
    await this.prisma.casoChurn.update({
      where: { id: diagnosis.caso_churn_id },
      data: { risk_score: newScore }
    });

    return updated;
  }

  /**
   * Calcula score de risco (0-100)
   * Baseado em 5 dimensões
   */
  private calculateRiskScore(factors: Partial<RiskFactors>): number {
    let score = 0;

    // 1. Dias sem interação (0-20)
    if (factors.dias_sem_interacao !== undefined) {
      const dias = factors.dias_sem_interacao;
      if (dias > 60) score += 20;
      else if (dias > 30) score += 15;
      else if (dias > 15) score += 10;
      else if (dias > 7) score += 5;
    }

    // 2. Valor mensal (0-15)
    if (factors.valor_mensal !== undefined) {
      const valor = factors.valor_mensal;
      // Clientes de alto valor têm mais risco
      if (valor > 5000) score += 15;
      else if (valor > 3000) score += 12;
      else if (valor > 1000) score += 8;
      else if (valor > 500) score += 4;
    }

    // 3. Frequência de suporte (0-20)
    if (factors.frequencia_suporte !== undefined) {
      const freq = factors.frequencia_suporte;
      if (freq > 10) score += 20; // Muitos tickets = alto risco
      else if (freq > 5) score += 15;
      else if (freq > 2) score += 10;
      else if (freq > 0) score += 5;
    }

    // 4. Tempo como cliente (0-15)
    if (factors.tempo_cliente !== undefined) {
      const meses = factors.tempo_cliente;
      // Clientes novos têm mais risco
      if (meses < 3) score += 15;
      else if (meses < 6) score += 12;
      else if (meses < 12) score += 8;
      else if (meses < 24) score += 4;
    }

    // 5. Motivo reportado (0-30)
    if (factors.motivo_reportado) {
      const motivo = factors.motivo_reportado.toLowerCase();
      if (motivo.includes('preço') || motivo.includes('caro')) score += 30;
      else if (motivo.includes('performance') || motivo.includes('lento')) score += 25;
      else if (motivo.includes('suporte') || motivo.includes('atendimento')) score += 20;
      else if (motivo.includes('integração') || motivo.includes('api')) score += 20;
      else score += 10; // Outro motivo
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Identifica os fatores de risco principais
   */
  private identifyRiskFactors(factors: Partial<RiskFactors>, score: number): string[] {
    const risks: string[] = [];

    if (factors.dias_sem_interacao && factors.dias_sem_interacao > 30) {
      risks.push('Inatividade prolongada');
    }

    if (factors.valor_mensal && factors.valor_mensal > 3000) {
      risks.push('Cliente de alto valor');
    }

    if (factors.frequencia_suporte && factors.frequencia_suporte > 5) {
      risks.push('Múltiplos tickets de suporte');
    }

    if (factors.tempo_cliente && factors.tempo_cliente < 6) {
      risks.push('Cliente novo (< 6 meses)');
    }

    if (factors.motivo_reportado) {
      risks.push(`Motivo: ${factors.motivo_reportado}`);
    }

    if (score > 70) {
      risks.push('ALTO RISCO - Ação imediata recomendada');
    } else if (score > 30) {
      risks.push('MÉDIO RISCO - Monitorar atentamente');
    }

    return risks;
  }

  /**
   * Risk matrix: 5 dimensões para visualização
   */
  async getRiskMatrix(casoChurnId: string) {
    const diagnosis = await this.getByCasoId(casoChurnId);

    if (!diagnosis) {
      return null;
    }

    return {
      casoId: casoChurnId,
      overall_score: diagnosis.risco_score,
      risk_level: this.getRiskLevel(diagnosis.risco_score),
      factors: diagnosis.fatores,
      motivo: diagnosis.motivo_principal,
      created_at: diagnosis.created_at,
      updated_at: diagnosis.updated_at
    };
  }

  private getRiskLevel(score: number): 'BAIXO' | 'MÉDIO' | 'ALTO' {
    if (score <= 30) return 'BAIXO';
    if (score <= 70) return 'MÉDIO';
    return 'ALTO';
  }
}
