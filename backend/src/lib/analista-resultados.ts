// Analista de Resultados (pedido da Jessica, 21/10/2026): regras puras do relatório de sexta.
// Quem coleta os dados e chama a IA é services/analista-resultados.service.ts.

/** Status do agente que contam como avanço real ("respondeu" sozinho inclui robô de loja). */
export const AVANCO = ['CONVERSANDO', 'DEMO', 'VENDEDORA', 'HUMANO'];

/** Sistemas de gestão/PDV citados pelos leads (farmácia, manipulação, padaria e varejo). Chave = nome exibido. */
export const SISTEMAS: Record<string, RegExp> = {
  'Trier': /\btrier\b/i, 'Digifarma': /digi\s?farma/i, 'Inovafarma': /inova\s?farma/i, 'Vetor Farma': /\bvetor\b/i,
  'Alpha7': /alpha\s?7/i, 'Linx (Big)': /\blinx\b|big\s?farma/i, 'Siaf': /\bsiaf\b/i, 'Farmax': /farmax/i,
  'Sysfar': /sysfar/i, 'Prismafive': /prisma\s?five/i, 'Fórmula Certa': /f[oó]rmula\s?certa/i, 'PharmaSys': /pharma\s?sys/i,
  'Consys': /\bconsys\b/i, 'HOS': /\bhos\b/i, 'Gdoor': /gdoor/i, 'Hiper': /\bhiper\b/i, 'Bling': /\bbling\b/i, 'Tiny/Olist': /\btiny\b|olist/i,
  'Omie': /\bomie\b/i, 'Conta Azul': /conta\s?azul/i, 'Totvs': /totvs/i, 'Saipos': /saipos/i, 'Consumer': /\bconsumer\b/i,
  'Sischef': /sischef/i, 'Bluesoft': /bluesoft/i, 'Lince': /\blince\b/i, 'Gestor Farma': /gestor\s?farma/i, 'SoftPharma': /soft\s?pharma/i,
  'Clipp': /\bclipp\b/i, 'Evolução Sistemas': /evolu[cç][aã]o\s?sistemas?/i, 'Intellitools': /intellitools/i, 'LF Pharma': /\blf\s?pharma/i,
  'Catedral': /\bcatedral\b/i, 'Brajan': /\bbrajan\b/i, 'Planilha/caderno': /planilha|caderno|excel|no papel/i,
};

/** Sistemas citados num texto livre (conversa do cliente, ficha do agente, cadastro do lead ou proposta). */
export function sistemasNoTexto(texto: string | null | undefined): string[] {
  const t = texto || '';
  return Object.entries(SISTEMAS).filter(([, re]) => re.test(t)).map(([nome]) => nome);
}

export type LinhaRanking = { chave: string; contatados: number; responderam: number; avancaram: number; taxa_resposta: number; taxa_avanco: number };

/** Agrupa os contatados e mede resposta e avanço por grupo (agente, segmento, cidade, hora...). */
export function rankingRetorno<T>(lista: T[], grupo: (x: T) => string | null | undefined, respondeu: (x: T) => boolean, avancou: (x: T) => boolean): LinhaRanking[] {
  const g = new Map<string, LinhaRanking>();
  for (const x of lista) {
    const k = (grupo(x) || '').trim() || 'não informado';
    const r = g.get(k) || { chave: k, contatados: 0, responderam: 0, avancaram: 0, taxa_resposta: 0, taxa_avanco: 0 };
    r.contatados++;
    if (respondeu(x)) r.responderam++;
    if (avancou(x)) r.avancaram++;
    g.set(k, r);
  }
  return [...g.values()].map(r => ({ ...r, taxa_resposta: pct(r.responderam, r.contatados), taxa_avanco: pct(r.avancaram, r.contatados) }))
    .sort((a, b) => b.contatados - a.contatados);
}

export const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

/** Pedido claro de compra na fala do cliente: preço, proposta, "quero começar", pessoa da equipe, prazo para fechar. */
const SINAL_COMPRA = /\b((qual|o|os|me passa|falar o|saber o)\s+(valor|valores|pre[cç]o|pre[cç]os)|quanto custa|or[cç]amento|proposta|quero come[cç]ar|quero (contratar|fechar|conhecer|saber mais)|fechar|taxa de instala[cç][aã]o|demonstra[cç][aã]o|alguém para conversar|falar com (uma )?pessoa|me liga|ainda (n[aã]o resolvemos|procuro|estou em busca|na procura))\b/i;

export function temSinalDeCompra(textoCliente: string | null | undefined): boolean {
  return SINAL_COMPRA.test(textoCliente || '');
}

export type Temperatura = 'QUENTE' | 'MORNO' | 'FRIO';

/**
 * Temperatura do analista (mais dura que o termômetro do agente): QUENTE = proposta na mão ou pedido de preço/pessoa
 * nos últimos 14 dias; MORNO = demonstração pedida, conversa com a equipe ou sinal de compra; FRIO = o resto.
 */
export function temperaturaAnalista(x: { status: string; nota: number | null; temProposta: boolean; sinalCompra: boolean; diasDesdeCliente: number | null }): Temperatura {
  const recente = x.diasDesdeCliente != null && x.diasDesdeCliente <= 14;
  if (recente && (x.temProposta || (x.sinalCompra && ['VENDEDORA', 'HUMANO'].includes(x.status)))) return 'QUENTE';
  if ((x.nota ?? 0) >= 35 || x.temProposta || x.sinalCompra || ['DEMO', 'VENDEDORA', 'HUMANO'].includes(x.status)) return 'MORNO';
  return 'FRIO';
}

/** Retorno combinado (dados.retomar_em) que venceu há mais de 2 h sem mensagem do agente depois dele. */
export function retornoAtrasado(retomarEm: string | Date | null | undefined, ultimaDoAgente: Date | null, agora: Date): boolean {
  if (!retomarEm) return false;
  const quando = new Date(retomarEm);
  if (Number.isNaN(quando.getTime()) || agora.getTime() - quando.getTime() < 2 * 3600e3) return false;
  return !ultimaDoAgente || ultimaDoAgente < quando;
}

/** Tira e-mail e telefone de um trecho de conversa antes de mandá-lo à IA ou ao relatório. */
export function semContato(texto: string | null | undefined): string {
  return String(texto || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
    .replace(/\+?\(?\d[\d\s().-]{8,}\d/g, '[número]');
}

export type ResumoWhatsapp = {
  semana: string; contatados: number; humanos: number; avancaram: number; propostas: number; contratos: number;
  quentes: { empresa: string }[]; mornos: number; propostasParadas: number; mensalidadeParada: number; principal: string | null; link: string;
};

/** Mensagem curta para o WhatsApp da gestão; o relatório completo fica no CRM (link). */
export function mensagemWhatsapp(r: ResumoWhatsapp): string {
  const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  return [
    `📈 *Analista de Resultados · semana de ${r.semana}*`,
    `• Lojas contatadas: ${r.contatados} · responderam como pessoa: ${r.humanos} · avançaram: ${r.avancaram}`,
    `• Propostas novas: ${r.propostas} · contratos: ${r.contratos}`,
    r.quentes.length ? `🔥 Quentes (ligar hoje): ${r.quentes.slice(0, 5).map(q => q.empresa).join(', ')}${r.quentes.length > 5 ? ` e mais ${r.quentes.length - 5}` : ''}` : '🔥 Nenhum lead quente nesta semana.',
    `🌤️ Mornos: ${r.mornos}`,
    r.propostasParadas ? `📄 Propostas paradas para reativar: ${r.propostasParadas} (${brl(r.mensalidadeParada)}/mês)` : '',
    r.principal ? `\n💡 ${r.principal}` : '',
    `\nRelatório completo, com a lista clicável e o plano: ${r.link}`,
  ].filter(Boolean).join('\n');
}
