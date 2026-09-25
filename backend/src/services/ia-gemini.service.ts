import type { PrismaClient } from '@prisma/client';

// Cliente mínimo do Gemini (Google AI Studio). A chave fica em Configurações
// (ConfiguracaoIntegracao 'assistente.gemini_chave') ou na variável GEMINI_API_KEY.

export const CHAVE_GEMINI = 'assistente.gemini_chave';
const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Quando OPENAI_API_KEY existe (só no .env do servidor), a IA usa o ChatGPT
// (modelo OPENAI_MODEL, padrão gpt-6-luna). Áudio continua no Gemini, se houver chave.
const MODELO_OPENAI = process.env.OPENAI_MODEL || 'gpt-6-luna';
const chaveOpenAI = () => (process.env.OPENAI_API_KEY || '').trim() || null;

async function chaveSoGemini(prisma: PrismaClient): Promise<string | null> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_GEMINI } }).catch(() => null);
  return (r?.valor || process.env.GEMINI_API_KEY || '').trim() || null;
}

/** Existe alguma IA configurada (ChatGPT ou Gemini)? */
export async function chaveGemini(prisma: PrismaClient): Promise<string | null> {
  return chaveOpenAI() || (await chaveSoGemini(prisma));
}

async function chamarOpenAI(p: { sistema: string; conteudo: any[]; json?: boolean; busca?: boolean; timeoutMs: number }): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveOpenAI()}` },
    body: JSON.stringify({
      model: MODELO_OPENAI,
      instructions: p.sistema,
      input: [{ role: 'user', content: p.conteudo }],
      ...(p.busca ? { tools: [{ type: 'web_search' }] } : {}),
      ...(p.json ? { text: { format: { type: 'json_object' } } } : {}),
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('A chave da IA é inválida. Confira no servidor.');
    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente de novo em alguns minutos.');
    throw new Error(`IA indisponível (HTTP ${res.status}).`);
  }
  return res.json();
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
    body: JSON.stringify({
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

export async function chamarGemini(prisma: PrismaClient, p: { sistema: string; partes: Parte[]; json?: boolean; temperatura?: number; timeoutMs?: number }): Promise<string> {
  const temAudio = p.partes.some(x => 'inline_data' in x && x.inline_data.mime_type.startsWith('audio/'));
  const chaveG = await chaveSoGemini(prisma);
  if (chaveOpenAI() && !(temAudio && chaveG)) {
    const conteudo = p.partes.map(x => {
      if ('text' in x) return { type: 'input_text', text: x.text };
      const { mime_type, data } = x.inline_data;
      if (mime_type.startsWith('image/')) return { type: 'input_image', image_url: `data:${mime_type};base64,${data}` };
      if (mime_type.startsWith('audio/')) throw new Error('Transcrição de áudio precisa da chave do Gemini.');
      return { type: 'input_file', filename: 'arquivo', file_data: `data:${mime_type};base64,${data}` };
    });
    const { texto } = textoOpenAI(await chamarOpenAI({ sistema: p.sistema, conteudo, json: p.json, timeoutMs: p.timeoutMs ?? 90_000 }));
    if (!texto) throw new Error('A IA não devolveu resposta.');
    return texto;
  }
  const chave = chaveG;
  if (!chave) throw new Error('A chave da IA ainda não foi configurada (Configurações → Assistente no WhatsApp).');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
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
