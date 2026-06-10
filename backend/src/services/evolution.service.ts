// Integração Evolution API — WhatsApp Inbox multi-instância (conexão via QR Code)
//
// Documentação: https://doc.evolution-api.com/
// A Evolution API roda como serviço próprio (self-host no Railway). Cada usuário
// do CRM cria a SUA instância (instancia_nome único) e pareia lendo o QR Code,
// igual ao WhatsApp Web. Daí o CRM envia/recebe via esta API.
//
// Variáveis de ambiente necessárias (configurar no Railway):
//   EVOLUTION_API_URL   → ex.: https://evolution-production-xxxx.up.railway.app
//   EVOLUTION_API_KEY   → a AUTHENTICATION_API_KEY definida no serviço Evolution
//   EVOLUTION_WEBHOOK_URL (opcional) → URL pública deste backend + /whatsapp/webhook

function getBaseUrl(): string {
  const url = process.env.EVOLUTION_API_URL || '';
  if (!url) throw new Error('EVOLUTION_API_URL não configurado');
  return url.replace(/\/+$/, '');
}

function getApiKey(): string {
  const key = process.env.EVOLUTION_API_KEY || '';
  if (!key) throw new Error('EVOLUTION_API_KEY não configurado');
  return key;
}

/** true se a Evolution está minimamente configurada (sem lançar). */
export function evolutionConfigurada(): boolean {
  return !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY;
}

async function call(path: string, method: 'GET' | 'POST' | 'DELETE', body?: any) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: getApiKey() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Evolution ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/**
 * Cria (ou recria) uma instância e já solicita o QR Code para pareamento.
 * Retorna o base64 do QR quando disponível.
 */
export async function criarInstancia(instanciaNome: string): Promise<{ qr?: string; status: string }> {
  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL;
  const payload: any = {
    instanceName: instanciaNome,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  };
  if (webhookUrl) {
    payload.webhook = {
      url: webhookUrl,
      byEvents: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    };
  }
  const data = await call('/instance/create', 'POST', payload);
  // Evolution retorna o QR em data.qrcode.base64 (formatos variam por versão).
  const qr = data?.qrcode?.base64 || data?.qrcode?.code || data?.base64;
  return { qr, status: 'CONECTANDO' };
}

/** Reobtém o QR Code de uma instância já criada (ex.: usuário reabre a tela). */
export async function obterQrCode(instanciaNome: string): Promise<{ qr?: string }> {
  const data = await call(`/instance/connect/${encodeURIComponent(instanciaNome)}`, 'GET');
  const qr = data?.qrcode?.base64 || data?.base64 || data?.code;
  return { qr };
}

/** Estado da conexão: 'open' (conectado), 'connecting', 'close'. */
export async function obterStatus(instanciaNome: string): Promise<'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'> {
  try {
    const data = await call(`/instance/connectionState/${encodeURIComponent(instanciaNome)}`, 'GET');
    const state = data?.instance?.state || data?.state;
    if (state === 'open') return 'CONECTADO';
    if (state === 'connecting') return 'CONECTANDO';
    return 'DESCONECTADO';
  } catch {
    return 'DESCONECTADO';
  }
}

/** Desconecta (logout) a instância sem apagá-la. */
export async function desconectarInstancia(instanciaNome: string): Promise<void> {
  await call(`/instance/logout/${encodeURIComponent(instanciaNome)}`, 'DELETE').catch(() => {});
}

/** Apaga a instância da Evolution de vez (logout + delete). */
export async function deletarInstancia(instanciaNome: string): Promise<void> {
  await call(`/instance/logout/${encodeURIComponent(instanciaNome)}`, 'DELETE').catch(() => {});
  await call(`/instance/delete/${encodeURIComponent(instanciaNome)}`, 'DELETE').catch(() => {});
}

/** Normaliza um telefone BR para o formato que a Evolution espera (JID sem máscara). */
export function normalizarNumero(numero: string): string {
  let n = (numero || '').replace(/\D/g, '');
  if (n.length <= 11 && !n.startsWith('55')) n = `55${n}`; // assume Brasil
  return n;
}

/**
 * Envia uma mensagem de texto. Retorna o id externo da mensagem (para idempotência).
 */
export async function enviarTexto(
  instanciaNome: string,
  numero: string,
  texto: string,
): Promise<{ externo_id?: string }> {
  const data = await call(`/message/sendText/${encodeURIComponent(instanciaNome)}`, 'POST', {
    number: normalizarNumero(numero),
    text: texto,
  });
  const externo_id = data?.key?.id || data?.id;
  return { externo_id };
}

/**
 * Envia um áudio (gravado no Inbox) como mensagem de voz.
 * `audioDataUrlOuBase64` pode vir como data URL (data:<mime>;base64,...) ou base64 puro.
 *
 * A Evolution é exigente e varia por versão. Para ser DEFINITIVO, tentamos em
 * ordem várias formas até uma funcionar, capturando o 400 de cada:
 *   1) sendWhatsAppAudio com base64 PURO (sem prefixo data:)  ← mais comum
 *   2) sendWhatsAppAudio com data URL completo
 *   3) sendMedia (mediatype audio) com base64 puro            ← fallback robusto
 */
export async function enviarAudio(
  instanciaNome: string,
  numero: string,
  audioDataUrlOuBase64: string,
): Promise<{ externo_id?: string }> {
  const inst = encodeURIComponent(instanciaNome);
  const number = normalizarNumero(numero);
  // Separa o base64 puro e o mime do data URL (se houver).
  const m = audioDataUrlOuBase64.match(/^data:([^;]+);base64,(.*)$/s);
  const mime = m ? m[1] : 'audio/ogg';
  const base64Puro = m ? m[2] : audioDataUrlOuBase64.replace(/^data:[^;]+;base64,/, '');
  const dataUrl = m ? audioDataUrlOuBase64 : `data:${mime};base64,${base64Puro}`;

  const tentativas: Array<{ path: string; body: any }> = [
    { path: `/message/sendWhatsAppAudio/${inst}`, body: { number, audio: base64Puro } },
    { path: `/message/sendWhatsAppAudio/${inst}`, body: { number, audio: dataUrl } },
    { path: `/message/sendMedia/${inst}`, body: { number, mediatype: 'audio', mimetype: mime, media: base64Puro, fileName: 'audio.ogg' } },
    { path: `/message/sendMedia/${inst}`, body: { number, mediatype: 'audio', mimetype: mime, media: dataUrl, fileName: 'audio.ogg' } },
  ];

  let ultimoErro = '';
  for (let i = 0; i < tentativas.length; i++) {
    const t = tentativas[i];
    try {
      const data = await call(t.path, 'POST', t.body);
      const externo_id = data?.key?.id || data?.id;
      console.log(`[WPP áudio] enviado via tentativa ${i + 1} (${t.path.split('/')[2]})`);
      return { externo_id };
    } catch (e: any) {
      ultimoErro = e?.message || String(e);
      console.warn(`[WPP áudio] tentativa ${i + 1} falhou: ${ultimoErro.slice(0, 120)}`);
    }
  }
  throw new Error(`Não foi possível enviar o áudio (a Evolution recusou o formato). Detalhe: ${ultimoErro.slice(0, 150)}`);
}

/**
 * Baixa a mídia de uma mensagem como base64 (imagem/áudio/documento).
 * A url crua do WhatsApp é criptografada; este endpoint devolve o conteúdo real.
 * `mensagemKey` é o objeto data.key recebido no webhook.
 */
export async function baixarMidiaBase64(
  instanciaNome: string,
  mensagemKey: any,
): Promise<{ base64?: string; mimetype?: string }> {
  try {
    const data = await call(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanciaNome)}`, 'POST', {
      message: { key: mensagemKey },
      convertToMp4: false,
    });
    return { base64: data?.base64, mimetype: data?.mimetype };
  } catch {
    return {};
  }
}
