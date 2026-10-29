import type { PrismaClient } from '@prisma/client';
import { registrarUsoIa } from './uso-ia.service';
import { jsonParaIa, extensaoAudio } from '@/lib/assistente/ia-texto';

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

// Transcrição de áudio no próprio servidor (Whisper local, pm2 "transcritor", só em 127.0.0.1), sem custo.
// TRANSCRITOR_URL=desligado volta ao caminho antigo (IA paga). TRANSCRICAO_RESERVA=paga deixa a
// IA paga cobrir quando o transcritor local falhar; sem ela, a falha aparece e nada é cobrado (29/10/2026).
const urlTranscritor = () => (process.env.TRANSCRITOR_URL || 'http://127.0.0.1:8766').trim();
const transcritorLocalLigado = () => urlTranscritor() !== 'desligado';

async function transcreverLocal(mime: string, base64: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`${urlTranscritor()}/transcrever`, {
    method: 'POST', headers: { 'Content-Type': mime }, body: Buffer.from(base64, 'base64'), signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);
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

/** Existe alguma IA configurada (ChatGPT ou Gemini)? */
export async function chaveGemini(prisma: PrismaClient): Promise<string | null> {
  return chaveOpenAI() || chaveXai() || (await chaveSoGemini(prisma));
}

async function chamarOpenAI(p: { sistema: string; conteudo: any[]; json?: boolean; busca?: boolean; timeoutMs: number; grok?: boolean }): Promise<any> {
  registrarUsoIa(p.grok ? 'grok' : 'openai');
  const res = await fetch(p.grok ? 'https://api.x.ai/v1/responses' : 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.grok ? chaveXai() : chaveOpenAI()}` },
    body: jsonParaIa({
      model: p.grok ? MODELO_XAI : MODELO_OPENAI,
      instructions: p.sistema,
      // No modo JSON a OpenAI exige a palavra "json" na mensagem (não basta nas instruções).
      input: [{ role: 'user', content: p.json ? [...p.conteudo, { type: 'input_text', text: 'Responda em JSON.' }] : p.conteudo }],
      ...(p.busca ? { tools: [{ type: 'web_search' }] } : {}),
      ...(p.json ? { text: { format: { type: 'json_object' } } } : {}),
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('A chave da IA é inválida. Confira no servidor.');
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    // O motivo que a IA devolveu vai junto: "indisponível" sozinho escondia o pedido recusado (14/10/2026).
    const motivo = await res.json().then((j: any) => j?.error?.code || j?.error?.message || '').catch(() => '');
    throw new Error(`IA indisponível (HTTP ${res.status}${motivo ? `: ${String(motivo).slice(0, 120)}` : ''}).`);
  }
  return res.json();
}

async function transcreverOpenAI(mime: string, base64: string, timeoutMs: number): Promise<string> {
  registrarUsoIa('openai');
  const ext = extensaoAudio(mime);
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mime }), `audio.${ext}`);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
  form.append('language', 'pt');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${chaveOpenAI()}` }, body: form, signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`Transcrição indisponível (HTTP ${res.status}).`);
  }
  const texto = String(((await res.json()) as any)?.text || '').trim();
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

/** Uma chamada ao Gemini. Devolve o texto da resposta ou lança erro com mensagem clara. */
/** Chamada com busca no Google (grounding): devolve o texto e as fontes consultadas. */
export async function pesquisarComGemini(prisma: PrismaClient, p: { sistema: string; pergunta: string; timeoutMs?: number }): Promise<{ texto: string; fontes: { titulo: string; url: string }[] }> {
  if (chaveOpenAI()) {
    const r = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo: [{ type: 'input_text', text: p.pergunta }], busca: true, timeoutMs: p.timeoutMs ?? 180_000 }));
    if (!r.texto) throw new Error('A pesquisa não devolveu resultado.');
    return { texto: r.texto, fontes: r.fontes.slice(0, 15) };
  }
  const chave = await chaveSoGemini(prisma);
  if (!chave) throw new Error('A chave da IA ainda não foi configurada (Configurações → Assistente no WhatsApp).');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: jsonParaIa({
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: [{ text: p.pergunta }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(p.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`IA indisponível (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const cand = data?.candidates?.[0];
  const texto = (cand?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
  const fontes = ((cand?.groundingMetadata?.groundingChunks || []) as any[])
    .map(c => ({ titulo: String(c?.web?.title || c?.web?.uri || ''), url: String(c?.web?.uri || '') }))
    .filter(f => f.url);
  if (!texto) throw new Error('A pesquisa não devolveu resultado.');
  return { texto, fontes: fontes.slice(0, 15) };
}

export async function chamarGemini(prisma: PrismaClient, p: { sistema: string; partes: Parte[]; json?: boolean; temperatura?: number; timeoutMs?: number; simples?: boolean }): Promise<string> {
  const soTexto = p.partes.every(x => 'text' in x);
  if (p.simples && soTexto && chaveXai()) {
    try {
      const conteudo = p.partes.map(x => ({ type: 'input_text', text: (x as { text: string }).text }));
      const { texto } = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo, json: p.json, timeoutMs: p.timeoutMs ?? 60_000, grok: true }));
      if (texto) return texto;
    } catch (e) {
      if (!chaveOpenAI() && !(await chaveSoGemini(prisma))) throw e;
    }
  }
  const parteAudio = p.partes.find(x => 'inline_data' in x && x.inline_data.mime_type.startsWith('audio/')) as Extract<Parte, { inline_data: unknown }> | undefined;
  const temAudio = !!parteAudio;
  // Áudio (o único uso é transcrever): primeiro o Whisper local, sem custo.
  if (parteAudio && transcritorLocalLigado()) {
    try {
      return await transcreverLocal(parteAudio.inline_data.mime_type, parteAudio.inline_data.data, p.timeoutMs ?? 90_000);
    } catch (e) {
      if (process.env.TRANSCRICAO_RESERVA !== 'paga') throw e;
      console.warn('[TRANSCRICAO] local falhou, usando a IA paga:', (e as Error)?.message);
    }
  }
  const chaveG = await chaveSoGemini(prisma);
  if (chaveOpenAI() && !(temAudio && chaveG)) {
    const conteudo = p.partes.map(x => {
      if ('text' in x) return { type: 'input_text', text: x.text };
      const { mime_type, data } = x.inline_data;
      if (mime_type.startsWith('image/')) return { type: 'input_image', image_url: `data:${mime_type};base64,${data}` };
      if (mime_type.startsWith('audio/')) return { type: 'audio', mime_type, data };
      return { type: 'input_file', filename: 'arquivo', file_data: `data:${mime_type};base64,${data}` };
    });
    // Áudio: transcrição da OpenAI (o único uso de áudio é transcrever).
    const audio = conteudo.find((c: any) => c.type === 'audio') as any;
    if (audio) return transcreverOpenAI(audio.mime_type, audio.data, p.timeoutMs ?? 90_000);
    const { texto } = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo, json: p.json, timeoutMs: p.timeoutMs ?? 90_000 }));
    if (!texto) throw new Error('A IA não devolveu resposta.');
    return texto;
  }
  const chave = chaveG;
  if (!chave) throw new Error('A chave da IA ainda não foi configurada (Configurações → Assistente no WhatsApp).');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: jsonParaIa({
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: p.partes }],
      generationConfig: { temperature: p.temperatura ?? 0.3, ...(p.json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(p.timeoutMs ?? 45_000),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    if (res.status === 400 && /API key/i.test(corpo)) throw new Error('A chave da IA é inválida. Confira em Configurações.');
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`IA indisponível (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const texto = (data?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
  if (!texto) throw new Error('A IA não devolveu resposta.');
  return texto;
}
