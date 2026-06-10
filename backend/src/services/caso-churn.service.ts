import { PrismaClient } from '@prisma/client';
import { CreateCasoChurnDTO, UpdateCasoChurnDTO } from '@/types/dto';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class CasoChurnService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCasoChurnDTO, userId: string) {
    // Validar que cliente existe
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: data.clienteId }
    });

    if (!cliente) {
      throw new NotFoundError(`Cliente ${data.clienteId} não encontrado`);
    }

    // Criar caso de churn. IMPORTANTE: gravar o motivo_principal — antes era
    // ignorado, então o "Dificuldade financeira" escolhido na tela sumia.
    const caso = await this.prisma.casoChurn.create({
      data: {
        clienteId: data.clienteId,
        status: 'NOVO',
        risk_score: 0,
        motivo_principal: data.motivo_principal || undefined,
        created_by: userId
      },
      include: {
        cliente: true
      }
    });

    // Marca o cliente em risco de atenção (entra nos radares/filtros de churn).
    await this.prisma.cliente.update({
      where: { id: data.clienteId },
      data: { risco_atencao: true },
    }).catch(() => {});

    // Rebaixa o Health Score do cliente p/ "em risco" IMEDIATAMENTE ao abrir o
    // caso (cliente em tratamento de churn nunca aparece melhor que RISCO).
    await this.prisma.healthScore.updateMany({
      where: { cliente_id: data.clienteId, nivel: { in: ['EXCELENTE', 'SAUDAVEL', 'ATENCAO'] } },
      data: { nivel: 'RISCO' },
    }).catch(() => {});

    console.log(`[CasoChurn] Novo caso criado: ${caso.id} para cliente ${cliente.nome}`);
    return caso;
  }

  async list(filters: any, page: number = 0, limit: number = 20) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.risco_min !== undefined || filters.risco_max !== undefined) {
      where.risk_score = {};
      if (filters.risco_min !== undefined) {
        where.risk_score.gte = filters.risco_min;
      }
      if (filters.risco_max !== undefined) {
        where.risk_score.lte = filters.risco_max;
      }
    }

    const [casos, total] = await Promise.all([
      this.prisma.casoChurn.findMany({
        where,
        skip: page * limit,
        take: limit,
        include: { cliente: true },
        orderBy: { created_at: 'desc' }
      }),
      this.prisma.casoChurn.count({ where })
    ]);

    return {
      data: casos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id: string) {
    const caso = await this.prisma.casoChurn.findUnique({
      where: { id },
      include: { cliente: true }
    });

    if (!caso) {
      throw new NotFoundError(`Caso ${id} não encontrado`);
    }

    return caso;
  }

  async update(id: string, data: UpdateCasoChurnDTO, userId: string) {
    // Validar transição de status
    const caso = await this.getById(id);

    if (data.status && !this.isValidStatusTransition(caso.status, data.status)) {
      throw new BadRequestError(
        `Transição inválida: ${caso.status} → ${data.status}`
      );
    }

    const updated = await this.prisma.casoChurn.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      },
      include: { cliente: true }
    });

    console.log(`[CasoChurn] Caso ${id} atualizado para ${data.status || 'updated'}`);
    return updated;
  }

  async delete(id: string) {
    await this.getById(id); // Validar que existe

    // Soft delete (marcar como PERDIDO)
    const deleted = await this.prisma.casoChurn.update({
      where: { id },
      data: { status: 'PERDIDO' },
      include: { cliente: true }
    });

    console.log(`[CasoChurn] Caso ${id} marcado como PERDIDO`);
    return deleted;
  }

  private isValidStatusTransition(from: string, to: string): boolean {
    const validTransitions: Record<string, string[]> = {
      NOVO: ['DIAGNOSTICADO', 'PERDIDO'],
      DIAGNOSTICADO: ['PLANEJADO', 'PERDIDO'],
      PLANEJADO: ['EXECUTANDO', 'PERDIDO'],
      EXECUTANDO: ['RECUPERADO', 'PERDIDO'],
      RECUPERADO: ['NOVO', 'PERDIDO'],
      PERDIDO: [] // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }
}
