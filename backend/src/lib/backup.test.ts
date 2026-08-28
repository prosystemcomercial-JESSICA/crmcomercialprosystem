// backend/src/lib/backup.test.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { executarBackup, listarBackups } from './backup';

async function testRetencaoMantemApenasCinco() {
  const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const prisma = new PrismaClient();

  for (let i = 0; i < 6; i++) {
    await executarBackup(prisma, volumePath);
    await new Promise(r => setTimeout(r, 1100)); // garante timestamps distintos (granularidade de segundo)
  }

  const backups = await listarBackups(volumePath);
  if (backups.length !== 5) {
    throw new Error(`Esperado 5 backups retidos, encontrado ${backups.length}`);
  }

  const pastas = fs.readdirSync(path.join(volumePath, 'backups'));
  if (pastas.length !== 5) {
    throw new Error(`Esperado 5 pastas no volume, encontrado ${pastas.length}`);
  }

  await prisma.$disconnect();
  fs.rmSync(volumePath, { recursive: true, force: true });
  console.log('testRetencaoMantemApenasCinco: OK');
}

async function testResumoTemFormatoEsperado() {
  const volumePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const prisma = new PrismaClient();

  const resumo = await executarBackup(prisma, volumePath);

  if (!resumo.timestamp || !resumo.data || !resumo.tabelas || !Array.isArray(resumo.erros)) {
    throw new Error(`Resumo com formato inesperado: ${JSON.stringify(resumo)}`);
  }
  if (Object.keys(resumo.tabelas).length === 0) {
    throw new Error('Resumo sem nenhuma tabela exportada — banco de teste vazio ou export quebrado');
  }

  await prisma.$disconnect();
  fs.rmSync(volumePath, { recursive: true, force: true });
  console.log('testResumoTemFormatoEsperado: OK');
}

async function main() {
  await testResumoTemFormatoEsperado();
  await testRetencaoMantemApenasCinco();
  console.log('TODOS OS TESTES PASSARAM');
}

main().catch(err => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
