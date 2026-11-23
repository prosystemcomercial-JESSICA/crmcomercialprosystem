// Vigia dos backups do CRM Comercial (pedido da Jessica, 02/10/2026: "me avise quando o backup falhar";
// refeito em 23/11/2026, quando se descobriu que o backup diário saía sem as mensagens do WhatsApp desde 23/10
// e que a cópia "no MEGA" nunca subia para a nuvem).
// Confere a cada hora o /var/backups-comercial-status/servidor.json, gravado pelo backend/scripts/backup-servidor.sh:
//  1) último backup bom do servidor (dump completo + JSON) com menos de 13 h; última execução sem erro;
//  2) teste de restauração (MySQL descartável) com menos de 30 h e aprovado;
//  3) cópia na nuvem (MEGA, enviada pelo servidor) com menos de 30 h, e espaço livre na conta;
//  4) disco do servidor abaixo de 85%;
//  5) cópia extra no computador da Jessica (opcional): só avisa se parar por mais de 7 dias.
// Problema → aviso no WhatsApp da gestão, no máximo 1 vez a cada 6 h por tipo de problema.
import type { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';

const DIR_STATUS = process.env.BACKUP_STATUS_DIR || '/var/backups-comercial-status';
const STATUS = `${DIR_STATUS}/servidor.json`;
const MARCA_PC = `${DIR_STATUS}/copia-pc.json`;

const horasDesde = (d: Date) => (Date.now() - d.getTime()) / 3600_000;
const fmt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const data = (s: unknown) => (typeof s === 'string' && !isNaN(Date.parse(s)) ? new Date(s) : null);

export type ProblemaBackup = { chave: string; texto: string };

/** Só a análise (sem enviar nada): usada pelo vigia e pelos testes. */
export function analisarStatusBackup(status: any, marcaPc: any): ProblemaBackup[] {
  const problemas: ProblemaBackup[] = [];
  if (!status) return [{ chave: 'vps_sem_status', texto: 'Não encontrei o resultado do backup do servidor (servidor.json). O backup pode não estar rodando.' }];

  const ultimoOk = data(status.ultimo_ok_em);
  if (!ultimoOk || horasDesde(ultimoOk) > 13) {
    problemas.push({ chave: 'vps_atrasado', texto: `O servidor não faz um backup completo e bom desde ${ultimoOk ? fmt(ultimoOk) : 'nunca'} (deveria rodar às 3h e às 14h).` });
  }
  if (status.ok === false) {
    const erros = Array.isArray(status.erros) ? status.erros.join('; ') : '';
    problemas.push({ chave: 'vps_falhou', texto: `O último backup do servidor (${data(status.em) ? fmt(data(status.em)!) : '?'}) falhou: ${erros.slice(0, 220) || 'erro sem descrição'}.` });
  }

  const rest = status.restauracao;
  const restEm = data(rest?.em);
  if (!restEm || horasDesde(restEm) > 30) {
    problemas.push({ chave: 'restauracao_atrasada', texto: `O teste que prova que o backup restaura não roda desde ${restEm ? fmt(restEm) : 'nunca'}.` });
  } else if (rest.ok === false) {
    problemas.push({ chave: 'restauracao_falhou', texto: `O teste de restauração de ${fmt(restEm)} falhou: o backup pode não servir. Verificar hoje.` });
  }

  const nuvem = status.nuvem;
  if (!nuvem || nuvem.configurada === false) {
    problemas.push({ chave: 'nuvem_desligada', texto: 'A cópia na nuvem (MEGA) ainda não está ligada: os backups estão só no servidor.' });
  } else {
    const nOk = data(nuvem.ultimo_ok_em);
    if (!nOk || horasDesde(nOk) > 30) problemas.push({ chave: 'nuvem_atrasada', texto: `A cópia na nuvem (MEGA) não sobe desde ${nOk ? fmt(nOk) : 'nunca'}.` });
    const livre = Number(nuvem.livre_bytes);
    if (Number.isFinite(livre) && nuvem.livre_bytes != null && livre < 3 * 1024 ** 3) {
      problemas.push({ chave: 'nuvem_cheia', texto: `A conta do MEGA está quase cheia (${(livre / 1024 ** 3).toFixed(1)} GB livres).` });
    }
  }

  if (Number(status.disco_pct) >= 85) {
    problemas.push({ chave: 'disco_cheio', texto: `O disco do servidor está com ${status.disco_pct}% ocupado: se lotar, o backup e o CRM param.` });
  }

  const pc = data(marcaPc?.pc_em);
  if (marcaPc && (!pc || horasDesde(pc) > 24 * 7)) {
    problemas.push({ chave: 'pc_atrasado', texto: `A cópia extra no seu computador não roda desde ${pc ? fmt(pc) : 'nunca'} (o servidor e o MEGA continuam com os backups).` });
  }
  return problemas;
}

async function lerJson(caminho: string) {
  try { return JSON.parse(await fs.readFile(caminho, 'utf8')); } catch { return null; }
}

export async function verificarBackups(prisma: PrismaClient): Promise<string[]> {
  const problemas = analisarStatusBackup(await lerJson(STATUS), await lerJson(MARCA_PC));
  if (!problemas.length) return [];
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  const novos: string[] = [];
  for (const p of problemas) if (await podeEnviarUmaVez(prisma, `backup.alerta.${p.chave}`, 6)) novos.push(p.texto);
  if (novos.length) {
    const { enviarAvisoGestao } = await import('./assistente-gestao.service');
    await enviarAvisoGestao(prisma, 'lead_qualificado', `🚨 *Backup do CRM com problema*\n${novos.map(t => `• ${t}`).join('\n')}\n\nOs dados ainda estão no servidor, mas a cópia de segurança precisa ser verificada hoje.`, { somenteAprovadora: true }).catch((e: any) => console.error('[BACKUP-VIGIA] aviso:', e?.message));
    console.warn('[BACKUP-VIGIA]', novos.join(' | '));
  }
  return problemas.map(p => p.texto);
}
