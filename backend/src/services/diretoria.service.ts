import type { PrismaClient } from '@prisma/client';
import { chamarGemini } from './ia-gemini.service';
import { lerJsonIa } from '@/lib/assistente/ia-texto';
import { AGENTES, statusAgente, maisRecente, registrarAcaoAgente, acaoRegistrada, type AgenteId } from '@/lib/assistente/escritorio';
import { SETORES } from '@/lib/assistente/escritorio-setores';
import {
  DIRETORIA, SETORES_DO_GERENTE, NOME_DIRETOR, INDICADORES, ehSdr, avaliarAgente, proximoPasso, degrauDepois, textoCobranca, oQueFazer,
  lerPlanoVitoria, descreverProvidencia, semanaDe, mesDe, diaDe, horaSP, AGENDA,
  type NumerosAgente, type Avaliacao, type Degrau, type Gerente, type Providencia, type IndicadorId, type MetaAgente,
} from '@/lib/assistente/diretoria';
import type { EstadoAgente } from './escritorio.service';

// Diretoria dos agentes (pedido da Jessica, 13/11/2026): Vitória (CEO), Gustavo e Renata (gerentes) e o boletim
// semanal do Rafael com a Laya. Sem tabela nova: documentos em EspecialistaDoc (BOLETIM, PLANO, DECISAO), recados
// em AgenteNota, regras em AgenteInstrucao, metas das vendedoras em Meta e o resto em ConfiguracaoIntegracao.
// A Vitória tem liberdade total (pedido da Jessica): aplica e avisa; cada providência pode ser desfeita no painel.

const CH = {
  escada: 'diretoria.escada',
  metas: (mes: string) => `diretoria.metas.${mes}`,
  feito: (o: string, chave: string) => `diretoria.feito.${o}.${chave}`,
};
const DIA = 864e5;
const nomeDe = (id: string) => (AGENTES as readonly { id: string; nome: string }[]).find(a => a.id === id)?.nome || id;
const json = <T>(v: string | null | undefined, padrao: T): T => { try { return v ? JSON.parse(v) as T : padrao; } catch { return padrao; } };
const lerCfg = async <T>(prisma: PrismaClient, chave: string, padrao: T) => json<T>((await prisma.configuracaoIntegracao.findUnique({ where: { chave } }).catch(() => null))?.valor, padrao);
const gravarCfg = (prisma: PrismaClient, chave: string, valor: unknown) => {
  const v = typeof valor === 'string' ? valor : JSON.stringify(valor);
  return prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor: v, updated_by: 'diretoria' }, update: { valor: v } });
};
/** Trava de "uma vez por período": devolve true só para quem conseguiu marcar primeiro. */
async function marcarUmaVez(prisma: PrismaClient, o: string, chave: string): Promise<boolean> {
  try { await prisma.configuracaoIntegracao.create({ data: { chave: CH.feito(o, chave), valor: new Date().toISOString(), updated_by: 'diretoria' } }); return true; } catch { return false; }
}
const desmarcar = (prisma: PrismaClient, o: string, chave: string) => prisma.configuracaoIntegracao.delete({ where: { chave: CH.feito(o, chave) } }).catch(() => {});

async function avisarJessica(prisma: PrismaClient, texto: string) {
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', texto, { somenteAprovadora: true }).catch(() => {});
}
const anotar = (prisma: PrismaClient, n: { de: string; para: string; tipo: 'CONTEXTO' | 'ORIENTACAO'; assunto: string; texto: string; ref?: string | null }) =>
  import('./equipe.service').then(m => m.anotar(prisma, n as any)).catch(() => null);
const conversa = (de: string, para: string, tema: string, falas: { quem: string; texto: string }[]) =>
  import('@/lib/assistente/conversas-agentes').then(m => m.registrarConversaAgentes(de, para, tema, falas as any)).catch(() => {});
const link = () => `${(process.env.FRONTEND_URL || '').split(',')[0]?.trim().replace(/\/$/, '') || 'https://comercial.prosystemnet.com'}/escritorio?diretoria=1`;

/** Agentes avaliados (todos, menos a própria diretoria). */
const avaliados = () => AGENTES.map(a => a.id as string).filter(id => !(DIRETORIA as readonly string[]).includes(id));
const equipeDo = (g: Gerente) => SETORES.filter(s => SETORES_DO_GERENTE[g].includes(s.id)).flatMap(s => s.agentes as readonly string[]);

// ───────────────────────── Números ─────────────────────────

const lerLaya = (acao: string | null) => { try { return acao ? (JSON.parse(acao)?.laya_motivo as string | undefined) || null : null; } catch { return null; } };

/** Números de cada agente nos últimos `dias` (padrão 7), mais os motivos das mensagens seguradas pela Laya. */
export async function numerosDosAgentes(prisma: PrismaClient, agora = new Date(), dias = 7) {
  const desde = new Date(agora.getTime() - dias * DIA);
  const { REMETENTE } = await import('./escritorio-painel.service');
  const remetentes = Object.values(REMETENTE).flat();
  const enviadas = await prisma.whatsappMensagem.groupBy({ by: ['enviada_por'], where: { direcao: 'SAIDA', enviada_por: { in: remetentes }, created_at: { gte: desde } }, _count: { _all: true } }).catch(() => [] as any[]);
  const msgs = await prisma.sdrMensagem.findMany({ where: { created_at: { gte: desde } }, select: { status: true, acao: true, sdrId: true } }).catch(() => []);
  const donos = new Map((await prisma.sdrLead.findMany({ where: { id: { in: [...new Set(msgs.map(m => m.sdrId))] } }, select: { id: true, agente: true } }).catch(() => [])).map(s => [s.id, s.agente as string]));
  const decididas: Record<string, NonNullable<NumerosAgente['decididas']>> = {};
  const motivosLaya: Record<string, string[]> = {};
  for (const m of msgs) {
    const ag = donos.get(m.sdrId); if (!ag) continue;
    const q = (decididas[ag] ||= { sozinha: 0, aprovada: 0, editada: 0, descartada: 0, segurada_laya: 0 });
    if (m.status === 'ENVIADA_AUTO') q.sozinha++; else if (m.status === 'APROVADA') q.aprovada++; else if (m.status === 'EDITADA') q.editada++; else if (m.status === 'DESCARTADA') q.descartada++;
    const mot = lerLaya(m.acao);
    if (mot) { q.segurada_laya++; (motivosLaya[ag] ||= []).push(mot.slice(0, 160)); }
  }
  // IA por agente: soma dos registros diários.
  const chaves = Array.from({ length: dias }, (_, i) => `ia.agentes.${diaDe(new Date(agora.getTime() - i * DIA))}`);
  const usos = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: chaves } }, select: { valor: true } }).catch(() => []);
  const ia: Record<string, { chamadas: number; falhas: number }> = {};
  for (const u of usos) for (const [ag, x] of Object.entries(json<Record<string, any>>(u.valor, {}))) {
    const t = (ia[ag] ||= { chamadas: 0, falhas: 0 });
    t.chamadas += (x.openai || 0) + (x.grok || 0) + (x.groq || 0) + (x.gemini || 0) + (x.openrouter || 0) + (x.whisper || 0);
    t.falhas += x.falhas || 0;
  }
  const boletim = await boletimRecente(prisma, agora);
  const numeros: NumerosAgente[] = avaliados().map(id => ({
    id,
    mensagens: (REMETENTE[id] || []).reduce((s, r) => s + ((enviadas as any[]).find(x => x.enviada_por === r)?._count._all || 0), 0),
    decididas: ehSdr(id) ? decididas[id] || { sozinha: 0, aprovada: 0, editada: 0, descartada: 0, segurada_laya: 0 } : null,
    ia: ia[id] || { chamadas: 0, falhas: 0 },
    nota: boletim?.agentes.find(b => b.id === id)?.nota ?? null,
    melhorar: boletim?.agentes.find(b => b.id === id)?.melhorar ?? null,
  }));
  return { numeros, motivosLaya, boletim };
}

// ───────────────────────── Boletim do Rafael + Laya ─────────────────────────

export type NotaBoletim = { id: string; nota: number | null; motivo: string; melhorar: string | null };
type Boletim = { id: string; criado: Date; resumo: string; agentes: NotaBoletim[] };

/** Boletim mais recente, se tiver até 8 dias (depois disso as notas já não valem para cobrança). */
export async function boletimRecente(prisma: PrismaClient, agora = new Date()): Promise<Boletim | null> {
  const d = await prisma.especialistaDoc.findFirst({ where: { tipo: 'BOLETIM', created_at: { gte: new Date(agora.getTime() - 8 * DIA) } }, orderBy: { created_at: 'desc' } }).catch(() => null);
  if (!d) return null;
  const f = (d.fontes || {}) as any;
  return { id: d.id, criado: d.created_at, resumo: String(f.resumo || ''), agentes: Array.isArray(f.agentes) ? f.agentes : [] };
}

/** Sexta 16h (ou sob demanda): o Rafael dá nota a cada agente com os números e o que a Laya segurou. */
export async function gerarBoletim(prisma: PrismaClient, agora = new Date()) {
  const { numeros, motivosLaya } = await numerosDosAgentes(prisma, agora);
  const desde = new Date(agora.getTime() - 7 * DIA);
  const docsRafael = await prisma.especialistaDoc.findMany({ where: { created_at: { gte: desde }, tipo: { in: ['TREINAMENTO', 'ALERTA'] } }, orderBy: { created_at: 'desc' }, take: 8, select: { titulo: true, conteudo: true } }).catch(() => []);
  const notasEquipe = await prisma.agenteNota.findMany({ where: { created_at: { gte: desde }, tipo: { in: ['ORIENTACAO', 'EXPERIENCIA', 'DUVIDA'] } }, orderBy: { created_at: 'desc' }, take: 30, select: { de: true, para: true, tipo: true, assunto: true } }).catch(() => []);
  const linhas = numeros.map(n => {
    const d = n.decididas;
    return `- ${n.id} (${nomeDe(n.id)}, ${(AGENTES as readonly any[]).find(a => a.id === n.id)?.funcao}): mensagens a clientes ${n.mensagens}`
      + (d ? `; mensagens decididas: ${d.sozinha} sozinhas, ${d.aprovada} aprovadas, ${d.editada} corrigidas, ${d.descartada} descartadas, ${d.segurada_laya} seguradas pela Laya` : '')
      + `; IA: ${n.ia.chamadas} chamadas, ${n.ia.falhas} falhas`
      + (motivosLaya[n.id]?.length ? `\n  Laya segurou porque: ${motivosLaya[n.id].slice(0, 6).join(' | ')}` : '');
  });
  const pergunta = [
    'Você é o Rafael, especialista em vendas de software e professor do time de agentes de IA da Prosystem, fazendo o BOLETIM SEMANAL DE DESEMPENHO junto com a Laya (que confere as mensagens antes de sair e segura as ruins).',
    'O boletim vai para a Vitória, a CEO dos agentes, que decide metas e providências. Seja justo e concreto: nota só com evidência (números, o que a Laya segurou, treinos e alertas da semana). Sem evidência suficiente, nota null e diga o que falta para avaliar.',
    'Para cada agente: nota de 0 a 10, motivo em uma frase com o número que pesou e o que ele precisa melhorar (uma ação concreta, ou null se está bem). Falha de IA é problema técnico do sistema, não do agente: cite, mas não tire nota por isso.',
    'Português do Brasil, frases curtas, sem travessão.',
    'Responda APENAS com JSON: {"resumo": "3 a 5 frases sobre o time na semana", "agentes": [{"id": "id do agente", "nota": 0-10 ou null, "motivo": "...", "melhorar": "... ou null"}]}',
    '', '=== NÚMEROS DOS ÚLTIMOS 7 DIAS ===', ...linhas,
    docsRafael.length ? `\n=== TREINOS E ALERTAS DO RAFAEL NA SEMANA ===\n${docsRafael.map(d => `## ${d.titulo}\n${d.conteudo.slice(0, 700)}`).join('\n\n')}` : '',
    notasEquipe.length ? `\n=== MURAL DA SEMANA (quem passou o quê) ===\n${notasEquipe.map(n => `- ${n.tipo} ${n.de} → ${n.para}: ${n.assunto}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  const r = lerJsonIa<any>(await chamarGemini(prisma, { sistema: 'Você avalia agentes de IA de uma equipe comercial. Responda só com o JSON pedido.', partes: [{ text: pergunta }], json: true, temperatura: 0.2, timeoutMs: 180_000, agente: 'rafael' }));
  if (!Array.isArray(r?.agentes)) throw new Error('o Rafael não conseguiu montar o boletim desta vez');
  const validos = new Set(avaliados());
  const agentes: NotaBoletim[] = r.agentes.filter((a: any) => validos.has(String(a?.id))).map((a: any) => {
    const nota = Number(a.nota);
    return { id: String(a.id), nota: Number.isFinite(nota) && a.nota !== null ? Math.max(0, Math.min(10, Math.round(nota * 10) / 10)) : null, motivo: String(a.motivo || '').replace(/[—–]/g, ',').slice(0, 300), melhorar: a.melhorar ? String(a.melhorar).replace(/[—–]/g, ',').slice(0, 300) : null };
  });
  const resumo = String(r.resumo || '').replace(/[—–]/g, ',').slice(0, 1200);
  const semana = semanaDe(agora);
  const md = [
    `# Boletim de desempenho · semana de ${semana.split('-').reverse().join('/')}`, '', `*Rafael e Laya, para a Vitória.*`, '', resumo, '',
    '| Agente | Nota | Motivo | O que melhorar |', '|---|---|---|---|',
    ...agentes.map(a => `| ${nomeDe(a.id)} | ${a.nota ?? '—'} | ${a.motivo} | ${a.melhorar || ''} |`),
  ].join('\n');
  const doc = await prisma.especialistaDoc.create({ data: { tipo: 'BOLETIM', titulo: `Boletim de desempenho · ${semana}`, conteudo: md, status: 'APROVADO', origem: 'rafael', decidido_por: 'rafael', decidido_em: new Date(), fontes: { resumo, agentes, numeros } as any } });
  const seguradas = Object.entries(motivosLaya).map(([ag, m]) => `${nomeDe(ag)}: ${m.length}`).join(', ');
  await anotar(prisma, { de: 'rafael', para: 'vitoria', tipo: 'CONTEXTO', assunto: `Boletim da semana de ${semana}`, texto: resumo, ref: doc.id });
  await anotar(prisma, { de: 'laya', para: 'vitoria', tipo: 'CONTEXTO', assunto: `Mensagens seguradas na semana de ${semana}`, texto: seguradas ? `Segurei mensagens de: ${seguradas}.` : 'Não precisei segurar nenhuma mensagem nesta semana.', ref: doc.id });
  conversa('rafael', 'vitoria', 'Boletim da semana', [{ quem: 'rafael', texto: 'Vitória, o boletim da semana está pronto. A Laya juntou o que segurou.' }, { quem: 'vitoria', texto: 'Obrigada, vou usar na reunião de segunda.' }]);
  registrarAcaoAgente('rafael', 'fechou o boletim de desempenho da semana com a Laya');
  registrarAcaoAgente('laya', 'passou à Vitória as mensagens que segurou na semana');
  return doc;
}

// ───────────────────────── Gerentes ─────────────────────────

export type EscadaTodo = Record<string, Degrau>;
type RegistroGerente = { gerente: Gerente; agente: string; passo: 'cobrar' | 'treinar' | 'escalar'; motivo: string };

/** Dias úteis 18h (ou sob demanda): Gustavo e Renata conferem os números e sobem a escada de quem continua errando. */
export async function rodarGerentes(prisma: PrismaClient, agora = new Date(), opts: { avisar?: boolean } = {}) {
  const { numeros } = await numerosDosAgentes(prisma, agora);
  const escada = await lerCfg<EscadaTodo>(prisma, CH.escada, {});
  const feitos: RegistroGerente[] = [];
  const tecnicos: string[] = [];
  for (const g of ['gustavo', 'renata'] as Gerente[]) {
    const equipe = new Set(equipeDo(g));
    for (const n of numeros.filter(x => equipe.has(x.id))) {
      const av = avaliarAgente(n);
      if (av.tecnico) tecnicos.push(`${nomeDe(n.id)}: ${av.tecnico}`);
      const passo = proximoPasso(escada[n.id], av, agora);
      const motivo = av.sinais.join('; ');
      const novo = degrauDepois(passo, escada[n.id], motivo, agora);
      if (passo === 'nada') continue;
      if (passo === 'zerar') { delete escada[n.id]; await anotar(prisma, { de: g, para: n.id, tipo: 'ORIENTACAO', assunto: 'Números em dia', texto: `${nomeDe(n.id)}, seus números voltaram ao normal há uma semana. Continue assim.` }); continue; }
      if (passo === 'cobrar') {
        await anotar(prisma, { de: g, para: n.id, tipo: 'ORIENTACAO', assunto: `Cobrança ${g === 'gustavo' ? 'do Gustavo' : 'da Renata'}`, texto: textoCobranca(g, nomeDe(n.id), av, n.melhorar) });
        conversa(g, n.id, 'Cobrança', [{ quem: g, texto: `${nomeDe(n.id)}, precisamos conversar sobre os seus números da semana.` }, { quem: n.id, texto: 'Pode falar, vou corrigir.' }]);
      } else if (passo === 'treinar') {
        if (ehSdr(n.id)) {
          import('./especialista.service').then(m => m.treinarAgente(prisma, n.id as any)).catch((e: any) => console.error('[DIRETORIA] treino:', e?.message));
        } else {
          await prisma.agenteInstrucao.create({ data: { agente: n.id, ativa: true, criado_por: g, texto: `Orientação ${g === 'gustavo' ? 'do Gustavo' : 'da Renata'} (gerência, ${diaDe(agora).split('-').reverse().join('/')}): ${oQueFazer(av, n.melhorar)}.` } });
        }
        await anotar(prisma, { de: g, para: n.id, tipo: 'ORIENTACAO', assunto: 'Segundo aviso: treino', texto: `${nomeDe(n.id)}, os números continuaram fora: ${motivo}. ${ehSdr(n.id) ? 'Pedi ao Rafael um treino com você.' : 'Deixei uma regra nova para você seguir.'} Se em 3 dias não melhorar, levo para a Vitória.` });
      } else {
        await anotar(prisma, { de: g, para: 'vitoria', tipo: 'CONTEXTO', assunto: `Caso para decidir: ${nomeDe(n.id)}`, texto: `${nomeDe(n.id)} continua errando muito mesmo depois de cobrança e treino: ${motivo}. Preciso de uma providência.`, ref: `escalacao:${n.id}` });
      }
      if (novo) escada[n.id] = novo;
      feitos.push({ gerente: g, agente: n.id, passo, motivo });
      registrarAcaoAgente(g as AgenteId, `${passo === 'cobrar' ? 'cobrou' : passo === 'treinar' ? 'pediu treino de' : 'levou à Vitória o caso de'} ${nomeDe(n.id)}`);
    }
  }
  await gravarCfg(prisma, CH.escada, escada);
  if (opts.avisar !== false && (feitos.length || tecnicos.length)) {
    const verbo = { cobrar: 'cobrou', treinar: 'pediu treino de', escalar: 'levou à Vitória' } as const;
    const bloco = (g: Gerente) => feitos.filter(f => f.gerente === g).map(f => `• ${verbo[f.passo]} *${nomeDe(f.agente)}*: ${f.motivo}`);
    await avisarJessica(prisma, [
      '👔 *Gerência de hoje*',
      ...(bloco('gustavo').length ? ['', '*Gustavo* (Entrada e Vendas)', ...bloco('gustavo')] : []),
      ...(bloco('renata').length ? ['', '*Renata* (Clientes e Inteligência)', ...bloco('renata')] : []),
      ...(tecnicos.length ? ['', '⚙️ *Falhas técnicas* (não são culpa do agente)', ...tecnicos.map(t => `• ${t}`)] : []),
      '', link(),
    ].join('\n'));
  }
  return { feitos, tecnicos, escada };
}

// ───────────────────────── Metas ─────────────────────────

const limitesMes = (mes: string) => { const [a, m] = mes.split('-').map(Number); return { inicio: new Date(Date.UTC(a, m - 1, 1, 3)), fim: new Date(Date.UTC(a, m, 1, 3)) }; };
const FECHADA = ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'];

/** Quanto cada indicador já andou no mês (para o agente e para a equipe). */
export async function medir(prisma: PrismaClient, agente: string, ind: IndicadorId, mes: string): Promise<number> {
  const { inicio, fim } = limitesMes(mes);
  const no = { gte: inicio, lt: fim };
  switch (ind) {
    case 'leads_cadastrados': return prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: no } as any }).catch(() => 0);
    case 'demos_marcadas': return agente === 'lurdinha'
      ? prisma.atividade.count({ where: { created_by: 'lead_whatsapp', created_at: no } as any }).catch(() => 0)
      : prisma.sdrLead.count({ where: { agente, status: 'DEMO', updated_at: no } as any }).catch(() => 0);
    case 'mensagens_enviadas': {
      const { REMETENTE } = await import('./escritorio-painel.service');
      return prisma.whatsappMensagem.count({ where: { direcao: 'SAIDA', enviada_por: { in: REMETENTE[agente] || [agente] }, created_at: no } }).catch(() => 0);
    }
    case 'acerto_pct': {
      const ids = (await prisma.sdrLead.findMany({ where: { agente }, select: { id: true } }).catch(() => [])).map(s => s.id);
      const ms = await prisma.sdrMensagem.groupBy({ by: ['status'], where: { sdrId: { in: ids }, created_at: no, status: { in: ['ENVIADA_AUTO', 'APROVADA', 'EDITADA', 'DESCARTADA'] } }, _count: { _all: true } }).catch(() => [] as any[]);
      const t = (ms as any[]).reduce((s, x) => s + x._count._all, 0);
      const bons = (ms as any[]).filter(x => x.status === 'ENVIADA_AUTO' || x.status === 'APROVADA').reduce((s, x) => s + x._count._all, 0);
      return t ? Math.round((100 * bons) / t) : 0;
    }
    case 'contratos_fechados': return prisma.propostaComercial.count({ where: { status: { in: FECHADA }, data_aceite: no, deleted_at: null } as any }).catch(() => 0);
  }
}

export async function metasDosAgentes(prisma: PrismaClient, agora = new Date()) {
  const mes = mesDe(agora);
  const metas = await lerCfg<MetaAgente[]>(prisma, CH.metas(mes), []);
  return Promise.all(metas.map(async m => ({ ...m, nome: m.agente === 'equipe' ? 'Equipe' : nomeDe(m.agente), rotulo: INDICADORES[m.indicador]?.rotulo || m.indicador, atual: await medir(prisma, m.agente, m.indicador, mes) })));
}

async function vendedoras(prisma: PrismaClient) {
  return prisma.usuario.findMany({ where: { role: 'VENDEDOR', ativo: true }, select: { id: true, nome: true } }).catch(() => [] as { id: string; nome: string }[]);
}
async function metasVendedorasDoMes(prisma: PrismaClient, mes: string) {
  return prisma.meta.findMany({ where: { periodo: mes, status: 'ATIVA' }, select: { id: true, titulo: true, responsaveis_ids: true, responsavel_id: true, meta_contratos: true, meta_valor_total: true, valor_atual: true, created_by: true } }).catch(() => [] as any[]);
}

// ───────────────────────── Vitória ─────────────────────────

const QUEM_VITORIA = [
  'Você é a Vitória, CEO dos agentes de IA do comercial da Prosystem Sistemas (ERP e PDV para farmácias, drogarias, manipulação e padarias, Vitória/ES). Você responde à Jessica, a gestora comercial.',
  'O que um CEO faz e você faz: (1) define a direção: para onde o comercial vai e o que é sucesso no mês; (2) traduz em metas mensuráveis para cada agente e para cada vendedora; (3) decide onde pôr esforço (que agente acelerar, qual segurar, qual treinar); (4) lê os resultados no contexto geral (funil inteiro: prospecção, primeiro contato, demonstração, proposta, contrato, retenção), não um número solto; (5) cobra resultado por meio dos gerentes (Gustavo cuida de Entrada de leads e Vendas, Renata de Clientes e Inteligência) e do Rafael (treino); (6) mantém o ritmo: plano semanal toda segunda, metas no começo do mês.',
  'Você tem LIBERDADE TOTAL dada pela Jessica: as providências que você escolher são aplicadas na hora e ela recebe o resumo. Por isso seja criteriosa: cada providência tem que ter motivo nos números.',
  'REGRAS FIXAS que estão acima de você e que nenhuma providência pode contrariar: nunca falar com cliente (você fala com a Jessica, os gerentes e os agentes); proteger o número do WhatsApp (limite de primeiros contatos, intervalo, horário, nada repetido); nunca apagar leads; nunca criar atividades automáticas; conversa que uma pessoa assumiu não tem agente; nunca falar de preço ou desconto por conta própria; dado pessoal de cliente não vai para regra.',
  'Português do Brasil, simples e direto, frases curtas, sem travessão, sem jargão.',
].join('\n');

const FORMATO_PLANO = [
  'Responda APENAS com JSON:',
  '{"diagnostico": "leitura do contexto geral em 4 a 8 frases, com os números que importam",',
  ' "prioridades": ["até 5 prioridades da semana, cada uma com dono"],',
  ' "plano": "plano comercial da semana em markdown curto (o que cada setor faz, em que ordem, e como vamos medir)",',
  ' "providencias": [',
  '   {"tipo": "orientar", "agente": "id", "texto": "recado direto para o agente"},',
  '   {"tipo": "regra", "agente": "id ou equipe", "texto": "regra que o agente passa a seguir sempre (curta e verificável)"},',
  '   {"tipo": "pausar", "agente": "caroline|julio|luiz_felipe", "dias": 1-3, "motivo": "..."},',
  '   {"tipo": "treinar", "agente": "caroline|julio|luiz_felipe", "foco": "..."},',
  `   {"tipo": "meta_agente", "agente": "id", "indicador": "${Object.keys(INDICADORES).join('|')}", "alvo": número},`,
  '   {"tipo": "meta_vendedora", "vendedor_id": "id da lista", "contratos": número, "valor_total": número em reais}',
  ' ],',
  ' "resumo_whatsapp": "o que você decidiu e por quê, em até 6 linhas para a Jessica"}',
  `Indicadores e quem pode ter meta neles: ${Object.entries(INDICADORES).map(([k, v]) => `${k} (${v.rotulo}: ${v.agentes.join(', ')})`).join('; ')}.`,
  'Pausar é só para erro grave e repetido de quem conversa com cliente (o agente volta sozinho no fim do prazo). Regra nova substitui orientação solta quando o erro se repete. Não repita providência que já está valendo.',
].join('\n');

export type ProvidenciaAplicada = Providencia & { i: number; descricao: string; ref: Record<string, any> | null; aplicada: boolean; erro?: string; desfeita_em?: string | null };

async function aplicar(prisma: PrismaClient, p: Providencia, mes: string): Promise<{ ref: Record<string, any> | null; erro?: string }> {
  switch (p.tipo) {
    case 'orientar': {
      const n = await anotar(prisma, { de: 'vitoria', para: p.agente, tipo: 'ORIENTACAO', assunto: 'Orientação da Vitória (CEO)', texto: p.texto });
      return { ref: n ? { nota: (n as any).id } : null };
    }
    case 'regra': {
      const r = await prisma.agenteInstrucao.create({ data: { agente: p.agente, ativa: true, criado_por: 'vitoria', texto: `Regra da Vitória (CEO): ${p.texto}` } });
      return { ref: { instrucao: r.id } };
    }
    case 'pausar': {
      const { obterConfigAgente, salvarConfigAgente } = await import('./caroline.service');
      const antes = await obterConfigAgente(prisma, p.agente as any);
      if (!antes.ativa) return { ref: null, erro: 'o agente já estava desligado' };
      await salvarConfigAgente(prisma, p.agente as any, { pausada_ate: new Date(Date.now() + p.dias * DIA).toISOString(), pausada_motivo: `Pausado pela Vitória: ${p.motivo}` }, 'vitoria');
      return { ref: { pausa: p.agente } };
    }
    case 'treinar': {
      const foco = p.foco ? [{ titulo: 'Foco pedido pela Vitória (CEO)', conteudo: p.foco }] : undefined;
      import('./especialista.service').then(m => m.treinarAgente(prisma, p.agente as any, { foco })).catch((e: any) => console.error('[VITORIA] treino:', e?.message));
      return { ref: null };
    }
    case 'meta_agente': {
      const metas = (await lerCfg<MetaAgente[]>(prisma, CH.metas(mes), [])).filter(m => !(m.agente === p.agente && m.indicador === p.indicador));
      const antes = (await lerCfg<MetaAgente[]>(prisma, CH.metas(mes), [])).find(m => m.agente === p.agente && m.indicador === p.indicador) || null;
      await gravarCfg(prisma, CH.metas(mes), [...metas, { agente: p.agente, indicador: p.indicador, alvo: p.alvo }]);
      if (p.agente !== 'equipe') await anotar(prisma, { de: 'vitoria', para: p.agente, tipo: 'ORIENTACAO', assunto: 'Sua meta do mês', texto: `${nomeDe(p.agente)}, sua meta deste mês: ${p.alvo}${p.indicador === 'acerto_pct' ? '%' : ''} ${INDICADORES[p.indicador].rotulo}. Os gerentes acompanham toda semana.` });
      return { ref: { meta_agente: { mes, agente: p.agente, indicador: p.indicador, antes } } };
    }
    case 'meta_vendedora': {
      const { inicio, fim } = limitesMes(mes);
      const doMes = await metasVendedorasDoMes(prisma, mes);
      const dela = doMes.find((m: any) => m.responsavel_id === p.vendedor_id || (Array.isArray(m.responsaveis_ids) && m.responsaveis_ids.includes(p.vendedor_id)));
      // A meta que a Jessica lançou à mão é dela: a Vitória não mexe.
      if (dela && dela.created_by !== 'vitoria') return { ref: null, erro: 'a Jessica já lançou a meta desta vendedora neste mês; a Vitória não altera' };
      const nome = (await prisma.usuario.findUnique({ where: { id: p.vendedor_id }, select: { nome: true } }).catch(() => null))?.nome || 'vendedora';
      const dados = { meta_contratos: p.contratos, meta_valor_total: p.valor_total, valor_alvo: p.valor_total || 0 };
      if (dela) {
        await prisma.meta.update({ where: { id: dela.id }, data: dados as any });
        return { ref: { meta: dela.id, antes: { meta_contratos: dela.meta_contratos, meta_valor_total: dela.meta_valor_total } } };
      }
      const m = await prisma.meta.create({ data: { titulo: `Meta de ${nome} · ${mes.split('-').reverse().join('/')} (Vitória)`, responsavel_id: p.vendedor_id, responsaveis_ids: [p.vendedor_id], tipo: 'CONTRATOS', periodo: mes, modo: 'INDIVIDUAL', periodo_tipo: 'MENSAL', data_inicio: inicio, data_fim: new Date(fim.getTime() - 1), created_by: 'vitoria', ...dados } as any });
      return { ref: { meta: m.id, criada: true } };
    }
  }
}

/** Retrato comercial do mês, com o mês anterior para comparar. */
async function retratoComercial(prisma: PrismaClient, agora: Date) {
  const mes = mesDe(agora);
  const [a, m] = mes.split('-').map(Number);
  const anterior = `${m === 1 ? a - 1 : a}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const um = async (ms: string) => {
    const { inicio, fim } = limitesMes(ms);
    const no = { gte: inicio, lt: fim };
    const [leads, sdrNovos, demos, propostas, fechadas] = await Promise.all([
      prisma.lead.count({ where: { created_at: no } }).catch(() => 0),
      prisma.sdrLead.count({ where: { created_at: no } as any }).catch(() => 0),
      prisma.atividade.count({ where: { created_by: 'lead_whatsapp', created_at: no } as any }).catch(() => 0),
      prisma.propostaComercial.count({ where: { created_at: no, deleted_at: null } as any }).catch(() => 0),
      prisma.propostaComercial.findMany({ where: { status: { in: FECHADA }, data_aceite: no, deleted_at: null } as any, select: { valor_final: true, valor_implantacao: true } }).catch(() => [] as any[]),
    ]);
    return { mes: ms, leads_novos: leads, leads_com_agente: sdrNovos, demonstracoes_marcadas: demos, propostas_criadas: propostas, contratos_fechados: fechadas.length, valor_fechado: Math.round(fechadas.reduce((s: number, x: any) => s + (x.valor_final || 0), 0)) };
  };
  return { atual: await um(mes), anterior: await um(anterior) };
}

/**
 * A Vitória decide. `semanal` (segunda): diagnóstico, prioridades, plano, metas e providências.
 * `escalacao` (dias úteis 18h30): só os casos que os gerentes levaram a ela.
 */
export async function rodarVitoria(prisma: PrismaClient, agora = new Date(), modo: 'semanal' | 'escalacao' = 'semanal') {
  const mes = mesDe(agora);
  const escalacoes = await prisma.agenteNota.findMany({ where: { para: 'vitoria', tipo: 'CONTEXTO', de: { in: ['gustavo', 'renata'] }, resolvida_em: null }, orderBy: { created_at: 'asc' }, take: 20 }).catch(() => []);
  if (modo === 'escalacao' && !escalacoes.length) return null;
  const { numeros, motivosLaya, boletim } = await numerosDosAgentes(prisma, agora);
  const escada = await lerCfg<EscadaTodo>(prisma, CH.escada, {});
  const vends = await vendedoras(prisma);
  const metasAg = await metasDosAgentes(prisma, agora);
  const metasVend = await metasVendedorasDoMes(prisma, mes);
  const regrasAtivas = await prisma.agenteInstrucao.findMany({ where: { ativa: true, criado_por: { in: ['vitoria', 'gustavo', 'renata'] } }, select: { agente: true, texto: true }, take: 30, orderBy: { created_at: 'desc' } }).catch(() => []);
  const linhasAgentes = numeros.map(n => {
    const av: Avaliacao = avaliarAgente(n);
    const d = n.decididas;
    return `- ${n.id} (${nomeDe(n.id)}): nível ${av.nivel}${av.sinais.length ? ` (${av.sinais.join('; ')})` : ''}; mensagens ${n.mensagens}`
      + (d ? `; ${d.sozinha} sozinhas, ${d.aprovada} aprovadas, ${d.editada} corrigidas, ${d.descartada} descartadas, ${d.segurada_laya} seguradas` : '')
      + (n.nota !== null && n.nota !== undefined ? `; nota ${n.nota}` : '')
      + (escada[n.id] ? `; escada: degrau ${escada[n.id].nivel} desde ${escada[n.id].desde.slice(0, 10)}` : '')
      + (av.tecnico ? `; técnico: ${av.tecnico}` : '');
  });
  let contexto: string[];
  if (modo === 'semanal') {
    const { lerAnaliseResultados } = await import('./analista-resultados.service');
    const analise = await lerAnaliseResultados(prisma).catch(() => null);
    const planoAnterior = await prisma.especialistaDoc.findFirst({ where: { tipo: 'PLANO', origem: 'vitoria' }, orderBy: { created_at: 'desc' }, select: { conteudo: true } }).catch(() => null);
    contexto = [
      `=== RETRATO COMERCIAL (mês atual x anterior) ===\n${JSON.stringify(await retratoComercial(prisma, agora))}`,
      analise ? `=== RELATÓRIO DO ANALISTA DE RESULTADOS (mais recente) ===\n${JSON.stringify(analise).slice(0, 4000)}` : '',
      boletim ? `=== BOLETIM DO RAFAEL E DA LAYA ===\n${boletim.resumo}\n${boletim.agentes.map(b => `- ${b.id}: ${b.nota ?? 'sem nota'} · ${b.motivo}${b.melhorar ? ` · melhorar: ${b.melhorar}` : ''}`).join('\n')}` : '=== BOLETIM ===\nAinda não há boletim desta semana.',
      `=== METAS DOS AGENTES EM ${mes} ===\n${metasAg.length ? metasAg.map(m => `- ${m.agente}: ${m.atual}/${m.alvo} ${m.rotulo}`).join('\n') : 'Nenhuma meta definida ainda neste mês: defina as metas do mês.'}`,
      `=== VENDEDORAS (id: nome) E METAS DO MÊS ===\n${vends.map(v => {
        const mt = metasVend.find((x: any) => x.responsavel_id === v.id || (Array.isArray(x.responsaveis_ids) && x.responsaveis_ids.includes(v.id)));
        return `- ${v.id}: ${v.nome}${mt ? ` · meta ${mt.meta_contratos ?? '?'} contratos / R$ ${mt.meta_valor_total ?? '?'} (${mt.created_by === 'vitoria' ? 'sua' : 'lançada pela Jessica: não altere'})` : ' · sem meta no mês'}`;
      }).join('\n') || 'nenhuma vendedora ativa'}`,
      planoAnterior ? `=== SEU PLANO ANTERIOR ===\n${planoAnterior.conteudo.slice(0, 1800)}` : '',
    ];
  } else {
    contexto = [];
  }
  const pergunta = [
    modo === 'semanal'
      ? 'REUNIÃO DE SEGUNDA: leia tudo no contexto geral, faça o diagnóstico, defina as prioridades e o plano comercial da semana, ajuste as metas do mês se preciso e decida as providências.'
      : 'CASOS LEVADOS PELOS GERENTES: decida a providência para cada agente abaixo, que continuou errando depois de cobrança e treino. Só providências para estes casos; diagnóstico e plano curtos.',
    FORMATO_PLANO,
    escalacoes.length ? `\n=== CASOS QUE OS GERENTES TROUXERAM ===\n${escalacoes.map(e => `- ${e.de}: ${e.assunto}: ${e.texto}`).join('\n')}` : '',
    `\n=== AGENTES (últimos 7 dias) ===\n${linhasAgentes.join('\n')}`,
    Object.keys(motivosLaya).length ? `\n=== O QUE A LAYA SEGUROU ===\n${Object.entries(motivosLaya).map(([a, m]) => `- ${a}: ${m.slice(0, 4).join(' | ')}`).join('\n')}` : '',
    regrasAtivas.length ? `\n=== REGRAS DA DIRETORIA JÁ VALENDO (não repita) ===\n${regrasAtivas.map(r => `- ${r.agente}: ${r.texto.slice(0, 200)}`).join('\n')}` : '',
    ...contexto.filter(Boolean).map(c => `\n${c}`),
  ].filter(Boolean).join('\n');
  const r = lerJsonIa<any>(await chamarGemini(prisma, { sistema: QUEM_VITORIA, partes: [{ text: pergunta }], json: true, temperatura: 0.3, timeoutMs: 180_000, agente: 'vitoria' }));
  if (!r) throw new Error('a Vitória não conseguiu fechar a decisão desta vez');
  const plano = lerPlanoVitoria(r, { agentes: avaliados(), vendedoras: vends.map(v => v.id) });
  const nomes = new Map<string, string>([...vends.map(v => [v.id, v.nome] as [string, string])]);
  const nome = (id: string) => nomes.get(id) || (id === 'equipe' ? 'a equipe' : nomeDe(id));
  const aplicadas: ProvidenciaAplicada[] = [];
  for (const [i, p] of plano.providencias.entries()) {
    try {
      const { ref, erro } = await aplicar(prisma, p, mes);
      aplicadas.push({ ...p, i, descricao: descreverProvidencia(p, nome), ref, aplicada: !erro, erro });
    } catch (e: any) {
      aplicadas.push({ ...p, i, descricao: descreverProvidencia(p, nome), ref: null, aplicada: false, erro: String(e?.message || e).slice(0, 200) });
    }
  }
  if (escalacoes.length) await prisma.agenteNota.updateMany({ where: { id: { in: escalacoes.map(e => e.id) } }, data: { resolvida_em: new Date() } }).catch(() => {});
  const dia = diaDe(agora).split('-').reverse().join('/');
  const md = [
    `# ${modo === 'semanal' ? `Plano comercial da semana · ${semanaDe(agora).split('-').reverse().join('/')}` : `Decisão sobre casos dos gerentes · ${dia}`}`, '',
    '## Diagnóstico', plano.diagnostico || '—', '',
    ...(plano.prioridades.length ? ['## Prioridades', ...plano.prioridades.map(x => `- ${x}`), ''] : []),
    ...(plano.plano ? ['## Plano', plano.plano, ''] : []),
    `## Providências (${aplicadas.filter(a => a.aplicada).length} aplicadas)`,
    ...aplicadas.map(a => `- ${a.aplicada ? '✅' : '⚠️'} ${a.descricao}${a.erro ? ` (não aplicada: ${a.erro})` : ''}`),
  ].join('\n');
  const doc = await prisma.especialistaDoc.create({ data: {
    tipo: modo === 'semanal' ? 'PLANO' : 'DECISAO', titulo: modo === 'semanal' ? `Plano comercial · semana ${semanaDe(agora)}` : `Decisão da Vitória · ${diaDe(agora)}`,
    conteudo: md, status: 'APROVADO', origem: 'vitoria', decidido_por: 'vitoria', decidido_em: new Date(),
    fontes: { modo, diagnostico: plano.diagnostico, prioridades: plano.prioridades, providencias: aplicadas, escalacoes: escalacoes.map(e => e.id) } as any,
  } });
  for (const g of ['gustavo', 'renata'] as Gerente[]) {
    await anotar(prisma, { de: 'vitoria', para: g, tipo: 'ORIENTACAO', assunto: modo === 'semanal' ? 'Plano da semana' : 'Decisão sobre os seus casos', texto: [plano.prioridades.slice(0, 3).join(' · '), ...aplicadas.filter(a => a.aplicada && 'agente' in a && equipeDo(g).includes((a as any).agente)).map(a => a.descricao)].filter(Boolean).join('\n') || plano.diagnostico.slice(0, 400), ref: doc.id });
  }
  conversa('vitoria', 'gustavo', modo === 'semanal' ? 'Reunião de segunda' : 'Casos da gerência', [{ quem: 'vitoria', texto: plano.prioridades[0] || 'Vamos aos números.' }, { quem: 'gustavo', texto: 'Combinado, acompanho com o time.' }, { quem: 'renata', texto: 'Do meu lado também.' }]);
  registrarAcaoAgente('vitoria' as AgenteId, `${modo === 'semanal' ? 'fechou o plano da semana' : 'decidiu os casos dos gerentes'} (${aplicadas.filter(a => a.aplicada).length} providências)`);
  await avisarJessica(prisma, [
    modo === 'semanal' ? '👩‍💼 *Vitória (CEO) · plano da semana*' : '👩‍💼 *Vitória (CEO) · casos dos gerentes*',
    plano.resumo_whatsapp || plano.diagnostico.slice(0, 500), '',
    ...aplicadas.slice(0, 10).map(a => `${a.aplicada ? '✅' : '⚠️'} ${a.descricao}`),
    '', 'Tudo já está valendo. Para desfazer qualquer item, abra o painel da Vitória:', link(),
  ].join('\n'));
  return doc;
}

/** Desfaz uma providência da Vitória (o que dá para desfazer). */
export async function desfazerProvidencia(prisma: PrismaClient, docId: string, i: number, userId: string): Promise<string> {
  const doc = await prisma.especialistaDoc.findUnique({ where: { id: docId } });
  if (!doc || doc.origem !== 'vitoria') throw new Error('plano não encontrado');
  const f = (doc.fontes || {}) as any;
  const lista: ProvidenciaAplicada[] = Array.isArray(f.providencias) ? f.providencias : [];
  const p = lista.find(x => x.i === i);
  if (!p) throw new Error('providência não encontrada');
  if (p.desfeita_em) return 'Já estava desfeita.';
  if (!p.aplicada) throw new Error('esta providência não chegou a ser aplicada');
  const ref = p.ref || {};
  if (p.tipo === 'treinar') throw new Error('treino já feito não tem como desfazer; arquive o treinamento no painel do Rafael se quiser');
  if (ref.nota) await prisma.agenteNota.delete({ where: { id: ref.nota } }).catch(() => {});
  if (ref.instrucao) await prisma.agenteInstrucao.update({ where: { id: ref.instrucao }, data: { ativa: false } }).catch(() => {});
  if (ref.pausa) {
    const { salvarConfigAgente } = await import('./caroline.service');
    await salvarConfigAgente(prisma, ref.pausa, { pausada_ate: null, pausada_motivo: null }, userId);
  }
  if (ref.meta_agente) {
    const { mes, agente, indicador, antes } = ref.meta_agente;
    const metas = (await lerCfg<MetaAgente[]>(prisma, CH.metas(mes), [])).filter(m => !(m.agente === agente && m.indicador === indicador));
    await gravarCfg(prisma, CH.metas(mes), antes ? [...metas, antes] : metas);
  }
  if (ref.meta) {
    if (ref.criada) await prisma.meta.update({ where: { id: ref.meta }, data: { status: 'CANCELADA' } }).catch(() => {});
    else if (ref.antes) await prisma.meta.update({ where: { id: ref.meta }, data: { ...ref.antes, valor_alvo: ref.antes.meta_valor_total || 0 } as any }).catch(() => {});
  }
  p.desfeita_em = new Date().toISOString();
  await prisma.especialistaDoc.update({ where: { id: docId }, data: { fontes: { ...f, providencias: lista } as any } });
  registrarAcaoAgente('vitoria' as AgenteId, `teve uma providência desfeita pela gestão: ${p.descricao.slice(0, 80)}`);
  return `Desfeito: ${p.descricao}`;
}

// ───────────────────────── Agenda, painel e Escritório ─────────────────────────

/** Chamado pelo agendador a cada ciclo: cada um confere o próprio horário e roda uma vez por período. */
export async function rodarDiretoria(prisma: PrismaClient, agora = new Date()) {
  if (process.env.DIRETORIA_DESLIGADA === '1') return;
  const h = horaSP(agora);
  const tentar = async (o: string, chave: string, fn: () => Promise<unknown>) => {
    if (!(await marcarUmaVez(prisma, o, chave))) return;
    try { await fn(); } catch (e: any) { console.error(`[DIRETORIA] ${o}:`, e?.message); await desmarcar(prisma, o, chave); }
  };
  if (AGENDA.boletim(h)) await tentar('boletim', semanaDe(agora), () => gerarBoletim(prisma, agora));
  if (AGENDA.vitoria(h)) await tentar('vitoria', semanaDe(agora), () => rodarVitoria(prisma, agora, 'semanal'));
  if (AGENDA.gerentes(h)) await tentar('gerentes', diaDe(agora), () => rodarGerentes(prisma, agora));
  if (AGENDA.escalacao(h)) await tentar('escalacao', diaDe(agora), () => rodarVitoria(prisma, agora, 'escalacao'));
}

/** Tudo o que o painel da diretoria mostra. */
export async function painelDiretoria(prisma: PrismaClient, agora = new Date()) {
  const { numeros, boletim } = await numerosDosAgentes(prisma, agora);
  const escada = await lerCfg<EscadaTodo>(prisma, CH.escada, {});
  const gerenteDe = (id: string) => (equipeDo('gustavo').includes(id) ? 'gustavo' : equipeDo('renata').includes(id) ? 'renata' : null);
  const agentes = numeros.map(n => ({ ...avaliarAgente(n), nome: nomeDe(n.id), gerente: gerenteDe(n.id), mensagens: n.mensagens, decididas: n.decididas, ia: n.ia, nota: n.nota ?? null, melhorar: n.melhorar ?? null, degrau: escada[n.id] || null }));
  const docs = await prisma.especialistaDoc.findMany({ where: { origem: 'vitoria', tipo: { in: ['PLANO', 'DECISAO'] } }, orderBy: { created_at: 'desc' }, take: 6 }).catch(() => []);
  const cobrancas = await prisma.agenteNota.findMany({ where: { de: { in: ['gustavo', 'renata', 'vitoria'] }, created_at: { gte: new Date(agora.getTime() - 14 * DIA) } }, orderBy: { created_at: 'desc' }, take: 40, select: { id: true, de: true, para: true, tipo: true, assunto: true, texto: true, created_at: true } }).catch(() => []);
  const mes = mesDe(agora);
  const metasVend = await metasVendedorasDoMes(prisma, mes);
  const nomesVend = new Map((await vendedoras(prisma)).map(v => [v.id, v.nome]));
  return {
    agentes, boletim,
    planos: docs.map(d => ({ id: d.id, tipo: d.tipo, titulo: d.titulo, conteudo: d.conteudo, created_at: d.created_at, providencias: ((d.fontes as any)?.providencias || []) as ProvidenciaAplicada[] })),
    cobrancas: cobrancas.map(c => ({ ...c, de_nome: nomeDe(c.de), para_nome: c.para === 'vitoria' ? 'Vitória' : nomeDe(c.para) })),
    metas_agentes: await metasDosAgentes(prisma, agora),
    metas_vendedoras: metasVend.map((m: any) => ({ ...m, nome: nomesVend.get(m.responsavel_id) || m.titulo, da_vitoria: m.created_by === 'vitoria' })),
    agenda: ['Boletim do Rafael e da Laya: sexta a partir das 16h', 'Gerentes: dias úteis a partir das 18h', 'Vitória: plano toda segunda às 8h e casos dos gerentes nos dias úteis às 18h30'],
  };
}

/** Os três no Escritório (status, números do dia a dia e o que estão fazendo). */
export async function estadosDiretoria(prisma: PrismaClient, agora: Date, temChave: boolean): Promise<EstadoAgente[]> {
  const desde7 = new Date(agora.getTime() - 7 * DIA);
  const [ultPlano, notas, escada, metas] = await Promise.all([
    prisma.especialistaDoc.findFirst({ where: { origem: 'vitoria' }, orderBy: { created_at: 'desc' }, select: { created_at: true, titulo: true, fontes: true } }).catch(() => null),
    prisma.agenteNota.findMany({ where: { de: { in: ['gustavo', 'renata'] }, created_at: { gte: desde7 } }, select: { de: true, para: true, created_at: true }, orderBy: { created_at: 'desc' } }).catch(() => []),
    lerCfg<EscadaTodo>(prisma, CH.escada, {}),
    lerCfg<MetaAgente[]>(prisma, CH.metas(mesDe(agora)), []),
  ]);
  const a = (id: string) => (AGENTES as readonly any[]).find(x => x.id === id)!;
  const estado = (id: Diretor, ultima: { texto: string; em: Date } | null, numeros: EstadoAgente['numeros'], observacao: string): EstadoAgente => ({
    id: id as AgenteId, nome: a(id).nome, funcao: a(id).funcao, cor: a(id).cor, status: statusAgente(temChave, ultima?.em || null, agora),
    ultima: ultima ? { texto: ultima.texto, em: ultima.em.toISOString() } : null, numeros, observacao,
  });
  const provs = ((ultPlano?.fontes as any)?.providencias || []) as ProvidenciaAplicada[];
  const daEquipe = (g: Gerente) => { const eq = new Set(equipeDo(g)); return Object.keys(escada).filter(id => eq.has(id)).length; };
  const ultNota = (g: Gerente) => { const n = notas.find(x => x.de === g); return n ? { texto: `cobrou ${nomeDe(n.para)}`, em: n.created_at } : null; };
  return [
    estado('vitoria', maisRecente(ultPlano ? { texto: ultPlano.titulo.startsWith('Plano') ? 'fechou o plano da semana' : 'decidiu os casos dos gerentes', em: ultPlano.created_at } : null, acaoRegistrada('vitoria' as AgenteId)),
      [{ rotulo: 'providências no último plano', valor: provs.filter(p => p.aplicada && !p.desfeita_em).length }, { rotulo: 'metas de agentes no mês', valor: metas.length }],
      temChave ? 'Plano toda segunda às 8h; casos dos gerentes nos dias úteis às 18h30' : 'Esperando a chave da IA em Configurações'),
    estado('gustavo', maisRecente(ultNota('gustavo'), acaoRegistrada('gustavo' as AgenteId)),
      [{ rotulo: 'cobranças na semana', valor: notas.filter(n => n.de === 'gustavo').length }, { rotulo: 'agentes na escada', valor: daEquipe('gustavo') }], 'Confere Entrada de leads e Vendas nos dias úteis às 18h'),
    estado('renata', maisRecente(ultNota('renata'), acaoRegistrada('renata' as AgenteId)),
      [{ rotulo: 'cobranças na semana', valor: notas.filter(n => n.de === 'renata').length }, { rotulo: 'agentes na escada', valor: daEquipe('renata') }], 'Confere Clientes e Inteligência nos dias úteis às 18h'),
  ];
}
type Diretor = typeof DIRETORIA[number];
export { NOME_DIRETOR };
