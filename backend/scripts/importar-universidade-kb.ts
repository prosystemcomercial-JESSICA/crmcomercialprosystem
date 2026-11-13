/**
 * Coloca os artigos da Universidade Prosystem na Base de Conhecimento do Portal Técnico (13/11/2026).
 *
 * Fonte: docs/comercial/universidade-prosystem.json (gerado por scripts/ler-universidade.ts).
 * Cada artigo entra com o caminho na Universidade ("onde fica"), o link do original (lá estão as imagens)
 * e o texto completo. Uma categoria por seção da Universidade; a subseção vira etiqueta.
 *
 * Pode rodar de novo: acha o artigo pelo link e só atualiza; nada é apagado.
 * Uso (na pasta backend): npx tsx scripts/importar-universidade-kb.ts [--simular]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type ArtigoUni = { url: string; categoria: string; titulo: string; atualizado?: string; texto: string };

const FONTE = path.resolve(process.cwd(), '..', 'docs', 'comercial', 'universidade-prosystem.json');
const SIMULAR = process.argv.includes('--simular');
const MARCA = 'Fonte: Universidade Prosystem';

const SECOES: Record<string, { nome: string; icone: string; ordem: number }> = {
  'admin-retaguarda':      { nome: 'Retaguarda (Admin)', icone: 'Settings', ordem: 10 },
  'caixa-frente-de-loja':  { nome: 'Caixa / Frente de loja', icone: 'ShoppingCart', ordem: 20 },
  'suporte-tecnico':       { nome: 'Suporte técnico', icone: 'Wrench', ordem: 30 },
  'prosystem-gerencial':   { nome: 'Prosystem Gerencial', icone: 'BarChart3', ordem: 40 },
  'prosystem-manipulacao': { nome: 'Prosystem Manipulação', icone: 'FlaskConical', ordem: 50 },
  'parcerias-integracoes': { nome: 'Parcerias e integrações', icone: 'Link', ordem: 60 },
  'ajustes-novidades':     { nome: 'Novidades da versão', icone: 'Sparkles', ordem: 70 },
  'manuais-do-sistema':    { nome: 'Manuais do sistema', icone: 'BookOpen', ordem: 80 },
};

const legivel = (slug: string) => {
  const t = slug.replace(/^pbm-s-/, 'PBMs - ').replace(/-/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function resumoDe(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= 220) return limpo;
  const corte = limpo.slice(0, 220);
  return corte.slice(0, corte.lastIndexOf(' ')) + '…';
}

async function main() {
  const { artigos } = JSON.parse(await readFile(FONTE, 'utf8')) as { artigos: ArtigoUni[] };
  const prisma = new PrismaClient();
  try {
    // Categorias (uma por seção), reaproveitando as que já existem com o mesmo nome.
    const catId: Record<string, string> = {};
    for (const [slug, s] of Object.entries(SECOES)) {
      if (!artigos.some(a => a.categoria.startsWith(slug))) continue;
      const existente = await prisma.kbCategoria.findFirst({ where: { nome: s.nome, parent_id: null } });
      if (existente) { catId[slug] = existente.id; continue; }
      if (SIMULAR) { catId[slug] = `nova:${slug}`; continue; }
      const nova = await prisma.kbCategoria.create({
        data: { nome: s.nome, icone: s.icone, ordem: s.ordem, descricao: `Artigos da Universidade Prosystem (universidade.prosystemnet.com), seção ${s.nome}.` },
      });
      catId[slug] = nova.id;
    }

    let criados = 0, atualizados = 0;
    for (const a of artigos) {
      const [secaoSlug, subSlug = ''] = a.categoria.split('›').map(s => s.trim());
      const secao = SECOES[secaoSlug]?.nome ?? legivel(secaoSlug);
      const sub = legivel(subSlug);
      const conteudo = [
        `📍 Onde fica: Universidade Prosystem › ${secao} › ${sub}`,
        `🔗 Artigo original (com as imagens e telas): ${a.url}`,
        a.atualizado ? `🗓 Atualizado na Universidade em ${a.atualizado}` : '',
        '',
        '────────────────────────',
        '',
        a.texto.trim(),
        '',
        '────────────────────────',
        `${MARCA}. Onde o texto diz "veja exemplo" ou "conforme imagem", abra o link acima para ver a tela.`,
      ].filter((l, i) => l !== '' || i > 2).join('\n');

      const dados = {
        titulo: a.titulo.trim(),
        conteudo,
        resumo: resumoDe(a.texto),
        categoria_id: catId[secaoSlug] && !catId[secaoSlug].startsWith('nova:') ? catId[secaoSlug] : null,
        status: 'PUBLICADO',
        visibilidade: 'INTERNO',
        tags: JSON.stringify(['Universidade Prosystem', sub]),
      };

      const existente = await prisma.kbArtigo.findFirst({ where: { conteudo: { contains: a.url } }, select: { id: true } });
      if (SIMULAR) { existente ? atualizados++ : criados++; continue; }
      if (existente) {
        // Mantém status/visibilidade que alguém tenha mudado à mão; atualiza só o texto.
        const { status, visibilidade, ...texto } = dados;
        await prisma.kbArtigo.update({ where: { id: existente.id }, data: texto });
        atualizados++;
      } else {
        await prisma.kbArtigo.create({ data: { ...dados, autor_nome: 'Universidade Prosystem' } });
        criados++;
      }
    }
    console.log(`${SIMULAR ? '[simulação] ' : ''}${artigos.length} artigos: ${criados} novos, ${atualizados} atualizados; ${Object.keys(catId).length} categorias.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
