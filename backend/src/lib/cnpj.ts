// Validação de CNPJ e consulta pública à Receita (BrasilAPI, com CNPJá de reserva).

export type SocioReceita = { nome: string; qualificacao: string | null };
export type DadosReceita = {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  situacao: string | null; data_situacao: string | null;
  cnae_principal: { codigo: string; descricao: string } | null;
  cnaes_secundarios: { codigo: string; descricao: string }[];
  porte: string | null; natureza_juridica: string | null; data_abertura: string | null;
  capital_social: number | null; email: string | null; telefones: string[];
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cep: string | null; municipio: string | null; uf: string | null;
  socios: SocioReceita[]; simples: boolean | null; mei: boolean | null;
};
export type ConsultaCnpj =
  | { status: 'encontrado'; dados: DadosReceita; fonte: 'BrasilAPI' | 'CNPJá' }
  | { status: 'nao_encontrado' }
  | { status: 'indisponivel' };

const TIMEOUT_MS = 8000;

export function extrairCnpj(texto: string): string | null {
  const t = texto || '';
  // Aceita pontuação opcional entre os grupos (11.222.333/0001-81, 11 222 333 0001 81,
  // ou colado 11222333000181), mas rejeita um candidato colado a mais dígitos antes/depois
  // (ex.: telefone colado no texto), para não juntar dois números diferentes num só CNPJ.
  const regex = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/g;
  const candidatos: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(t)) !== null) {
    const antes = m.index > 0 ? t[m.index - 1] : '';
    const depois = m.index + m[0].length < t.length ? t[m.index + m[0].length] : '';
    if (/\d/.test(antes) || /\d/.test(depois)) continue;
    candidatos.push(m[0].replace(/\D/g, ''));
  }
  if (candidatos.length > 0) {
    return candidatos.find(c => cnpjValido(c)) || candidatos[0];
  }
  const todosDigitos = t.replace(/\D/g, '');
  return todosDigitos.length === 14 ? todosDigitos : null;
}

export function cnpjValido(cnpj: string): boolean {
  const c = (cnpj || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(c.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(cnpj: string): string {
  const c = (cnpj || '').replace(/\D/g, '');
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

const txt = (v: any): string | null => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

export function deBrasilApi(j: any): DadosReceita {
  const tipoLog = txt(j?.descricao_tipo_de_logradouro);
  const log = txt(j?.logradouro);
  return {
    cnpj: String(j?.cnpj || '').replace(/\D/g, ''),
    razao_social: txt(j?.razao_social),
    nome_fantasia: txt(j?.nome_fantasia),
    situacao: txt(j?.descricao_situacao_cadastral)?.toUpperCase() || null,
    data_situacao: txt(j?.data_situacao_cadastral),
    cnae_principal: j?.cnae_fiscal ? { codigo: String(j.cnae_fiscal), descricao: txt(j?.cnae_fiscal_descricao) || '' } : null,
    cnaes_secundarios: (j?.cnaes_secundarios || [])
      .filter((c: any) => c?.codigo && txt(c?.descricao))
      .map((c: any) => ({ codigo: String(c.codigo), descricao: String(c.descricao) })),
    porte: txt(j?.porte),
    natureza_juridica: txt(j?.natureza_juridica),
    data_abertura: txt(j?.data_inicio_atividade),
    capital_social: typeof j?.capital_social === 'number' ? j.capital_social : null,
    email: txt(j?.email),
    telefones: [j?.ddd_telefone_1, j?.ddd_telefone_2].map(t => String(t || '').replace(/\D/g, '')).filter(t => t.length >= 10),
    logradouro: log ? (tipoLog && !log.toUpperCase().startsWith(tipoLog.toUpperCase()) ? `${tipoLog} ${log}` : log) : null,
    numero: txt(j?.numero),
    complemento: txt(j?.complemento),
    bairro: txt(j?.bairro),
    cep: txt(j?.cep)?.replace(/\D/g, '') || null,
    municipio: txt(j?.municipio),
    uf: txt(j?.uf),
    socios: (j?.qsa || []).filter((s: any) => txt(s?.nome_socio)).map((s: any) => ({ nome: String(s.nome_socio), qualificacao: txt(s?.qualificacao_socio) })),
    simples: typeof j?.opcao_pelo_simples === 'boolean' ? j.opcao_pelo_simples : null,
    mei: typeof j?.opcao_pelo_mei === 'boolean' ? j.opcao_pelo_mei : null,
  };
}

export function deCnpja(j: any): DadosReceita {
  const a = j?.address || {};
  const empresa = j?.company || {};
  return {
    cnpj: String(j?.taxId || '').replace(/\D/g, ''),
    razao_social: txt(empresa?.name),
    nome_fantasia: txt(j?.alias),
    situacao: txt(j?.status?.text)?.toUpperCase() || null,
    data_situacao: txt(j?.statusDate),
    cnae_principal: j?.mainActivity?.id ? { codigo: String(j.mainActivity.id), descricao: txt(j.mainActivity.text) || '' } : null,
    cnaes_secundarios: (j?.sideActivities || [])
      .filter((c: any) => c?.id && txt(c?.text))
      .map((c: any) => ({ codigo: String(c.id), descricao: String(c.text) })),
    porte: txt(empresa?.size?.text),
    natureza_juridica: txt(empresa?.nature?.text),
    data_abertura: txt(j?.founded),
    capital_social: typeof empresa?.equity === 'number' ? empresa.equity : null,
    email: txt(j?.emails?.[0]?.address),
    telefones: (j?.phones || []).map((p: any) => `${p?.area || ''}${p?.number || ''}`.replace(/\D/g, '')).filter((t: string) => t.length >= 10),
    logradouro: txt(a.street),
    numero: txt(a.number),
    complemento: txt(a.details),
    bairro: txt(a.district),
    cep: txt(a.zip)?.replace(/\D/g, '') || null,
    municipio: txt(a.city),
    uf: txt(a.state),
    socios: (empresa?.members || []).filter((m: any) => txt(m?.person?.name)).map((m: any) => ({ nome: String(m.person.name), qualificacao: txt(m?.role?.text) })),
    simples: typeof empresa?.simples?.optant === 'boolean' ? empresa.simples.optant : null,
    mei: typeof empresa?.simei?.optant === 'boolean' ? empresa.simei.optant : null,
  };
}

type Tentativa = { tipo: 'ok'; json: any } | { tipo: '404' } | { tipo: 'erro' };

async function tentar(url: string, fetchImpl: typeof fetch): Promise<Tentativa> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res: any = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 404) return { tipo: '404' };
    if (!res.ok) return { tipo: 'erro' };
    return { tipo: 'ok', json: await res.json() };
  } catch {
    return { tipo: 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

export async function consultarCnpj(cnpj: string, fetchImpl: typeof fetch = fetch): Promise<ConsultaCnpj> {
  const c = cnpj.replace(/\D/g, '');
  const b = await tentar(`https://brasilapi.com.br/api/cnpj/v1/${c}`, fetchImpl);
  if (b.tipo === 'ok') return { status: 'encontrado', dados: deBrasilApi(b.json), fonte: 'BrasilAPI' };
  const r = await tentar(`https://open.cnpja.com/office/${c}`, fetchImpl);
  if (r.tipo === 'ok') return { status: 'encontrado', dados: deCnpja(r.json), fonte: 'CNPJá' };
  if (b.tipo === '404' && r.tipo === '404') return { status: 'nao_encontrado' };
  return { status: 'indisponivel' };
}

export function situacaoAtiva(dados: DadosReceita | null | undefined): boolean {
  return (dados?.situacao || '').toUpperCase() === 'ATIVA';
}

export function enderecoCompleto(d: DadosReceita): string {
  const cep = d.cep && d.cep.length === 8 ? `${d.cep.slice(0, 5)}-${d.cep.slice(5)}` : d.cep;
  const rua = [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ');
  const cidade = [d.municipio, d.uf].filter(Boolean).join('/');
  return [rua, d.bairro, cidade, cep ? `CEP ${cep}` : null].filter(Boolean).join(' - ');
}
