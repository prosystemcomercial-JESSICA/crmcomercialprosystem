import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import { confirmarImplantacao } from '@/lib/comissao-fluxo';
import { diaSP, emSP, resumoDoDia, temposDaDemanda } from '@/lib/implantacao/cronometro';
import { COLUNAS, CHAVES_COLUNA, CAMPOS_COLETA, TIPOS_SERVICO, colunaDe, situacaoSla, progresso, primeiroVencimento, ehLegado, DIAS_QUADRO, onboardingOk, ONBOARDING_SECOES, ITEM_APROVACAO, PERGUNTAS_PRIMEIRO_CONTATO, CORTE_PORTAL, desdeQuadro, ehCargoTecnico, proximoPasso, pendenciasIniciarVirada, pendenciasConcluirVirada, pendenciasValidacao, etapaDaColuna, colunaIncoerente, statusAssistida, extrasDoSistema, CHECKLIST_PADRAO, saudeDoCard, montarResumoSuporte, prazoAjustado, msEsperaCliente, indicadoresViradas, METAS_PADRAO, CARGOS_TECNICO } from '@/lib/implantacao/portal';
import { obterJornada } from './implantacao-cronometro';
import {
  obterConfigPortal, salvarConfigPortal, avisarTecnico, visaoCliente, novoTokenCliente, pularMarcosPassados,
  garantirFasesTreinamento, concluirServicoNaVenda, URL_FRONT, avisarEquipe, avisarClienteAgenda, textoAgendaVirada, textoAgendaTreino,
  salvarArquivoCliente, criarTarefasClientePadrao, fecharEsperaDeTarefa,
} from '@/services/implantacao-portal.service';

/**
 * Portal de implantação e serviços (fases 2 a 8): quadro com as colunas do Trello, ficha de coleta,
 * tela do Suporte, prazos (SLA), avisos para o técnico, virada e cobrança, treinamento em fases,
 * correções pós-virada, página do cliente, página da programação, painel da gestão e configurações.
 */

const ehGestaoTecnica = (u: any) => podeVerTudo(u) || (u?.role || '').toUpperCase() === 'SUPERVISAO_TECNICA';
// Recado ligado a um card só aparece para o técnico designado nele (gestão vê tudo).
const soDoDesignado = (u: any): any => ehGestaoTecnica(u) ? {} : { OR: [{ implantacao_id: null }, { implantacao: { tecnico_id: u.id } }] };
const ehTecnico = (u: any) => ehCargoTecnico(u?.role);
const fmtData = (d?: Date | null) => d ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

export async function implantacaoPortalRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const atividade = (id: string, tipo: string, descricao: string, u?: any) =>
    prisma.implantacaoAtividade.create({ data: { implantacao_id: id, tipo, descricao, autor_id: u?.id, autor_nome: u?.nome || 'Sistema' } }).catch(() => null);

  /** Demanda acessível ao usuário (técnico de implantação: só as dele). */
  const demanda = async (u: any, id: string) => {
    if (!u) return null;
    const imp = await prisma.implantacao.findUnique({ where: { id } });
    if (!imp) return null;
    if (ehTecnico(u) && imp.tecnico_id !== u.id && !ehGestaoTecnica(u)) return null;
    return imp;
  };
  const exigirLogin = (request: any, reply: any) => { const u = getUser(request); if (!u) { reply.status(401).send({ status: 'error', message: 'Faça login' }); return null; } return u; };
  const exigirGestao = (request: any, reply: any) => { const u = getUser(request); if (!ehGestaoTecnica(u)) { reply.status(403).send({ status: 'error', message: 'Ação da gestão' }); return null; } return u; };

  // ── QUADRO (colunas do Trello), por módulo
  fastify.get('/implantacoes/quadro', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const q = request.query as { modulo?: string };
    const modulo = q.modulo === 'SERVICO' || q.modulo === 'IMPLANTACAO' ? q.modulo : null; // sem filtro = tudo
    // Só as demandas dos últimos 60 dias (as antigas seguem no CRM, fora do quadro).
    const where: any = { ...(modulo ? { modulo } : {}), data_assinatura: { gte: desdeQuadro() } };
    if (ehTecnico(u) && !ehGestaoTecnica(u)) where.tecnico_id = u.id;
    const lista = await prisma.implantacao.findMany({
      where, orderBy: { data_assinatura: 'desc' },
      include: {
        checklist: { select: { grupo: true, titulo: true, feito: true } },
        esperas: { select: { id: true, tipo: true, motivo: true, inicio: true, fim: true } },
        ocorrencias: { where: { situacao: { not: 'RESOLVIDA' } }, select: { id: true, gravidade: true } },
        treinamento_fases: { select: { realizada_em: true, marcada_em: true, ordem: true, nome: true } },
        assistida: { select: { dia: true } },
        sessoes: { orderBy: { inicio: 'desc' }, take: 1, select: { inicio: true } },
        testes: { select: { resultado: true } },
      },
    });
    const agora = new Date();
    const vencidasPorCard = new Map((await prisma.implantacaoTarefaCliente.groupBy({ by: ['implantacao_id'], where: { implantacao_id: { in: lista.map(l => l.id) }, status: 'PENDENTE', prazo: { lt: agora } }, _count: { _all: true } })).map(g => [g.implantacao_id, g._count._all]));
    const cards = lista.map(i => {
      // O relógio do técnico pausa enquanto a loja não entrega o que precisa (espera "Cliente").
      const prazo = prazoAjustado(i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada, i.esperas, agora);
      const abertas = i.esperas.filter(e => !e.fim);
      const concluido = i.modulo === 'SERVICO' || i.virada_fim_em ? (i.concluida_fila_em || i.data_conclusao) : i.virada_fim_em;
      return {
        id: i.id, cliente_razao_social: i.cliente_razao_social, cliente_cnpj: i.cliente_cnpj, modulo: i.modulo, tipo_servico: i.tipo_servico,
        tipo_servico_label: i.tipo_servico ? TIPOS_SERVICO[i.tipo_servico]?.label : null, tipo_base: i.tipo_base, sistema_anterior: i.sistema_anterior,
        plano: i.plano, vendedor_nome: i.vendedor_nome, tecnico_id: i.tecnico_id, tecnico_nome: i.tecnico_nome, coluna: colunaDe(i),
        data_assinatura: i.data_assinatura, prazo_virada: i.prazo_virada, prazo_finalizacao: i.prazo_finalizacao,
        sla: situacaoSla(i.data_assinatura, prazo, concluido, agora), sla_etapa: i.virada_fim_em || i.modulo === 'SERVICO' ? 'finalização' : 'virada',
        progresso: progresso(i, i.checklist), checklist_feitos: i.checklist.filter(c => c.feito).length, checklist_total: i.checklist.length,
        esperas_abertas: abertas, prazo_ajuste_ms: msEsperaCliente(i.esperas, agora), ocorrencias_abertas: i.ocorrencias.length, ficha_ok: !!((i.coleta as any)?.regime_tributario && (i.coleta as any)?.contato_nome),
        tela_suporte: !!i.tela_suporte_arquivo_id, virada_inicio_em: i.virada_inicio_em, virada_fim_em: i.virada_fim_em, data_primeiro_vencimento: i.data_primeiro_vencimento,
        cobranca_lancada_em: i.cobranca_lancada_em, token_cliente: i.token_cliente, concluida_fila_em: i.concluida_fila_em, legado: ehLegado(i),
        proximo_passo: (({ chave, titulo, quem }) => ({ chave, titulo, quem }))(proximoPasso(i, i.checklist, i.treinamento_fases, i.ocorrencias.length, { assistida: i.assistida, agora, testes: i.testes })),
        virada_agendada_para: i.virada_agendada_para,
        treinos_marcados: i.treinamento_fases.filter(f => f.marcada_em && !f.realizada_em).map(f => ({ ordem: f.ordem, nome: f.nome, marcada_em: f.marcada_em })),
        saude: saudeDoCard({ coluna: colunaDe(i), sla: situacaoSla(i.data_assinatura, prazo, concluido, agora), tecnico_id: i.tecnico_id, designado_em: i.designado_em, data_assinatura: i.data_assinatura,
          ultima_sessao: i.sessoes[0]?.inicio || null, esperas_abertas: abertas, correcoes_altas: i.ocorrencias.filter(o => o.gravidade === 'ALTA').length, tarefas_vencidas: vencidasPorCard.get(i.id) || 0 }, agora),
        onboarding_ok: onboardingOk(i, i.checklist), onboarding_feitos: i.checklist.filter(c => c.grupo === 'ONBOARDING' && c.feito).length, onboarding_total: i.checklist.filter(c => c.grupo === 'ONBOARDING').length,
      };
    });
    return reply.send({ status: 'success', data: { colunas: COLUNAS, cards } });
  });

  // ── Mover de coluna
  fastify.patch('/implantacoes/:id/coluna', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ coluna: z.enum(CHAVES_COLUNA as [string, ...string[]]) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Coluna inválida' });
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const para = b.data.coluna, de = colunaDe(imp);
    const incoerente = colunaIncoerente(imp, para);
    if (incoerente) return reply.status(400).send({ status: 'error', message: incoerente });
    if (['CANCELADOS', 'VALIDADO', 'FINALIZADO'].includes(para) && !ehGestaoTecnica(u)) return reply.status(403).send({ status: 'error', message: 'Só a supervisão valida, finaliza ou cancela' });
    const chk = await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id }, select: { grupo: true, titulo: true, feito: true } });
    if (para === 'CONCLUIDO' && de !== 'CONCLUIDO') {
      const [fases, abertas, assistida] = await Promise.all([
        prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: id }, select: { realizada_em: true } }),
        prisma.implantacaoOcorrencia.count({ where: { implantacao_id: id, situacao: { not: 'RESOLVIDA' } } }),
        prisma.implantacaoAssistida.findMany({ where: { implantacao_id: id }, select: { dia: true } }),
      ]);
      const falta = pendenciasValidacao(imp, chk, fases, abertas, assistida);
      if (falta.length) return reply.status(400).send({ status: 'error', message: `Antes de concluir: ${falta.join('; ')}.`, data: { pendencias: falta } });
    }
    if (!['BACKLOG', 'A_FAZER', 'CANCELADOS'].includes(para) && !onboardingOk(imp, chk)) return reply.status(400).send({ status: 'error', message: 'Conclua o onboarding técnico (primeiro contato com o cliente) antes de avançar a demanda.' });
    // Uma só verdade: a etapa de execução acompanha a coluna.
    const data: any = { coluna: para, etapa_execucao: etapaDaColuna(para, imp) };
    if (para === 'FINALIZADO') {
      const abertas = await prisma.implantacaoOcorrencia.count({ where: { implantacao_id: id, situacao: { not: 'RESOLVIDA' } } });
      if (abertas) return reply.status(400).send({ status: 'error', message: `Há ${abertas} correção(ões) aberta(s). Resolva antes de finalizar.` });
      if (imp.modulo === 'IMPLANTACAO' && !imp.virada_fim_em) return reply.status(400).send({ status: 'error', message: 'A loja ainda não foi virada. Use "Loja virada" antes de finalizar.' });
      data.data_conclusao = imp.data_conclusao || new Date();
      data.concluida_fila_em = new Date();
      data.etapa_execucao = 'FINALIZADO';
    }
    if (para === 'CANCELADOS') data.status = 'CANCELADA';
    // Validação da supervisão: monta o resumo que o suporte vê nos tickets deste cliente.
    if (para === 'VALIDADO' && de !== 'VALIDADO') {
      const [obs, ocs] = await Promise.all([
        prisma.implantacaoObservacao.findMany({ where: { implantacao_id: id, privada: false }, orderBy: { created_at: 'desc' }, take: 10 }),
        prisma.implantacaoOcorrencia.findMany({ where: { implantacao_id: id }, orderBy: { aberta_em: 'asc' }, select: { titulo: true, situacao: true } }),
      ]);
      data.validado_em = new Date();
      data.resumo_suporte = montarResumoSuporte({ imp, observacoes: obs, correcoes: ocs, campos: CAMPOS_COLETA });
    }
    await prisma.implantacao.update({ where: { id }, data });
    if (para === 'FINALIZADO' && imp.venda_adicional_id) await concluirServicoNaVenda(prisma, imp.venda_adicional_id);
    const nome = (k: string) => COLUNAS.find(c => c.key === k)?.label || k;
    await atividade(id, 'MUDANCA_ETAPA', `Moveu de "${nome(de)}" para "${nome(para)}"`, u);
    if (data.resumo_suporte) {
      await atividade(id, 'NOTA', '🧾 Resumo da implantação enviado ao suporte (aparece nos tickets deste cliente). A pesquisa de satisfação sai em 2 dias úteis.', u);
      // Termo de aceite para o decisor assinar (ZapSign). Sem decisor/contato ou sem ZapSign: fica registrado e a supervisão reenvia pelo card.
      if (!ehLegado(imp)) {
        const { enviarTermoAceite } = await import('@/services/implantacao-termo.service');
        const r = await enviarTermoAceite(prisma, id).catch((e: any) => ({ ok: false as const, motivo: e?.message || 'falha' }));
        if (!r.ok) await atividade(id, 'NOTA', `✍️ Termo de aceite não enviado: ${r.motivo}`, u);
      }
    }
    return reply.send({ status: 'success' });
  });

  // ── Ficha de coleta
  fastify.get('/implantacoes/coleta/campos', async (_request, reply) => reply.send({ status: 'success', data: CAMPOS_COLETA }));
  fastify.put('/implantacoes/:id/coleta', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const body = (request.body || {}) as Record<string, any>;
    const coleta: Record<string, string> = {};
    for (const c of CAMPOS_COLETA) if (body[c.key] != null && String(body[c.key]).trim() !== '') coleta[c.key] = String(body[c.key]).trim().slice(0, 2000);
    // Responsável da empresa (decisor) é da supervisão: salvar a ficha não apaga.
    const antiga: any = imp.coleta || {};
    for (const k of ['decisor_nome', 'decisor_telefone']) if (antiga[k]) coleta[k] = antiga[k];
    const extra: any = {};
    if (coleta.tipo_base) extra.tipo_base = /zerado/i.test(coleta.tipo_base) ? 'BANCO_ZERADO' : 'CONVERSAO';
    if (coleta.sistema_anterior) extra.sistema_anterior = coleta.sistema_anterior;
    if (coleta.contato_telefone && !imp.contato_whatsapp) extra.contato_whatsapp = coleta.contato_telefone.replace(/\D/g, '') || null;
    if (body.contato_email !== undefined) extra.contato_email = String(body.contato_email || '').trim() || null;
    if (body.contato_whatsapp !== undefined) extra.contato_whatsapp = String(body.contato_whatsapp || '').replace(/\D/g, '') || null;
    await prisma.implantacao.update({ where: { id }, data: { coleta, ...extra } });
    await atividade(id, 'NOTA', '📝 Ficha de coleta atualizada', u);
    // Sistema de origem informado/trocado: acrescenta os itens extras desse sistema na conversão (só os que faltam).
    if (imp.modulo === 'IMPLANTACAO' && extra.sistema_anterior && extra.sistema_anterior !== imp.sistema_anterior) {
      const cfgP = await obterConfigPortal(prisma);
      const novos = extrasDoSistema(cfgP.extras_sistema, extra.sistema_anterior);
      if (novos.length) {
        const ja = new Set((await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id, grupo: 'CONVERSAO' }, select: { titulo: true } })).map(x => x.titulo));
        const faltam = novos.filter(t => !ja.has(t));
        if (faltam.length) {
          await prisma.implantacaoChecklistItem.createMany({ data: faltam.map((titulo, k) => ({ implantacao_id: id, grupo: 'CONVERSAO', titulo, ordem: 100 + k })) });
          await atividade(id, 'NOTA', `🧩 ${faltam.length} item(ns) de conversão do sistema ${extra.sistema_anterior} acrescentado(s) ao checklist`, u);
        }
      }
    }
    // As 15 perguntas do primeiro contato respondidas: o item do onboarding se marca sozinho (e desmarca se apagarem alguma).
    const { perguntasRespondidas, ITEM_PERGUNTAS } = await import('@/lib/implantacao/portal');
    await prisma.implantacaoChecklistItem.updateMany({ where: { implantacao_id: id, grupo: 'ONBOARDING', titulo: ITEM_PERGUNTAS },
      data: perguntasRespondidas(coleta) ? { feito: true, feito_por: u.nome || u.id, feito_em: new Date() } : { feito: false, feito_por: null, feito_em: null } });
    return reply.send({ status: 'success', data: { coleta, ...extra } });
  });

  // ── Tela do Suporte (anexo obrigatório para a virada)
  fastify.post('/implantacoes/:id/tela-suporte', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ nome: z.string().min(1).max(200), arquivo: z.string().min(20) }).safeParse(request.body);
    if (!b.success || !/^data:(image\/|application\/pdf)/.test(b.data.arquivo)) return reply.status(400).send({ status: 'error', message: 'Envie uma imagem ou PDF da tela do Suporte' });
    const arq = await prisma.implantacaoArquivo.create({ data: { implantacao_id: id, nome: b.data.nome, tipo: 'ANEXO', url: b.data.arquivo, descricao: 'Tela de liberação do Suporte', enviado_por: u.nome || u.id } });
    await prisma.implantacao.update({ where: { id }, data: { tela_suporte_arquivo_id: arq.id } });
    await atividade(id, 'ARQUIVO', '🖼️ Tela do Suporte anexada', u);
    return reply.status(201).send({ status: 'success', data: { id: arq.id } });
  });
  fastify.get('/implantacoes/:id/tela-suporte', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp?.tela_suporte_arquivo_id) return reply.status(404).send({ status: 'error', message: 'Sem tela anexada' });
    const arq = await prisma.implantacaoArquivo.findUnique({ where: { id: imp.tela_suporte_arquivo_id } });
    return reply.send({ status: 'success', data: arq });
  });

  // ── Pedir validação (técnico): confere tudo, vai para "Concluído", pausa o cronômetro e avisa a supervisão.
  fastify.post('/implantacoes/:id/pedir-validacao', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    if (['CONCLUIDO', 'VALIDADO', 'FINALIZADO', 'CANCELADOS'].includes(colunaDe(imp))) return reply.status(400).send({ status: 'error', message: 'Esta demanda já saiu da execução' });
    const [chk, fases, abertas, assistida] = await Promise.all([
      prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id }, select: { grupo: true, titulo: true, feito: true } }),
      prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: id }, select: { realizada_em: true } }),
      prisma.implantacaoOcorrencia.count({ where: { implantacao_id: id, situacao: { not: 'RESOLVIDA' } } }),
      prisma.implantacaoAssistida.findMany({ where: { implantacao_id: id }, select: { dia: true } }),
    ]);
    const falta = pendenciasValidacao(imp, chk, fases, abertas, assistida);
    if (falta.length) return reply.status(400).send({ status: 'error', message: `Antes de pedir a validação: ${falta.join('; ')}.`, data: { pendencias: falta } });
    const agora = new Date();
    await prisma.implantacao.update({ where: { id }, data: { coluna: 'CONCLUIDO', etapa_execucao: etapaDaColuna('CONCLUIDO', imp) } });
    await prisma.implantacaoSessao.updateMany({ where: { implantacao_id: id, tecnico_id: u.id, fim: null }, data: { fim: agora, origem_fim: 'PAUSA' } });
    await atividade(id, 'MUDANCA_ETAPA', `✅ ${u.nome || 'Técnico'} concluiu e pediu a validação da supervisão`, u);
    await avisarEquipe(prisma, `✅ Pedido de validação: ${imp.cliente_razao_social} (${u.nome || 'técnico'}). Abra o card para validar ou devolver.`, id).catch(() => {});
    const { enviarAvisoGestao } = await import('@/services/assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `✅ *Validação pedida*: ${imp.cliente_razao_social} (${u.nome || 'técnico'}). Valide no Portal Técnico.`, { somenteAprovadora: true }).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // ── Devolver ao técnico (supervisão): volta para a execução com o motivo, e o técnico recebe o recado.
  fastify.post('/implantacoes/:id/devolver', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ motivo: z.string().trim().min(3).max(1000) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Conte ao técnico o que falta.' });
    const imp = await prisma.implantacao.findUnique({ where: { id } });
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const coluna = imp.modulo === 'IMPLANTACAO' && imp.virada_fim_em ? 'ACOMPANHAMENTO' : 'EM_ANDAMENTO';
    await prisma.implantacao.update({ where: { id }, data: { coluna, etapa_execucao: etapaDaColuna(coluna, imp) } });
    await atividade(id, 'MUDANCA_ETAPA', `↩️ ${u.nome || 'Supervisão'} devolveu ao técnico: ${b.data.motivo}`, u);
    if (imp.tecnico_id) await avisarTecnico(prisma, { para_id: imp.tecnico_id, implantacao_id: id, origem: 'GESTAO', de: { id: u.id, nome: u.nome }, prioridade: 'URGENTE', texto: `${imp.cliente_razao_social} voltou para você: ${b.data.motivo}` }).catch(() => null);
    return reply.send({ status: 'success' });
  });

  // ── Agendar (ou remarcar) a virada com o cliente: data no card, recado ao cliente, lembrete 1 dia útil antes.
  fastify.post('/implantacoes/:id/agendar-virada', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({
      quando: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), duracao_h: z.number().int().min(1).max(24).optional().nullable(),
      motivo: z.enum(['CLIENTE', 'TECNICO', 'PROGRAMACAO', 'OUTRO']).optional(), motivo_texto: z.string().trim().max(500).optional(), confirmar: z.boolean().optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Informe a data e a hora da virada.' });
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    if (imp.modulo !== 'IMPLANTACAO') return reply.status(400).send({ status: 'error', message: 'Virada é só para implantação' });
    if (imp.virada_inicio_em || imp.virada_fim_em) return reply.status(400).send({ status: 'error', message: 'A virada já começou: não dá mais para agendar.' });
    const para = new Date(`${b.data.quando}:00-03:00`);
    if (para.getTime() < Date.now() - 5 * 60000) return reply.status(400).send({ status: 'error', message: 'A data da virada precisa ser no futuro.' });
    const remarcando = !!imp.virada_agendada_para;
    if (remarcando && !b.data.motivo) return reply.status(400).send({ status: 'error', message: 'Remarcação: diga o motivo.' });
    // Outra virada do mesmo técnico no mesmo dia: avisa e pede confirmação.
    if (imp.tecnico_id && !b.data.confirmar) {
      const mesmoDia = (await prisma.implantacao.findMany({ where: { id: { not: id }, tecnico_id: imp.tecnico_id, virada_fim_em: null, status: { not: 'CANCELADA' }, virada_agendada_para: { gte: new Date(para.getTime() - 864e5), lte: new Date(para.getTime() + 864e5) } }, select: { cliente_razao_social: true, virada_agendada_para: true } }))
        .filter(o => diaSP(o.virada_agendada_para!) === diaSP(para));
      if (mesmoDia.length) return reply.status(409).send({ status: 'error', message: `${imp.tecnico_nome || 'O técnico'} já tem virada nesse dia: ${mesmoDia.map(o => `${o.cliente_razao_social} (${o.virada_agendada_para!.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })})`).join(', ')}.`, data: { conflito: true } });
    }
    await prisma.implantacao.update({ where: { id }, data: { virada_agendada_para: para, virada_duracao_h: b.data.duracao_h ?? imp.virada_duracao_h ?? null, virada_lembrete_em: null, ...(remarcando ? { virada_remarcacoes: { increment: 1 } } : {}) } });
    const MOTIVO: Record<string, string> = { CLIENTE: 'cliente pediu', TECNICO: 'problema técnico', PROGRAMACAO: 'aguardando programação', OUTRO: 'outro motivo' };
    const quandoTxt = para.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await atividade(id, 'NOTA', remarcando ? `📅 Virada remarcada para ${quandoTxt} (${MOTIVO[b.data.motivo!]}${b.data.motivo_texto ? `: ${b.data.motivo_texto}` : ''})` : `📅 Virada agendada para ${quandoTxt}`, u);
    if (!ehLegado(imp)) await avisarClienteAgenda(prisma, imp, 'AGENDA_VIRADA', textoAgendaVirada(imp, para, remarcando, b.data.duracao_h ?? imp.virada_duracao_h)).catch(() => {});
    if (remarcando) await avisarEquipe(prisma, `📅 Virada remarcada: ${imp.cliente_razao_social} para ${quandoTxt} (${MOTIVO[b.data.motivo!]}).`, id).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // ── Operação assistida: checagem do dia (vendas, NFC-e, estoque). Problema abre uma correção ligada ao card.
  fastify.post('/implantacoes/:id/assistida', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), vendas_ok: z.boolean(), nfce_ok: z.boolean(), estoque_ok: z.boolean(), observacao: z.string().trim().max(2000).optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Marque as três checagens.' });
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const regs = await prisma.implantacaoAssistida.findMany({ where: { implantacao_id: id }, select: { dia: true } });
    const st = statusAssistida(imp, regs);
    if (!st) return reply.status(400).send({ status: 'error', message: 'Esta demanda não tem operação assistida (a loja ainda não virou ou é anterior a 03/10/2026).' });
    const d = st.dias.find(x => x.dia === b.data.dia);
    if (!d) return reply.status(400).send({ status: 'error', message: 'Esse dia não faz parte da operação assistida.' });
    if (!d.liberado) return reply.status(400).send({ status: 'error', message: 'Essa checagem ainda não chegou: registre no dia.' });
    if (d.feito) return reply.status(400).send({ status: 'error', message: 'Esse dia já foi checado.' });
    const falhas = [!b.data.vendas_ok && 'vendas', !b.data.nfce_ok && 'NFC-e', !b.data.estoque_ok && 'estoque'].filter(Boolean) as string[];
    const ddmm = `${b.data.dia.slice(8, 10)}/${b.data.dia.slice(5, 7)}`;
    let ocorrencia_id: string | null = null;
    if (falhas.length) {
      const oc = await prisma.implantacaoOcorrencia.create({ data: { implantacao_id: id, titulo: `Operação assistida ${ddmm}: problema em ${falhas.join(', ')}`, descricao: b.data.observacao || null, gravidade: !b.data.vendas_ok || !b.data.nfce_ok ? 'ALTA' : 'MEDIA', aberta_por: u.nome || u.id } as any });
      ocorrencia_id = oc.id;
    }
    await prisma.implantacaoAssistida.create({ data: { implantacao_id: id, dia: b.data.dia, vendas_ok: b.data.vendas_ok, nfce_ok: b.data.nfce_ok, estoque_ok: b.data.estoque_ok, observacao: b.data.observacao || null, ocorrencia_id, tecnico_id: u.id, tecnico_nome: u.nome || null } });
    await atividade(id, 'NOTA', falhas.length ? `🩺 Operação assistida ${ddmm}: problema em ${falhas.join(', ')} (correção aberta)` : `🩺 Operação assistida ${ddmm}: vendas, NFC-e e estoque ok (${st.feitos + 1} de ${st.total})`, u);
    if (falhas.length) await avisarEquipe(prisma, `🩺 ${imp.cliente_razao_social}: operação assistida ${ddmm} com problema em ${falhas.join(', ')}.`, id).catch(() => {});
    return reply.send({ status: 'success', data: { ocorrencia_id } });
  });

  // ── Tarefas do cliente (equipe): criar, padrões, concluir, devolver, excluir, baixar arquivo.
  fastify.post('/implantacoes/:id/tarefas-cliente', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ padrao: z.boolean().optional(), titulo: z.string().trim().min(3).max(200).optional(), descricao: z.string().trim().max(1000).optional(), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), exige_arquivo: z.boolean().optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    if (!imp.token_cliente) await prisma.implantacao.update({ where: { id }, data: { token_cliente: novoTokenCliente() } });
    if (b.data.padrao) {
      if (imp.modulo !== 'IMPLANTACAO' || ehLegado(imp)) return reply.status(400).send({ status: 'error', message: 'As tarefas padrão valem para implantações a partir de 02/10/2026.' });
      const n = await criarTarefasClientePadrao(prisma, imp, u.nome || u.id);
      if (!n) return reply.status(400).send({ status: 'error', message: 'Esta demanda já tem tarefas do cliente.' });
      await atividade(id, 'NOTA', `📎 ${n} tarefa(s) padrão do cliente criadas`, u);
      return reply.status(201).send({ status: 'success' });
    }
    if (!b.data.titulo) return reply.status(400).send({ status: 'error', message: 'Diga o que o cliente precisa enviar.' });
    const prazo = b.data.prazo ? new Date(`${b.data.prazo}T17:59:00-03:00`) : null;
    await prisma.implantacaoTarefaCliente.create({ data: { implantacao_id: id, titulo: b.data.titulo, descricao: b.data.descricao || null, prazo, exige_arquivo: b.data.exige_arquivo ?? true, criada_por: u.nome || u.id } });
    await atividade(id, 'NOTA', `📎 Tarefa do cliente criada: ${b.data.titulo}`, u);
    return reply.status(201).send({ status: 'success' });
  });
  fastify.patch('/implantacoes/tarefas-cliente/:tid', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { tid } = request.params as { tid: string };
    const b = z.object({ acao: z.enum(['CONCLUIR', 'DEVOLVER', 'EXCLUIR', 'REABRIR']), motivo: z.string().trim().max(1000).optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Ação inválida' });
    const t = await prisma.implantacaoTarefaCliente.findUnique({ where: { id: tid } });
    const imp = t ? await demanda(u, t.implantacao_id) : null;
    if (!t || !imp) return reply.status(404).send({ status: 'error', message: 'Tarefa não encontrada' });
    if (b.data.acao === 'EXCLUIR') {
      await prisma.implantacaoTarefaCliente.delete({ where: { id: tid } });
      await atividade(imp.id, 'NOTA', `📎 Tarefa do cliente removida: ${t.titulo}`, u);
    } else if (b.data.acao === 'CONCLUIR') {
      await prisma.implantacaoTarefaCliente.update({ where: { id: tid }, data: { status: 'CONCLUIDA', concluida_em: new Date() } });
      await atividade(imp.id, 'NOTA', `✅ Tarefa do cliente conferida: ${t.titulo}`, u);
    } else if (b.data.acao === 'REABRIR') {
      await prisma.implantacaoTarefaCliente.update({ where: { id: tid }, data: { status: 'PENDENTE', concluida_em: null } });
    } else {
      if (!b.data.motivo || b.data.motivo.length < 3) return reply.status(400).send({ status: 'error', message: 'Diga ao cliente o que precisa corrigir.' });
      await prisma.implantacaoTarefaCliente.update({ where: { id: tid }, data: { status: 'PENDENTE', devolvida_motivo: b.data.motivo, concluida_em: null } });
      await atividade(imp.id, 'NOTA', `↩️ Pedido ao cliente para reenviar "${t.titulo}": ${b.data.motivo}`, u);
      await avisarClienteAgenda(prisma, imp, 'TAREFA_DEVOLVIDA', `Olá! Aqui é da Prosystem. Sobre "${t.titulo}": ${b.data.motivo}\n\nReenvie pela sua página de acompanhamento: ${URL_FRONT()}/acompanhamento/${imp.token_cliente}`).catch(() => {});
    }
    await fecharEsperaDeTarefa(prisma, imp.id, u.nome || 'Equipe').catch(() => {});
    return reply.send({ status: 'success' });
  });
  fastify.get('/implantacoes/tarefas-cliente/:tid/arquivo', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const t = await prisma.implantacaoTarefaCliente.findUnique({ where: { id: (request.params as any).tid } });
    if (!t?.arquivo_caminho || !(await demanda(u, t.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Arquivo não encontrado' });
    const { readFile } = await import('fs/promises');
    const buf = await readFile(t.arquivo_caminho).catch(() => null);
    if (!buf) return reply.status(404).send({ status: 'error', message: 'Arquivo não encontrado no servidor' });
    reply.header('Content-Type', t.arquivo_mime || 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(t.arquivo_nome || 'arquivo')}"`);
    return reply.send(buf);
  });

  // ── Resumo da implantação para o suporte: o mais recente validado deste cliente (aparece no ticket).
  fastify.get('/implantacoes/resumo-suporte', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const clienteId = String((request.query as any)?.cliente_id || '');
    if (!clienteId) return reply.send({ status: 'success', data: null });
    const cli = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { cnpj: true } }).catch(() => null);
    const OR: any[] = [{ cliente_id: clienteId }];
    if (cli?.cnpj) OR.push({ cliente_cnpj: cli.cnpj });
    const imp = await prisma.implantacao.findFirst({ where: { OR, resumo_suporte: { not: null } }, orderBy: { validado_em: 'desc' }, select: { id: true, cliente_razao_social: true, validado_em: true, tecnico_nome: true, resumo_suporte: true, modulo: true } });
    return reply.send({ status: 'success', data: imp });
  });

  // ── Testes de conversão (dentro do escopo do técnico): conferir cada cadastro convertido.
  fastify.post('/implantacoes/:id/testes-conv', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ item: z.string().trim().min(2).max(120) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Diga o que será testado.' });
    await prisma.implantacaoTeste.create({ data: { implantacao_id: imp.id, item: b.data.item } });
    return reply.status(201).send({ status: 'success' });
  });
  fastify.patch('/implantacoes/testes-conv/:tid', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const t = await prisma.implantacaoTeste.findUnique({ where: { id: (request.params as any).tid } });
    if (!t || !(await demanda(u, t.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Teste não encontrado' });
    const b = z.object({ resultado: z.enum(['PENDENTE', 'OK', 'DIVERGENTE', 'NAO_APLICA']).optional(), observacao: z.string().trim().max(2000).optional(), excluir: z.boolean().optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    if (b.data.excluir) { await prisma.implantacaoTeste.delete({ where: { id: t.id } }); return reply.send({ status: 'success' }); }
    if (b.data.resultado === 'DIVERGENTE' && !(b.data.observacao || t.observacao)) return reply.status(400).send({ status: 'error', message: 'Conte qual foi a divergência.' });
    await prisma.implantacaoTeste.update({ where: { id: t.id }, data: { resultado: b.data.resultado, observacao: b.data.observacao, ...(b.data.resultado ? { testado_por: u.nome || u.id, testado_em: new Date() } : {}) } });
    if (b.data.resultado && b.data.resultado !== t.resultado) {
      const R: Record<string, string> = { OK: '✅ ok', DIVERGENTE: '⚠️ com divergência', NAO_APLICA: 'não se aplica', PENDENTE: 'reaberto' };
      await atividade(t.implantacao_id, 'TESTE', `🧪 Teste de conversão "${t.item}": ${R[b.data.resultado]}${b.data.observacao ? ` (${b.data.observacao})` : ''}`, u);
    }
    return reply.send({ status: 'success' });
  });

  // ── Anexos do card (planilhas, prints, links). Arquivo vai para o disco (até 15 MB); link fica como link.
  fastify.post('/implantacoes/:id/anexos', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ nome: z.string().trim().min(1).max(200), link: z.string().trim().url().max(2000).optional(), arquivo: z.string().max(22 * 1024 * 1024).optional(), descricao: z.string().trim().max(500).optional() }).safeParse(request.body);
    if (!b.success || (!b.data.link && !b.data.arquivo)) return reply.status(400).send({ status: 'error', message: 'Escolha um arquivo ou cole um link.' });
    let url = b.data.link || '';
    if (b.data.arquivo) {
      try { const a = await salvarArquivoCliente(imp.id, 'anexo', b.data.nome, b.data.arquivo); url = `disk:${a.caminho}`; }
      catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível salvar o arquivo.' }); }
    }
    await prisma.implantacaoArquivo.create({ data: { implantacao_id: imp.id, nome: b.data.nome, tipo: b.data.arquivo ? 'ANEXO' : 'LINK', url, descricao: b.data.descricao || null, enviado_por: u.nome || u.id } });
    await atividade(imp.id, 'ARQUIVO', `📎 ${b.data.arquivo ? 'Arquivo anexado' : 'Link anexado'}: ${b.data.nome}`, u);
    return reply.status(201).send({ status: 'success' });
  });
  fastify.get('/implantacoes/anexos/:aid/download', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const a = await prisma.implantacaoArquivo.findUnique({ where: { id: (request.params as any).aid } });
    if (!a || a.tipo !== 'ANEXO' || !(await demanda(u, a.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Arquivo não encontrado' });
    let buf: Buffer | null = null, mime = 'application/octet-stream';
    if (a.url.startsWith('disk:')) { const { readFile } = await import('fs/promises'); buf = await readFile(a.url.slice(5)).catch(() => null); }
    else { const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(a.url); if (m) { mime = m[1] || mime; buf = Buffer.from(m[3], m[2] ? 'base64' : 'utf8'); } }
    if (!buf) return reply.status(404).send({ status: 'error', message: 'Arquivo não encontrado no servidor' });
    reply.header('Content-Type', mime);
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(a.nome)}"`);
    return reply.send(buf);
  });
  fastify.delete('/implantacoes/anexos/:aid', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const a = await prisma.implantacaoArquivo.findUnique({ where: { id: (request.params as any).aid } });
    const imp = a ? await demanda(u, a.implantacao_id) : null;
    if (!a || !imp) return reply.status(404).send({ status: 'error', message: 'Arquivo não encontrado' });
    if (imp.tela_suporte_arquivo_id === a.id) return reply.status(400).send({ status: 'error', message: 'Esta é a tela do Suporte da virada: troque-a na Ficha de coleta.' });
    await prisma.implantacaoArquivo.delete({ where: { id: a.id } });
    if (a.url.startsWith('disk:')) { const { unlink } = await import('fs/promises'); await unlink(a.url.slice(5)).catch(() => {}); }
    await atividade(imp.id, 'ARQUIVO', `🗑️ Anexo removido: ${a.nome}`, u);
    return reply.send({ status: 'success' });
  });

  // ── Inventário técnico da loja (fica no cliente; o suporte usa depois). Nunca guardar senhas.
  const acharInventario = async (clienteId: string | null, cnpj: string | null) => {
    if (clienteId) { const x = await prisma.inventarioTecnico.findFirst({ where: { cliente_id: clienteId }, orderBy: { updated_at: 'desc' } }); if (x) return x; }
    if (cnpj) return prisma.inventarioTecnico.findFirst({ where: { cliente_cnpj: cnpj }, orderBy: { updated_at: 'desc' } });
    return null;
  };
  fastify.get('/implantacoes/:id/inventario', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    return reply.send({ status: 'success', data: await acharInventario(imp.cliente_id, imp.cliente_cnpj) });
  });
  fastify.put('/implantacoes/:id/inventario', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({
      itens: z.array(z.object({ tipo: z.string().trim().min(1).max(40), descricao: z.string().trim().max(200).default(''), acesso_remoto: z.string().trim().max(80).default(''), observacao: z.string().trim().max(300).default('') })).max(80),
      versao_sistema: z.string().trim().max(60).optional(), observacoes: z.string().trim().max(3000).optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Inventário inválido' });
    if (b.data.itens.some(x => /senha|password|pwd/i.test(`${x.acesso_remoto} ${x.observacao}`))) return reply.status(400).send({ status: 'error', message: 'Não guarde senhas no inventário: só o ID do acesso remoto.' });
    const atual = await acharInventario(imp.cliente_id, imp.cliente_cnpj);
    const data = { itens: b.data.itens, versao_sistema: b.data.versao_sistema || null, observacoes: b.data.observacoes || null, atualizado_por: u.nome || u.id, cliente_id: imp.cliente_id || atual?.cliente_id || null, cliente_cnpj: imp.cliente_cnpj || atual?.cliente_cnpj || null };
    if (atual) await prisma.inventarioTecnico.update({ where: { id: atual.id }, data });
    else await prisma.inventarioTecnico.create({ data });
    await atividade(imp.id, 'NOTA', `🖥️ Inventário técnico atualizado (${b.data.itens.length} equipamento(s))`, u);
    return reply.send({ status: 'success' });
  });
  fastify.get('/implantacoes/inventario-cliente', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const clienteId = String((request.query as any)?.cliente_id || '');
    if (!clienteId) return reply.send({ status: 'success', data: null });
    const cli = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { cnpj: true } }).catch(() => null);
    return reply.send({ status: 'success', data: await acharInventario(clienteId, cli?.cnpj || null) });
  });

  // ── Termo de aceite (supervisão reenvia) e relatório final em PDF (equipe e cliente).
  fastify.post('/implantacoes/:id/termo-aceite', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const { enviarTermoAceite } = await import('@/services/implantacao-termo.service');
    const r = await enviarTermoAceite(prisma, (request.params as any).id);
    if (!r.ok) return reply.status(400).send({ status: 'error', message: r.motivo });
    return reply.send({ status: 'success' });
  });
  fastify.get('/implantacoes/:id/relatorio.pdf', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const termo = (request.query as any)?.termo === '1';
    const { pdfRelatorio } = await import('@/services/implantacao-termo.service');
    const pdf = await pdfRelatorio(prisma, imp.id, termo);
    if (!pdf) return reply.status(404).send({ status: 'error', message: 'Não foi possível gerar' });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${termo ? 'termo-de-aceite' : 'relatorio-implantacao'}.pdf"`);
    return reply.send(pdf);
  });

  // ── Indicadores da implantação (supervisão): mês pedido x mês anterior, com detalhe por técnico e metas.
  fastify.get('/implantacoes/indicadores', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const q = String((request.query as any)?.mes || '');
    const mes = /^\d{4}-\d{2}$/.test(q) ? q : diaSP(new Date()).slice(0, 7);
    const [y, m] = mes.split('-').map(Number);
    const limites = (yy: number, mm: number) => ({ ini: new Date(Date.UTC(yy, mm - 1, 1, 3)), fim: new Date(Date.UTC(yy, mm, 1, 3)) }); // meia-noite de Brasília
    const atual = limites(y, m), ant = limites(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
    const cfg = await obterConfigPortal(prisma);
    const metas = { ...METAS_PADRAO, ...((cfg as any).metas || {}) };
    const calcular = async ({ ini, fim }: { ini: Date; fim: Date }) => {
      const viradas = await prisma.implantacao.findMany({ where: { modulo: 'IMPLANTACAO', virada_fim_em: { gte: ini, lt: fim }, data_assinatura: { gte: CORTE_PORTAL } }, select: { id: true, tecnico_id: true, tecnico_nome: true, tipo_base: true, data_assinatura: true, virada_fim_em: true, prazo_virada: true, esperas: { select: { tipo: true, inicio: true, fim: true } } } });
      const vir = viradas.map(v => ({ ...v, virada_fim_em: v.virada_fim_em! }));
      const esperas = await prisma.implantacaoEspera.findMany({ where: { inicio: { lt: fim }, OR: [{ fim: null }, { fim: { gt: ini } }], implantacao: { data_assinatura: { gte: CORTE_PORTAL } } }, select: { tipo: true, inicio: true, fim: true, implantacao: { select: { tecnico_id: true } } } });
      const agora = new Date();
      const horasEspera: Record<string, number> = { PROGRAMACAO: 0, CLIENTE: 0, PROCESSAMENTO: 0 };
      for (const e of esperas) horasEspera[e.tipo] = (horasEspera[e.tipo] || 0) + Math.max(0, Math.min((e.fim || agora).getTime(), fim.getTime()) - Math.max(e.inicio.getTime(), ini.getTime())) / 36e5;
      const correcoes = await prisma.implantacaoOcorrencia.findMany({ where: { aberta_em: { gte: ini, lt: fim }, implantacao: { virada_fim_em: { not: null }, data_assinatura: { gte: CORTE_PORTAL } } }, select: { aberta_em: true, implantacao: { select: { virada_fim_em: true, tecnico_id: true } } } });
      const retrab = correcoes.filter(c => c.implantacao.virada_fim_em && c.aberta_em.getTime() - c.implantacao.virada_fim_em.getTime() <= 30 * 864e5);
      const concluidas = await prisma.implantacao.findMany({ where: { modulo: 'IMPLANTACAO', concluida_fila_em: { gte: ini, lt: fim }, data_assinatura: { gte: CORTE_PORTAL } }, select: { id: true, tecnico_id: true, sessoes: { select: { inicio: true, fim: true } } } });
      const horasDe = (c: { sessoes: { inicio: Date; fim: Date | null }[] }) => c.sessoes.reduce((t, s) => t + ((s.fim || agora).getTime() - s.inicio.getTime()), 0) / 36e5;
      const media = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
      const remarcacoes = await prisma.implantacaoAtividade.count({ where: { created_at: { gte: ini, lt: fim }, descricao: { startsWith: '📅 Virada remarcada' } } });
      const validadas = await prisma.implantacao.findMany({ where: { validado_em: { not: null } }, select: { cliente_id: true } });
      const clientes = [...new Set(validadas.map(v => v.cliente_id).filter(Boolean))] as string[];
      const pesquisas = clientes.length ? await prisma.pesquisaSatisfacao.findMany({ where: { created_at: { gte: ini, lt: fim }, cliente_id: { in: clientes }, nota_atendimento: { gt: 0 } }, select: { nota_atendimento: true } }) : [];
      const vi = indicadoresViradas(vir);
      const ids = [...new Set([...vir.map(v => v.tecnico_id), ...concluidas.map(c => c.tecnico_id), ...retrab.map(r => r.implantacao.tecnico_id)].filter(Boolean))] as string[];
      const por_tecnico = ids.map(tid => {
        const v = indicadoresViradas(vir.filter(x => x.tecnico_id === tid));
        const conc = concluidas.filter(c => c.tecnico_id === tid);
        return { tecnico_id: tid, nome: vir.find(x => x.tecnico_id === tid)?.tecnico_nome || null, viradas: v.total, dias_conversao: v.dias_conversao, dias_zerado: v.dias_zerado, no_prazo_pct: v.no_prazo_pct,
          retrabalho: retrab.filter(r => r.implantacao.tecnico_id === tid).length, horas_por_implantacao: media(conc.map(horasDe)), concluidas: conc.length };
      });
      return {
        viradas: vi.total, dias_conversao: vi.dias_conversao, dias_zerado: vi.dias_zerado, no_prazo_pct: vi.no_prazo_pct,
        espera_horas: Object.fromEntries(Object.entries(horasEspera).map(([k, v]) => [k, Math.round(v)])),
        retrabalho: retrab.length, retrabalho_por_virada: vi.total ? Math.round((retrab.length / vi.total) * 10) / 10 : null,
        horas_por_implantacao: media(concluidas.map(horasDe)), concluidas: concluidas.length,
        satisfacao: pesquisas.length ? Math.round((pesquisas.reduce((t, p) => t + p.nota_atendimento, 0) / pesquisas.length) * 10) / 10 : null, pesquisas: pesquisas.length,
        remarcacoes, por_tecnico,
      };
    };
    const [a, b] = await Promise.all([calcular(atual), calcular(ant)]);
    const nomes = new Map((await prisma.usuarioCRM.findMany({ where: { id: { in: a.por_tecnico.map(t => t.tecnico_id) } }, select: { id: true, nome: true } })).map(x => [x.id, x.nome]));
    a.por_tecnico.forEach(t => { t.nome = t.nome || nomes.get(t.tecnico_id) || 'Técnico'; });
    return reply.send({ status: 'success', data: { mes, atual: a, anterior: b, metas } });
  });

  // ── Preferência de cada pessoa: o que chega também no WhatsApp (o portal recebe tudo sempre).
  const chavePref = (uid: string) => `implantacao.pref.${uid}`;
  fastify.get('/implantacoes/minhas-preferencias', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const row = await prisma.configuracaoIntegracao.findUnique({ where: { chave: chavePref(u.id) } }).catch(() => null);
    let pref: any = {}; try { pref = row?.valor ? JSON.parse(row.valor) : {}; } catch { /* padrão */ }
    return reply.send({ status: 'success', data: { whatsapp: pref.whatsapp || 'URGENTES' } });
  });
  fastify.put('/implantacoes/minhas-preferencias', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const b = z.object({ whatsapp: z.enum(['URGENTES', 'TODOS', 'NENHUM']) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Escolha uma opção' });
    const valor = JSON.stringify({ whatsapp: b.data.whatsapp });
    await prisma.configuracaoIntegracao.upsert({ where: { chave: chavePref(u.id) }, create: { chave: chavePref(u.id), valor, updated_by: u.nome || u.id }, update: { valor, updated_by: u.nome || u.id } });
    return reply.send({ status: 'success' });
  });

  // ── Busca global (Ctrl+K): cliente, CNPJ ou técnico, só dentro do que a pessoa pode ver.
  fastify.get('/implantacoes/busca', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const q = String((request.query as any)?.q || '').trim().slice(0, 80);
    if (q.length < 2) return reply.send({ status: 'success', data: [] });
    const dig = q.replace(/\D/g, '');
    const OR: any[] = [{ cliente_razao_social: { contains: q } }, { tecnico_nome: { contains: q } }, { vendedor_nome: { contains: q } }];
    if (dig.length >= 3) OR.push({ cliente_cnpj: { contains: dig } }, { cliente_cnpj: { contains: q } });
    const where: any = { OR, data_assinatura: { gte: desdeQuadro() } };
    if (ehTecnico(u) && !ehGestaoTecnica(u)) where.tecnico_id = u.id;
    const lista = await prisma.implantacao.findMany({
      where, take: 12, orderBy: { data_assinatura: 'desc' },
      select: { id: true, cliente_razao_social: true, cliente_cnpj: true, modulo: true, tipo_servico: true, tipo_base: true, tecnico_nome: true, coluna: true, status: true, etapa_execucao: true },
    });
    return reply.send({ status: 'success', data: lista.map(i => ({
      id: i.id, cliente: i.cliente_razao_social, cnpj: i.cliente_cnpj, tecnico: i.tecnico_nome,
      tipo: i.modulo === 'SERVICO' ? `Serviço · ${(i.tipo_servico && TIPOS_SERVICO[i.tipo_servico]?.label) || 'Outro'}` : `Implantação · ${i.tipo_base === 'BANCO_ZERADO' ? 'banco zerado' : 'conversão'}`,
      coluna: COLUNAS.find(c => c.key === colunaDe(i))?.label || colunaDe(i),
    })) });
  });

  // ── Responsável da empresa (decisor): a supervisão informa, o técnico liga direto para ele.
  fastify.patch('/implantacoes/:id/decisor', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ nome: z.string().trim().max(120).default(''), telefone: z.string().trim().max(40).default('') }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const imp = await prisma.implantacao.findUnique({ where: { id }, select: { coleta: true } });
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const coleta: any = { ...((imp.coleta as any) || {}), decisor_nome: b.data.nome || null, decisor_telefone: b.data.telefone || null };
    await prisma.implantacao.update({ where: { id }, data: { coleta } });
    await atividade(id, 'NOTA', b.data.nome || b.data.telefone ? `👤 Responsável da empresa (decisor): ${b.data.nome || 'sem nome'}${b.data.telefone ? ` · ${b.data.telefone}` : ''}` : '👤 Responsável da empresa removido', u);
    return reply.send({ status: 'success' });
  });

  // ── Observações do card: compartilhadas (técnico + supervisão) e pessoais (só do autor)
  fastify.get('/implantacoes/:id/observacoes', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const lista = await prisma.implantacaoObservacao.findMany({
      where: { implantacao_id: imp.id, OR: [{ privada: false }, { privada: true, autor_id: u.id }] },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: { compartilhadas: lista.filter(o => !o.privada), pessoais: lista.filter(o => o.privada) } });
  });
  fastify.post('/implantacoes/:id/observacoes', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const imp = await demanda(u, (request.params as any).id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ texto: z.string().trim().min(1).max(5000), privada: z.boolean().default(false) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Escreva a observação.' });
    const obs = await prisma.implantacaoObservacao.create({ data: { implantacao_id: imp.id, autor_id: u.id, autor_nome: u.nome || null, texto: b.data.texto, privada: b.data.privada } });
    return reply.status(201).send({ status: 'success', data: obs });
  });
  // Só quem escreveu apaga a própria observação.
  fastify.delete('/implantacoes/observacoes/:obsId', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const r = await prisma.implantacaoObservacao.deleteMany({ where: { id: (request.params as any).obsId, autor_id: u.id } });
    if (!r.count) return reply.status(404).send({ status: 'error', message: 'Observação não encontrada' });
    return reply.send({ status: 'success' });
  });

  // ── Detalhe do portal (ficha, comunicações, fases, ocorrências, tempos)
  fastify.get('/implantacoes/:id/portal', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    if (imp.modulo === 'IMPLANTACAO') await garantirFasesTreinamento(prisma, id);
    const [checklist, fases, ocorrencias, comunicacoes, sessoes, esperas] = await Promise.all([
      prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id }, orderBy: [{ grupo: 'asc' }, { ordem: 'asc' }] }),
      prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: id }, orderBy: { ordem: 'asc' } }),
      prisma.implantacaoOcorrencia.findMany({ where: { implantacao_id: id }, orderBy: { aberta_em: 'desc' } }),
      prisma.implantacaoComunicacao.findMany({ where: { implantacao_id: id }, orderBy: { created_at: 'desc' } }),
      prisma.implantacaoSessao.findMany({ where: { implantacao_id: id }, orderBy: { inicio: 'asc' } }),
      prisma.implantacaoEspera.findMany({ where: { implantacao_id: id }, orderBy: { inicio: 'desc' } }),
    ]);
    const tempos = temposDaDemanda(sessoes, esperas, { inicio: imp.data_assinatura, conclusao: imp.data_conclusao });
    const assistidaRegs = await prisma.implantacaoAssistida.findMany({ where: { implantacao_id: id }, orderBy: { dia: 'asc' } });
    const [testesConv, anexos] = await Promise.all([
      prisma.implantacaoTeste.findMany({ where: { implantacao_id: id }, orderBy: { created_at: 'asc' } }),
      prisma.implantacaoArquivo.findMany({ where: { implantacao_id: id }, orderBy: { created_at: 'desc' }, select: { id: true, nome: true, tipo: true, url: true, descricao: true, enviado_por: true, created_at: true } }),
    ]);
    const tarefasCliente = await prisma.implantacaoTarefaCliente.findMany({ where: { implantacao_id: id }, orderBy: [{ status: 'asc' }, { created_at: 'asc' }] });
    const agoraP = new Date();
    const prazoP = prazoAjustado(imp.virada_fim_em || imp.modulo === 'SERVICO' ? imp.prazo_finalizacao : imp.prazo_virada, esperas, agoraP);
    const saude = saudeDoCard({ coluna: colunaDe(imp), sla: situacaoSla(imp.data_assinatura, prazoP, imp.modulo === 'SERVICO' || imp.virada_fim_em ? (imp.concluida_fila_em || imp.data_conclusao) : imp.virada_fim_em, agoraP),
      tecnico_id: imp.tecnico_id, designado_em: imp.designado_em, data_assinatura: imp.data_assinatura, ultima_sessao: sessoes.length ? sessoes.at(-1)!.inicio : null,
      esperas_abertas: esperas.filter(e => !e.fim), correcoes_altas: ocorrencias.filter(o => o.situacao !== 'RESOLVIDA' && o.gravidade === 'ALTA').length,
      tarefas_vencidas: tarefasCliente.filter(t => t.status === 'PENDENTE' && t.prazo && t.prazo < agoraP).length }, agoraP);
    // Ficha do cliente para o técnico: tudo do cadastro, menos dados financeiros e documentos pessoais.
    const cnpjLimpo = (imp.cliente_cnpj || '').replace(/\D/g, '');
    const cliente_ficha = await prisma.cliente.findFirst({
      where: imp.cliente_id ? { id: imp.cliente_id } : cnpjLimpo ? { OR: [{ cnpj: imp.cliente_cnpj! }, { cnpj: cnpjLimpo }] } : { id: '__nenhum__' },
      select: {
        id: true, codigo: true, nome: true, empresa: true, razao_social: true, nome_fantasia: true, cnpj: true, inscricao_estadual: true,
        situacao: true, segmento: true, grupo_tecnico: true, plano: true, regime_tributario: true, regiao: true, data_entrada: true,
        contato: true, telefone: true, telefone1: true, telefone2: true, ddd: true, tel_contato: true, contato2: true, tel_contato2: true, email: true, responsavel_nome: true,
        cep: true, endereco: true, numero_end: true, complemento: true, bairro: true, cidade: true, estado: true, observacoes: true,
      },
    }).catch(() => null);
    const venda = imp.venda_adicional_id ? await prisma.vendaAdicional.findUnique({ where: { id: imp.venda_adicional_id }, select: { descricao_servico: true, parceiro: { select: { nome: true } } } }).catch(() => null) : null;
    const tipo_demanda = imp.modulo === 'SERVICO'
      ? `Serviço · ${(imp.tipo_servico && TIPOS_SERVICO[imp.tipo_servico]?.label) || 'Outro'}`
      : `Implantação · ${imp.tipo_base === 'BANCO_ZERADO' ? 'banco zerado' : `conversão${imp.sistema_anterior ? ` de ${imp.sistema_anterior}` : ''}`}`;
    // Horas de treinamento por fase e de correção por ocorrência (cronômetro).
    const horasPorFase: Record<number, number> = {}, horasPorOcorrencia: Record<string, number> = {};
    for (const s of sessoes) {
      const ms = (s.fim || new Date()).getTime() - s.inicio.getTime();
      if (s.etapa === 'TREINAMENTO' && s.descricao && /^fase (\d+)/i.test(s.descricao)) { const f = Number(s.descricao.match(/^fase (\d+)/i)![1]); horasPorFase[f] = (horasPorFase[f] || 0) + ms; }
      if (s.ocorrencia_id) horasPorOcorrencia[s.ocorrencia_id] = (horasPorOcorrencia[s.ocorrencia_id] || 0) + ms;
    }
    return reply.send({ status: 'success', data: {
      implantacao: { ...imp, coluna: colunaDe(imp), progresso: progresso(imp, checklist) }, checklist, fases, ocorrencias, comunicacoes: comunicacoes.map(c => ({ ...c, texto: c.texto?.slice(0, 600) })),
      tempos, esperas, horas_por_fase: horasPorFase, horas_por_ocorrencia: horasPorOcorrencia,
      link_cliente: imp.token_cliente ? `${URL_FRONT()}/acompanhamento/${imp.token_cliente}` : null, campos_coleta: CAMPOS_COLETA,
      onboarding_secoes: ONBOARDING_SECOES, onboarding_ok: onboardingOk(imp, checklist), perguntas_primeiro_contato: PERGUNTAS_PRIMEIRO_CONTATO,
      proximo_passo: proximoPasso(imp, checklist, fases, ocorrencias.filter(o => o.situacao !== 'RESOLVIDA').length, { assistida: assistidaRegs, testes: testesConv }),
      testes: testesConv,
      anexos: anexos.map(a => ({ ...a, url: a.tipo === 'LINK' ? a.url : null, tela_suporte: a.id === imp.tela_suporte_arquivo_id })),
      assistida: (() => { const st = statusAssistida(imp, assistidaRegs); return st ? { ...st, registros: assistidaRegs } : null; })(),
      saude, prazo_efetivo: prazoP, prazo_ajuste_ms: msEsperaCliente(esperas, agoraP), tarefas_cliente: tarefasCliente.map(({ arquivo_caminho, ...t }) => ({ ...t, tem_arquivo: !!arquivo_caminho, vencida: t.status === 'PENDENTE' && !!t.prazo && t.prazo < agoraP })),
      cliente_ficha, tipo_demanda, servico_descricao: venda ? [venda.parceiro?.nome, venda.descricao_servico].filter(Boolean).join(' · ') || null : null,
    } });
  });

  // ── Onboarding técnico: implantações e em que pé está o primeiro contato
  fastify.get('/implantacoes/onboarding', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const where: any = { modulo: 'IMPLANTACAO', status: { not: 'CANCELADA' }, data_assinatura: { gte: desdeQuadro() } };
    if (ehTecnico(u) && !ehGestaoTecnica(u)) where.tecnico_id = u.id;
    const lista = await prisma.implantacao.findMany({ where, orderBy: { data_assinatura: 'asc' }, include: { checklist: { where: { grupo: 'ONBOARDING' }, select: { titulo: true, feito: true } } } });
    const { SLA_ONBOARDING_DIAS_UTEIS, somarDiasUteis } = await import('@/lib/implantacao/portal');
    const agora = new Date();
    const cards = lista.filter(i => !ehLegado(i)).map(i => {
      const feitos = i.checklist.filter(c => c.feito).length, total = i.checklist.length;
      const aprovado = i.checklist.find(c => c.titulo === ITEM_APROVACAO)?.feito || !!i.onboarding_aprovado_em;
      const etapa = i.onboarding_concluido_em ? 'CONCLUIDO' : !i.tecnico_id ? 'SEM_TECNICO' : feitos === 0 ? 'PRIMEIRO_CONTATO' : feitos >= total - 1 && !aprovado ? 'APROVACAO' : 'DIAGNOSTICO';
      const prazo = i.designado_em ? somarDiasUteis(i.designado_em, SLA_ONBOARDING_DIAS_UTEIS) : null;
      return { id: i.id, cliente_razao_social: i.cliente_razao_social, tipo_base: i.tipo_base, sistema_anterior: i.sistema_anterior, tecnico_nome: i.tecnico_nome, designado_em: i.designado_em,
        data_assinatura: i.data_assinatura, feitos, total, etapa, prazo, atrasado: !i.onboarding_concluido_em && !!prazo && prazo < agora, aprovado_cliente_em: i.onboarding_aprovado_em, concluido_em: i.onboarding_concluido_em };
    });
    return reply.send({ status: 'success', data: cards });
  });

  // ── Prazos (SLA) da demanda (gestão)
  fastify.patch('/implantacoes/:id/prazos', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const b = z.object({ prazo_virada: z.string().nullable().optional(), prazo_finalizacao: z.string().nullable().optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Datas inválidas' });
    const d = (v?: string | null) => v === undefined ? undefined : v ? new Date(/T/.test(v) ? v : `${v}T18:00:00-03:00`) : null;
    const imp = await prisma.implantacao.update({ where: { id }, data: { prazo_virada: d(b.data.prazo_virada), prazo_finalizacao: d(b.data.prazo_finalizacao), sla_aviso: null } });
    await atividade(id, 'NOTA', `⏱️ Prazo ajustado: virada ${fmtData(imp.prazo_virada)} · finalização ${fmtData(imp.prazo_finalizacao)}`, u);
    return reply.send({ status: 'success', data: imp });
  });

  // ── Avisos para o técnico
  fastify.post('/implantacoes/avisos', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const b = z.object({ para_id: z.string().min(1), texto: z.string().min(2).max(2000), prioridade: z.enum(['NORMAL', 'URGENTE']).default('NORMAL'), implantacao_id: z.string().optional().nullable(), tipo: z.enum(['AVISO', 'TAREFA']).default('AVISO'), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Escreva o recado e escolha o técnico' });
    const prazo = b.data.tipo === 'TAREFA' && b.data.prazo ? new Date(`${b.data.prazo}T18:00:00-03:00`) : null;
    const aviso = await avisarTecnico(prisma, { ...b.data, prazo, de: { id: u.id, nome: u.nome }, origem: 'GESTAO' });
    if (!aviso) return reply.status(404).send({ status: 'error', message: 'Técnico não encontrado' });
    if (b.data.implantacao_id) await atividade(b.data.implantacao_id, 'NOTA', `📌 Aviso para ${aviso.para_nome}: ${b.data.texto}`, u);
    return reply.status(201).send({ status: 'success', data: aviso });
  });
  fastify.get('/implantacoes/avisos', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const q = request.query as { enviados?: string };
    const where: any = q.enviados === '1' && ehGestaoTecnica(u) ? { created_at: { gte: CORTE_PORTAL } } : { para_id: u.id, lido_em: null, created_at: { gte: CORTE_PORTAL }, ...soDoDesignado(u) }; // lido confirmado sai da lista (fica no radar da supervisão)
    const avisos = await prisma.avisoTecnico.findMany({ where, orderBy: { created_at: 'desc' }, take: 80, include: { implantacao: { select: { id: true, cliente_razao_social: true, tecnico_id: true } } } });
    const naoLidos = await prisma.avisoTecnico.count({ where: { para_id: u.id, lido_em: null, created_at: { gte: CORTE_PORTAL }, ...soDoDesignado(u) } });
    return reply.send({ status: 'success', data: { avisos, nao_lidos: naoLidos } });
  });
  fastify.post('/implantacoes/avisos/:avisoId/lido', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { avisoId } = request.params as { avisoId: string };
    const r = await prisma.avisoTecnico.updateMany({ where: { id: avisoId, para_id: u.id, lido_em: null }, data: { lido_em: new Date() } });
    // Recado de uma demanda: a leitura confirmada fica no histórico do card do cliente.
    if (r.count) {
      const av = await prisma.avisoTecnico.findUnique({ where: { id: avisoId }, select: { implantacao_id: true, texto: true, de_nome: true } });
      if (av?.implantacao_id) await atividade(av.implantacao_id, 'NOTA', `✅ ${u.nome || 'Técnico'} confirmou a leitura do recado de ${av.de_nome || 'Gestão'}: ${av.texto}`, u);
    }
    return reply.send({ status: 'success' });
  });
  // Tarefa avulsa: o técnico (ou a gestão) marca como concluída; reabrir também é possível.
  fastify.post('/implantacoes/tarefas/:tarefaId/concluir', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { tarefaId } = request.params as { tarefaId: string };
    const t = await prisma.avisoTecnico.findUnique({ where: { id: tarefaId } });
    if (!t || t.tipo !== 'TAREFA' || (t.para_id !== u.id && !ehGestaoTecnica(u))) return reply.status(404).send({ status: 'error', message: 'Tarefa não encontrada' });
    const reabrir = !!(request.body as any)?.reabrir;
    await prisma.avisoTecnico.update({ where: { id: t.id }, data: { concluida_em: reabrir ? null : new Date(), lido_em: t.lido_em || new Date() } });
    if (!reabrir && t.implantacao_id) await atividade(t.implantacao_id, 'NOTA', `✅ Tarefa concluída por ${u.nome || 'técnico'}: ${t.texto}`, u);
    return reply.send({ status: 'success' });
  });

  // ── Início do Portal Técnico: frase do dia, meu dia, tarefas, recados e o que pede atenção agora.
  fastify.get('/implantacoes/inicio', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { fraseDoDia, saudacao } = await import('@/lib/implantacao/frases');
    const agora = new Date(), hoje = diaSP(agora);
    const iniHoje = emSP(hoje, '00:00'), fimHoje = new Date(iniHoje.getTime() + 864e5);
    const gestao = ehGestaoTecnica(u);
    const [sessoesHoje, tarefas, recados, minhas] = await Promise.all([
      prisma.implantacaoSessao.findMany({ where: { tecnico_id: u.id, inicio: { lt: fimHoje }, OR: [{ fim: null }, { fim: { gt: iniHoje } }] } }),
      prisma.avisoTecnico.findMany({ where: { tipo: 'TAREFA', created_at: { gte: CORTE_PORTAL }, ...(gestao ? {} : { para_id: u.id }), AND: [soDoDesignado(u)], OR: [{ concluida_em: null }, { concluida_em: { gte: new Date(agora.getTime() - 3 * 864e5) } }] }, include: { implantacao: { select: { id: true, cliente_razao_social: true } } }, orderBy: [{ concluida_em: 'asc' }, { prazo: 'asc' }, { created_at: 'desc' }], take: 40 }),
      prisma.avisoTecnico.findMany({ where: { para_id: u.id, tipo: 'AVISO', created_at: { gte: CORTE_PORTAL }, lido_em: null, AND: [soDoDesignado(u)] }, include: { implantacao: { select: { id: true, cliente_razao_social: true } } }, orderBy: { created_at: 'desc' }, take: 10 }),
      prisma.implantacao.findMany({ where: { concluida_fila_em: null, data_conclusao: null, status: { not: 'CANCELADA' }, data_assinatura: { gte: desdeQuadro(agora.getTime()) }, ...(gestao ? {} : { tecnico_id: u.id }) },
        include: { esperas: true, treinamento_fases: true, testes: { select: { resultado: true } }, checklist: { select: { grupo: true, titulo: true, feito: true } }, ocorrencias: { where: { situacao: { not: 'RESOLVIDA' } }, select: { gravidade: true } }, assistida: { select: { dia: true } }, sessoes: { orderBy: { inicio: 'desc' }, take: 1, select: { inicio: true } } } }),
    ]);
    const viradaHoje = minhas.some(i => i.virada_inicio_em && diaSP(i.virada_inicio_em) === hoje && i.tecnico_id === u.id);
    const resumo = resumoDoDia(sessoesHoje, hoje, { cfg: await obterJornada(prisma), virada: viradaHoje });
    // O que pede atenção: prazo estourado/em risco, demanda parada, virada em andamento, fases de treinamento marcadas para os próximos 7 dias.
    const atencao: { tipo: string; texto: string; implantacao_id: string; ordem: number }[] = [];
    for (const i of minhas) {
      const prazo = prazoAjustado(i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada, i.esperas, agora);
      const s = situacaoSla(i.data_assinatura, prazo, null, agora);
      if (s?.situacao === 'ESTOURADO') atencao.push({ tipo: 'ESTOURADO', texto: `${i.cliente_razao_social}: prazo estourado (${fmtData(prazo)})`, implantacao_id: i.id, ordem: 0 });
      else if (s?.situacao === 'EM_RISCO') atencao.push({ tipo: 'RISCO', texto: `${i.cliente_razao_social}: prazo em risco, vence ${fmtData(prazo)}`, implantacao_id: i.id, ordem: 1 });
      for (const e of i.esperas.filter(x => !x.fim)) atencao.push({ tipo: 'ESPERA', texto: `${i.cliente_razao_social}: parada (${e.tipo === 'PROGRAMACAO' ? 'aguardando programação' : e.tipo === 'CLIENTE' ? 'aguardando cliente' : 'processamento'}): ${e.motivo}`, implantacao_id: i.id, ordem: 2 });
      if (i.virada_inicio_em && !i.virada_fim_em) atencao.push({ tipo: 'VIRADA', texto: `${i.cliente_razao_social}: virada em andamento, clique em "Loja virada" ao terminar`, implantacao_id: i.id, ordem: 1 });
      for (const f of i.treinamento_fases.filter(x => x.marcada_em && !x.realizada_em)) if (f.marcada_em! < new Date(agora.getTime() + 7 * 864e5)) atencao.push({ tipo: 'TREINO', texto: `${i.cliente_razao_social}: treinamento fase ${f.ordem} (${f.nome}) em ${fmtData(f.marcada_em)}`, implantacao_id: i.id, ordem: 3 });
      if (!i.tecnico_id && gestao) atencao.push({ tipo: 'SEM_TECNICO', texto: `${i.cliente_razao_social}: sem técnico designado`, implantacao_id: i.id, ordem: 1 });
    }
    atencao.sort((a, b) => a.ordem - b.ordem);
    const limite = new Date(agora.getTime() + 14 * 864e5);
    const agenda = [
      ...minhas.filter(i => i.virada_agendada_para && !i.virada_inicio_em && i.virada_agendada_para >= iniHoje && i.virada_agendada_para <= limite)
        .map(i => ({ tipo: 'VIRADA', quando: i.virada_agendada_para!, dia_todo: false, titulo: `Virada${i.virada_duracao_h ? ` (${i.virada_duracao_h}h)` : ''}`, cliente: i.cliente_razao_social, implantacao_id: i.id, tecnico: i.tecnico_nome })),
      ...minhas.flatMap(i => i.treinamento_fases.filter(f => f.marcada_em && !f.realizada_em && f.marcada_em >= iniHoje && f.marcada_em <= limite)
        .map(f => ({ tipo: 'TREINO', quando: f.marcada_em!, dia_todo: true, titulo: `Treinamento fase ${f.ordem}: ${f.nome}`, cliente: i.cliente_razao_social, implantacao_id: i.id, tecnico: i.tecnico_nome }))),
    ].sort((a, b) => a.quando.getTime() - b.quando.getTime());
    // Próximo passo e saúde de cada demanda: "sua vez" (técnico) e os números que pedem ação (supervisão).
    const vencidas = new Map((await prisma.implantacaoTarefaCliente.groupBy({ by: ['implantacao_id'], where: { implantacao_id: { in: minhas.map(m => m.id) }, status: 'PENDENTE', prazo: { lt: agora } }, _count: { _all: true } })).map(g => [g.implantacao_id, g._count._all]));
    const leitura = minhas.map(i => {
      const pp = proximoPasso(i, i.checklist, i.treinamento_fases, i.ocorrencias.length, { assistida: i.assistida, agora, testes: i.testes });
      const prazo = prazoAjustado(i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada, i.esperas, agora);
      const saude = saudeDoCard({ coluna: colunaDe(i), sla: situacaoSla(i.data_assinatura, prazo, null, agora), tecnico_id: i.tecnico_id, designado_em: i.designado_em, data_assinatura: i.data_assinatura,
        ultima_sessao: i.sessoes[0]?.inicio || null, esperas_abertas: i.esperas.filter(e => !e.fim), correcoes_altas: i.ocorrencias.filter(o => o.gravidade === 'ALTA').length, tarefas_vencidas: vencidas.get(i.id) || 0 }, agora);
      return { id: i.id, cliente: i.cliente_razao_social, tecnico_id: i.tecnico_id, tecnico: i.tecnico_nome, coluna: colunaDe(i), passo: pp, saude };
    });
    const PESO: Record<string, number> = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
    const sua_vez = leitura.filter(l => l.passo.quem === 'TECNICO' && l.tecnico_id === u.id)
      .sort((a, b) => PESO[a.saude.nivel] - PESO[b.saude.nivel]).slice(0, 12)
      .map(l => ({ implantacao_id: l.id, cliente: l.cliente, titulo: l.passo.titulo, detalhe: l.passo.detalhe || null, saude: l.saude }));
    let acao: any = null;
    if (gestao) {
      const tecnicos = await prisma.usuarioCRM.findMany({ where: { cargo: { in: CARGOS_TECNICO } }, select: { id: true } }).catch(() => []);
      acao = {
        sem_tecnico: leitura.filter(l => !l.tecnico_id && !['CANCELADOS', 'FINALIZADO'].includes(l.coluna)).length,
        em_risco: leitura.filter(l => l.saude.nivel !== 'VERDE').length,
        esperando_validacao: leitura.filter(l => l.coluna === 'CONCLUIDO').length,
        recados_sem_leitura: tecnicos.length ? await prisma.avisoTecnico.count({ where: { para_id: { in: tecnicos.map(t => t.id) }, lido_em: null, tipo: 'AVISO', created_at: { gte: CORTE_PORTAL } } }) : 0,
      };
    }
    return reply.send({ status: 'success', data: {
      agenda, sua_vez, acao,
      saudacao: `${saudacao(agora)}, ${(u.nome || '').split(' ')[0] || 'tudo bem'}!`, frase: fraseDoDia(agora),
      hoje: { ...resumo, virada: viradaHoje },
      tarefas: tarefas.map(t => ({ ...t, atrasada: !t.concluida_em && !!t.prazo && t.prazo < agora })),
      recados, atencao: atencao.slice(0, 15), demandas_ativas: minhas.length, gestao,
    } });
  });

  fastify.post('/implantacoes/avisos/lidos', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    await prisma.avisoTecnico.updateMany({ where: { para_id: u.id, lido_em: null }, data: { lido_em: new Date() } });
    return reply.send({ status: 'success' });
  });

  // ── Virada da loja e cobrança
  fastify.post('/implantacoes/:id/virada/iniciar', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    if (imp.modulo !== 'IMPLANTACAO') return reply.status(400).send({ status: 'error', message: 'Virada é só para implantação' });
    if (imp.virada_inicio_em) return reply.status(400).send({ status: 'error', message: 'A virada já foi iniciada' });
    // Pré-requisitos da virada: travam para o técnico; a supervisão pode liberar mesmo assim (fica no histórico).
    const falta = pendenciasIniciarVirada(imp, await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id }, select: { grupo: true, titulo: true, feito: true } }),
      await prisma.implantacaoTeste.findMany({ where: { implantacao_id: id }, select: { resultado: true } }));
    const forcar = !!(request.body as any)?.forcar && ehGestaoTecnica(u);
    if (falta.length && !forcar) return reply.status(400).send({ status: 'error', message: `Antes de iniciar a virada: ${falta.join('; ')}.`, data: { pendencias: falta } });
    if (falta.length) await atividade(id, 'NOTA', `⚠️ ${u.nome || 'Supervisão'} liberou a virada com pendências: ${falta.join('; ')}`, u);
    await prisma.implantacao.update({ where: { id }, data: { virada_inicio_em: new Date(), coluna: 'EM_ANDAMENTO', etapa_execucao: etapaDaColuna('EM_ANDAMENTO', imp) } });
    await atividade(id, 'NOTA', `🚀 ${u.nome || 'Técnico'} iniciou a virada da loja`, u);
    const { enviarAvisoGestao } = await import('@/services/assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🚀 *Virada iniciada*: ${imp.cliente_razao_social} (${u.nome || 'técnico'}).`, { somenteAprovadora: true }).catch(() => {});
    return reply.send({ status: 'success' });
  });
  fastify.post('/implantacoes/:id/virada/concluir', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    // Virada retroativa (só a gestão): informa a data em que a loja começou a usar; não precisa ter iniciado
    // pelo portal nem anexar a tela, e o cliente não recebe mensagem nenhuma por isso.
    const b = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(request.body || {});
    const retro = b.success && b.data.data ? new Date(`${b.data.data}T12:00:00-03:00`) : null;
    if (retro && !ehGestaoTecnica(u)) return reply.status(403).send({ status: 'error', message: 'Só a gestão lança virada retroativa' });
    if (retro && retro > new Date()) return reply.status(400).send({ status: 'error', message: 'A data da virada não pode ser no futuro' });
    if (!retro && !imp.virada_inicio_em) return reply.status(400).send({ status: 'error', message: 'Clique em "Iniciar virada" primeiro' });
    if (!retro) {
      const falta = pendenciasConcluirVirada(imp, await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: id }, select: { grupo: true, titulo: true, feito: true } }));
      const forcar = !!(request.body as any)?.forcar && ehGestaoTecnica(u);
      if (falta.length && !forcar) return reply.status(400).send({ status: 'error', message: `Antes de marcar "Loja virada": ${falta.join('; ')}.`, data: { pendencias: falta } });
      if (falta.length) await atividade(id, 'NOTA', `⚠️ ${u.nome || 'Supervisão'} marcou a loja virada com pendências: ${falta.join('; ')}`, u);
    }
    if (imp.virada_fim_em && !retro) return reply.status(400).send({ status: 'error', message: 'A loja já foi virada' });
    const agora = retro || new Date();
    const venc = primeiroVencimento(agora);
    await prisma.implantacao.update({ where: { id }, data: { virada_inicio_em: imp.virada_inicio_em || agora, virada_fim_em: agora, coluna: 'ACOMPANHAMENTO', etapa_execucao: 'EM_TREINAMENTO', treinamento_inicio: imp.treinamento_inicio || agora } });
    await confirmarImplantacao(prisma, id, { data_instalacao: agora, data_primeiro_vencimento: venc, status: 'INSTALADO' });
    await garantirFasesTreinamento(prisma, id);
    await atividade(id, 'NOTA', `✅ Loja virada${retro ? ' (lançada retroativamente)' : ''}. Início de uso ${fmtData(agora)}; 1º vencimento ${fmtData(venc)}. Cobrança pendente de lançamento.`, u);
    if (retro || ehLegado(imp)) return reply.send({ status: 'success', data: { virada_fim_em: agora, data_primeiro_vencimento: venc } });
    const { enviarAvisoGestao } = await import('@/services/assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `✅ *Loja virada*: ${imp.cliente_razao_social}\nInício de uso: ${fmtData(agora)}\n1º vencimento: *${fmtData(venc)}*${imp.mensalidade ? `\nMensalidade: R$ ${imp.mensalidade.toFixed(2).replace('.', ',')}` : ''}\n\n💰 Lance a cobrança e marque "Cobrança lançada" no Portal Técnico.`, { somenteAprovadora: true }).catch(() => {});
    return reply.send({ status: 'success', data: { virada_fim_em: agora, data_primeiro_vencimento: venc } });
  });
  fastify.post('/implantacoes/:id/cobranca-lancada', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await prisma.implantacao.findUnique({ where: { id } });
    if (!imp?.virada_fim_em) return reply.status(400).send({ status: 'error', message: 'A loja ainda não foi virada' });
    await prisma.implantacao.update({ where: { id }, data: { cobranca_lancada_em: new Date(), cobranca_lancada_por: u.nome || u.id } });
    await atividade(id, 'NOTA', `💰 Cobrança da mensalidade lançada (1º vencimento ${fmtData(imp.data_primeiro_vencimento)})`, u);
    return reply.send({ status: 'success' });
  });
  fastify.get('/implantacoes/cobrancas-pendentes', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const lista = await prisma.implantacao.findMany({ where: { virada_fim_em: { not: null }, cobranca_lancada_em: null }, orderBy: { virada_fim_em: 'asc' }, select: { id: true, cliente_razao_social: true, virada_fim_em: true, data_primeiro_vencimento: true, mensalidade: true, plano: true } });
    return reply.send({ status: 'success', data: lista });
  });

  // ── Treinamento em fases
  fastify.patch('/implantacoes/fases/:faseId', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { faseId } = request.params as { faseId: string };
    const b = z.object({ nome: z.string().min(2).max(120).optional(), marcada_em: z.string().nullable().optional(), realizada_em: z.string().nullable().optional(), observacao: z.string().max(2000).nullable().optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const f = await prisma.implantacaoTreinamentoFase.findUnique({ where: { id: faseId } });
    if (!f || !(await demanda(u, f.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Fase não encontrada' });
    const d = (v?: string | null) => v === undefined ? undefined : v ? new Date(/T/.test(v) ? v : `${v}T12:00:00-03:00`) : null;
    const novaData = b.data.marcada_em !== undefined && (d(b.data.marcada_em)?.getTime() ?? null) !== (f.marcada_em?.getTime() ?? null);
    const atual = await prisma.implantacaoTreinamentoFase.update({ where: { id: faseId }, data: { nome: b.data.nome, marcada_em: d(b.data.marcada_em), realizada_em: d(b.data.realizada_em), observacao: b.data.observacao, ...(novaData ? { lembrete_em: null } : {}) } });
    if (novaData && atual.marcada_em && !atual.realizada_em && diaSP(atual.marcada_em) >= diaSP(new Date())) {
      const imp = await prisma.implantacao.findUnique({ where: { id: f.implantacao_id } });
      if (imp) await avisarClienteAgenda(prisma, imp, `AGENDA_TREINO_${f.ordem}`, textoAgendaTreino(imp, atual, atual.marcada_em, false)).catch(() => {});
    }
    if (b.data.realizada_em && !f.realizada_em) {
      await atividade(f.implantacao_id, 'TREINAMENTO', `🎓 Fase ${f.ordem} do treinamento realizada: ${atual.nome}`, u);
      const todas = await prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: f.implantacao_id } });
      if (todas.every(x => x.realizada_em)) await prisma.implantacao.update({ where: { id: f.implantacao_id }, data: { treinamento_fim: new Date() } });
    } else if (b.data.marcada_em) await atividade(f.implantacao_id, 'TREINAMENTO', `📅 Fase ${f.ordem} (${atual.nome}) marcada para ${fmtData(atual.marcada_em)}`, u);
    return reply.send({ status: 'success', data: atual });
  });

  // ── Correções e bugs pós-conversão/virada
  fastify.post('/implantacoes/:id/ocorrencias', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    if (!(await demanda(u, id))) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    const b = z.object({ titulo: z.string().min(3).max(200), descricao: z.string().max(4000).optional().nullable(), gravidade: z.enum(['BAIXA', 'MEDIA', 'ALTA']).default('MEDIA') }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dê um título para a correção' });
    const oc = await prisma.implantacaoOcorrencia.create({ data: { implantacao_id: id, ...b.data, aberta_por: u.nome || u.id } });
    await atividade(id, 'NOTA', `🐞 Correção aberta (${b.data.gravidade}): ${b.data.titulo}`, u);
    return reply.status(201).send({ status: 'success', data: oc });
  });
  fastify.patch('/implantacoes/ocorrencias/:ocId', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { ocId } = request.params as { ocId: string };
    const b = z.object({ situacao: z.enum(['ABERTA', 'EM_CORRECAO', 'AGUARDANDO_PROGRAMACAO', 'RESOLVIDA']).optional(), resolucao: z.string().max(4000).optional().nullable(), gravidade: z.enum(['BAIXA', 'MEDIA', 'ALTA']).optional() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const oc = await prisma.implantacaoOcorrencia.findUnique({ where: { id: ocId } });
    if (!oc || !(await demanda(u, oc.implantacao_id))) return reply.status(404).send({ status: 'error', message: 'Correção não encontrada' });
    const atual = await prisma.implantacaoOcorrencia.update({ where: { id: ocId }, data: { ...b.data, resolvida_em: b.data.situacao === 'RESOLVIDA' ? new Date() : b.data.situacao ? null : undefined } });
    if (b.data.situacao && b.data.situacao !== oc.situacao) await atividade(oc.implantacao_id, 'NOTA', `🐞 Correção "${oc.titulo}": ${b.data.situacao.replace('_', ' ').toLowerCase()}${b.data.resolucao ? `. ${b.data.resolucao}` : ''}`, u);
    return reply.send({ status: 'success', data: atual });
  });

  // ── Página do cliente: gerar link (demandas antigas) e ver a prévia
  fastify.post('/implantacoes/:id/pagina-cliente', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { id } = request.params as { id: string };
    const imp = await demanda(u, id);
    if (!imp) return reply.status(404).send({ status: 'error', message: 'Demanda não encontrada' });
    let token = imp.token_cliente;
    if (!token) {
      token = novoTokenCliente();
      await prisma.implantacao.update({ where: { id }, data: { token_cliente: token } });
      await pularMarcosPassados(prisma, id); // o cliente só recebe os próximos avisos, nada atrasado
      await atividade(id, 'NOTA', '🔗 Página de acompanhamento do cliente criada', u);
    }
    return reply.send({ status: 'success', data: { link: `${URL_FRONT()}/acompanhamento/${token}` } });
  });

  // ── Públicas (sem login): acompanhamento do cliente e pendências da programação
  fastify.get('/publico/acompanhamento/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    if (!token || token.length < 12) return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const imp = await prisma.implantacao.findUnique({ where: { token_cliente: token } });
    if (!imp || imp.status === 'CANCELADA') return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const tarefas = await prisma.implantacaoTarefaCliente.findMany({ where: { implantacao_id: imp.id }, orderBy: [{ status: 'asc' }, { created_at: 'asc' }], select: { id: true, titulo: true, descricao: true, prazo: true, status: true, exige_arquivo: true, enviada_em: true, arquivo_nome: true, devolvida_motivo: true } });
    return reply.send({ status: 'success', data: { ...(await visaoCliente(prisma, imp)), tarefas_cliente: tarefas } });
  });

  // Cliente envia o que a implantação precisa (arquivo até 15 MB e/ou texto) pela página de acompanhamento.
  fastify.post('/publico/acompanhamento/:token/tarefas/:tarefaId', async (request, reply) => {
    const { token, tarefaId } = request.params as { token: string; tarefaId: string };
    if (!token || token.length < 12) return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const imp = await prisma.implantacao.findUnique({ where: { token_cliente: token } });
    if (!imp || imp.status === 'CANCELADA') return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const t = await prisma.implantacaoTarefaCliente.findUnique({ where: { id: tarefaId } });
    if (!t || t.implantacao_id !== imp.id) return reply.status(404).send({ status: 'error', message: 'Item não encontrado' });
    if (t.status === 'CONCLUIDA') return reply.status(400).send({ status: 'error', message: 'Este item já foi conferido pela equipe.' });
    const b = z.object({ nome: z.string().max(200).optional(), arquivo: z.string().max(22 * 1024 * 1024).optional(), texto: z.string().trim().max(3000).optional() }).safeParse(request.body);
    if (!b.success || (!b.data.arquivo && !b.data.texto)) return reply.status(400).send({ status: 'error', message: 'Anexe o arquivo ou escreva a resposta.' });
    if (t.exige_arquivo && !b.data.arquivo) return reply.status(400).send({ status: 'error', message: 'Este item precisa de um arquivo.' });
    let arq: Awaited<ReturnType<typeof salvarArquivoCliente>> | null = null;
    if (b.data.arquivo) {
      try { arq = await salvarArquivoCliente(imp.id, t.id, b.data.nome || 'arquivo', b.data.arquivo); }
      catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível salvar o arquivo.' }); }
    }
    await prisma.implantacaoTarefaCliente.update({ where: { id: t.id }, data: { status: 'ENVIADA', enviada_em: new Date(), resposta_texto: b.data.texto || t.resposta_texto, devolvida_motivo: null, ...(arq ? { arquivo_caminho: arq.caminho, arquivo_nome: arq.nome, arquivo_mime: arq.mime, arquivo_tamanho: arq.tamanho } : {}) } });
    await atividade(imp.id, 'ARQUIVO', `📎 O cliente enviou: ${t.titulo}${arq ? ` (${arq.nome})` : ''}`, { nome: 'Cliente (página de acompanhamento)' });
    await fecharEsperaDeTarefa(prisma, imp.id, 'Cliente').catch(() => {});
    if (imp.tecnico_id) await avisarTecnico(prisma, { para_id: imp.tecnico_id, implantacao_id: imp.id, origem: 'SISTEMA', texto: `📎 ${imp.cliente_razao_social} enviou "${t.titulo}". Confira na aba Cliente › Tarefas do cliente.` }).catch(() => null);
    return reply.send({ status: 'success' });
  });

  // Relatório final para o cliente (depois que a Prosystem valida).
  fastify.get('/publico/acompanhamento/:token/relatorio.pdf', async (request, reply) => {
    const { token } = request.params as { token: string };
    if (!token || token.length < 12) return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const imp = await prisma.implantacao.findUnique({ where: { token_cliente: token } });
    if (!imp || imp.status === 'CANCELADA' || !imp.validado_em) return reply.status(404).send({ status: 'error', message: 'O relatório fica disponível depois da conclusão.' });
    const { pdfRelatorio } = await import('@/services/implantacao-termo.service');
    const pdf = await pdfRelatorio(prisma, imp.id, false);
    if (!pdf) return reply.status(404).send({ status: 'error', message: 'Não foi possível gerar' });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'inline; filename="relatorio-implantacao.pdf"');
    return reply.send(pdf);
  });

  // Cliente confirma quem participou de uma fase do treinamento (comprovação).
  fastify.post('/publico/acompanhamento/:token/treinamento/:faseId/confirmar', async (request, reply) => {
    const { token, faseId } = request.params as { token: string; faseId: string };
    if (!token || token.length < 12) return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const imp = await prisma.implantacao.findUnique({ where: { token_cliente: token } });
    if (!imp || imp.status === 'CANCELADA') return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const f = await prisma.implantacaoTreinamentoFase.findUnique({ where: { id: faseId } });
    if (!f || f.implantacao_id !== imp.id || !f.realizada_em) return reply.status(404).send({ status: 'error', message: 'Fase não encontrada' });
    if (f.confirmado_em) return reply.status(400).send({ status: 'error', message: 'Esta fase já foi confirmada.' });
    const b = z.object({ participantes: z.array(z.string().trim().min(2).max(80)).min(1).max(40), nome: z.string().trim().min(3).max(100) }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Informe quem participou e o seu nome.' });
    await prisma.implantacaoTreinamentoFase.update({ where: { id: f.id }, data: { participantes: b.data.participantes, confirmado_em: new Date(), confirmado_por: b.data.nome } });
    await atividade(imp.id, 'TREINAMENTO', `✍️ ${b.data.nome} confirmou o treinamento da fase ${f.ordem} (${f.nome}): ${b.data.participantes.join(', ')}`, { nome: 'Cliente (página de acompanhamento)' });
    if (imp.tecnico_id) await avisarTecnico(prisma, { para_id: imp.tecnico_id, implantacao_id: imp.id, origem: 'SISTEMA', texto: `✍️ ${imp.cliente_razao_social} confirmou o treinamento da fase ${f.ordem} (${b.data.participantes.length} participante(s)).` }).catch(() => null);
    return reply.send({ status: 'success' });
  });

  // Cliente aprova o diagnóstico do onboarding técnico pela página de acompanhamento.
  fastify.post('/publico/acompanhamento/:token/aprovar-diagnostico', async (request, reply) => {
    const { token } = request.params as { token: string };
    const imp = await prisma.implantacao.findUnique({ where: { token_cliente: token } });
    if (!imp || imp.status === 'CANCELADA') return reply.status(404).send({ status: 'error', message: 'Página não encontrada' });
    const nome = String((request.body as any)?.nome || '').trim().slice(0, 120);
    if (nome.split(/\s+/).length < 2) return reply.status(400).send({ status: 'error', message: 'Informe seu nome completo para aprovar.' });
    if (!imp.onboarding_aprovado_em) {
      await prisma.implantacao.update({ where: { id: imp.id }, data: { onboarding_aprovado_em: new Date(), onboarding_aprovado_por: nome } });
      await prisma.implantacaoChecklistItem.updateMany({ where: { implantacao_id: imp.id, grupo: 'ONBOARDING', titulo: ITEM_APROVACAO }, data: { feito: true, feito_por: `${nome} (cliente)`, feito_em: new Date() } });
      const ob = await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: imp.id, grupo: 'ONBOARDING' }, select: { feito: true } });
      if (ob.length && ob.every(x => x.feito)) await prisma.implantacao.update({ where: { id: imp.id }, data: { onboarding_concluido_em: new Date() } });
      await atividade(imp.id, 'NOTA', `✅ Cliente aprovou o diagnóstico do onboarding técnico: ${nome}`, { nome: `${nome} (cliente)` });
      if (imp.tecnico_id) await avisarTecnico(prisma, { para_id: imp.tecnico_id, implantacao_id: imp.id, origem: 'SISTEMA', texto: `${imp.cliente_razao_social}: o cliente (${nome}) aprovou o diagnóstico do onboarding.` });
    }
    return reply.send({ status: 'success' });
  });

  const esperasDaProgramacao = async (token: string) => {
    const cfg = await obterConfigPortal(prisma);
    if (!token || token !== cfg.programacao.token) return null;
    const esperas = await prisma.implantacaoEspera.findMany({ where: { tipo: 'PROGRAMACAO', fim: null }, include: { implantacao: { select: { cliente_razao_social: true, tecnico_nome: true, tipo_base: true, sistema_anterior: true } } }, orderBy: { inicio: 'asc' } });
    const resolvidas = await prisma.implantacaoEspera.findMany({ where: { tipo: 'PROGRAMACAO', fim: { gte: new Date(Date.now() - 14 * 864e5) } }, include: { implantacao: { select: { cliente_razao_social: true } } }, orderBy: { fim: 'desc' }, take: 20 });
    return { nome: cfg.programacao.nome, esperas, resolvidas };
  };
  fastify.get('/publico/programacao/:token', async (request, reply) => {
    const d = await esperasDaProgramacao((request.params as any).token);
    if (!d) return reply.status(404).send({ status: 'error', message: 'Link inválido' });
    return reply.send({ status: 'success', data: {
      nome: d.nome,
      esperas: d.esperas.map(e => ({ id: e.id, cliente: e.implantacao.cliente_razao_social, tecnico: e.aberta_por_nome || e.implantacao.tecnico_nome, conversao: e.implantacao.tipo_base === 'CONVERSAO' ? e.implantacao.sistema_anterior || 'sim' : null, motivo: e.motivo, o_que_resolver: e.o_que_resolver, inicio: e.inicio })),
      resolvidas: d.resolvidas.map(e => ({ id: e.id, cliente: e.implantacao.cliente_razao_social, motivo: e.motivo, resposta: e.resposta, inicio: e.inicio, fim: e.fim })),
    } });
  });
  fastify.post('/publico/programacao/:token/esperas/:esperaId/resolver', async (request, reply) => {
    const { token, esperaId } = request.params as { token: string; esperaId: string };
    const d = await esperasDaProgramacao(token);
    if (!d) return reply.status(404).send({ status: 'error', message: 'Link inválido' });
    const e = d.esperas.find(x => x.id === esperaId);
    if (!e) return reply.status(404).send({ status: 'error', message: 'Pendência não encontrada ou já resolvida' });
    const b = z.object({ resposta: z.string().max(2000).optional().nullable() }).safeParse(request.body || {});
    const resposta = b.success ? (b.data.resposta || '').trim() || null : null;
    await prisma.implantacaoEspera.update({ where: { id: e.id }, data: { fim: new Date(), resolvida_por_nome: d.nome, resposta } });
    await atividade(e.implantacao_id, 'CRONOMETRO', `✅ Fim da espera (programação), resolvido por ${d.nome}${resposta ? `: ${resposta}` : ''}`, { nome: d.nome });
    const imp = await prisma.implantacao.findUnique({ where: { id: e.implantacao_id }, select: { tecnico_id: true, cliente_razao_social: true } });
    if (imp?.tecnico_id) await avisarTecnico(prisma, { para_id: imp.tecnico_id, implantacao_id: e.implantacao_id, origem: 'SISTEMA', prioridade: 'URGENTE', texto: `${d.nome} resolveu a pendência de ${imp.cliente_razao_social}${resposta ? `: ${resposta}` : ''}. Pode retomar.` });
    return reply.send({ status: 'success' });
  });

  // ── Configurações do portal (gestão)
  fastify.get('/implantacoes/portal/config', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const cfg = await obterConfigPortal(prisma);
    return reply.send({ status: 'success', data: { ...cfg, metas: { ...METAS_PADRAO, ...((cfg as any).metas || {}) }, link_programacao: `${URL_FRONT()}/programacao/${cfg.programacao.token}`, jornada: await obterJornada(prisma), checklist_padrao: CHECKLIST_PADRAO } });
  });
  fastify.put('/implantacoes/portal/config', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const b = z.object({
      sla: z.object({ CONVERSAO: z.object({ virada: z.number().int().min(1).max(180), final: z.number().int().min(1).max(365) }), BANCO_ZERADO: z.object({ virada: z.number().int().min(1).max(180), final: z.number().int().min(1).max(365) }), SERVICO_DIAS_UTEIS: z.number().int().min(1).max(60) }).optional(),
      programacao: z.object({ nome: z.string().min(2).max(60), whatsapp: z.string().max(30), lembrete_horas: z.number().min(1).max(40) }).optional(),
      avisos_cliente: z.boolean().optional(), agente_ativo: z.boolean().optional(), ofertas_ativo: z.boolean().optional(), ofertas_dias_apos_virada: z.number().int().min(1).max(120).optional(),
      catalogo: z.array(z.object({ produto: z.string().min(2).max(80), descricao: z.string().max(400), preco: z.string().max(60) })).max(40).optional(),
      modelos: z.array(z.object({ segmento: z.string().trim().min(2).max(60), grupos: z.object({ INSTALACAO: z.array(z.string().trim().min(2).max(300)).max(60), CONVERSAO: z.array(z.string().trim().min(2).max(300)).max(60), TREINAMENTO: z.array(z.string().trim().min(2).max(300)).max(60) }) })).max(20).optional(),
      extras_sistema: z.array(z.object({ sistema: z.string().trim().min(2).max(60), itens: z.array(z.string().trim().min(2).max(300)).max(40) })).max(40).optional(),
      tarefas_cliente: z.array(z.string().trim().min(2).max(200)).max(20).optional(),
      metas: z.object({ virada_conversao_dias: z.number().min(1).max(120), virada_zerado_dias: z.number().min(1).max(120), viradas_no_prazo_pct: z.number().min(1).max(100), retrabalho_por_virada: z.number().min(0).max(50), horas_por_implantacao: z.number().min(1).max(500), satisfacao_min: z.number().min(1).max(5), remarcacoes_max: z.number().min(0).max(100) }).optional(),
      jornada: z.object({ inicio: z.string().regex(/^\d\d:\d\d$/), fim: z.string().regex(/^\d\d:\d\d$/), almoco_inicio: z.string().regex(/^\d\d:\d\d$/), almoco_min: z.number().int().min(0).max(180), virada_inicio: z.string().regex(/^\d\d:\d\d$/) }).optional(),
    }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Configuração inválida' });
    const atual = await obterConfigPortal(prisma);
    const { jornada, programacao, ...resto } = b.data;
    const novo = { ...atual, ...resto, programacao: programacao ? { ...atual.programacao, ...programacao, whatsapp: programacao.whatsapp.replace(/\D/g, '') } : atual.programacao };
    await salvarConfigPortal(prisma, novo, u.nome || u.id);
    if (jornada) {
      const valor = JSON.stringify({ ...(await obterJornada(prisma)), ...jornada });
      await prisma.configuracaoIntegracao.upsert({ where: { chave: 'implantacao.jornada' }, create: { chave: 'implantacao.jornada', valor, updated_by: u.nome || u.id }, update: { valor, updated_by: u.nome || u.id } });
    }
    return reply.send({ status: 'success' });
  });

  // ── Painel da gestão: aproveitamento, esperas, prazos, viradas, cobranças, horas por cliente
  fastify.get('/implantacoes/painel', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const q = request.query as { de?: string; ate?: string };
    const hoje = diaSP(new Date());
    const ate = /^\d{4}-\d{2}-\d{2}$/.test(q.ate || '') ? q.ate! : hoje;
    const de = /^\d{4}-\d{2}-\d{2}$/.test(q.de || '') ? q.de! : diaSP(new Date(emSP(ate, '12:00').getTime() - 6 * 864e5));
    const ini = emSP(de, '00:00'), fim = new Date(emSP(ate, '00:00').getTime() + 864e5);
    const jornada = await obterJornada(prisma);
    const sessoes = await prisma.implantacaoSessao.findMany({ where: { inicio: { lt: fim }, OR: [{ fim: null }, { fim: { gt: ini } }] }, include: { implantacao: { select: { cliente_razao_social: true } } } });
    const viradasPorDia = new Set((await prisma.implantacao.findMany({ where: { virada_inicio_em: { gte: ini, lt: fim } }, select: { virada_inicio_em: true, tecnico_id: true } })).map(v => `${v.tecnico_id}|${diaSP(v.virada_inicio_em!)}`));
    const dias: string[] = [];
    for (let t = ini.getTime(); t < fim.getTime(); t += 864e5) dias.push(diaSP(new Date(t + 12 * 3600000)));
    const porTecnico = new Map<string, { nome: string; trabalhado: number; dentro: number; extra: number; jornada: number; por_tipo: Record<string, number>; dias: any[] }>();
    for (const tid of new Set(sessoes.map(s => s.tecnico_id))) {
      const ss = sessoes.filter(s => s.tecnico_id === tid);
      const acc = { nome: ss[0]?.tecnico_nome || 'Técnico', trabalhado: 0, dentro: 0, extra: 0, jornada: 0, por_tipo: {} as Record<string, number>, dias: [] as any[] };
      for (const dia of dias) {
        const r = resumoDoDia(ss, dia, { cfg: jornada, virada: viradasPorDia.has(`${tid}|${dia}`) });
        acc.trabalhado += r.trabalhado_ms; acc.dentro += r.dentro_ms; acc.extra += r.extra_ms; acc.jornada += r.jornada_ms;
        for (const [k, v] of Object.entries(r.por_tipo)) acc.por_tipo[k] = (acc.por_tipo[k] || 0) + v;
        acc.dias.push({ dia, trabalhado_ms: r.trabalhado_ms, dentro_ms: r.dentro_ms, extra_ms: r.extra_ms, jornada_ms: r.jornada_ms, aproveitamento: r.aproveitamento });
      }
      porTecnico.set(tid, acc);
    }
    const esperas = await prisma.implantacaoEspera.findMany({ where: { inicio: { lt: fim }, OR: [{ fim: null }, { fim: { gt: ini } }] }, include: { implantacao: { select: { cliente_razao_social: true } } } });
    const motivos: Record<string, number> = {};
    for (const e of esperas.filter(x => x.tipo === 'PROGRAMACAO')) { const k = e.motivo.trim().toLowerCase().slice(0, 60); motivos[k] = (motivos[k] || 0) + 1; }
    const esp = (tipo: string) => { const xs = esperas.filter(e => e.tipo === tipo); return { qtd: xs.length, abertas: xs.filter(e => !e.fim).length, ms: xs.reduce((t, e) => t + ((e.fim || new Date()).getTime() - e.inicio.getTime()), 0) }; };
    const ativas = await prisma.implantacao.findMany({ where: { concluida_fila_em: null, data_conclusao: null, status: { not: 'CANCELADA' } }, select: { id: true, modulo: true, data_assinatura: true, prazo_virada: true, prazo_finalizacao: true, virada_fim_em: true } });
    const sla = { NO_PRAZO: 0, EM_RISCO: 0, ESTOURADO: 0, SEM_PRAZO: 0 } as Record<string, number>;
    for (const i of ativas) { const s = situacaoSla(i.data_assinatura, i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada, null); sla[s?.situacao || 'SEM_PRAZO'] = (sla[s?.situacao || 'SEM_PRAZO'] || 0) + 1; }
    const porCliente: Record<string, { cliente: string; trabalho: number; treinamento: number; correcao: number }> = {};
    for (const s of sessoes.filter(x => x.implantacao_id)) {
      const k = s.implantacao_id!; const ms = Math.min((s.fim || new Date()).getTime(), fim.getTime()) - Math.max(s.inicio.getTime(), ini.getTime());
      const c = (porCliente[k] ||= { cliente: s.implantacao?.cliente_razao_social || '—', trabalho: 0, treinamento: 0, correcao: 0 });
      c.trabalho += ms; if (s.etapa === 'TREINAMENTO') c.treinamento += ms; if (s.etapa === 'CORRECAO') c.correcao += ms;
    }
    const [viradas, cobrancas, concluidas] = await Promise.all([
      prisma.implantacao.findMany({ where: { virada_fim_em: { gte: ini, lt: fim } }, select: { id: true, cliente_razao_social: true, virada_fim_em: true, data_primeiro_vencimento: true, cobranca_lancada_em: true } }),
      prisma.implantacao.count({ where: { virada_fim_em: { not: null }, cobranca_lancada_em: null } }),
      prisma.implantacao.findMany({ where: { concluida_fila_em: { gte: ini, lt: fim } }, select: { data_assinatura: true, concluida_fila_em: true, modulo: true } }),
    ]);
    const prazoMedio = (mod: string) => { const xs = concluidas.filter(c => c.modulo === mod && c.data_assinatura); return xs.length ? xs.reduce((t, c) => t + (c.concluida_fila_em!.getTime() - c.data_assinatura!.getTime()), 0) / xs.length : null; };
    return reply.send({ status: 'success', data: {
      periodo: { de, ate },
      tecnicos: [...porTecnico.entries()].map(([id, a]) => ({ id, ...a, aproveitamento: a.jornada ? Math.min(1, a.dentro / a.jornada) : null })),
      esperas: { programacao: esp('PROGRAMACAO'), cliente: esp('CLIENTE'), processamento: esp('PROCESSAMENTO'), motivos: Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([motivo, qtd]) => ({ motivo, qtd })) },
      sla, viradas, cobrancas_pendentes: cobrancas,
      prazo_medio_ms: { implantacao: prazoMedio('IMPLANTACAO'), servico: prazoMedio('SERVICO') }, concluidas: concluidas.length,
      por_cliente: Object.values(porCliente).sort((a, b) => b.trabalho - a.trabalho).slice(0, 20),
    } });
  });
}
