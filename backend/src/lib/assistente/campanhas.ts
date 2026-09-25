// Campanhas pelo WhatsApp (Fase 4 do assistente): montagem do público, texto
// personalizado e opção de sair. Puro.

export const PUBLICOS = ['CLIENTES', 'LEADS_PARADOS'] as const;
export type Publico = typeof PUBLICOS[number];
export const MAX_POR_CAMPANHA = 300;
export const ENVIOS_POR_RODADA = 4; // rodada a cada 10 min ≈ 24 por hora
export const RODAPE_SAIR = '\n\n_Para não receber mais estas mensagens, responda SAIR._';

/** Celular brasileiro no formato do WhatsApp (55 + DDD + número) ou null. */
export function numeroWhatsapp(tel: string | null | undefined): string | null {
  let d = (tel || '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') return `55${d}`;
  if (d.length === 10 && /[6-9]/.test(d[2])) return `55${d}`; // celular antigo sem o 9
  return null;
}

/** Telefones do cadastro do cliente com o DDD do campo separado (celulares primeiro). */
export function telefonesDoCliente(c: { ddd?: string | null; telefone?: string | null; telefone1?: string | null; telefone2?: string | null; tel_contato?: string | null; tel_contato2?: string | null }): string[] {
  const ddd = (c.ddd || '').replace(/\D/g, '').slice(-2);
  return [c.tel_contato, c.tel_contato2, c.telefone2, c.telefone1, c.telefone]
    .map(t => (t || '').replace(/\D/g, ''))
    .filter(Boolean)
    .map(d => (ddd.length === 2 && (d.length === 8 || d.length === 9) ? ddd + d : d));
}

export const ultimos8 = (n: string) => n.replace(/\D/g, '').slice(-8);

/** Lista final: só celulares, sem repetidos e sem quem pediu para sair. */
export function montarPublico(
  contatos: { telefone: string | null; nome: string | null }[], optout: string[], max = MAX_POR_CAMPANHA,
): { numero: string; nome: string | null }[] {
  const fora = new Set(optout.map(ultimos8));
  const vistos = new Set<string>();
  const out: { numero: string; nome: string | null }[] = [];
  for (const c of contatos) {
    const n = numeroWhatsapp(c.telefone);
    if (!n || fora.has(ultimos8(n)) || vistos.has(ultimos8(n))) continue;
    vistos.add(ultimos8(n));
    out.push({ numero: n, nome: c.nome });
    if (out.length >= max) break;
  }
  return out;
}

/** Troca {nome} pelo primeiro nome (ou tira a saudação vazia) e acrescenta a opção de sair. */
export function textoPersonalizado(modelo: string, nome: string | null): string {
  const p = (nome || '').trim().split(/\s+/)[0] || '';
  const t = modelo.replace(/\{nome\}/gi, p).replace(/\s+([,!?.])/g, '$1').replace(/^(Olá|Oi|Bom dia|Boa tarde)\s*,\s*!/i, '$1!');
  return `${t.trim()}${RODAPE_SAIR}`;
}

export const ehPedidoDeSaida = (texto: string | null | undefined) =>
  /^\s*(sair|parar|pare|remover|nao quero mais|não quero mais|descadastrar)\s*[.!]?\s*$/i.test(texto || '');
