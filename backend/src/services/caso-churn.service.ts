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

    // ANTI-DUPLICAÇÃO: se o cliente já tem um caso ABERTO (não perdido/recuperado),
    // não cria outro — devolve o existente. Evita múltiplos casos por duplo clique.
    const casoAberto = await this.prisma.casoChurn.findFirst({
      where: { clienteId: data.clienteId, status: { notIn: ['PERDIDO', 'RECUPERADO'] } },
      include: { cliente: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => null);
    if (casoAberto) return casoAberto;

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

    // Churn/Health só medem clientes ATIVOS (inativo já saiu — não se mede).
    // Mostra casos cujo cliente está ATIVA ou null (legado), exceto INATIVA.
    where.cliente = { situacao: { not: 'INATIVA' } };

    // Busca por cliente: razão social, fantasia, nome, empresa, código ou CNPJ.
    if (filters.busca && String(filters.busca).trim()) {
      const s = String(filters.busca).trim();
      where.cliente = {
        situacao: { not: 'INATIVA' },
        OR: [
          { razao_social: { contains: s } }, { nome_fantasia: { contains: s } },
          { nome: { contains: s } }, { empresa: { contains: s } },
          { codigo: { contains: s } }, { cnpj: { contains: s } },
        ],
      };
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
      include: {
        cliente: true,
        // Linha do tempo (atualizações) — "como está sendo tratado".
        atualizacoes: { orderBy: { created_at: 'desc' } } as any,
      } as any,
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

    // Limpa campos: '' em enum/numéricos não pode ir pro banco.
    const limpo: any = { ...data };
    if (limpo.fin_situacao === '') delete limpo.fin_situacao;

    const updated = await this.prisma.casoChurn.update({
      where: { id },
      data: { ...limpo, updated_at: new Date() },
      include: { cliente: true },
    });

    // PERDIDO → inativa o cliente e alimenta o relatório de saída (MRR perdido,
    // valor devido, motivo/relato, evento na ficha). Centralizado em aplicarPerda
    // p/ ser idempotente e reutilizado também no delete.
    if (data.status === 'PERDIDO') {
      const relato = (limpo.descricao ?? caso.descricao ?? '').toString().trim();
      const valorDevido = (limpo.fin_valor_atraso ?? (updated as any).fin_valor_atraso ?? (caso as any).fin_valor_atraso ?? null);
      await this.aplicarPerda(updated.cliente as any, {
        casoId: id,
        motivo: relato || updated.motivo_principal || caso.motivo_principal || 'Perdido (churn)',
        valorDevido: valorDevido != null ? Number(valorDevido) : null,
        userId,
      }).catch(e => console.error('[CasoChurn] Falha ao aplicar perda:', e));
    }

    // Registra uma atualização na timeline quando muda status ou financeiro.
    try {
      if (data.status && data.status !== caso.status) {
        await (this.prisma as any).atualizacaoCaso.create({
          data: { caso_churn_id: id, tipo: 'STATUS', texto: `Status alterado: ${caso.status} → ${data.status}`, feito_por: userId },
        });
      }
      if (data.fin_situacao !== undefined && data.fin_situacao !== '') {
        const valor = data.fin_valor_atraso ? ` (R$ ${data.fin_valor_atraso})` : '';
        await (this.prisma as any).atualizacaoCaso.create({
          data: { caso_churn_id: id, tipo: 'FINANCEIRO', texto: `Situação financeira: ${data.fin_situacao}${valor}`, feito_por: userId },
        });
      }
    } catch { /* timeline é complementar, não bloqueia o update */ }

    console.log(`[CasoChurn] Caso ${id} atualizado para ${data.status || 'updated'}`);
    return updated;
  }

  async delete(id: string) {
    await this.getById(id); // Validar que existe

    // Soft delete = marcar como PERDIDO. Aplica a mesma cadeia de perda (inativar
    // cliente + alimentar relatório de saída), para não ficar inconsistente.
    const deleted = await this.prisma.casoChurn.update({
      where: { id },
      data: { status: 'PERDIDO' },
      include: { cliente: true }
    });
    await this.aplicarPerda(deleted.cliente as any, {
      casoId: id,
      motivo: (deleted as any).descricao || deleted.motivo_principal || 'Perdido (churn)',
      valorDevido: (deleted as any).fin_valor_atraso != null ? Number((deleted as any).fin_valor_atraso) : null,
      userId: 'system',
    }).catch(e => console.error('[CasoChurn] Falha ao aplicar perda no delete:', e));

    console.log(`[CasoChurn] Caso ${id} marcado como PERDIDO`);
    return deleted;
  }

  /**
   * Aplica a PERDA de um cliente (churn perdido): inativa, grava MRR perdido,
   * valor devido, motivo, e registra na timeline. Idempotente — pode rodar de novo
   * em cliente já inativo só para COMPLETAR dados que faltavam (ex.: MRR perdido = 0).
   */
  private async aplicarPerda(cli: any, opts: { casoId: string; motivo: string; valorDevido: number | null; userId: string }) {
    if (!cli?.id) return;
    const { casoId, motivo, valorDevido, userId } = opts;

    // MRR perdido = mensalidade do cliente; se vazia, usa o valor devido como referência.
    const mrrPerdido = Number(cli.mrr_perdido || 0) > 0 ? Number(cli.mrr_perdido)
      : Number(cli.mensalidade_base || 0) > 0 ? Number(cli.mensalidade_base)
      : (valorDevido && valorDevido > 0 ? valorDevido : 0);

    const jaInativo = cli.situacao === 'INATIVA';
    const dataUp: any = { situacao: 'INATIVA' };
    // Preenche só o que falta (não sobrescreve dados já corretos).
    if (!cli.inativado_em) dataUp.inativado_em = new Date();
    if (!cli.motivo_inativacao && motivo) dataUp.motivo_inativacao = motivo;
    if (!(Number(cli.mrr_perdido) > 0) && mrrPerdido > 0) dataUp.mrr_perdido = mrrPerdido;
    if (!(Number(cli.valor_devido_inativacao) > 0) && valorDevido != null && valorDevido > 0) dataUp.valor_devido_inativacao = valorDevido;
    await this.prisma.cliente.update({ where: { id: cli.id }, data: dataUp }).catch(() => {});

    // Evento na timeline da ficha — só na PRIMEIRA inativação (evita duplicar).
    if (!jaInativo) {
      await (this.prisma as any).eventoCliente.create({
        data: {
          cliente_id: cli.id, tipo: 'DESATIVACAO',
          titulo: '🚫 Cliente inativado (churn perdido)',
          descricao: motivo + (valorDevido != null && valorDevido > 0 ? `\nValor devido: R$ ${Number(valorDevido).toLocaleString('pt-BR')}` : '') + (mrrPerdido > 0 ? `\nMRR perdido: R$ ${mrrPerdido.toLocaleString('pt-BR')}/mês` : ''),
          referencia_id: casoId, feito_por: userId,
        },
      }).catch(() => {});
    }
  }

  private isValidStatusTransition(_from: string, to: string): boolean {
    // A gestão pode mover o caso para QUALQUER etapa livremente (o kanban/seletor
    // mostra todas), inclusive pular etapas (ex.: NOVO → EXECUTANDO) ou reabrir um
    // caso. Só validamos que o destino é um status conhecido.
    const STATUS_VALIDOS = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'];
    return STATUS_VALIDOS.includes(to);
  }
}
