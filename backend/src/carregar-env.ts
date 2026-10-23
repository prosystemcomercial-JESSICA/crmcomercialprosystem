// Primeiro import do server.ts: relê backend/.env antes de qualquer módulo ler process.env
// (motivo em lib/env-arquivo.ts). Sem .env (testes, outra máquina), não faz nada.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lerEnv, aplicarEnv } from './lib/env-arquivo';

const arquivo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(arquivo)) {
  const corrigidas = aplicarEnv(lerEnv(readFileSync(arquivo, 'utf8')), process.env);
  if (corrigidas.length) {
    console.warn(`[BOOT] .env: ${corrigidas.length} variável(is) vinham diferentes do PM2 e foram corrigidas: ${corrigidas.join(', ')}`);
  }
}
