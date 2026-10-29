// Modelo de IA por função (pedido da Jessica, 29/10/2026): em Configurações › Modelos de IA, cada
// assistente tem um modelo principal e uma reserva. "Automático" = a ordem padrão (Groq grátis primeiro,
// depois as pagas). Regras puras; quem chama a IA é services/ia-gemini.service, quem grava é routes/ia-modelos.

export type Provedor = 'groq' | 'openrouter' | 'openai' | 'grok' | 'gemini';
export type Modelo = { id: string; provedor: Provedor; modelo: string; nome: string; gratis: boolean; imagem: boolean; busca: boolean };
export type Rota = { principal: string; reserva: string };

export const AUTO = 'auto';
export const NENHUMA = 'nenhuma';

/** Modelos que o CRM sabe chamar. O modelo da OpenAI e do Grok vem do .env (OPENAI_MODEL, XAI_MODEL). */
export function catalogo(env: { OPENAI_MODEL?: string; XAI_MODEL?: string; GEMINI_MODEL?: string } = {}): Modelo[] {
  const openai = env.OPENAI_MODEL || 'gpt-6-luna';
  const gemini = env.GEMINI_MODEL || 'gemini-flash-latest';
  const grok = env.XAI_MODEL || 'grok-4.7';
  return [
    { id: 'groq:openai/gpt-oss-120b', provedor: 'groq', modelo: 'openai/gpt-oss-120b', nome: 'Groq: GPT-OSS 120B', gratis: true, imagem: false, busca: false },
    { id: 'groq:openai/gpt-oss-20b', provedor: 'groq', modelo: 'openai/gpt-oss-20b', nome: 'Groq: GPT-OSS 20B (rápido)', gratis: true, imagem: false, busca: false },
    { id: 'groq:qwen/qwen3.8-27b', provedor: 'groq', modelo: 'qwen/qwen3.8-27b', nome: 'Groq: Qwen 3.8 27B', gratis: true, imagem: false, busca: false },
    // OpenRouter grátis (29/10/2026): só modelos que respondem sem guardar os dados (data_collection: deny).
    { id: 'openrouter:recursive/flint-v1.0:free', provedor: 'openrouter', modelo: 'recursive/flint-v1.0:free', nome: 'OpenRouter: Flint', gratis: true, imagem: false, busca: false },
    { id: 'openrouter:dots-studio/dots-3-note-preview:free', provedor: 'openrouter', modelo: 'dots-studio/dots-3-note-preview:free', nome: 'OpenRouter: Dots 3', gratis: true, imagem: false, busca: false },
    { id: 'openrouter:google/gemma-4-31b-it:free', provedor: 'openrouter', modelo: 'google/gemma-4-31b-it:free', nome: 'OpenRouter: Gemma 4 31B', gratis: true, imagem: false, busca: false },
    { id: `gemini:${gemini}`, provedor: 'gemini', modelo: gemini, nome: `Google: ${gemini === 'gemini-flash-latest' ? 'Gemini Flash (mais recente)' : gemini}`, gratis: true, imagem: true, busca: true },
    { id: `openai:${openai}`, provedor: 'openai', modelo: openai, nome: `OpenAI: ${openai}`, gratis: false, imagem: true, busca: true },
    { id: `grok:${grok}`, provedor: 'grok', modelo: grok, nome: `xAI: ${grok}`, gratis: false, imagem: false, busca: false },
  ];
}

export type Funcao = { id: string; nome: string; descricao: string; grupo: string };

/** Uma linha por assistente; o id é o mesmo do contador de uso (lib/uso-ia-agentes). */
export const FUNCOES: Funcao[] = [
  { id: 'caroline', grupo: 'Conversas com leads', nome: 'Caroline', descricao: 'Primeiro contato e conversa com os leads no WhatsApp' },
  { id: 'julio', grupo: 'Conversas com leads', nome: 'Julio', descricao: 'SDR: conversa com os leads no WhatsApp' },
  { id: 'luiz_felipe', grupo: 'Conversas com leads', nome: 'Luiz Felipe', descricao: 'SDR: conversa com os leads no WhatsApp' },
  { id: 'clarice', grupo: 'Assistentes da equipe', nome: 'Clarice', descricao: 'Resumo da conversa, sugestão de resposta e tira-dúvidas' },
  { id: 'heitor', grupo: 'Assistentes da equipe', nome: 'Heitor', descricao: 'Análises do Heitor' },
  { id: 'joana', grupo: 'Assistentes da equipe', nome: 'Joana', descricao: 'Edição de textos' },
  { id: 'analista', grupo: 'Assistentes da equipe', nome: 'Analista de Resultados', descricao: 'Leitura dos números do setor' },
  { id: 'portal', grupo: 'Assistentes da equipe', nome: 'Portal de implantação', descricao: 'Textos e respostas do portal do cliente' },
  { id: 'escritorio', grupo: 'Assistentes da equipe', nome: 'Conversa no Escritório', descricao: 'Os agentes respondendo você no Escritório' },
  { id: 'rafael', grupo: 'Pesquisa e estratégia', nome: 'Rafael', descricao: 'Especialista em vendas (pesquisa na internet e planos)' },
  { id: 'olivia', grupo: 'Pesquisa e estratégia', nome: 'Olívia', descricao: 'Pesquisa na internet' },
  { id: 'mila', grupo: 'Pesquisa e estratégia', nome: 'Mila', descricao: 'Pesquisa na internet' },
  { id: 'sofia', grupo: 'Pesquisa e estratégia', nome: 'Sofia', descricao: 'Pesquisa de mercado na internet' },
];

export const rotaPadrao = (): Rota => ({ principal: AUTO, reserva: AUTO });

/** "conversa-rafael" (conversa no Escritório) usa a linha do Escritório. */
export const funcaoDoAgente = (agente: string) => (agente.startsWith('conversa-') ? 'escritorio' : agente);

/** Limpa o que veio da tela: só funções e modelos conhecidos; o resto vira Automático. */
export function validarRotas(entrada: unknown, modelos: Modelo[]): Record<string, Rota> {
  const ids = new Set(modelos.map(m => m.id));
  const out: Record<string, Rota> = {};
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, any>;
  for (const f of FUNCOES) {
    const r = e[f.id] || {};
    const principal = ids.has(r.principal) ? r.principal : AUTO;
    const reserva = ids.has(r.reserva) || r.reserva === NENHUMA ? r.reserva : AUTO;
    if (principal !== AUTO || reserva !== AUTO) out[f.id] = { principal, reserva };
  }
  return out;
}

/**
 * Ordem de tentativa para um pedido: os modelos escolhidos que servem para ele (imagem/busca) e têm chave.
 * `auto` no fim = depois deles, segue a ordem automática; sem `auto` = parar (reserva "Nenhuma").
 */
export function planoDaRota(rota: Rota | undefined, modelos: Modelo[], p: { imagem?: boolean; busca?: boolean; temChave: (pv: Provedor) => boolean }): { tentar: Modelo[]; auto: boolean } {
  const r = rota || rotaPadrao();
  const tentar: Modelo[] = [];
  let auto = false;
  for (const id of [r.principal, r.reserva]) {
    if (id === AUTO) { auto = true; break; }
    if (id === NENHUMA) break;
    const m = modelos.find(x => x.id === id);
    if (!m || !p.temChave(m.provedor)) continue;
    if ((p.imagem && !m.imagem) || (p.busca && !m.busca)) continue;
    if (!tentar.some(x => x.id === m.id)) tentar.push(m);
  }
  // Nada escolhido serve para este pedido (ex.: Groq num pedido com imagem): não deixa o pedido sem IA.
  if (!tentar.length) auto = true;
  return { tentar, auto };
}
