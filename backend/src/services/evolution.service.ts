// Integração UazAPI — WhatsApp multi-instância
//
// Documentação: https://docs.uazapi.com/
// Variáveis de ambiente necessárias:
//   EVOLUTION_API_URL   → ex.: https://free.uazapi.com  (subdomínio da conta)
//   EVOLUTION_API_KEY   → ADMIN TOKEN da conta UazAPI (só cria/lista instâncias)
//   EVOLUTION_WEBHOOK_URL (opcional) → URL pública deste backend + /whatsapp/webhook
//
// A UazAPI usa DOIS tokens diferentes (header "token" em ambos os casos):
//   - admin token (EVOLUTION_API_KEY): só para /instance/init (criar).
//   - instance token: devolvido na criação de CADA instância — precisa ser
//     salvo (WhatsappInstancia.instance_token) e usado em toda operação
//     daquela instância (status, QR, enviar mensagem, desconectar, deletar).
// Usar o admin token nessas chamadas de instância retorna 200 mas com dado
// errado/vazio — foi a causa do QR "sumir" e do status ficar preso em
// DESCONECTADO mesmo após conectar de verdade.

function getBaseUrl(): string {
  const url = process.env.EVOLUTION_API_URL || '';
  if (!url) throw new Error('EVOLUTION_API_URL não configurado');
  return url.replace(/\/+$/, '');
}

function getAdminToken(): string {
  const key = process.env.EVOLUTION_API_KEY || '';
  if (!key) throw new Error('EVOLUTION_API_KEY não configurado');
  return key;
}

export function evolutionConfigurada(): boolean {
  return !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY;
}

async function call(path: string, method: 'GET' | 'POST' | 'DELETE', token: string, body?: any) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
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
 * Cria uma nova instância (POST /instance/init, com o ADMIN TOKEN) e devolve
 * o TOKEN DE INSTÂNCIA que a UazAPI gera — esse token precisa ser salvo
 * (WhatsappInstancia.instance_token) porque toda chamada seguinte dessa
 * instância específica (status, QR, enviar) usa ele, não o admin token.
 */
export async function criarInstancia(instanciaNome: string): Promise<{ qr?: string; status: string; instanceToken?: string }> {
  const data = await call('/instance/init', 'POST', getAdminToken(), {
    name: instanciaNome,
    systemName: instanciaNome,
  });
  const instanceToken = data?.token || data?.instance?.token || data?.instanceToken;
  const qr = data?.qrcode?.base64 || data?.qr || data?.base64 || data?.qrCode || data?.instance?.qrcode;
  console.log(`[UAZAPI][DIAG] /instance/init (${instanciaNome}) token=${instanceToken ? 'OK' : 'AUSENTE'} qr=${qr ? 'OK' : 'AUSENTE'}:`, JSON.stringify(data).slice(0, 1000));
  return { qr, status: 'CONECTANDO', instanceToken };
}

/** Reobtém o QR Code / status de uma instância (GET /instance/status, com o TOKEN DA INSTÂNCIA). */
export async function obterQrCode(instanceToken: string): Promise<{ qr?: string }> {
  try {
    const data = await call('/instance/status', 'GET', instanceToken);
    const qr = data?.qrcode?.base64 || data?.qr || data?.base64 || data?.qrCode || data?.instance?.qrcode;
    return { qr };
  } catch (e: any) {
    console.log('[UAZAPI][DIAG] obterQrCode ERRO:', e?.message);
    return {};
  }
}

/** Estado da conexão via GET /instance/status (com o TOKEN DA INSTÂNCIA). */
export async function obterStatus(instanceToken: string): Promise<{ status: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'; numero?: string }> {
  try {
    const data = await call('/instance/status', 'GET', instanceToken);
    // A UazAPI aninha o estado real em instance.status ("connected"/"connecting"/
    // "disconnected") — o campo status no nível raiz (se existir) não é isso.
    const state = data?.instance?.status || data?.instance?.state || data?.state;
    const numero = data?.instance?.owner || data?.instance?.number || data?.owner || data?.number;
    console.log(`[UAZAPI][DIAG] /instance/status state="${state}":`, JSON.stringify(data).slice(0, 800));
    if (state === 'connected' || state === 'open') return { status: 'CONECTADO', numero };
    if (state === 'connecting' || state === 'hibernated' || state === 'qrcode') return { status: 'CONECTANDO', numero };
    return { status: 'DESCONECTADO', numero };
  } catch (e: any) {
    console.log('[UAZAPI][DIAG] obterStatus ERRO:', e?.message);
    return { status: 'DESCONECTADO' };
  }
}

/**
 * Configura o webhook da instância (POST /webhook, com o TOKEN DA INSTÂNCIA).
 * Necessário para toda instância nova — sem isso, mensagens recebidas e ecos
 * de mensagens enviadas pelo celular nunca chegam ao CRM (só se souber, via
 * painel da UazAPI ou aqui, configurar isso explicitamente por instância).
 */
export async function configurarWebhook(instanceToken: string): Promise<void> {
  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL;
  if (!webhookUrl) return;
  await call('/webhook', 'POST', instanceToken, {
    url: webhookUrl,
    enabled: true,
    events: ['messages', 'connection'],
  }).catch((e) => console.error('[UAZAPI] Falha ao configurar webhook:', e?.message));
}

/** Desconecta a instância (com o TOKEN DA INSTÂNCIA). */
export async function desconectarInstancia(instanceToken: string): Promise<void> {
  await call('/instance/disconnect', 'POST', instanceToken).catch(() => {});
}

/** Deleta a instância (com o TOKEN DA INSTÂNCIA). */
export async function deletarInstancia(instanceToken: string): Promise<void> {
  await call('/instance/delete', 'DELETE', instanceToken).catch(() => {});
}

/** Normaliza telefone BR para formato internacional sem caracteres especiais. */
export function normalizarNumero(numero: string): string {
  let n = (numero || '').replace(/\D/g, '');
  if (n.length <= 11 && !n.startsWith('55')) n = `55${n}`;
  return n;
}

/** Envia mensagem de texto via POST /send/text (com o TOKEN DA INSTÂNCIA). */
export async function enviarTexto(
  instanceToken: string,
  numero: string,
  texto: string,
): Promise<{ externo_id?: string }> {
  const data = await call('/send/text', 'POST', instanceToken, {
    number: normalizarNumero(numero),
    text: texto,
  });
  const externo_id = data?.id || data?.key?.id || data?.messageId;
  return { externo_id };
}

/**
 * Envia áudio como mensagem de voz via POST /send/audio (com o TOKEN DA INSTÂNCIA).
 * Recebe base64 puro ou data URL.
 */
export async function enviarAudio(
  instanceToken: string,
  numero: string,
  audioDataUrlOuBase64: string,
): Promise<{ externo_id?: string }> {
  const m = audioDataUrlOuBase64.match(/^data:([^;]+);base64,(.*)$/s);
  const base64Puro = (m ? m[2] : audioDataUrlOuBase64).replace(/\s/g, '');

  const data = await call('/send/audio', 'POST', instanceToken, {
    number: normalizarNumero(numero),
    audio: base64Puro,
    encoding: true,
  });
  const externo_id = data?.id || data?.key?.id || data?.messageId;
  return { externo_id };
}

/**
 * Baixa mídia de uma mensagem como base64 (com o TOKEN DA INSTÂNCIA).
 */
export async function baixarMidiaBase64(
  instanceToken: string,
  mensagemKey: any,
): Promise<{ base64?: string; mimetype?: string }> {
  try {
    const data = await call('/chat/getBase64FromMediaMessage', 'POST', instanceToken, {
      message: { key: mensagemKey },
      convertToMp4: false,
    });
    return { base64: data?.base64, mimetype: data?.mimetype };
  } catch {
    return {};
  }
}
