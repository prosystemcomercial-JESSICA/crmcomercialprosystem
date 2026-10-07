// Webhook da API gratuita (Evolution API 2.3.7, Baileys) → o mesmo evento interno da UAZAPI
// (EventoUazapi), para as mensagens dos números gratuitos seguirem o MESMO caminho (Inbox, Bia,
// Caroline, agentes). Só traduz o formato; nada de regra de negócio aqui.
import type { EventoUazapi, TipoMensagem } from './uazapi-webhook-parser';

export type EventoGratis = EventoUazapi | { tipo: 'qrcode'; base64: string };

const numeroDoJid = (jid: string) => (jid || '').split('@')[0].split(':')[0];

function jidDoContato(key: any): string {
  const candidatos = [key?.remoteJid, key?.remoteJidAlt, key?.senderPn].filter((j: any) => typeof j === 'string' && j);
  // Contato com identificador oculto (@lid): usa o número real quando vier.
  return candidatos.find((j: string) => j.endsWith('@s.whatsapp.net')) || candidatos[0] || '';
}

function conteudo(m: any, base64?: string): { tipo_msg: TipoMensagem; texto: string; midia_url?: string; botao_id?: string } {
  const msg = m || {};
  const dataUrl = (mime?: string) => (base64 ? `data:${(mime || 'application/octet-stream').split(';')[0]};base64,${base64}` : undefined);
  if (msg.buttonsResponseMessage) return { tipo_msg: 'TEXTO', texto: msg.buttonsResponseMessage.selectedDisplayText || '[botão]', botao_id: msg.buttonsResponseMessage.selectedButtonId || undefined };
  if (msg.templateButtonReplyMessage) return { tipo_msg: 'TEXTO', texto: msg.templateButtonReplyMessage.selectedDisplayText || '[botão]', botao_id: msg.templateButtonReplyMessage.selectedId || undefined };
  if (msg.listResponseMessage) return { tipo_msg: 'TEXTO', texto: msg.listResponseMessage.title || '[opção]', botao_id: msg.listResponseMessage.singleSelectReply?.selectedRowId || undefined };
  if (msg.imageMessage) return { tipo_msg: 'IMAGEM', texto: msg.imageMessage.caption || '[imagem]', midia_url: dataUrl(msg.imageMessage.mimetype || 'image/jpeg') };
  if (msg.videoMessage) return { tipo_msg: 'VIDEO', texto: msg.videoMessage.caption || '[vídeo]', midia_url: dataUrl(msg.videoMessage.mimetype || 'video/mp4') };
  if (msg.audioMessage) return { tipo_msg: 'AUDIO', texto: '[áudio]', midia_url: dataUrl(msg.audioMessage.mimetype || 'audio/ogg') };
  const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
  if (doc) return { tipo_msg: 'DOCUMENTO', texto: doc.fileName || doc.caption || '[documento]', midia_url: dataUrl(doc.mimetype) };
  const texto = msg.conversation || msg.extendedTextMessage?.text || null;
  if (texto) return { tipo_msg: 'TEXTO', texto };
  return { tipo_msg: 'OUTRO', texto: '[mensagem]' };
}

export function parseEvolutionEvento(payload: any): EventoGratis {
  const evento = String(payload?.event || '').toLowerCase().replace(/_/g, '.');
  const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (!data) return { tipo: 'ignorar' };

  if (evento === 'connection.update') return { tipo: 'conexao' };
  if (evento === 'qrcode.updated') {
    const b64 = data?.qrcode?.base64 || data?.base64;
    return b64 ? { tipo: 'qrcode', base64: b64 } : { tipo: 'ignorar' };
  }
  if (evento === 'messages.update') {
    const id = data.keyId || data.key?.id || data.messageId;
    const s = String(data.status || '').toUpperCase();
    const status = s === 'READ' || s === 'PLAYED' ? 'LIDA' : s === 'DELIVERY_ACK' ? 'ENTREGUE' : null;
    return id && status ? { tipo: 'status', externo_id: id, status } : { tipo: 'ignorar' };
  }
  if (evento !== 'messages.upsert') return { tipo: 'ignorar' };

  const key = data.key || {};
  const jid = jidDoContato(key);
  if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid === 'status@broadcast' || key.participant) return { tipo: 'ignorar' };
  const contato_numero = numeroDoJid(jid);
  if (!contato_numero) return { tipo: 'ignorar' };
  const c = conteudo(data.message, data.base64);
  const fromMe = !!key.fromMe;
  return {
    tipo: fromMe ? 'mensagem_propria' : 'mensagem_recebida',
    contato_numero,
    contato_nome: fromMe ? null : (data.pushName || null),
    externo_id: key.id,
    texto: c.texto,
    tipo_msg: c.tipo_msg,
    ...(c.midia_url ? { midia_url: c.midia_url } : {}),
    ...(c.botao_id ? { botao_id: c.botao_id } : {}),
  };
}
