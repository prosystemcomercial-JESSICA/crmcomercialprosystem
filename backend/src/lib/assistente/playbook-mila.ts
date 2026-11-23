// Manual de CS da Mila (23/11/2026): docs/comercial/playbook-mila-cs.md é a regra de trabalho dela.
// Lido do disco (cache de 10 minutos) e colocado no prompt da Mila: estudo, oferta de upgrade, agenda e conversa com a Jessica.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cache: { em: number; texto: string } | null = null;

export async function lerPlaybookMila(): Promise<string> {
  if (cache && Date.now() - cache.em < 10 * 60000) return cache.texto;
  const arquivo = path.resolve(process.cwd(), '..', 'docs', 'comercial', 'playbook-mila-cs.md');
  const texto = await readFile(arquivo, 'utf8').catch(() => '');
  cache = { em: Date.now(), texto };
  return texto;
}

/** Recorta as seções "## N. ..." pedidas (a seção 0, regras de ouro, vem sempre). Puro. */
export function secoesDoPlaybook(texto: string, numeros: number[]): string {
  const partes = texto.split(/\n(?=## \d+\.)/);
  const quer = new Set([0, ...numeros]);
  return partes.filter(p => { const m = p.match(/^## (\d+)\./); return m && quer.has(Number(m[1])); }).join('\n\n').trim();
}

/** Bloco pronto para o prompt. Sem números, vai o manual inteiro (até maxChars). */
export async function playbookParaPrompt(numeros: number[] = [], maxChars = 24000): Promise<string> {
  const t = await lerPlaybookMila();
  if (!t) return '';
  const corpo = numeros.length ? secoesDoPlaybook(t, numeros) : t;
  return `\n\n### Seu manual de CS (regra de trabalho; siga sempre)\n${corpo.slice(0, maxChars)}`;
}
