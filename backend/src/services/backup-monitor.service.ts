// Vigia dos backups do CRM Comercial (pedido da Jessica, 02/10/2026: "me avise quando o backup falhar").
// Confere a cada hora:
//  1) backup da VPS (cron 3h e 14h de Brasília): o mais novo tem que ter menos de 13 h e terminar sem erros;
//  2) cópia no computador da Jessica (tarefa das 17h): marca enviada pelo sync com menos de 30 h;
//  3) cópia na nuvem (MEGA): última cópia com menos de 54 h.
// Problema → aviso no WhatsApp da gestão, no máximo 1 vez a cada 6 h por tipo de problema.
import type { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';

const DIR_BACKUP = process.env.BACKUP_DIR || '/var/backups-comercial';
const LOG_BACKUP = process.env.BACKUP_LOG || '/var/log/backup-comercial.log';
const MARCA_PC = '/var/backups-comercial-status/copia-pc.json';

const horasDesde = (d: Date) => (Date.now() - d.getTime()) / 3600_000;
const fmt = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export async function verificarBackups(prisma: PrismaClient): Promise<string[]> {
  const problemas: { chave: string; texto: string }[] = [];

  // 1) Backup da VPS.
  try {
    const pastas = (await fs.readdir(DIR_BACKUP)).filter(n => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(n)).sort();
    const ultima = pastas[pastas.length - 1];
    if (!ultima) problemas.push({ chave: 'vps_vazio', texto: `Nenhum backup encontrado em ${DIR_BACKUP}.` });
    else {
      const em = new Date(ultima.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z'));
      if (horasDesde(em) > 13) problemas.push({ chave: 'vps_atrasado', texto: `O backup do servidor não roda desde ${fmt(em)} (deveria rodar às 3h e às 14h).` });
      const arquivos = await fs.readdir(`${DIR_BACKUP}/${ultima}`).catch(() => []);
      if (arquivos.length < 50) problemas.push({ chave: 'vps_incompleto', texto: `O último backup (${fmt(em)}) está incompleto: só ${arquivos.length} tabelas salvas.` });
    }
  } catch (e: any) {
    problemas.push({ chave: 'vps_erro', texto: `Não consegui ler a pasta de backups do servidor (${e?.message}).` });
  }
  try {
    const log = await fs.readFile(LOG_BACKUP, 'utf8');
    const resumo = log.split('\n').filter(l => /\[BACKUP\] (OK|ERRO|FALHA)/i.test(l)).pop() || '';
    const erros = Number(resumo.match(/(\d+) erros?/)?.[1] || 0);
    if (/ERRO|FALHA/i.test(resumo.split('—')[0]) || erros > 0) problemas.push({ chave: 'vps_falhou', texto: `O último backup do servidor terminou com erro: "${resumo.trim().slice(0, 160)}".` });
  } catch { /* log ausente: a checagem da pasta já cobre */ }

  // 2) e 3) Cópia no computador e na nuvem.
  try {
    const marca = JSON.parse(await fs.readFile(MARCA_PC, 'utf8'));
    const pc = marca.pc_em ? new Date(marca.pc_em) : null;
    if (!pc || horasDesde(pc) > 30) problemas.push({ chave: 'pc_atrasado', texto: `A cópia dos backups no seu computador não roda desde ${pc ? fmt(pc) : 'nunca'} (o computador precisa estar ligado às 17h).` });
    const mega = marca.mega_em ? new Date(marca.mega_em) : null;
    if (!mega || horasDesde(mega) > 54) problemas.push({ chave: 'mega_atrasado', texto: `A cópia na nuvem (MEGA) não roda desde ${mega ? fmt(mega) : 'nunca'}.` });
  } catch {
    problemas.push({ chave: 'pc_sem_marca', texto: 'Ainda não recebi a confirmação da cópia no seu computador (ela é enviada depois da cópia das 17h).' });
  }

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
