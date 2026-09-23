// Parser puro do webhook da UAZAPI (formato nativo: EventType + token + message).
//
// Envelope (OpenAPI /webhook/errors, exemplo de payload): { EventType: 'messages', token: '<instance token>', message: {...} }
// Campos da mensagem (OpenAPI components.schemas.Message): messageid, chatid, sender, senderName,
// isGroup, fromMe, messageType, status, text, content, wasSentByApi, fileURL, sender_pn, sender_lid.
// O formato varia um pouco por versão (nativo x espelho do Baileys), por isso cada
// campo tem uma cascata de fallbacks.

export type TipoMensagem = 'TEXTO' | 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | 'OUTRO';

export type EventoMensagemUazapi = {
  tipo: 'mensagem_propria' | 'mensagem_recebida';
  contato_numero: string;
  contato_nome: string | null;
  externo_id?: string;
  texto: string;
  tipo_msg: TipoMensagem;
  midia_url?: string;
  botao_id?: string;
  // true quando a UAZAPI marca a mensagem como enviada pela API (eco do robô/CRM).
  enviada_pela_api?: boolean;
};

export type EventoUazapi =
  | { tipo: 'ignorar' }
  | { tipo: 'conexao' }
  | { tipo: 'status'; externo_id: string; status: 'ENTREGUE' | 'LIDA' }
  | EventoMensagemUazapi;

const EVENTOS_MENSAGEM = ['messages', 'messages.upsert', 'message'];
const EVENTOS_CONEXAO = ['connection', 'connection.update'];

/** true quando o payload está no formato nativo da UAZAPI (tem EventType ou o token da instância). */
export function ehPayloadUazapi(payload: any): boolean {
  return typeof payload?.EventType === 'string' || typeof payload?.token === 'string';
}

function ehGrupoOuBroadcast(msg: any, jid: string): boolean {
  return (
    msg?.isGroup === true ||
    jid.endsWith('@g.us') ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter') ||
    !!msg?.key?.participant
  );
}

// Escolhe o JID do contato. Numa mensagem recebida o contato é o remetente
// (sender_pn resolve o número real quando o chat vem como @lid); numa mensagem
// própria (fromMe) o remetente somos nós, então o contato é o chat.
function jidDoContato(msg: any, payload: any, fromMe: boolean): string {
  const candidatos: string[] = (fromMe
    ? [msg.chatid, msg.key?.remoteJid, payload?.chat?.wa_chatid]
    : [msg.sender_pn, msg.chatid, msg.key?.remoteJid, payload?.chat?.wa_chatid, msg.sender]
  ).filter((j: any) => typeof j === 'string' && j.length > 0);
  // Prefere um JID de telefone (@s.whatsapp.net / só dígitos) a um @lid.
  return candidatos.find(j => !j.endsWith('@lid')) || candidatos[0] || '';
}

function statusDeEntrega(status: any): 'ENTREGUE' | 'LIDA' | null {
  if (status === undefined || status === null || status === '') return null;
  const n = typeof status === 'number' ? status : parseInt(String(status), 10);
  if (n === 3) return 'ENTREGUE';
  if (n === 4) return 'LIDA';
  const s = String(status).toLowerCase();
  if (s === 'delivered' || s === 'delivery_ack') return 'ENTREGUE';
  if (s === 'read' || s === 'played') return 'LIDA';
  return null;
}

function conteudoDaMensagem(msg: any): { tipo_msg: TipoMensagem; texto: string; midia_url?: string } {
  const content = msg?.content && typeof msg.content === 'object' ? msg.content : null;
  const midia_url: string | undefined =
    msg?.fileURL || content?.URL || content?.url || msg?.url || msg?.mediaUrl || undefined;
  const tipoCru = String(msg?.mediaType || msg?.messageType || msg?.type || 'text').toLowerCase();
  const legenda: string | null =
    msg?.text ||
    (typeof msg?.content === 'string' ? msg.content : null) ||
    content?.text ||
    msg?.caption ||
    content?.caption ||
    content?.extendedTextMessage?.text ||
    null;

  if (tipoCru.includes('image')) return { tipo_msg: 'IMAGEM', texto: legenda || '[imagem]', midia_url };
  if (tipoCru.includes('video') || tipoCru === 'ptv') return { tipo_msg: 'VIDEO', texto: legenda || '[vídeo]', midia_url };
  if (tipoCru.includes('audio') || tipoCru === 'ptt') return { tipo_msg: 'AUDIO', texto: '[áudio]', midia_url };
  if (tipoCru.includes('document')) {
    const nomeArquivo = msg?.fileName || msg?.filename || content?.fileName || content?.filename;
    return { tipo_msg: 'DOCUMENTO', texto: nomeArquivo || legenda || '[documento]', midia_url };
  }
  if (legenda) return { tipo_msg: 'TEXTO', texto: legenda, midia_url: undefined };
  return { tipo_msg: 'OUTRO', texto: '[mensagem]', midia_url: undefined };
}

export function parseUazapiEvento(payload: any): EventoUazapi {
  const evento = payload?.EventType || payload?.event;
  if (EVENTOS_CONEXAO.includes(evento)) return { tipo: 'conexao' };
  if (!EVENTOS_MENSAGEM.includes(evento)) return { tipo: 'ignorar' };

  const bruto = payload?.message ?? payload?.data;
  const msg = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!msg || typeof msg !== 'object') return { tipo: 'ignorar' };

  const fromMe = msg.fromMe === true || msg.wasSentByApi === true || msg.key?.fromMe === true;
  const jid = jidDoContato(msg, payload, fromMe);
  const contato_numero = jid.split('@')[0].replace(/\D/g, '');
  if (!contato_numero) return { tipo: 'ignorar' };
  if (ehGrupoOuBroadcast(msg, jid)) return { tipo: 'ignorar' };

  // messageid = id da mensagem no WhatsApp (o que o envio devolve e o /message/download espera);
  // `id` é um id interno da UAZAPI e só serve de último recurso.
  const externo_id: string | undefined = msg.messageid || msg.key?.id || msg.id || undefined;

  if (fromMe) {
    // Confirmação de entrega/leitura chega como "mensagem" fromMe com status (3/4 ou Delivered/Read).
    const status = statusDeEntrega(msg.status);
    if (status) {
      if (!externo_id) return { tipo: 'ignorar' };
      return { tipo: 'status', externo_id, status };
    }
  }

  const { tipo_msg, texto, midia_url } = conteudoDaMensagem(msg);
  const content = msg.content && typeof msg.content === 'object' ? msg.content : null;
  const botao_id: string | undefined =
    (typeof msg.buttonOrListid === 'string' && msg.buttonOrListid) ||
    content?.selectedButtonID || content?.selectedButtonId ||
    content?.singleSelectReply?.selectedRowID || content?.singleSelectReply?.selectedRowId ||
    undefined;
  return {
    tipo: fromMe ? 'mensagem_propria' : 'mensagem_recebida',
    contato_numero,
    contato_nome: fromMe ? null : (msg.pushName || msg.senderName || null),
    externo_id,
    texto,
    tipo_msg,
    midia_url,
    ...(botao_id ? { botao_id } : {}),
    ...(msg.wasSentByApi === true ? { enviada_pela_api: true } : {}),
  };
}
