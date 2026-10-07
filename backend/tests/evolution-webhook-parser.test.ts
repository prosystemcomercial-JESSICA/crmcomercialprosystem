import { describe, it, expect } from 'vitest';
import { parseEvolutionEvento } from '../src/lib/evolution-webhook-parser';

const msg = (data: any) => ({ event: 'messages.upsert', instance: 'gratis-1', data });

describe('webhook da API gratuita (Evolution 2.3.7) → evento interno', () => {
  it('texto recebido', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'A1' }, pushName: 'Maria', message: { conversation: 'Oi, quero saber o preço' }, messageType: 'conversation' })))
      .toEqual({ tipo: 'mensagem_recebida', contato_numero: '5527999990000', contato_nome: 'Maria', externo_id: 'A1', texto: 'Oi, quero saber o preço', tipo_msg: 'TEXTO' });
  });

  it('texto estendido e mensagem enviada pelo próprio número (celular)', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: true, id: 'B2' }, message: { extendedTextMessage: { text: 'Bom dia!' } } })))
      .toMatchObject({ tipo: 'mensagem_propria', contato_numero: '5527999990000', texto: 'Bom dia!', tipo_msg: 'TEXTO' });
  });

  it('contato com identificador oculto (@lid) usa o número real', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '123456789@lid', remoteJidAlt: '5531988887777@s.whatsapp.net', fromMe: false, id: 'C3' }, message: { conversation: 'oi' } })))
      .toMatchObject({ contato_numero: '5531988887777' });
  });

  it('mídias: imagem com legenda (com base64), áudio, documento e vídeo', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'D4' }, message: { imageMessage: { caption: 'nota', mimetype: 'image/jpeg' } }, base64: 'QUJD' })))
      .toMatchObject({ tipo_msg: 'IMAGEM', texto: 'nota', midia_url: 'data:image/jpeg;base64,QUJD' });
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'E5' }, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } } })))
      .toMatchObject({ tipo_msg: 'AUDIO', texto: '[áudio]' });
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'F6' }, message: { documentMessage: { fileName: 'contrato.pdf', mimetype: 'application/pdf' } } })))
      .toMatchObject({ tipo_msg: 'DOCUMENTO', texto: 'contrato.pdf' });
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'G7' }, message: { videoMessage: {} } })))
      .toMatchObject({ tipo_msg: 'VIDEO', texto: '[vídeo]' });
  });

  it('resposta de botão e de lista vira botao_id', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'H8' }, message: { buttonsResponseMessage: { selectedButtonId: 'demo_sim', selectedDisplayText: 'Quero' } } })))
      .toMatchObject({ texto: 'Quero', botao_id: 'demo_sim' });
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '5527999990000@s.whatsapp.net', fromMe: false, id: 'I9' }, message: { listResponseMessage: { title: 'Farmácia', singleSelectReply: { selectedRowId: 'seg_farmacia' } } } })))
      .toMatchObject({ texto: 'Farmácia', botao_id: 'seg_farmacia' });
  });

  it('ignora grupo, transmissão e status', () => {
    expect(parseEvolutionEvento(msg({ key: { remoteJid: '1203630@g.us', fromMe: false, id: 'J1', participant: '5527@s.whatsapp.net' }, message: { conversation: 'oi grupo' } }))).toEqual({ tipo: 'ignorar' });
    expect(parseEvolutionEvento(msg({ key: { remoteJid: 'status@broadcast', fromMe: false, id: 'J2' }, message: { conversation: 'x' } }))).toEqual({ tipo: 'ignorar' });
  });

  it('confirmação de entrega/leitura e conexão', () => {
    expect(parseEvolutionEvento({ event: 'messages.update', instance: 'gratis-1', data: { keyId: 'A1', status: 'READ', fromMe: true } })).toEqual({ tipo: 'status', externo_id: 'A1', status: 'LIDA' });
    expect(parseEvolutionEvento({ event: 'messages.update', instance: 'gratis-1', data: { keyId: 'A1', status: 'DELIVERY_ACK' } })).toEqual({ tipo: 'status', externo_id: 'A1', status: 'ENTREGUE' });
    expect(parseEvolutionEvento({ event: 'messages.update', instance: 'gratis-1', data: { keyId: 'A1', status: 'SERVER_ACK' } })).toEqual({ tipo: 'ignorar' });
    expect(parseEvolutionEvento({ event: 'connection.update', instance: 'gratis-1', data: { state: 'open' } })).toEqual({ tipo: 'conexao' });
    expect(parseEvolutionEvento({ event: 'qrcode.updated', instance: 'gratis-1', data: { qrcode: { base64: 'data:image/png;base64,QQ' } } })).toEqual({ tipo: 'qrcode', base64: 'data:image/png;base64,QQ' });
  });
});
