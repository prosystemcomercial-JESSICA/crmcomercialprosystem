// Laya guardiã (10/11/2026): conferência pura de cada mensagem antes de sair e comparação de perguntas.
// Motivo: na revisão de 09/11 o Rafael achou links cortados, textos truncados e mensagens repetidas
// que ninguém conferiu. Quem chama é services/laya-cerebro.service (e dali o motor dos SDRs).
import { semelhanca } from './assistente/sdr';

export const MAX_MENSAGENS_POR_VEZ = 3;
const FIM_CORTADO = /(,|;|:|\s(e|o|a|os|as|de|do|da|para|pra|que|com|em|um|uma|no|na|se|ou|mas|por)|-)$/i;

/** Link quebrado: "[link]", "http" sem domínio ou URL cortada no fim da mensagem. */
export function linkIncompleto(t: string): boolean {
  if (/\[(link|url|site)\]|\(link\)|<link>/i.test(t)) return true;
  for (const m of t.matchAll(/https?:\/\/(\S*)/gi)) if (!/^[\w.-]+\.[a-z]{2,}/i.test(m[1] || '')) return true;
  return false;
}

/** Texto que termina em vírgula, dois-pontos ou artigo/preposição: a IA cortou no meio. */
export function pareceCortada(t: string): boolean {
  const s = t.trim();
  return s.length >= 40 && FIM_CORTADO.test(s);
}

/** Alguma mensagem quase igual a uma das últimas do agente nesta conversa. */
export function repeteAgente(mensagens: string[], ultimas: string[], limiar = 0.6): boolean {
  return mensagens.some(m => ultimas.some(u => semelhanca(m, u) >= limiar));
}

/** Problemas que não precisam de IA para ver. Vazio = passou. */
export function conferirPura(p: { mensagens: string[]; ultimas: string[] }): string[] {
  const problemas: string[] = [];
  if (p.mensagens.some(linkIncompleto)) problemas.push('link incompleto ou quebrado');
  if (p.mensagens.some(pareceCortada)) problemas.push('texto cortado no meio');
  if (repeteAgente(p.mensagens, p.ultimas)) problemas.push('repete o que o agente já disse nesta conversa');
  if (p.mensagens.length > MAX_MENSAGENS_POR_VEZ) problemas.push(`${p.mensagens.length} mensagens de uma vez (máximo ${MAX_MENSAGENS_POR_VEZ})`);
  return problemas;
}

const VAZIAS = new Set(['para', 'como', 'qual', 'quais', 'quando', 'onde', 'sobre', 'esta', 'este', 'essa', 'esse', 'isso', 'pode', 'podem', 'deve', 'devem', 'está', 'estão', 'temos', 'existe', 'existem', 'prosystem', 'sistema', 'cliente', 'clientes', 'equipe', 'jessica', 'confirmar', 'confirma', 'precisa', 'precisam', 'quanto', 'quantos', 'mais', 'menos', 'muito', 'todos', 'todas', 'cada', 'entre', 'pelo', 'pela', 'pelos', 'pelas', 'será', 'serão', 'ainda', 'também', 'nosso', 'nossa', 'nossos', 'nossas', 'seus', 'suas', 'deles', 'delas', 'oferecer', 'oferece']);
/** Palavras que carregam o assunto (sem acento, 4+ letras, sem as vazias). */
export function palavrasChave(t: string): Set<string> {
  const n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
  return new Set(n.split(/\s+/).filter(w => w.length >= 4 && !VAZIAS.has(w)));
}

/** Parte das palavras da pergunta que aparece no texto (0 a 1). */
export function cobertura(pergunta: string, texto: string): number {
  const a = palavrasChave(pergunta), b = palavrasChave(texto);
  if (!a.size) return 0;
  let n = 0; a.forEach(w => { if (b.has(w)) n++; });
  return n / a.size;
}
