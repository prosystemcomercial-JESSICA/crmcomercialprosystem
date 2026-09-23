import { describe, it, expect } from 'vitest';
import { parseUazapiEvento, ehPayloadUazapi } from '../src/lib/uazapi-webhook-parser';

describe('ehPayloadUazapi', () => {
  it('reconhece o envelope nativo (EventType + token)', () => {
    expect(ehPayloadUazapi({ EventType: 'messages', token: 'x' })).toBe(true);
  });
  it('não confunde com o formato Evolution (event + instance)', () => {
    expect(ehPayloadUazapi({ event: 'messages.upsert', instance: 'crm-1', data: {} })).toBe(false);
  });
});

describe('parseUazapiEvento', () => {
  it('ignora eventos que não são de mensagem nem de conexão', () => {
    expect(parseUazapiEvento({ EventType: 'presence' })).toEqual({ tipo: 'ignorar' });
  });

  it('reconhece evento de conexão', () => {
    expect(parseUazapiEvento({ EventType: 'connection', token: 't' })).toEqual({ tipo: 'conexao' });
    expect(parseUazapiEvento({ event: 'connection.update' })).toEqual({ tipo: 'conexao' });
  });

  // Exemplo literal da OpenAPI (GET /webhook/errors, linhas ~12419-12421): o
  // envelope mínimo { EventType: messages, token: instance-token } sem mensagem.
  it('exemplo de payload da OpenAPI sem mensagem é ignorado sem quebrar', () => {
    expect(parseUazapiEvento({ EventType: 'messages', token: 'instance-token' })).toEqual({ tipo: 'ignorar' });
  });

  // Envelope da OpenAPI + campos de components.schemas.Message (linhas ~512-674).
  it('extrai mensagem recebida no formato da OpenAPI (messageid, chatid, sender_pn, senderName)', () => {
    const payload = {
      EventType: 'messages',
      token: 'instance-token',
      message: {
        id: 'r1a2b3c4',
        messageid: '3EB0538DA65A59F6D8A251',
        chatid: '5511999999999@s.whatsapp.net',
        sender: '5511999999999@s.whatsapp.net',
        sender_pn: '5511999999999@s.whatsapp.net',
        senderName: 'Cliente Teste',
        isGroup: false,
        fromMe: false,
        messageType: 'Conversation',
        source: 'android',
        messageTimestamp: 1726000000000,
        status: '',
        text: 'Bom dia, quero saber do sistema',
        wasSentByApi: false,
      },
    };
    expect(parseUazapiEvento(payload)).toEqual({
      tipo: 'mensagem_recebida',
      contato_numero: '5511999999999',
      contato_nome: 'Cliente Teste',
      externo_id: '3EB0538DA65A59F6D8A251',
      texto: 'Bom dia, quero saber do sistema',
      tipo_msg: 'TEXTO',
      midia_url: undefined,
    });
  });

  it('status em texto (Delivered/Read, como descrito no schema Message) vira ENTREGUE/LIDA', () => {
    const base = { fromMe: true, messageid: 'ext-9', chatid: '5527999998888@s.whatsapp.net' };
    expect(parseUazapiEvento({ EventType: 'messages', message: { ...base, status: 'Delivered' } }))
      .toEqual({ tipo: 'status', externo_id: 'ext-9', status: 'ENTREGUE' });
    expect(parseUazapiEvento({ EventType: 'messages', message: { ...base, status: 'Read' } }))
      .toEqual({ tipo: 'status', externo_id: 'ext-9', status: 'LIDA' });
  });

  it('mensagem própria usa o chatid como contato (sender_pn é o nosso número)', () => {
    const payload = {
      EventType: 'messages',
      message: { fromMe: true, sender_pn: '5527997521370@s.whatsapp.net', chatid: '5527988887777@s.whatsapp.net', text: 'oi', messageid: 'm1' },
    };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo: 'mensagem_propria', contato_numero: '5527988887777' });
  });

  it('prefere o JID de telefone quando o chatid vem como @lid', () => {
    const payload = { EventType: 'messages', message: { chatid: '123456789@lid', sender: '123456789@lid', sender_pn: '5527911112222@s.whatsapp.net', text: 'oi' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ contato_numero: '5527911112222' });
  });

  it('ignora canal/newsletter', () => {
    expect(parseUazapiEvento({ EventType: 'messages', message: { chatid: '120363123456789012@newsletter', text: 'x' } })).toEqual({ tipo: 'ignorar' });
  });

  it('ignora mensagem de grupo', () => {
    const payload = { event: 'messages', data: { chatid: '123-456@g.us', isGroup: true, text: 'oi' } };
    expect(parseUazapiEvento(payload)).toEqual({ tipo: 'ignorar' });
  });

  it('ignora quando não há telefone identificável', () => {
    expect(parseUazapiEvento({ event: 'messages', data: { text: 'oi' } })).toEqual({ tipo: 'ignorar' });
  });

  it('detecta confirmação de entrega (status 3) numa mensagem fromMe', () => {
    const payload = { EventType: 'messages', message: { fromMe: true, status: 3, messageid: 'ext-1', chatid: '5527999998888@s.whatsapp.net' } };
    expect(parseUazapiEvento(payload)).toEqual({ tipo: 'status', externo_id: 'ext-1', status: 'ENTREGUE' });
  });

  it('detecta confirmação de leitura (status 4, vindo como string)', () => {
    const payload = { event: 'messages', data: { fromMe: true, status: '4', messageid: 'ext-2', chatid: '5527999998888@s.whatsapp.net' } };
    expect(parseUazapiEvento(payload)).toEqual({ tipo: 'status', externo_id: 'ext-2', status: 'LIDA' });
  });

  it('extrai mensagem de texto recebida', () => {
    const payload = {
      event: 'messages',
      data: { chatid: '5527999998888@s.whatsapp.net', text: 'Olá, tudo bem?', pushName: 'Fulano', messageid: 'ext-3' },
    };
    expect(parseUazapiEvento(payload)).toEqual({
      tipo: 'mensagem_recebida',
      contato_numero: '5527999998888',
      contato_nome: 'Fulano',
      externo_id: 'ext-3',
      texto: 'Olá, tudo bem?',
      tipo_msg: 'TEXTO',
      midia_url: undefined,
    });
  });

  it('prefere sender_pn ao chatid para o telefone', () => {
    const payload = { event: 'messages', data: { sender_pn: '5511988887777@s.whatsapp.net', chatid: '999@lid', text: 'oi' } };
    const ev = parseUazapiEvento(payload);
    expect(ev.tipo).toBe('mensagem_recebida');
    if (ev.tipo === 'mensagem_recebida') expect(ev.contato_numero).toBe('5511988887777');
  });

  it('extrai imagem recebida com URL em content.URL maiúsculo', () => {
    const payload = {
      event: 'messages',
      data: {
        chatid: '5527999998888@s.whatsapp.net',
        mediaType: 'image',
        content: { URL: 'https://uazapi.example/file.jpg', caption: 'Olha isso' },
        messageid: 'ext-4',
      },
    };
    expect(parseUazapiEvento(payload)).toEqual({
      tipo: 'mensagem_recebida',
      contato_numero: '5527999998888',
      contato_nome: null,
      externo_id: 'ext-4',
      texto: 'Olha isso',
      tipo_msg: 'IMAGEM',
      midia_url: 'https://uazapi.example/file.jpg',
    });
  });

  it('classifica vídeo como VIDEO, com a legenda como texto', () => {
    const payload = { event: 'messages', data: { chatid: '5527999998888@s.whatsapp.net', messageType: 'VideoMessage', text: 'olha', fileURL: 'https://x/v.mp4' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo_msg: 'VIDEO', texto: 'olha', midia_url: 'https://x/v.mp4' });
  });

  it('vídeo sem legenda vira [vídeo]', () => {
    const payload = { event: 'messages', data: { chatid: '5527999998888@s.whatsapp.net', mediaType: 'video' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo_msg: 'VIDEO', texto: '[vídeo]' });
  });

  it('classifica ptt como áudio', () => {
    const payload = { event: 'messages', data: { chatid: '5527999998888@s.whatsapp.net', messageType: 'ptt', fileURL: 'https://x/a.ogg' } };
    const ev = parseUazapiEvento(payload);
    expect(ev).toMatchObject({ tipo: 'mensagem_recebida', tipo_msg: 'AUDIO', texto: '[áudio]', midia_url: 'https://x/a.ogg' });
  });

  it('usa o nome do arquivo como texto de documento', () => {
    const payload = { event: 'messages', data: { chatid: '5527999998888@s.whatsapp.net', mediaType: 'document', fileName: 'Contrato.pdf', fileURL: 'https://x/c.pdf' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo_msg: 'DOCUMENTO', texto: 'Contrato.pdf', midia_url: 'https://x/c.pdf' });
  });

  it('classifica como mensagem_propria quando fromMe e sem status 3/4', () => {
    const payload = { event: 'messages', data: { fromMe: true, chatid: '5527999998888@s.whatsapp.net', text: 'Já te retorno', messageid: 'ext-5' } };
    expect(parseUazapiEvento(payload)).toEqual({
      tipo: 'mensagem_propria',
      contato_numero: '5527999998888',
      contato_nome: null,
      externo_id: 'ext-5',
      texto: 'Já te retorno',
      tipo_msg: 'TEXTO',
      midia_url: undefined,
    });
  });

  it('lê o id do botão clicado em buttonOrListid', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', messageType: 'ButtonsResponseMessage', text: 'Farmácia', buttonOrListid: 'farmacia', messageid: 'b-1' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo: 'mensagem_recebida', texto: 'Farmácia', botao_id: 'farmacia' });
  });

  it('lê o id do item de lista quando só vem no content', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', messageType: 'ListResponseMessage', text: 'Suporte', content: { singleSelectReply: { selectedRowID: 'suporte' } } } };
    expect(parseUazapiEvento(payload)).toMatchObject({ botao_id: 'suporte' });
  });

  it('marca enviada_pela_api quando wasSentByApi', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', text: 'oi', fromMe: true, wasSentByApi: true, messageid: 'api-1' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo: 'mensagem_propria', enviada_pela_api: true });
    const digitada = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', text: 'oi', fromMe: true, messageid: 'cel-1' } };
    expect((parseUazapiEvento(digitada) as any).enviada_pela_api).toBeUndefined();
  });

  it('mensagem comum não tem botao_id', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', text: 'oi' } };
    expect((parseUazapiEvento(payload) as any).botao_id).toBeUndefined();
  });
});
