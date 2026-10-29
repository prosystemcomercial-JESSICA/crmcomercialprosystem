import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chamarGemini } from '../src/services/ia-gemini.service';

// Áudio vai para o Whisper local (sem custo); a IA paga só entra se a reserva estiver ligada.
const prisma: any = { configuracaoIntegracao: { findUnique: async () => null } };
const pedido = {
  sistema: 'transcreva',
  partes: [{ inline_data: { mime_type: 'audio/ogg', data: Buffer.from('audio').toString('base64') } }, { text: 'Transcreva.' }],
};

describe('transcrição de áudio local', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'chave-teste';
    delete process.env.TRANSCRITOR_URL;
    delete process.env.TRANSCRICAO_RESERVA;
  });
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });

  it('usa o transcritor local e não chama a OpenAI', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ texto: 'bom dia, quero uma proposta' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await chamarGemini(prisma, pedido)).toBe('bom dia, quero uma proposta');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as any[])[0])).toBe('http://127.0.0.1:8766/transcrever');
  });

  it('sem reserva, a falha do local aparece e nada vai para a OpenAI', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chamarGemini(prisma, pedido)).rejects.toThrow(/Transcritor local/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('com TRANSCRICAO_RESERVA=paga, cai na OpenAI quando o local falha', async () => {
    process.env.TRANSCRICAO_RESERVA = 'paga';
    const fetchMock = vi.fn(async (url: any) => String(url).includes('openai')
      ? new Response(JSON.stringify({ text: 'texto da openai' }), { status: 200 })
      : new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await chamarGemini(prisma, pedido)).toBe('texto da openai');
    expect(String((fetchMock.mock.calls[1] as any[])[0])).toContain('api.openai.com/v1/audio/transcriptions');
  });

  it('TRANSCRITOR_URL=desligado volta ao caminho antigo', async () => {
    process.env.TRANSCRITOR_URL = 'desligado';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: 'texto da openai' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await chamarGemini(prisma, pedido)).toBe('texto da openai');
    expect(String((fetchMock.mock.calls[0] as any[])[0])).toContain('api.openai.com');
  });
});
