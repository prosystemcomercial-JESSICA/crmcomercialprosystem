import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { executarBackup, listarBackups } from '@/lib/backup';

describe('Backup', () => {
  it('resumo tem formato esperado', async () => {
    const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const prisma = new PrismaClient();

    try {
      const resumo = await executarBackup(prisma, volumePath);

      expect(resumo.timestamp).toBeTruthy();
      expect(resumo.data).toBeTruthy();
      expect(resumo.tabelas).toBeTruthy();
      expect(Object.keys(resumo.tabelas).length).toBeGreaterThan(0);
      expect(Array.isArray(resumo.erros)).toBe(true);
    } finally {
      await prisma.$disconnect();
      fs.rmSync(volumePath, { recursive: true, force: true });
    }
  }, 60000);

  it('retencao mantem apenas cinco backups', async () => {
    const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const prisma = new PrismaClient();

    try {
      for (let i = 0; i < 6; i++) {
        await executarBackup(prisma, volumePath);
        await new Promise(r => setTimeout(r, 1100)); // garante timestamps distintos (granularidade de segundo)
      }

      const backups = await listarBackups(volumePath);
      expect(backups.length).toBe(5);

      // Verifica diretamente no disco (nao so o retorno da funcao) para pegar
      // o caso de retencao que so filtra o retorno sem de fato apagar as pastas antigas.
      const pastas = fs.readdirSync(path.join(volumePath, 'backups'));
      expect(pastas.length).toBe(5);
    } finally {
      await prisma.$disconnect();
      fs.rmSync(volumePath, { recursive: true, force: true });
    }
  }, 300000);
});
