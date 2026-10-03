import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import * as evo from './evolution.service';
import { obterInstanciaEmpresa } from '@/lib/whatsapp-empresa';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { numeroWhatsapp, ultimos8 } from '@/lib/assistente/campanhas';
import { diaSP, temposDaDemanda } from '@/lib/implantacao/cronometro';
import { CONTATO_GERAL, LINK_CONTATO_GERAL } from '@/lib/triagem/fluxo';
import {
  SLA_PADRAO, TIPOS_SERVICO, COLUNAS, colunaDe, situacaoSla, prazosPadrao, horasUteisEntre, inferirTipoServico,
  progresso, marcosDevidos, gruposDoProgresso, FASES_TREINAMENTO, faseDoItemTreinamento, ehLegado, somarDiasUteis, SLA_ONBOARDING_DIAS_UTEIS, type ConfigSla, CORTE_PORTAL,
  statusAssistida, type ModeloChecklist, type ExtraSistema,
  TAREFAS_CLIENTE_PADRAO, PRAZO_TAREFA_CLIENTE_DIAS_UTEIS, MAX_LEMBRETES_TAREFA, MOTIVO_ESPERA_TAREFA,
} from '@/lib/implantacao/portal';

/**
 * Portal de implantação e serviços: configuração, avisos (técnico, programação, gestão), serviços vindos
 * do kanban comercial, página e mensagens do cliente, vigia do Otávio e ofertas depois da virada.
 */

const CHAVE = 'implantacao.portal';
export const URL_FRONT = () => (process.env.FRONTEND_URL || 'https://comercial.prosystemnet.com').replace(/\/$/, '');

export type ItemCatalogo = { produto: string; descricao: string; preco: string };
export type ConfigPortal = {
  sla: ConfigSla;
  programacao: { nome: string; whatsapp: string; token: string; lembrete_horas: number };
  avisos_cliente: boolean; // mensagens de progresso ao cliente (WhatsApp + e-mail)
  agente_ativo: boolean; // Otávio: vigia e responde o técnico no WhatsApp
  ofertas_ativo: boolean; // agente de oferta depois da virada
  ofertas_dias_apos_virada: number;
  catalogo: ItemCatalogo[];
  modelos: ModeloChecklist[]; // checklist por segmento (vazio = padrão)
  extras_sistema: ExtraSistema[]; // itens extras na conversão, por sistema de origem
  tarefas_cliente: string[]; // o que a loja entrega no começo da implantação
};
const PADRAO: Omit<ConfigPortal, 'programacao'> & { programacao: Omit<ConfigPortal['programacao'], 'token'> } = {
  sla: SLA_PADRAO, programacao: { nome: 'Sinval', whatsapp: '', lembrete_horas: 4 },
  avisos_cliente: true, agente_ativo: true, ofertas_ativo: false, ofertas_dias_apos_virada: 15, catalogo: [], modelos: [], extras_sistema: [], tarefas_cliente: TAREFAS_CLIENTE_PADRAO,
};

export async function obterConfigPortal(prisma: PrismaClient): Promise<ConfigPortal> {
  const row = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  let salvo: any = {};
  try { salvo = row?.valor ? JSON.parse(row.valor) : {}; } catch { /* usa o padrão */ }
  const cfg: ConfigPortal = {
    ...PADRAO, ...salvo,
    sla: { ...PADRAO.sla, ...(salvo.sla || {}) },
    programacao: { ...PADRAO.programacao, token: '', ...(salvo.programacao || {}) },
    catalogo: Array.isArray(salvo.catalogo) ? salvo.catalogo : [],
    modelos: Array.isArray(salvo.modelos) ? salvo.modelos : [],
    extras_sistema: Array.isArray(salvo.extras_sistema) ? salvo.extras_sistema : [],
    tarefas_cliente: Array.isArray(salvo.tarefas_cliente) ? salvo.tarefas_cliente : TAREFAS_CLIENTE_PADRAO,
  };
  if (!cfg.programacao.token) { // link do Sinval: gerado uma vez
    cfg.programacao.token = randomBytes(18).toString('base64url');
    await salvarConfigPortal(prisma, cfg, 'system');
  }
  return cfg;
}

export async function salvarConfigPortal(prisma: PrismaClient, cfg: ConfigPortal, por: string) {
  const valor = JSON.stringify(cfg);
  await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor, updated_by: por }, update: { valor, updated_by: por } });
}

export const novoTokenCliente = () => randomBytes(15).toString('base64url');

async function linha(prisma: PrismaClient, implantacaoId: string, tipo: string, descricao: string, autor = 'Otávio (implantação)') {
  await prisma.implantacaoAtividade.create({ data: { implantacao_id: implantacaoId, tipo, descricao, autor_nome: autor } }).catch(() => null);
}

async function whats(prisma: PrismaClient, numero: string | null | undefined, texto: string): Promise<boolean> {
  const n = numeroWhatsapp(numero || '');
  if (!n) return false;
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) return false;
  try { await evo.enviarTexto(inst.instance_token, n, texto); return true; } catch (e: any) { console.error('[IMPLANTACAO] WhatsApp:', e?.message); return false; }
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

/** Aviso para o técnico: fica no portal (com som), vai como notificação e, se urgente, no WhatsApp dele. */
export async function avisarTecnico(prisma: PrismaClient, a: { para_id: string; texto: string; prioridade?: 'NORMAL' | 'URGENTE'; implantacao_id?: string | null; de?: { id?: string; nome?: string } | null; origem?: 'GESTAO' | 'SISTEMA'; tipo?: 'AVISO' | 'TAREFA'; prazo?: Date | null }) {
  const para = await prisma.usuarioCRM.findUnique({ where: { id: a.para_id }, select: { id: true, nome: true, telefone: true } }).catch(() => null);
  if (!para) return null;
  const aviso = await prisma.avisoTecnico.create({
    data: { para_id: para.id, para_nome: para.nome, de_id: a.de?.id || null, de_nome: a.de?.nome || 'Otávio (implantação)', implantacao_id: a.implantacao_id || null, texto: a.texto, prioridade: a.prioridade || 'NORMAL', origem: a.origem || 'GESTAO', tipo: a.tipo || 'AVISO', prazo: a.prazo || null },
  });
  const tarefa = a.tipo === 'TAREFA';
  const prazoTxt = a.prazo ? ` (prazo ${a.prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})` : '';
  try {
    const { enviarPush } = await import('./push.service');
    await enviarPush(prisma, [para.id], { titulo: tarefa ? `📋 Nova tarefa${prazoTxt}` : a.prioridade === 'URGENTE' ? '🚨 Aviso urgente da implantação' : '📌 Aviso da implantação', corpo: a.texto.slice(0, 180), url: '/portal-tecnico?tab=inicio', tag: 'aviso-tecnico' });
  } catch { /* push opcional */ }
  if (a.prioridade === 'URGENTE') await whats(prisma, para.telefone, `${tarefa ? `📋 *Tarefa urgente*${prazoTxt}` : '🚨 *Aviso urgente*'}${a.de?.nome ? ` de ${a.de.nome}` : ''}\n\n${a.texto}`);
  return aviso;
}

/** Novidade para o sino da gestão (supervisão técnica e admin). Só no portal.
 *  Técnico não recebe: só fica sabendo do card quando for designado nele. */
export async function avisarEquipe(prisma: PrismaClient, texto: string, implantacaoId?: string | null) {
  const equipe = await prisma.usuarioCRM.findMany({ where: { status: 'ATIVO', cargo: { in: ['SUPERVISAO_TECNICA', 'ADMIN'] } }, select: { id: true } }).catch(() => []);
  for (const u of equipe) await avisarTecnico(prisma, { para_id: u.id, implantacao_id: implantacaoId || null, origem: 'SISTEMA', texto }).catch(() => null);
}

/** Aviso à gestão no WhatsApp (uma vez por chave e janela). */
async function avisarGestao(prisma: PrismaClient, chave: string, texto: string, janelaHoras = 20) {
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  if (!(await podeEnviarUmaVez(prisma, `implantacao.${chave}`, janelaHoras))) return;
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', texto, { somenteAprovadora: true }).catch(() => {});
}

/** Espera pela programação aberta: avisa o responsável (Sinval) no WhatsApp com o link das pendências. */
export async function avisarProgramacao(prisma: PrismaClient, esperaId: string, lembrete = false) {
  const cfg = await obterConfigPortal(prisma);
  const e = await prisma.implantacaoEspera.findUnique({ where: { id: esperaId }, include: { implantacao: { select: { cliente_razao_social: true, tecnico_nome: true } } } });
  if (!e || e.fim || e.tipo !== 'PROGRAMACAO') return false;
  const link = `${URL_FRONT()}/programacao/${cfg.programacao.token}`;
  const texto = [
    lembrete ? `⏰ *Lembrete: demanda parada esperando a programação*` : `🛠️ *Nova pendência para a programação*`,
    `Cliente: ${e.implantacao.cliente_razao_social}`,
    `Técnico: ${e.aberta_por_nome || e.implantacao.tecnico_nome || '—'}`,
    `Motivo: ${e.motivo}`,
    e.o_que_resolver ? `Precisa: ${e.o_que_resolver}` : null,
    '',
    `Quando resolver, marque aqui: ${link}`,
    `(ou responda "resolvido" e o que foi feito)`,
  ].filter(x => x !== null).join('\n');
  const ok = cfg.programacao.whatsapp ? await whats(prisma, cfg.programacao.whatsapp, texto) : false;
  if (ok) await prisma.implantacaoEspera.update({ where: { id: e.id }, data: { lembrete_em: new Date() } });
  return ok;
}

// ─── Serviços vindos do kanban comercial ─────────────────────────────────────

/** Card de serviço foi para "Em execução": nasce a demanda no módulo Serviços (uma vez por venda). */
export async function criarServicoDaVenda(prisma: PrismaClient, vendaId: string) {
  if (await prisma.implantacao.findUnique({ where: { venda_adicional_id: vendaId }, select: { id: true } })) return null;
  const v: any = await prisma.vendaAdicional.findUnique({ where: { id: vendaId }, include: { cliente: true, parceiro: true } });
  if (!v) return null;
  const cli = v.cliente || {};
  const nome = (cli.nome_fantasia || cli.razao_social || cli.empresa || cli.nome || 'Cliente').trim();
  const tipo = inferirTipoServico(`${v.parceiro?.nome || ''} ${v.descricao_servico || ''}`);
  const cfg = await obterConfigPortal(prisma);
  const agora = new Date();
  const imp = await prisma.implantacao.create({
    data: {
      modulo: 'SERVICO', tipo_servico: tipo, venda_adicional_id: v.id, cliente_id: v.cliente_id,
      cliente_razao_social: nome, cliente_cnpj: cli.cnpj || null, vendedor_id: v.vendedor_id, vendedor_nome: v.vendedor_nome,
      valor_setup: v.valor_venda ?? null, status: 'AGUARDANDO_INSTALACAO', coluna: 'A_FAZER', data_assinatura: agora,
      observacoes: [v.parceiro?.nome, v.descricao_servico].filter(Boolean).join(' · ') || null,
      contato_whatsapp: numeroWhatsapp(cli.telefone || cli.telefone1 || '') || null, contato_email: cli.email || null,
      token_cliente: novoTokenCliente(), ...prazosPadrao({ modulo: 'SERVICO', inicio: agora, cfg: cfg.sla }),
    },
  });
  await prisma.implantacaoChecklistItem.createMany({ data: TIPOS_SERVICO[tipo].checklist.map((titulo, ordem) => ({ implantacao_id: imp.id, grupo: 'SERVICO', titulo, ordem })) });
  await linha(prisma, imp.id, 'NOTA', `Serviço "${TIPOS_SERVICO[tipo].label}" entrou na execução (venda de ${v.vendedor_nome || 'vendedor'}).`);
  await avisarEquipe(prisma, `🧰 Novo serviço para executar: ${TIPOS_SERVICO[tipo].label} · ${nome}.`, imp.id);
  registrarAcaoAgente('otavio', `recebeu o serviço ${TIPOS_SERVICO[tipo].label} de ${nome}`);
  return imp;
}

/** Técnico finalizou o serviço: o card comercial vai para "Concluído" (o envio ao Thiago segue com a vendedora). */
export async function concluirServicoNaVenda(prisma: PrismaClient, vendaId: string) {
  const v = await prisma.vendaAdicional.findUnique({ where: { id: vendaId }, select: { etapa: true } });
  if (v?.etapa === 'EM_EXECUCAO') await prisma.vendaAdicional.update({ where: { id: vendaId }, data: { etapa: 'CONCLUIDO', concluido_em: new Date() } as any }).catch(() => {});
}

// ─── Checklist e fases do treinamento ────────────────────────────────────────

/** Fases do treinamento da demanda (cria as padrão na primeira vez e distribui os itens). */
export async function garantirFasesTreinamento(prisma: PrismaClient, implantacaoId: string) {
  let fases = await prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: implantacaoId }, orderBy: { ordem: 'asc' } });
  if (!fases.length) {
    await prisma.implantacaoTreinamentoFase.createMany({ data: FASES_TREINAMENTO.map(f => ({ implantacao_id: implantacaoId, ordem: f.ordem, nome: f.nome })) });
    fases = await prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: implantacaoId }, orderBy: { ordem: 'asc' } });
  }
  const semFase = await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: implantacaoId, grupo: 'TREINAMENTO', fase: null }, select: { id: true, titulo: true } });
  for (const i of semFase) await prisma.implantacaoChecklistItem.update({ where: { id: i.id }, data: { fase: faseDoItemTreinamento(i.titulo) } });
  return fases;
}

// ─── Página e mensagens do cliente ───────────────────────────────────────────

const NOME_GRUPO: Record<string, string> = { ONBOARDING: 'Primeiro contato e diagnóstico', INSTALACAO: 'Instalação do sistema', CONVERSAO: 'Conversão dos dados', TREINAMENTO: 'Treinamento', SERVICO: 'Execução do serviço' };

/** Visão do cliente: só o passo a passo padrão, percentual e tempo dedicado (sem esperas nem descrições internas). */
export async function visaoCliente(prisma: PrismaClient, imp: any) {
  const [itens, fases, sessoes] = await Promise.all([
    prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: imp.id }, orderBy: [{ grupo: 'asc' }, { ordem: 'asc' }] }),
    imp.modulo === 'SERVICO' ? Promise.resolve([]) : prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: imp.id }, orderBy: { ordem: 'asc' } }),
    prisma.implantacaoSessao.findMany({ where: { implantacao_id: imp.id }, select: { inicio: true, fim: true, tipo: true, etapa: true } }),
  ]);
  const pct = progresso(imp, itens);
  const t = temposDaDemanda(sessoes, []);
  const grupos = [...gruposDoProgresso(imp.modulo, imp.tipo_base), ...(imp.modulo === 'SERVICO' ? [] : ['TREINAMENTO'])];
  const etapas = grupos.map(g => {
    const its = itens.filter(i => i.grupo === g);
    // Itens do onboarding são roteiro interno do técnico: o cliente vê só o passo e a contagem.
    return { grupo: g, nome: NOME_GRUPO[g] || g, total: its.length, feitos: its.filter(i => i.feito).length, passos: g === 'ONBOARDING' ? [] : its.map(i => ({ titulo: i.titulo, feito: i.feito, fase: i.fase })) };
  });
  const obPendente = itens.some(i => i.grupo === 'ONBOARDING' && !i.feito);
  const proximos = obPendente
    ? ['Primeiro contato do técnico e diagnóstico da sua loja', 'Aprovação do diagnóstico por você']
    : itens.filter(i => gruposDoProgresso(imp.modulo, imp.tipo_base).includes(i.grupo) && i.grupo !== 'ONBOARDING' && !i.feito).slice(0, 3).map(i => i.titulo);
  const c: any = imp.coleta || {};
  const diagnostico = imp.modulo === 'IMPLANTACAO' && !ehLegado(imp) ? {
    aprovado_em: imp.onboarding_aprovado_em, aprovado_por: imp.onboarding_aprovado_por,
    dados: [['Tipo', c.tipo_base], ['Sistema anterior', c.sistema_anterior], ['Lojas / filiais', c.filiais], ['Caixas (PDV)', c.caixas], ['Máquinas', c.maquinas],
      ['Colaboradores', c.colaboradores], ['PBMs', c.pbms], ['TEF', c.tef], ['Etiquetas', c.etiquetas], ['Financeiro', c.financeiro], ['Corretor tributário', c.corretor_tributario],
      ['Gerencial', c.gerencial], ['SNGPC', c.sngpc], ['Comunicação entre lojas', c.usa_comunicacao], ['Banco único', c.banco_unico], ['Preço único', c.preco_unico],
      ['Regime tributário', c.regime_tributario], ['Certificado digital', c.certificado], ['Contabilidade', c.contabilidade_nome], ['Contato principal', c.contato_nome],
      ['Equipamentos', [c.balanca === 'Sim' ? 'balança' : null, c.gaveta === 'Sim' ? 'gaveta' : null, c.impressora_nfce].filter(Boolean).join(', ') || null]]
      .filter(([, v]) => v).map(([l, v]) => ({ rotulo: l, valor: String(v) })),
  } : null;
  return {
    cliente: imp.cliente_razao_social, modulo: imp.modulo, tipo_servico: imp.tipo_servico ? TIPOS_SERVICO[imp.tipo_servico]?.label : null,
    tipo_base: imp.tipo_base, pct, tempo_ms: t.trabalho_ms, tempo_por_etapa: t.por_etapa,
    assinatura: imp.data_assinatura, virada_inicio: imp.virada_inicio_em, virada: imp.virada_fim_em, tecnico: imp.tecnico_nome ? imp.tecnico_nome.split(' ')[0] : null,
    concluida: !!(imp.concluida_fila_em || imp.data_conclusao), etapas, proximos,
    primeiro_vencimento: imp.virada_fim_em ? imp.data_primeiro_vencimento : null,
    virada_agendada: imp.virada_fim_em || imp.virada_inicio_em ? null : imp.virada_agendada_para || null,
    treinos_marcados: (fases as any[]).filter(f => f.marcada_em && !f.realizada_em).map(f => ({ ordem: f.ordem, nome: f.nome, marcada_em: f.marcada_em })),
    diagnostico,
    suporte: { telefone: CONTATO_GERAL, link: LINK_CONTATO_GERAL },
    fases: fases.map((f: any) => ({ ordem: f.ordem, nome: f.nome, marcada_em: f.marcada_em, realizada_em: f.realizada_em })),
  };
}

const fmtHoras = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`; };

const ROTULO_MARCO = (m: string) => m === 'CONTRATO' ? 'próximos passos' : m === 'VIRADA' ? 'loja virada' : m === 'AGENDA_VIRADA' ? 'data da virada' : m === 'LEMBRETE_VIRADA' ? 'lembrete da virada'
  : m.startsWith('AGENDA_TREINO_') ? `data da fase ${m.slice(14)} do treinamento` : m.startsWith('LEMBRETE_TREINO_') ? `lembrete da fase ${m.slice(16)} do treinamento`
  : m === 'TAREFAS_CLIENTE' ? 'o que precisamos do cliente' : m === 'LEMBRETE_TAREFAS' ? 'lembrete do que falta enviar' : m === 'TAREFA_DEVOLVIDA' ? 'arquivo devolvido para reenvio' : m === 'PESQUISA' ? 'pesquisa de satisfação'
  : m.startsWith('TREINO_') ? `fase ${m.slice(7)} do treinamento` : `${m.slice(1)}% concluído`;

type TextoMarco = { whatsapp: string; assunto: string; titulo: string; paragrafos: string[] };

/**
 * Na virada, o cliente sempre recebe (texto fixo, não depende da IA): 1º vencimento, confirmação do e-mail
 * e a regra do boleto (enviado 10 dias antes; se não chegar, pedir até 24 h antes pelo suporte).
 */
export function blocoVencimento(imp: { data_primeiro_vencimento?: Date | null; contato_email?: string | null }) {
  const venc = imp.data_primeiro_vencimento ? imp.data_primeiro_vencimento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
  if (!venc) return null;
  const email = imp.contato_email
    ? `Os boletos vão para o e-mail *${imp.contato_email}*. Se esse não for o e-mail certo, responda esta mensagem com o correto.`
    : 'Não temos o seu e-mail para o envio dos boletos: responda esta mensagem com o e-mail correto.';
  const linhas = [
    `📅 *Sua primeira mensalidade vence em ${venc}.*`,
    email,
    `Enviamos o boleto sempre *10 dias antes do vencimento*. Se não receber, peça a segunda via *com pelo menos 24 horas de antecedência* pelo suporte: ${CONTATO_GERAL} (${LINK_CONTATO_GERAL}). Assim o pagamento não passa da data.`,
  ];
  return { venc, whatsapp: linhas.join('\n'), paragrafos: linhas.map(l => l.replace(/\*/g, '')) };
}

/** Texto do marco escrito pela IA com o contexto real do cliente; sem IA, um texto padrão com os mesmos dados. */
async function escreverMarco(prisma: PrismaClient, imp: any, marco: string, v: Awaited<ReturnType<typeof visaoCliente>>, link: string): Promise<TextoMarco> {
  const t = await escreverMarcoBase(prisma, imp, marco, v, link);
  const bloco = marco === 'VIRADA' ? blocoVencimento(imp) : null;
  if (!bloco) return t;
  const [antesLink] = t.whatsapp.split(link);
  return { ...t, whatsapp: `${antesLink.trim()}\n\n${bloco.whatsapp}\n\nAcompanhe aqui: ${link}`, paragrafos: [...t.paragrafos, ...bloco.paragrafos] };
}

async function escreverMarcoBase(prisma: PrismaClient, imp: any, marco: string, v: Awaited<ReturnType<typeof visaoCliente>>, link: string): Promise<TextoMarco> {
  const contato = (imp.coleta as any)?.contato_nome?.split(' ')[0] || null;
  const servico = imp.modulo === 'SERVICO';
  const temTempo = v.tempo_ms >= 60000; // menos de 1 minuto: não cita o tempo
  const fase = marco.startsWith('TREINO_') ? v.fases.find(f => `TREINO_${f.ordem}` === marco) : null;
  const proxFase = fase ? v.fases.find(f => f.ordem === fase.ordem + 1) : null;
  const dados = {
    contato, empresa: v.cliente, marco: ROTULO_MARCO(marco), servico: v.tipo_servico, tipo: servico ? 'serviço' : v.tipo_base === 'CONVERSAO' ? 'implantação com conversão dos dados do sistema anterior' : 'implantação do sistema do zero',
    percentual: v.pct, tempo_dedicado: temTempo ? fmtHoras(v.tempo_ms) : null, tecnico: v.tecnico,
    ja_e_cliente: servico, // serviço = quem já usa o Prosystem e contratou algo a mais
    etapas: v.etapas.map(e => `${e.nome}: ${e.feitos} de ${e.total} passos`), proximos_passos: v.proximos,
    fase_concluida: fase?.nome || null, proxima_fase: proxFase?.nome || null, link,
  };
  const padrao = (): TextoMarco => {
    const oi = `Olá${contato ? `, ${contato}` : ''}! Aqui é da equipe de implantação da Prosystem.`;
    const tempo = temTempo ? ` Foram ${fmtHoras(v.tempo_ms)} de trabalho dedicado até aqui.` : '';
    const corpo = marco === 'CONTRATO'
      ? (servico
        ? `Recebemos o pedido do serviço de ${(v.tipo_servico || 'serviço').toLowerCase()} para a ${v.cliente} e ele já está na fila do nosso técnico. Os próximos passos são: ${v.proximos.join('; ') || 'a execução do serviço'}.`
        : `Recebemos o contrato da ${v.cliente} e já começamos a preparar a sua implantação. ${v.tecnico ? `${v.tecnico} será o técnico responsável. ` : ''}Os próximos passos são: ${v.proximos.join('; ') || 'a instalação do sistema'}.`)
      : marco === 'VIRADA'
        ? `A loja ${v.cliente} está rodando com o Prosystem!${tempo} Agora seguimos com o treinamento da equipe, por fases.`
        : fase ? `Concluímos a fase "${fase.nome}" do treinamento.${proxFase ? ` A próxima é "${proxFase.nome}".` : ' Esse foi o último módulo.'}`
          : `${servico ? 'O serviço' : 'A implantação'} da ${v.cliente} chegou a ${v.pct}%.${tempo} Próximos passos: ${v.proximos.join('; ') || 'reta final'}.`;
    return { whatsapp: `${oi}\n\n${corpo}\n\nAcompanhe cada passo aqui: ${link}`, assunto: `${v.cliente} · ${ROTULO_MARCO(marco)}`, titulo: marco === 'VIRADA' ? 'Sua loja está no ar!' : marco === 'CONTRATO' ? 'Bem-vindo à Prosystem' : `Atualização da ${servico ? 'execução' : 'implantação'}`, paragrafos: [oi, corpo] };
  };
  try {
    const { chamarGemini } = await import('./ia-gemini.service');
    const sistema = [
      'Você escreve, em nome da equipe de implantação da Prosystem (sistemas para farmácias e padarias), uma mensagem ao cliente sobre o andamento da implantação ou do serviço.',
      'Use SOMENTE os dados enviados; não invente datas, nomes, valores nem passos. Tom próximo, claro e profissional, em português do Brasil, sem travessão.',
      'NUNCA fale de esperas, atrasos, problemas, erros, bugs, programação ou equipe interna. Fale do que já foi feito, do tempo dedicado e do que vem a seguir.',
      'Se "tempo_dedicado" vier null, NÃO fale de tempo nem de horas. Se "ja_e_cliente" for true (serviço), o cliente já usa o Prosystem: NÃO dê boas-vindas; no marco "próximos passos" diga que recebemos o pedido do serviço e que ele já está na fila do técnico, com os próximos passos.',
      'Marco "próximos passos" (implantação): dê as boas-vindas pelo contrato e explique os próximos passos. Marco "loja virada": dê as BOAS-VINDAS ao cliente como cliente Prosystem, comemore a loja rodando e anuncie o treinamento por fases (o vencimento, o e-mail e o boleto são acrescentados depois pelo sistema: NÃO fale deles). Marco de percentual: celebre o avanço. Marco de fase do treinamento: resuma a fase concluída e anuncie a próxima.',
      'WhatsApp: no máximo 5 linhas curtas, pode usar 1 emoji, termine com o link exatamente como recebido.',
      'Responda SOMENTE JSON: {"whatsapp":"...","assunto":"assunto do e-mail","titulo":"título curto do e-mail","paragrafos":["2 a 4 parágrafos curtos do e-mail, sem o link"]}',
    ].join('\n');
    const bruto = await chamarGemini(prisma, { sistema, partes: [{ text: JSON.stringify(dados) }], json: true, temperatura: 0.6, simples: true, timeoutMs: 45000 });
    const j = JSON.parse(bruto.replace(/^```json\s*|```$/g, ''));
    if (!j?.whatsapp || !Array.isArray(j.paragrafos) || !j.paragrafos.length) return padrao();
    const semTravessao = (t: string) => String(t).replace(/\s*[—–]\s*/g, ', ');
    const whatsapp = semTravessao(j.whatsapp).includes(link) ? semTravessao(j.whatsapp) : `${semTravessao(j.whatsapp)}\n\n${link}`;
    return { whatsapp, assunto: String(j.assunto || padrao().assunto).slice(0, 140), titulo: String(j.titulo || padrao().titulo).slice(0, 80), paragrafos: j.paragrafos.slice(0, 4).map((p: any) => semTravessao(p)) };
  } catch { return padrao(); }
}

const esc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** E-mail no visual da Prosystem: cabeçalho azul, barra de progresso, etapas e botão de acompanhamento. */
export function htmlEmailImplantacao(t: TextoMarco, v: Awaited<ReturnType<typeof visaoCliente>>, link: string) {
  const barra = `<table width="100%" cellpadding="0" cellspacing="0" style="background:#EBF4FF;border-radius:99px;height:12px"><tr><td style="width:${v.pct}%;background:linear-gradient(90deg,#4B8EC8,#2E6EAB);border-radius:99px;height:12px;font-size:0">&nbsp;</td><td style="font-size:0">&nbsp;</td></tr></table>`;
  const etapas = v.etapas.map(e => {
    const ok = e.total > 0 && e.feitos === e.total;
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #EBF4FF;font-size:14px;color:#1A4E82">${ok ? '✅' : e.feitos ? '🔵' : '⚪'} <b>${esc(e.nome)}</b></td><td align="right" style="padding:8px 0;border-bottom:1px solid #EBF4FF;font-size:13px;color:#5B7A99">${e.feitos} de ${e.total}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.titulo)}</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB"><tr><td align="center" style="padding:28px 14px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 40px rgba(13,34,56,.12)">
<tr><td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 50%,#2E6EAB 100%);padding:32px 36px 36px">
  <span style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;font-size:20px;font-weight:800;color:#fff">Pro<span style="color:#90BEF0">System</span></span>
  <span style="font-size:11px;color:#A8C8E8;letter-spacing:2px;text-transform:uppercase;margin-left:10px">${v.modulo === 'SERVICO' ? 'Serviços' : 'Implantação'}</span>
  <p style="margin:26px 0 6px;font-size:12px;color:#6AAAE5;letter-spacing:3px;text-transform:uppercase;font-weight:600">${esc(v.cliente)}</p>
  <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2">${esc(t.titulo)}</h1>
</td></tr>
<tr><td style="padding:28px 36px 8px">
  ${t.paragrafos.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#23384D">${esc(p)}</p>`).join('')}
</td></tr>
<tr><td style="padding:6px 36px 4px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;font-weight:700;color:#1A4E82">Andamento</td><td align="right" style="font-size:22px;font-weight:800;color:#2E6EAB">${v.pct}%</td></tr></table>
  ${barra}
  ${v.tempo_ms >= 60000 ? `<p style="margin:10px 0 0;font-size:13px;color:#5B7A99">⏱️ Tempo de trabalho dedicado à sua ${v.modulo === 'SERVICO' ? 'demanda' : 'implantação'}: <b style="color:#1A4E82">${fmtHoras(v.tempo_ms)}</b></p>` : ''}
</td></tr>
<tr><td style="padding:16px 36px 6px"><table width="100%" cellpadding="0" cellspacing="0">${etapas}</table></td></tr>
<tr><td align="center" style="padding:26px 36px 34px">
  <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#4B8EC8,#2E6EAB);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px">Acompanhar passo a passo</a>
</td></tr>
<tr><td style="background:#F4F7FB;padding:18px 36px;font-size:12px;color:#7A93AD;text-align:center">Prosystem Sistemas · Vitória/ES · Esta é uma mensagem de acompanhamento da sua ${v.modulo === 'SERVICO' ? 'demanda' : 'implantação'}.</td></tr>
</table></td></tr></table></body></html>`;
}

const horarioComercial = (d = new Date()) => {
  const h = Number(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  const sem = new Date(d.getTime() - 3 * 3600000).getUTCDay();
  return sem >= 1 && sem <= 5 && h >= 8 && h < 18;
};

/** Envia um marco ao cliente (WhatsApp + e-mail), uma vez por canal. */
export async function enviarMarco(prisma: PrismaClient, imp: any, marco: string) {
  if (ehLegado(imp)) return; // cliente anterior ao portal: não recebe nada
  const v = await visaoCliente(prisma, imp);
  const link = `${URL_FRONT()}/acompanhamento/${imp.token_cliente}`;
  const t = await escreverMarco(prisma, imp, marco, v, link);
  const coleta: any = imp.coleta || {};
  const destWpp = numeroWhatsapp(imp.contato_whatsapp || coleta.contato_telefone || '');
  const destEmail = (imp.contato_email || '').trim() || null;
  const registrar = (canal: string, destino: string | null, status: string, texto: string | null, erro?: string) =>
    prisma.implantacaoComunicacao.create({ data: { implantacao_id: imp.id, marco, canal, destino, status, texto, erro } }).catch(() => null);
  // WhatsApp: fica também no histórico da conversa do cliente (Inbox).
  if (destWpp) {
    const inst = await obterInstanciaEmpresa(prisma);
    let ok = false, erro = '';
    if (inst?.instance_token) {
      try {
        const r = await evo.enviarTexto(inst.instance_token, destWpp, t.whatsapp);
        ok = true;
        const { garantirConversa } = await import('./assistente-posvenda.service');
        const conv = await garantirConversa(prisma, inst.id, destWpp, { nome: coleta.contato_nome || imp.cliente_razao_social, tipo_contato: 'CLIENTE' });
        await prisma.whatsappMensagem.create({ data: { conversaId: conv.id, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: t.whatsapp, status: 'ENVIADA', enviada_por: 'otavio' } }).catch(() => {});
      } catch (e: any) { erro = e?.message || 'falha'; }
    } else erro = 'WhatsApp da empresa não configurado';
    await registrar('WHATSAPP', destWpp, ok ? 'ENVIADO' : 'ERRO', t.whatsapp, erro || undefined);
  } else await registrar('WHATSAPP', null, 'SEM_DESTINO', null);
  if (destEmail) {
    const { enviarEmailImplantacao } = await import('./email.service');
    const ok = await enviarEmailImplantacao(destEmail, t.assunto, htmlEmailImplantacao(t, v, link));
    await registrar('EMAIL', destEmail, ok ? 'ENVIADO' : 'ERRO', t.paragrafos.join('\n\n'), ok ? undefined : 'falha no envio');
  } else await registrar('EMAIL', null, 'SEM_DESTINO', null);
  // Boas-vindas do pós-venda = mensagem da virada: a pesquisa de satisfação conta a partir daqui.
  if (marco === 'VIRADA' && imp.proposta_id) await prisma.$executeRawUnsafe('UPDATE PropostaComercial SET wpp_boasvindas_em = ? WHERE id = ? AND wpp_boasvindas_em IS NULL', new Date(), imp.proposta_id).catch(() => {});
  await linha(prisma, imp.id, 'COMUNICACAO', `📨 Cliente avisado: ${ROTULO_MARCO(marco)}${destWpp ? ' (WhatsApp)' : ''}${destEmail ? ' (e-mail)' : ''}${!destWpp && !destEmail ? ', mas a demanda não tem WhatsApp nem e-mail do cliente' : ''}.`);
  registrarAcaoAgente('otavio', `avisou ${imp.cliente_razao_social}: ${ROTULO_MARCO(marco)}`);
}

const quando = (d: Date, hora = true) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', ...(hora ? { hour: '2-digit', minute: '2-digit' } : {}) }).replace(',', '');

/** Recado operacional ao cliente (agenda e lembretes): WhatsApp da empresa, registrado nas comunicações do card. */
export async function avisarClienteAgenda(prisma: PrismaClient, imp: any, marco: string, texto: string): Promise<boolean> {
  if (ehLegado(imp)) return false;
  const cfg = await obterConfigPortal(prisma);
  if (!cfg.avisos_cliente) return false;
  const coleta: any = imp.coleta || {};
  const destWpp = numeroWhatsapp(imp.contato_whatsapp || coleta.contato_telefone || '');
  const registrar = (destino: string | null, status: string, erro?: string) =>
    prisma.implantacaoComunicacao.create({ data: { implantacao_id: imp.id, marco, canal: 'WHATSAPP', destino, status, texto: destino ? texto : null, erro } }).catch(() => null);
  if (!destWpp) { await registrar(null, 'SEM_DESTINO'); return false; }
  const inst = await obterInstanciaEmpresa(prisma);
  let ok = false, erro = '';
  if (inst?.instance_token) {
    try {
      const r = await evo.enviarTexto(inst.instance_token, destWpp, texto);
      ok = true;
      const { garantirConversa } = await import('./assistente-posvenda.service');
      const conv = await garantirConversa(prisma, inst.id, destWpp, { nome: coleta.contato_nome || imp.cliente_razao_social, tipo_contato: 'CLIENTE' });
      await prisma.whatsappMensagem.create({ data: { conversaId: conv.id, externo_id: r.externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: texto, status: 'ENVIADA', enviada_por: 'otavio' } }).catch(() => {});
    } catch (e: any) { erro = e?.message || 'falha'; }
  } else erro = 'WhatsApp da empresa não configurado';
  await registrar(destWpp, ok ? 'ENVIADO' : 'ERRO', erro || undefined);
  await linha(prisma, imp.id, 'COMUNICACAO', `📨 Cliente avisado: ${ROTULO_MARCO(marco)} (WhatsApp)${ok ? '' : ' — falhou'}.`);
  return ok;
}

// ─── Tarefas do cliente (Fase 3) ─────
export const PASTA_ARQUIVOS_CLIENTE = () => process.env.ARQUIVOS_CLIENTE_DIR || '/root/arquivos-clientes';
export const MAX_ARQUIVO_CLIENTE = 15 * 1024 * 1024;

/** Grava o arquivo enviado pelo cliente (data URL base64) em disco. Devolve caminho, nome, tipo e tamanho. */
export async function salvarArquivoCliente(implantacaoId: string, tarefaId: string, nome: string, dataUrl: string) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m || !m[2]) throw new Error('Arquivo inválido');
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length) throw new Error('Arquivo vazio');
  if (buf.length > MAX_ARQUIVO_CLIENTE) throw new Error('Arquivo maior que 15 MB');
  const limpo = (nome || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\- ]+/g, '_').slice(-120) || 'arquivo';
  const dir = path.join(PASTA_ARQUIVOS_CLIENTE(), implantacaoId);
  await mkdir(dir, { recursive: true });
  // A coluna arquivo_caminho tem 191 caracteres: o nome em disco fica curto (o nome original vai em arquivo_nome).
  const caminho = path.join(dir, `${tarefaId}-${Date.now()}-${limpo.slice(-60)}`);
  await writeFile(caminho, buf);
  return { caminho, nome: limpo, mime: m[1] || 'application/octet-stream', tamanho: buf.length };
}

/** Cria as tarefas padrão do cliente (Configurações), com prazo de 3 dias úteis. Só uma vez por demanda. */
export async function criarTarefasClientePadrao(prisma: PrismaClient, imp: any, por: string) {
  if (imp.modulo !== 'IMPLANTACAO' || ehLegado(imp)) return 0;
  if (await prisma.implantacaoTarefaCliente.count({ where: { implantacao_id: imp.id } })) return 0;
  const cfg = await obterConfigPortal(prisma);
  const prazo = somarDiasUteis(new Date(), PRAZO_TAREFA_CLIENTE_DIAS_UTEIS);
  prazo.setUTCHours(20, 59, 0, 0); // fim do dia (17h59 de Brasília)
  const lista = (cfg.tarefas_cliente || []).filter(t => t.trim().length >= 2);
  if (lista.length) await prisma.implantacaoTarefaCliente.createMany({ data: lista.map(titulo => ({ implantacao_id: imp.id, titulo: titulo.trim(), prazo, criada_por: por })) });
  return lista.length;
}

/** Ninguém mais devendo nada vencido: fecha a espera "Cliente" aberta sozinha por tarefa vencida. */
export async function fecharEsperaDeTarefa(prisma: PrismaClient, implantacaoId: string, por = 'Sistema') {
  const vencidas = await prisma.implantacaoTarefaCliente.count({ where: { implantacao_id: implantacaoId, status: 'PENDENTE', prazo: { lt: new Date() } } });
  if (vencidas) return;
  await prisma.implantacaoEspera.updateMany({ where: { implantacao_id: implantacaoId, tipo: 'CLIENTE', fim: null, motivo: { startsWith: MOTIVO_ESPERA_TAREFA } }, data: { fim: new Date(), resolvida_por_nome: por, resposta: 'Cliente enviou o que faltava pela página de acompanhamento' } });
}

const textoTarefasCliente = (imp: any, tarefas: { titulo: string; prazo: Date | null }[], lembrete: boolean) => {
  const link = `${URL_FRONT()}/acompanhamento/${imp.token_cliente}`;
  const prazo = tarefas.map(t => t.prazo).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0];
  return `${saudacaoCliente(imp)} ${lembrete ? 'Lembrete da Prosystem: ainda' : 'Aqui é da Prosystem. Para seguir com a implantação da'} ${lembrete ? `falta${tarefas.length > 1 ? 'm' : ''} para a implantação da ${imp.cliente_razao_social}:` : `${imp.cliente_razao_social}, precisamos de:`}\n${tarefas.map(t => `• ${t.titulo}`).join('\n')}\n\n${prazo && !lembrete ? `Prazo: *${prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}*. ` : ''}Envie pela sua página de acompanhamento, em "O que precisamos de você": ${link}`;
};

const saudacaoCliente = (imp: any) => { const n = ((imp.coleta as any)?.contato_nome || '').split(' ')[0]; return n ? `Olá, ${n}!` : 'Olá!'; };
export const textoAgendaVirada = (imp: any, para: Date, remarcada: boolean, duracaoH?: number | null) =>
  `${saudacaoCliente(imp)} Aqui é da Prosystem. A virada do sistema na ${imp.cliente_razao_social} ${remarcada ? 'foi remarcada' : 'ficou marcada'} para *${quando(para)}*${duracaoH ? ` (previsão de ${duracaoH}h)` : ''}.\n\nPara tudo correr bem: feche o caixa no horário combinado, evite emitir notas durante a virada e deixe alguém da loja disponível para os testes. Qualquer imprevisto, é só responder aqui.`;
export const textoLembreteVirada = (imp: any, para: Date) =>
  `${saudacaoCliente(imp)} Lembrete da Prosystem: a virada do sistema na ${imp.cliente_razao_social} é *${quando(para)}*. Feche o caixa no horário combinado e deixe alguém da loja disponível para os testes. Até lá!`;
export const textoAgendaTreino = (imp: any, fase: { ordem: number; nome: string }, dia: Date, lembrete: boolean) =>
  `${saudacaoCliente(imp)} ${lembrete ? 'Lembrete da Prosystem: ' : 'Aqui é da Prosystem. '}${lembrete ? 'o' : 'O'} treinamento da fase ${fase.ordem} (${fase.nome}) na ${imp.cliente_razao_social} ${lembrete ? 'é' : 'ficou marcado para'} *${quando(dia, false)}*. Reserve a equipe que vai usar essa parte do sistema.`;

/** Marcos já passados viram PULADO (página do cliente ligada no meio do caminho: nada de mensagens atrasadas). */
export async function pularMarcosPassados(prisma: PrismaClient, implantacaoId: string) {
  const imp: any = await prisma.implantacao.findUnique({ where: { id: implantacaoId } });
  if (!imp) return;
  const itens = await prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: imp.id } });
  const fases = await prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: imp.id, realizada_em: { not: null } } });
  const ja = new Set((await prisma.implantacaoComunicacao.findMany({ where: { implantacao_id: imp.id }, select: { marco: true } })).map(c => c.marco));
  const m = marcosDevidos({ pct: progresso(imp, itens), virada: !!imp.virada_fim_em, fasesRealizadas: fases.map(f => f.ordem), jaRegistrados: ja });
  const passados = [...m.pular, ...m.enviar.filter(x => x !== 'CONTRATO' || imp.data_assinatura < new Date(Date.now() - 2 * 864e5))];
  for (const marco of passados) for (const canal of ['WHATSAPP', 'EMAIL']) await prisma.implantacaoComunicacao.create({ data: { implantacao_id: imp.id, marco, canal, status: 'PULADO' } }).catch(() => {});
}

// ─── Rodada do portal (a cada 10 min) ────────────────────────────────────────

export async function rodarPortal(prisma: PrismaClient, agora = new Date()) {
  const cfg = await obterConfigPortal(prisma);
  const ativas = (await prisma.implantacao.findMany({ where: { concluida_fila_em: null, data_conclusao: null, status: { not: 'CANCELADA' }, created_at: { gte: CORTE_PORTAL } } })).filter(i => !ehLegado(i));
  const hoje = diaSP(agora);
  const resumoGestao: string[] = []; // prazos e demandas sem técnico: um único resumo por rodada

  // 1) Esperas da programação sem resposta: lembrete ao responsável e aviso ao técnico e à gestão.
  const esperas = await prisma.implantacaoEspera.findMany({ where: { tipo: 'PROGRAMACAO', fim: null }, include: { implantacao: { select: { id: true, cliente_razao_social: true, tecnico_id: true } } } });
  for (const e of esperas) {
    if (horasUteisEntre(e.lembrete_em || e.inicio, agora) < cfg.programacao.lembrete_horas) continue;
    const enviou = await avisarProgramacao(prisma, e.id, true);
    if (!enviou) await prisma.implantacaoEspera.update({ where: { id: e.id }, data: { lembrete_em: agora } });
    const h = Math.round(horasUteisEntre(e.inicio, agora));
    await avisarGestao(prisma, `espera.${e.id}.${hoje}`, `⏳ *${e.implantacao.cliente_razao_social}* está parada há ${h}h úteis esperando a programação (${cfg.programacao.nome}).\nMotivo: ${e.motivo}`);
    if (e.implantacao.tecnico_id) await avisarTecnico(prisma, { para_id: e.implantacao.tecnico_id, implantacao_id: e.implantacao.id, origem: 'SISTEMA', texto: `${e.implantacao.cliente_razao_social}: a espera pela programação passou de ${cfg.programacao.lembrete_horas}h úteis. ${cfg.programacao.nome} foi lembrado${cfg.programacao.whatsapp ? '' : ' (sem WhatsApp configurado: avise pessoalmente)'}.` });
  }

  // 2) Prazo (SLA): avisa uma vez quando entra em risco e quando estoura.
  for (const i of ativas) {
    const prazo = i.virada_fim_em || i.modulo === 'SERVICO' ? i.prazo_finalizacao : i.prazo_virada;
    const s = situacaoSla(i.data_assinatura, prazo, null, agora);
    if (!s || (s.situacao !== 'EM_RISCO' && s.situacao !== 'ESTOURADO')) continue;
    const chave = `${s.situacao}:${prazo!.toISOString().slice(0, 10)}`;
    if (i.sla_aviso === chave) continue;
    await prisma.implantacao.update({ where: { id: i.id }, data: { sla_aviso: chave } });
    const txt = s.situacao === 'ESTOURADO' ? `🔴 Prazo estourado: ${i.cliente_razao_social} (prazo ${prazo!.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).` : `🟠 Prazo em risco: ${i.cliente_razao_social} já usou ${s.pct}% do prazo (até ${prazo!.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).`;
    if (i.tecnico_id) await avisarTecnico(prisma, { para_id: i.tecnico_id, implantacao_id: i.id, origem: 'SISTEMA', prioridade: s.situacao === 'ESTOURADO' ? 'URGENTE' : 'NORMAL', texto: txt });
    resumoGestao.push(txt);
    await linha(prisma, i.id, 'NOTA', txt);
  }

  // 3) Cobrança: loja virada sem cobrança lançada → aviso à gestão todo dia útil (das 9h).
  if (horarioComercial(agora) && Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) >= 9) {
    // Legadas (virada retroativa) não entram no aviso diário: ficam só no painel da gestão.
    const pend = (await prisma.implantacao.findMany({ where: { virada_fim_em: { not: null }, cobranca_lancada_em: null } })).filter(p => !ehLegado(p));
    if (pend.length) {
      const linhas = pend.map(p => `• ${p.cliente_razao_social}: virada em ${p.virada_fim_em!.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, 1º vencimento ${p.data_primeiro_vencimento ? p.data_primeiro_vencimento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}${p.mensalidade ? ` (R$ ${p.mensalidade.toFixed(2).replace('.', ',')})` : ''}`);
      await avisarGestao(prisma, `cobranca.${hoje}`, `💰 *Cobrança da mensalidade para lançar* (${pend.length})\n${linhas.join('\n')}\n\nMarque "Cobrança lançada" no Portal Técnico quando lançar.`);
    }
  }

  // 4) Mensagens ao cliente (só em horário comercial; no máximo 3 por rodada para proteger o número).
  if (cfg.avisos_cliente && horarioComercial(agora)) {
    let enviados = 0;
    const recentes = (await prisma.implantacao.findMany({ where: { virada_fim_em: { gte: new Date(agora.getTime() - 120 * 864e5) }, concluida_fila_em: { not: null } } })).filter(i => !ehLegado(i));
    for (const i of ativas.concat(recentes)) {
      if (enviados >= 3) break;
      if (!i.token_cliente) continue;
      const [itens, fases, coms] = await Promise.all([
        prisma.implantacaoChecklistItem.findMany({ where: { implantacao_id: i.id } }),
        prisma.implantacaoTreinamentoFase.findMany({ where: { implantacao_id: i.id, realizada_em: { not: null } } }),
        prisma.implantacaoComunicacao.findMany({ where: { implantacao_id: i.id }, select: { marco: true } }),
      ]);
      const m = marcosDevidos({ pct: progresso(i, itens), virada: !!i.virada_fim_em, fasesRealizadas: fases.map(f => f.ordem), jaRegistrados: new Set(coms.map(c => c.marco)) });
      for (const marco of m.pular) for (const canal of ['WHATSAPP', 'EMAIL']) await prisma.implantacaoComunicacao.create({ data: { implantacao_id: i.id, marco, canal, status: 'PULADO' } }).catch(() => {});
      const proximo = m.enviar[0];
      if (!proximo) continue;
      await enviarMarco(prisma, i, proximo).catch(e => console.error('[IMPLANTACAO] marco:', e?.message));
      enviados++;
    }
  }

  // 4b) Agenda (Fase 2): lembrete ao cliente no dia útil anterior à virada e a cada fase do treinamento.
  const hora = Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  if (horarioComercial(agora) && hora >= 9) {
    const amanhaUtil = diaSP(somarDiasUteis(agora, 1));
    let cota = 3; // mesmo limite das outras mensagens ao cliente: protege o número

    for (const i of ativas) {
      if (cota > 0 && i.virada_agendada_para && !i.virada_lembrete_em && !i.virada_inicio_em && diaSP(i.virada_agendada_para) > hoje && diaSP(i.virada_agendada_para) <= amanhaUtil) {
        await prisma.implantacao.update({ where: { id: i.id }, data: { virada_lembrete_em: agora } });
        await avisarClienteAgenda(prisma, i, 'LEMBRETE_VIRADA', textoLembreteVirada(i, i.virada_agendada_para)); cota--;
        if (i.tecnico_id) await avisarTecnico(prisma, { para_id: i.tecnico_id, implantacao_id: i.id, origem: 'SISTEMA', texto: `🚀 Virada de ${i.cliente_razao_social} amanhã: ${quando(i.virada_agendada_para)}. Confira os pré-requisitos no card.` }).catch(() => null);
      }
    }
    const fasesAmanha = await prisma.implantacaoTreinamentoFase.findMany({ where: { realizada_em: null, lembrete_em: null, marcada_em: { not: null }, implantacao_id: { in: ativas.map(a => a.id) } } });
    for (const f of fasesAmanha) {
      const dia = diaSP(f.marcada_em!);
      if (cota <= 0) break;
      if (dia <= hoje || dia > amanhaUtil) continue;
      const imp = ativas.find(a => a.id === f.implantacao_id);
      await prisma.implantacaoTreinamentoFase.update({ where: { id: f.id }, data: { lembrete_em: agora } });
      if (imp) { await avisarClienteAgenda(prisma, imp, `LEMBRETE_TREINO_${f.ordem}`, textoAgendaTreino(imp, f, f.marcada_em!, true)); cota--; }
    }
  }
  // 4d) Tarefas do cliente: aviso inicial, lembrete a cada 2 dias úteis depois do prazo (até 3), espera "Cliente"
  // aberta sozinha enquanto houver tarefa vencida; esgotados os lembretes, a supervisão é avisada.
  if (horarioComercial(agora) && hora >= 9) {
    let cota = 3;
    const pend = await prisma.implantacaoTarefaCliente.findMany({ where: { status: 'PENDENTE', implantacao_id: { in: ativas.map(a => a.id) } } });
    const porCard = new Map<string, typeof pend>();
    for (const t of pend) porCard.set(t.implantacao_id, [...(porCard.get(t.implantacao_id) || []), t]);
    const { podeEnviarUmaVez } = await import('./envio-unico.service');
    for (const [impId, ts] of porCard) {
      const imp = ativas.find(a => a.id === impId);
      if (!imp || !imp.token_cliente) continue;
      const vencidas = ts.filter(t => t.prazo && t.prazo < agora);
      if (vencidas.length && !(await prisma.implantacaoEspera.count({ where: { implantacao_id: impId, tipo: 'CLIENTE', fim: null } }))) {
        await prisma.implantacaoEspera.create({ data: { implantacao_id: impId, tipo: 'CLIENTE', motivo: `${MOTIVO_ESPERA_TAREFA}: ${vencidas.map(v => v.titulo).join('; ').slice(0, 900)}`, o_que_resolver: 'O cliente enviar pela página de acompanhamento', aberta_por_nome: 'Otávio (implantação)' } });
        await linha(prisma, impId, 'NOTA', `⏳ Espera "Cliente" aberta: ${vencidas.length} tarefa(s) do cliente vencida(s).`);
      }
      if (cota <= 0) continue;
      const novos = ts.filter(t => t.lembretes === 0);
      if (novos.length) {
        await avisarClienteAgenda(prisma, imp, 'TAREFAS_CLIENTE', textoTarefasCliente(imp, novos, false)); cota--;
        await prisma.implantacaoTarefaCliente.updateMany({ where: { id: { in: novos.map(t => t.id) } }, data: { lembretes: 1, ultimo_lembrete_em: agora } });
        continue;
      }
      const devidas = vencidas.filter(t => t.lembretes <= MAX_LEMBRETES_TAREFA && (!t.ultimo_lembrete_em || somarDiasUteis(t.ultimo_lembrete_em, 2) <= agora));
      if (devidas.length) {
        await avisarClienteAgenda(prisma, imp, 'LEMBRETE_TAREFAS', textoTarefasCliente(imp, devidas, true)); cota--;
        await prisma.implantacaoTarefaCliente.updateMany({ where: { id: { in: devidas.map(t => t.id) } }, data: { lembretes: { increment: 1 }, ultimo_lembrete_em: agora } });
      } else if (vencidas.some(t => t.lembretes > MAX_LEMBRETES_TAREFA) && await podeEnviarUmaVez(prisma, `otavio.tarefas-esgotadas.${impId}.${hoje}`, 20)) {
        await avisarEquipe(prisma, `📎 ${imp.cliente_razao_social} não enviou o que a implantação precisa, mesmo depois de ${MAX_LEMBRETES_TAREFA} lembretes: ${vencidas.map(v => v.titulo).join('; ')}. Vale uma ligação para o decisor.`, impId).catch(() => {});
      }
    }
    // Pesquisa de satisfação 2 dias úteis depois da validação (uma vez).
    const validadas = await prisma.implantacao.findMany({ where: { validado_em: { not: null, gte: CORTE_PORTAL }, pesquisa_enviada_em: null, status: { not: 'CANCELADA' } } });
    for (const v of validadas) {
      if (cota <= 0 || ehLegado(v) || somarDiasUteis(v.validado_em!, 2) > agora) continue;
      await prisma.implantacao.update({ where: { id: v.id }, data: { pesquisa_enviada_em: agora } });
      await avisarClienteAgenda(prisma, v, 'PESQUISA', `${saudacaoCliente(v)} Aqui é da Prosystem. A ${v.modulo === 'SERVICO' ? 'demanda' : 'implantação'} da ${v.cliente_razao_social} foi concluída. Leva 1 minuto: como foi o nosso atendimento? ${URL_FRONT()}/pesquisa`); cota--;
    }
  }

  // 4c) Operação assistida: a partir das 15h, lembra o técnico da checagem do dia que ainda não foi feita.
  if (horarioComercial(agora) && hora >= 15) {
    const viradas = ativas.filter(a => a.virada_fim_em && a.tecnico_id);
    const checks = viradas.length ? await prisma.implantacaoAssistida.findMany({ where: { implantacao_id: { in: viradas.map(v => v.id) } }, select: { implantacao_id: true, dia: true } }) : [];
    const { podeEnviarUmaVez } = await import('./envio-unico.service');
    for (const v of viradas) {
      const st = statusAssistida(v, checks.filter(c => c.implantacao_id === v.id), agora);
      if (st && st.pendentes.includes(hoje) && await podeEnviarUmaVez(prisma, `otavio.assistida.${v.id}.${hoje}`, 20)) {
        await avisarTecnico(prisma, { para_id: v.tecnico_id!, implantacao_id: v.id, origem: 'SISTEMA', texto: `🩺 Operação assistida de ${v.cliente_razao_social}: falta a checagem de hoje (vendas, NFC-e e estoque). ${st.feitos} de ${st.total} dias feitos.` }).catch(() => null);
      }
    }
  }

  // 5) Otávio de olho: o que está faltando (uma vez por dia e demanda).
  if (cfg.agente_ativo && horarioComercial(agora)) await vigiar(prisma, ativas, agora, hoje, resumoGestao);
  if (resumoGestao.length) await avisarGestao(prisma, `resumo.${hoje}.${resumoGestao.join('|').length}`, `🛠️ *Implantação: o que precisa de atenção*\n${resumoGestao.map(t => `• ${t.replace(/^[^\wÀ-ú*]+/, '')}`).join('\n')}`);

  // 6) Ofertas depois da virada (agente de oferta).
  if (cfg.ofertas_ativo && cfg.catalogo.length && horarioComercial(agora)) await rodarOfertas(prisma, cfg, agora);
}

async function vigiar(prisma: PrismaClient, ativas: any[], agora: Date, hoje: string, resumoGestao: string[]) {
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  const umaVez = (k: string) => podeEnviarUmaVez(prisma, `otavio.${k}.${hoje}`, 20);
  for (const i of ativas) {
    const dias = (d?: Date | null) => d ? (agora.getTime() - d.getTime()) / 864e5 : 0;
    const faltas: string[] = [];
    if (!i.tecnico_id && dias(i.data_assinatura) >= 1) {
      if (await umaVez(`sem-tecnico.${i.id}`)) resumoGestao.push(`👷 ${i.cliente_razao_social} está sem técnico há ${Math.floor(dias(i.data_assinatura))} dia(s)`);
      continue;
    }
    if (i.modulo === 'IMPLANTACAO' && !i.onboarding_concluido_em && i.designado_em && somarDiasUteis(i.designado_em, SLA_ONBOARDING_DIAS_UTEIS) < agora) faltas.push('o onboarding técnico (primeiro contato) passou do prazo de 2 dias úteis');
    if (i.modulo === 'IMPLANTACAO') {
      const coleta: any = i.coleta || {};
      if (dias(i.designado_em || i.data_assinatura) >= 2 && (!coleta.regime_tributario || !coleta.contato_nome)) faltas.push('a ficha de coleta está incompleta (regime tributário e contato principal)');
      if (i.virada_inicio_em && !i.tela_suporte_arquivo_id) faltas.push('falta anexar a tela do Suporte');
      if (!i.contato_whatsapp && !i.contato_email && !coleta.contato_telefone) faltas.push('não há WhatsApp nem e-mail do cliente para os avisos de andamento');
    }
    const ultima = await prisma.implantacaoSessao.findFirst({ where: { implantacao_id: i.id }, orderBy: { inicio: 'desc' }, select: { inicio: true } });
    const esperaAberta = await prisma.implantacaoEspera.count({ where: { implantacao_id: i.id, fim: null } });
    if (!esperaAberta && i.designado_em && dias(ultima?.inicio || i.designado_em) >= 3) faltas.push(`ninguém trabalhou nela há ${Math.floor(dias(ultima?.inicio || i.designado_em))} dias (sem espera registrada)`);
    const ocAlta = await prisma.implantacaoOcorrencia.count({ where: { implantacao_id: i.id, situacao: { not: 'RESOLVIDA' }, gravidade: 'ALTA', aberta_em: { lt: new Date(agora.getTime() - 864e5) } } });
    if (ocAlta) faltas.push(`${ocAlta} correção de gravidade alta aberta há mais de 1 dia`);
    if (faltas.length && i.tecnico_id && await umaVez(`faltas.${i.id}`)) {
      await avisarTecnico(prisma, { para_id: i.tecnico_id, implantacao_id: i.id, origem: 'SISTEMA', texto: `${i.cliente_razao_social}: ${faltas.join('; ')}.` });
      registrarAcaoAgente('otavio', `avisou sobre ${i.cliente_razao_social}: ${faltas[0]}`);
    }
  }
  // Cronômetro ligado há mais de 5 horas seguidas: pode ter sido esquecido.
  const longas = await prisma.implantacaoSessao.findMany({ where: { fim: null, inicio: { lt: new Date(agora.getTime() - 5 * 3600000) } } });
  for (const s of longas) if (await umaVez(`play-longo.${s.id}`)) await avisarTecnico(prisma, { para_id: s.tecnico_id, origem: 'SISTEMA', implantacao_id: s.implantacao_id, texto: 'Seu cronômetro está ligado há mais de 5 horas seguidas. Se parou de trabalhar, toque em Pausar.' });
}

// ─── Agente de oferta ────────────────────────────────────────────────────────

async function rodarOfertas(prisma: PrismaClient, cfg: ConfigPortal, agora: Date) {
  const limite = new Date(agora.getTime() - cfg.ofertas_dias_apos_virada * 864e5);
  const alvos = (await prisma.implantacao.findMany({ where: { modulo: 'IMPLANTACAO', virada_fim_em: { lte: limite, gte: new Date(limite.getTime() - 60 * 864e5) } }, take: 30 })).filter(i => !ehLegado(i));
  let feitas = 0;
  for (const i of alvos) {
    if (feitas >= 2) break;
    const numero = numeroWhatsapp(i.contato_whatsapp || (i.coleta as any)?.contato_telefone || '');
    if (!numero) continue;
    // Uma oferta por cliente a cada 30 dias; pessoa no atendimento da conversa = não oferece.
    const ultima = await prisma.ofertaCliente.findFirst({ where: { implantacao_id: i.id }, orderBy: { created_at: 'desc' } });
    if (ultima && agora.getTime() - ultima.created_at.getTime() < 30 * 864e5) continue;
    const conv = await prisma.whatsappConversa.findFirst({ where: { contato_numero: { endsWith: ultimos8(numero) } }, select: { dono_id: true } });
    if (conv?.dono_id) continue;
    const ja = new Set((await prisma.ofertaCliente.findMany({ where: { implantacao_id: i.id }, select: { produto: true } })).map(o => o.produto));
    const contratados = i.cliente_id ? (await prisma.vendaAdicional.findMany({ where: { cliente_id: i.cliente_id, status: { not: 'CANCELADO' } }, include: { parceiro: { select: { nome: true } } } })).map(v => `${v.parceiro?.nome || ''} ${v.descricao_servico || ''} ${v.plano_novo || ''}`.toLowerCase()) : [];
    const item = cfg.catalogo.find(c => !ja.has(c.produto) && !contratados.some(t => t.includes(c.produto.toLowerCase())) && !(i.plano || '').toLowerCase().includes(c.produto.toLowerCase()));
    if (!item) continue;
    const coleta: any = i.coleta || {};
    let texto = `Olá${coleta.contato_nome ? `, ${coleta.contato_nome.split(' ')[0]}` : ''}! Aqui é da Prosystem. Agora que a ${i.cliente_razao_social} já está rodando com o sistema, queria te apresentar: *${item.produto}*. ${item.descricao} Quer que eu te explique melhor?`;
    try {
      const { chamarGemini } = await import('./ia-gemini.service');
      const r = await chamarGemini(prisma, {
        sistema: 'Você escreve UMA mensagem curta de WhatsApp (até 4 linhas) da Prosystem para um cliente que já usa o sistema há algumas semanas, apresentando um produto ou pacote que ele ainda não tem. Use SOMENTE os dados enviados (não invente recursos nem valores; cite o preço só se vier nos dados). Tom consultivo, sem pressão, sem travessão. Termine com UMA pergunta leve de interesse. Responda só o texto.',
        partes: [{ text: JSON.stringify({ empresa: i.cliente_razao_social, contato: coleta.contato_nome || null, plano: i.plano, regime: coleta.regime_tributario || null, filiais: coleta.filiais || null, produto: item.produto, descricao: item.descricao, preco: item.preco }) }],
        temperatura: 0.7, simples: true, timeoutMs: 40000,
      });
      if (r && r.trim().length > 20) texto = r.trim().replace(/\s*[—–]\s*/g, ', ');
    } catch { /* texto padrão */ }
    if (!(await whats(prisma, numero, texto))) continue;
    await prisma.ofertaCliente.create({ data: { cliente_id: i.cliente_id, implantacao_id: i.id, numero, produto: item.produto, texto } }).catch(() => {});
    await linha(prisma, i.id, 'COMUNICACAO', `🛍️ Oferta enviada ao cliente: ${item.produto}.`, 'Agente de oferta');
    registrarAcaoAgente('otavio', `ofereceu ${item.produto} para ${i.cliente_razao_social}`);
    feitas++;
  }
}

// ─── Otávio no WhatsApp (técnico e programação) ──────────────────────────────

/** Mensagem do técnico ou da programação para o número da empresa. true = respondida aqui. */
export async function responderOtavio(prisma: PrismaClient, token: string, numero: string, texto: string): Promise<boolean> {
  const cfg = await obterConfigPortal(prisma);
  if (!cfg.agente_ativo || !texto?.trim()) return false;
  const fim = ultimos8(numero);
  const ehProgramacao = !!cfg.programacao.whatsapp && ultimos8(cfg.programacao.whatsapp) === fim;
  const tecnicos = await prisma.usuarioCRM.findMany({ where: { status: 'ATIVO', cargo: { in: ['TECNICO_IMPLANTACAO', 'SUPERVISAO_TECNICA'] }, telefone: { not: null } }, select: { id: true, nome: true, telefone: true } });
  const tecnico = tecnicos.find(t => ultimos8((t.telefone || '').replace(/\D/g, '')) === fim);
  if (!ehProgramacao && !tecnico) return false;
  const responder = (t: string) => evo.enviarTexto(token, numero, t).then(() => true).catch(() => true);

  // Programação: "resolvido ..." fecha a espera (se houver só uma, ou pelo número da lista).
  if (ehProgramacao && /^\s*resolvid/i.test(texto)) {
    const abertas = await prisma.implantacaoEspera.findMany({ where: { tipo: 'PROGRAMACAO', fim: null }, include: { implantacao: { select: { cliente_razao_social: true, tecnico_id: true } } }, orderBy: { inicio: 'asc' } });
    if (!abertas.length) return responder('Não há nenhuma pendência aberta para a programação agora. 👍');
    const m = texto.match(/^\s*resolvid[oa]?\s*(\d+)?\s*[:\-.,]?\s*([\s\S]*)$/i);
    const n = m?.[1] ? Number(m[1]) : null;
    if (abertas.length > 1 && !n) return responder(`Há ${abertas.length} pendências. Responda "resolvido" + o número e o que foi feito:\n${abertas.map((e, k) => `${k + 1}. ${e.implantacao.cliente_razao_social}: ${e.motivo}`).join('\n')}`);
    const e = abertas[(n || 1) - 1];
    if (!e) return responder('Não achei esse número na lista. Mande "resolvido" para ver as pendências.');
    const resposta = (m?.[2] || '').trim() || null;
    await prisma.implantacaoEspera.update({ where: { id: e.id }, data: { fim: new Date(), resolvida_por_nome: cfg.programacao.nome, resposta } });
    await linha(prisma, e.implantacao_id, 'CRONOMETRO', `✅ Fim da espera (programação), resolvido por ${cfg.programacao.nome} pelo WhatsApp${resposta ? `: ${resposta}` : ''}`);
    if (e.implantacao.tecnico_id) await avisarTecnico(prisma, { para_id: e.implantacao.tecnico_id, implantacao_id: e.implantacao_id, origem: 'SISTEMA', prioridade: 'URGENTE', texto: `${cfg.programacao.nome} resolveu a pendência de ${e.implantacao.cliente_razao_social}${resposta ? `: ${resposta}` : ''}. Pode retomar.` });
    registrarAcaoAgente('otavio', `${cfg.programacao.nome} resolveu a pendência de ${e.implantacao.cliente_razao_social}`);
    return responder(`Obrigado! Marquei como resolvida a pendência de ${e.implantacao.cliente_razao_social} e avisei o técnico.`);
  }

  // Técnico (ou programação perguntando): responde com o contexto real das demandas.
  const demandas = await prisma.implantacao.findMany({
    where: { concluida_fila_em: null, data_conclusao: null, status: { not: 'CANCELADA' }, ...(tecnico && !ehProgramacao ? { tecnico_id: tecnico.id } : {}) },
    include: { checklist: true, esperas: { where: { fim: null } }, ocorrencias: { where: { situacao: { not: 'RESOLVIDA' } } }, sessoes: { select: { inicio: true, fim: true, tipo: true, etapa: true } } },
    take: 40,
  });
  const contexto = demandas.map(d => {
    const t = temposDaDemanda(d.sessoes, []);
    const prazo = d.virada_fim_em || d.modulo === 'SERVICO' ? d.prazo_finalizacao : d.prazo_virada;
    const sla = situacaoSla(d.data_assinatura, prazo, null);
    const pendentes = d.checklist.filter(c => !c.feito && gruposDoProgresso(d.modulo, d.tipo_base).includes(c.grupo)).map(c => c.titulo);
    return {
      cliente: d.cliente_razao_social, modulo: d.modulo === 'SERVICO' ? `serviço ${TIPOS_SERVICO[d.tipo_servico || 'OUTRO']?.label}` : d.tipo_base === 'CONVERSAO' ? `conversão${d.sistema_anterior ? ` (de ${d.sistema_anterior})` : ''}` : 'banco zerado',
      coluna: COLUNAS.find(c => c.key === colunaDe(d))?.label, progresso: `${progresso(d, d.checklist)}%`, tempo_trabalhado: fmtHoras(t.trabalho_ms),
      prazo: prazo ? prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null, situacao_prazo: sla?.situacao || null,
      virada: d.virada_fim_em ? 'feita' : d.virada_inicio_em ? 'em andamento' : 'não iniciada', cobranca_lancada: !!d.cobranca_lancada_em,
      proximos_itens: pendentes.slice(0, 5), esperas_abertas: d.esperas.map(e => `${e.tipo}: ${e.motivo}`), correcoes_abertas: d.ocorrencias.map(o => `${o.titulo} (${o.gravidade})`),
      ficha: d.coleta || null,
    };
  });
  let resposta = 'Não consegui consultar agora. Tente de novo em instantes ou veja no Portal Técnico.';
  try {
    const { chamarGemini } = await import('./ia-gemini.service');
    resposta = (await chamarGemini(prisma, {
      sistema: [
        `Você é o Otávio, assistente de implantação da Prosystem, falando pelo WhatsApp com ${ehProgramacao ? `${cfg.programacao.nome}, da programação` : `${tecnico!.nome.split(' ')[0]}, técnico de implantação`}.`,
        'Responda em português do Brasil, curto e direto (até 8 linhas), usando SOMENTE os dados das demandas enviados. Se a informação não estiver nos dados, diga que não tem e indique o Portal Técnico.',
        'Você pode explicar o que falta em cada demanda, prazos, tempo gasto, próximos itens do checklist, esperas e dados da ficha de coleta.',
        'Lembretes úteis: o cronômetro é pelo Portal Técnico (Play/Pausar); para registrar espera use o botão Espera; a virada é "Iniciar virada" e "Loja virada" (exige a tela do Suporte anexada).',
        'Sem travessão. Pode usar *negrito* do WhatsApp.',
      ].join('\n'),
      partes: [{ text: `Hoje: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\nDemandas: ${JSON.stringify(contexto)}\n\nMensagem: ${texto}` }],
      temperatura: 0.3, simples: true, timeoutMs: 45000,
    })).trim().replace(/\s*[—–]\s*/g, ', ') || resposta;
  } catch { /* resposta padrão */ }
  registrarAcaoAgente('otavio', `respondeu ${ehProgramacao ? cfg.programacao.nome : tecnico!.nome.split(' ')[0]} no WhatsApp`);
  return responder(resposta);
}
