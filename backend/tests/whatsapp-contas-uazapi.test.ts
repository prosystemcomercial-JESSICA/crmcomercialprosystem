import { describe, it, expect, afterEach, vi } from 'vitest';
import * as evo from '../src/services/evolution.service';
import { normalizarServidorUazapi, vagaPorNome, chaveServidorDaVaga } from '../src/lib/whatsapp-vagas';

// Mais de uma conta UAZAPI (19/10/2026): o principal na conta do servidor e as vagas extras
// em outra conta. fetch sempre mockado; tokens e contas fictícios.

describe('normalizarServidorUazapi', () => {
  it('aceita o Server URL do painel com ou sem https e barra final', () => {
    expect(normalizarServidorUazapi('https://contanova.uazapi.com')).toBe('https://contanova.uazapi.com');
    expect(normalizarServidorUazapi(' https://ContaNova.uazapi.com/ ')).toBe('https://contanova.uazapi.com');
    expect(normalizarServidorUazapi('contanova.uazapi.com')).toBe('https://contanova.uazapi.com');
  });
  it('vazio vale a conta do servidor', () => {
    expect(normalizarServidorUazapi('')).toBe('');
    expect(normalizarServidorUazapi(undefined)).toBe('');
  });
  it('recusa endereços fora da UAZAPI ou sem https', () => {
    expect(normalizarServidorUazapi('https://uazapi.com.golpe.net')).toBeNull();
    expect(normalizarServidorUazapi('http://contanova.uazapi.com')).toBeNull();
    expect(normalizarServidorUazapi('https://contanova.uazapi.com/instance')).toBeNull();
    expect(normalizarServidorUazapi('https://localhost:8080')).toBeNull();
  });
});

describe('vagas UAZAPI', () => {
  it('tem a vaga 6 na UAZAPI e chave de conta por vaga', () => {
    expect(vagaPorNome('uazapi-3')).toMatchObject({ provedor: 'UAZAPI', rotulo: 'Número 6 (UAZAPI)' });
    expect(chaveServidorDaVaga('uazapi-3')).toBe('whatsapp.servidor.uazapi-3');
  });
});

describe('servidor por token', () => {
  const ENV = { ...process.env };
  afterEach(() => { vi.unstubAllGlobals(); process.env = { ...ENV }; evo.definirServidorDoToken('tok-extra', null); });

  it('número extra usa a conta dele e o principal continua na conta do servidor', async () => {
    process.env.EVOLUTION_API_URL = 'https://antiga.uazapi.test/';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ messageid: 'm1' }) });
    vi.stubGlobal('fetch', fetchMock);
    evo.definirServidorDoToken('tok-extra', 'https://contanova.uazapi.com/');

    await evo.enviarTexto('tok-extra', '5527999998888', 'a');
    await evo.enviarTexto('tok-principal', '5527999998888', 'b');

    expect(fetchMock.mock.calls[0][0]).toBe('https://contanova.uazapi.com/send/text');
    expect(fetchMock.mock.calls[1][0]).toBe('https://antiga.uazapi.test/send/text');
  });

  it('sem servidor registrado volta para a conta do servidor', async () => {
    process.env.EVOLUTION_API_URL = 'https://antiga.uazapi.test';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);
    evo.definirServidorDoToken('tok-extra', 'https://contanova.uazapi.com');
    evo.definirServidorDoToken('tok-extra', null);
    await evo.enviarTexto('tok-extra', '5527999998888', 'a');
    expect(fetchMock.mock.calls[0][0]).toBe('https://antiga.uazapi.test/send/text');
  });
});
