// backend/src/lib/backup.ts
//
// Lógica de export de backup do banco — reaproveitada tanto pelo endpoint
// POST /backups (rodando no backend Railway) quanto, no futuro, por scripts
// locais equivalentes. Mesma abordagem do backend/scripts/backup-diario.cjs:
// descobre as tabelas via information_schema e exporta cada uma via SELECT *.

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export interface ResumoBackup {
  timestamp: string;
  data: string;
  tabelas: Record<string, number>;
  erros: Array<{ tabela: string; erro: string }>;
}

const RETENCAO_MAXIMA = 5;

function serializar(_key: string, value: any) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function pastaBackups(volumePath: string) {
  return path.join(volumePath, 'backups');
}

export async function executarBackup(prisma: PrismaClient, volumePath: string): Promise<ResumoBackup> {
  const agora = new Date();
  const timestamp = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const raiz = pastaBackups(volumePath);
  const pastaAtual = path.join(raiz, timestamp);
  fs.mkdirSync(pastaAtual, { recursive: true });

  const tabelas = await prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );

  const resumo: ResumoBackup = { timestamp, data: agora.toISOString(), tabelas: {}, erros: [] };

  for (const { TABLE_NAME: tabela } of tabelas) {
    try {
      const linhas = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM \`${tabela}\``);
      fs.writeFileSync(path.join(pastaAtual, `${tabela}.json`), JSON.stringify(linhas, serializar, 2), 'utf8');
      resumo.tabelas[tabela] = linhas.length;
    } catch (err: any) {
      resumo.erros.push({ tabela, erro: err.message });
    }
  }

  fs.writeFileSync(path.join(pastaAtual, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');

  aplicarRetencao(raiz);

  return resumo;
}

function aplicarRetencao(raiz: string) {
  if (!fs.existsSync(raiz)) return;
  const pastas = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse(); // mais recente primeiro

  for (const nome of pastas.slice(RETENCAO_MAXIMA)) {
    fs.rmSync(path.join(raiz, nome), { recursive: true, force: true });
  }
}

export async function listarBackups(volumePath: string): Promise<ResumoBackup[]> {
  const raiz = pastaBackups(volumePath);
  if (!fs.existsSync(raiz)) return [];

  const pastas = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse()
    .slice(0, RETENCAO_MAXIMA);

  const resumos: ResumoBackup[] = [];
  for (const nome of pastas) {
    const caminhoResumo = path.join(raiz, nome, '_resumo.json');
    if (fs.existsSync(caminhoResumo)) {
      resumos.push(JSON.parse(fs.readFileSync(caminhoResumo, 'utf8')));
    }
  }
  return resumos;
}
