// Gera app/modo-escuro.css: adapta ao modo escuro as cores fixas espalhadas pelas telas
// (classes Tailwind de cor e estilos inline com hex). Rodar de novo quando surgirem cores novas:
//   node scripts/gerar-modo-escuro.mjs
// Regras (conforto para uso o dia todo): nenhuma área clara grande, tons pastel viram véu
// translúcido da mesma cor, textos coloridos viram tons claros e dessaturados (contraste >= 6).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tom médio (para véus e bordas) e tom de texto confortável de cada família de cor.
const FAMILIAS = {
  red:     { base: '#dc2626', texto: '#f3a5a5' },
  orange:  { base: '#ea580c', texto: '#f2b48a' },
  amber:   { base: '#d97706', texto: '#ecc87f' },
  yellow:  { base: '#ca8a04', texto: '#e6d27c' },
  lime:    { base: '#65a30d', texto: '#c3dc8a' },
  green:   { base: '#16a34a', texto: '#93d4a8' },
  emerald: { base: '#059669', texto: '#8fd5b6' },
  teal:    { base: '#0d9488', texto: '#8bd0c8' },
  cyan:    { base: '#0891b2', texto: '#8fcfdf' },
  sky:     { base: '#0284c7', texto: '#9accec' },
  blue:    { base: '#2563eb', texto: '#a3c2f0' },
  indigo:  { base: '#4f46e5', texto: '#b1b9ef' },
  violet:  { base: '#7c3aed', texto: '#c4b5f1' },
  purple:  { base: '#9333ea', texto: '#cfb2ee' },
  fuchsia: { base: '#c026d3', texto: '#e3aee8' },
  pink:    { base: '#db2777', texto: '#eeaccb' },
  rose:    { base: '#e11d48', texto: '#f0a8b5' },
};
const veu = (f, p) => `color-mix(in srgb, ${FAMILIAS[f].base} ${p}%, var(--t-card-bg))`;
const bordaCor = f => `color-mix(in srgb, ${FAMILIAS[f].base} 38%, var(--t-card-border))`;

const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};
// Ângulo de matiz -> família (aproximação das famílias Tailwind).
const familiaDe = h => [[12, 'red'], [28, 'orange'], [42, 'amber'], [56, 'yellow'], [80, 'lime'], [150, 'green'], [165, 'emerald'], [178, 'teal'], [192, 'cyan'], [205, 'sky'], [228, 'blue'], [248, 'indigo'], [265, 'violet'], [285, 'purple'], [310, 'fuchsia'], [338, 'pink'], [352, 'rose'], [361, 'red']].find(([lim]) => h < lim)[1];
const croma = rgb => (Math.max(...rgb) - Math.min(...rgb)) / 255; // < .07 = neutro (cinza)
const contraste = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const CARD_ESCURO = lum(hexRgb('#1e2630'));

// ── 1. Coleta das cores inline (hex) usadas nas telas ──
const arquivos = [];
const andar = d => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(n)) andar(p); } else if (/\.tsx$/.test(n)) arquivos.push(p); } };
andar(join(raiz, 'app')); andar(join(raiz, 'components'));
const fundos = new Set(), textos = new Set(), bordas = new Set();
for (const f of arquivos) {
  const src = readFileSync(f, 'utf8');
  // Toda cor hex entre aspas entra nas três listas (muitas vêm de condições e mapas, como
  // `hoje ? '#FAFCFF' : ...`). A regra só pega se a tela usar a cor naquele papel, porque o
  // seletor procura "background: rgb(...)" / "color: rgb(...)" dentro do style.
  for (const m of src.matchAll(/['"`](#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})['"`]/g)) { const h = m[1].toLowerCase(); fundos.add(h); textos.add(h); bordas.add(h); }
  for (const m of src.matchAll(/(?:solid|dashed)\s+(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)) bordas.add(m[1].toLowerCase());
}
const rgbTxt = h => `rgb(${hexRgb(h).join(', ')})`;
const unicos = s => [...new Map([...s].map(h => [rgbTxt(h), h])).values()].sort();

const regrasFundo = new Map(), regrasTexto = new Map(), regrasBorda = new Map();
const junta = (mapa, valor, seletores) => mapa.set(valor, [...(mapa.get(valor) || []), ...seletores]);

for (const h of unicos(fundos)) {
  const rgb = hexRgb(h), L = lum(rgb), [hue] = hsl(rgb);
  if (L < .5) continue; // fundos médios/saturados (botões, selos fortes) ficam como estão
  const sel = [`.dark [style*="background: ${rgbTxt(h)}"]`, `.dark [style*="background-color: ${rgbTxt(h)}"]`];
  if (croma(rgb) < .07) junta(regrasFundo, L > .985 ? 'var(--t-card-bg)' : 'var(--t-content-bg)', sel);
  else junta(regrasFundo, veu(familiaDe(hue), L > .9 ? 14 : 20), sel);
}
for (const h of unicos(textos)) {
  const rgb = hexRgb(h), L = lum(rgb), [hue] = hsl(rgb);
  if (contraste(L, CARD_ESCURO) >= 6) continue; // já é legível no escuro
  const t = rgbTxt(h);
  const sel = [`.dark [style^="color: ${t}"]`, `.dark [style*="; color: ${t}"]`];
  if (croma(rgb) < .15) junta(regrasTexto, L < .03 ? 'var(--t-text-primary)' : 'var(--t-text-secondary)', sel);
  else junta(regrasTexto, FAMILIAS[familiaDe(hue)].texto, sel);
}
for (const h of unicos(bordas)) {
  const rgb = hexRgb(h), L = lum(rgb), [hue] = hsl(rgb);
  if (L < .45) continue;
  const t = rgbTxt(h);
  const sel = [`.dark [style*="solid ${t}"]`, `.dark [style*="dashed ${t}"]`, `.dark [style*="border-color: ${t}"]`];
  junta(regrasBorda, croma(rgb) < .07 ? 'var(--t-card-border)' : bordaCor(familiaDe(hue)), sel);
}

// ── 2. Classes Tailwind de cor ──
const tw = [];
for (const f of Object.keys(FAMILIAS)) {
  tw.push(`.dark :is(.bg-${f}-50,.bg-${f}-100) { background-color: ${veu(f, 14)} !important; }`);
  tw.push(`.dark .bg-${f}-200 { background-color: ${veu(f, 22)} !important; }`);
  tw.push(`.dark :is(.border-${f}-100,.border-${f}-200,.border-${f}-300) { border-color: ${bordaCor(f)} !important; }`);
  tw.push(`.dark :is(.text-${f}-500,.text-${f}-600,.text-${f}-700,.text-${f}-800,.text-${f}-900) { color: ${FAMILIAS[f].texto} !important; }`);
  tw.push(`.dark :is(.hover\\:text-${f}-600,.hover\\:text-${f}-700,.hover\\:text-${f}-800):hover { color: ${FAMILIAS[f].texto} !important; }`);
  tw.push(`.dark :is(.hover\\:bg-${f}-50,.hover\\:bg-${f}-100):hover { background-color: ${veu(f, 20)} !important; }`);
}

const bloco = (titulo, mapa, prop) => [`/* ${titulo} */`, ...[...mapa].map(([v, sels]) => `${sels.join(',\n')} { ${prop}: ${v} !important; }`)].join('\n');
const css = `/* GERADO por scripts/gerar-modo-escuro.mjs — não editar à mão; rode o script de novo.
   Modo escuro confortável (pedido da Jessica, 29/10/2026): as telas têm cores fixas
   (classes Tailwind e estilos inline). Aqui elas ganham equivalentes escuros:
   fundos claros viram superfície escura, pastéis viram véu translúcido da mesma cor
   e textos coloridos viram tons claros e dessaturados. Só vale com .dark no <html>. */

${tw.join('\n')}

${bloco('Fundos claros inline', regrasFundo, 'background-color')}

${bloco('Textos coloridos inline com pouco contraste no escuro', regrasTexto, 'color')}

${bloco('Bordas claras inline', regrasBorda, 'border-color')}
`;
writeFileSync(join(raiz, 'app', 'modo-escuro.css'), css);
console.log(`modo-escuro.css: ${fundos.size} fundos, ${textos.size} textos, ${bordas.size} bordas lidos; ${css.length} bytes`);
