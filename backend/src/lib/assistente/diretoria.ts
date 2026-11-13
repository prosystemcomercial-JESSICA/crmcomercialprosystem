// Diretoria dos agentes (pedido da Jessica, 13/11/2026). Puro: regras sem banco nem IA.
//  - Vitória (CEO): metas, plano comercial, leitura dos resultados no contexto geral e providências, com
//    liberdade total (aplica sozinha e avisa; tudo o que ela faz pode ser desfeito no painel).
//  - Gustavo (gerente de Entrada de leads e Vendas) e Renata (gerente de Clientes e Inteligência): conferem os
//    números de cada agente todo dia útil e cobram quem está errando muito, numa escada: cobrança por escrito →
//    treino com o Rafael → leva para a Vitória decidir.
//  - Rafael + Laya: boletim semanal com a nota de cada agente, que vai para a Vitória.
// Nenhum dos três fala com cliente. As regras fixas da casa (proteção do WhatsApp, nunca apagar lead, nunca criar
// atividade automática, pessoa assumiu a conversa = agente fora) valem acima de qualquer decisão deles.

export const DIRETORIA = ['vitoria', 'gustavo', 'renata'] as const;
export type Diretor = typeof DIRETORIA[number];
export type Gerente = 'gustavo' | 'renata';

/** Setores que cada gerente cobra (os mesmos de escritorio-setores). */
export const SETORES_DO_GERENTE: Record<Gerente, string[]> = { gustavo: ['entrada', 'vendas'], renata: ['clientes', 'inteligencia'] };
export const NOME_DIRETOR: Record<Diretor, string> = { vitoria: 'Vitória', gustavo: 'Gustavo', renata: 'Renata' };

/** Agentes que conversam com cliente e podem ser pausados ou treinados pelo Rafael. */
export const SDRS_DIRETORIA = ['caroline', 'julio', 'luiz_felipe'] as const;
export const ehSdr = (id: string): id is typeof SDRS_DIRETORIA[number] => (SDRS_DIRETORIA as readonly string[]).includes(id);

export type Decididas = { sozinha: number; aprovada: number; editada: number; descartada: number; segurada_laya: number };
export type NumerosAgente = {
  id: string;
  /** Mensagens enviadas a clientes em 7 dias (0 para quem não fala com cliente). */
  mensagens: number;
  /** Como as mensagens dos SDRs saíram em 7 dias. */
  decididas?: Decididas | null;
  /** Chamadas de IA em 7 dias e quantas falharam (sinal técnico: não gera cobrança). */
  ia: { chamadas: number; falhas: number };
  /** Nota do boletim do Rafael + Laya (0 a 10), quando houver. */
  nota?: number | null;
  /** O que o boletim disse para melhorar. */
  melhorar?: string | null;
};

export const LIMITES = {
  amostraMin: 8,      // mensagens decididas mínimas para medir a taxa de erro
  erroAtencao: 0.25, erroCritico: 0.4,
  iaMin: 5, iaAtencao: 0.3, iaCritico: 0.6,
  notaAtencao: 6, notaCritico: 4,
};

export type Nivel = 'ok' | 'atencao' | 'critico';
export type Avaliacao = { id: string; nivel: Nivel; sinais: string[]; taxa_erro: number | null; tecnico: string | null };

const pior = (a: Nivel, b: Nivel): Nivel => (a === 'critico' || b === 'critico' ? 'critico' : a === 'atencao' || b === 'atencao' ? 'atencao' : 'ok');
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Nível do agente pelos números da semana. Conta para a cobrança: mensagens corrigidas, descartadas ou
 * seguradas pela Laya (SDRs) e a nota do boletim. Falha de IA é problema técnico: vai em `tecnico`, sem cobrança.
 */
export function avaliarAgente(n: NumerosAgente, L = LIMITES): Avaliacao {
  let nivel: Nivel = 'ok';
  const sinais: string[] = [];
  let taxa: number | null = null;
  const d = n.decididas;
  if (d) {
    const total = d.sozinha + d.aprovada + d.editada + d.descartada;
    if (total >= L.amostraMin) {
      // Segurada pela Laya não entra na conta (13/11/2026, visto em produção): ela vai para o Rafael, que descarta
      // (já conta como descartada) ou aprova (não era erro). Somar seria contar duas vezes e punir alarme falso.
      taxa = (d.editada + d.descartada) / total;
      if (taxa >= L.erroAtencao) {
        nivel = pior(nivel, taxa >= L.erroCritico ? 'critico' : 'atencao');
        const partes = [d.editada && `${d.editada} corrigida(s)`, d.descartada && `${d.descartada} descartada(s)`].filter(Boolean);
        sinais.push(`${pct(taxa)} das mensagens com problema (${partes.join(', ')} de ${total}${d.segurada_laya ? `; a Laya segurou ${d.segurada_laya} para conferir` : ''})`);
      }
    }
  }
  if (typeof n.nota === 'number' && n.nota < L.notaAtencao) {
    nivel = pior(nivel, n.nota < L.notaCritico ? 'critico' : 'atencao');
    sinais.push(`nota ${n.nota}/10 no boletim do Rafael e da Laya${n.melhorar ? ` (${n.melhorar})` : ''}`);
  }
  let tecnico: string | null = null;
  if (n.ia.chamadas >= L.iaMin && n.ia.falhas / n.ia.chamadas >= L.iaAtencao) tecnico = `${pct(n.ia.falhas / n.ia.chamadas)} das chamadas de IA falharam (${n.ia.falhas} de ${n.ia.chamadas})`;
  return { id: n.id, nivel, sinais, taxa_erro: taxa, tecnico };
}

/** Degrau da escada de cobrança de um agente. 1 = cobrado, 2 = treinado, 3 = levado à Vitória. */
export type Degrau = { nivel: 1 | 2 | 3; desde: string; ultima_em: string; motivo: string };
export type PassoGerente = 'nada' | 'cobrar' | 'treinar' | 'escalar' | 'zerar';

const DIA = 864e5;
/** Tempo para o agente reagir antes do próximo degrau. */
export const PRAZO_DEGRAU = { cobrar: 2 * DIA, treinar: 3 * DIA, reescalar: 7 * DIA, zerar: 7 * DIA };

/**
 * O que o gerente faz hoje com o agente. Ok por 7 dias seguidos zera a escada. Com problema: cobra; se em 2 dias
 * continuar, pede treino ao Rafael; se em mais 3 dias continuar, leva para a Vitória (e lembra a cada 7 dias).
 */
export function proximoPasso(atual: Degrau | undefined, av: Avaliacao, agora: Date): PassoGerente {
  const desde = (iso: string) => agora.getTime() - new Date(iso).getTime();
  if (av.nivel === 'ok') return atual && desde(atual.ultima_em) >= PRAZO_DEGRAU.zerar ? 'zerar' : 'nada';
  if (!atual) return 'cobrar';
  if (atual.nivel === 1) return desde(atual.ultima_em) >= PRAZO_DEGRAU.cobrar ? 'treinar' : 'nada';
  if (atual.nivel === 2) return desde(atual.ultima_em) >= PRAZO_DEGRAU.treinar ? 'escalar' : 'nada';
  return desde(atual.ultima_em) >= PRAZO_DEGRAU.reescalar ? 'escalar' : 'nada';
}

export function degrauDepois(passo: PassoGerente, atual: Degrau | undefined, motivo: string, agora: Date): Degrau | undefined {
  const iso = agora.toISOString();
  if (passo === 'zerar') return undefined;
  if (passo === 'nada') return atual;
  const nivel = passo === 'cobrar' ? 1 : passo === 'treinar' ? 2 : 3;
  return { nivel, desde: atual && atual.nivel === nivel ? atual.desde : iso, ultima_em: iso, motivo: motivo.slice(0, 300) };
}

/** O que corrigir, tirado dos sinais (sem IA): vai junto da cobrança. */
export function oQueFazer(av: Avaliacao, melhorar?: string | null): string {
  const itens: string[] = [];
  if (melhorar) itens.push(melhorar);
  if (av.taxa_erro !== null && av.taxa_erro >= LIMITES.erroAtencao) itens.push('releia a conversa inteira antes de escrever, responda ao que o cliente disse por último e siga as regras do seu treino; mensagem que precisa de correção atrasa o cliente');
  if (!itens.length) itens.push('siga as orientações do Rafael e as regras do seu treino');
  return itens.join('; ');
}

export function textoCobranca(gerente: Gerente, nomeAgente: string, av: Avaliacao, melhorar?: string | null): string {
  return [
    `${nomeAgente}, aqui é ${gerente === 'gustavo' ? 'o Gustavo' : 'a Renata'}, ${gerente === 'gustavo' ? 'seu gerente' : 'sua gerente'}. Olhei seus números desta semana: ${av.sinais.join('; ')}.`,
    `O que eu espero a partir de agora: ${oQueFazer(av, melhorar)}.`,
    'Vou conferir de novo em 2 dias úteis. Se continuar assim, peço um treino com o Rafael.',
  ].join(' ');
}

// ───────────────────────── Metas dos agentes ─────────────────────────

/** Indicadores que o sistema sabe medir sozinho. A Vitória só pode dar meta com eles. */
export const INDICADORES = {
  leads_cadastrados: { rotulo: 'leads cadastrados', agentes: ['heitor'] },
  demos_marcadas: { rotulo: 'demonstrações marcadas', agentes: ['caroline', 'julio', 'lurdinha'] },
  mensagens_enviadas: { rotulo: 'mensagens enviadas a clientes', agentes: ['caroline', 'julio', 'luiz_felipe', 'bia', 'clarice', 'otavio'] },
  acerto_pct: { rotulo: '% de mensagens sem correção', agentes: ['caroline', 'julio', 'luiz_felipe'] },
  contratos_fechados: { rotulo: 'contratos fechados (equipe)', agentes: ['equipe'] },
} as const;
export type IndicadorId = keyof typeof INDICADORES;
export type MetaAgente = { agente: string; indicador: IndicadorId; alvo: number };

// ───────────────────────── Plano da Vitória ─────────────────────────

export type Providencia =
  | { tipo: 'orientar'; agente: string; texto: string }
  | { tipo: 'regra'; agente: string; texto: string }
  | { tipo: 'pausar'; agente: string; dias: number; motivo: string }
  | { tipo: 'treinar'; agente: string; foco: string | null }
  | { tipo: 'meta_agente'; agente: string; indicador: IndicadorId; alvo: number }
  | { tipo: 'meta_vendedora'; vendedor_id: string; contratos: number | null; valor_total: number | null };

export type PlanoVitoria = {
  diagnostico: string;
  prioridades: string[];
  plano: string;
  providencias: Providencia[];
  resumo_whatsapp: string;
};

export const MAX_PROVIDENCIAS = 12;
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[—–]/g, ',').trim().slice(0, n);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

/**
 * Lê o JSON da Vitória e deixa passar só o que pode ser aplicado com segurança: agente que existe, pausa só para
 * quem conversa com cliente (1 a 3 dias, ele volta sozinho), treino só para SDR, meta só com indicador medível e
 * alvo positivo, meta de vendedora só para vendedora ativa.
 */
export function lerPlanoVitoria(j: any, ctx: { agentes: string[]; vendedoras: string[] }): PlanoVitoria {
  const agentes = new Set([...ctx.agentes, 'equipe']);
  const vend = new Set(ctx.vendedoras);
  const providencias: Providencia[] = [];
  for (const p of Array.isArray(j?.providencias) ? j.providencias : []) {
    if (providencias.length >= MAX_PROVIDENCIAS) break;
    const agente = txt(p?.agente, 40);
    switch (p?.tipo) {
      case 'orientar': case 'regra': {
        const texto = txt(p.texto, 500);
        if (agentes.has(agente) && texto.length >= 10) providencias.push({ tipo: p.tipo, agente, texto });
        break;
      }
      case 'pausar': {
        const dias = Math.round(num(p.dias));
        if (ehSdr(agente) && dias >= 1) providencias.push({ tipo: 'pausar', agente, dias: Math.min(dias, 3), motivo: txt(p.motivo, 200) || 'decisão da Vitória' });
        break;
      }
      case 'treinar':
        if (ehSdr(agente)) providencias.push({ tipo: 'treinar', agente, foco: txt(p.foco, 300) || null });
        break;
      case 'meta_agente': {
        const ind = p.indicador as IndicadorId;
        const alvo = num(p.alvo);
        const def = INDICADORES[ind];
        if (def && (def.agentes as readonly string[]).includes(agente) && alvo > 0 && !(ind === 'acerto_pct' && alvo > 100)) providencias.push({ tipo: 'meta_agente', agente, indicador: ind, alvo: Math.round(alvo) });
        break;
      }
      case 'meta_vendedora': {
        const vendedor_id = txt(p.vendedor_id, 64);
        const contratos = num(p.contratos), valor = num(p.valor_total);
        const c = contratos > 0 ? Math.round(contratos) : null, v = valor > 0 ? Math.round(valor) : null;
        if (vend.has(vendedor_id) && (c || v)) providencias.push({ tipo: 'meta_vendedora', vendedor_id, contratos: c, valor_total: v });
        break;
      }
    }
  }
  return {
    diagnostico: txt(j?.diagnostico, 3000),
    prioridades: (Array.isArray(j?.prioridades) ? j.prioridades : []).map((x: unknown) => txt(x, 300)).filter(Boolean).slice(0, 5),
    plano: txt(j?.plano, 6000),
    providencias,
    resumo_whatsapp: txt(j?.resumo_whatsapp, 900),
  };
}

/** Uma linha legível da providência (painel, WhatsApp e documento). */
export function descreverProvidencia(p: Providencia, nome: (id: string) => string): string {
  switch (p.tipo) {
    case 'orientar': return `Orientou ${nome(p.agente)}: ${p.texto}`;
    case 'regra': return `Regra nova para ${nome(p.agente)}: ${p.texto}`;
    case 'pausar': return `Pausou ${nome(p.agente)} por ${p.dias} dia(s): ${p.motivo}`;
    case 'treinar': return `Pediu ao Rafael um treino de ${nome(p.agente)}${p.foco ? ` (foco: ${p.foco})` : ''}`;
    case 'meta_agente': return `Meta do mês para ${nome(p.agente)}: ${p.alvo}${p.indicador === 'acerto_pct' ? '%' : ''} ${INDICADORES[p.indicador].rotulo}`;
    case 'meta_vendedora': return `Meta do mês para ${nome(p.vendedor_id)}: ${[p.contratos && `${p.contratos} contrato(s)`, p.valor_total && `R$ ${p.valor_total.toLocaleString('pt-BR')}`].filter(Boolean).join(' e ')}`;
  }
}

/** Semana (segunda, AAAA-MM-DD) e mês (AAAA-MM) em horário de Brasília. */
export function semanaDe(agora: Date): string {
  const d = new Date(agora.getTime() - 3 * 3600e3);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export const mesDe = (agora: Date) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 7);
export const diaDe = (agora: Date) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
/** Hora e dia da semana (0 = domingo) em Brasília. */
export function horaSP(agora: Date): { hora: number; minuto: number; dow: number } {
  const d = new Date(agora.getTime() - 3 * 3600e3);
  return { hora: d.getUTCHours(), minuto: d.getUTCMinutes(), dow: d.getUTCDay() };
}

/** Quando cada um trabalha sozinho. */
export const AGENDA = {
  boletim: (h: ReturnType<typeof horaSP>) => h.dow === 5 && h.hora >= 16,                 // sexta a partir das 16h
  vitoria: (h: ReturnType<typeof horaSP>) => h.dow === 1 && h.hora >= 8 && h.hora < 18,   // segunda a partir das 8h
  gerentes: (h: ReturnType<typeof horaSP>) => h.dow >= 1 && h.dow <= 5 && h.hora >= 18 && h.hora < 22, // dias úteis a partir das 18h
  escalacao: (h: ReturnType<typeof horaSP>) => h.dow >= 1 && h.dow <= 5 && (h.hora > 18 || (h.hora === 18 && h.minuto >= 30)) && h.hora < 22,
};
