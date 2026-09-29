// Heitor, o prospectador: regras puras (sem banco). Regiões em ondas, filtro de redes e de
// perfil, telefones, o que se tira do site do estabelecimento e a observação do lead.

export type Cidade = { nome: string; uf: string };
export type Onda = { numero: number; nome: string; cidades: Cidade[] };

const es = (...n: string[]) => n.map(nome => ({ nome, uf: 'ES' }));

/** Ordem de trabalho: começa pela Grande Vitória e vai avançando. Só passa de cidade quando a atual acaba. */
export const ONDAS: Onda[] = [
  { numero: 1, nome: 'Grande Vitória', cidades: es('Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Viana', 'Guarapari', 'Fundão') },
  { numero: 2, nome: 'Espírito Santo (interior)', cidades: es(
    'Linhares', 'Colatina', 'Cachoeiro de Itapemirim', 'São Mateus', 'Aracruz', 'Nova Venécia', 'Barra de São Francisco',
    'Castelo', 'Marataízes', 'Santa Maria de Jetibá', 'Domingos Martins', 'Venda Nova do Imigrante', 'Afonso Cláudio',
    'Itapemirim', 'Anchieta', 'Iúna', 'Alegre', 'Baixo Guandu', 'Pinheiros', 'Jaguaré', 'Conceição da Barra', 'Santa Teresa',
    'Ibiraçu', 'João Neiva', 'Mimoso do Sul', 'Piúma', 'Guaçuí', 'Ecoporanga', 'Montanha', 'Sooretama', 'Rio Bananal',
  ) },
  { numero: 3, nome: 'Vizinhos (leste de MG, norte do RJ, sul da BA)', cidades: [
    ...['Governador Valadares', 'Ipatinga', 'Coronel Fabriciano', 'Timóteo', 'Teófilo Otoni', 'Caratinga', 'Manhuaçu', 'Muriaé', 'Juiz de Fora'].map(nome => ({ nome, uf: 'MG' })),
    ...['Campos dos Goytacazes', 'Macaé', 'Itaperuna', 'Niterói', 'Rio de Janeiro'].map(nome => ({ nome, uf: 'RJ' })),
    ...['Teixeira de Freitas', 'Eunápolis', 'Porto Seguro', 'Itabuna', 'Ilhéus'].map(nome => ({ nome, uf: 'BA' })),
  ] },
  { numero: 4, nome: 'Sudeste e capitais', cidades: [
    { nome: 'Belo Horizonte', uf: 'MG' }, { nome: 'Uberlândia', uf: 'MG' }, { nome: 'Montes Claros', uf: 'MG' }, { nome: 'Contagem', uf: 'MG' },
    { nome: 'São Paulo', uf: 'SP' }, { nome: 'Campinas', uf: 'SP' }, { nome: 'Ribeirão Preto', uf: 'SP' }, { nome: 'São José dos Campos', uf: 'SP' },
    { nome: 'Salvador', uf: 'BA' }, { nome: 'Feira de Santana', uf: 'BA' }, { nome: 'Vitória da Conquista', uf: 'BA' },
    { nome: 'Curitiba', uf: 'PR' }, { nome: 'Porto Alegre', uf: 'RS' }, { nome: 'Florianópolis', uf: 'SC' },
    { nome: 'Goiânia', uf: 'GO' }, { nome: 'Brasília', uf: 'DF' }, { nome: 'Recife', uf: 'PE' }, { nome: 'Fortaleza', uf: 'CE' },
  ] },
];

export const SEGMENTOS = [
  { chave: 'farmacia', segmento: 'Farmácia', termos: ['farmácia', 'drogaria'] },
  { chave: 'padaria', segmento: 'Padaria', termos: ['padaria'] },
] as const;

/** Buscas de um lugar (cidade inteira ou bairro) para os segmentos ligados. */
export function consultasDoLugar(lugar: string, cidade: Cidade, segmentos: string[]): { texto: string; segmento: string }[] {
  const onde = lugar === cidade.nome ? `${cidade.nome}, ${cidade.uf}` : `${lugar}, ${cidade.nome}, ${cidade.uf}`;
  return SEGMENTOS.filter(s => segmentos.includes(s.chave)).flatMap(s => s.termos.map(t => ({ texto: `${t} em ${onde}`, segmento: s.segmento })));
}

const norm = (x: string) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Redes grandes já têm sistema próprio (ERP corporativo): não são público da Prosystem. */
const REDES = [
  'drogasil', 'droga raia', 'drogaraia', 'pague menos', 'pacheco', 'panvel', 'farmacias sao joao', 'nissei', 'venancio', 'drogaria araujo',
  'extrafarma', 'ultrafarma', 'drogaria sao paulo', 'drogarias sao paulo', 'onofre', 'santa lucia drogarias', 'farmacia santa lucia',
  'farmes', 'drogal', 'poupafarma', 'drogaria rosario', 'farmacia indiana', 'drogarias globo', 'farmacias globo', 'big ben',
  'drogao super', 'farmaponte', 'drogaria catarinense', 'carrefour', 'pao de acucar', 'assai', 'atacadao', 'extra hiper',
  'supermercado', 'hipermercado', 'atacarejo', 'bh supermercados',
];
export function ehRede(nome: string): boolean {
  const n = norm(nome);
  return REDES.some(r => n.includes(r));
}

/** Categoria do Google que interessa para o segmento buscado. */
export function dentroDoPerfil(categoria: string | null | undefined, segmento: string): boolean {
  const c = norm(categoria || '');
  if (!c) return true;
  if (/veterin|hospital|clinica|laboratorio|distribuidor|empresa farmaceutica|atacad|supermercado|hipermercado|mercado/.test(c)) return false;
  return segmento === 'Padaria' ? /padaria|panific|confeitaria|pao|cafe|lanchonete|doceria/.test(c) : /farmac|drogaria|homeopat|manipula/.test(c);
}

/** Telefone BR com DDI 55, só dígitos. Descarta 0800/4002/3003 (central de rede, não é o dono). */
export function telefoneBr(t: string | null | undefined): string | null {
  let d = (t || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (/^(800|300|400)/.test(d) || d.length < 10) return null;
  if (!d.startsWith('55')) d = `55${d}`;
  return d.length === 12 || d.length === 13 ? d : null;
}

export const ehCelular = (n: string) => n.length === 13 && n[4] === '9';

export type Achados = { instagram: string | null; facebook: string | null; linkedin: string | null; whatsapp: string | null; emails: string[]; cnpj: string | null };

const primeiro = (html: string, re: RegExp) => html.match(re)?.[0] || null;

/** O que dá para tirar do site (ou do link que o Google mostra como site): redes, WhatsApp, e-mails e CNPJ. */
export function lerSite(html: string, site?: string | null): Achados {
  const h = `${site || ''} ${html || ''}`;
  const limpar = (u: string | null) => u ? u.replace(/["'<>\s].*$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '') : null;
  const ig = limpar(primeiro(h, /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)[A-Za-z0-9_.]{2,40}/i));
  const fb = limpar(primeiro(h, /https?:\/\/(?:www\.|m\.)?facebook\.com\/(?!sharer|share|plugins|tr\?|dialog)[A-Za-z0-9_.\-/]{2,80}/i));
  const li = limpar(primeiro(h, /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_\-%]{2,80}/i));
  const wa = h.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=|whatsapp\.com\/send\?phone=)\+?(\d{10,13})/i)?.[1] || null;
  const emails = [...new Set((h.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .map(e => e.toLowerCase())
    .filter(e => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/(sentry|wixpress|example|seudominio|dominio|email\.com$|godaddy|cloudflare)/.test(e)))].slice(0, 5);
  const cnpjBruto = h.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)?.[0] || null;
  const cnpj = cnpjBruto && cnpjValido(cnpjBruto) ? cnpjBruto.replace(/\D/g, '') : null;
  return { instagram: ig, facebook: fb, linkedin: li, whatsapp: wa ? telefoneBr(wa) : null, emails, cnpj };
}

export function cnpjValido(c: string): boolean {
  const d = c.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, p, i) => a + Number(d[i]) * p, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Quem decide: o primeiro sócio-administrador da Receita (ou o primeiro sócio). */
export function responsavelDaReceita(socios: { nome: string; qualificacao?: string | null }[] | null | undefined): string | null {
  if (!socios?.length) return null;
  const adm = socios.find(s => /administrador/i.test(s.qualificacao || '')) || socios[0];
  return adm?.nome ? adm.nome.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()) : null;
}

export type Estabelecimento = {
  nome: string; segmento: string; cidade: string | null; bairro: string | null; uf: string | null; endereco: string | null;
  telefone: string | null; whatsapp: string | null; site: string | null; emails: string[]; instagram: string | null; facebook: string | null; linkedin: string | null;
  cnpj: string | null; razao_social: string | null; socios: { nome: string; qualificacao?: string | null }[]; abertura: string | null; porte: string | null;
  nota: number | null; avaliacoes: number | null; horario: Record<string, string[]> | null; maps_link: string | null;
};

/** Observação do lead: tudo o que o Heitor achou, em linguagem de gente. */
export function observacaoDoLead(e: Estabelecimento): string {
  const l = [`🔎 Encontrado pelo Heitor no Google Maps${e.bairro ? ` (${e.bairro}, ${e.cidade})` : e.cidade ? ` (${e.cidade})` : ''}.`];
  if (e.nota != null) l.push(`⭐ Nota ${e.nota.toFixed(1).replace('.', ',')} no Google (${e.avaliacoes || 0} avaliações).`);
  if (e.razao_social || e.cnpj) l.push(`🏢 ${[e.razao_social, e.cnpj && `CNPJ ${e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`, e.porte, e.abertura && `aberta em ${e.abertura}`].filter(Boolean).join(' · ')}`);
  if (e.socios.length) l.push(`👤 Sócios (Receita): ${e.socios.slice(0, 4).map(s => `${s.nome}${s.qualificacao ? ` (${s.qualificacao})` : ''}`).join('; ')}`);
  if (e.whatsapp) l.push(`💬 WhatsApp confirmado: ${e.whatsapp}`);
  if (e.telefone && e.telefone !== e.whatsapp) l.push(`☎️ Telefone: ${e.telefone}`);
  if (e.emails.length) l.push(`✉️ ${e.emails.join(', ')}`);
  const redes = [e.site && !/instagram|facebook/.test(e.site) && `site ${e.site}`, e.instagram && `Instagram ${e.instagram}`, e.facebook && `Facebook ${e.facebook}`, e.linkedin && `LinkedIn ${e.linkedin}`].filter(Boolean);
  if (redes.length) l.push(`🌐 ${redes.join(' · ')}`);
  if (e.endereco) l.push(`📍 ${e.endereco}`);
  if (e.horario && Object.keys(e.horario).length) {
    const seg = e.horario['segunda-feira']?.join(', '), dom = e.horario['domingo']?.join(', ');
    if (seg) l.push(`🕘 Seg: ${seg}${dom ? ` · Dom: ${dom}` : ''}`);
  }
  if (e.maps_link) l.push(`🗺️ ${e.maps_link.split('?')[0]}`);
  return l.join('\n');
}
