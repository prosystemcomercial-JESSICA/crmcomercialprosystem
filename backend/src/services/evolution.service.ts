// Integração UazAPI — WhatsApp multi-instância
//
// Documentação: https://docs.uazapi.com/
// Variáveis de ambiente necessárias:
//   EVOLUTION_API_URL   → ex.: https://free.uazapi.com  (subdomínio da conta)
//   EVOLUTION_API_KEY   → token da conta UazAPI
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

export function evolutionConfigurada(): boolean {
  return !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY;
}

async function call(path: string, method: 'GET' | 'POST' | 'DELETE', body?: any) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'token': getApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`UazAPI ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

/**
 * Cria (conecta) uma instância e solicita o QR Code para pareamento.
 * Na UazAPI não há criação separada — POST /instance/connect já inicia tudo.
 */
export async function criarInstancia(instanciaNome: string): Promise<{ qr?: string; status: string }> {
  const data = await call('/instance/connect', 'POST', {
    browser: 'auto',
    systemName: instanciaNome,
    proxy_managed_country: 'br',
  });
  const qr = data?.qrcode?.base64 || data?.qr || data?.base64 || data?.qrCode;
  return { qr, status: 'CONECTANDO' };
}

/** Reobtém o QR Code / status de uma instância (GET /instance/status). */
export async function obterQrCode(instanciaNome: string): Promise<{ qr?: string }> {
  try {
    const data = await call(`/instance/status?instanceName=${encodeURIComponent(instanciaNome)}`, 'GET');
    const qr = data?.qrcode?.base64 || data?.qr || data?.base64 || data?.qrCode;
    return { qr };
  } catch {
    return {};
  }
}

/** Estado da conexão via GET /instance/status */
export async function obterStatus(instanciaNome: string): Promise<'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'> {
  try {
    const data = await call(`/instance/status?instanceName=${encodeURIComponent(instanciaNome)}`, 'GET');
    const state = data?.state || data?.status || data?.instance?.state;
    if (state === 'connected') return 'CONECTADO';
    if (state === 'connecting' || state === 'hibernated') return 'CONECTANDO';
    return 'DESCONECTADO';
  } catch {
    return 'DESCONECTADO';
  }
}

/** Desconecta a instância. */
export async function desconectarInstancia(instanciaNome: string): Promise<void> {
  await call('/instance/disconnect', 'POST', { instanceName: instanciaNome }).catch(() => {});
}

/** Deleta a instância. */
export async function deletarInstancia(instanciaNome: string): Promise<void> {
  await call(`/instance/delete?instanceName=${encodeURIComponent(instanciaNome)}`, 'DELETE').catch(() => {});
}

/** Normaliza telefone BR para formato internacional sem caracteres especiais. */
export function normalizarNumero(numero: string): string {
  let n = (numero || '').replace(/\D/g, '');
  if (n.length <= 11 && !n.startsWith('55')) n = `55${n}`;
  return n;
}

/** Envia mensagem de texto via POST /send/text */
export async function enviarTexto(
  instanciaNome: string,
  numero: string,
  texto: string,
): Promise<{ externo_id?: string }> {
  const data = await call('/send/text', 'POST', {
    instanceName: instanciaNome,
    number: normalizarNumero(numero),
    text: texto,
  });
  const externo_id = data?.id || data?.key?.id || data?.messageId;
  return { externo_id };
}

/**
 * Envia áudio como mensagem de voz via POST /send/audio (UazAPI).
 * Recebe base64 puro ou data URL.
 */
export async function enviarAudio(
  instanciaNome: string,
  numero: string,
  audioDataUrlOuBase64: string,
): Promise<{ externo_id?: string }> {
  const m = audioDataUrlOuBase64.match(/^data:([^;]+);base64,(.*)$/s);
  const base64Puro = (m ? m[2] : audioDataUrlOuBase64).replace(/\s/g, '');

  const data = await call('/send/audio', 'POST', {
    instanceName: instanciaNome,
    number: normalizarNumero(numero),
    audio: base64Puro,
    encoding: true,
  });
  const externo_id = data?.id || data?.key?.id || data?.messageId;
  return { externo_id };
}

/**
 * Baixa mídia de uma mensagem como base64.
 */
export async function baixarMidiaBase64(
  instanciaNome: string,
  mensagemKey: any,
): Promise<{ base64?: string; mimetype?: string }> {
  try {
    const data = await call('/chat/getBase64FromMediaMessage', 'POST', {
      instanceName: instanciaNome,
      message: { key: mensagemKey },
      convertToMp4: false,
    });
    return { base64: data?.base64, mimetype: data?.mimetype };
  } catch {
    return {};
  }
}
