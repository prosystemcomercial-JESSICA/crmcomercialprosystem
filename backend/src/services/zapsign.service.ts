// Integração ZapSign — envio de contratos a partir de templates
//
// Documentação: https://docs.zapsign.com.br/
// Conta da ProSystem usa templates pré-cadastrados no painel ZapSign.
// Cada plano (Basic, MEI, Pro, Plus) tem um template_id próprio,
// configurado nas variáveis de ambiente ZAPSIGN_TPL_<PLANO>.

const ZAPSIGN_API = 'https://api.zapsign.com.br/api/v1';

type ZapSignSigner = {
  name: string;
  email?: string;
  phone_country?: string;
  phone_number?: string;
  auth_mode?: 'assinaturaTela' | 'tokenEmail' | 'tokenSms';
  send_via_email?: boolean;
  send_via_whatsapp?: boolean;
};

type CriarDocPorTemplateParams = {
  template_id: string;
  signer: ZapSignSigner;
  data: Record<string, string>; // valores dos placeholders
  doc_name?: string;
  external_id?: string; // id do lead no nosso sistema
};

function getToken(): string {
  const token = process.env.ZAPSIGN_API_TOKEN || '';
  if (!token) throw new Error('ZAPSIGN_API_TOKEN não configurado');
  return token;
}

export function getTemplateIdParaPlano(plano: string): string | null {
  const upper = (plano || '').toUpperCase();
  const map: Record<string, string | undefined> = {
    BASIC: process.env.ZAPSIGN_TPL_BASIC,
    MEI:   process.env.ZAPSIGN_TPL_MEI,
    PRO:   process.env.ZAPSIGN_TPL_PRO,
    PLUS:  process.env.ZAPSIGN_TPL_PLUS,
  };
  return map[upper] || null;
}

/**
 * Cria um documento a partir de um template ZapSign já cadastrado.
 * Retorna o objeto da ZapSign com `open_id`, `token`, `signed_file`, etc.
 */
export async function criarDocPorTemplate(params: CriarDocPorTemplateParams) {
  const token = getToken();

  // Monta o array de data_to_fill no formato ZapSign:
  // [{ de: "{{cliente_nome}}", para: "João da Silva" }, ...]
  const data_to_fill = Object.entries(params.data).map(([key, value]) => ({
    de: `{{${key}}}`,
    para: value || ''
  }));

  const body: any = {
    template_id: params.template_id,
    signer_name: params.signer.name,
    data: data_to_fill,
  };

  // Signatário adicional (cliente que vai assinar)
  if (params.signer.email) body.signer_email = params.signer.email;
  if (params.signer.phone_country) body.signer_phone_country = params.signer.phone_country;
  if (params.signer.phone_number) body.signer_phone_number = params.signer.phone_number;
  if (params.signer.auth_mode) body.signer_auth_mode = params.signer.auth_mode;
  if (params.signer.send_via_email !== undefined) body.send_automatic_email = params.signer.send_via_email;
  if (params.signer.send_via_whatsapp !== undefined) body.send_automatic_whatsapp = params.signer.send_via_whatsapp;

  if (params.doc_name) body.doc_name = params.doc_name;
  if (params.external_id) body.external_id = params.external_id;

  const res = await fetch(`${ZAPSIGN_API}/models/create-doc/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();
  if (!res.ok) {
    throw new Error(`ZapSign API error (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

/**
 * Lista templates ativos na conta ZapSign — útil para a tela de admin
 * mostrar quais templates já estão cadastrados.
 */
export async function listarTemplates() {
  const token = getToken();
  const res = await fetch(`${ZAPSIGN_API}/templates/`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`ZapSign: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Recupera detalhes de um documento (ex: status de assinatura).
 */
export async function obterDoc(docToken: string) {
  const token = getToken();
  const res = await fetch(`${ZAPSIGN_API}/docs/${docToken}/`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`ZapSign: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Helper para formatar valor BRL.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR');
}
