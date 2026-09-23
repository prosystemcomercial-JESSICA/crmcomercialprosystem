import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as evo from '../src/services/evolution.service';

// Provedor UAZAPI (arquivo com nome herdado "evolution"). fetch é sempre mockado —
// nenhum teste fala com a UAZAPI de verdade. Tokens aqui são fictícios.

function respostaOk(corpo: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(corpo) };
}

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.EVOLUTION_API_URL = 'https://exemplo.uazapi.test/';
  process.env.EVOLUTION_WEBHOOK_URL = 'https://crm.exemplo.test/api/whatsapp/webhook';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ENV_ORIGINAL };
});

describe('enviarTexto', () => {
  it('usa o token da instância e guarda o messageid (id do WhatsApp) como externo_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ id: 'r1a2b3c4', messageid: '3EB0AAA' }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await evo.enviarTexto('tok-inst', '(27) 99999-8888', 'Olá');

    expect(r.externo_id).toBe('3EB0AAA');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/send/text');
    expect(opts.headers.token).toBe('tok-inst');
    expect(JSON.parse(opts.body)).toEqual({ number: '5527999998888', text: 'Olá' });
  });

  it('cai para id quando não há messageid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaOk({ id: 'x-1' })));
    expect((await evo.enviarTexto('t', '5527999998888', 'a')).externo_id).toBe('x-1');
  });
});

describe('enviarAudio', () => {
  it('manda o áudio em /send/media como ptt, com base64 puro e o mime do data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'aud-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await evo.enviarAudio('tok-inst', '27999998888', 'data:audio/webm;codecs=opus;base64,AAAA\nBBBB');

    expect(r.externo_id).toBe('aud-1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/send/media');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      number: '5527999998888',
      type: 'ptt',
      file: 'AAAABBBB',
      mimetype: 'audio/webm',
    });
  });

  it('aceita base64 puro (sem mimetype)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'aud-2' }));
    vi.stubGlobal('fetch', fetchMock);
    await evo.enviarAudio('t', '5527999998888', 'T2dnUw==');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ number: '5527999998888', type: 'ptt', file: 'T2dnUw==' });
  });
});

describe('enviarArquivo', () => {
  it('envia PDF como document com docName, legenda e mime do data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'doc-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await evo.enviarArquivo('tok-inst', '27999998888', 'data:application/pdf;base64,JVBERi0=', 'Proposta.pdf', 'Segue a proposta');

    expect(r).toEqual({ externo_id: 'doc-1', tipo: 'DOCUMENTO' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/send/media');
    expect(opts.headers.token).toBe('tok-inst');
    expect(JSON.parse(opts.body)).toEqual({
      number: '5527999998888',
      type: 'document',
      file: 'JVBERi0=',
      mimetype: 'application/pdf',
      docName: 'Proposta.pdf',
      text: 'Segue a proposta',
    });
  });

  it('envia imagem como image, sem docName', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'img-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await evo.enviarArquivo('t', '5527999998888', 'data:image/png;base64,iVBORw==', 'foto.png');
    expect(r.tipo).toBe('IMAGEM');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      number: '5527999998888', type: 'image', file: 'iVBORw==', mimetype: 'image/png',
    });
  });

  it('envia vídeo como video', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'vid-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await evo.enviarArquivo('t', '5527999998888', 'data:video/mp4;base64,AAAA', 'video.mp4');
    expect(r.tipo).toBe('VIDEO');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe('video');
  });

  it('recusa conteúdo que não é data URL base64', async () => {
    await expect(evo.enviarArquivo('t', '5527999998888', 'nao-e-arquivo', 'x.pdf')).rejects.toThrow('Arquivo inválido');
  });
});

describe('enviarMenu', () => {
  it('botões: choices "Texto|id" e footerText', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'm-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await evo.enviarMenu('tok', '27999998888', {
      modo: 'button', texto: 'Qual o segmento?', rodape: 'Prosystem',
      opcoes: [{ id: 'padaria', texto: 'Padaria' }, { id: 'farmacia', texto: 'Farmácia' }],
    });
    expect(r.externo_id).toBe('m-1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/send/menu');
    expect(JSON.parse(opts.body)).toEqual({
      number: '5527999998888', type: 'button', text: 'Qual o segmento?',
      choices: ['Padaria|padaria', 'Farmácia|farmacia'], footerText: 'Prosystem',
    });
  });

  it('lista: seção, "texto|id|descrição" e listButton', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'm-2' }));
    vi.stubGlobal('fetch', fetchMock);
    await evo.enviarMenu('tok', '5527999998888', {
      modo: 'list', texto: 'Como podemos ajudar?', botaoLista: 'Ver opções', secao: 'Atendimento',
      opcoes: [{ id: 'conhecer', texto: 'Quero conhecer', descricao: 'Conheça nossos sistemas' }, { id: 'suporte', texto: 'Suporte' }],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      number: '5527999998888', type: 'list', text: 'Como podemos ajudar?', listButton: 'Ver opções',
      choices: ['[Atendimento]', 'Quero conhecer|conhecer|Conheça nossos sistemas', 'Suporte|suporte'],
    });
  });
});

describe('configurarWebhook', () => {
  it('registra url, eventos messages+connection e exclui o eco wasSentByApi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk([{ id: 'w1' }]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await evo.configurarWebhook('tok-inst')).toBe(true);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/webhook');
    expect(opts.method).toBe('POST');
    expect(opts.headers.token).toBe('tok-inst');
    expect(JSON.parse(opts.body)).toEqual({
      url: 'https://crm.exemplo.test/api/whatsapp/webhook',
      enabled: true,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    });
  });

  it('não chama a API e devolve false sem EVOLUTION_WEBHOOK_URL', async () => {
    delete process.env.EVOLUTION_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await evo.configurarWebhook('t')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('loga e devolve false quando a UAZAPI recusa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid token' }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await evo.configurarWebhook('t')).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('baixarMidia', () => {
  it('pede base64 em /message/download e devolve o conteúdo direto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ mimetype: 'image/jpeg', base64Data: 'aW1n' }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await evo.baixarMidia('tok-inst', 'MSG-1');

    expect(r).toEqual({ base64: 'aW1n', mimetype: 'image/jpeg' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/message/download');
    expect(opts.method).toBe('POST');
    expect(opts.headers.token).toBe('tok-inst');
    expect(JSON.parse(opts.body)).toEqual({ id: 'MSG-1', return_base64: true, return_link: false });
  });

  it('se vier só o link (fileURL), baixa o arquivo e converte para base64', async () => {
    const conteudo = Buffer.from('imagem-fake');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respostaOk({ fileURL: 'https://files.exemplo.test/f/abc.jpg', mimetype: 'image/jpeg' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        arrayBuffer: async () => conteudo.buffer.slice(conteudo.byteOffset, conteudo.byteOffset + conteudo.byteLength),
      });
    vi.stubGlobal('fetch', fetchMock);

    const r = await evo.baixarMidia('t', 'MSG-2');

    const [url2, opts2] = fetchMock.mock.calls[1];
    expect(url2).toBe('https://files.exemplo.test/f/abc.jpg');
    expect(opts2.signal).toBeInstanceOf(AbortSignal);
    expect(r).toEqual({ base64: conteudo.toString('base64'), mimetype: 'image/jpeg' });
  });

  it('usa o content-type do arquivo quando a UAZAPI não manda mimetype', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(respostaOk({ fileURL: 'https://files.exemplo.test/f/a.pdf' }))
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => new ArrayBuffer(3),
      }));
    const r = await evo.baixarMidia('t', 'MSG-3');
    expect(r?.mimetype).toBe('application/pdf');
    expect(Buffer.from(r!.base64, 'base64').length).toBe(3);
  });

  it('devolve null sem base64 nem link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ mimetype: 'audio/mpeg' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await evo.baixarMidia('t', 'MSG-4')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lança erro se o download do arquivo falhar', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(respostaOk({ fileURL: 'https://files.exemplo.test/f/x' }))
      .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) }));
    await expect(evo.baixarMidia('t', 'MSG-5')).rejects.toThrow('404');
  });

  it('lança erro HTTP da própria UAZAPI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'message not found' }));
    await expect(evo.baixarMidia('t', 'MSG-6')).rejects.toThrow('400: message not found');
  });
});
