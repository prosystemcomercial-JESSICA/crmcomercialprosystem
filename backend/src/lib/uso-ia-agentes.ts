// Uso das IAs por assistente (pedido da Jessica, 29/10/2026): quem fez cada requisição, quantas falharam
// e quantos tokens gastou. Regras puras; o contador em memória e a gravação ficam em services/uso-ia.service.

export type FonteAgente = 'openai' | 'grok' | 'whisper' | 'groq' | 'gemini';

export type UsoAgente = {
  openai: number; grok: number; whisper: number;
  /** Groq grátis (29/10/2026): respondidas, vezes que não deu conta e foi para a paga, tokens que ele processou. */
  groq: number; groq_reserva: number; groq_tokens: number;
  /** Gemini (29/10/2026, escolhido em Configurações › Modelos de IA). */
  gemini: number;
  falhas: number; tokens_entrada: number; tokens_saida: number;
};

export const usoAgenteVazio = (): UsoAgente => ({ openai: 0, grok: 0, whisper: 0, groq: 0, groq_reserva: 0, groq_tokens: 0, gemini: 0, falhas: 0, tokens_entrada: 0, tokens_saida: 0 });

// Arquivo de serviço que chamou a IA → assistente. Vale quando a chamada não diz quem é (`agente`).
const POR_ARQUIVO: Record<string, string> = {
  'assistente-ia': 'clarice',
  'especialista': 'rafael',
  'equipe': 'rafael',
  'caroline': 'caroline',
  'heitor': 'heitor',
  'joana': 'joana',
  'analista-resultados': 'analista',
  'implantacao-portal': 'portal',
  'sofia-pesquisa': 'sofia',
  'agentes-conversa': 'escritorio',
};

/** Assistente que fez a chamada, lido da pilha (primeiro serviço fora do cliente de IA). */
export function agenteDaPilha(pilha: string | undefined): string {
  for (const m of (pilha || '').matchAll(/services[\\/]([\w-]+)\.service\.[jt]s/g)) {
    const arquivo = m[1];
    if (arquivo === 'ia-gemini' || arquivo === 'uso-ia') continue;
    return POR_ARQUIVO[arquivo] || arquivo;
  }
  return 'outros';
}

/** Tokens de uma resposta da OpenAI/Grok (API Responses ou transcrição); 0 quando não vier. */
export function tokensDaResposta(data: any): { entrada: number; saida: number } {
  const u = data?.usage || {};
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return { entrada: n(u.input_tokens ?? u.prompt_tokens), saida: n(u.output_tokens ?? u.completion_tokens) };
}

/** Soma dois registros diários { agente: uso }. */
export function somarPorAgente(a: Record<string, Partial<UsoAgente>>, b: Record<string, Partial<UsoAgente>>): Record<string, UsoAgente> {
  const out: Record<string, UsoAgente> = {};
  for (const fonte of [a, b]) {
    for (const [agente, u] of Object.entries(fonte || {})) {
      const t = (out[agente] ||= usoAgenteVazio());
      t.openai += u.openai || 0; t.grok += u.grok || 0; t.whisper += u.whisper || 0;
      t.groq += u.groq || 0; t.groq_reserva += u.groq_reserva || 0; t.groq_tokens += u.groq_tokens || 0; t.gemini += u.gemini || 0;
      t.falhas += u.falhas || 0; t.tokens_entrada += u.tokens_entrada || 0; t.tokens_saida += u.tokens_saida || 0;
    }
  }
  return out;
}

const NOMES: Record<string, string> = {
  caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe', rafael: 'Rafael', olivia: 'Olívia', mila: 'Mila',
  sofia: 'Sofia', clarice: 'Clarice', heitor: 'Heitor', joana: 'Joana', analista: 'Analista de Resultados',
  portal: 'Portal de implantação', transcricao: 'Transcrição de áudio', escritorio: 'Conversa no Escritório', outros: 'Outros',
};

/** Nome para a tela: "conversa-rafael" vira "Rafael (conversa no Escritório)". */
export function nomeDoAgente(id: string): string {
  if (id.startsWith('conversa-')) return `${NOMES[id.slice(9)] || id.slice(9)} (conversa no Escritório)`;
  return NOMES[id] || id;
}

/** Soma o período e devolve uma linha por assistente, quem mais usou a OpenAI primeiro. */
export function totalPorAgente(dias: { agentes: Record<string, UsoAgente> }[]): ({ agente: string; nome: string } & UsoAgente)[] {
  const total = dias.reduce((s, d) => somarPorAgente(s, d.agentes), {} as Record<string, UsoAgente>);
  return Object.entries(total).map(([agente, u]) => ({ agente, nome: nomeDoAgente(agente), ...u }))
    .sort((a, b) => b.openai - a.openai || b.grok - a.grok || b.groq - a.groq || b.whisper - a.whisper);
}
