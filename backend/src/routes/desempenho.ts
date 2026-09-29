import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireGestor } from '../lib/scope';

// Desempenho unificado do setor (gestão): agentes de IA, suas intervenções, compromissos,
// propostas e uso das IAs, tudo num só lugar e no mesmo período. Só lê dados que o CRM já registra.

const NOME_AGENTE: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe' };
const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export async function desempenhoRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/relatorios/desempenho', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { dias?: string };
    const dias = Math.max(1, Math.min(365, Number(q.dias) || 30));
    const ate = new Date();
    const de = new Date(ate.getTime() - dias * 86400000);
    const periodo = { gte: de, lte: ate };

    // ── Agentes (fila de cada um: quem entrou no período) ──
    const sdrs = await prisma.sdrLead.findMany({
      where: { created_at: periodo },
      select: { id: true, agente: true, status: true, nota: true, ultima_lead_em: true, primeiro_envio_em: true, conversaId: true },
    });
    const conversasDoAgente = new Map<string, string>();
    for (const s of sdrs) if (s.conversaId) conversasDoAgente.set(s.conversaId, s.agente);
    const demosPorConversa = await prisma.atividade.findMany({
      where: { tipo: 'REUNIAO', created_by: 'lead_whatsapp', created_at: periodo, whatsapp_conversa_id: { in: [...conversasDoAgente.keys()] } },
      select: { whatsapp_conversa_id: true },
    });
    const demosPorAgente: Record<string, number> = {};
    for (const d of demosPorConversa) { const a = conversasDoAgente.get(d.whatsapp_conversa_id!); if (a) demosPorAgente[a] = (demosPorAgente[a] || 0) + 1; }

    const agentes = Object.keys(NOME_AGENTE).map(ag => {
      const xs = sdrs.filter(s => s.agente === ag);
      const contatados = xs.filter(s => s.primeiro_envio_em || s.ultima_lead_em).length;
      const responderam = xs.filter(s => s.ultima_lead_em).length;
      const efetivos = xs.filter(s => ['DEMO', 'VENDEDORA'].includes(s.status) || (s.nota ?? 0) >= 60).length;
      return {
        agente: ag, nome: NOME_AGENTE[ag], leads: xs.length, contatados, responderam, efetivos,
        demos: demosPorAgente[ag] || 0,
        sem_interesse: xs.filter(s => s.status === 'SEM_INTERESSE').length,
        assumidas_por_pessoa: xs.filter(s => s.status === 'HUMANO').length,
        taxa_resposta: contatados ? Math.round((responderam / contatados) * 100) : 0,
        taxa_efetivo: contatados ? Math.round((efetivos / contatados) * 100) : 0,
      };
    });

    // ── Mensagens dos agentes e suas intervenções ──
    const msgs = await prisma.sdrMensagem.groupBy({ by: ['status'], where: { created_at: periodo }, _count: true });
    const m = Object.fromEntries(msgs.map(x => [x.status, x._count])) as Record<string, number>;
    const intervencoes = {
      aprovadas_sem_mudar: m.APROVADA || 0,
      editadas: m.EDITADA || 0,
      refeitas: m.DESCARTADA || 0,
      conversas_assumidas: agentes.reduce((s, a) => s + a.assumidas_por_pessoa, 0),
      automaticas: m.ENVIADA_AUTO || 0,
      pendentes: m.PENDENTE || 0,
    };

    // ── Compromissos (reuniões/demonstrações) marcados no período e o que aconteceu ──
    const reunioes = await prisma.atividade.groupBy({ by: ['status'], where: { tipo: 'REUNIAO', data_prevista: periodo }, _count: true });
    const r = Object.fromEntries(reunioes.map(x => [x.status, x._count])) as Record<string, number>;
    const compromissos = {
      marcados: reunioes.reduce((s, x) => s + x._count, 0),
      realizados: r.REALIZADA || 0,
      nao_compareceu: r.CLIENTE_NAO_COMPARECEU || 0,
      cancelados: r.CANCELADA || 0,
      remarcados: r.REMARCADA || 0,
      pendentes: (r.PENDENTE || 0) + (r.CONFIRMADA || 0) + (r.AGUARDANDO_RETORNO || 0),
    };
    const outrasAtividades = await prisma.atividade.groupBy({ by: ['tipo'], where: { created_at: periodo, tipo: { not: 'REUNIAO' } }, _count: true });

    // ── Propostas: mudanças de status no período ──
    const mudancas = await prisma.propostaHistorico.groupBy({ by: ['valor_novo'], where: { tipo: 'STATUS', created_at: periodo, OR: [{ campo_alterado: 'status' }, { campo_alterado: null }] }, _count: true }).catch(() => [] as any[]);
    const propostas = {
      mudancas_de_status: mudancas.reduce((s: number, x: any) => s + x._count, 0),
      por_status: mudancas.filter((x: any) => x.valor_novo).map((x: any) => ({ status: x.valor_novo, quantidade: x._count })).sort((a: any, b: any) => b.quantidade - a.quantidade),
      criadas: await prisma.propostaComercial.count({ where: { created_at: periodo, deleted_at: null } }),
    };

    // ── IA: uso por dia (OpenAI paga, Grok, Laya local grátis) + confirmações da Laya ──
    const ia: { dia: string; openai: number; grok: number; laya: number }[] = [];
    const chaves = [...Array(Math.min(dias, 90))].map((_, i) => `ia.uso.${diaSP(new Date(ate.getTime() - i * 86400000))}`);
    const regs = new Map((await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: chaves } } })).map(x => [x.chave, x.valor]));
    for (const k of chaves.reverse()) {
      let v = { openai: 0, grok: 0, laya: 0 };
      try { v = { ...v, ...JSON.parse(regs.get(k) || '{}') }; } catch { /* ignora */ }
      ia.push({ dia: k.slice(7), ...v });
    }
    const totalIa = ia.reduce((s, d) => ({ openai: s.openai + d.openai, grok: s.grok + d.grok, laya: s.laya + d.laya }), { openai: 0, grok: 0, laya: 0 });
    const laya = { acionada: totalIa.laya, confirmacoes: await prisma.iaAmostra.count({ where: { created_at: periodo } }) };

    return reply.send({
      status: 'success',
      data: {
        periodo: { dias, de, ate }, agentes, intervencoes, compromissos,
        outras_atividades: outrasAtividades.map(x => ({ tipo: x.tipo, quantidade: x._count })),
        propostas, ia: { por_dia: ia, total: totalIa, sem_custo_pct: (totalIa.openai + totalIa.grok + totalIa.laya) ? Math.round((totalIa.laya / (totalIa.openai + totalIa.grok + totalIa.laya)) * 100) : 0 },
        laya,
      },
    });
  });
}
