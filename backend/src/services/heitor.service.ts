import type { PrismaClient } from '@prisma/client';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import {
  ONDAS, consultasDoLugar, ehRede, dentroDoPerfil, telefoneBr, ehCelular, lerSite, responsavelDaReceita, observacaoDoLead,
  type Cidade, type Estabelecimento,
} from '@/lib/assistente/heitor';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';

// Heitor, o prospectador. Trabalha por região, em ondas (Grande Vitória primeiro), bairro por bairro.
// 1) Busca drogarias/farmácias e padarias no Google Maps (ferramenta aberta google-maps-scraper, na VPS).
// 2) Completa cada uma: site (Instagram, Facebook, LinkedIn, WhatsApp, e-mail, CNPJ) e Receita (razão social, sócios).
// 3) Descarta redes grandes, o que está fora do perfil, fechado, e quem JÁ está no CRM (lead, cliente ou conversa).
// 4) Confere na UazAPI se o número tem WhatsApp (só consulta, sem mandar nada).
// 5) Cadastra o lead e põe na fila da Caroline, que faz o primeiro contato dentro do limite diário ÚNICO do número.

const CHAVE = 'heitor.config';
export const CAMPANHA_HEITOR = 'Prospecção Heitor';
const BIN = process.env.HEITOR_GMAPS_BIN || '/opt/heitor/gmaps';
const PASTA = process.env.HEITOR_PASTA || '/opt/heitor/trabalho';

export type ConfigHeitor = {
  ativo: boolean; cadastros_dia: number; envios_dia: number; segmentos: string[];
  cursor: { onda: number; cidade: number; lugar: number };
  lugares: Record<string, string[]>; // bairros de cada cidade (a cidade inteira vem primeiro)
  ultima_rodada: string | null; ultimo_erro: string | null;
};
const PADRAO: ConfigHeitor = { ativo: false, cadastros_dia: 30, envios_dia: 15, segmentos: ['farmacia', 'padaria'], cursor: { onda: 0, cidade: 0, lugar: 0 }, lugares: {}, ultima_rodada: null, ultimo_erro: null };

export async function obterConfigHeitor(prisma: PrismaClient): Promise<ConfigHeitor> {
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  let c: any = {};
  try { c = r ? JSON.parse(r.valor) : {}; } catch { c = {}; }
  const cfg: ConfigHeitor = { ...PADRAO, ...c, cursor: { ...PADRAO.cursor, ...(c.cursor || {}) }, lugares: c.lugares || {} };
  cfg.cadastros_dia = Math.max(1, Math.min(60, Math.round(cfg.cadastros_dia || 30)));
  cfg.envios_dia = Math.max(0, Math.min(30, Math.round(cfg.envios_dia ?? 15)));
  cfg.segmentos = (cfg.segmentos || []).filter(s => ['farmacia', 'padaria'].includes(s));
  if (!cfg.segmentos.length) cfg.segmentos = ['farmacia', 'padaria'];
  return cfg;
}

export async function salvarConfigHeitor(prisma: PrismaClient, novo: Partial<ConfigHeitor>, userId = 'heitor') {
  const cfg = { ...(await obterConfigHeitor(prisma)), ...novo };
  const valor = JSON.stringify(cfg);
  await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor, updated_by: userId }, update: { valor, updated_by: userId } });
  return obterConfigHeitor(prisma);
}

const inicioDoDia = (agora = new Date()) => new Date(`${agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T00:00:00-03:00`);
const ultimos8 = (n: string) => (n || '').replace(/\D/g, '').slice(-8);

/** Onde o Heitor está agora (onda, cidade e bairro). Null = terminou todas as ondas. */
export function posicao(cfg: ConfigHeitor): { onda: typeof ONDAS[number]; cidade: Cidade; lugares: string[] | null; lugar: string | null } | null {
  const { onda: o, cidade: c, lugar: l } = cfg.cursor;
  const onda = ONDAS[o];
  if (!onda) return null;
  const cidade = onda.cidades[c];
  if (!cidade) return null;
  const lugares = cfg.lugares[`${cidade.nome}/${cidade.uf}`] || null;
  return { onda, cidade, lugares, lugar: lugares ? lugares[l] ?? null : null };
}

/** Avança para o próximo bairro; acabou a cidade, vai para a próxima; acabou a onda, abre a seguinte. */
function avancar(cfg: ConfigHeitor) {
  const p = posicao(cfg);
  if (!p) return;
  if (p.lugares && cfg.cursor.lugar + 1 < p.lugares.length) { cfg.cursor.lugar++; return; }
  cfg.cursor.lugar = 0;
  if (cfg.cursor.cidade + 1 < p.onda.cidades.length) { cfg.cursor.cidade++; return; }
  cfg.cursor.cidade = 0;
  cfg.cursor.onda++;
}

/** Bairros com comércio de rua (a IA lista; a cidade inteira vem primeiro). Cidade pequena = só ela. */
async function lugaresDaCidade(prisma: PrismaClient, cidade: Cidade): Promise<string[]> {
  try {
    const { chamarGemini } = await import('./ia-gemini.service');
    const { lerJsonIa } = await import('@/lib/assistente/ia-texto');
    const texto = await chamarGemini(prisma, {
      sistema: 'Você conhece a geografia urbana do Brasil. Responda só com fatos reais; na dúvida, deixe de fora.',
      partes: [{ text: `Liste os bairros de ${cidade.nome}/${cidade.uf} onde há mais comércio de rua (farmácias e padarias de bairro). Só nomes oficiais de bairros que existem, até 25, dos mais movimentados para os menos. Se a cidade tiver menos de 60 mil habitantes, devolva lista vazia. Responda APENAS JSON: {"bairros": ["..."]}` }],
      json: true, simples: true, timeoutMs: 60_000,
    });
    const b = (lerJsonIa<{ bairros: string[] }>(texto)?.bairros || []).map(x => String(x).trim()).filter(x => x && x.length < 60);
    return [cidade.nome, ...[...new Set(b)].filter(x => x.toLowerCase() !== cidade.nome.toLowerCase()).slice(0, 25)];
  } catch {
    return [cidade.nome];
  }
}

/** Roda a ferramenta do Google Maps para as buscas do lugar e devolve os estabelecimentos (JSON por linha). */
async function buscarNoMaps(consultas: string[]): Promise<any[]> {
  await fs.mkdir(PASTA, { recursive: true });
  const id = Date.now().toString(36);
  const entrada = path.join(PASTA, `busca-${id}.txt`), saida = path.join(PASTA, `busca-${id}.json`);
  await fs.writeFile(entrada, consultas.join('\n'));
  try {
    await new Promise<void>((ok, falha) => {
      execFile(BIN, ['-input', entrada, '-results', saida, '-json', '-depth', '6', '-lang', 'pt-BR', '-email', '-c', '2', '-exit-on-inactivity', '2m'],
        { timeout: 25 * 60_000, maxBuffer: 20 * 1024 * 1024 }, (e) => e && !(e as any).killed ? falha(e) : ok());
    });
    const txt = await fs.readFile(saida, 'utf8').catch(() => '');
    return txt.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } finally {
    await fs.rm(entrada, { force: true }).catch(() => {});
    await fs.rm(saida, { force: true }).catch(() => {});
  }
}

async function baixar(url: string, ms = 10_000): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProsystemBot/1.0)' }, redirect: 'follow' });
    if (!r.ok) return '';
    return (await r.text()).slice(0, 600_000);
  } catch { return ''; } finally { clearTimeout(t); }
}

/** Receita Federal (BrasilAPI, dado público): razão social, porte, abertura e sócios. */
async function receita(cnpj: string): Promise<any | null> {
  const t = await baixar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 12_000);
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

/** Grava o que veio do Maps (uma vez por estabelecimento) com a primeira triagem. */
async function registrarEncontrados(prisma: PrismaClient, itens: any[], contexto: { onda: number; regiao: string; cidade: Cidade; bairro: string | null }, segmentoDe: Map<string, string>) {
  let novos = 0;
  const nomesVistos = new Map<string, number>();
  for (const p of itens) nomesVistos.set(String(p.title || '').toLowerCase().trim(), (nomesVistos.get(String(p.title || '').toLowerCase().trim()) || 0) + 1);
  for (const p of itens) {
    const place = String(p.place_id || p.cid || p.data_id || '');
    if (!place || !p.title) continue;
    if (await prisma.prospeccaoLocal.findUnique({ where: { place_id: place }, select: { id: true } })) continue;
    const segmento = segmentoDe.get(String(p.input_id || '')) || (/padaria|panific|confeit/i.test(`${p.category} ${p.title}`) ? 'Padaria' : 'Farmácia');
    const telefone = telefoneBr(p.phone);
    // Mesmo nome 3+ vezes (nesta busca somado ao que já foi encontrado antes) = rede.
    const antes = await prisma.prospeccaoLocal.count({ where: { nome: String(p.title).slice(0, 190) } });
    const repetido = (nomesVistos.get(String(p.title).toLowerCase().trim()) || 0) + antes >= 3;
    const fechado = /closed|fechado/i.test(String(p.status || ''));
    const status = fechado ? 'FECHADO' : ehRede(p.title) || repetido ? 'REDE' : !dentroDoPerfil(p.category, segmento) ? 'FORA_DO_PERFIL' : 'NOVO';
    const ca = p.complete_address || {};
    await prisma.prospeccaoLocal.create({
      data: {
        place_id: place, nome: String(p.title).slice(0, 190), categoria: p.category || null, segmento, onda: contexto.onda, regiao: contexto.regiao,
        cidade: ca.city || contexto.cidade.nome, bairro: ca.borough || contexto.bairro, estado: contexto.cidade.uf, endereco: p.address || null,
        telefone, site: p.web_site || null, emails: Array.isArray(p.emails) ? p.emails.slice(0, 5) : [], nota: typeof p.review_rating === 'number' ? p.review_rating : null,
        avaliacoes: typeof p.review_count === 'number' ? p.review_count : null, horario: p.open_hours || undefined, maps_link: p.link || null,
        status, motivo: status === 'REDE' ? 'Rede grande: já tem sistema corporativo.' : status === 'FORA_DO_PERFIL' ? `Categoria "${p.category}" fora do perfil.` : status === 'FECHADO' ? 'Fechado no Google.' : null,
      },
    }).then(() => { novos++; }).catch(() => {});
  }
  return novos;
}

/** Já está no CRM? (lead, conversa, cliente, fila dos agentes; pelo telefone ou pelo CNPJ). */
async function jaConhecido(prisma: PrismaClient, numeros: string[], cnpj: string | null): Promise<string | null> {
  const fins = [...new Set(numeros.filter(Boolean).map(ultimos8))];
  for (const f of fins) {
    if (await prisma.lead.findFirst({ where: { OR: [{ telefone: { endsWith: f } }, { responsavel_telefone: { endsWith: f } }] }, select: { id: true } })) return 'Telefone já é de um lead no CRM.';
    if (await prisma.whatsappConversa.findFirst({ where: { contato_numero: { endsWith: f } }, select: { id: true } })) return 'Já existe conversa com esse número no WhatsApp.';
    if (await prisma.cliente.findFirst({ where: { telefone: { endsWith: f } }, select: { id: true } }).catch(() => null)) return 'Telefone é de um cliente.';
    if (await prisma.sdrLead.findFirst({ where: { numero: { endsWith: f } }, select: { id: true } })) return 'Número já está com um agente.';
  }
  if (cnpj) {
    const fmt = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (await prisma.lead.findFirst({ where: { cnpj: { in: [cnpj, fmt] } }, select: { id: true } })) return 'CNPJ já é de um lead no CRM.';
    if (await prisma.cliente.findFirst({ where: { cnpj: { in: [cnpj, fmt] } }, select: { id: true } }).catch(() => null)) return 'CNPJ é de um cliente.';
  }
  return null;
}

/** Completa, confere o WhatsApp e cadastra os pendentes até a cota do dia. */
async function completarECadastrar(prisma: PrismaClient, cfg: ConfigHeitor, cota: number): Promise<number> {
  if (cota <= 0) return 0;
  const { obterInstanciaEmpresa } = await import('@/lib/whatsapp-empresa');
  const inst = await obterInstanciaEmpresa(prisma);
  if (!inst?.instance_token) throw new Error('WhatsApp da empresa desconectado: não dá para conferir os números.');
  const { verificarWhatsapp } = await import('./evolution.service');
  const segs = cfg.segmentos.map(s => s === 'padaria' ? 'Padaria' : 'Farmácia');
  // Melhores primeiro: mais avaliações = loja com movimento.
  const pendentes = await prisma.prospeccaoLocal.findMany({ where: { status: 'NOVO', segmento: { in: segs } }, orderBy: [{ avaliacoes: 'desc' }, { created_at: 'asc' }], take: Math.max(cota * 3, 30) });
  let feitos = 0;
  for (const p of pendentes) {
    if (feitos >= cota) break;
    // Site: redes, WhatsApp, e-mail e CNPJ.
    const html = p.site && /^https?:\/\//.test(p.site) && !/instagram\.com|facebook\.com/.test(p.site) ? await baixar(p.site) : '';
    const a = lerSite(html, p.site);
    const rf = a.cnpj ? await receita(a.cnpj) : null;
    const socios = Array.isArray(rf?.qsa) ? rf.qsa.map((s: any) => ({ nome: String(s.nome_socio || '').trim(), qualificacao: s.qualificacao_socio || null })).filter((s: any) => s.nome) : [];
    const emails = [...new Set([...((p.emails as string[]) || []), ...a.emails, ...(rf?.email ? [String(rf.email).toLowerCase()] : [])])].slice(0, 5);
    // Números candidatos: WhatsApp do site primeiro, depois o do Google (celular antes de fixo).
    const candidatos = [...new Set([a.whatsapp, p.telefone].filter(Boolean) as string[])].sort((x, y) => Number(ehCelular(y)) - Number(ehCelular(x)));
    const base = {
      emails, instagram: a.instagram || (p.site && /instagram\.com/.test(p.site) ? p.site : null), facebook: a.facebook || (p.site && /facebook\.com/.test(p.site) ? p.site : null),
      linkedin: a.linkedin, cnpj: a.cnpj, razao_social: rf?.razao_social || null, socios: socios.length ? socios : undefined,
      receita: rf ? { porte: rf.porte || null, abertura: rf.data_inicio_atividade || null, situacao: rf.descricao_situacao_cadastral || null, cnae: rf.cnae_fiscal_descricao || null } : undefined,
    };
    if (rf && rf.descricao_situacao_cadastral && !/ativa/i.test(rf.descricao_situacao_cadastral)) {
      await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: { ...base, status: 'FECHADO', motivo: `CNPJ ${rf.descricao_situacao_cadastral} na Receita.` } });
      continue;
    }
    const conhecido = await jaConhecido(prisma, candidatos, a.cnpj);
    if (conhecido) { await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: { ...base, status: 'JA_NO_CRM', motivo: conhecido } }); continue; }
    if (!candidatos.length) { await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: { ...base, status: 'SEM_WHATSAPP', tem_whatsapp: false, motivo: 'Sem telefone no Google nem no site.' } }); continue; }
    let wpp: string | null = null;
    try {
      const r = await verificarWhatsapp(inst.instance_token, candidatos);
      wpp = candidatos.find(n => r.get(n) === true) || null;
      if (!wpp && candidatos.every(n => !r.has(n))) throw new Error('sem resposta');
    } catch {
      await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: base }); // tenta de novo na próxima rodada
      throw new Error('A consulta de WhatsApp não respondeu. Tento de novo na próxima rodada.');
    }
    if (!wpp) { await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: { ...base, status: 'SEM_WHATSAPP', tem_whatsapp: false, motivo: 'Nenhum dos números tem WhatsApp.' } }); continue; }
    await cadastrar(prisma, inst.id, { ...p, ...base, socios, whatsapp: wpp });
    feitos++;
  }
  return feitos;
}

// Lead.link_origem é VARCHAR(191); links do Maps costumam passar disso (o completo fica em ProspeccaoLocal.maps_link).
// Longo demais → link curto oficial pelo place_id, que abre o mesmo lugar.
const LIMITE_LINK_ORIGEM = 191;
function linkOrigem(link: string | null | undefined, placeId: string | null | undefined): string | null {
  if (!link || link.length <= LIMITE_LINK_ORIGEM) return link || null;
  const curto = placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : '';
  return curto && curto.length <= LIMITE_LINK_ORIGEM ? curto : null;
}

async function cadastrar(prisma: PrismaClient, instanciaId: string, p: any) {
  const est: Estabelecimento = {
    nome: p.nome, segmento: p.segmento, cidade: p.cidade, bairro: p.bairro, uf: p.estado, endereco: p.endereco, telefone: p.telefone, whatsapp: p.whatsapp,
    site: p.site, emails: p.emails || [], instagram: p.instagram, facebook: p.facebook, linkedin: p.linkedin, cnpj: p.cnpj, razao_social: p.razao_social,
    socios: p.socios || [], abertura: p.receita?.abertura ? new Date(p.receita.abertura).toLocaleDateString('pt-BR') : null, porte: p.receita?.porte || null,
    nota: p.nota, avaliacoes: p.avaliacoes, horario: p.horario, maps_link: p.maps_link,
  };
  const obs = observacaoDoLead(est);
  const responsavel = responsavelDaReceita(p.socios);
  const lead = await prisma.lead.create({
    data: {
      nome: p.nome, nome_fantasia: p.nome, razao_social: p.razao_social, empresa: p.razao_social || p.nome, cnpj: p.cnpj, segmento: p.segmento,
      cidade: p.cidade, estado: p.estado, endereco: p.endereco, responsavel_nome: responsavel, telefone: p.whatsapp, responsavel_telefone: p.whatsapp,
      responsavel_email: p.emails?.[0] || null, email: p.emails?.[0] || null, origem: 'PROSPECCAO', temperatura: 'FRIO', etapa_sdr: 'NOVO_LEAD',
      utm_source: 'google_maps', campanha_nome: CAMPANHA_HEITOR, utm_campaign: CAMPANHA_HEITOR, plataforma: 'Google Maps', link_origem: linkOrigem(p.maps_link, p.place_id),
      observacoes: obs, created_by: 'heitor',
    } as any,
    select: { id: true },
  });
  await prisma.leadObservacao.create({ data: { lead_id: lead.id, tipo: 'SISTEMA', descricao: obs, created_by: 'heitor', created_by_name: 'Heitor (prospecção)' } }).catch(() => {});
  const conv = await prisma.whatsappConversa.create({
    data: { instanciaId, contato_numero: p.whatsapp, contato_nome: responsavel || p.nome, tipo_contato: 'LEAD', lead_id: lead.id, bot_ativo: false, nao_lidas: 0 },
    select: { id: true },
  });
  const sdr = await prisma.sdrLead.create({
    data: {
      agente: 'caroline', lead_id: lead.id, conversaId: conv.id, numero: p.whatsapp, nome: responsavel, empresa: p.nome, email: p.emails?.[0] || null,
      segmento: p.segmento, campanha: CAMPANHA_HEITOR, cadastro_em: new Date(), status: 'FILA', criado_por: 'heitor',
      dados: { prospeccao: true, cidade: p.cidade, bairro: p.bairro, nota_google: p.nota, avaliacoes: p.avaliacoes, instagram: p.instagram, site: p.site },
    },
    select: { id: true },
  });
  await prisma.prospeccaoLocal.update({ where: { id: p.id }, data: {
    status: 'CADASTRADO', tem_whatsapp: true, whatsapp: p.whatsapp, lead_id: lead.id, sdr_id: sdr.id, cadastrado_em: new Date(),
    emails: p.emails, instagram: p.instagram, facebook: p.facebook, linkedin: p.linkedin, cnpj: p.cnpj, razao_social: p.razao_social, socios: p.socios, receita: p.receita,
  } });
}

let rodando = false;
export const heitorRodando = () => rodando;

/**
 * Uma rodada: primeiro cadastra quem já foi encontrado e está pendente; se ainda faltar para a
 * cota do dia, busca o próximo bairro (até 4 bairros por rodada) e avança a posição.
 */
export async function rodadaHeitor(prisma: PrismaClient, agora = new Date()): Promise<{ cadastrados: number; encontrados: number; mensagem: string }> {
  if (rodando) return { cadastrados: 0, encontrados: 0, mensagem: 'O Heitor já está trabalhando.' };
  rodando = true;
  let cadastrados = 0, encontrados = 0;
  const cfg = await obterConfigHeitor(prisma);
  try {
    const hoje = await prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: { gte: inicioDoDia(agora) } } });
    let cota = cfg.cadastros_dia - hoje;
    if (cota <= 0) return { cadastrados: 0, encontrados: 0, mensagem: `Cota do dia cumprida (${cfg.cadastros_dia}).` };
    registrarAcaoAgente('heitor', 'conferindo quem já encontrou');
    cadastrados += await completarECadastrar(prisma, cfg, cota);
    cota -= cadastrados;
    for (let i = 0; i < 4 && cota > 0; i++) {
      const p = posicao(cfg);
      if (!p) { cfg.ultimo_erro = null; break; }
      if (!p.lugares) {
        cfg.lugares[`${p.cidade.nome}/${p.cidade.uf}`] = await lugaresDaCidade(prisma, p.cidade);
        cfg.cursor.lugar = 0;
        continue;
      }
      const lugar = p.lugar || p.cidade.nome;
      const qs = consultasDoLugar(lugar, p.cidade, cfg.segmentos);
      registrarAcaoAgente('heitor', `buscando em ${lugar === p.cidade.nome ? p.cidade.nome : `${lugar}, ${p.cidade.nome}`}`);
      // Cada busca leva uma etiqueta ("#!#id"), que volta em input_id: assim se sabe o segmento de cada resultado.
      const itens = await buscarNoMaps(qs.map((q, k) => `${q.texto} #!#q${k}`));
      const segmentoDe = new Map<string, string>(qs.map((q, k) => [`q${k}`, q.segmento]));
      encontrados += await registrarEncontrados(prisma, itens, { onda: p.onda.numero, regiao: p.onda.nome, cidade: p.cidade, bairro: lugar === p.cidade.nome ? null : lugar }, segmentoDe);
      avancar(cfg);
      await salvarConfigHeitor(prisma, { cursor: cfg.cursor, lugares: cfg.lugares });
      const n = await completarECadastrar(prisma, cfg, cota);
      cadastrados += n; cota -= n;
    }
    cfg.ultimo_erro = null;
    const msg = `Encontrou ${encontrados} estabelecimento(s) novo(s) e cadastrou ${cadastrados} lead(s) com WhatsApp.`;
    registrarAcaoAgente('heitor', msg);
    if (cadastrados) import('@/lib/assistente/conversas-agentes').then(m => m.registrarConversaAgentes('heitor', 'caroline', 'Leads novos da prospecção', [
      { quem: 'heitor', texto: `Carol, trouxe ${cadastrados} lead(s) novo(s) com WhatsApp, já com o máximo de informação.` },
      { quem: 'caroline', texto: 'Valeu, Heitor! Vou chamar um de cada vez, no ritmo seguro.' },
    ])).catch(() => {});
    return { cadastrados, encontrados, mensagem: msg };
  } catch (e: any) {
    cfg.ultimo_erro = String(e?.message || e).slice(0, 300);
    registrarAcaoAgente('heitor', `parou: ${cfg.ultimo_erro}`);
    return { cadastrados, encontrados, mensagem: cfg.ultimo_erro };
  } finally {
    await salvarConfigHeitor(prisma, { cursor: cfg.cursor, lugares: cfg.lugares, ultima_rodada: new Date().toISOString(), ultimo_erro: cfg.ultimo_erro }).catch(() => {});
    rodando = false;
  }
}

/** Agendador: dias úteis, das 7h às 18h (Brasília), no máximo uma rodada por hora, até a cota do dia. */
export async function rodarHeitor(prisma: PrismaClient, agora = new Date()) {
  const cfg = await obterConfigHeitor(prisma);
  if (!cfg.ativo || rodando) return;
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const dia = partes.find(p => p.type === 'weekday')?.value, hora = Number(partes.find(p => p.type === 'hour')?.value);
  if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dia || '') || hora < 7 || hora >= 18) return;
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  if (!(await podeEnviarUmaVez(prisma, 'heitor.rodada', 0.9))) return;
  rodadaHeitor(prisma, agora).catch((e: any) => console.error('[HEITOR]', e?.message));
}

/** Quantos leads do Heitor a Caroline já abordou hoje (o primeiro contato respeita envios_dia). */
export async function enviadosHeitorHoje(prisma: PrismaClient, agora = new Date()) {
  return prisma.sdrLead.count({ where: { criado_por: 'heitor', primeiro_envio_em: { gte: inicioDoDia(agora) } } });
}

export async function painelHeitor(prisma: PrismaClient) {
  const cfg = await obterConfigHeitor(prisma);
  const p = posicao(cfg);
  const hoje = inicioDoDia();
  const [porStatus, cadastradosHoje, enviadosHoje, naFila, recentes] = await Promise.all([
    prisma.prospeccaoLocal.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: { gte: hoje } } }),
    enviadosHeitorHoje(prisma),
    prisma.sdrLead.count({ where: { criado_por: 'heitor', status: 'FILA' } }),
    prisma.prospeccaoLocal.findMany({ orderBy: { updated_at: 'desc' }, take: 60, select: {
      id: true, nome: true, segmento: true, cidade: true, bairro: true, status: true, motivo: true, whatsapp: true, telefone: true, nota: true, avaliacoes: true,
      instagram: true, site: true, emails: true, cnpj: true, razao_social: true, lead_id: true, updated_at: true,
    } }),
  ]);
  const { obterConfigAgente } = await import('./caroline.service');
  const carol = await obterConfigAgente(prisma, 'caroline');
  const totalCidades = ONDAS.reduce((a, o) => a + o.cidades.length, 0);
  const feitas = ONDAS.slice(0, cfg.cursor.onda).reduce((a, o) => a + o.cidades.length, 0) + (p ? cfg.cursor.cidade : 0);
  return {
    config: { ativo: cfg.ativo, cadastros_dia: cfg.cadastros_dia, envios_dia: cfg.envios_dia, segmentos: cfg.segmentos, ultima_rodada: cfg.ultima_rodada, ultimo_erro: cfg.ultimo_erro },
    rodando,
    posicao: p ? { onda: p.onda.numero, regiao: p.onda.nome, cidade: `${p.cidade.nome}/${p.cidade.uf}`, bairro: p.lugar, bairros_total: p.lugares?.length || null, bairro_numero: p.lugares ? cfg.cursor.lugar + 1 : null } : null,
    progresso: { cidades_feitas: feitas, cidades_total: totalCidades },
    ondas: ONDAS.map((o, i) => ({ numero: o.numero, nome: o.nome, cidades: o.cidades.length, situacao: i < cfg.cursor.onda ? 'feita' : i === cfg.cursor.onda ? 'em andamento' : 'próxima' })),
    por_status: Object.fromEntries(porStatus.map(s => [s.status, s._count._all])),
    hoje: { cadastrados: cadastradosHoje, enviados: enviadosHoje, na_fila_caroline: naFila },
    caroline: { ativa: carol.ativa, aprovar: carol.aprovar },
    recentes,
  };
}
