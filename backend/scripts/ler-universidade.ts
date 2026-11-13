/**
 * Lê a Universidade Prosystem inteira (base de conhecimento pública) e grava o texto de cada artigo em
 * docs/comercial/universidade-prosystem.json, que é o conhecimento de produto do Rafael (13/11/2026).
 *
 * Uso (na pasta backend): npx tsx scripts/ler-universidade.ts
 * Rode de novo quando a Universidade ganhar artigos ou versões novas; depois commit + deploy.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://universidade.prosystemnet.com';
const RAIZ = '/base-conhecimento';
const SAIDA = path.resolve(process.cwd(), '..', 'docs', 'comercial', 'universidade-prosystem.json');

const entidades: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' };
function textoDe(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|ul|ol|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#\w]+;/g, e => entidades[e] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function baixar(caminho: string): Promise<string> {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(SITE + caminho, { headers: { 'User-Agent': 'CRM-Comercial-Prosystem (estudo do Rafael)' } });
      if (r.ok) return await r.text();
      if (r.status === 404) return '';
    } catch { /* tenta de novo */ }
    await new Promise(res => setTimeout(res, 1500 * tentativa));
  }
  return '';
}

type Artigo = { url: string; categoria: string; titulo: string; atualizado: string | null; texto: string };

async function main() {
  const fila = [RAIZ];
  const vistos = new Set(fila);
  const artigos: Artigo[] = [];
  while (fila.length) {
    const caminho = fila.shift()!;
    const html = await baixar(caminho);
    if (!html) { console.warn('sem resposta:', caminho); continue; }
    for (const m of html.matchAll(/href="(\/base-conhecimento\/[^"#?]+)"/g)) {
      const link = decodeURI(m[1]).replace(/\/$/, '');
      if (!vistos.has(link)) { vistos.add(link); fila.push(link); }
    }
    const ini = html.indexOf('kb-content');
    if (ini < 0) continue; // página de categoria: só lista links
    const corpo = html.slice(html.indexOf('>', ini) + 1, html.indexOf('</article>', ini) > 0 ? html.indexOf('</article>', ini) : undefined);
    const titulo = textoDe(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || caminho.split('/').pop() || '');
    const atualizado = html.match(/Atualizado em (?:<!-- -->)?\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] || null;
    const categoria = caminho.split('/').slice(2, -1).join(' › ');
    const texto = textoDe(corpo).split(/\n?Este artigo foi útil\?/)[0].trim(); // sem o rodapé de avaliação
    if (texto.length < 40) continue;
    artigos.push({ url: SITE + caminho, categoria, titulo, atualizado, texto });
    console.log(`${artigos.length}. ${titulo} (${texto.length} letras)`);
  }
  artigos.sort((a, b) => a.url.localeCompare(b.url));
  await writeFile(SAIDA, JSON.stringify({ fonte: SITE + RAIZ, lido_em: new Date().toISOString(), artigos }, null, 1));
  console.log(`\n${artigos.length} artigos gravados em ${SAIDA}`);
}

main().catch(e => { console.error(e); process.exit(1); });
