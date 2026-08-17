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

    // Cliente já inativo: churn é sobre reter um cliente ativo em risco, não faz
    // sentido abrir caso para quem já saiu. Bloqueia a criação (o front mostra um
    // alerta explicando) em vez de criar um caso que nunca deveria ter existido.
    if (cliente.situacao === 'INATIVA') {
      throw new BadRequestError(`O cliente "${cliente.nome}" já está inativo — não é possível abrir um novo caso de churn para ele.`);
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
        retroativo: data.retroativo || false,
        data_abertura_real: data.data_abertura_real ? new Date(data.data_abertura_real) : undefined,
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

    // Casos ABERTOS (em tratamento) só de clientes ATIVOS — inativo já saiu.
    // Mas os ENCERRADOS (PERDIDO/RECUPERADO/SISTEMA_REMOVIDO) DEVEM aparecer (são o
    // histórico de saída), mesmo com o cliente inativo. SISTEMA_REMOVIDO só acontece
    // depois de PERDIDO — o cliente já está sempre INATIVA nesse ponto — então sem
    // isso aqui a aba SISTEMA_REMOVIDO nunca mostrava nada (filtrava o próprio caso).
    const ENCERRADOS = ['PERDIDO', 'RECUPERADO', 'SISTEMA_REMOVIDO'];
    const verEncerrados = filters.status && ENCERRADOS.includes(filters.status);
    const clienteWhere: any = {};
    if (!verEncerrados && !filters.status) {
      // "Todos" sem filtro de status: esconde os de cliente inativo que NÃO são encerrados.
      where.OR = [
        { cliente: { situacao: { not: 'INATIVA' } } },
        { status: { in: ENCERRADOS } },
      ];
    } else if (!verEncerrados) {
      // filtro de status aberto (NOVO/EXECUTANDO/etc.) → só cliente ativo
      clienteWhere.situacao = { not: 'INATIVA' };
    }

    // Busca por cliente: razão social, fantasia, nome, empresa, código, CNPJ ou contato.
    if (filters.busca && String(filters.busca).trim()) {
      const s = String(filters.busca).trim();
      clienteWhere.OR = [
        { razao_social: { contains: s } }, { nome_fantasia: { contains: s } },
        { nome: { contains: s } }, { empresa: { contains: s } },
        { codigo: { contains: s } }, { cnpj: { contains: s } },
        { contato: { contains: s } },
      ];
    }
    if (Object.keys(clienteWhere).length) where.cliente = clienteWhere;

    // Filtro mensal (1º ao último dia do mês) por data de criação do caso.
    if (filters.data_inicio || filters.data_fim) {
      where.created_at = {};
      if (filters.data_inicio) where.created_at.gte = new Date(filters.data_inicio);
      if (filters.data_fim) where.created_at.lte = new Date(filters.data_fim);
    }

    const [casos, total] = await Promise.all([
      this.prisma.casoChurn.findMany({
        where,
        skip: page * limit,
        take: limit,
        include: {
          cliente: true,
          // Só a atualização mais recente — o front usa isso pra calcular
          // "sem contato há X dias" em casos financeiros (EM_ATRASO/INADIMPLENTE),
          // sem precisar trazer a timeline inteira na listagem.
          atualizacoes: { orderBy: { created_at: 'desc' }, take: 1 } as any,
        },
        orderBy: { created_at: 'desc' }
      }),
      this.prisma.casoChurn.count({ where })
    ]);

    // dias_sem_contato: diferença entre agora e (última atualização OU abertura do
    // caso, se nunca houve atualização). Só calculado para casos financeiros em
    // atraso/inadimplência — é o dado que embasa o alerta visual no front.
    const agora = Date.now();
    const casosComAlerta = casos.map((c: any) => {
      const financeiroEmRisco = c.fin_situacao === 'EM_ATRASO' || c.fin_situacao === 'INADIMPLENTE';
      if (!financeiroEmRisco) return { ...c, dias_sem_contato: null };
      const ultimaAtualizacao = c.atualizacoes?.[0]?.created_at || c.created_at;
      const diasSemContato = Math.floor((agora - new Date(ultimaAtualizacao).getTime()) / 86400000);
      return { ...c, dias_sem_contato: diasSemContato };
    });

    return {
      data: casosComAlerta,
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
    // SISTEMA_REMOVIDO é um evento técnico posterior à perda comercial — só faz
    // sentido a partir de PERDIDO (pode levar dias/semanas até o desligamento real).
    if (data.status === 'SISTEMA_REMOVIDO' && caso.status !== 'PERDIDO') {
      throw new BadRequestError('Só é possível marcar "Sistema removido" a partir de um caso PERDIDO');
    }

    // Limpa campos: '' em enum/numéricos não pode ir pro banco.
    const limpo: any = { ...data };
    if (limpo.fin_situacao === '') delete limpo.fin_situacao;

    const updated = await this.prisma.casoChurn.update({
      where: { id },
      data: { ...limpo, updated_at: new Date() },
      include: { cliente: true },
    });

    // Marca o timestamp de resolução do round atual — idempotente (nunca sobrescreve
    // um valor já preenchido). 1ª resolução → resolvido_em; se o caso já foi reaberto
    // e ainda não tem resolvido_em_2, essa é a resolução do "segundo round".
    if (data.status === 'RECUPERADO' || data.status === 'PERDIDO') {
      const upResolucao: any = {};
      if (!caso.resolvido_em) upResolucao.resolvido_em = new Date();
      else if (caso.reaberto && !caso.resolvido_em_2) upResolucao.resolvido_em_2 = new Date();
      if (Object.keys(upResolucao).length > 0) {
        await this.prisma.casoChurn.update({ where: { id }, data: upResolucao }).catch(() => {});
      }
    }

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

    // SISTEMA_REMOVIDO → registra a data do desligamento técnico, no caso e no
    // cliente (idempotente — não sobrescreve se já tiver sido marcado antes).
    if (data.status === 'SISTEMA_REMOVIDO' && !caso.sistema_removido_em) {
      const agora = new Date();
      await this.prisma.casoChurn.update({ where: { id }, data: { sistema_removido_em: agora } }).catch(() => {});
      await this.prisma.cliente.update({
        where: { id: updated.clienteId },
        data: { sistema_removido_em: agora },
      }).catch(() => {});
      await (this.prisma as any).eventoCliente.create({
        data: {
          cliente_id: updated.clienteId, tipo: 'DESATIVACAO',
          titulo: '🗑️ Sistema removido',
          descricao: 'Sistema desligado/removido do cliente após confirmação da perda.',
          referencia_id: id, feito_por: userId,
        },
      }).catch(() => {});
    }

    // RECUPERADO → o card do módulo Ativos vinculado a este caso vai para CONCLUÍDO
    // (no Ativos, só conclui quando o churn é resolvido aqui). Tira o risco do cliente.
    if (data.status === 'RECUPERADO') {
      await (this.prisma as any).contatoAtivo.updateMany({
        where: { caso_churn_id: id }, data: { etapa: 'CONCLUIDO' },
      }).catch(() => {});
      await this.prisma.cliente.update({
        where: { id: updated.clienteId }, data: { risco_atencao: false },
      }).catch(() => {});
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

  /**
   * Reabre um caso RECUPERADO — permitido só UMA vez, pelo MESMO motivo original
   * (travado em reaberto_motivo_travado, não editável). Volta o caso pra EXECUTANDO
   * (pula NOVO/DIAGNOSTICADO/PLANEJADO — o diagnóstico e plano anteriores ainda valem).
   */
  async reabrir(id: string, novoRelato: string, userId: string) {
    const caso = await this.getById(id);

    if (caso.status !== 'RECUPERADO') {
      throw new BadRequestError('Só é possível reabrir um caso RECUPERADO');
    }
    if (caso.reaberto) {
      throw new BadRequestError('Este caso já foi reaberto uma vez — crie um caso novo para este cliente');
    }

    const updated = await this.prisma.casoChurn.update({
      where: { id },
      data: {
        status: 'EXECUTANDO',
        reaberto: true,
        reaberto_em: new Date(),
        reaberto_motivo_travado: caso.motivo_principal,
        descricao: novoRelato,
        updated_at: new Date(),
      },
      include: { cliente: true },
    });

    // Cliente volta a entrar nos radares de risco.
    await this.prisma.cliente.update({
      where: { id: updated.clienteId }, data: { risco_atencao: true },
    }).catch(() => {});

    await (this.prisma as any).atualizacaoCaso.create({
      data: {
        caso_churn_id: id, tipo: 'STATUS',
        texto: `Caso reaberto — motivo original: ${caso.motivo_principal || 'não informado'}`,
        feito_por: userId,
      },
    }).catch(() => {});

    console.log(`[CasoChurn] Caso ${id} reaberto`);
    return updated;
  }

  private isValidStatusTransition(_from: string, to: string): boolean {
    // A gestão pode mover o caso para QUALQUER etapa livremente (o kanban/seletor
    // mostra todas), inclusive pular etapas (ex.: NOVO → EXECUTANDO) ou reabrir um
    // caso. Só validamos que o destino é um status conhecido.
    const STATUS_VALIDOS = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO'];
    return STATUS_VALIDOS.includes(to);
  }
}
