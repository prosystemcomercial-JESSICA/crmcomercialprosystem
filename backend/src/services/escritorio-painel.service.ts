import type { PrismaClient } from '@prisma/client';
import { limitesPeriodo } from '@/lib/painel-tv';
import { AGENTES } from '@/lib/assistente/escritorio';
import { SETORES, LIGACOES, setorDe, recebeDe, entregaPara, motivoErro, situacaoTeto } from '@/lib/assistente/escritorio-setores';
import type { EstadoAgente } from './escritorio.service';

// Escritório novo (10/11/2026): tudo o que a tela por setores precisa além do estado de cada agente.
// Saúde (agentes, IAs, WhatsApp), quadro padrão por agente (7 e 30 dias, qualidade, IA do mês), passagens
// do dia entre agentes (organograma vivo), a fila "Esperando você" e o teto mensal de IA. Somente leitura.

export const CHAVE_TETO_IA = 'ia.teto_mensal_brl';
const REMETENTE: Record<string, string[]> = {
  caroline: ['caroline'], julio: ['julio'], luiz_felipe: ['luiz_felipe', 'cadencia_automatica'],
  bia: ['bot'], clarice: ['assistente_ia'], otavio: ['otavio'],
};
const SDRS = ['caroline', 'julio', 'luiz_felipe'];
const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const json = (v: string | null | undefined) => { try { return v ? JSON.parse(v) : {}; } catch { return {}; } };

/** Gasto do mês com IA paga (custo gravado em ia.agentes.<dia>), previsão e teto. */
export async function consumoDoMes(prisma: PrismaClient, agora = new Date()) {
  const mes = diaSP(agora).slice(0, 7);
  const [linhas, falhasLinhas, tetoRow] = await Promise.all([
    prisma.configuracaoIntegracao.findMany({ where: { chave: { startsWith: `ia.agentes.${mes}` } }, select: { chave: true, valor: true } }),
    prisma.configuracaoIntegracao.findMany({ where: { chave: { startsWith: 'ia.falhas.' }, updated_at: { gte: new Date(agora.getTime() - 31 * 864e5) } }, select: { chave: true, valor: true } }),
    prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_TETO_IA } }),
  ]);
  const { cotacaoDolar } = await import('./cotacao-dolar.service');
  const cot = await cotacaoDolar(prisma).catch(() => ({ valor: 5.5 }));
  const porAgente: Record<string, { chamadas: number; falhas: number; brl: number }> = {};
  const porDia: { dia: string; chamadas: number; falhas: number; brl: number }[] = [];
  let usd = 0;
  for (const l of linhas.sort((a, b) => a.chave.localeCompare(b.chave))) {
    const dia = l.chave.slice('ia.agentes.'.length);
    const v = json(l.valor) as Record<string, any>;
    const d = { dia, chamadas: 0, falhas: 0, brl: 0 };
    for (const [ag, u] of Object.entries(v)) {
      const ch = (u.openai || 0) + (u.grok || 0) + (u.groq || 0) + (u.gemini || 0) + (u.openrouter || 0) + (u.whisper || 0);
      const c = (u.custo_openai_usd || 0) + (u.custo_grok_usd || 0);
      const t = (porAgente[ag] ||= { chamadas: 0, falhas: 0, brl: 0 });
      t.chamadas += ch; t.falhas += u.falhas || 0; t.brl += c * cot.valor;
      d.chamadas += ch; d.falhas += u.falhas || 0; d.brl += c * cot.valor; usd += c;
    }
    d.brl = Math.round(d.brl * 100) / 100;
    porDia.push(d);
  }
  const falhasProvedor = falhasLinhas.map(r => ({ dia: r.chave.slice('ia.falhas.'.length), ...json(r.valor) })).sort((a, b) => a.dia.localeCompare(b.dia));
  const brl = Math.round(usd * cot.valor * 100) / 100;
  const diasNoMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
  const decorridos = Number(diaSP(agora).slice(8, 10));
  const previsao = Math.round((decorridos ? (brl / decorridos) * diasNoMes : 0) * 100) / 100;
  const teto = Number(tetoRow?.valor) || 0;
  for (const a of Object.values(porAgente)) a.brl = Math.round(a.brl * 100) / 100;
  return { mes, brl, previsao, teto, ...situacaoTeto(brl, previsao, teto), por_dia: porDia, por_agente: porAgente, falhas_provedor: falhasProvedor, cotacao: cot.valor };
}

/** Aviso único por mês quando o gasto passa de 80% do teto (e outro quando estoura). */
export async function verificarTetoIa(prisma: PrismaClient, agora = new Date()) {
  const c = await consumoDoMes(prisma, agora);
  if (c.nivel !== 'atencao' && c.nivel !== 'estourou') return;
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  if (!(await podeEnviarUmaVez(prisma, `ia.teto.${c.nivel}.${c.mes}`, 24 * 32))) return;
  const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', `${c.nivel === 'estourou' ? '🚨' : '⚠️'} *Gasto com IA paga: ${Math.round(c.usado * 100)}% do teto do mês*\nGasto até agora: ${reais(c.brl)} · teto ${reais(c.teto)} · previsão do mês ${reais(c.previsao)}.\nDetalhes no Escritório › Consumo de IA.`).catch(() => {});
}

export async function painelEscritorio(prisma: PrismaClient, agentes: EstadoAgente[], agora = new Date()) {
  const { inicioHoje, fimHoje } = limitesPeriodo(agora);
  const hoje = { gte: inicioHoje, lt: fimHoje };
  const d7 = new Date(agora.getTime() - 7 * 864e5), d30 = new Date(agora.getTime() - 30 * 864e5);

  // Mensagens enviadas por remetente: hoje, 7 e 30 dias.
  const remetentes = Object.values(REMETENTE).flat();
  const contar = (desde: Date) => prisma.whatsappMensagem.groupBy({ by: ['enviada_por'], where: { direcao: 'SAIDA', enviada_por: { in: remetentes }, created_at: { gte: desde } }, _count: { _all: true } }).catch(() => [] as any[]);
  const [mHoje, m7, m30] = await Promise.all([contar(inicioHoje), contar(d7), contar(d30)]);
  const soma = (rows: any[], id: string) => (REMETENTE[id] || []).reduce((s, r) => s + (rows.find(x => x.enviada_por === r)?._count._all || 0), 0);

  // Qualidade dos SDRs em 30 dias: como as mensagens saíram (sozinhas, aprovadas, editadas, descartadas, seguradas pela Laya).
  const msgs = await prisma.sdrMensagem.findMany({ where: { created_at: { gte: d30 } }, select: { status: true, acao: true, sdrId: true } }).catch(() => []);
  const donos = new Map((await prisma.sdrLead.findMany({ where: { id: { in: [...new Set(msgs.map(m => m.sdrId))] } }, select: { id: true, agente: true } }).catch(() => [])).map(s => [s.id, s.agente]));
  const qualidade: Record<string, { sozinha: number; aprovada: number; editada: number; descartada: number; segurada_laya: number; esperando: number }> = {};
  for (const m of msgs) {
    const ag = donos.get(m.sdrId); if (!ag) continue;
    const q = (qualidade[ag] ||= { sozinha: 0, aprovada: 0, editada: 0, descartada: 0, segurada_laya: 0, esperando: 0 });
    if (m.status === 'ENVIADA_AUTO') q.sozinha++;
    else if (m.status === 'APROVADA') q.aprovada++;
    else if (m.status === 'EDITADA') q.editada++;
    else if (m.status === 'DESCARTADA') q.descartada++;
    else if (m.status === 'PENDENTE') q.esperando++;
    if ((m.acao || '').includes('laya_motivo')) q.segurada_laya++;
  }

  // IA por agente hoje (para o status "com erro") e no mês (quadro e consumo).
  const usoHoje = json((await prisma.configuracaoIntegracao.findUnique({ where: { chave: `ia.agentes.${diaSP(agora)}` } }).catch(() => null))?.valor) as Record<string, any>;
  const consumo = await consumoDoMes(prisma, agora);

  // Configurações dos SDRs (pausa automática).
  const { obterConfigAgente } = await import('./caroline.service');
  const cfgSdr = Object.fromEntries(await Promise.all(SDRS.map(async a => [a, await obterConfigAgente(prisma, a as any)] as const)));

  // Passagens do dia (organograma vivo).
  const [heitorHoje, demosHoje, notasHoje, leadsSofia, informativos] = await Promise.all([
    prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: hoje } }).catch(() => 0),
    prisma.atividade.count({ where: { created_by: 'lead_whatsapp', created_at: hoje } }).catch(() => 0),
    prisma.agenteNota.groupBy({ by: ['de', 'para', 'tipo'], where: { created_at: hoje }, _count: { _all: true } }).catch(() => [] as any[]),
    prisma.pesquisaSetor.count({ where: { created_at: hoje } }).catch(() => 0),
    prisma.especialistaDoc.count({ where: { origem: 'joana', decidido_em: hoje, status: 'APROVADO' } }).catch(() => 0),
  ]);
  const notas = (de: string, para: string | string[], tipos?: string[]) => (notasHoje as any[])
    .filter(n => n.de === de && ([] as string[]).concat(para).includes(n.para) && (!tipos || tipos.includes(n.tipo))).reduce((s, n) => s + n._count._all, 0);
  const seguradasHoje = await prisma.sdrMensagem.count({ where: { created_at: hoje, acao: { contains: 'laya_motivo' } } }).catch(() => 0);
  const contagem: Record<string, number | null> = {
    'heitor>caroline': heitorHoje,
    'bia>caroline': notas('bia', 'caroline'),
    'zequinha>caroline': null,
    'julio>caroline': notas('julio', 'caroline'),
    'caroline>lurdinha': demosHoje,
    'luiz_felipe>julio': null,
    'rafael>caroline': notas('rafael', ['caroline', 'equipe'], ['ORIENTACAO']),
    'rafael>julio': notas('rafael', 'julio', ['ORIENTACAO']),
    'rafael>luiz_felipe': notas('rafael', 'luiz_felipe', ['ORIENTACAO']),
    'laya>caroline': seguradasHoje + notas('laya', 'rafael'),
    'olivia>rafael': notas('olivia', 'rafael'),
    'sofia>joana': leadsSofia,
    'joana>zequinha': informativos,
    'helena>mila': notas('helena', 'mila'),
    'otavio>mila': notas('otavio', 'mila'),
  };
  const passagens = LIGACOES.map(l => ({ ...l, hoje: contagem[`${l.de}>${l.para}`] ?? null }));

  // Esperando você: perguntas, documentos para aprovar e mensagens paradas na aprovação.
  const [perguntas, docs, pendentes] = await Promise.all([
    prisma.agenteNota.findMany({ where: { tipo: { in: ['PERGUNTA'] }, para: 'jessica', resolvida_em: null }, orderBy: { created_at: 'desc' }, take: 50, select: { id: true, assunto: true, texto: true, created_at: true } }).catch(() => []),
    prisma.especialistaDoc.findMany({ where: { status: 'PROPOSTO' }, orderBy: { created_at: 'desc' }, take: 60, select: { id: true, tipo: true, titulo: true, origem: true, agente_alvo: true, created_at: true } }).catch(() => []),
    prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE' }, orderBy: { created_at: 'asc' }, take: 60, select: { id: true, sdrId: true, acao: true, created_at: true } }).catch(() => []),
  ]);
  const donosPend = new Map((await prisma.sdrLead.findMany({ where: { id: { in: pendentes.map(p => p.sdrId) } }, select: { id: true, agente: true, nome: true } }).catch(() => [])).map(s => [s.id, s]));
  const painelDoDoc = (d: { origem: string | null; tipo: string }) => d.origem === 'joana' ? 'joana' : d.origem === 'mila' ? 'mila' : 'rafael';
  const esperando = [
    ...pendentes.map(p => { const s = donosPend.get(p.sdrId); const a = json(p.acao); return { id: p.id, tipo: 'mensagem' as const, agente: s?.agente || 'caroline', painel: s?.agente || 'caroline', titulo: `Mensagem para ${s?.nome || 'um lead'}`, detalhe: a.laya_motivo ? `Segurada pela Laya: ${a.laya_motivo}` : 'Esperando sua aprovação', em: p.created_at.toISOString() }; }),
    ...perguntas.map(p => ({ id: p.id, tipo: 'pergunta' as const, agente: 'rafael', painel: 'rafael', titulo: p.texto.slice(0, 160), detalhe: p.assunto, em: p.created_at.toISOString() })),
    ...docs.map(d => ({ id: d.id, tipo: 'documento' as const, agente: d.origem === 'revisao' || d.origem === 'estudo' || d.origem === 'treinamento' || d.origem === 'duvida' || !d.origem ? 'rafael' : d.origem, painel: painelDoDoc(d), titulo: d.titulo.slice(0, 160), detalhe: `${d.tipo}${d.agente_alvo ? ` · para ${d.agente_alvo}` : ''}`, em: d.created_at.toISOString() })),
  ];

  // Quadro padrão e status com erro.
  const nomes = Object.fromEntries(AGENTES.map(a => [a.id, a.nome]));
  const quadros = agentes.map(a => {
    const u = usoHoje[a.id] || null;
    const iaHoje = u ? { ok: (u.openai || 0) + (u.grok || 0) + (u.groq || 0) + (u.gemini || 0) + (u.openrouter || 0), falhas: u.falhas || 0 } : null;
    const cfg = cfgSdr[a.id];
    const erro = motivoErro({ pausadaMotivo: cfg?.pausada_motivo, pausadaAte: cfg?.pausada_ate, agora, iaHoje });
    const paraAprovar = Number(a.numeros.find(n => /para aprovar/.test(n.rotulo))?.valor) || 0;
    const ia = consumo.por_agente[a.id] || { chamadas: 0, falhas: 0, brl: 0 };
    return {
      id: a.id, setor: setorDe(a.id), erro, precisa_de_voce: paraAprovar ? `${paraAprovar} para aprovar` : null,
      recebe_de: recebeDe(a.id).map(x => nomes[x] || x), entrega_para: entregaPara(a.id).map(x => nomes[x] || x),
      mensagens: REMETENTE[a.id] ? { hoje: soma(mHoje, a.id), d7: soma(m7, a.id), d30: soma(m30, a.id) } : null,
      qualidade: qualidade[a.id] || null,
      ia_mes: ia,
    };
  });

  // Saúde: agentes, IAs e números de WhatsApp.
  const { estadoProvedoresIa } = await import('./ia-gemini.service');
  const provedores = await estadoProvedoresIa(prisma).catch(() => []);
  const instancias = await prisma.whatsappInstancia.findMany({ select: { apelido: true, instancia_nome: true, status: true } }).catch(() => []);
  const ligados = agentes.filter(a => a.status !== 'desligado').length;
  const comErro = quadros.filter(q => q.erro).map(q => ({ id: q.id, nome: nomes[q.id], motivo: q.erro! }));
  const saude = {
    agentes: { total: agentes.length, ligados, com_erro: comErro },
    ias: { total: provedores.filter(p => p.estado !== 'sem_chave').length, com_falha: provedores.filter(p => p.estado === 'pausado'), provedores },
    whatsapp: { total: instancias.length, conectados: instancias.filter(i => i.status === 'CONECTADO').length, desconectados: instancias.filter(i => i.status !== 'CONECTADO').map(i => i.apelido || i.instancia_nome) },
    esperando: esperando.length,
  };
  return { setores: SETORES, saude, quadros, passagens, esperando, consumo };
}
