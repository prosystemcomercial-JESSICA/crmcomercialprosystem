// API gratuita de WhatsApp (Evolution API 2.3.7, instalada na própria VPS em 127.0.0.1:8080).
// Pedido da Jessica (07/10/2026): números extras para distribuir a prospecção sem pagar outra API.
//
// Uma instância gratuita fica salva com instance_token = "evo:<nome>". As funções de
// evolution.service.ts olham esse prefixo e chamam este módulo, então o resto do CRM
// (Inbox, Bia, Caroline, agentes) envia do mesmo jeito, sem saber qual API está por trás.
//
// Variáveis (só no .env do servidor, nunca no Git):
//   EVOLUTION_GRATIS_URL      → http://127.0.0.1:8080
//   EVOLUTION_GRATIS_KEY      → chave global da Evolution API
//   EVOLUTION_GRATIS_WEBHOOK  → http://127.0.0.1:3011/whatsapp/webhook-gratis?chave=<segredo>
//
// Licença: a Evolution API (Apache 2.0 com condições) permite uso comercial, desde que o
// sistema mostre aos administradores que usa a Evolution API — aviso na tela de Configurações.

export const PREFIXO_GRATIS = 'evo:';
export const ehTokenGratis = (token: string | null | undefined) => !!token && token.startsWith(PREFIXO_GRATIS);
export const nomeDoToken = (token: string) => token.slice(PREFIXO_GRATIS.length);
export const tokenGratis = (nome: string) => `${PREFIXO_GRATIS}${nome}`;

export function gratisConfigurada(): boolean {
  return !!process.env.EVOLUTION_GRATIS_URL && !!process.env.EVOLUTION_GRATIS_KEY;
}

/** Erro "número sem WhatsApp" da Evolution: 400 com { exists: false }. */
export const ehSemWhatsappGratis = (texto: string) => /"exists"\s*:\s*false/.test(texto || '');

async function chamar(path: string, method: 'GET' | 'POST' | 'DELETE', body?: any): Promise<any> {
  const base = (process.env.EVOLUTION_GRATIS_URL || '').replace(/\/+$/, '');
  if (!base || !process.env.EVOLUTION_GRATIS_KEY) throw new Error('API gratuita de WhatsApp não configurada');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_GRATIS_KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err: any = new Error(`API gratuita ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    err.semWhatsapp = ehSemWhatsappGratis(text);
    throw err;
  }
  return json;
}

const enc = encodeURIComponent;
const EVENTOS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

function webhook() {
  const url = process.env.EVOLUTION_GRATIS_WEBHOOK;
  return url ? { enabled: true, url, byEvents: false, base64: true, events: EVENTOS } : undefined;
}

export async function criar(nome: string): Promise<{ qr?: string }> {
  const wh = webhook();
  const data = await chamar('/instance/create', 'POST', {
    instanceName: nome, integration: 'WHATSAPP-BAILEYS', qrcode: true,
    rejectCall: true, msgCall: 'No momento não atendemos ligações por este número. Pode mandar sua mensagem por aqui 🙂',
    groupsIgnore: true, alwaysOnline: false, readMessages: false, syncFullHistory: false,
    ...(wh ? { webhook: wh } : {}),
  });
  return { qr: data?.qrcode?.base64 || undefined };
}

export async function configurarWebhook(nome: string): Promise<boolean> {
  const wh = webhook();
  if (!wh) { console.warn('[WA-GRATIS] EVOLUTION_GRATIS_WEBHOOK não configurado.'); return false; }
  try { await chamar(`/webhook/set/${enc(nome)}`, 'POST', { webhook: wh }); return true; }
  catch (e: any) { console.error('[WA-GRATIS] webhook:', e?.message); return false; }
}

export async function qr(nome: string): Promise<{ qr?: string }> {
  try {
    const data = await chamar(`/instance/connect/${enc(nome)}`, 'GET');
    return { qr: data?.base64 || data?.qrcode?.base64 || undefined };
  } catch { return {}; }
}

export async function status(nome: string): Promise<{ status: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'; numero?: string }> {
  try {
    const data = await chamar(`/instance/connectionState/${enc(nome)}`, 'GET');
    const state = data?.instance?.state || data?.state;
    let numero: string | undefined;
    if (state === 'open') {
      const lista = await chamar(`/instance/fetchInstances?instanceName=${enc(nome)}`, 'GET').catch(() => null);
      const i = Array.isArray(lista) ? lista[0] : lista;
      numero = String(i?.ownerJid || i?.instance?.owner || '').split('@')[0].split(':')[0] || undefined;
      return { status: 'CONECTADO', numero };
    }
    if (state === 'connecting') return { status: 'CONECTANDO' };
    return { status: 'DESCONECTADO' };
  } catch { return { status: 'DESCONECTADO' }; }
}

export async function desconectar(nome: string) { await chamar(`/instance/logout/${enc(nome)}`, 'DELETE').catch(() => {}); }
export async function apagar(nome: string) { await chamar(`/instance/delete/${enc(nome)}`, 'DELETE').catch(() => {}); }

/** número → existe? (a forma que existe vem em `jid`). */
export async function verificar(nome: string, numeros: string[]): Promise<{ numero: string; existe: boolean; jid?: string }[]> {
  const data = await chamar(`/chat/whatsappNumbers/${enc(nome)}`, 'POST', { numbers: numeros });
  const lista: any[] = Array.isArray(data) ? data : [];
  return lista.map(x => ({ numero: String(x?.number || '').replace(/\D/g, ''), existe: !!x?.exists, jid: x?.jid ? String(x.jid).split('@')[0] : undefined }));
}

export async function nomePerfil(nome: string, numero: string): Promise<string | null | undefined> {
  const data = await chamar(`/chat/fetchProfile/${enc(nome)}`, 'POST', { number: numero }).catch(() => undefined);
  if (!data || typeof data !== 'object') return undefined;
  return String(data.name || data.pushName || '').trim() || null;
}

const idEnviado = (data: any): string | undefined => data?.key?.id || data?.messageId || undefined;

export async function texto(nome: string, numero: string, txt: string, digitandoMs?: number) {
  return idEnviado(await chamar(`/message/sendText/${enc(nome)}`, 'POST', { number: numero, text: txt, ...(digitandoMs ? { delay: Math.round(digitandoMs) } : {}) }));
}

export async function audio(nome: string, numero: string, base64: string) {
  return idEnviado(await chamar(`/message/sendWhatsAppAudio/${enc(nome)}`, 'POST', { number: numero, audio: base64 }));
}

export async function arquivo(nome: string, numero: string, base64: string, mimetype: string, tipo: 'image' | 'video' | 'document', nomeArquivo: string, legenda?: string) {
  return idEnviado(await chamar(`/message/sendMedia/${enc(nome)}`, 'POST', {
    number: numero, mediatype: tipo, mimetype, media: base64, fileName: nomeArquivo, ...(legenda ? { caption: legenda } : {}),
  }));
}

export async function midia(nome: string, messageId: string): Promise<{ base64: string; mimetype: string | null } | null> {
  const data = await chamar(`/chat/getBase64FromMediaMessage/${enc(nome)}`, 'POST', { message: { key: { id: messageId } }, convertToMp4: false });
  return data?.base64 ? { base64: String(data.base64), mimetype: data?.mimetype || null } : null;
}

// ── Menus ─────────────────────────────────────────────────────────────────
// Botões e listas não chegam com segurança por esta API (o WhatsApp bloqueia em números comuns).
// O menu vai como texto com opções numeradas, e a resposta "1", "2"... (ou o texto da opção)
// volta como o botao_id da opção, para a Bia/agentes seguirem igual. Guardado em memória por 3 dias.
type OpcaoMenu = { id: string; texto: string; descricao?: string };
const menusAbertos = new Map<string, { opcoes: OpcaoMenu[]; em: number }>();
const chaveMenu = (nome: string, numero: string) => `${nome}:${numero.replace(/\D/g, '').slice(-8)}`;
const TTL_MENU = 3 * 864e5;

export function menuEmTexto(textoMenu: string, opcoes: OpcaoMenu[], rodape?: string): string {
  const linhas = opcoes.map((o, i) => `*${i + 1}* - ${o.texto}${o.descricao ? ` (${o.descricao})` : ''}`);
  return [textoMenu, '', ...linhas, '', rodape ? `_${rodape}_` : '_Responda com o número da opção._'].join('\n');
}

export async function menu(nome: string, numero: string, textoMenu: string, opcoes: OpcaoMenu[], rodape?: string) {
  const id = await texto(nome, numero, menuEmTexto(textoMenu, opcoes, rodape));
  menusAbertos.set(chaveMenu(nome, numero), { opcoes, em: Date.now() });
  return id;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Resposta do contato a um menu em texto: "2", "2️⃣", "opção 2" ou o texto da opção → id da opção. */
export function opcaoEscolhida(resposta: string, opcoes: OpcaoMenu[]): OpcaoMenu | null {
  const r = semAcento(String(resposta || '').replace(/(\d)️?⃣/g, '$1'));
  if (!r) return null;
  const num = r.match(/^(?:opcao |op |n )?(\d{1,2})$/);
  if (num) return opcoes[Number(num[1]) - 1] || null;
  return opcoes.find(o => semAcento(o.texto) === r) || null;
}

export function respostaDeMenu(nome: string, numero: string, resposta: string): string | null {
  const k = chaveMenu(nome, numero);
  const m = menusAbertos.get(k);
  if (!m) return null;
  if (Date.now() - m.em > TTL_MENU) { menusAbertos.delete(k); return null; }
  const o = opcaoEscolhida(resposta, m.opcoes);
  if (o) menusAbertos.delete(k);
  return o?.id || null;
}
