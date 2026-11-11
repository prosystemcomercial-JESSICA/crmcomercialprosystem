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

/**
 * A nota da IA só vale quando há algo do cliente para responder (11/11/2026). Num primeiro contato, ou numa
 * conversa em que o cliente nunca escreveu, ela tirava nota por "não aguardar resposta" e segurava tudo o que
 * a Caroline escrevia. Nesses casos valem só as regras puras (link, corte, repetição, excesso).
 */
export function precisaNotaIa(fase: string, historico: { direcao: string }[]): boolean {
  return fase !== 'abertura' && historico.some(m => m.direcao === 'ENTRADA');
}

/** O que a IA precisa saber sobre a fase para não punir o que é esperado nela. */
export function avisoDaFase(fase: string): string {
  if (fase === 'retomada') return 'ATENÇÃO À FASE: esta é uma retomada programada depois de o cliente ficar sem responder. Retomar o contato e escrever sem uma resposta nova do cliente é o esperado: não tire nota por isso. Avalie só se a retomada cumpre o que foi combinado, não repete o que já foi dito e segue as lições.';
  if (fase === 'encerramento') return 'ATENÇÃO À FASE: esta é a mensagem de encerramento depois de o cliente ficar sem responder. Encerrar sem uma resposta nova do cliente é o esperado: não tire nota por isso.';
  return '';
}
