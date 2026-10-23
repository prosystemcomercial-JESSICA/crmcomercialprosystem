// O .env do backend manda (caso de 22 e 23/10/2026). O PM2 só passa o .env ao processo pelo
// ecosystem.config.js; quando o Ubuntu instala atualização automática e religa o PM2
// (`pm2 resurrect`), ele usa a foto salva em ~/.pm2/dump.pm2, que estava com o
// EVOLUTION_API_URL da conta UAZAPI antiga. A conta antiga recusava os tokens novos (401
// "Invalid token") e os números apareciam como "Caiu a conexão". Ao ligar, o backend relê o
// .env e sobrescreve o que veio diferente.

/** Lê o texto de um .env do mesmo jeito que o ecosystem.config.js (aspas externas removidas). */
export function lerEnv(texto: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linha of texto.split('\n')) {
    const t = linha.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const chave = t.slice(0, idx).trim();
    let valor = t.slice(idx + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    out[chave] = valor;
  }
  return out;
}

/** Aplica o .env sobre o ambiente; devolve só os NOMES que estavam diferentes (nunca os valores). */
export function aplicarEnv(doArquivo: Record<string, string>, env: NodeJS.ProcessEnv): string[] {
  const corrigidas: string[] = [];
  for (const [chave, valor] of Object.entries(doArquivo)) {
    if (env[chave] !== undefined && env[chave] !== valor) corrigidas.push(chave);
    env[chave] = valor;
  }
  return corrigidas;
}
