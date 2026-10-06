import type { PrismaClient } from '@prisma/client';
import { AGENTES, registrarAcaoAgente } from '@/lib/assistente/escritorio';
import { ligarPersistencia, recarregar, lembrar, registrarConversaAgentes } from '@/lib/assistente/conversas-agentes';
import { lerJsonIa } from '@/lib/assistente/ia-texto';

// A equipe de agentes como uma sociedade (pedido da Jessica, 06/10/2026): eles estavam individualistas, trocando
// pouco. Agora tudo o que um passa para o outro fica no MURAL DA EQUIPE (AgenteNota, no banco):
// - contexto do cliente na passagem de bastão (Bia → Caroline, Julio → Caroline, decisor indicado);
// - dúvidas sobem para o Rafael (o chefe) e a resposta dele vale para todos;
// - experiências (o que levou à demonstração, por que perdemos) ficam para todos aprenderem;
// - orientações do Rafael para cada um (treinos e a reunião diária).
// O mural entra no prompt de todos os agentes (instrucoesPara) e o contexto do cliente entra na conversa dele.

export type TipoNota = 'CONTEXTO' | 'DUVIDA' | 'RESPOSTA' | 'EXPERIENCIA' | 'ORIENTACAO' | 'CONVERSA' | 'REUNIAO';
export const EQUIPE = 'equipe';
const nomeAg = (id: string) => (id === EQUIPE ? 'Equipe' : AGENTES.find(a => a.id === id)?.nome || id);
const ROTULO: Record<string, string> = { CONTEXTO: 'Contexto', DUVIDA: 'Dúvida', RESPOSTA: 'Resposta do Rafael', EXPERIENCIA: 'Experiência', ORIENTACAO: 'Orientação', CONVERSA: 'Conversa', REUNIAO: 'Reunião da equipe' };
const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** Boot: liga a gravação das conversas no banco e recarrega a memória (nada se perde ao reiniciar). */
export async function iniciarEquipe(prisma: PrismaClient) {
  ligarPersistencia(c => {
    prisma.agenteNota.create({ data: { de: c.de, para: c.para, tipo: 'CONVERSA', assunto: c.tema.slice(0, 160), texto: c.falas.map(f => `${nomeAg(f.quem)}: ${f.texto}`).join('\n'), falas: c.falas as any } })
      .catch((e: any) => console.warn('[EQUIPE] gravar conversa:', e?.message));
  });
  try {
    const desde = new Date(Date.now() - 14 * 864e5);
    const notas = await prisma.agenteNota.findMany({ where: { created_at: { gte: desde } }, orderBy: { created_at: 'desc' }, take: 400 });
    const conversas = notas.filter(n => n.tipo === 'CONVERSA' && n.created_at >= new Date(Date.now() - 864e5)).slice(0, 40)
      .map(n => ({ id: n.id, de: n.de, para: n.para, tema: n.assunto, falas: (Array.isArray(n.falas) ? n.falas : []) as any[], em: n.created_at.toISOString() }));
    const memorias: { agente: string; texto: string; em: string }[] = [];
    for (const n of notas) for (const quem of [n.de, n.para]) if (quem !== EQUIPE) memorias.push({ agente: quem, texto: `${n.assunto}: ${n.texto.replace(/\s+/g, ' ')}`.slice(0, 240), em: n.created_at.toISOString() });
    recarregar(conversas, memorias);
    console.log(`[EQUIPE] mural carregado: ${notas.length} nota(s) dos últimos 14 dias`);
  } catch (e: any) { console.warn('[EQUIPE] carregar mural:', e?.message); }
}

/** Grava uma nota no mural (e na memória de quem escreveu e de quem recebeu). Nunca lança. */
export async function anotar(prisma: PrismaClient, n: { de: string; para: string; tipo: TipoNota; assunto: string; texto: string; ref?: string | null; falas?: any }) {
  try {
    const texto = n.texto.trim().slice(0, 4000);
    if (!texto) return null;
    const nota = await prisma.agenteNota.create({ data: { de: n.de, para: n.para, tipo: n.tipo, assunto: n.assunto.slice(0, 160), texto, ref: n.ref || null, falas: n.falas ?? undefined } });
    for (const quem of [n.de, n.para]) if (quem !== EQUIPE) lembrar(quem, `${ROTULO[n.tipo] || n.tipo} · ${n.assunto}: ${texto.replace(/\s+/g, ' ')}`);
    return nota;
  } catch (e: any) { console.warn('[EQUIPE] anotar:', e?.message); return null; }
}

/**
 * Bloco do mural para o prompt de um agente. Rafael (o chefe) vê tudo das últimas 48 h e as dúvidas em aberto;
 * os demais veem o que é para eles e para a equipe nos últimos 7 dias.
 */
export async function muralPara(prisma: PrismaClient, agente: string): Promise<string> {
  try {
    const chefe = agente === 'rafael';
    const notas = await prisma.agenteNota.findMany({
      where: chefe
        ? { tipo: { not: 'CONVERSA' }, created_at: { gte: new Date(Date.now() - 2 * 864e5) } }
        : { para: { in: [agente, EQUIPE] }, tipo: { in: ['ORIENTACAO', 'RESPOSTA', 'EXPERIENCIA', 'REUNIAO', 'CONTEXTO'] }, created_at: { gte: new Date(Date.now() - 7 * 864e5) } },
      orderBy: { created_at: 'desc' }, take: chefe ? 20 : 10,
    });
    const abertas = chefe ? await prisma.agenteNota.findMany({ where: { tipo: 'DUVIDA', resolvida_em: null, created_at: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { created_at: 'desc' }, take: 10 }) : [];
    if (!notas.length && !abertas.length) return '';
    const linha = (x: any) => `- [${ROTULO[x.tipo] || x.tipo} · ${nomeAg(x.de)}${x.para !== EQUIPE && x.para !== agente ? ` → ${nomeAg(x.para)}` : ''} · ${dataCurta(x.created_at)}] ${x.assunto}: ${x.texto.replace(/\s+/g, ' ').slice(0, 320)}`;
    return [
      chefe
        ? '\n\n### Mural da equipe (você é o chefe: o que todos registraram nas últimas 48 h)'
        : '\n\n### Mural da equipe (somos uma sociedade: use o que os colegas e o Rafael passaram; siga as orientações dele)',
      ...notas.map(linha),
      ...(abertas.length ? ['Dúvidas da equipe ainda sem resposta:', ...abertas.map(linha)] : []),
    ].join('\n');
  } catch { return ''; }
}

/** O que os colegas registraram sobre ESTE cliente (passagem de bastão, dúvidas e respostas). */
export async function contextoDaEquipe(prisma: PrismaClient, conversaId: string | null | undefined): Promise<string> {
  if (!conversaId) return '';
  const notas = await prisma.agenteNota.findMany({ where: { ref: conversaId, tipo: { in: ['CONTEXTO', 'DUVIDA', 'RESPOSTA', 'ORIENTACAO'] } }, orderBy: { created_at: 'desc' }, take: 6 }).catch(() => []);
  if (!notas.length) return '';
  return `\n=== O QUE OS COLEGAS PASSARAM SOBRE ESTE CLIENTE (use como contexto; não repita ao cliente palavra por palavra) ===\n${notas.reverse().map(n => `- ${nomeAg(n.de)} (${dataCurta(n.created_at)}, ${ROTULO[n.tipo] || n.tipo}): ${n.texto.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n')}`;
}

/** Dúvida que subiu para o Rafael: marca como respondida e a resposta vale para todos. */
export async function responderDuvida(prisma: PrismaClient, duvida: string, resposta: string) {
  const abertas = await prisma.agenteNota.findMany({ where: { tipo: 'DUVIDA', resolvida_em: null, texto: duvida.trim().slice(0, 4000) }, select: { id: true, de: true, ref: true } }).catch(() => []);
  if (abertas.length) await prisma.agenteNota.updateMany({ where: { id: { in: abertas.map(a => a.id) } }, data: { resolvida_em: new Date() } }).catch(() => {});
  await anotar(prisma, { de: 'rafael', para: EQUIPE, tipo: 'RESPOSTA', assunto: duvida.slice(0, 150), texto: resposta, ref: abertas[0]?.ref || null });
}

/**
 * Reunião diária da equipe, conduzida pelo Rafael (dias úteis, de manhã): ele lê o mural das últimas 24 h, o
 * estado de cada agente e as dúvidas em aberto; tira os aprendizados do dia, orienta cada agente que precisa e
 * responde o que souber. Tudo vai para o mural (e vira a conversa da sala no Escritório).
 */
export async function reuniaoDaEquipe(prisma: PrismaClient) {
  const desde = new Date(Date.now() - 864e5);
  const [notas, abertas] = await Promise.all([
    prisma.agenteNota.findMany({ where: { created_at: { gte: desde }, tipo: { not: 'REUNIAO' } }, orderBy: { created_at: 'asc' }, take: 120 }),
    prisma.agenteNota.findMany({ where: { tipo: 'DUVIDA', resolvida_em: null, created_at: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { created_at: 'asc' }, take: 15 }),
  ]);
  const { montarEscritorio } = await import('./escritorio.service');
  const escritorio = await montarEscritorio(prisma).catch(() => [] as any[]);
  const trabalharam = escritorio.filter((a: any) => a.ultima && new Date(a.ultima.em) >= desde);
  if (!notas.length && !trabalharam.length && !abertas.length) { registrarAcaoAgente('rafael', 'reunião do dia: nada de novo para tratar'); return null; }
  const { guiaComercial } = await import('./assistente-ia.service');
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const { chamarGemini } = await import('./ia-gemini.service');
  const ids = AGENTES.map(a => a.id);
  const pergunta = [
    'Você é o Rafael, chefe da equipe de agentes de IA da Prosystem (sistemas para farmácias e padarias). Hoje você conduz a REUNIÃO DIÁRIA da equipe. A equipe é uma sociedade: todos trocam contexto, dúvidas e experiências, e você orienta.',
    'Com base no mural das últimas 24 h, no estado de cada agente e nas dúvidas em aberto:',
    '1) "resumo": 2 a 3 frases do dia da equipe.',
    '2) "aprendizados": até 5 lições práticas para TODOS (o que funcionou, o que evitar), cada uma curta e acionável, citando o caso real quando houver.',
    '3) "orientacoes": para cada agente que precisa (no máximo 8), uma orientação objetiva e prática do que fazer diferente ou continuar. Use só estes ids de agente: ' + ids.join(', ') + '.',
    '4) "respostas": para as dúvidas em aberto que você CONSEGUE responder com segurança pelo MATERIAL abaixo, a resposta pronta para o agente usar com o cliente (id da dúvida + resposta). Se não tiver certeza, não responda (ela segue para pesquisa).',
    '5) "dialogo": 4 a 8 falas curtas da reunião (você e os agentes), naturais, mostrando a troca de experiência entre eles.',
    'Nunca invente números, preços ou recursos. Português do Brasil, simples, sem travessão.',
    'Responda APENAS com JSON: {"resumo": string, "aprendizados": [string], "orientacoes": [{"agente": string, "texto": string}], "respostas": [{"id": string, "resposta": string}], "dialogo": [{"quem": string, "texto": string}]}',
    '', '=== MURAL DAS ÚLTIMAS 24 H ===',
    notas.length ? notas.map(n => `- [${ROTULO[n.tipo] || n.tipo}] ${nomeAg(n.de)} → ${nomeAg(n.para)}: ${n.assunto}: ${n.texto.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n') : '(vazio)',
    '', '=== ESTADO DE CADA AGENTE ===',
    escritorio.map((a: any) => `- ${a.nome} (${a.id}, ${a.funcao}): ${a.status}; ${(a.numeros || []).map((x: any) => `${x.valor} ${x.rotulo}`).join(', ')}${a.ultima ? `; última ação: ${a.ultima.texto}` : ''}`).join('\n'),
    '', '=== DÚVIDAS EM ABERTO ===',
    abertas.length ? abertas.map(d => `- id ${d.id} · ${nomeAg(d.de)}: ${d.texto.slice(0, 300)}`).join('\n') : '(nenhuma)',
    '', '=== MATERIAL (única fonte sobre o produto) ===', (await guiaComercial(prisma)).slice(0, 9000),
  ].join('\n');
  const r = lerJsonIa<any>(await chamarGemini(prisma, { sistema: 'Você é o Rafael, especialista em vendas de software e chefe da equipe de agentes da Prosystem.' + (await instrucoesPara(prisma, 'rafael')), partes: [{ text: pergunta }], json: true, temperatura: 0.4, timeoutMs: 180_000 }));
  if (!r?.resumo) throw new Error('o Rafael não conseguiu fechar a reunião desta vez');
  const dia = dataCurta(new Date());
  const aprendizados: string[] = (r.aprendizados || []).map((x: any) => String(x).slice(0, 400)).slice(0, 5);
  const dialogo = (r.dialogo || []).filter((f: any) => f?.texto && ids.includes(f.quem)).slice(0, 8).map((f: any) => ({ quem: f.quem, texto: String(f.texto).slice(0, 300) }));
  await anotar(prisma, { de: 'rafael', para: EQUIPE, tipo: 'REUNIAO', assunto: `Reunião da equipe · ${dia}`, texto: [r.resumo, ...aprendizados.map(a => `• ${a}`)].join('\n'), falas: dialogo });
  let orientados = 0;
  for (const o of (r.orientacoes || []).slice(0, 8)) {
    if (!ids.includes(o?.agente) || !o?.texto || o.agente === 'rafael') continue;
    await anotar(prisma, { de: 'rafael', para: o.agente, tipo: 'ORIENTACAO', assunto: `Reunião de ${dia}`, texto: String(o.texto).slice(0, 600) });
    registrarAcaoAgente(o.agente, `recebeu orientação do Rafael na reunião: ${String(o.texto).slice(0, 70)}`);
    orientados++;
  }
  let respondidas = 0;
  for (const x of r.respostas || []) {
    const d = abertas.find(a => a.id === x?.id);
    if (!d || !x?.resposta) continue;
    await prisma.agenteNota.update({ where: { id: d.id }, data: { resolvida_em: new Date() } }).catch(() => {});
    await anotar(prisma, { de: 'rafael', para: EQUIPE, tipo: 'RESPOSTA', assunto: d.texto.slice(0, 150), texto: String(x.resposta).slice(0, 1500), ref: d.ref });
    respondidas++;
  }
  if (dialogo.length) registrarConversaAgentes('rafael', EQUIPE, `Reunião da equipe · ${dia}`, dialogo);
  registrarAcaoAgente('rafael', `conduziu a reunião da equipe: ${aprendizados.length} aprendizado(s), ${orientados} orientação(ões), ${respondidas} dúvida(s) respondida(s)`);
  return { resumo: r.resumo, aprendizados, orientados, respondidas };
}

/** Mural para a tela do Escritório (mais recente primeiro). */
export async function muralDaEquipe(prisma: PrismaClient, opts: { tipo?: string | null; agente?: string | null; limite?: number } = {}) {
  const where: any = {};
  if (opts.tipo) where.tipo = opts.tipo;
  if (opts.agente) where.OR = [{ de: opts.agente }, { para: opts.agente }];
  const notas = await prisma.agenteNota.findMany({ where, orderBy: { created_at: 'desc' }, take: Math.min(opts.limite || 80, 200) });
  return notas.map(n => ({ ...n, de_nome: nomeAg(n.de), para_nome: nomeAg(n.para) }));
}
