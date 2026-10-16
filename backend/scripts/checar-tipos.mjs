// Checagem de tipos do backend com linha de base (16/10/2026).
// O backend tem erros de tipo antigos (o tsx de produção não confere tipos). Esta checagem só falha
// quando aparece erro NOVO: compara arquivo + código + mensagem (sem número de linha, que muda à toa).
//   node scripts/checar-tipos.mjs            → confere contra scripts/tipos-baseline.json
//   node scripts/checar-tipos.mjs --gravar   → grava a linha de base atual (depois de corrigir erros antigos)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arqBase = join(raiz, 'scripts', 'tipos-baseline.json');

let saida = '';
try { saida = execSync('npx tsc --noEmit -p . --rootDir .', { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (e) { saida = `${e.stdout || ''}${e.stderr || ''}`; }

const chave = l => {
  const m = l.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
  return m ? `${m[1].replace(/\\/g, '/')} ${m[2]} ${m[3]}` : null;
};
const atuais = saida.split(/\r?\n/).map(chave).filter(Boolean);

if (process.argv.includes('--gravar')) {
  writeFileSync(arqBase, JSON.stringify(atuais.sort(), null, 2) + '\n');
  console.log(`Linha de base gravada: ${atuais.length} erro(s) antigo(s).`);
  process.exit(0);
}

const base = existsSync(arqBase) ? JSON.parse(readFileSync(arqBase, 'utf8')) : [];
const sobra = new Map();
for (const k of base) sobra.set(k, (sobra.get(k) || 0) + 1);
const novos = [];
for (const k of atuais) { const n = sobra.get(k) || 0; if (n > 0) sobra.set(k, n - 1); else novos.push(k); }

if (novos.length) {
  console.error(`❌ ${novos.length} erro(s) de tipo NOVO(S) no backend:`);
  for (const k of novos) console.error('  - ' + k);
  console.error('\nCorrija antes de publicar. Para conferir: npx tsc --noEmit -p . --rootDir .');
  process.exit(1);
}
const resolvidos = base.length - (atuais.length - novos.length);
console.log(`✅ Tipos do backend: nenhum erro novo (${atuais.length} antigo(s) na linha de base${resolvidos > 0 ? `, ${resolvidos} já corrigido(s): rode com --gravar` : ''}).`);
