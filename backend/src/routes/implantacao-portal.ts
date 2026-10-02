import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import { confirmarImplantacao } from '@/lib/comissao-fluxo';
import { diaSP, emSP, resumoDoDia, temposDaDemanda } from '@/lib/implantacao/cronometro';
import { COLUNAS, CHAVES_COLUNA, CAMPOS_COLETA, TIPOS_SERVICO, colunaDe, situacaoSla, progresso, primeiroVencimento } from '@/lib/implantacao/portal';
import { obterJornada } from './implantacao-cronometro';
import {
  obterConfigPortal, salvarConfigPortal, avisarTecnico, visaoCliente, novoTokenCliente, pularMarcosPassados,
  garantirFasesTreinamento, concluirServicoNaVenda, URL_FRONT,
} from '@/services/implantacao-portal.service';

/**
 * Portal de implantação e serviços (fases 2 a 8): quadro com as colunas do Trello, ficha de coleta,
 * tela do Suporte, prazos (SLA), avisos para o técnico, virada e cobrança, treinamento em fases,
 * correções pós-virada, página do cliente, página da programação, painel da gestão e configurações.
 */

const ehGestaoTecnica = (u: any) => podeVerTudo(u) || (u?.role || '').toUpperCase() === 'SUPERVISAO_TECNICA';
const ehTecnico = (u: any) => (u?.role || '').toUpperCase() === 'TECNICO_IMPLANTACAO';
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
    const modulo = q.modulo === 'SERVICO' ? 'SERVICO' : 'IMPLANTACAO';
    const where: any = { modulo };
    if (ehTecnico(u) && !ehGestaoTecnica(u)) where.tecnico_id = u.id;
    const lista = await prisma.implantacao.findMany({
      where, orderBy: { data_assinatura: 'desc' },
      include: {
        checklist: { select: { grupo: true, titulo: true, feito: true } },
        esperas: { where: { fim: null }, select: { id: true, tipo: true, motivo: true, inicio: true } },
        ocorrencias: { where: { situacao: { not: 'RESOLVIDA' } }, select: { id: true, gravidade: true } },
      },
    });
    const agora = new Date();
    const cards = lista.map(i => {
      const prazo = i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada;
      const concluido = i.modulo === 'SERVICO' || i.virada_fim_em ? (i.concluida_fila_em || i.data_conclusao) : i.virada_fim_em;
      return {
        id: i.id, cliente_razao_social: i.cliente_razao_social, cliente_cnpj: i.cliente_cnpj, modulo: i.modulo, tipo_servico: i.tipo_servico,
        tipo_servico_label: i.tipo_servico ? TIPOS_SERVICO[i.tipo_servico]?.label : null, tipo_base: i.tipo_base, sistema_anterior: i.sistema_anterior,
        plano: i.plano, vendedor_nome: i.vendedor_nome, tecnico_id: i.tecnico_id, tecnico_nome: i.tecnico_nome, coluna: colunaDe(i),
        data_assinatura: i.data_assinatura, prazo_virada: i.prazo_virada, prazo_finalizacao: i.prazo_finalizacao,
        sla: situacaoSla(i.data_assinatura, prazo, concluido, agora), sla_etapa: i.virada_fim_em || i.modulo === 'SERVICO' ? 'finalização' : 'virada',
        progresso: progresso(i, i.checklist), checklist_feitos: i.checklist.filter(c => c.feito).length, checklist_total: i.checklist.length,
        esperas_abertas: i.esperas, ocorrencias_abertas: i.ocorrencias.length, ficha_ok: !!((i.coleta as any)?.regime_tributario && (i.coleta as any)?.contato_nome),
        tela_suporte: !!i.tela_suporte_arquivo_id, virada_inicio_em: i.virada_inicio_em, virada_fim_em: i.virada_fim_em, data_primeiro_vencimento: i.data_primeiro_vencimento,
        cobranca_lancada_em: i.cobranca_lancada_em, token_cliente: i.token_cliente, concluida_fila_em: i.concluida_fila_em,
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
    if (['CANCELADOS', 'VALIDADO'].includes(para) && !ehGestaoTecnica(u)) return reply.status(403).send({ status: 'error', message: 'Só a supervisão valida ou cancela' });
    const data: any = { coluna: para };
    if (para === 'FINALIZADO') {
      const abertas = await prisma.implantacaoOcorrencia.count({ where: { implantacao_id: id, situacao: { not: 'RESOLVIDA' } } });
      if (abertas) return reply.status(400).send({ status: 'error', message: `Há ${abertas} correção(ões) aberta(s). Resolva antes de finalizar.` });
      if (imp.modulo === 'IMPLANTACAO' && !imp.virada_fim_em) return reply.status(400).send({ status: 'error', message: 'A loja ainda não foi virada. Use "Loja virada" antes de finalizar.' });
      data.data_conclusao = imp.data_conclusao || new Date();
      data.concluida_fila_em = new Date();
      data.etapa_execucao = 'FINALIZADO';
    }
    if (para === 'CANCELADOS') data.status = 'CANCELADA';
    if (para === 'EM_ANDAMENTO' && ['AGUARDANDO_DESIGNACAO', 'DESIGNADO'].includes(imp.etapa_execucao)) data.etapa_execucao = imp.tipo_base === 'CONVERSAO' ? 'EM_CONVERSAO' : 'EM_CONFIGURACAO';
    if (para === 'ACOMPANHAMENTO') data.etapa_execucao = 'EM_TREINAMENTO';
    await prisma.implantacao.update({ where: { id }, data });
    if (para === 'FINALIZADO' && imp.venda_adicional_id) await concluirServicoNaVenda(prisma, imp.venda_adicional_id);
    const nome = (k: string) => COLUNAS.find(c => c.key === k)?.label || k;
    await atividade(id, 'MUDANCA_ETAPA', `Moveu de "${nome(de)}" para "${nome(para)}"`, u);
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
    const extra: any = {};
    if (coleta.tipo_base) extra.tipo_base = /zerado/i.test(coleta.tipo_base) ? 'BANCO_ZERADO' : 'CONVERSAO';
    if (coleta.sistema_anterior) extra.sistema_anterior = coleta.sistema_anterior;
    if (coleta.contato_telefone && !imp.contato_whatsapp) extra.contato_whatsapp = coleta.contato_telefone.replace(/\D/g, '') || null;
    if (body.contato_email !== undefined) extra.contato_email = String(body.contato_email || '').trim() || null;
    if (body.contato_whatsapp !== undefined) extra.contato_whatsapp = String(body.contato_whatsapp || '').replace(/\D/g, '') || null;
    await prisma.implantacao.update({ where: { id }, data: { coleta, ...extra } });
    await atividade(id, 'NOTA', '📝 Ficha de coleta atualizada', u);
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
    } });
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
    const b = z.object({ para_id: z.string().min(1), texto: z.string().min(2).max(2000), prioridade: z.enum(['NORMAL', 'URGENTE']).default('NORMAL'), implantacao_id: z.string().optional().nullable() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Escreva o aviso e escolha o técnico' });
    const aviso = await avisarTecnico(prisma, { ...b.data, de: { id: u.id, nome: u.nome }, origem: 'GESTAO' });
    if (!aviso) return reply.status(404).send({ status: 'error', message: 'Técnico não encontrado' });
    if (b.data.implantacao_id) await atividade(b.data.implantacao_id, 'NOTA', `📌 Aviso para ${aviso.para_nome}: ${b.data.texto}`, u);
    return reply.status(201).send({ status: 'success', data: aviso });
  });
  fastify.get('/implantacoes/avisos', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const q = request.query as { enviados?: string };
    const where: any = q.enviados === '1' && ehGestaoTecnica(u) ? {} : { para_id: u.id };
    const avisos = await prisma.avisoTecnico.findMany({ where, orderBy: { created_at: 'desc' }, take: 80, include: { implantacao: { select: { id: true, cliente_razao_social: true } } } });
    const naoLidos = await prisma.avisoTecnico.count({ where: { para_id: u.id, lido_em: null } });
    return reply.send({ status: 'success', data: { avisos, nao_lidos: naoLidos } });
  });
  fastify.post('/implantacoes/avisos/:avisoId/lido', async (request, reply) => {
    const u = exigirLogin(request, reply); if (!u) return;
    const { avisoId } = request.params as { avisoId: string };
    await prisma.avisoTecnico.updateMany({ where: { id: avisoId, para_id: u.id, lido_em: null }, data: { lido_em: new Date() } });
    return reply.send({ status: 'success' });
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
    if (!imp.tela_suporte_arquivo_id) return reply.status(400).send({ status: 'error', message: 'Anexe a tela do Suporte antes de iniciar a virada' });
    if (imp.virada_inicio_em) return reply.status(400).send({ status: 'error', message: 'A virada já foi iniciada' });
    await prisma.implantacao.update({ where: { id }, data: { virada_inicio_em: new Date(), coluna: 'EM_ANDAMENTO' } });
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
    if (!imp.virada_inicio_em) return reply.status(400).send({ status: 'error', message: 'Clique em "Iniciar virada" primeiro' });
    if (imp.virada_fim_em) return reply.status(400).send({ status: 'error', message: 'A loja já foi virada' });
    const agora = new Date();
    const venc = primeiroVencimento(agora);
    await prisma.implantacao.update({ where: { id }, data: { virada_fim_em: agora, coluna: 'ACOMPANHAMENTO', etapa_execucao: 'EM_TREINAMENTO', treinamento_inicio: imp.treinamento_inicio || agora } });
    await confirmarImplantacao(prisma, id, { data_instalacao: agora, data_primeiro_vencimento: venc, status: 'INSTALADO' });
    await garantirFasesTreinamento(prisma, id);
    await atividade(id, 'NOTA', `✅ Loja virada. Início de uso ${fmtData(agora)}; 1º vencimento ${fmtData(venc)}. Cobrança pendente de lançamento.`, u);
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
    const atual = await prisma.implantacaoTreinamentoFase.update({ where: { id: faseId }, data: { nome: b.data.nome, marcada_em: d(b.data.marcada_em), realizada_em: d(b.data.realizada_em), observacao: b.data.observacao } });
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
    return reply.send({ status: 'success', data: await visaoCliente(prisma, imp) });
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
    return reply.send({ status: 'success', data: { ...cfg, link_programacao: `${URL_FRONT()}/programacao/${cfg.programacao.token}`, jornada: await obterJornada(prisma) } });
  });
  fastify.put('/implantacoes/portal/config', async (request, reply) => {
    const u = exigirGestao(request, reply); if (!u) return;
    const b = z.object({
      sla: z.object({ CONVERSAO: z.object({ virada: z.number().int().min(1).max(180), final: z.number().int().min(1).max(365) }), BANCO_ZERADO: z.object({ virada: z.number().int().min(1).max(180), final: z.number().int().min(1).max(365) }), SERVICO_DIAS_UTEIS: z.number().int().min(1).max(60) }).optional(),
      programacao: z.object({ nome: z.string().min(2).max(60), whatsapp: z.string().max(30), lembrete_horas: z.number().min(1).max(40) }).optional(),
      avisos_cliente: z.boolean().optional(), agente_ativo: z.boolean().optional(), ofertas_ativo: z.boolean().optional(), ofertas_dias_apos_virada: z.number().int().min(1).max(120).optional(),
      catalogo: z.array(z.object({ produto: z.string().min(2).max(80), descricao: z.string().max(400), preco: z.string().max(60) })).max(40).optional(),
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
