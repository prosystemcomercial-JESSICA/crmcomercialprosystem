import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { FASE_POR_CODIGO, FaseDef } from '../funis.js';

// DASHBOARD GERENCIAL (Parte 4) — 5 widgets/KPIs.
export async function dashboardRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/dashboard', async (_request, reply) => {
    const agora = Date.now();
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const projetos = await prisma.projetoImplantacao.findMany({
      include: { checklists: false } as any,
    }).catch(() => [] as any[]);

    // 1) TIME-TO-VALUE (TTV): média de dias entre Fase 1.5 (fechamento) e Fase 2.5 (go-live).
    const ttvs = projetos
      .filter(p => p.data_fechamento_comercial && p.data_go_live)
      .map(p => (new Date(p.data_go_live).getTime() - new Date(p.data_fechamento_comercial).getTime()) / 86400000);
    const ttv_medio_dias = ttvs.length ? Math.round((ttvs.reduce((a, b) => a + b, 0) / ttvs.length) * 10) / 10 : null;

    // 2) GARGALOS TÉCNICOS ATUAIS: projetos com tempo na fase ESTOURADO pelo SLA.
    const gargalos = projetos
      .filter(p => p.status === 'ATIVO')
      .map(p => {
        const fase = FASE_POR_CODIGO[p.fase];
        const sla = fase ? slaEfetivo(fase, p.tipo_implantacao) : undefined;
        const dias = (agora - new Date(p.fase_desde).getTime()) / 86400000;
        return { id: p.id, cliente_nome: p.cliente_nome, funil: p.funil, fase: fase?.nome || p.fase, sla_dias: sla ?? null, dias_na_fase: Math.floor(dias * 10) / 10, estourado: sla != null && dias > sla };
      })
      .filter(g => g.estourado)
      .sort((a, b) => (b.dias_na_fase - (b.sla_dias || 0)) - (a.dias_na_fase - (a.sla_dias || 0)));

    // 3) MIGRAÇÃO vs ZERADO: projetos do Funil 2 agrupados por tipo_implantacao.
    const noFunil2 = projetos.filter(p => p.funil === 'IMPLANTACAO');
    const migracao_vs_zerado = {
      banco_zerado: noFunil2.filter(p => p.tipo_implantacao === 'BANCO_ZERADO').length,
      migracao_dados: noFunil2.filter(p => p.tipo_implantacao === 'MIGRACAO_DADOS').length,
      nao_definido: noFunil2.filter(p => !p.tipo_implantacao).length,
    };

    // 4) PREVISÃO DE GO-LIVE: clientes atualmente na Fase 2.4 (Instalação/Homologação).
    const previsao_golive = projetos
      .filter(p => p.fase === 'IMP_INSTALACAO' && p.status === 'ATIVO')
      .map(p => ({ id: p.id, cliente_nome: p.cliente_nome, tipo_implantacao: p.tipo_implantacao, dias_na_fase: Math.floor((agora - new Date(p.fase_desde).getTime()) / 86400000) }));

    // 5) TAXA DE SUCESSO (MÊS): clientes que chegaram à Fase 3.4 no mês atual.
    const sucesso_mes = projetos.filter(p => p.data_cliente_sucesso && new Date(p.data_cliente_sucesso) >= inicioMes).length;

    // Extras úteis: total por funil (visão geral).
    const por_funil = {
      COMERCIAL: projetos.filter(p => p.funil === 'COMERCIAL' && p.status === 'ATIVO').length,
      IMPLANTACAO: projetos.filter(p => p.funil === 'IMPLANTACAO' && p.status === 'ATIVO').length,
      ONBOARDING: projetos.filter(p => p.funil === 'ONBOARDING' && p.status === 'ATIVO').length,
    };

    return reply.send({
      status: 'success',
      data: { ttv_medio_dias, ttv_amostra: ttvs.length, gargalos, migracao_vs_zerado, previsao_golive, sucesso_mes, por_funil },
    });
  });
}

function slaEfetivo(fase: FaseDef, tipoImplantacao?: string | null): number | undefined {
  if (fase.sla_condicional && tipoImplantacao) return fase.sla_condicional.mapa[tipoImplantacao];
  return fase.sla_dias;
}
