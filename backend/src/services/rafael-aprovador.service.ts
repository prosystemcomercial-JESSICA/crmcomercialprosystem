// Rafael aprova as mensagens dos SDRs (Caroline, Julio, Luiz Felipe) no lugar da Jessica (12/11/2026).
// Toda mensagem que ficaria esperando aprovação (primeiro contato, retomada ou segurada pela Laya) é decidida
// pelo Rafael em até 2 minutos: aprova, corrige o texto ou pede outra versão. Se a IA dele não responder no
// prazo, vale a regra: defeito objetivo (link quebrado, texto cortado, repetição) vai para reescrita, o resto sai.
// Fica com a Jessica só a autorização de campanha/revisão de proposta (preço), que tem botões no WhatsApp dela.
import type { PrismaClient } from '@prisma/client';
import { registrarAcaoAgente } from '../lib/assistente/escritorio';
import { PRAZO_RAFAEL_MS, REESCRITAS_MAX, decisaoNoPrazo, lerDecisaoRafael, rafaelRevisa, urgente, type DecisaoRafael } from '../lib/assistente/rafael-aprovador';

const emRevisao = new Set<string>();
const adiadas = new Map<string, number>();
let ultimoEnvioNaoUrgente = 0;
const NOMES: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe' };

const SISTEMA = `Você é o Rafael, especialista comercial da Prosystem (ERP e PDV para farmácias, drogarias, manipulação e padarias, Vitória/ES).
A Jessica, gestora, delegou a você a aprovação das mensagens de WhatsApp dos agentes de vendas. Decida rápido e com bom senso:
- "aprovar": a mensagem está boa para sair como está.
- "editar": dá para salvar com ajuste; devolva o texto final pronto para enviar (até 3 parágrafos curtos, mesmo tom, sem inventar recurso, preço ou prazo, links inteiros copiados da mensagem original).
- "descartar": não deve sair (o cliente pediu para parar, a mensagem não faz sentido na conversa, insiste depois de objeção, ou está velha demais para o contexto). O agente escreve outra versão.
Prefira "editar" a "descartar" quando a correção for simples. Responda só JSON.`;

/** Pendentes dos SDRs que o Rafael decide. Chamado a cada 30 s e logo depois de cada mensagem ficar pendente. */
export async function rafaelRevisarPendentes(prisma: PrismaClient, soId?: string): Promise<void> {
  const { AGENTES_SDR } = await import('./caroline.service');
  const pend = await prisma.sdrMensagem.findMany({ where: { status: 'PENDENTE', ...(soId ? { id: soId } : {}) }, orderBy: { created_at: 'asc' }, take: 30 });
  if (!pend.length) return;
  const leads = new Map((await prisma.sdrLead.findMany({ where: { id: { in: pend.map(m => m.sdrId) } } })).map(s => [s.id, s]));
  // Resposta a quem escreveu primeiro; depois por ordem de chegada.
  const itens = pend.map(m => ({ m, meta: lerMeta(m.acao), sdr: leads.get(m.sdrId) }))
    .filter(x => x.sdr && (AGENTES_SDR as string[]).includes(x.sdr.agente) && rafaelRevisa(x.meta))
    .sort((a, b) => Number(urgente(b.meta)) - Number(urgente(a.meta)));
  for (const it of itens) {
    if (emRevisao.has(it.m.id)) continue;
    // O envio falhou há pouco (ex.: número do contato desconectado): espera 10 min, sem gastar IA a cada 30 s.
    if ((adiadas.get(it.m.id) || 0) > Date.now()) continue;
    // Primeiro contato e retomada: no máximo 1 envio por minuto (protege o número do WhatsApp).
    if (!urgente(it.meta) && Date.now() - ultimoEnvioNaoUrgente < 60_000) continue;
    emRevisao.add(it.m.id);
    try {
      const enviou = await revisarUma(prisma, it.m, it.meta, it.sdr);
      if (enviou && !urgente(it.meta)) ultimoEnvioNaoUrgente = Date.now();
    } catch (e: any) {
      adiadas.set(it.m.id, Date.now() + 10 * 60_000);
      console.warn('[RAFAEL] aprovação (tenta de novo em 10 min):', e?.message);
    } finally { emRevisao.delete(it.m.id); }
  }
}

function lerMeta(acao: string | null): any { try { return JSON.parse(acao || '{}') || {}; } catch { return {}; } }

/** true = a mensagem foi enviada (aprovada ou editada). */
async function revisarUma(prisma: PrismaClient, m: any, meta: any, sdr: any): Promise<boolean> {
  const { conferirPura } = await import('../lib/laya-guardia');
  const ultimas = (await prisma.whatsappMensagem.findMany({ where: { conversaId: m.conversaId, direcao: 'SAIDA', enviada_por: sdr.agente }, orderBy: { created_at: 'desc' }, take: 4, select: { conteudo: true } })).map(u => u.conteudo || '');
  const defeito = (t: string) => conferirPura({ mensagens: t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean), ultimas }).join('; ');
  const desde = new Date(Date.now() - 6 * 3600_000);
  const reescritas = await prisma.sdrMensagem.count({ where: { sdrId: m.sdrId, decidido_por: 'rafael', status: 'DESCARTADA', decidido_em: { gte: desde } } });
  const venceu = Date.now() - new Date(m.created_at).getTime() >= PRAZO_RAFAEL_MS;

  let d: DecisaoRafael | null = null;
  try { d = await perguntarAoRafael(prisma, m, meta, sdr, reescritas >= REESCRITAS_MAX); }
  catch (e: any) { console.warn('[RAFAEL] IA da aprovação falhou:', e?.message); }
  if (!d) {
    if (!venceu) return false; // tenta de novo na próxima rodada (30 s)
    d = decisaoNoPrazo({ defeitoObjetivo: !!defeito(m.texto) });
  }
  // Texto corrigido pelo Rafael também passa pela conferência pura; com defeito, vira reescrita.
  if (d.decisao === 'editar' && defeito(d.texto!)) d = { decisao: 'descartar', texto: null, motivo: `a correção ainda tinha defeito (${defeito(d.texto!)})` };
  // Aprovar como está com defeito objetivo nunca: vai para reescrita.
  if (d.decisao === 'aprovar' && defeito(m.texto)) d = { decisao: 'descartar', texto: null, motivo: defeito(m.texto) };

  const { decidirMensagem } = await import('./caroline.service');
  const quem = NOMES[sdr.agente] || 'agente';
  const cliente = sdr.nome || sdr.empresa || 'um lead';
  if (d.decisao === 'descartar') {
    if (reescritas >= REESCRITAS_MAX) {
      // Já pediu 2 versões nesta conversa: descarta sem pedir outra (evita laço) e deixa anotado no mural (sem fila para a Jessica).
      const r = await prisma.sdrMensagem.updateMany({ where: { id: m.id, status: 'PENDENTE' }, data: { status: 'DESCARTADA', texto_final: `Rafael: ${d.motivo}`.slice(0, 500), decidido_em: new Date(), decidido_por: 'rafael' } });
      if (r.count) {
        registrarAcaoAgente('rafael', `descartou de vez uma mensagem do ${quem} para ${cliente}: ${d.motivo.slice(0, 90)}`);
        const { anotar } = await import('./equipe.service');
        await anotar(prisma, { de: 'rafael', para: 'equipe', tipo: 'CONTEXTO', assunto: `Mensagem do ${quem} para ${cliente} descartada`, texto: `Descartei a 3ª versão seguida: ${d.motivo}. Nada foi enviado; o ${quem} segue a conversa na próxima rodada.`, ref: m.conversaId }).catch(() => {});
      }
      return false;
    }
    await decidirMensagem(prisma, m.id, { aprovar: false, texto: `Rafael: ${d.motivo}` }, 'rafael');
    registrarAcaoAgente('rafael', `pediu outra versão da mensagem do ${quem} para ${cliente}: ${d.motivo.slice(0, 90)}`);
    return false;
  }
  await decidirMensagem(prisma, m.id, { aprovar: true, texto: d.decisao === 'editar' ? d.texto : null }, 'rafael');
  registrarAcaoAgente('rafael', d.decisao === 'editar' ? `corrigiu e aprovou a mensagem do ${quem} para ${cliente}` : `aprovou a mensagem do ${quem} para ${cliente}`);
  return true;
}

async function perguntarAoRafael(prisma: PrismaClient, m: any, meta: any, sdr: any, semDescartar: boolean): Promise<DecisaoRafael | null> {
  const desde = new Date(Date.now() - 14 * 864e5);
  const [licoes, historico] = await Promise.all([
    prisma.agenteNota.findMany({ where: { tipo: 'ORIENTACAO', para: { in: [sdr.agente, 'equipe'] }, created_at: { gte: desde } }, orderBy: { created_at: 'desc' }, take: 8, select: { texto: true } }),
    prisma.whatsappMensagem.findMany({ where: { conversaId: m.conversaId }, orderBy: { created_at: 'desc' }, take: 10, select: { direcao: true, conteudo: true, transcricao: true, tipo: true, created_at: true } }),
  ]);
  const hora = (d: Date) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const conversa = historico.reverse().map(x => `[${hora(x.created_at)}] ${x.direcao === 'ENTRADA' ? 'Cliente' : 'Prosystem'}: ${((x.tipo === 'AUDIO' ? x.transcricao : x.conteudo) || `[${String(x.tipo).toLowerCase()}]`).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  const fase = meta.fase || (sdr.ultima_lead_em ? 'resposta' : 'abertura');
  const { chamarGemini } = await import('./ia-gemini.service');
  const { lerJsonIa } = await import('../lib/assistente/ia-texto');
  const r = lerJsonIa<any>(await chamarGemini(prisma, {
    sistema: SISTEMA,
    partes: [{ text: [
      `Agora: ${hora(new Date())}. Mensagem escrita às ${hora(m.created_at)} pelo agente ${NOMES[sdr.agente] || sdr.agente} (fase: ${fase}) para ${sdr.nome || 'o lead'}${sdr.empresa ? ` (${sdr.empresa})` : ''}.`,
      meta.laya_motivo ? `A Laya (conferência) apontou: ${meta.laya_motivo}` : '',
      semDescartar ? 'Você já pediu outras versões nesta conversa: agora só "aprovar" ou "editar" (corrija você mesmo). Use "descartar" apenas se a mensagem não puder sair de jeito nenhum.' : '',
      `Responda: {"decisao": "aprovar" | "editar" | "descartar", "texto": "texto final se editar", "motivo": "uma frase"}`,
      ...(licoes.length ? ['', '=== SUAS LIÇÕES RECENTES PARA OS AGENTES ===', ...licoes.map(l => `- ${l.texto.replace(/\s+/g, ' ').slice(0, 300)}`)] : []),
      '', '=== CONVERSA (últimas mensagens) ===', conversa || '(sem mensagens ainda: primeiro contato)',
      '', '=== MENSAGEM PARA APROVAR ===', m.texto,
    ].filter(Boolean).join('\n') }],
    json: true, temperatura: 0.1, timeoutMs: 40_000, simples: true, agente: 'rafael',
  }));
  return lerDecisaoRafael(r, m.texto);
}
