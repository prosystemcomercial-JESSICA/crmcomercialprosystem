// Custo das IAs pagas em dinheiro (pedido da Jessica, 05/11/2026: "consumo da chave em reais").
// Preço de tabela por milhão de tokens, em dólar; a tela converte para reais pela cotação do dia.
// Regras puras; quem grava é services/uso-ia.service, quem lê a cotação é services/cotacao-dolar.service.

import type { UsoAgente } from './uso-ia-agentes';

export type Preco = { entrada: number; saida: number };

/**
 * Preço de tabela (US$ por 1 milhão de tokens), conferido em 05/11/2026 nas páginas de preço da OpenAI e da xAI.
 * Sem desconto de cache: o valor fica um pouco acima do cobrado, nunca abaixo.
 * IA_PRECOS no .env troca ou acrescenta modelos: {"gpt-6-luna":{"entrada":0.1,"saida":0.5}}.
 */
const TABELA: Record<string, Preco> = {
  'gpt-6-luna': { entrada: 0.10, saida: 0.50 },
  'gpt-6-sol': { entrada: 2.00, saida: 10.00 },
  'gpt-4o-transcribe': { entrada: 2.50, saida: 10.00 },
  'grok-4.7': { entrada: 2.00, saida: 6.00 },
};

export function tabelaDePrecos(env: { IA_PRECOS?: string } = {}): Record<string, Preco> {
  let extra: Record<string, Preco> = {};
  try { extra = env.IA_PRECOS ? JSON.parse(env.IA_PRECOS) : {}; } catch { /* JSON inválido: fica a tabela padrão */ }
  return { ...TABELA, ...extra };
}

/** Custo de uma chamada em dólar; null quando o modelo não está na tabela. */
export function custoUsd(tabela: Record<string, Preco>, modelo: string, entrada: number, saida: number): number | null {
  const p = tabela[modelo];
  if (!p) return null;
  return (entrada * p.entrada + saida * p.saida) / 1e6;
}

/**
 * Dias gravados antes de 05/11/2026 não têm o custo, só os tokens somados de todas as IAs do assistente.
 * Estimativa: tira os tokens do Groq e divide o resto pelas chamadas de cada IA. A parte da OpenAI e do Grok
 * vai pelo preço do modelo de cada uma.
 */
export function estimarCustoAntigo(u: UsoAgente, modelos: { openai: Preco | undefined; grok: Preco | undefined }): { openai: number; grok: number } {
  const chamadas = u.openai + u.grok + u.gemini + u.openrouter;
  const tokens = u.tokens_entrada + u.tokens_saida;
  if (!chamadas || !tokens) return { openai: 0, grok: 0 };
  const semGroq = Math.max(0, tokens - u.groq_tokens) / tokens;
  const entrada = u.tokens_entrada * semGroq, saida = u.tokens_saida * semGroq;
  const parte = (n: number, p: Preco | undefined) => (p && n ? ((entrada * p.entrada + saida * p.saida) * (n / chamadas)) / 1e6 : 0);
  return { openai: parte(u.openai, modelos.openai), grok: parte(u.grok, modelos.grok) };
}

/**
 * Custo em dólar de um registro diário do assistente: o gravado e, para as chamadas de antes da medição
 * (dias antigos e o começo do dia da publicação), a estimativa proporcional.
 */
export function custoDoDia(u: UsoAgente, modelos: { openai: Preco | undefined; grok: Preco | undefined }): { openai: number; grok: number; estimado: boolean } {
  const total = u.openai + u.grok + u.whisper + u.groq + u.gemini + u.openrouter;
  const semMedir = total ? Math.max(0, total - (u.custo_gravado || 0)) / total : 0;
  if (!semMedir) return { openai: u.custo_openai_usd || 0, grok: u.custo_grok_usd || 0, estimado: false };
  const e = estimarCustoAntigo(u, modelos);
  return { openai: (u.custo_openai_usd || 0) + e.openai * semMedir, grok: (u.custo_grok_usd || 0) + e.grok * semMedir, estimado: true };
}

// ── Resumo do consumo para a tela (05/11/2026: "quero saber tudo sobre o consumo") ──

export type DiaCusto = {
  dia: string; brl: number; openai_brl: number; grok_brl: number; estimado: boolean;
  chamadas_pagas: number; agentes: Record<string, number>;
};
export type AgenteCusto = { agente: string; nome: string; brl: number; pct: number; openai_brl: number; grok_brl: number; chamadas_pagas: number; tokens: number; brl_por_chamada: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const diasDoMes = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate(); };
const mesAnterior = (mes: string) => { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; };
/** Dias AAAA-MM-DD do mês até `ate` (inclusive). */
export function diasAte(mes: string, ate?: string): string[] {
  const n = diasDoMes(mes), out: string[] = [];
  for (let d = 1; d <= n; d++) { const dia = `${mes}-${String(d).padStart(2, '0')}`; if (ate && dia > ate) break; out.push(dia); }
  return out;
}
/** Dias que o resumo precisa ler: o período, o mês atual até hoje e o mês anterior inteiro. */
export function diasDoResumo(periodo: string[], hoje: string): string[] {
  const mes = hoje.slice(0, 7);
  return [...new Set([...periodo, ...diasAte(mes, hoje), ...diasAte(mesAnterior(mes))])].sort();
}

/**
 * Custo por dia, por IA e por assistente, em reais. `dias` = uso gravado por assistente (todos os dias que o
 * resumo precisa, ver diasDoResumo); `periodo` = dias escolhidos na tela; `hoje` = AAAA-MM-DD de São Paulo.
 */
export function resumoCusto(p: {
  dias: { dia: string; agentes: Record<string, UsoAgente> }[]; periodo: string[]; hoje: string; cotacao: number;
  modelos: { openai: Preco | undefined; grok: Preco | undefined }; nome: (agente: string) => string;
}) {
  const brl = (usd: number) => usd * p.cotacao;
  const porDia = new Map<string, DiaCusto & { tem_dados: boolean }>();
  const porAgente = new Map<string, { openai: number; grok: number; chamadas: number; tokens: number }>();
  const noPeriodo = new Set(p.periodo);
  for (const d of p.dias) {
    const dc = { dia: d.dia, brl: 0, openai_brl: 0, grok_brl: 0, estimado: false, chamadas_pagas: 0, agentes: {} as Record<string, number>, tem_dados: Object.keys(d.agentes).length > 0 };
    for (const [agente, u] of Object.entries(d.agentes)) {
      const c = custoDoDia(u, p.modelos);
      const o = brl(c.openai), g = brl(c.grok);
      dc.openai_brl += o; dc.grok_brl += g; dc.chamadas_pagas += u.openai + u.grok;
      if (c.estimado && o + g > 0) dc.estimado = true;
      if (o + g > 0) dc.agentes[agente] = r2(o + g);
      if (noPeriodo.has(d.dia)) {
        const t = porAgente.get(agente) || { openai: 0, grok: 0, chamadas: 0, tokens: 0 };
        t.openai += o; t.grok += g; t.chamadas += u.openai + u.grok; t.tokens += u.tokens_entrada + u.tokens_saida;
        porAgente.set(agente, t);
      }
    }
    dc.brl = r2(dc.openai_brl + dc.grok_brl); dc.openai_brl = r2(dc.openai_brl); dc.grok_brl = r2(dc.grok_brl);
    porDia.set(d.dia, dc);
  }
  const vazio = (dia: string) => ({ dia, brl: 0, openai_brl: 0, grok_brl: 0, estimado: false, chamadas_pagas: 0, agentes: {}, tem_dados: false });
  const lista = (dias: string[]): DiaCusto[] => dias.map(dia => { const { tem_dados, ...x } = porDia.get(dia) || vazio(dia); return x; });
  const soma = (l: DiaCusto[], k: 'brl' | 'openai_brl' | 'grok_brl') => r2(l.reduce((s, x) => s + x[k], 0));

  const primeiroComDados = [...p.dias].sort((a, b) => a.dia.localeCompare(b.dia)).find(d => Object.keys(d.agentes).length)?.dia || null;
  const periodo = lista([...p.periodo].sort());
  // Média só sobre os dias que já tinham contagem (antes de 29/10/2026 não havia: contar como zero baixaria a média).
  const diasMedidos = periodo.filter(d => primeiroComDados && d.dia >= primeiroComDados).length;
  const totalPeriodo = soma(periodo, 'brl');
  const agentes: AgenteCusto[] = [...porAgente.entries()].map(([agente, t]) => {
    const total = t.openai + t.grok;
    return { agente, nome: p.nome(agente), brl: r2(total), pct: totalPeriodo ? Math.round((total / totalPeriodo) * 1000) / 10 : 0, openai_brl: r2(t.openai), grok_brl: r2(t.grok), chamadas_pagas: t.chamadas, tokens: t.tokens, brl_por_chamada: t.chamadas ? Math.round((total / t.chamadas) * 10000) / 10000 : 0 };
  }).filter(a => a.brl > 0 || a.chamadas_pagas > 0).sort((a, b) => b.brl - a.brl);

  const mes = p.hoje.slice(0, 7), ant = mesAnterior(mes);
  const diasMes = lista(diasAte(mes, p.hoje));
  const diasAnt = lista(diasAte(ant));
  const comDados = (dias: string[]) => dias.filter(d => porDia.get(d)?.tem_dados).length;
  const totalMes = soma(diasMes, 'brl'), totalAnt = soma(diasAnt, 'brl');
  const diasMesMedidos = diasMes.filter(d => primeiroComDados && d.dia >= primeiroComDados).length;
  const mediaMes = diasMesMedidos ? r2(totalMes / diasMesMedidos) : 0;
  const diasAntComDados = comDados(diasAte(ant));

  return {
    periodo: {
      brl: totalPeriodo, openai_brl: soma(periodo, 'openai_brl'), grok_brl: soma(periodo, 'grok_brl'),
      media_dia: diasMedidos ? r2(totalPeriodo / diasMedidos) : 0, dias_medidos: diasMedidos,
      dias_com_gasto: periodo.filter(d => d.brl > 0).length,
      estimado: periodo.some(d => d.estimado),
      por_dia: periodo,
      top_dias: [...periodo].filter(d => d.brl > 0).sort((a, b) => b.brl - a.brl).slice(0, 5),
      por_agente: agentes,
    },
    mes: {
      mes, brl: totalMes, openai_brl: soma(diasMes, 'openai_brl'), grok_brl: soma(diasMes, 'grok_brl'),
      media_dia: mediaMes, dias_decorridos: diasMes.length, dias_no_mes: diasDoMes(mes),
      projecao_brl: r2(mediaMes * diasDoMes(mes)),
      por_dia: diasAte(mes).map(dia => (dia <= p.hoje ? lista([dia])[0] : { ...vazio(dia), futuro: true })).map(({ tem_dados, ...x }: any) => x),
      anterior: { mes: ant, brl: totalAnt, dias_com_dados: diasAntComDados, media_dia: diasAntComDados ? r2(totalAnt / diasAntComDados) : 0 },
    },
    dados_desde: primeiroComDados,
  };
}
