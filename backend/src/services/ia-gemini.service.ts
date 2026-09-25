import type { PrismaClient } from '@prisma/client';

// Cliente mínimo do Gemini (Google AI Studio). A chave fica em Configurações
// (ConfiguracaoIntegracao 'assistente.gemini_chave') ou na variável GEMINI_API_KEY.

export const CHAVE_GEMINI = 'assistente.gemini_chave';
const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function chaveGemini(prisma: PrismaClient): Promise<string | null> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE_GEMINI } }).catch(() => null);
  return (r?.valor || process.env.GEMINI_API_KEY || '').trim() || null;
}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Uma chamada ao Gemini. Devolve o texto da resposta ou lança erro com mensagem clara. */
export async function chamarGemini(prisma: PrismaClient, p: { sistema: string; partes: Parte[]; json?: boolean; temperatura?: number; timeoutMs?: number }): Promise<string> {
  const chave = await chaveGemini(prisma);
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
