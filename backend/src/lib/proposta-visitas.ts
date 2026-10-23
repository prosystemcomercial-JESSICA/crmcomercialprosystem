// Comportamento do cliente na proposta (pedido da Jessica, 23/10/2026): "monitorar para entender
// se o cliente vê tudo ou se vai direto para os valores; quantas vezes abre e fecha, quanto tempo fica".
// O link do cliente (?modo=cliente e ?modo=express) manda a cada 15 s o tempo por tela da visita
// (POST /p/:token/rastro). Aqui fica a parte pura: validar o que chega e resumir as visitas.
// A equipe (navegador com login no CRM) não é gravada.

/** Telas do deck (índice do slide em app/p/[...token]/route.ts). -1 = escolha da versão; 100 = proposta express. */
export const NOMES_TELAS: Record<number, string> = {
  [-1]: 'Escolha da versão',
  0: 'Capa',
  1: 'Quem somos',
  2: 'O desafio do varejo',
  3: 'A solução',
  4: 'Menu de módulos',
  5: 'Gestão: visão geral',
  6: 'Gestão: frente de caixa',
  7: 'Gestão: reposição e estoque',
  8: 'Gestão: operação integrada',
  9: 'Financeiro: onde está o dinheiro',
  10: 'Financeiro: o negócio em uma tela',
  11: 'Financeiro: margem por produto',
  12: 'Financeiro: decisões com dados',
  13: 'Suporte',
  14: 'Suporte: 7h às 22h',
  15: 'Treinamento de 5 meses',
  16: 'Vendemos resultado',
  17: 'Comparativo de planos',
  18: 'Valores da proposta',
  19: 'Formas de pagamento',
  20: 'Validade e aceite',
  21: 'Ferramentas',
  22: 'Ecossistema',
  23: 'Prova social',
  24: 'Chamada final',
  100: 'Proposta direta (express)',
};

export type Grupo = 'escolha' | 'apresentacao' | 'modulos' | 'valores' | 'fechamento';
export const NOMES_GRUPOS: Record<Grupo, string> = {
  escolha: 'Escolha da versão', apresentacao: 'Apresentação da Prosystem', modulos: 'Módulos e suporte',
  valores: 'Planos e valores', fechamento: 'Fechamento',
};
export function grupoDaTela(t: number): Grupo {
  if (t === -1) return 'escolha';
  if (t >= 17 && t <= 20) return 'valores';
  if (t === 100) return 'valores';
  if (t <= 3) return 'apresentacao';
  if (t >= 23) return 'fechamento';
  return 'modulos';
}
/** Ordem da versão completa (ORDEM_COMPLETA do deck). */
export const ORDEM_COMPLETA = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 17, 18, 19, 20, 23, 24];

/** Tempo mínimo numa tela para contar como "viu". */
export const SEGUNDOS_VIU = 3;

export type Rastro = {
  sessao: string;
  origem: 'cliente' | 'express';
  versao: 'completa' | 'simples' | null;
  dispositivo: 'celular' | 'computador' | null;
  segundos: number;
  telas: Record<string, number>;
  caminho: number[];
  eventos: { s: number; t: number; a: string }[];
};

const telaValida = (t: unknown): t is number => Number.isInteger(t) && ((t as number) === -1 || (t as number) === 100 || ((t as number) >= 0 && (t as number) <= 30));
const segundosValidos = (n: unknown) => Number.isFinite(n) ? Math.max(0, Math.min(86400, Math.round(n as number))) : 0;

/** Valida o corpo enviado pelo navegador (texto JSON ou objeto). Devolve null se não servir. */
export function lerRastro(corpo: unknown): Rastro | null {
  let b: any = corpo;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return null; } }
  if (!b || typeof b !== 'object') return null;
  if (typeof b.sessao !== 'string' || !/^[a-z0-9]{6,40}$/.test(b.sessao)) return null;
  const telas: Record<string, number> = {};
  if (b.telas && typeof b.telas === 'object') {
    for (const [k, v] of Object.entries(b.telas).slice(0, 40)) {
      const t = Number(k);
      if (telaValida(t)) telas[String(t)] = segundosValidos(v);
    }
  }
  const caminho = Array.isArray(b.caminho) ? b.caminho.filter(telaValida).slice(-300) : [];
  const eventos = Array.isArray(b.eventos)
    ? b.eventos.slice(0, 200).filter((e: any) => e && typeof e.a === 'string' && e.a.trim())
      .map((e: any) => ({ s: segundosValidos(e.s), t: telaValida(e.t) ? e.t : 0, a: e.a.replace(/\s+/g, ' ').trim().slice(0, 60) }))
    : [];
  return {
    sessao: b.sessao,
    origem: b.origem === 'express' ? 'express' : 'cliente',
    versao: b.versao === 'simples' || b.versao === 'completa' ? b.versao : null,
    dispositivo: b.dispositivo === 'celular' || b.dispositivo === 'computador' ? b.dispositivo : null,
    segundos: segundosValidos(b.segundos),
    telas, caminho, eventos,
  };
}

export type Visita = {
  inicio: Date; ultimo_sinal: Date; segundos: number; origem: string; versao: string | null; dispositivo: string | null;
  telas: unknown; caminho: unknown; eventos: unknown;
};

const telasDe = (v: Visita): Record<string, number> => (v.telas && typeof v.telas === 'object' ? v.telas as Record<string, number> : {});
const caminhoDe = (v: Visita): number[] => (Array.isArray(v.caminho) ? v.caminho as number[] : []);
const eventosDe = (v: Visita): { s: number; t: number; a: string }[] => (Array.isArray(v.eventos) ? v.eventos as any[] : []);
const nomeTela = (t: number) => NOMES_TELAS[t] || `Tela ${t}`;

export function fmtDuracao(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const m = Math.round(seg / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Primeira tela de conteúdo em que o cliente parou (ignora a escolha da versão). */
function primeiraParada(v: Visita): number | null {
  const tl = telasDe(v);
  for (const t of caminhoDe(v)) if (t !== -1 && (tl[String(t)] || 0) >= SEGUNDOS_VIU) return t;
  return null;
}

export function resumirVisitas(visitas: Visita[]) {
  const vs = [...visitas].sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  const total = vs.reduce((s, v) => s + (v.segundos || 0), 0);
  const porTela = new Map<number, { segundos: number; visitas: number }>();
  const grupos: Record<Grupo, number> = { escolha: 0, apresentacao: 0, modulos: 0, valores: 0, fechamento: 0 };
  for (const v of vs) {
    for (const [k, s] of Object.entries(telasDe(v))) {
      const t = Number(k), atual = porTela.get(t) || { segundos: 0, visitas: 0 };
      atual.segundos += s; if (s >= SEGUNDOS_VIU) atual.visitas++;
      porTela.set(t, atual);
      grupos[grupoDaTela(t)] += s;
    }
  }
  const primeira = vs[0] ? primeiraParada(vs[0]) : null;
  const foiDiretoAosValores = !!vs[0] && (vs[0].versao === 'simples' || vs[0].origem === 'express' || (primeira !== null && grupoDaTela(primeira) === 'valores'));
  const viuCompleta = vs.some(v => v.versao === 'completa');
  const naoVistas = viuCompleta ? ORDEM_COMPLETA.filter(t => (porTela.get(t)?.visitas || 0) === 0).map(nomeTela) : [];
  const telaMaisTempo = [...porTela.entries()].filter(([t]) => t !== -1).sort((a, b) => b[1].segundos - a[1].segundos)[0];
  const cliques = vs.flatMap((v, i) => eventosDe(v).map(e => ({ visita: i + 1, tela: nomeTela(e.t), acao: e.a })));

  const leitura: string[] = [];
  if (vs.length) {
    leitura.push(`Abriu ${vs.length} ${vs.length === 1 ? 'vez' : 'vezes'}, ${fmtDuracao(total)} no total.`);
    if (foiDiretoAosValores) leitura.push('Foi direto aos valores na primeira abertura.');
    if (total > 0 && grupos.valores > 0) leitura.push(`Passou ${fmtDuracao(grupos.valores)} nos planos e valores (${Math.round(100 * grupos.valores / total)}% do tempo).`);
    if (telaMaisTempo) leitura.push(`Tela em que mais ficou: ${nomeTela(telaMaisTempo[0])} (${fmtDuracao(telaMaisTempo[1].segundos)}).`);
    if (viuCompleta && naoVistas.length) leitura.push(naoVistas.length === ORDEM_COMPLETA.length ? 'Não passou da abertura.' : `Não viu ${naoVistas.length} de ${ORDEM_COMPLETA.length} telas da apresentação.`);
    if (vs.length > 1) leitura.push(`Voltou à proposta ${vs.length - 1} ${vs.length - 1 === 1 ? 'vez' : 'vezes'} depois da primeira.`);
  }

  return {
    aberturas: vs.length,
    segundos_total: total,
    primeira_abertura: vs[0]?.inicio ?? null,
    ultima_atividade: vs.length ? vs.reduce((m, v) => (+new Date(v.ultimo_sinal) > +m ? new Date(v.ultimo_sinal) : m), new Date(0)) : null,
    foi_direto_aos_valores: foiDiretoAosValores,
    grupos: (Object.keys(grupos) as Grupo[]).filter(g => grupos[g] > 0).map(g => ({ grupo: g, nome: NOMES_GRUPOS[g], segundos: grupos[g] })),
    telas: [...porTela.entries()].sort((a, b) => a[0] - b[0]).map(([t, x]) => ({ tela: t, nome: nomeTela(t), grupo: grupoDaTela(t), ...x })),
    nao_vistas: naoVistas,
    leitura,
    cliques: cliques.slice(-40),
    visitas: vs.map((v, i) => ({
      n: i + 1, inicio: v.inicio, segundos: v.segundos, versao: v.versao, origem: v.origem, dispositivo: v.dispositivo,
      caminho: caminhoDe(v).filter(t => (telasDe(v)[String(t)] || 0) >= 1).map(nomeTela).slice(0, 60),
      primeira_tela: (() => { const p = primeiraParada(v); return p === null ? null : nomeTela(p); })(),
    })).reverse(),
  };
}

/** Aviso para a gestão quando o cliente volta à proposta. */
export function textoAvisoVolta(nome: string, numeroVisita: number, anteriores: Visita[], vendedora?: string | null): string {
  const r = resumirVisitas(anteriores);
  const valores = r.grupos.find(g => g.grupo === 'valores')?.segundos || 0;
  return `🔁 *${nome} voltou à proposta* (${numeroVisita}ª abertura)\n` +
    `Até agora: ${fmtDuracao(r.segundos_total)} no total${valores ? `, ${fmtDuracao(valores)} nos valores` : ''}.` +
    (vendedora ? `\nVendedora: ${vendedora}` : '') +
    `\nEstá com a proposta aberta agora: ótima hora para chamar no WhatsApp.`;
}
