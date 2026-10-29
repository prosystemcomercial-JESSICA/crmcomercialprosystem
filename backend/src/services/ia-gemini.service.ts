import type { PrismaClient } from '@prisma/client';
import { registrarUsoIa, registrarChamadaIa, registrarReservaGroq, carregarCotaGroq, atualizarCotaGroq } from './uso-ia.service';
import { cabeNoGroq, lerCotaGroq } from '@/lib/ia-groq';
import { agenteDaPilha, tokensDaResposta } from '@/lib/uso-ia-agentes';
import { jsonParaIa, extensaoAudio } from '@/lib/assistente/ia-texto';
import { catalogo, funcaoDoAgente, planoDaRota, validarRotas, type Modelo, type Provedor, type Rota } from '@/lib/ia-rotas';

// Cliente mínimo do Gemini (Google AI Studio). A chave fica em Configurações
// (ConfiguracaoIntegracao 'assistente.gemini_chave') ou na variável GEMINI_API_KEY.

export const CHAVE_GEMINI = 'assistente.gemini_chave';
const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Quando OPENAI_API_KEY existe (só no .env do servidor), a IA usa o ChatGPT
// (modelo OPENAI_MODEL, padrão gpt-6-luna). Áudio continua no Gemini, se houver chave.
const MODELO_OPENAI = process.env.OPENAI_MODEL || 'gpt-6-luna';
const chaveOpenAI = () => (process.env.OPENAI_API_KEY || '').trim() || null;
// Tarefas simples (simples: true) vão para o Grok, se XAI_API_KEY existir; se ele falhar, caem no ChatGPT.
const MODELO_XAI = process.env.XAI_MODEL || 'grok-4.7';
const chaveXai = () => (process.env.XAI_API_KEY || '').trim() || null;
// Groq grátis na frente de tudo (pedido da Jessica, 29/10/2026: "economizar antes"): todo pedido só de texto
// e sem busca na internet tenta primeiro o Groq (GROQ_API_KEY, modelo GROQ_MODEL). Se ele falhar, bater o
// limite ou o pedido for grande demais para a cota por minuto, segue o caminho pago de sempre.
// GROQ_FORA=caroline,rafael tira assistentes do Groq, se a qualidade não servir para eles.
const MODELO_GROQ = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const chaveGroq = () => (process.env.GROQ_API_KEY || '').trim() || null;
const groqFora = () => (process.env.GROQ_FORA || '').split(',').map(x => x.trim()).filter(Boolean);
const GROQ_MAX_ENTRADA = Number(process.env.GROQ_MAX_ENTRADA) || 5000;
// OpenRouter grátis (29/10/2026): segunda camada grátis, depois do Groq. Conta grátis = 50 pedidos/dia
// (OPENROUTER_LIMITE_DIA). Sempre com data_collection: deny (só provedores que não guardam os dados).
// OPENROUTER_MODELOS = lista separada por vírgula; a OpenRouter tenta um depois do outro.
const chaveOpenRouter = () => (process.env.OPENROUTER_API_KEY || '').trim() || null;
const MODELOS_OPENROUTER = () => (process.env.OPENROUTER_MODELOS || 'recursive/flint-v1.0:free,dots-studio/dots-3-note-preview:free,google/gemma-4-31b-it:free').split(',').map(x => x.trim()).filter(Boolean);
const OPENROUTER_LIMITE_DIA = Number(process.env.OPENROUTER_LIMITE_DIA) || 50;
const openRouter = { dia: '', usados: 0, bloqueadoAte: 0 };
const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Transcrição de áudio no próprio servidor (Whisper local, pm2 "transcritor", só em 127.0.0.1), sem custo.
// TRANSCRITOR_URL=desligado volta ao caminho antigo (IA paga). TRANSCRICAO_RESERVA=paga deixa a
// IA paga cobrir quando o transcritor local falhar; sem ela, a falha aparece e nada é cobrado (29/10/2026).
const urlTranscritor = () => (process.env.TRANSCRITOR_URL || 'http://127.0.0.1:8766').trim();
const transcritorLocalLigado = () => urlTranscritor() !== 'desligado';

async function transcreverLocal(mime: string, base64: string, timeoutMs: number, agente: string): Promise<string> {
  const res = await fetch(`${urlTranscritor()}/transcrever`, {
    method: 'POST', headers: { 'Content-Type': mime }, body: Buffer.from(base64, 'base64'), signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
  registrarChamadaIa(agente, 'whisper', { ok: !!res?.ok });
  if (!res) throw new Error('O transcritor local não respondeu.');
  if (!res.ok) throw new Error(`Transcritor local indisponível (HTTP ${res.status}).`);
  registrarUsoIa('whisper');
  const texto = String(((await res.json()) as any)?.texto || '').trim();
  if (!texto) throw new Error('A transcrição veio vazia.');
  return texto;
}

async function chaveSoGemini(prisma: PrismaClient): Promise<string | null> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_GEMINI } }).catch(() => null);
  return (r?.valor || process.env.GEMINI_API_KEY || '').trim() || null;
}

/** Existe alguma IA configurada (ChatGPT, Grok, Groq ou Gemini)? */
export async function chaveGemini(prisma: PrismaClient): Promise<string | null> {
  return chaveOpenAI() || chaveXai() || chaveGroq() || (await chaveSoGemini(prisma));
}

/** Uma tentativa no Groq grátis. Devolve o texto, ou null quando não vale tentar ou ele não deu conta. */
// `escolhido` = modelo escolhido em Configurações › Modelos de IA (vale mesmo com GROQ_FORA).
async function tentarGroq(prisma: PrismaClient, p: { sistema: string; texto: string; json?: boolean; temperatura?: number; agente: string; modelo?: string; escolhido?: boolean }): Promise<string | null> {
  if (!chaveGroq() || (!p.escolhido && groqFora().some(a => p.agente === a || p.agente === `conversa-${a}`))) return null;
  const cota = await carregarCotaGroq(prisma);
  if (!cabeNoGroq(cota, p.sistema + p.texto, { maxEntrada: GROQ_MAX_ENTRADA })) { registrarReservaGroq(p.agente); return null; }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveGroq()}` },
      body: jsonParaIa({
        model: p.modelo || MODELO_GROQ,
        messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.json ? `${p.texto}\n\nResponda em JSON.` : p.texto }],
        temperature: p.temperatura ?? 0.3,
        reasoning_effort: process.env.GROQ_RACIOCINIO || 'low',
        ...(p.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    atualizarCotaGroq(lerCotaGroq(cota, res.headers, res.status));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const texto = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!texto) throw new Error('resposta vazia');
    const t = tokensDaResposta(data);
    registrarUsoIa('groq');
    registrarChamadaIa(p.agente, 'groq', { ok: true, tokensEntrada: t.entrada, tokensSaida: t.saida });
    return texto;
  } catch (e) {
    console.warn('[GROQ] não respondeu, usando a IA paga:', (e as Error)?.message);
    registrarReservaGroq(p.agente);
    return null;
  }
}

/** Uma tentativa na OpenRouter grátis. Devolve o texto, ou null quando não vale tentar ou ela não deu conta. */
async function tentarOpenRouter(p: { sistema: string; texto: string; json?: boolean; temperatura?: number; agente: string; modelo?: string }): Promise<string | null> {
  if (!chaveOpenRouter()) return null;
  if (openRouter.dia !== hojeSP()) Object.assign(openRouter, { dia: hojeSP(), usados: 0 });
  if (openRouter.usados >= OPENROUTER_LIMITE_DIA || openRouter.bloqueadoAte > Date.now()) return null;
  if (Math.ceil((p.sistema + p.texto).length / 3) > GROQ_MAX_ENTRADA * 4) return null;
  openRouter.usados++;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveOpenRouter()}`, 'X-Title': 'CRM Comercial Prosystem' },
      body: jsonParaIa({
        ...(p.modelo ? { model: p.modelo } : { models: MODELOS_OPENROUTER() }),
        messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.json ? `${p.texto}\n\nResponda em JSON.` : p.texto }],
        temperature: p.temperatura ?? 0.3,
        provider: { data_collection: 'deny' },
        ...(p.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      // Limite do dia da conta: para até amanhã; congestionamento do modelo: 5 minutos.
      if (res.status === 429) {
        const corpo = await res.text().catch(() => '');
        if (/free-models-per-day|daily/i.test(corpo)) openRouter.usados = OPENROUTER_LIMITE_DIA;
        else openRouter.bloqueadoAte = Date.now() + 5 * 60_000;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const texto = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!texto) throw new Error('resposta vazia');
    const t = tokensDaResposta(data);
    registrarUsoIa('openrouter');
    registrarChamadaIa(p.agente, 'openrouter', { ok: true, tokensEntrada: t.entrada, tokensSaida: t.saida });
    return texto;
  } catch (e) {
    console.warn('[OPENROUTER] não respondeu:', (e as Error)?.message);
    registrarChamadaIa(p.agente, 'openrouter', { ok: false });
    return null;
  }
}

async function chamarOpenAI(p: { sistema: string; conteudo: any[]; json?: boolean; busca?: boolean; timeoutMs: number; grok?: boolean; agente: string; modelo?: string }): Promise<any> {
  const fonte = p.grok ? 'grok' : 'openai';
  registrarUsoIa(fonte);
  const res = await fetch(p.grok ? 'https://api.x.ai/v1/responses' : 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.grok ? chaveXai() : chaveOpenAI()}` },
    body: jsonParaIa({
      model: p.modelo || (p.grok ? MODELO_XAI : MODELO_OPENAI),
      instructions: p.sistema,
      // No modo JSON a OpenAI exige a palavra "json" na mensagem (não basta nas instruções).
      input: [{ role: 'user', content: p.json ? [...p.conteudo, { type: 'input_text', text: 'Responda em JSON.' }] : p.conteudo }],
      ...(p.busca ? { tools: [{ type: 'web_search' }] } : {}),
      ...(p.json ? { text: { format: { type: 'json_object' } } } : {}),
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  }).catch(e => { registrarChamadaIa(p.agente, fonte, { ok: false }); throw e; });
  if (!res.ok) {
    registrarChamadaIa(p.agente, fonte, { ok: false });
    if (res.status === 401) throw new Error('A chave da IA é inválida. Confira no servidor.');
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    // O motivo que a IA devolveu vai junto: "indisponível" sozinho escondia o pedido recusado (14/10/2026).
    const motivo = await res.json().then((j: any) => j?.error?.code || j?.error?.message || '').catch(() => '');
    throw new Error(`IA indisponível (HTTP ${res.status}${motivo ? `: ${String(motivo).slice(0, 120)}` : ''}).`);
  }
  const data = await res.json();
  const t = tokensDaResposta(data);
  registrarChamadaIa(p.agente, fonte, { ok: true, tokensEntrada: t.entrada, tokensSaida: t.saida });
  return data;
}

async function transcreverOpenAI(mime: string, base64: string, timeoutMs: number, agente: string): Promise<string> {
  registrarUsoIa('openai');
  const ext = extensaoAudio(mime);
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mime }), `audio.${ext}`);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
  form.append('language', 'pt');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${chaveOpenAI()}` }, body: form, signal: AbortSignal.timeout(timeoutMs),
  }).catch(e => { registrarChamadaIa(agente, 'openai', { ok: false }); throw e; });
  if (!res.ok) {
    registrarChamadaIa(agente, 'openai', { ok: false });
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`Transcrição indisponível (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const t = tokensDaResposta(data);
  registrarChamadaIa(agente, 'openai', { ok: true, tokensEntrada: t.entrada, tokensSaida: t.saida });
  const texto = String(data?.text || '').trim();
  if (!texto) throw new Error('A transcrição veio vazia.');
  return texto;
}

function textoOpenAI(data: any): { texto: string; fontes: { titulo: string; url: string }[] } {
  const partes = ((data?.output || []) as any[]).filter(o => o.type === 'message').flatMap(o => o.content || []);
  const texto = partes.map((c: any) => c.text || '').join('').trim();
  const fontes = partes.flatMap((c: any) => c.annotations || []).filter((a: any) => a.url)
    .map((a: any) => ({ titulo: String(a.title || a.url), url: String(a.url) }));
  const unicas = fontes.filter((f, i) => fontes.findIndex(x => x.url === f.url) === i);
  return { texto, fontes: unicas };
}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } };
type Resultado = { texto: string; fontes: { titulo: string; url: string }[] };

/** Partes do pedido no formato da API Responses (OpenAI/Grok). Áudio vira um marcador: tem caminho próprio. */
function conteudoOpenAI(partes: Parte[]): any[] {
  return partes.map(x => {
    if ('text' in x) return { type: 'input_text', text: x.text };
    const { mime_type, data } = x.inline_data;
    if (mime_type.startsWith('image/')) return { type: 'input_image', image_url: `data:${mime_type};base64,${data}` };
    if (mime_type.startsWith('audio/')) return { type: 'audio', mime_type, data };
    return { type: 'input_file', filename: 'arquivo', file_data: `data:${mime_type};base64,${data}` };
  });
}

/** Uma chamada à API do Gemini (texto, imagem, PDF ou busca no Google). Conta no uso por assistente. */
async function chamarApiGemini(chave: string, p: { modelo: string; sistema: string; partes: Parte[]; json?: boolean; busca?: boolean; temperatura?: number; timeoutMs: number; agente: string }): Promise<Resultado> {
  registrarUsoIa('gemini');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: jsonParaIa({
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: p.partes }],
      ...(p.busca ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: p.temperatura ?? 0.3, ...(p.json && !p.busca ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  }).catch(e => { registrarChamadaIa(p.agente, 'gemini', { ok: false }); throw e; });
  if (!res.ok) {
    registrarChamadaIa(p.agente, 'gemini', { ok: false });
    const corpo = await res.text().catch(() => '');
    if (res.status === 400 && /API key/i.test(corpo)) throw new Error('A chave da IA é inválida. Confira em Configurações.');
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`IA indisponível (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const cand = data?.candidates?.[0];
  const texto = (cand?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
  const fontes = ((cand?.groundingMetadata?.groundingChunks || []) as any[])
    .map(c => ({ titulo: String(c?.web?.title || c?.web?.uri || ''), url: String(c?.web?.uri || '') }))
    .filter(f => f.url);
  const u = data?.usageMetadata || {};
  registrarChamadaIa(p.agente, 'gemini', { ok: true, tokensEntrada: Number(u.promptTokenCount) || 0, tokensSaida: Number(u.candidatesTokenCount) || 0 });
  return { texto, fontes };
}

// ── Modelo por função (Configurações › Modelos de IA, 29/10/2026) ──
export const CHAVE_ROTAS = 'ia.rotas';
let rotasCache: { em: number; rotas: Record<string, Rota> } | null = null;
/** Chamado ao salvar a tela, para a escolha valer na hora. */
export function esquecerRotasIa() { rotasCache = null; }
export async function rotasIa(prisma: PrismaClient): Promise<Record<string, Rota>> {
  if (rotasCache && Date.now() - rotasCache.em < 30_000) return rotasCache.rotas;
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_ROTAS } }).catch(() => null);
  let rotas: Record<string, Rota> = {};
  try { rotas = validarRotas(JSON.parse(r?.valor || '{}'), catalogo(process.env)); } catch { /* valor inválido: tudo automático */ }
  rotasCache = { em: Date.now(), rotas };
  return rotas;
}

/** Quais provedores têm chave agora (a tela mostra "sem chave" nos outros). */
export async function provedoresComChave(prisma: PrismaClient): Promise<Record<Provedor, boolean>> {
  return { groq: !!chaveGroq(), openrouter: !!chaveOpenRouter(), openai: !!chaveOpenAI(), grok: !!chaveXai(), gemini: !!(await chaveSoGemini(prisma)) };
}

type Pedido = { sistema: string; partes: Parte[]; json?: boolean; temperatura?: number; timeoutMs?: number; busca?: boolean };

async function executarModelo(prisma: PrismaClient, m: Modelo, q: Pedido, agente: string, chaveG: string | null): Promise<Resultado> {
  if (m.provedor === 'groq') {
    const texto = await tentarGroq(prisma, { sistema: q.sistema, texto: q.partes.map(x => ('text' in x ? x.text : '')).join('\n\n'), json: q.json, temperatura: q.temperatura, agente, modelo: m.modelo, escolhido: true });
    if (!texto) throw new Error('o Groq não deu conta (limite ou pedido grande demais)');
    return { texto, fontes: [] };
  }
  if (m.provedor === 'openrouter') {
    const texto = await tentarOpenRouter({ sistema: q.sistema, texto: q.partes.map(x => ('text' in x ? x.text : '')).join('\n\n'), json: q.json, temperatura: q.temperatura, agente, modelo: m.modelo });
    if (!texto) throw new Error('a OpenRouter não deu conta (limite do dia ou modelo ocupado)');
    return { texto, fontes: [] };
  }
  if (m.provedor === 'gemini') return chamarApiGemini(chaveG || '', { modelo: m.modelo, sistema: q.sistema, partes: q.partes, json: q.json, busca: q.busca, temperatura: q.temperatura, timeoutMs: q.timeoutMs ?? 90_000, agente });
  return textoOpenAI(await chamarOpenAI({ sistema: q.sistema, conteudo: conteudoOpenAI(q.partes), json: q.json, busca: q.busca, timeoutMs: q.timeoutMs ?? 90_000, grok: m.provedor === 'grok', modelo: m.modelo, agente }));
}

/**
 * Segue o principal e a reserva escolhidos para o assistente. `auto` = se nada respondeu, seguir a ordem
 * automática; sem ele (reserva "Nenhuma"), o pedido para com o erro do último modelo.
 */
async function seguirRota(prisma: PrismaClient, agente: string, q: Pedido): Promise<{ resultado: Resultado | null; auto: boolean; erro?: Error }> {
  const rota = (await rotasIa(prisma))[funcaoDoAgente(agente)];
  if (!rota) return { resultado: null, auto: true };
  const chaveG = await chaveSoGemini(prisma);
  const chaves: Record<Provedor, boolean> = { groq: !!chaveGroq(), openrouter: !!chaveOpenRouter(), openai: !!chaveOpenAI(), grok: !!chaveXai(), gemini: !!chaveG };
  const plano = planoDaRota(rota, catalogo(process.env), { imagem: !q.partes.every(x => 'text' in x), busca: q.busca, temChave: pv => chaves[pv] });
  let erro: Error | undefined;
  for (const m of plano.tentar) {
    try {
      const r = await executarModelo(prisma, m, q, agente, chaveG);
      if (r.texto) return { resultado: r, auto: plano.auto };
      erro = new Error(`${m.nome} não devolveu resposta.`);
    } catch (e) {
      erro = e as Error;
      console.warn(`[IA] ${m.nome} não respondeu para ${agente}:`, erro?.message);
    }
  }
  return { resultado: null, auto: plano.auto, erro };
}

/** Chamada com busca na internet: devolve o texto e as fontes consultadas. */
// `agente` = quem pediu (conta no uso por assistente); sem ele, vale o arquivo que chamou.
export async function pesquisarComGemini(prisma: PrismaClient, p: { sistema: string; pergunta: string; timeoutMs?: number; agente?: string }): Promise<Resultado> {
  const agente = p.agente || agenteDaPilha(new Error().stack);
  const rota = await seguirRota(prisma, agente, { sistema: p.sistema, partes: [{ text: p.pergunta }], busca: true, temperatura: 0.3, timeoutMs: p.timeoutMs ?? 180_000 });
  if (rota.resultado) return { texto: rota.resultado.texto, fontes: rota.resultado.fontes.slice(0, 15) };
  if (!rota.auto) throw rota.erro || new Error('O modelo escolhido para esta função não respondeu (Configurações › Modelos de IA).');
  if (chaveOpenAI()) {
    const r = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo: [{ type: 'input_text', text: p.pergunta }], busca: true, timeoutMs: p.timeoutMs ?? 180_000, agente }));
    if (!r.texto) throw new Error('A pesquisa não devolveu resultado.');
    return { texto: r.texto, fontes: r.fontes.slice(0, 15) };
  }
  const chave = await chaveSoGemini(prisma);
  if (!chave) throw new Error('A chave da IA ainda não foi configurada (Configurações → Assistente no WhatsApp).');
  const r = await chamarApiGemini(chave, { modelo: MODELO, sistema: p.sistema, partes: [{ text: p.pergunta }], busca: true, temperatura: 0.3, timeoutMs: p.timeoutMs ?? 120_000, agente });
  if (!r.texto) throw new Error('A pesquisa não devolveu resultado.');
  return { texto: r.texto, fontes: r.fontes.slice(0, 15) };
}

export async function chamarGemini(prisma: PrismaClient, p: { sistema: string; partes: Parte[]; json?: boolean; temperatura?: number; timeoutMs?: number; simples?: boolean; agente?: string }): Promise<string> {
  const soTexto = p.partes.every(x => 'text' in x);
  // Lido antes de qualquer await: depois dele a pilha perde quem chamou. Áudio conta como transcrição.
  const agente = p.agente || (p.partes.some(x => 'inline_data' in x && x.inline_data.mime_type.startsWith('audio/')) ? 'transcricao' : agenteDaPilha(new Error().stack));
  const parteAudio = p.partes.find(x => 'inline_data' in x && x.inline_data.mime_type.startsWith('audio/')) as Extract<Parte, { inline_data: unknown }> | undefined;
  const temAudio = !!parteAudio;
  // Primeiro o modelo escolhido para a função (se houver); áudio segue sempre o caminho da transcrição.
  if (!temAudio) {
    const rota = await seguirRota(prisma, agente, p);
    if (rota.resultado) return rota.resultado.texto;
    if (!rota.auto) throw rota.erro || new Error('O modelo escolhido para esta função não respondeu (Configurações › Modelos de IA).');
  }
  // Automático: primeiro o Groq grátis, depois a OpenRouter grátis; a IA paga só entra se nenhum der conta.
  if (soTexto) {
    const pedido = { sistema: p.sistema, texto: p.partes.map(x => (x as { text: string }).text).join('\n\n'), json: p.json, temperatura: p.temperatura, agente };
    const texto = (await tentarGroq(prisma, pedido)) || (await tentarOpenRouter(pedido));
    if (texto) return texto;
  }
  if (p.simples && soTexto && chaveXai()) {
    try {
      const conteudo = p.partes.map(x => ({ type: 'input_text', text: (x as { text: string }).text }));
      const { texto } = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo, json: p.json, timeoutMs: p.timeoutMs ?? 60_000, grok: true, agente }));
      if (texto) return texto;
    } catch (e) {
      if (!chaveOpenAI() && !(await chaveSoGemini(prisma))) throw e;
    }
  }
  // Áudio (o único uso é transcrever): primeiro o Whisper local, sem custo.
  if (parteAudio && transcritorLocalLigado()) {
    try {
      return await transcreverLocal(parteAudio.inline_data.mime_type, parteAudio.inline_data.data, p.timeoutMs ?? 90_000, agente);
    } catch (e) {
      if (process.env.TRANSCRICAO_RESERVA !== 'paga') throw e;
      console.warn('[TRANSCRICAO] local falhou, usando a IA paga:', (e as Error)?.message);
    }
  }
  const chaveG = await chaveSoGemini(prisma);
  if (chaveOpenAI() && !(temAudio && chaveG)) {
    const conteudo = conteudoOpenAI(p.partes);
    // Áudio: transcrição da OpenAI (o único uso de áudio é transcrever).
    const audio = conteudo.find((c: any) => c.type === 'audio') as any;
    if (audio) return transcreverOpenAI(audio.mime_type, audio.data, p.timeoutMs ?? 90_000, agente);
    const { texto } = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo, json: p.json, timeoutMs: p.timeoutMs ?? 90_000, agente }));
    if (!texto) throw new Error('A IA não devolveu resposta.');
    return texto;
  }
  if (!chaveG) throw new Error('A chave da IA ainda não foi configurada (Configurações → Assistente no WhatsApp).');
  const { texto } = await chamarApiGemini(chaveG, { modelo: MODELO, sistema: p.sistema, partes: p.partes, json: p.json, temperatura: p.temperatura, timeoutMs: p.timeoutMs ?? 45_000, agente });
  if (!texto) throw new Error('A IA não devolveu resposta.');
  return texto;
}
