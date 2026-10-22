import { describe, it, expect, afterEach, vi } from 'vitest';
import * as evo from '../src/services/evolution.service';
import { registrarFalha, TOLERANCIA_FALHA_MS } from '../src/lib/whatsapp-status';

// Caso de 22/10/2026: a UAZAPI respondeu 401 "Invalid token" por 11 minutos para tokens válidos e
// o CRM marcou os números como desconectados. fetch sempre mockado; tokens fictícios.

const resposta = (status: number, corpo: any) => ({ ok: status < 400, status, text: async () => JSON.stringify(corpo) });
const CONECTADO = resposta(200, { instance: { status: 'connected', owner: '5527999990000' } });
const INVALIDO = resposta(401, { code: 401, message: 'Invalid token.', data: {} });

describe('registrarFalha', () => {
  it('tolera falhas seguidas até o limite e depois não', () => {
    const m = new Map();
    expect(registrarFalha(m, 't', 0)).toBe(true);
    expect(registrarFalha(m, 't', 5 * 60_000)).toBe(true);
    expect(registrarFalha(m, 't', TOLERANCIA_FALHA_MS + 1)).toBe(false);
  });
  it('falha isolada muito depois recomeça a contagem', () => {
    const m = new Map();
    registrarFalha(m, 't', 0);
    expect(registrarFalha(m, 't', 3 * TOLERANCIA_FALHA_MS)).toBe(true);
  });
});

describe('obterStatus com a API instável', () => {
  const ENV = { ...process.env };
  afterEach(() => { vi.unstubAllGlobals(); process.env = { ...ENV }; });

  it('um 401 passageiro tenta de novo e devolve conectado', async () => {
    process.env.EVOLUTION_API_URL = 'https://conta.uazapi.test';
    const fetchMock = vi.fn().mockResolvedValueOnce(INVALIDO).mockResolvedValueOnce(CONECTADO);
    vi.stubGlobal('fetch', fetchMock);
    const r = await evo.obterStatus('tok-a', { esperaMs: 0 });
    expect(r).toMatchObject({ status: 'CONECTADO' });
    expect(r.falhaApi).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('401 que continua é falha da API, não desconexão, durante a tolerância', async () => {
    process.env.EVOLUTION_API_URL = 'https://conta.uazapi.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(INVALIDO));
    let agora = 1_000_000;
    const r1 = await evo.obterStatus('tok-b', { esperaMs: 0, agora: () => agora });
    expect(r1).toEqual({ status: 'DESCONECTADO', falhaApi: true });
    agora += 10 * 60_000;
    expect((await evo.obterStatus('tok-b', { esperaMs: 0, agora: () => agora })).falhaApi).toBe(true);
    agora += 6 * 60_000; // 16 min seguidos falhando: agora é desconexão de verdade
    expect(await evo.obterStatus('tok-b', { esperaMs: 0, agora: () => agora })).toEqual({ status: 'DESCONECTADO' });
  });

  it('erro de rede também é falha da API', async () => {
    process.env.EVOLUTION_API_URL = 'https://conta.uazapi.test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    expect(await evo.obterStatus('tok-c', { esperaMs: 0 })).toEqual({ status: 'DESCONECTADO', falhaApi: true });
  });

  it('desconectado de verdade (a API respondeu) continua desconectado na hora', async () => {
    process.env.EVOLUTION_API_URL = 'https://conta.uazapi.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, { instance: { status: 'disconnected' } })));
    expect(await evo.obterStatus('tok-d', { esperaMs: 0 })).toEqual({ status: 'DESCONECTADO', numero: undefined });
  });

  it('a falha some quando a API volta a responder', async () => {
    process.env.EVOLUTION_API_URL = 'https://conta.uazapi.test';
    let agora = 0;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(INVALIDO));
    await evo.obterStatus('tok-e', { esperaMs: 0, agora: () => agora });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(CONECTADO));
    agora += 14 * 60_000;
    expect((await evo.obterStatus('tok-e', { esperaMs: 0, agora: () => agora })).status).toBe('CONECTADO');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(INVALIDO));
    agora += 2 * 60_000; // nova falha recomeça a contagem
    expect((await evo.obterStatus('tok-e', { esperaMs: 0, agora: () => agora })).falhaApi).toBe(true);
  });
});
