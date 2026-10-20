// Hook SessionStart: avisa a sessão nova sobre os handoffs recentes deste projeto
// (escritos pela skill handoff em %LOCALAPPDATA%\Temp\handoffs-crm-comercial).
// Na volta de uma compactação, lembra o agente de gravar/atualizar o handoff.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DIAS = 7;
const MAX = 3;

let origem = 'startup';
try {
  origem = JSON.parse(readFileSync(0, 'utf8') || '{}').source || origem;
} catch {}

const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp') : tmpdir();
const pasta = join(base, 'handoffs-crm-comercial');

let recentes = [];
try {
  const limite = Date.now() - DIAS * 86400000;
  recentes = readdirSync(pasta)
    .filter((n) => n.endsWith('.md'))
    .map((n) => ({ caminho: join(pasta, n), quando: statSync(join(pasta, n)).mtimeMs }))
    .filter((a) => a.quando >= limite)
    .sort((a, b) => b.quando - a.quando)
    .slice(0, MAX);
} catch {}

const linhas = [];
if (recentes.length) {
  linhas.push(`Handoffs recentes deste projeto (últimos ${DIAS} dias, mais novo primeiro):`);
  for (const a of recentes) {
    const data = new Date(a.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    linhas.push(`- ${a.caminho} (${data})`);
  }
  linhas.push('Se o pedido da Jessica continuar uma dessas tarefas, leia o handoff antes de começar e diga a ela de qual parte está continuando. Se não tiver relação, ignore.');
}
if (origem === 'compact') {
  linhas.push('A conversa acabou de ser compactada. Se há tarefa em andamento, use a skill handoff agora para gravar ou atualizar o handoff dela, antes de seguir.');
}

if (linhas.length) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: linhas.join('\n') },
  }));
}
