import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from './caso-churn.service';

export class PlanoRetencaoService {
  constructor(private prisma: PrismaClient) {}

  async create(casoChurnId: string, data: { titulo: string; descricao?: string }, userId: string) {
    // Validar que caso existe
    const caso = await this.prisma.casoChurn.findUnique({
      where: { id: casoChurnId }
    });

    if (!caso) {
      throw new NotFoundError(`Caso ${casoChurnId} não encontrado`);
    }

    const plano = await this.prisma.planoRetencao.create({
      data: {
        caso_churn_id: casoChurnId,
        titulo: data.titulo,
        descricao: data.descricao,
        status: 'RASCUNHO'
      },
      include: { acoes: true }
    });

    console.log(`[PlanoRetencao] Plano criado: ${plano.id} para caso ${casoChurnId}`);
    return plano;
  }

  async list(casoChurnId: string) {
    return this.prisma.planoRetencao.findMany({
      where: { caso_churn_id: casoChurnId },
      include: { acoes: true },
      orderBy: { created_at: 'desc' }
    });
  }

  async getById(id: string) {
    const plano = await this.prisma.planoRetencao.findUnique({
      where: { id },
      include: { acoes: true }
    });

    if (!plano) {
      throw new NotFoundError(`Plano ${id} não encontrado`);
    }

    return plano;
  }

  async update(id: string, data: Partial<{ titulo: string; descricao: string; status: string }>) {
    const plano = await this.getById(id);

    if (data.status) {
      if (!['RASCUNHO', 'ATIVO', 'CONCLUIDO'].includes(data.status)) {
        throw new BadRequestError(`Status inválido: ${data.status}`);
      }
    }

    return this.prisma.planoRetencao.update({
      where: { id },
      data,
      include: { acoes: true }
    });
  }

  async ativar(id: string) {
    return this.update(id, { status: 'ATIVO' });
  }

  async concluir(id: string) {
    return this.update(id, { status: 'CONCLUIDO' });
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.planoRetencao.delete({ where: { id } });
    console.log(`[PlanoRetencao] Plano ${id} deletado`);
  }
}

export class AcaoRetencaoService {
  constructor(private prisma: PrismaClient) {}

  async create(
    casoChurnId: string,
    data: {
      titulo: string;
      descricao?: string;
      tipo: string;
      responsavel_id?: string;
      data_vencimento?: Date;
      plano_id?: string;
    },
    userId: string
  ) {
    // Validar que caso existe
    const caso = await this.prisma.casoChurn.findUnique({
      where: { id: casoChurnId }
    });

    if (!caso) {
      throw new NotFoundError(`Caso ${casoChurnId} não encontrado`);
    }

    // Validar tipo
    const validTypes = ['CONTATO', 'EMAIL', 'DESCONTO', 'PRODUTO', 'OUTRO'];
    if (!validTypes.includes(data.tipo)) {
      throw new BadRequestError(`Tipo inválido: ${data.tipo}`);
    }

    const acao = await this.prisma.acaoRetencao.create({
      data: {
        caso_churn_id: casoChurnId,
        titulo: data.titulo,
        descricao: data.descricao,
        tipo: data.tipo,
        responsavel_id: data.responsavel_id || userId,
        data_vencimento: data.data_vencimento,
        plano_id: data.plano_id,
        status: 'NOVA'
      }
    });

    console.log(`[AcaoRetencao] Ação criada: ${acao.id} para caso ${casoChurnId}`);
    return acao;
  }

  async list(casoChurnId: string, status?: string) {
    const where: any = { caso_churn_id: casoChurnId };
    if (status) {
      where.status = status;
    }

    return this.prisma.acaoRetencao.findMany({
      where,
      orderBy: { data_vencimento: 'asc' }
    });
  }

  async getById(id: string) {
    const acao = await this.prisma.acaoRetencao.findUnique({
      where: { id }
    });

    if (!acao) {
      throw new NotFoundError(`Ação ${id} não encontrada`);
    }

    return acao;
  }

  async update(
    id: string,
    data: Partial<{
      titulo: string;
      descricao: string;
      status: string;
      responsavel_id: string;
      data_vencimento: Date;
    }>
  ) {
    const acao = await this.getById(id);

    if (data.status) {
      const validStatus = ['NOVA', 'EM_PROGRESSO', 'CONCLUIDA', 'CANCELADA'];
      if (!validStatus.includes(data.status)) {
        throw new BadRequestError(`Status inválido: ${data.status}`);
      }
    }

    return this.prisma.acaoRetencao.update({
      where: { id },
      data
    });
  }

  async marcarEmProgresso(id: string) {
    return this.update(id, { status: 'EM_PROGRESSO' });
  }

  async concluir(id: string) {
    return this.update(id, { status: 'CONCLUIDA' });
  }

  async cancelar(id: string) {
    return this.update(id, { status: 'CANCELADA' });
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.acaoRetencao.delete({ where: { id } });
  }

  /**
   * Timeline de ações ordenadas por vencimento
   */
  async getTimeline(casoChurnId: string) {
    const acoes = await this.list(casoChurnId);

    return {
      total: acoes.length,
      nova: acoes.filter(a => a.status === 'NOVA').length,
      em_progresso: acoes.filter(a => a.status === 'EM_PROGRESSO').length,
      concluida: acoes.filter(a => a.status === 'CONCLUIDA').length,
      cancelada: acoes.filter(a => a.status === 'CANCELADA').length,
      timeline: acoes
    };
  }
}
